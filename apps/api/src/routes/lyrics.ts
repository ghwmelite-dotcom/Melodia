import { Hono } from "hono";
import * as v from "valibot";
import { GenerateLyricsSchema, RefineLyricsSchema } from "@melodia/shared";
import type { Env, Variables } from "../types.js";
import { AppError } from "../middleware/error-handler.js";
import { authGuard } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { generateBlueprint } from "../services/blueprint.service.js";
import type { SongBlueprint } from "../services/blueprint.service.js";
import { generateLyrics, refineLyrics } from "../services/lyrics.service.js";

type HonoContext = { Bindings: Env; Variables: Variables };

const lyrics = new Hono<HonoContext>();

// Rate limit config: 10 requests per hour per user
const lyricsRateLimit = () =>
  rateLimit({
    key: (c) => `lyrics:${c.get("userId")}`,
    limit: 10,
    windowSeconds: 3600,
  });

// ----------------------------------------------------------------------------
// POST /generate — standalone lyrics generation (no credit deduction)
// ----------------------------------------------------------------------------
lyrics.post(
  "/generate",
  authGuard(),
  lyricsRateLimit(),
  async (c) => {
    const body = await c.req.json().catch(() => {
      throw new AppError("VALIDATION_ERROR", "Invalid JSON body", 400);
    });

    const result = v.safeParse(GenerateLyricsSchema, body);
    if (!result.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        result.issues.map((i) => i.message).join(", "),
        400
      );
    }

    const { prompt, genre, mood } = result.output;

    const blueprint = await generateBlueprint(c.env.AI, prompt, {
      genre,
      mood,
    });

    const lyricsText = await generateLyrics(c.env.AI, blueprint);

    return c.json({
      success: true,
      lyrics: lyricsText,
      blueprint: {
        title: blueprint.title,
        genre: blueprint.genre,
        mood: blueprint.mood,
      },
    });
  }
);

// ----------------------------------------------------------------------------
// POST /refine — refine existing lyrics (no credit deduction)
// ----------------------------------------------------------------------------
lyrics.post(
  "/refine",
  authGuard(),
  lyricsRateLimit(),
  async (c) => {
    const body = await c.req.json().catch(() => {
      throw new AppError("VALIDATION_ERROR", "Invalid JSON body", 400);
    });

    const result = v.safeParse(RefineLyricsSchema, body);
    if (!result.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        result.issues.map((i) => i.message).join(", "),
        400
      );
    }

    const { lyrics: inputLyrics, genre, mood } = result.output;

    // Build a minimal blueprint from the provided genre/mood with sensible defaults
    const minimalBlueprint: SongBlueprint = {
      title: "Untitled",
      genre: genre ?? "pop",
      sub_genre: genre ?? "pop",
      mood: mood ?? "neutral",
      bpm: 120,
      key: "C",
      time_signature: "4/4",
      duration: 180,
      vocal_style: "standard",
      vocal_language: "en",
      instruments: ["guitar", "bass", "drums", "keys"],
      style_tags: [genre ?? "pop", mood ?? "neutral"].join(", "),
      artwork_mood: "abstract",
      song_concept: "A song about life and emotions.",
    };

    const { lyrics: refinedLyrics, scores } = await refineLyrics(
      c.env.AI,
      inputLyrics,
      minimalBlueprint
    );

    return c.json({
      success: true,
      lyrics: refinedLyrics,
      scores,
    });
  }
);

export default lyrics;
