import { STAGE_TIMEOUTS } from "@melodia/shared";
import type { Env } from "../types.js";
import { verifyJwt } from "../lib/jwt.js";
import { songQueries } from "../db/queries.js";
import { generateBlueprint } from "../services/blueprint.service.js";
import type { SongBlueprint } from "../services/blueprint.service.js";
import { generateLyrics, refineLyrics } from "../services/lyrics.service.js";
import { generateMusic } from "../services/music.service.js";
import { generateArtwork } from "../services/artwork.service.js";
import { postProcess } from "../services/postprocess.service.js";
import { analyzeReference, type ReferenceAnalysis } from "../services/reference.service.js";
import { ulid } from "ulidx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GenerationStage =
  | "reference"
  | "blueprint"
  | "lyrics"
  | "refinement"
  | "music"
  | "artwork"
  | "processing"
  | "completed"
  | "error";

type StageStatus = "in_progress" | "completed" | "failed";

type GenerationMessage = {
  type: "stage_update" | "state" | "error";
  stage?: GenerationStage;
  status?: StageStatus;
  data?: unknown;
  error?: string;
  generationState?: GenerationState;
};

type GenerationState = {
  songId: string;
  currentStage: GenerationStage | null;
  stages: Partial<Record<GenerationStage, StageStatus>>;
  completedAt?: string;
  error?: string;
};

type StartBody = {
  songId: string;
  userPrompt: string;
  userId: string;
  options?: {
    genre?: string;
    mood?: string;
    language?: string;
    duration?: number;
    batchSize?: number;
    cachedBlueprint?: SongBlueprint;
    cachedLyrics?: string;
    referenceAudioKey?: string;
  };
};

// ---------------------------------------------------------------------------
// Durable Object
// ---------------------------------------------------------------------------

