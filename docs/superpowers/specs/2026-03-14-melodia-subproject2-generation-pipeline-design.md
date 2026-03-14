# Melodia — Sub-project 2: Song Generation Pipeline

**Date:** 2026-03-14
**Status:** Draft
**Scope:** 7-stage song generation pipeline, Durable Object orchestrator, WebSocket progress, Workers AI integration (lyrics + artwork), ACE-Step integration with mock fallback, R2 audio/artwork storage, audio streaming

---

## 1. Context

Sub-project 1 established the monorepo, database, auth, and frontend shell. Sub-project 2 builds the core product: the song generation pipeline that takes a user's prompt and produces a complete song with lyrics, vocals, instrumentation, and album artwork.

**Dependencies on Sub-project 1:**
- D1 songs table (all columns already defined)
- Auth middleware and JWT validation
- Credit system (credits_remaining on users table, credit_transactions table)
- Env type with forward-declared R2, AI, DO bindings
- Stub routes for songs and lyrics (to be replaced)

---

## 2. Technology Decisions

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Pipeline orchestration | Durable Object | Maintains state across async stages, native WebSocket support |
| Real-time updates | WebSocket via DO | Sub-second stage updates during 30-120s pipeline |
| Lyrics LLM | Workers AI `@cf/meta/llama-4-scout-17b-16e-instruct` | Best quality on Workers AI, fallback to `@cf/qwen/qwen3-30b-a3b-fp8` |
| Artwork generation | Workers AI `@cf/black-forest-labs/flux-2-dev` | High-quality 1024x1024 images |
| Music generation | ACE-Step 1.5 REST API (external GPU) | Open-source, full vocals + instrumentation |
| Music fallback | Silent WAV mock | Pipeline works end-to-end without GPU server |
| Audio storage | R2 (WAV only) | No transcoding complexity for MVP |
| Audio streaming | Worker-proxied from R2 | Authenticated, supports Range requests for seeking |
| Triggering | Direct DO call (no Queue) | Simpler, Queue added in Sub-project 6 for batch |

---

## 3. New & Modified Files

```
apps/api/src/
├── services/
│   ├── blueprint.service.ts      # NEW: Stage 1 — LLM prompt expansion
│   ├── lyrics.service.ts         # NEW: Stages 2-3 — lyrics generation + refinement
│   ├── music.service.ts          # NEW: Stage 4 — ACE-Step or mock audio
│   ├── artwork.service.ts        # NEW: Stage 5 — art direction + FLUX.2
│   └── postprocess.service.ts    # NEW: Stage 6 — waveform, metadata
├── routes/
│   ├── songs.ts                  # REPLACE: full song CRUD + generation trigger
│   ├── lyrics.ts                 # REPLACE: standalone lyrics generation
│   └── artwork.ts                # KEEP AS STUB: standalone artwork deferred to Sub-project 3
├── durable-objects/
│   └── song-session.ts           # NEW: pipeline orchestrator + WebSocket
├── lib/
│   └── jwt.ts                    # NEW: extracted JWT verify utility (shared by auth middleware + DO)
├── db/
│   └── queries.ts                # EXTEND: add song query helpers
├── middleware/
│   └── auth.ts                   # MODIFY: refactor to use shared jwt.ts utility
├── types.ts                      # MODIFY: no changes needed (bindings already declared)
├── index.ts                      # MODIFY: export DO class, handle WebSocket upgrade routing
└── wrangler.toml                 # MODIFY: add AI, R2, DO bindings

packages/shared/src/
├── schemas/
│   └── song.ts                   # EXTEND: add GenerateSongSchema, SongDetailSchema
└── constants.ts                  # EXTEND: add ACE_STEP_MODELS, STAGE_TIMEOUTS
```

---

## 4. Wrangler Configuration Changes

Add to existing `wrangler.toml`:

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

New secrets (via `wrangler secret put`):
- `ACE_STEP_API_URL` — GPU server URL (optional — mock mode when absent)
- `ACE_STEP_API_KEY` — API key for ACE-Step server (optional)

R2 bucket creation: `wrangler r2 bucket create melodia-assets`

---

## 5. API Routes

