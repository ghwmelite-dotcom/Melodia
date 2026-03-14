import { Hono } from "hono";
import { ulid } from "ulidx";
import * as v from "valibot";
import { GenerateSongSchema } from "@melodia/shared";
import type { Env, Variables } from "../types.js";
import { AppError } from "../middleware/error-handler.js";
import { authGuard } from "../middleware/auth.js";
import { songQueries } from "../db/queries.js";

type HonoContext = { Bindings: Env; Variables: Variables };

const songs = new Hono<HonoContext>();

// All songs routes require authentication
songs.use("/*", authGuard());

// ----------------------------------------------------------------------------
// POST /generate
// ----------------------------------------------------------------------------
songs.post("/generate", async (c) => {
  const body = await c.req.json().catch(() => {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON body", 400);
  });

  const result = v.safeParse(GenerateSongSchema, body);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      result.issues.map((i) => i.message).join(", "),
      400
    );
  }

  const { prompt, genre, mood, language, duration } = result.output;
  const userId = c.get("userId");
  const songId = ulid();
  const txId = ulid();

  // Atomic credit deduction — deduct first, then create song + credit transaction together.
  // The credit_transaction has a FK to songs(id), so the song must exist first.
  const deductResult = await c.env.DB.prepare(
    "UPDATE users SET credits_remaining = credits_remaining - 1, updated_at = datetime('now') WHERE id = ? AND credits_remaining > 0"
  ).bind(userId).run();

  if (deductResult.meta.changes === 0) {
    throw new AppError("FORBIDDEN", "Insufficient credits", 403);
  }

  // Create song record + credit transaction in batch (song must exist before credit_transaction FK)
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO songs (id, user_id, title, user_prompt, genre, mood, vocal_language, duration_seconds, generation_started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(songId, userId, prompt.slice(0, 100), prompt, genre ?? null, mood ?? null, language ?? null, duration ?? 180),
    c.env.DB.prepare(
      "INSERT INTO credit_transactions (id, user_id, amount, reason, song_id) VALUES (?, ?, -1, 'song_generation', ?)"
    ).bind(txId, userId, songId),
  ]);

  // Trigger Durable Object pipeline (fire and forget from the route's perspective)
  const doId = c.env.SONG_SESSION.idFromName(songId);
  const stub = c.env.SONG_SESSION.get(doId);

  const startUrl = new URL(c.req.url);
  startUrl.pathname = "/start";

  await stub.fetch(
    new Request(startUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        songId,
        userPrompt: prompt,
        userId,
        options: { genre, mood, language, duration },
      }),
    })
  );

  return c.json({ success: true, song_id: songId, status: "pending" }, 202);
});

// ----------------------------------------------------------------------------
// GET / — list songs
// ----------------------------------------------------------------------------
songs.get("/", async (c) => {
  const userId = c.get("userId");
  const { status, limit: limitStr, cursor } = c.req.query();

  const limit = Math.min(parseInt(limitStr ?? "20", 10) || 20, 50);

  const queryResult = await songQueries.listByUser(c.env.DB, userId, {
    status: status || undefined,
    limit,
    cursor: cursor || undefined,
  });

  const results = (queryResult.results ?? []) as Record<string, unknown>[];

  // If we got limit+1 results, there's a next page
  let next_cursor: string | null = null;
  if (results.length > limit) {
    const lastItem = results.pop(); // remove the extra item
    next_cursor = (lastItem?.id as string) ?? null;
  }

  return c.json({ success: true, songs: results, next_cursor });
});

// ----------------------------------------------------------------------------
// GET /:id — full song detail
// ----------------------------------------------------------------------------
songs.get("/:id", async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.param();

  const song = await songQueries.findByIdAndUser(c.env.DB, id, userId);
  if (!song) {
    throw new AppError("NOT_FOUND", "Song not found", 404);
  }

  return c.json({ success: true, song });
});

// ----------------------------------------------------------------------------
// GET /:id/status
// ----------------------------------------------------------------------------
songs.get("/:id/status", async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.param();

  const song = (await songQueries.findByIdAndUser(c.env.DB, id, userId)) as {
    status: string;
  } | null;

  if (!song) {
    throw new AppError("NOT_FOUND", "Song not found", 404);
  }

  return c.json({ success: true, status: song.status });
});

// ----------------------------------------------------------------------------
// GET /:id/stream — audio streaming with Range support
// ----------------------------------------------------------------------------
songs.get("/:id/stream", async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.param();

  const song = (await songQueries.findByIdAndUser(c.env.DB, id, userId)) as {
    audio_url: string | null;
  } | null;

  if (!song) {
    throw new AppError("NOT_FOUND", "Song not found", 404);
  }

  if (!song.audio_url) {
    throw new AppError("NOT_FOUND", "Audio not available yet", 404);
  }

  const rangeHeader = c.req.header("Range");

  if (rangeHeader) {
    // Parse: "bytes=start-end"
    const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
    if (!match) {
      return new Response("Invalid Range header", { status: 416 });
    }

    const start = parseInt(match[1], 10);
    const endStr = match[2];

    const r2Range: { offset: number; length?: number } = { offset: start };
    let end: number | undefined;

    if (endStr) {
      end = parseInt(endStr, 10);
      r2Range.length = end - start + 1;
    }

    const r2Object = await c.env.R2_BUCKET.get(song.audio_url, { range: r2Range });
    if (!r2Object) {
      throw new AppError("NOT_FOUND", "Audio file not found", 404);
    }

    const size = r2Object.size;
    const actualEnd = end ?? size - 1;
    const contentLength = actualEnd - start + 1;

    return new Response(r2Object.body, {
      status: 206,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(contentLength),
        "Content-Range": `bytes ${start}-${actualEnd}/${size}`,
        "Accept-Ranges": "bytes",
      },
    });
  }

  // No Range header — return full file
  const r2Object = await c.env.R2_BUCKET.get(song.audio_url);
  if (!r2Object) {
    throw new AppError("NOT_FOUND", "Audio file not found", 404);
  }

  return new Response(r2Object.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(r2Object.size),
      "Accept-Ranges": "bytes",
    },
  });
});

// ----------------------------------------------------------------------------
// DELETE /:id
// ----------------------------------------------------------------------------
songs.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.param();

  const song = await songQueries.findByIdAndUser(c.env.DB, id, userId);
  if (!song) {
    throw new AppError("NOT_FOUND", "Song not found", 404);
  }

  // Delete R2 objects by prefix for all three asset types
  const prefixes = [
    `audio/${id}/`,
    `artwork/${id}/`,
    `waveforms/${id}/`,
  ];

  await Promise.all(
    prefixes.map(async (prefix) => {
      const listed = await c.env.R2_BUCKET.list({ prefix });
      if (listed.objects.length > 0) {
        await Promise.all(
          listed.objects.map((obj) => c.env.R2_BUCKET.delete(obj.key))
        );
      }
    })
  );

  // Delete D1 record
  await songQueries.delete(c.env.DB, id);

  return c.json({ success: true, message: "Song deleted" });
});

export default songs;
