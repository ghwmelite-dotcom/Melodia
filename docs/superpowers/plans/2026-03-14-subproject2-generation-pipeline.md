# Sub-project 2: Song Generation Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 7-stage song generation pipeline that takes a user's text prompt and produces a complete song with lyrics, vocals/instrumentation (via ACE-Step or mock), and album artwork — with real-time WebSocket progress via a Durable Object orchestrator.

**Architecture:** Durable Object orchestrates the pipeline sequentially (blueprint → lyrics → refinement → music → artwork → post-processing → delivery). Each stage is a stateless service function. The DO maintains state, broadcasts progress via WebSocket, and handles errors with credit refund. Songs route triggers the DO and provides CRUD + audio streaming from R2.

**Tech Stack:** Cloudflare Workers AI (`@cf/meta/llama-4-scout-17b-16e-instruct`, `@cf/black-forest-labs/flux-2-dev`), ACE-Step 1.5 REST API, Cloudflare R2, Durable Objects, WebSocket, Hono, Valibot, ulidx

**Spec:** `docs/superpowers/specs/2026-03-14-melodia-subproject2-generation-pipeline-design.md`

---

## Chunk 1: Foundation — Shared Package, Migration, JWT, Queries, Config

### Task 1: Extend Shared Package (constants + schemas)

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/schemas/song.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add new constants to constants.ts**

Add to the existing file:

```typescript
// ACE-Step model types
export const ACE_STEP_MODELS = ["turbo", "sft", "base"] as const;
export type AceStepModel = (typeof ACE_STEP_MODELS)[number];

// Stage timeouts (milliseconds)
export const STAGE_TIMEOUTS = {
  BLUEPRINT: 30_000,
  LYRICS: 30_000,
  REFINEMENT: 30_000,
  MUSIC: 120_000,
  ARTWORK: 60_000,
  POST_PROCESSING: 30_000,
} as const;

// Workers AI model identifiers
export const AI_MODELS = {
  LYRICS_PRIMARY: "@cf/meta/llama-4-scout-17b-16e-instruct",
  LYRICS_FALLBACK: "@cf/qwen/qwen3-30b-a3b-fp8",
  ARTWORK: "@cf/black-forest-labs/flux-2-dev",
} as const;
```

Also update `CREDIT_REASONS` to include `'generation_refund'`:

```typescript
export const CREDIT_REASONS = [
  "song_generation",
  "generation_refund",
  "daily_reset",
  "purchase",
  "referral",
  "signup_bonus",
] as const;
```

- [ ] **Step 2: Add generation schemas to song.ts**

Add to existing `packages/shared/src/schemas/song.ts`:

```typescript
// Input for song generation
export const GenerateSongSchema = v.object({
  prompt: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
  genre: v.optional(v.string()),
  mood: v.optional(v.string()),
  language: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(5))),
  duration: v.optional(v.pipe(v.number(), v.minValue(30), v.maxValue(600))),
});
export type GenerateSongInput = v.InferInput<typeof GenerateSongSchema>;

// Standalone lyrics generation
export const GenerateLyricsSchema = v.object({
  prompt: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
  genre: v.optional(v.string()),
  mood: v.optional(v.string()),
});
export type GenerateLyricsInput = v.InferInput<typeof GenerateLyricsSchema>;

// Lyrics refinement
export const RefineLyricsSchema = v.object({
  lyrics: v.pipe(v.string(), v.minLength(1), v.maxLength(10000)),
  genre: v.optional(v.string()),
  mood: v.optional(v.string()),
});
export type RefineLyricsInput = v.InferInput<typeof RefineLyricsSchema>;
```

Extend the existing `SongSchema` with additional fields for the detail view:

```typescript
export const SongDetailSchema = v.object({
  ...SongSchema.entries,
  lyrics: v.nullable(v.string()),
  lyrics_structured: v.nullable(v.string()),
  style_tags: v.nullable(v.string()),
  key_signature: v.nullable(v.string()),
  time_signature: v.nullable(v.string()),
  vocal_style: v.nullable(v.string()),
  vocal_language: v.nullable(v.string()),
  instruments: v.nullable(v.string()),
  artwork_prompt: v.nullable(v.string()),
  waveform_url: v.nullable(v.string()),
  stems_url: v.nullable(v.string()),
  ace_step_seed: v.nullable(v.number()),
  ace_step_model: v.nullable(v.string()),
  generation_started_at: v.nullable(v.string()),
  generation_completed_at: v.nullable(v.string()),
});
export type SongDetail = v.InferOutput<typeof SongDetailSchema>;
```