### 5.1 Song Generation Routes (replace stub)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/songs/generate` | Required | Start song generation pipeline |
| GET | `/api/songs` | Required | List user's songs (paginated) |
| GET | `/api/songs/:id` | Required | Get full song details |
| GET | `/api/songs/:id/status` | Required | Lightweight status poll |
| GET | `/api/songs/:id/stream` | Required | Stream audio from R2 |
| DELETE | `/api/songs/:id` | Required | Delete song + R2 assets |
| WS | `/api/songs/:id/live` | Via query token | WebSocket for real-time progress |

### 5.2 Generate Endpoint

**Input:**
```typescript
type GenerateSongInput = {
  prompt: string;              // Required: user's song idea
  genre?: string;              // Optional override
  mood?: string;               // Optional override
  language?: string;           // Optional override (ISO 639-1)
  duration?: number;           // Optional override (seconds, 30-600)
};
```

**Flow:**
1. Validate input with Valibot `GenerateSongSchema`
2. Atomically deduct 1 credit — single query to prevent race conditions:
   ```sql
   UPDATE users SET credits_remaining = credits_remaining - 1, updated_at = datetime('now')
   WHERE id = ? AND credits_remaining > 0
   ```
   Check `meta.changes === 1`. If 0 rows changed, return 403 `FORBIDDEN` "Insufficient credits".
3. INSERT `credit_transaction` with `amount: -1, reason: 'song_generation'`
4. Create song record in D1 with:
   - `status: 'pending'`
   - `title: prompt.slice(0, 100)` (placeholder — updated with real title after blueprint stage)
   - `user_prompt`, `genre`, `mood`, `vocal_language`, `duration_seconds` from input
   - `generation_started_at: datetime('now')`
5. Get DO stub: `env.SONG_SESSION.get(env.SONG_SESSION.idFromName(songId))`
6. Call `doStub.fetch("/start", { method: "POST", body: { songId, userPrompt, userId, options } })`
7. Return `202 { success: true, data: { song_id, status: "pending" } }`

**Note on title:** The songs table has `title TEXT NOT NULL`. We use the user prompt (truncated to 100 chars) as a placeholder title. The Durable Object updates it with the LLM-generated title after the blueprint stage completes.

### 5.3 List Endpoint

**`GET /api/songs?status=completed&limit=20&cursor=<ulid>`**

- Returns songs owned by the authenticated user
- Filterable by status
- Cursor-based pagination using ULID ordering (`WHERE id < cursor ORDER BY id DESC`)
- Default limit: 20, max: 50
- Returns `{ songs: [...], next_cursor: string | null }`

### 5.4 Stream Endpoint

**`GET /api/songs/:id/stream`**

- Verify song ownership
- Fetch audio from R2: `R2_BUCKET.get(song.audio_url)`
- Set headers: `Content-Type: audio/wav`, `Content-Length`, `Accept-Ranges: bytes`
- Support HTTP Range requests: parse `Range` header, return 206 with `Content-Range`
- Return 404 if audio not yet generated

### 5.5 WebSocket Endpoint

**`WS /api/songs/:id/live?token=<jwt>`**

- Upgrade request hits the Worker, which forwards to the Durable Object
- DO validates JWT from query parameter using the same crypto logic as auth middleware
- On connect: send current generation state immediately
- During pipeline: broadcast JSON messages after each stage
- Message format:
  ```json
  {
    "stage": "blueprint|lyrics|refinement|music|artwork|processing|completed|error",
    "status": "in_progress|completed|failed",
    "message": "Human-readable status message",
    "data": {}
  }
  ```

### 5.6 Delete Endpoint

- Verify song ownership
- Delete R2 objects: `audio/{songId}/*`, `artwork/{songId}/*`, `waveforms/{songId}/*`
- Delete D1 record
- Return 200

### 5.7 Standalone Lyrics Routes (replace stub)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/lyrics/generate` | Required | Generate lyrics from prompt (no music) |
| POST | `/api/lyrics/refine` | Required | Refine existing lyrics with LLM critic |

These do NOT deduct credits — they're lightweight LLM calls for the lyrics editor (Sub-project 3). Rate limited to 10/hour per user.

---

## 6. Pipeline Stages (Services)

### 6.1 Stage 1: Blueprint Service

**File:** `apps/api/src/services/blueprint.service.ts`

**Function:** `generateBlueprint(ai: Ai, userPrompt: string, overrides?: { genre?, mood?, language?, duration? }): Promise<SongBlueprint>`

