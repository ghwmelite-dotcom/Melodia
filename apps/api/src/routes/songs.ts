import { Hono } from "hono";
import { ulid } from "ulidx";
import * as v from "valibot";
import { GenerateSongSchema, UpdateSongSchema, PLAN_CREDITS } from "@melodia/shared";
import type { Env, Variables } from "../types.js";
import { AppError } from "../middleware/error-handler.js";
import { authGuard, optionalAuthGuard } from "../middleware/auth.js";
import {
  songQueries,
  exploreQueries,
  likeQueries,
  billingQueries,
} from "../db/queries.js";

type HonoContext = { Bindings: Env; Variables: Variables };

const songs = new Hono<HonoContext>();

// ----------------------------------------------------------------------------
// GET /explore  (public — no auth required)
// MUST be registered BEFORE /:id wildcard
// ----------------------------------------------------------------------------
songs.get("/explore", async (c) => {
  const {
    tab = "new",
    genre,
    limit: limitStr,
    cursor,
    offset: offsetStr,
    page: pageStr,
  } = c.req.query();

  const limit = Math.min(parseInt(limitStr ?? "20", 10) || 20, 50);

  if (tab === "popular") {
    const page = parseInt(pageStr ?? "0", 10) || 0;
    const offset = parseInt(offsetStr ?? "0", 10) || page * limit;

    const result = await exploreQueries.popularSongs(c.env.DB, {
      limit,
      offset,
      genre: genre || undefined,
    });

    const songsList = result.results ?? [];
    return c.json({ success: true, songs: songsList });
  }

  // Default: "new" tab (also used for "genre" tab with genre filter)
  const result = await exploreQueries.newSongs(c.env.DB, {
    limit,
    cursor: cursor || undefined,
    genre: genre || undefined,
  });

  const results = (result.results ?? []) as Record<string, unknown>[];

  let next_cursor: string | null = null;
  if (results.length > limit) {
    const lastItem = results.pop();
    next_cursor = (lastItem?.id as string) ?? null;
  }

  return c.json({ success: true, songs: results, next_cursor });
});

// ----------------------------------------------------------------------------
// GET /liked  (protected — authGuard)
// MUST be registered BEFORE /:id wildcard
// ----------------------------------------------------------------------------
songs.get("/liked", authGuard(), async (c) => {
  const userId = c.get("userId");
  const { limit: limitStr, page: pageStr, offset: offsetStr } = c.req.query();

  const limit = Math.min(parseInt(limitStr ?? "20", 10) || 20, 50);
  const page = parseInt(pageStr ?? "0", 10) || 0;
  const offset = parseInt(offsetStr ?? "0", 10) || page * limit;

  const result = await likeQueries.likedSongs(c.env.DB, userId, {
    limit,
    offset,
  });

  return c.json({ success: true, songs: result.results ?? [] });
});

// ----------------------------------------------------------------------------
// Helper: lazy credit reset — checks plan expiry and daily reset window
// ----------------------------------------------------------------------------
async function ensureCreditsReset(
  db: D1Database,
  userId: string
): Promise<void> {
  const user = (await db
    .prepare(
      "SELECT plan, credits_remaining, credits_reset_at, plan_expires_at FROM users WHERE id = ?"
    )
    .bind(userId)
    .first()) as {
    plan: string;
    credits_remaining: number;
    credits_reset_at: string | null;
    plan_expires_at: string | null;
  } | null;

  if (!user) return;

  const now = new Date();

  // 1. Check plan expiry — downgrade to free if subscription has lapsed
  if (user.plan_expires_at) {
    const expiry = new Date(user.plan_expires_at);
    if (now >= expiry) {
      await billingQueries.downgradePlan(db, userId);
      return; // downgradePlan already sets credits to 5
    }
  }

  // 2. Daily credit reset — reset if credits_reset_at is in the past
  if (user.credits_reset_at) {
    const resetAt = new Date(user.credits_reset_at);
    if (now >= resetAt) {
      const maxCredits = PLAN_CREDITS[user.plan] ?? 5;
      // Unlimited plans (-1) don't need a daily reset
      if (maxCredits !== -1) {
        const nextMidnight = new Date();
        nextMidnight.setUTCHours(24, 0, 0, 0);
        const newResetAt = nextMidnight.toISOString().replace("T", " ").slice(0, 19);

        await billingQueries.resetCredits(db, userId, maxCredits, newResetAt);

        // Log daily_reset credit transaction
        const txId = ulid();
        await db
          .prepare(
            "INSERT INTO credit_transactions (id, user_id, amount, reason) VALUES (?, ?, ?, 'daily_reset')"
          )
          .bind(txId, userId, maxCredits)
          .run();
      }
    }
  }
}