export class SongGenerationSession {
  private state: DurableObjectState;
  private env: Env;
  private sessions: WebSocket[];

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = [];
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // ------------------------------------------------------------------
    // WebSocket upgrade
    // ------------------------------------------------------------------
    if (request.headers.get("Upgrade") === "websocket") {
      const token = url.searchParams.get("token");

      if (!token) {
        return new Response("Missing token", { status: 401 });
      }

      try {
        await verifyJwt(token, this.env.JWT_SECRET);
      } catch {
        return new Response("Invalid or expired token", { status: 401 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

      server.accept();
      this.sessions.push(server);

      // Send current state immediately
      const storedState = await this.state.storage.get<GenerationState>("generationState");
      if (storedState) {
        try {
          server.send(
            JSON.stringify({
              type: "state",
              generationState: storedState,
            } satisfies GenerationMessage)
          );
        } catch {
          // Client disconnected before we could send — ignore
        }
      }

      // Handle close: remove from sessions
      server.addEventListener("close", () => {
        this.sessions = this.sessions.filter((s) => s !== server);
      });

      server.addEventListener("error", () => {
        this.sessions = this.sessions.filter((s) => s !== server);
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    // ------------------------------------------------------------------
    // POST /start
    // ------------------------------------------------------------------
    if (request.method === "POST" && url.pathname.endsWith("/start")) {
      const body = (await request.json()) as StartBody;

      // Fire and forget — return 200 immediately, pipeline runs in background
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.startGeneration(
        body.songId,
        body.userPrompt,
        body.userId,
        body.options
      );

      return new Response(JSON.stringify({ started: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  }

  // --------------------------------------------------------------------------
  // broadcast — send message to all connected WebSocket sessions
  // --------------------------------------------------------------------------

  private broadcast(message: GenerationMessage): void {
    const payload = JSON.stringify(message);
    this.sessions = this.sessions.filter((ws) => {
      try {
        ws.send(payload);
        return true;
      } catch {
        // Socket is closed or errored — remove from list
        return false;
      }
    });
  }

  // --------------------------------------------------------------------------
  // updateStage — persist stage update + broadcast
  // --------------------------------------------------------------------------

  private async updateStage(
    stage: GenerationStage,
    status: StageStatus,
    data?: unknown
  ): Promise<void> {
    const existing =
      (await this.state.storage.get<GenerationState>("generationState")) ?? {
        songId: "",
        currentStage: null,
        stages: {},
      };

    const updated: GenerationState = {
      ...existing,
      currentStage: status === "completed" ? existing.currentStage : stage,
      stages: { ...existing.stages, [stage]: status },
    };

    if (stage === "completed" && status === "completed") {
      updated.currentStage = "completed";
      updated.completedAt = new Date().toISOString();
    }

    await this.state.storage.put("generationState", updated);

    this.broadcast({
      type: "stage_update",
      stage,
      status,
      data,
    });
  }

  // --------------------------------------------------------------------------
  // startGeneration — full pipeline
  // --------------------------------------------------------------------------

  // --------------------------------------------------------------------------
  // uint8ToBase64 — chunked base64 encoding safe for large files (> 100KB)
  // --------------------------------------------------------------------------

  private uint8ToBase64(bytes: Uint8Array): string {
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  private async startGeneration(
    songId: string,
    userPrompt: string,
    _userId: string,
    options?: StartBody["options"]
  ): Promise<void> {
    const batchSize = options?.batchSize ?? 1;
    const cachedBlueprint = options?.cachedBlueprint;
    const cachedLyrics = options?.cachedLyrics;

    // Initialise state
    const initialState: GenerationState = {
      songId,
      currentStage: options?.referenceAudioKey ? "reference" : "blueprint",
      stages: {},
    };
    await this.state.storage.put("generationState", initialState);

    try {
      // ----------------------------------------------------------------
      // Stage 0: Reference Analysis (optional — only when reference provided)
      // ----------------------------------------------------------------
      let referenceAnalysis: ReferenceAnalysis | undefined;
      let referenceAudioBase64: string | undefined;

      if (options?.referenceAudioKey) {
        await this.updateStage("reference", "in_progress");
        await songQueries.updateStatus(this.env.DB, songId, "generating_lyrics");

        const refObject = await this.env.R2_BUCKET.get(options.referenceAudioKey);
        if (refObject) {
          const audioBytes = await refObject.arrayBuffer();
          referenceAnalysis = await analyzeReference(this.env.AI, audioBytes);

          // Chunked base64 encoding — safe for files > 100KB
          const uint8 = new Uint8Array(audioBytes);
          referenceAudioBase64 = this.uint8ToBase64(uint8);
        }

        await this.updateStage("reference", "completed", {
          genre: referenceAnalysis?.detected_genre,
          mood: referenceAnalysis?.detected_mood,
        });
      }

      // ----------------------------------------------------------------
      // Stage 1: Blueprint
      // ----------------------------------------------------------------
      await songQueries.updateStatus(this.env.DB, songId, "generating_lyrics");
      await this.updateStage("blueprint", "in_progress");

      let blueprint: SongBlueprint;
      if (cachedBlueprint) {
        // Use cached blueprint — skip LLM call
        blueprint = cachedBlueprint;
        await songQueries.updateTitle(this.env.DB, songId, blueprint.title);
        await this.updateStage("blueprint", "completed", {
          title: blueprint.title,
          genre: blueprint.genre,
          mood: blueprint.mood,
        });
      } else {
        // Enrich prompt with reference analysis if available
        let enrichedPrompt = userPrompt;
        if (referenceAnalysis) {
          enrichedPrompt += `\n\nREFERENCE TRACK ANALYSIS:\nStyle: ${referenceAnalysis.style_description}\nTags: ${referenceAnalysis.extracted_tags}\nGenre: ${referenceAnalysis.detected_genre}, Mood: ${referenceAnalysis.detected_mood}\nVocal: ${referenceAnalysis.vocal_character}, Instruments: ${referenceAnalysis.instrumentation}\nBPM estimate: ${referenceAnalysis.estimated_bpm}\n\nUse this as creative inspiration. Match the energy and production style while creating something completely original.`;
        }

        blueprint = await generateBlueprint(this.env.AI, enrichedPrompt, {
          genre: options?.genre,
          mood: options?.mood,
          language: options?.language,
          duration: options?.duration,
        });

        await songQueries.updateTitle(this.env.DB, songId, blueprint.title);
        await this.updateStage("blueprint", "completed", {
          title: blueprint.title,
          genre: blueprint.genre,
          mood: blueprint.mood,
        });
      }

      // ----------------------------------------------------------------
      // Stage 2: Lyrics generation
      // ----------------------------------------------------------------
      await this.updateStage("lyrics", "in_progress");

      let lyrics: string;
      if (cachedLyrics) {
        // Use cached lyrics — skip both lyrics and refinement LLM calls
        lyrics = cachedLyrics;
        await this.updateStage("lyrics", "completed");
        await this.updateStage("refinement", "completed", { scores: {} });
      } else {
        // Enrich blueprint song_concept with reference transcription if available
        if (referenceAnalysis?.transcription) {
          blueprint.song_concept = (blueprint.song_concept || "") +
            ` The reference track had lyrics with this theme: "${referenceAnalysis.transcription.slice(0, 500)}". Draw thematic inspiration but write completely original lyrics.`;
        }

        const rawLyrics = await generateLyrics(this.env.AI, blueprint);
        await this.updateStage("lyrics", "completed");

        // ----------------------------------------------------------------
        // Stage 3: Lyrics refinement
        // ----------------------------------------------------------------
        await this.updateStage("refinement", "in_progress");
        const { lyrics: refinedLyrics, scores } = await refineLyrics(this.env.AI, rawLyrics, blueprint);
        lyrics = refinedLyrics;
        await this.updateStage("refinement", "completed", { scores });
      }

      // ----------------------------------------------------------------
      // Stage 4: Music generation
      // ----------------------------------------------------------------
      await songQueries.updateStatus(this.env.DB, songId, "generating_music");
      await this.updateStage("music", "in_progress");

      // Scale timeout by batchSize (capped at 2x) to allow enough time for all variations
      const musicTimeoutMs = STAGE_TIMEOUTS.MUSIC * Math.min(batchSize, 2);

      const audioResult = await generateMusic(this.env, blueprint, lyrics, songId, batchSize, musicTimeoutMs, referenceAudioBase64);
      await this.updateStage("music", "completed", {
        audioKeys: audioResult.audioKeys,
        variation_count: audioResult.variationCount,
      });

      // ----------------------------------------------------------------
      // Stage 5: Artwork generation
      // ----------------------------------------------------------------
      await songQueries.updateStatus(this.env.DB, songId, "generating_artwork");
      await this.updateStage("artwork", "in_progress");
      const artworkResult = await generateArtwork(
        this.env.AI,
        blueprint,
        blueprint.title,
        songId,
        this.env.R2_BUCKET
      );
      await this.updateStage("artwork", "completed", {
        artwork_url: artworkResult.artwork_url,
      });

      // ----------------------------------------------------------------
      // Stage 6: Post-processing
      // ----------------------------------------------------------------
      await songQueries.updateStatus(this.env.DB, songId, "processing");
      await this.updateStage("processing", "in_progress");
      await postProcess(this.env, songId, blueprint, lyrics, audioResult, artworkResult);
      await this.updateStage("processing", "completed");

      // ----------------------------------------------------------------
      // Stage 7: Complete
      // ----------------------------------------------------------------
      await this.updateStage("completed", "completed");
      this.broadcast({ type: "stage_update", stage: "completed", status: "completed" });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[SongGenerationSession] Pipeline failed for song ${songId}:`, err);

      // Mark song as failed
      await songQueries.updateFailed(this.env.DB, songId);

      // Refund credit atomically
      try {
        const txId = ulid();
        // We need the user_id to refund — fetch the song to get it
        const song = await songQueries.findById(this.env.DB, songId) as { user_id: string } | null;
        if (song?.user_id) {
          await this.env.DB.batch([
            this.env.DB.prepare(
              "UPDATE users SET credits_remaining = credits_remaining + 1, updated_at = datetime('now') WHERE id = ?"
            ).bind(song.user_id),
            this.env.DB.prepare(
              "INSERT INTO credit_transactions (id, user_id, amount, reason, song_id) VALUES (?, ?, 1, 'generation_refund', ?)"
            ).bind(txId, song.user_id, songId),
          ]);
        }
      } catch (refundErr) {
        console.error(`[SongGenerationSession] Credit refund failed for song ${songId}:`, refundErr);
      }

      // Persist error state
      const failedState: GenerationState = {
        songId,
        currentStage: "error",
        stages: {},
        error: errorMessage,
      };
      await this.state.storage.put("generationState", failedState);

      this.broadcast({
        type: "error",
        error: errorMessage,
      });
    }
  }
}