- Calls Workers AI with the Song Blueprint Generator system prompt (from original spec Section 5.2)
- User overrides are injected into the user message so the LLM respects them
- LLM outputs JSON matching `SongBlueprint` type
- Validates JSON parsing — retry once on parse failure
- Temperature: 0.9 (creative)
- Max tokens: 500

**Output type:**
```typescript
type SongBlueprint = {
  title: string;
  genre: string;
  sub_genre: string;
  mood: string;
  bpm: number;
  key: string;
  time_signature: string;
  duration: number;
  vocal_style: string;
  vocal_language: string;
  instruments: string[];
  style_tags: string;
  artwork_mood: string;
  song_concept: string;
};
```

### 6.2 Stages 2-3: Lyrics Service

**File:** `apps/api/src/services/lyrics.service.ts`

**Function:** `generateLyrics(ai: Ai, blueprint: SongBlueprint): Promise<string>`

- Calls Workers AI with the World-Class Songwriter system prompt (spec Section 5.2)
- Blueprint details (genre, mood, concept, vocal style, BPM) are included in the user message
- Temperature: 0.8
- Max tokens: 1500
- Returns raw lyrics text with section markers

**Function:** `refineLyrics(ai: Ai, lyrics: string, blueprint: SongBlueprint): Promise<{ lyrics: string; scores: Record<string, number> }>`

- Calls Workers AI with the Lyrics Quality Critic system prompt (spec Section 5.2)
- Scores on 8 criteria (1-10 each)
- If any score < 7: returns revised lyrics
- If all scores >= 7: returns original unchanged
- Maximum 2 refinement passes (generate → refine → refine again if needed → accept)
- Returns final lyrics + scores

**Primary model:** `@cf/meta/llama-4-scout-17b-16e-instruct`
**Fallback model:** `@cf/qwen/qwen3-30b-a3b-fp8`

If primary model call fails (timeout, error), retry with fallback model.

### 6.3 Stage 4: Music Service

**File:** `apps/api/src/services/music.service.ts`

**Function:** `generateMusic(env: Env, blueprint: SongBlueprint, lyrics: string, songId: string): Promise<string>`

Returns the R2 key of the uploaded audio file.

**Real mode** (when `env.ACE_STEP_API_URL` is truthy):
```
POST {ACE_STEP_API_URL}/api/generate
Headers: Authorization: Bearer {ACE_STEP_API_KEY} (if key set)
Body: {
  tags: blueprint.style_tags,
  lyrics: lyrics,
  duration: blueprint.duration,
  seed: -1,
  model: "turbo",
  infer_step: 8,
  guidance_scale: 15.0,
  scheduler_type: "euler",
  batch_size: 1
}
```
- Response is audio binary (WAV)
- Timeout: 120 seconds
- Upload to R2: `audio/{songId}/variation_0.wav` with `contentType: audio/wav`

**Mock mode** (when `env.ACE_STEP_API_URL` is falsy):
- Generate a valid WAV file header for a silent audio file of `blueprint.duration` seconds
- WAV format: 48kHz, 16-bit, stereo
- Upload to R2 at same path
- Log a warning: "ACE-Step not configured, using mock audio"

### 6.4 Stage 5: Artwork Service

**File:** `apps/api/src/services/artwork.service.ts`

**Function:** `generateArtwork(ai: Ai, blueprint: SongBlueprint, songTitle: string, songId: string, r2: R2Bucket): Promise<{ artwork_url: string; artwork_prompt: string }>`

**Step 1 — Art direction:**
- Call Workers AI LLM with the album cover art director system prompt (spec Section 6.1)
- Input: song title, genre, sub_genre, mood, artwork_mood, instruments, song_concept
- Output: 100-150 word image generation prompt
- Temperature: 0.9
- Rules: no text/typography, match genre visual language, specify color palette, 1:1 ratio

**Step 2 — Image generation:**
- Call Workers AI `@cf/black-forest-labs/flux-2-dev` with the art direction prompt
- Parameters: `width: 1024, height: 1024, num_steps: 20, guidance: 7.5`
- Response is PNG image bytes
- Upload to R2: `artwork/{songId}/cover.png` with `contentType: image/png`

### 6.5 Stage 6: Post-Processing Service

**File:** `apps/api/src/services/postprocess.service.ts`