// ----------------------------------------------------------------------------
// POST /generate  (protected)
// ----------------------------------------------------------------------------
songs.post("/generate", authGuard(), async (c) => {
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

  // Lazy credit reset — handles plan expiry downgrade + daily midnight reset
  await ensureCreditsReset(c.env.DB, userId);

  // Re-fetch user after potential reset to get current plan and credits
  const currentUser = (await c.env.DB.prepare(
    "SELECT plan, credits_remaining FROM users WHERE id = ?"
  )
    .bind(userId)
    .first()) as { plan: string; credits_remaining: number } | null;

  if (!currentUser) {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }

  const planMax = PLAN_CREDITS[currentUser.plan] ?? 5;
  const isUnlimited = planMax === -1;

  if (isUnlimited) {
    // Unlimited plan — skip credit deduction, create song + log zero-amount transaction
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO songs (id, user_id, title, user_prompt, genre, mood, vocal_language, duration_seconds, generation_started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        songId,
        userId,
        prompt.slice(0, 100),
        prompt,
        genre ?? null,
        mood ?? null,
        language ?? null,
        duration ?? 180
      ),
      c.env.DB.prepare(
        "INSERT INTO credit_transactions (id, user_id, amount, reason, song_id) VALUES (?, ?, 0, 'song_generation', ?)"
      ).bind(txId, userId, songId),
    ]);
  } else {
    // Finite credits — atomic deduction first, then create song + transaction
    const deductResult = await c.env.DB.prepare(
      "UPDATE users SET credits_remaining = credits_remaining - 1, updated_at = datetime('now') WHERE id = ? AND credits_remaining > 0"
    )
      .bind(userId)
      .run();

    if (deductResult.meta.changes === 0) {
      throw new AppError("FORBIDDEN", "Insufficient credits", 403);
    }

    // Create song record + credit transaction in batch
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO songs (id, user_id, title, user_prompt, genre, mood, vocal_language, duration_seconds, generation_started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        songId,
        userId,
        prompt.slice(0, 100),
        prompt,
        genre ?? null,
        mood ?? null,
        language ?? null,
        duration ?? 180
      ),
      c.env.DB.prepare(
        "INSERT INTO credit_transactions (id, user_id, amount, reason, song_id) VALUES (?, ?, -1, 'song_generation', ?)"
      ).bind(txId, userId, songId),
    ]);
  }

  // Trigger Durable Object pipeline
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
// GET /  — list user's own songs  (protected)
// ----------------------------------------------------------------------------
songs.get("/", authGuard(), async (c) => {
  const userId = c.get("userId");
  const { status, limit: limitStr, cursor } = c.req.query();

  const limit = Math.min(parseInt(limitStr ?? "20", 10) || 20, 50);

  const queryResult = await songQueries.listByUser(c.env.DB, userId, {
    status: status || undefined,
    limit,
    cursor: cursor || undefined,
  });

  const results = (queryResult.results ?? []) as Record<string, unknown>[];

  let next_cursor: string | null = null;
  if (results.length > limit) {
    const lastItem = results.pop();
    next_cursor = (lastItem?.id as string) ?? null;
  }

  return c.json({ success: true, songs: results, next_cursor });
});