- [ ] **Step 3: Update index.ts exports**

Ensure all new types and schemas are exported from `packages/shared/src/index.ts`.

- [ ] **Step 4: Verify typecheck**

```bash
npm run typecheck -w packages/shared
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add generation schemas, stage timeouts, AI model constants"
```

---

### Task 2: Schema Migration — credit_transactions reason

**Files:**
- Modify: `apps/api/src/db/schema.sql`

- [ ] **Step 1: Update credit_transactions CHECK constraint**

In `schema.sql`, update the `credit_transactions` table to include `'generation_refund'`:

```sql
reason TEXT NOT NULL CHECK (reason IN ('song_generation', 'generation_refund', 'daily_reset', 'purchase', 'referral', 'signup_bonus')),
```

Since D1 doesn't support ALTER CHECK, the simplest approach for a pre-production database is to update the DDL file and re-run the migration (drop + recreate). For the local dev DB, this is fine.

- [ ] **Step 2: Re-run local migration**

```bash
cd apps/api
npx wrangler d1 execute melodia-db --local --file=src/db/schema.sql
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/schema.sql
git commit -m "feat(db): add generation_refund to credit_transactions reason check"
```

---

### Task 3: JWT Utility Extraction

**Files:**
- Create: `apps/api/src/lib/jwt.ts`
- Modify: `apps/api/src/middleware/auth.ts`

- [ ] **Step 1: Create shared JWT utility**

```typescript
// apps/api/src/lib/jwt.ts

export type JwtPayload = {
  sub: string;
  iat: number;
  exp: number;
};

export async function verifyJwt(
  token: string,
  secret: string
): Promise<JwtPayload> {
  const [headerB64, payloadB64, signatureB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw new Error("Invalid token format");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);
  const valid = await crypto.subtle.verify("HMAC", key, signature, data);
  if (!valid) throw new Error("Invalid signature");

  const payload = JSON.parse(
    atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
  ) as JwtPayload;

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return payload;
}

function base64UrlDecode(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
```

- [ ] **Step 2: Refactor auth middleware to use jwt.ts**

Update `apps/api/src/middleware/auth.ts` to import and use `verifyJwt` from `../lib/jwt.js` instead of inline crypto logic. The middleware should now be:

```typescript
import type { Context, Next } from "hono";
import type { Env, Variables } from "../types.js";
import { AppError } from "./error-handler.js";
import { verifyJwt } from "../lib/jwt.js";

export function authGuard() {
  return async (
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: Next
  ) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("UNAUTHORIZED", "Missing or invalid authorization header", 401);
    }

    const token = authHeader.slice(7);

    try {
      const payload = await verifyJwt(token, c.env.JWT_SECRET);
      c.set("userId", payload.sub);
      await next();
    } catch {
      throw new AppError("UNAUTHORIZED", "Invalid or expired token", 401);
    }
  };
}
```

- [ ] **Step 3: Verify existing auth still works**

```bash
npm run typecheck -w apps/api
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/jwt.ts apps/api/src/middleware/auth.ts
git commit -m "refactor(api): extract JWT verification to shared utility"
```

---

### Task 4: Song Query Helpers

**Files:**
- Modify: `apps/api/src/db/queries.ts`

- [ ] **Step 1: Add songQueries to existing queries.ts**