**Function:** `postProcess(env: Env, songId: string, blueprint: SongBlueprint, lyrics: string, audioKey: string, artworkResult: { artwork_url, artwork_prompt }): Promise<void>`

- **Waveform generation:** Read WAV from R2, extract PCM amplitude peaks at regular intervals (~200 data points), normalize to 0-1 range, store as JSON array at `waveforms/{songId}/waveform.json`. **Implementation note:** A 3-min stereo 48kHz 16-bit WAV is ~34MB. Workers have a 128MB memory limit. The implementation should stream/chunk the WAV data rather than loading entirely into memory — read the header for format info, then process PCM data in chunks
- **Duration extraction:** Parse WAV header for actual sample count and sample rate, calculate real duration
- **D1 update:** Update the song record with all final data:
  - `status = 'completed'`
  - `title`, `genre`, `sub_genre`, `mood`, `bpm`, `key_signature`, `time_signature`, `duration_seconds`
  - `vocal_style`, `vocal_language`, `instruments` (JSON), `style_tags` (JSON)
  - `lyrics`, `lyrics_structured` (JSON with section markers parsed)
  - `audio_url`, `artwork_url`, `artwork_prompt`
  - `ace_step_seed`, `ace_step_model`, `ace_step_steps`
  - `generation_completed_at = datetime('now')`

---

## 7. Durable Object — SongGenerationSession

### 7.1 Class Export & Env Access

```typescript
export class SongGenerationSession implements DurableObject {
  constructor(private state: DurableObjectState, private env: Env) {}
  async fetch(request: Request): Promise<Response> { ... }
}
```

**Env access:** The DO constructor receives `env: Env` from the Workers runtime. This includes all bindings — `this.env.DB` (D1), `this.env.AI` (Workers AI), `this.env.R2_BUCKET` (R2), `this.env.KV`, and `this.env.JWT_SECRET`. The DO passes these to service functions as needed. All D1 calls within the DO use `this.env.DB`.

Exported from `apps/api/src/index.ts` alongside the Hono app default export.

### 7.1.1 WebSocket Routing in index.ts

The main `index.ts` must handle WebSocket upgrade requests before passing to Hono, since Hono doesn't natively handle WebSocket upgrades to Durable Objects. The approach:

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Check for WebSocket upgrade to DO
    const url = new URL(request.url);
    const wsMatch = url.pathname.match(/^\/api\/songs\/([^/]+)\/live$/);
    if (wsMatch && request.headers.get("Upgrade") === "websocket") {
      const songId = wsMatch[1];
      const doId = env.SONG_SESSION.idFromName(songId);
      const stub = env.SONG_SESSION.get(doId);
      return stub.fetch(request);
    }
    // All other requests go to Hono
    return app.fetch(request, env);
  }
};
```

### 7.1.2 JWT Utility Extraction

Create `apps/api/src/lib/jwt.ts` with a shared `verifyJwt(token: string, secret: string): Promise<{ sub: string; iat: number; exp: number }>` function. Both the auth middleware (`middleware/auth.ts`) and the DO (`song-session.ts`) import this function. The auth middleware is refactored to call `verifyJwt` instead of having inline crypto logic.

### 7.2 Routes (internal, called by Worker)

- `POST /start` — Begin pipeline with `{ songId, userPrompt, userId, options }`
- WebSocket upgrade — Real-time progress via `Upgrade: websocket` header

### 7.3 State Management

Stored in DO transactional storage (`this.state.storage`):

```typescript
type GenerationState = {
  songId: string;
  userId: string;
  stage: string;
  status: "in_progress" | "completed" | "failed";
  blueprint?: SongBlueprint;
  lyrics?: string;
  error?: string;
  startedAt: number;
};
```

### 7.4 Pipeline Execution

```
async startGeneration(songId, userPrompt, userId, options):
  try:
    // Update D1: status = 'generating_lyrics'
    broadcast({ stage: "blueprint", status: "in_progress" })
    blueprint = await generateBlueprint(env.AI, userPrompt, options)
    broadcast({ stage: "blueprint", status: "completed", data: { title, genre } })

    broadcast({ stage: "lyrics", status: "in_progress" })
    lyrics = await generateLyrics(env.AI, blueprint)
    broadcast({ stage: "lyrics", status: "completed", data: { preview: lyrics.slice(0,200) } })

    // Update D1: status = 'generating_lyrics' (refinement is part of lyrics stage)
    broadcast({ stage: "refinement", status: "in_progress" })
    { lyrics: refined, scores } = await refineLyrics(env.AI, lyrics, blueprint)
    broadcast({ stage: "refinement", status: "completed" })

    // Update D1: status = 'generating_music'
    broadcast({ stage: "music", status: "in_progress" })
    audioKey = await generateMusic(env, blueprint, refined, songId)
    broadcast({ stage: "music", status: "completed" })

    // Update D1: status = 'generating_artwork'
    broadcast({ stage: "artwork", status: "in_progress" })
    artworkResult = await generateArtwork(env.AI, blueprint, blueprint.title, songId, env.R2_BUCKET)
    broadcast({ stage: "artwork", status: "completed", data: { artwork_url } })

    // Update D1: status = 'processing'
    broadcast({ stage: "processing", status: "in_progress" })
    await postProcess(env, songId, blueprint, refined, audioKey, artworkResult)
    broadcast({ stage: "processing", status: "completed" })

    broadcast({ stage: "completed", status: "completed", data: { song_id: songId } })
  catch (error):
    // Update D1: status = 'failed'
    // Refund credit
    broadcast({ stage: "error", status: "failed", message: error.message })