// ----------------------------------------------------------------------------
// GET /:id/status  (protected — owner only)
// Must be registered before GET /:id to avoid matching "status" as sub-route.
// In Hono, /:id/status is more specific than /:id so order doesn't matter,
// but we keep it grouped logically after /:id.
// ----------------------------------------------------------------------------
songs.get("/:id/status", authGuard(), async (c) => {
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
// GET /:id/stream  — audio streaming with Range support (optionally authenticated)
// ----------------------------------------------------------------------------
songs.get("/:id/stream", optionalAuthGuard(), async (c) => {
  const userId = c.get("userId") as string | undefined;
  const { id } = c.req.param();

  const song = (await songQueries.findByIdPublic(c.env.DB, id)) as {
    id: string;
    user_id: string;
    audio_url: string | null;
    is_public: number | boolean;
  } | null;

  if (!song) {
    throw new AppError("NOT_FOUND", "Song not found", 404);
  }

  const isPublic = song.is_public === 1 || song.is_public === true;
  const isOwner = userId !== undefined && song.user_id === userId;

  if (!isPublic && !isOwner) {
    throw new AppError("FORBIDDEN", "Access denied", 403);
  }

  if (!song.audio_url) {
    throw new AppError("NOT_FOUND", "Audio not available yet", 404);
  }

  // Fire-and-forget play count tracking (dedup via KV)
  if (userId) {
    const kvKey = `played:${userId}:${id}`;
    // Use waitUntil if available so it doesn't block the response
    const trackPlay = async () => {
      try {
        const already = await c.env.KV.get(kvKey);
        if (already === null) {
          await c.env.KV.put(kvKey, "1", { expirationTtl: 3600 });
          await songQueries.incrementPlayCount(c.env.DB, id);
        }
      } catch {
        // Non-critical — don't let tracking errors affect streaming
      }
    };
    // Fire and forget — no await
    void trackPlay();
  }

  const rangeHeader = c.req.header("Range");

  if (rangeHeader) {
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

    const r2Object = await c.env.R2_BUCKET.get(song.audio_url, {
      range: r2Range,
    });
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
// GET /:id  — full song detail (optionally authenticated)
// ----------------------------------------------------------------------------
songs.get("/:id", optionalAuthGuard(), async (c) => {
  const userId = c.get("userId") as string | undefined;
  const { id } = c.req.param();

  const song = (await songQueries.findByIdPublic(c.env.DB, id)) as Record<
    string,
    unknown
  > | null;

  if (!song) {
    throw new AppError("NOT_FOUND", "Song not found", 404);
  }

  const isPublic = song.is_public === 1 || song.is_public === true;
  const isOwner = userId !== undefined && song.user_id === userId;

  if (!isPublic && !isOwner) {
    throw new AppError("NOT_FOUND", "Song not found", 404);
  }

  let is_liked: boolean | undefined;
  if (userId) {
    const liked = await likeQueries.isLiked(c.env.DB, userId, id);
    is_liked = liked !== null;
  }

  return c.json({ success: true, song: { ...song, is_liked } });
});

// ----------------------------------------------------------------------------
// PUT /:id  — update song (protected — owner only)
// ----------------------------------------------------------------------------
songs.put("/:id", authGuard(), async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.param();

  const body = await c.req.json().catch(() => {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON body", 400);
  });

  const result = v.safeParse(UpdateSongSchema, body);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      result.issues.map((i) => i.message).join(", "),
      400
    );
  }

  const fields = result.output;

  if (fields.is_public === undefined && fields.title === undefined) {
    throw new AppError(
      "VALIDATION_ERROR",
      "At least one field (is_public or title) must be provided",
      400
    );
  }

  const existing = await songQueries.findByIdAndUser(c.env.DB, id, userId);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Song not found", 404);
  }

  await songQueries.update(c.env.DB, id, fields);

  const updated = await songQueries.findByIdPublic(c.env.DB, id);
  return c.json({ success: true, song: updated });
});

// ----------------------------------------------------------------------------
// POST /:id/like  (protected)
// ----------------------------------------------------------------------------
songs.post("/:id/like", authGuard(), async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.param();

  const song = (await songQueries.findByIdPublic(c.env.DB, id)) as {
    id: string;
    user_id: string;
    is_public: number | boolean;
    like_count: number;
  } | null;

  if (!song) {
    throw new AppError("NOT_FOUND", "Song not found", 404);
  }

  const isPublic = song.is_public === 1 || song.is_public === true;
  if (!isPublic) {
    throw new AppError("NOT_FOUND", "Song not found", 404);
  }

  if (song.user_id === userId) {
    throw new AppError("FORBIDDEN", "Cannot like your own song", 403);
  }

  await likeQueries.like(c.env.DB, userId, song.id);

  // Fetch updated like_count
  const updated = (await songQueries.findByIdPublic(c.env.DB, id)) as {
    like_count: number;
  } | null;

  return c.json({
    success: true,
    liked: true,
    like_count: updated?.like_count ?? song.like_count + 1,
  });
});

// ----------------------------------------------------------------------------
// DELETE /:id/like  (protected)
// ----------------------------------------------------------------------------
songs.delete("/:id/like", authGuard(), async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.param();

  const deleteResult = await likeQueries.unlike(c.env.DB, userId, id);

  if (deleteResult.meta.changes > 0) {
    await likeQueries.decrementLikeCount(c.env.DB, id);
  }

  const updated = (await songQueries.findByIdPublic(c.env.DB, id)) as {
    like_count: number;
  } | null;

  return c.json({
    success: true,
    liked: false,
    like_count: updated?.like_count ?? 0,
  });
});

// ----------------------------------------------------------------------------
// DELETE /:id  (protected — owner only)
// ----------------------------------------------------------------------------
songs.delete("/:id", authGuard(), async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.param();

  const song = await songQueries.findByIdAndUser(c.env.DB, id, userId);
  if (!song) {
    throw new AppError("NOT_FOUND", "Song not found", 404);
  }

  // Delete R2 objects by prefix for all three asset types
  const prefixes = [`audio/${id}/`, `artwork/${id}/`, `waveforms/${id}/`];

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

  await songQueries.delete(c.env.DB, id);

  return c.json({ success: true, message: "Song deleted" });
});

export default songs;