```typescript
export const songQueries = {
  create: (
    db: D1Database,
    song: {
      id: string;
      user_id: string;
      title: string;
      user_prompt: string;
      genre?: string | null;
      mood?: string | null;
      vocal_language?: string | null;
      duration_seconds?: number | null;
    }
  ) =>
    db
      .prepare(
        `INSERT INTO songs (id, user_id, title, user_prompt, genre, mood, vocal_language, duration_seconds, generation_started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(
        song.id,
        song.user_id,
        song.title,
        song.user_prompt,
        song.genre ?? null,
        song.mood ?? null,
        song.vocal_language ?? null,
        song.duration_seconds ?? 180
      )
      .run(),

  findById: (db: D1Database, id: string) =>
    db.prepare("SELECT * FROM songs WHERE id = ?").bind(id).first(),

  findByIdAndUser: (db: D1Database, id: string, userId: string) =>
    db
      .prepare("SELECT * FROM songs WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .first(),

  listByUser: (
    db: D1Database,
    userId: string,
    opts: { status?: string; limit?: number; cursor?: string }
  ) => {
    const limit = Math.min(opts.limit ?? 20, 50);
    let sql = "SELECT * FROM songs WHERE user_id = ?";
    const params: (string | number)[] = [userId];

    if (opts.status) {
      sql += " AND status = ?";
      params.push(opts.status);
    }
    if (opts.cursor) {
      sql += " AND id < ?";
      params.push(opts.cursor);
    }
    sql += " ORDER BY id DESC LIMIT ?";
    params.push(limit + 1); // Fetch one extra to determine if there's a next page

    return db
      .prepare(sql)
      .bind(...params)
      .all();
  },

  updateStatus: (db: D1Database, id: string, status: string) =>
    db
      .prepare(
        "UPDATE songs SET status = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(status, id)
      .run(),

  updateTitle: (db: D1Database, id: string, title: string) =>
    db
      .prepare(
        "UPDATE songs SET title = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(title, id)
      .run(),

  updateCompleted: (
    db: D1Database,
    id: string,
    fields: {
      title: string;
      genre: string;
      sub_genre: string;
      mood: string;
      bpm: number;
      key_signature: string;
      time_signature: string;
      duration_seconds: number;
      vocal_style: string;
      vocal_language: string;
      instruments: string;
      style_tags: string;
      lyrics: string;
      lyrics_structured: string;
      audio_url: string;
      audio_format: string;
      artwork_url: string;
      artwork_prompt: string;
      waveform_url: string;
      ace_step_seed: number;
      ace_step_model: string;
      ace_step_steps: number;
    }
  ) =>
    db
      .prepare(
        `UPDATE songs SET
          status = 'completed',
          title = ?, genre = ?, sub_genre = ?, mood = ?,
          bpm = ?, key_signature = ?, time_signature = ?,
          duration_seconds = ?, vocal_style = ?, vocal_language = ?,
          instruments = ?, style_tags = ?, lyrics = ?, lyrics_structured = ?,
          audio_url = ?, audio_format = ?, artwork_url = ?, artwork_prompt = ?,
          waveform_url = ?, ace_step_seed = ?, ace_step_model = ?, ace_step_steps = ?,
          generation_completed_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?`
      )
      .bind(
        fields.title, fields.genre, fields.sub_genre, fields.mood,
        fields.bpm, fields.key_signature, fields.time_signature,
        fields.duration_seconds, fields.vocal_style, fields.vocal_language,
        fields.instruments, fields.style_tags, fields.lyrics, fields.lyrics_structured,
        fields.audio_url, fields.audio_format, fields.artwork_url, fields.artwork_prompt,
        fields.waveform_url, fields.ace_step_seed, fields.ace_step_model, fields.ace_step_steps,
        id
      )
      .run(),

  updateFailed: (db: D1Database, id: string) =>
    db
      .prepare(
        "UPDATE songs SET status = 'failed', updated_at = datetime('now') WHERE id = ?"
      )
      .bind(id)
      .run(),

  delete: (db: D1Database, id: string) =>
    db.prepare("DELETE FROM songs WHERE id = ?").bind(id).run(),
};
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck -w apps/api
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/queries.ts
git commit -m "feat(api): add song query helpers for CRUD and pipeline updates"
```

---

### Task 5: Wrangler Configuration Updates

**Files:**
- Modify: `apps/api/wrangler.toml`

- [ ] **Step 1: Add AI, R2, and Durable Objects bindings**

Append to the existing `wrangler.toml`:

```toml
[ai]
binding = "AI"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "melodia-assets"

[durable_objects]
bindings = [
  { name = "SONG_SESSION", class_name = "SongGenerationSession" }
]

[[migrations]]
tag = "v1"
new_classes = ["SongGenerationSession"]
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/wrangler.toml
git commit -m "chore(api): add AI, R2, Durable Objects bindings to wrangler.toml"
```

---

## Chunk 2: Pipeline Services

### Task 6: Blueprint Service

**Files:**
- Create: `apps/api/src/services/blueprint.service.ts`

- [ ] **Step 1: Create blueprint service**

The service calls Workers AI with the Song Blueprint Generator system prompt from the original spec. It takes the user's raw prompt and optional overrides (genre, mood, language, duration), expands it into a complete `SongBlueprint` JSON object.

Key implementation details:
- System prompt from original spec Section 5.2 (Song Blueprint Generator) — include the full prompt in the code as a const string
- User overrides are appended to the user message: "The user specifically requested: genre=X, mood=Y, ..."
- Model: `AI_MODELS.LYRICS_PRIMARY` with fallback to `AI_MODELS.LYRICS_FALLBACK`
- Temperature: 0.9, max_tokens: 500
- Parse response as JSON, validate all required fields exist
- On JSON parse failure: retry once with explicit instruction "Output ONLY valid JSON, no commentary"
- Timeout: `STAGE_TIMEOUTS.BLUEPRINT` via AbortSignal
- Export the `SongBlueprint` type from this file

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/services/blueprint.service.ts
git commit -m "feat(api): add blueprint service — LLM prompt expansion"
```

---

### Task 7: Lyrics Service

**Files:**
- Create: `apps/api/src/services/lyrics.service.ts`

- [ ] **Step 1: Create lyrics service with generate + refine**

Two exported functions:

**`generateLyrics(ai, blueprint)`:**
- System prompt from original spec Section 5.2 (World-Class Songwriter)
- User message includes blueprint details: genre, sub_genre, mood, song_concept, vocal_style, BPM, key, duration, instruments
- Model: `AI_MODELS.LYRICS_PRIMARY` with fallback
- Temperature: 0.8, max_tokens: 1500
- Timeout: `STAGE_TIMEOUTS.LYRICS`
- Returns raw lyrics string with section markers

**`refineLyrics(ai, lyrics, blueprint)`:**
- System prompt from original spec Section 5.2 (Lyrics Quality Critic)
- Instructs LLM to output JSON: `{ scores: { hook, rhyme, arc, flow, authenticity, imagery, originality, singability }, overall, weaknesses, revised_lyrics }`
- If any score < 7: use revised lyrics, run refinement again (max 2 total passes)
- If all scores >= 7: return original unchanged
- Model: `AI_MODELS.LYRICS_PRIMARY` with fallback
- Temperature: 0.7 (more analytical)
- Timeout: `STAGE_TIMEOUTS.REFINEMENT` per pass
- Returns `{ lyrics: string, scores: Record<string, number> }`

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/services/lyrics.service.ts
git commit -m "feat(api): add lyrics service — generation + refinement with quality critic"
```

---

### Task 8: Music Service (ACE-Step + Mock)

**Files:**
- Create: `apps/api/src/services/music.service.ts`

- [ ] **Step 1: Create music service with dual mode**

**`generateMusic(env, blueprint, lyrics, songId)`:**

Check `env.ACE_STEP_API_URL`:

**Real mode (truthy):**
- POST to `{ACE_STEP_API_URL}/api/generate`
- Headers: `Content-Type: application/json`, `Authorization: Bearer {ACE_STEP_API_KEY}` (if key set)
- Body: `{ tags: blueprint.style_tags, lyrics, duration: blueprint.duration, seed: -1, model: "turbo", infer_step: 8, guidance_scale: 15.0, scheduler_type: "euler", batch_size: 1 }`
- Timeout: `STAGE_TIMEOUTS.MUSIC` via AbortSignal
- Response body is WAV binary — read as ArrayBuffer
- Upload to R2: `audio/{songId}/variation_0.wav`, contentType `audio/wav`
- Return R2 key and seed from response headers (if available)

**Mock mode (falsy):**
- Generate a valid WAV file: 44-byte header + silent PCM data
- WAV spec: RIFF header, fmt chunk (48000Hz, 16-bit, 2 channels), data chunk (zeros)
- Duration from `blueprint.duration` seconds
- Data size: `48000 * 2 * 2 * duration` bytes (48kHz, 16-bit, stereo)
- For files > 10MB, generate just the header + 1 second of silence (to keep mock fast)
- Upload to R2 at same path
- Console.warn: "ACE-Step not configured, using mock audio"
- Return R2 key and seed = 0

Returns: `{ audioKey: string, seed: number }`

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/services/music.service.ts
git commit -m "feat(api): add music service — ACE-Step integration with silent WAV mock fallback"
```

---

### Task 9: Artwork Service

**Files:**
- Create: `apps/api/src/services/artwork.service.ts`

- [ ] **Step 1: Create artwork service with art direction + image generation**

**`generateArtwork(ai, blueprint, songTitle, songId, r2)`:**

**Step 1 — Art direction (LLM):**
- System prompt from original spec Section 6.1 (album cover art director)
- User message: `Song Title: "${songTitle}", Genre: ${genre}/${sub_genre}, Mood: ${mood}, Artwork Direction: ${artwork_mood}, Key Instruments: ${instruments}, Concept: ${song_concept}`
- Model: `AI_MODELS.LYRICS_PRIMARY`
- Temperature: 0.9, max_tokens: 300
- Returns the image generation prompt text

**Step 2 — Image generation:**
- Call `ai.run(AI_MODELS.ARTWORK, { prompt: imagePrompt, width: 1024, height: 1024, num_steps: 20, guidance: 7.5 })`
- Response is a ReadableStream of PNG bytes
- Read stream to Uint8Array
- Upload to R2: `artwork/{songId}/cover.png`, contentType `image/png`, customMetadata `{ prompt: imagePrompt, model: AI_MODELS.ARTWORK }`

Overall timeout: `STAGE_TIMEOUTS.ARTWORK`

Returns: `{ artwork_url: string, artwork_prompt: string }`

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/services/artwork.service.ts
git commit -m "feat(api): add artwork service — LLM art direction + FLUX.2 image generation"
```

---

### Task 10: Post-Processing Service

**Files:**
- Create: `apps/api/src/services/postprocess.service.ts`

- [ ] **Step 1: Create post-processing service**

**`postProcess(env, songId, blueprint, lyrics, audioKey, artworkResult)`:**

1. **Waveform generation:**
   - Fetch WAV from R2: `env.R2_BUCKET.get(audioKey)`
   - **CRITICAL — Chunked reading required:** A 3-min stereo 48kHz 16-bit WAV is ~34MB. Workers have 128MB memory limit. Do NOT load entire file into memory. Instead:
     - Read first 44 bytes using R2 `range` option to parse the WAV header: extract sample rate, bits per sample, num channels, data size
     - Calculate duration: `dataSize / (sampleRate * numChannels * bytesPerSample)`
     - Calculate chunk size: `dataSize / 200` (for ~200 peaks)
     - For each of the 200 chunks: use R2 `range` option to read only that chunk of PCM data, find max absolute sample value
     - Alternatively: use `r2Object.body.getReader()` to stream the entire file and process PCM data in a streaming fashion, keeping only the running max per chunk in memory
   - Normalize peaks to 0-1 range
   - Upload JSON array to R2: `waveforms/{songId}/waveform.json`

2. **Parse lyrics structure:**
   - Split lyrics by section markers (`[Verse 1]`, `[Chorus]`, etc.)
   - Build JSON: `[{ section: "Verse 1", lines: ["line1", "line2", ...] }, ...]`
   - Store as `lyrics_structured`

3. **Update D1:**
   - Call `songQueries.updateCompleted(env.DB, songId, { ...all fields... })`

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/services/postprocess.service.ts
git commit -m "feat(api): add post-processing service — waveform, lyrics parsing, D1 update"
```

---

## Chunk 3: Durable Object, Routes & Integration

### Task 11: Durable Object — SongGenerationSession

**Files:**
- Create: `apps/api/src/durable-objects/song-session.ts`

- [ ] **Step 1: Create the Durable Object**

Implement `SongGenerationSession` class:

**Constructor:** Store `state` and `env`. Initialize `sessions: WebSocket[]` array.

**`fetch(request)`:**
- If `Upgrade: websocket` header → handle WebSocket connection
  - Extract `token` from URL query params
  - Validate JWT using `verifyJwt(token, this.env.JWT_SECRET)` from `../lib/jwt.js`
  - If invalid: return 401
  - Create WebSocketPair, accept server side, add to sessions
  - Send current state immediately
  - Handle close: remove from sessions
  - Return client WebSocket with 101
- If `POST /start` → parse body, call `startGeneration()`
- Otherwise: return 404

**`broadcast(message)`:** Iterate sessions, try/catch send JSON, filter out closed connections.

**`updateStage(stage, status, data?)`:** Store state in `this.state.storage`, broadcast message.

**`startGeneration(songId, userPrompt, userId, options)`:**
- Full pipeline as per spec Section 7.4
- Each stage: update D1 status → broadcast in_progress → call service → broadcast completed
- After blueprint: update title via `songQueries.updateTitle()`
- Wrap in try/catch: on error, call `songQueries.updateFailed()`, refund credit, broadcast error
- Credit refund: atomic `UPDATE users SET credits_remaining = credits_remaining + 1` + INSERT `credit_transaction` with `amount: 1, reason: 'generation_refund'`

**Important:** The DO does NOT block the `/start` response on pipeline completion. It starts the pipeline asynchronously using `this.state.waitUntil()` or by not awaiting in the fetch handler — return `200 { started: true }` immediately, then run the pipeline.

Actually, in Cloudflare Durable Objects, the fetch handler can be long-running (DOs don't have the 30s CPU limit of regular Workers — they have a 30s of idle time before hibernation). So the simplest approach: call `startGeneration()` without await, return response immediately.

```typescript
// In fetch handler for POST /start:
const body = await request.json();
// Fire and forget — pipeline runs in background
this.startGeneration(body.songId, body.userPrompt, body.userId, body.options);
return new Response(JSON.stringify({ started: true }));
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/durable-objects/song-session.ts
git commit -m "feat(api): add SongGenerationSession Durable Object — pipeline orchestrator"
```

---

### Task 12: Songs Routes (replace stub)

**Files:**
- Replace: `apps/api/src/routes/songs.ts`

- [ ] **Step 1: Replace stub with full songs router**

Implement all routes from spec Section 5:

**`POST /generate`** (protected):
- Validate with `GenerateSongSchema`
- Atomic credit deduction using `db.batch()` for transactional consistency:
  ```typescript
  const [deductResult] = await env.DB.batch([
    env.DB.prepare("UPDATE users SET credits_remaining = credits_remaining - 1, updated_at = datetime('now') WHERE id = ? AND credits_remaining > 0").bind(userId),
    env.DB.prepare("INSERT INTO credit_transactions (id, user_id, amount, reason, song_id) VALUES (?, ?, -1, 'song_generation', ?)").bind(txId, userId, songId),
  ]);
  ```
  Check `deductResult.meta.changes === 1`. If 0, return 403 (insufficient credits). The batch ensures both deduction and transaction record succeed or fail together.
- Create song record via `songQueries.create()`
- Get DO stub, call `/start`
- Return 202

**`GET /`** (protected):
- Parse query params: `status`, `limit`, `cursor`
- Call `songQueries.listByUser()`
- Determine next_cursor from results (if fetched limit+1 results, there's a next page)
- Return `{ songs: [...], next_cursor }`

**`GET /:id`** (protected):
- Call `songQueries.findByIdAndUser()`
- Return full song detail (strip no sensitive fields for songs)

**`GET /:id/status`** (protected):
- Call `songQueries.findByIdAndUser()`
- Return `{ status, stage }`

**`GET /:id/stream`** (protected):
- Verify ownership via `songQueries.findByIdAndUser()`
- Check `audio_url` exists, return 404 if not
- Fetch from R2: `env.R2_BUCKET.get(song.audio_url)`
- Handle Range header for seeking:
  - Parse `Range: bytes=start-end`
  - Use `r2Object.slice(start, end)` or R2 `range` option
  - Return 206 with `Content-Range` header
- Without Range: return 200 with full file
- Set `Content-Type: audio/wav`, `Content-Length`, `Accept-Ranges: bytes`

**`DELETE /:id`** (protected):
- Verify ownership
- Delete R2 objects: list by prefix `audio/{songId}/`, `artwork/{songId}/`, `waveforms/{songId}/`, delete each
- Delete D1 record via `songQueries.delete()`
- Return 200

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/songs.ts
git commit -m "feat(api): replace songs stub with full CRUD + generation trigger + audio streaming"
```

---

### Task 13: Lyrics Routes (replace stub)

**Files:**
- Replace: `apps/api/src/routes/lyrics.ts`

- [ ] **Step 1: Replace stub with standalone lyrics routes**

**`POST /generate`** (protected, rate limited 10/hour):
- Validate with `GenerateLyricsSchema`
- Call `generateBlueprint()` with prompt (lightweight, just for context)
- Call `generateLyrics()` with blueprint
- Return `{ lyrics, blueprint: { title, genre, mood } }`

**`POST /refine`** (protected, rate limited 10/hour):
- Validate with `RefineLyricsSchema`
- Build a partial blueprint from provided genre/mood (fill in defaults for missing fields)
- Call `refineLyrics()` with lyrics and blueprint
- Return `{ lyrics, scores }`

These do NOT deduct credits.

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/lyrics.ts
git commit -m "feat(api): replace lyrics stub with standalone generation + refinement routes"
```

---

### Task 14: Update index.ts — DO Export + WebSocket Routing

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Export DO class and add WebSocket routing**

Update `apps/api/src/index.ts`:

1. Re-export the DO class: `export { SongGenerationSession } from "./durable-objects/song-session.js";`

2. Change the default export from `export default app;` to a custom fetch handler that intercepts WebSocket upgrades:

```typescript
export { SongGenerationSession } from "./durable-objects/song-session.js";

// IMPORTANT: Remove the existing `export default app;` line.
// This custom fetch handler replaces it — wraps Hono and intercepts WebSocket upgrades.
// Must include ctx: ExecutionContext so Hono middleware can use c.executionContext.waitUntil().
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade to Durable Object
    const wsMatch = url.pathname.match(/^\/api\/songs\/([^/]+)\/live$/);
    if (wsMatch && request.headers.get("Upgrade") === "websocket") {
      const songId = wsMatch[1];
      const doId = env.SONG_SESSION.idFromName(songId);
      const stub = env.SONG_SESSION.get(doId);
      return stub.fetch(request);
    }

    // All other requests go to Hono (pass ctx for waitUntil support)
    return app.fetch(request, env, ctx);
  },
};
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck -w apps/api
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): export DO class, add WebSocket upgrade routing in fetch handler"
```

---

### Task 15: Integration Smoke Test

- [ ] **Step 1: Create/update .dev.vars with ACE-Step mock mode**

Ensure `apps/api/.dev.vars` does NOT have `ACE_STEP_API_URL` set (mock mode).

- [ ] **Step 2: Re-run D1 migration**

```bash
cd apps/api
npx wrangler d1 execute melodia-db --local --file=src/db/schema.sql
```

- [ ] **Step 3: Start API server and test**

```bash
npx wrangler dev
```

1. **Register/login** to get an access token (from Sub-project 1)

2. **Generate a song:**
```bash
curl -X POST http://localhost:8787/api/songs/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"prompt":"Afrobeats love song about Accra at night"}'
```
Expected: 202 with `{ song_id, status: "pending" }`

3. **Check status:**
```bash
curl http://localhost:8787/api/songs/<song_id>/status \
  -H "Authorization: Bearer <token>"
```
Expected: Status progresses through stages, eventually `completed`

4. **Get song details:**
```bash
curl http://localhost:8787/api/songs/<song_id> \
  -H "Authorization: Bearer <token>"
```
Expected: Full song with lyrics, artwork_url, audio_url

5. **Stream audio:**
```bash
curl -I http://localhost:8787/api/songs/<song_id>/stream \
  -H "Authorization: Bearer <token>"
```
Expected: `Content-Type: audio/wav`, `Accept-Ranges: bytes`

6. **List songs:**
```bash
curl http://localhost:8787/api/songs \
  -H "Authorization: Bearer <token>"
```
Expected: Array with the generated song

7. **Test WebSocket** (using wscat or browser):
```bash
wscat -c "ws://localhost:8787/api/songs/<song_id>/live?token=<token>"
```
Expected: Receives current state (should be completed if pipeline finished)

8. **Delete song:**
```bash
curl -X DELETE http://localhost:8787/api/songs/<song_id> \
  -H "Authorization: Bearer <token>"
```
Expected: 200, song removed

9. **Test credit deduction:**
After generating, check credits via `GET /api/credits` — should be 4 (started at 5, deducted 1).

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: smoke test Sub-project 2 pipeline — all endpoints verified"
```

- [ ] **Step 5: Push to remote**

```bash
git push
```

---

**End of plan. Total: 15 tasks across 3 chunks.**