```

### 7.5 WebSocket Management

- `sessions: WebSocket[]` — array of active connections
- On upgrade: validate JWT from `?token=` query param, accept or reject
- `broadcast(message)`: iterate sessions, try/catch send, remove closed connections
- On connect: send current `GenerationState` immediately
- On close: remove from sessions array

### 7.6 JWT Validation in DO

The DO needs to validate JWTs but doesn't have access to Hono middleware. It uses the same Web Crypto API logic: import HMAC key from `env.JWT_SECRET`, verify signature, check expiry, extract `sub` (userId). Implemented as a standalone utility function shared between auth middleware and the DO.

### 7.7 Error Handling & Credit Refund

If any stage throws:
1. Catch the error in `startGeneration`
2. Update D1: `status = 'failed'`
3. Refund credit: `UPDATE users SET credits_remaining = credits_remaining + 1` + INSERT `credit_transaction` with `amount: 1, reason: 'generation_refund'`
4. Broadcast error to WebSocket clients
5. Store error in DO state for late-joining clients

### 7.8 Stage Timeouts

Each stage has a maximum execution time enforced via `AbortSignal.timeout()`. Timeout values are defined in `packages/shared/src/constants.ts` as `STAGE_TIMEOUTS`:

| Stage | Timeout |
|-------|---------|
| Blueprint (LLM) | 30 seconds |
| Lyrics (LLM) | 30 seconds |
| Refinement (LLM) | 30 seconds per pass |
| Music (ACE-Step) | 120 seconds |
| Artwork (LLM + image) | 60 seconds |
| Post-processing | 30 seconds |

---

## 8. Shared Package Extensions

### 8.1 New Schemas (`packages/shared/src/schemas/song.ts`)

```typescript
// Input for song generation
export const GenerateSongSchema = v.object({
  prompt: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
  genre: v.optional(v.string()),
  mood: v.optional(v.string()),
  language: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(5))),
  duration: v.optional(v.pipe(v.number(), v.minValue(30), v.maxValue(600))),
});

// Standalone lyrics generation
export const GenerateLyricsSchema = v.object({
  prompt: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
  genre: v.optional(v.string()),
  mood: v.optional(v.string()),
});

// Lyrics refinement
export const RefineLyricsSchema = v.object({
  lyrics: v.pipe(v.string(), v.minLength(1), v.maxLength(10000)),
  genre: v.optional(v.string()),
  mood: v.optional(v.string()),
});
```

### 8.2 Extended SongSchema

The existing `SongSchema` will be extended with additional fields for the detail view: `lyrics`, `style_tags`, `key_signature`, `vocal_style`, `instruments`, `artwork_prompt`, `waveform_url`, `generation_started_at`, `generation_completed_at`.

---

## 9. Song Query Helpers (extend queries.ts)

Add to existing `queries.ts`:

```typescript
export const songQueries = {
  create: (db, song: { id, user_id, user_prompt, genre?, mood?, vocal_language?, duration_seconds? }) => ...,
  findById: (db, id) => ...,
  findByIdAndUser: (db, id, userId) => ...,
  listByUser: (db, userId, { status?, limit?, cursor? }) => ...,
  updateStatus: (db, id, status) => ...,
  updateCompleted: (db, id, fields: { title, genre, ..., audio_url, artwork_url, ... }) => ...,
  updateFailed: (db, id) => ...,
  delete: (db, id) => ...,
};
```

---

## 10. R2 Storage Structure

```
melodia-assets/
├── audio/
│   └── {song_id}/
│       └── variation_0.wav      # WAV, 48kHz 16-bit stereo
├── artwork/
│   └── {song_id}/
│       └── cover.png            # 1024x1024 PNG
└── waveforms/
    └── {song_id}/
        └── waveform.json        # Array of ~200 amplitude values (0-1)
```

### Cleanup on Delete

`DELETE /api/songs/:id` removes:
- All objects under `audio/{songId}/` prefix — use `R2_BUCKET.list({ prefix })` then `R2_BUCKET.delete()` for each key (R2 has no bulk-delete-by-prefix)
- All objects under `artwork/{songId}/` prefix — same list-then-delete pattern
- All objects under `waveforms/{songId}/` prefix — same pattern
- Song record from D1

**Note on orphaned R2 objects:** If the pipeline fails partway through (e.g., audio uploaded but artwork fails), orphaned R2 objects may remain after credit refund. These are acceptable — a future scheduled Worker can clean up R2 objects for failed/deleted songs. The error handler in the DO does NOT attempt R2 cleanup to keep error handling simple and fast.

### Audio Streaming

`GET /api/songs/:id/stream`:
- Authenticated (song owner only)
- `Content-Type: audio/wav`
- Supports HTTP Range requests for seeking (206 Partial Content)
- Reads from R2 with `range` option when Range header present

---

## 11. Credit System Integration

**On generation start:**
1. Check `credits_remaining > 0` — return 403 `FORBIDDEN` with "Insufficient credits" if not
2. `UPDATE users SET credits_remaining = credits_remaining - 1, updated_at = datetime('now') WHERE id = ?`
3. `INSERT INTO credit_transactions (id, user_id, amount, reason, song_id) VALUES (?, ?, -1, 'song_generation', ?)`

**On generation failure (credit refund):**
1. `UPDATE users SET credits_remaining = credits_remaining + 1, updated_at = datetime('now') WHERE id = ?`
2. `INSERT INTO credit_transactions (id, user_id, amount, reason, song_id) VALUES (?, ?, 1, 'generation_refund', ?)`

**Schema migration required:** Add `'generation_refund'` to the `credit_transactions.reason` CHECK constraint:
```sql
-- Migration: alter credit_transactions reason check
-- D1 doesn't support ALTER CHECK, so this must be done by recreating the table
-- or by dropping the CHECK and re-adding it. For simplicity, add this to the
-- schema.sql as part of Sub-project 2 setup.
```
Update `packages/shared/src/constants.ts` CREDIT_REASONS to include `'generation_refund'`.

---

## 12. Out of Scope (Deferred)

- Multi-variation generation / batch_size > 1 (Sub-project 3)
- Song remixing / cover generation (Sub-project 3)
- Section repaint (Sub-project 3)
- Lyrics editing + regeneration UI (Sub-project 3)
- Public song sharing / explore page (Sub-project 4)
- MP3 transcoding (Sub-project 4)
- Signed R2 URLs for public access (Sub-project 4)
- Vectorize embeddings for recommendations (Sub-project 4)
- Queue-based batch generation (Sub-project 6)
- Stem separation (Sub-project 6)

## 13. Known Limitations

- **Single variation only** — `batch_size: 1` for ACE-Step. Multiple variations added in Sub-project 3.
- **No audio transcoding** — WAV only. MP3 conversion deferred. WAV files are large (~30MB for 3min) but bandwidth is acceptable for early users.
- **Mock audio is silent** — When ACE-Step is not configured, the pipeline produces a valid but silent WAV file. This is for development/demo purposes only.
- **No retry on failure** — If a stage fails, the song is marked as failed. Manual retry (regeneration) is added in Sub-project 3.
- **WebSocket auth via query param** — JWT in URL is visible in server logs. Acceptable for internal use; token has 15-min expiry and is single-use per connection.
- **Waveform generation is basic** — Simple PCM peak extraction, not spectral analysis. Good enough for visualization.
