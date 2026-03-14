# Sub-project 6: Multi-Variation & Selective Regeneration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add plan-based multi-variation generation (1/4/8 variations), variation selection with numbered tabs, and selective regeneration (keep lyrics/blueprint/none) — the core quality improvement for song generation.

**Architecture:** Modify the existing music service to support `batch_size > 1`, returning multiple audio keys. Modify the DO pipeline to accept cached data for stage skipping (selective regeneration). Add variation management routes (select, list). Frontend adds VariationTabs component and RegenerateModal dialog to SongView.

**Tech Stack:** ACE-Step `batch_size`, R2 (multi-file per song), Durable Objects (stage skipping), Hono, React, Canvas (waveform), `@melodia/shared`

**Spec:** `docs/superpowers/specs/2026-03-14-melodia-subproject6-variations-regeneration-design.md`

---

## Chunk 1: Backend — Schema, Shared, Music Service, DO, Queries, Routes

### Task 1: Schema + Shared Package

**Files:**
- Modify: `apps/api/src/db/schema.sql`
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/schemas/song.ts`

- [ ] **Step 1: Add `variation_count` column to songs table in schema.sql**

Add `variation_count INTEGER DEFAULT 1,` to the songs table definition, after the existing `variation_index` line.

- [ ] **Step 2: Add PLAN_VARIATIONS to constants.ts**

```typescript
export const PLAN_VARIATIONS: Record<string, number> = {
  free: 1,
  creator: 4,
  pro: 8,
  enterprise: 8,
};
```

- [ ] **Step 3: Add RegenerateSongSchema and SelectVariationSchema to song.ts**

```typescript
export const RegenerateSongSchema = v.object({
  keep: v.picklist(["none", "blueprint", "lyrics"]),
});
export type RegenerateSongInput = v.InferInput<typeof RegenerateSongSchema>;

export const SelectVariationSchema = v.object({
  variation_index: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(7)),
});
export type SelectVariationInput = v.InferInput<typeof SelectVariationSchema>;
```

Ensure both are exported from `packages/shared/src/index.ts`.

- [ ] **Step 4: Re-run migration + typecheck**

```bash
cd apps/api && npx wrangler d1 execute melodia-db --local --file=src/db/schema.sql
npm run typecheck -w packages/shared
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/ apps/api/src/db/schema.sql
git commit -m "feat: add variation_count column, PLAN_VARIATIONS, regeneration schemas"
```

---

### Task 2: Music Service — Multi-Variation Support

**Files:**
- Modify: `apps/api/src/services/music.service.ts`

- [ ] **Step 1: Modify generateMusic to support batchSize**

Read existing `music.service.ts`. Change the function signature and return type:

**Current:** `generateMusic(env, blueprint, lyrics, songId): Promise<{ audioKey: string; seed: number }>`

**New:** `generateMusic(env, blueprint, lyrics, songId, batchSize = 1): Promise<MusicResult>`

Where:
```typescript
export type MusicResult = {
  audioKeys: string[];
  seeds: number[];
  variationCount: number;
};
```

**Real mode:** Send `batch_size: batchSize` to ACE-Step. For now, assume the API returns a single response even with batch_size > 1 (the exact multi-output format will be validated later). As a pragmatic approach: if batch_size > 1 and the response is a single audio blob, call the API `batchSize` times with different seeds (`seed: i`) and upload each result. This ensures multi-variation works regardless of ACE-Step's batch response format.

**Mock mode:** Generate `batchSize` silent WAV files, each uploaded as `audio/{songId}/variation_{i}.wav`. Each gets seed = i.

Return `{ audioKeys: [...], seeds: [...], variationCount: batchSize }`.

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck -w apps/api
```

Note: This will break `song-session.ts` and `postprocess.service.ts` which call the old signature. Those are fixed in Tasks 3-4.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/music.service.ts
git commit -m "feat(api): add multi-variation support to music service (batch_size)"
```

---

### Task 3: Post-Processing — Handle MusicResult

**Files:**
- Modify: `apps/api/src/services/postprocess.service.ts`

- [ ] **Step 1: Update postProcess to accept MusicResult**

Read existing `postprocess.service.ts`. Change the `audioResult` parameter from `{ audioKey: string; seed: number }` to the new `MusicResult` type (import from music.service.ts).

Changes:
- Waveform generation: use `audioResult.audioKeys[0]` (generate waveform for the default selected variation only)
- Duration extraction: parse WAV header from `audioResult.audioKeys[0]`
- `updateCompleted` call: add `variation_count: audioResult.variationCount` to the fields
- `audio_url`: set to `audioResult.audioKeys[0]`
- `ace_step_seed`: set to `audioResult.seeds[0]`

- [ ] **Step 2: Update `updateCompleted` in queries.ts**

Read existing `songQueries.updateCompleted` in `queries.ts`. Add `variation_count` to:
- The SQL SET clause
- The `.bind()` parameters
- The `fields` type definition

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck -w apps/api
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/postprocess.service.ts apps/api/src/db/queries.ts
git commit -m "feat(api): update postProcess for multi-variation MusicResult, add variation_count to updateCompleted"
```

---

### Task 4: Durable Object — batchSize + Stage Skipping

**Files:**
- Modify: `apps/api/src/durable-objects/song-session.ts`

- [ ] **Step 1: Update DO startGeneration for batchSize and cached data**

Read existing `song-session.ts`. Modify `startGeneration` to accept extended options:

```typescript
options: {
  genre?, mood?, language?, duration?,
  batchSize?: number,
  cachedBlueprint?: SongBlueprint,
  cachedLyrics?: string,
}
```

**Stage skipping logic:**

Stage 1 (Blueprint):
- If `options.cachedBlueprint`: use it directly, broadcast "completed" immediately, skip LLM call
- Otherwise: run `generateBlueprint` as normal

Stage 2 (Lyrics + Refinement):
- If `options.cachedLyrics`: use directly, broadcast both stages "completed", skip LLM calls
- Otherwise: run `generateLyrics` + `refineLyrics` as normal

Stage 3 (Music):
- Pass `options.batchSize ?? 1` to `generateMusic`
- Update broadcast to include `variation_count`

Stage 4 (Artwork): Always regenerate (unchanged)

Stage 5 (Post-processing): Pass full `MusicResult` to `postProcess`

**Music timeout scaling:** When `batchSize > 1`, use `STAGE_TIMEOUTS.MUSIC * Math.min(batchSize, 2)` for the music stage AbortSignal timeout.

Also update the `/start` POST handler to accept and forward the new options fields from the request body.

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck -w apps/api
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/durable-objects/song-session.ts
git commit -m "feat(api): add batchSize and stage skipping to DO pipeline"
```

---

### Task 5: Song Query Extensions + Route Updates

**Files:**
- Modify: `apps/api/src/db/queries.ts`
- Modify: `apps/api/src/routes/songs.ts`

- [ ] **Step 1: Add variation queries to queries.ts**

```typescript
// Add to songQueries:
selectVariation: (db, songId, variationIndex, audioUrl) =>
  db.prepare(
    `UPDATE songs SET variation_index = ?, audio_url = ?,
     updated_at = datetime('now') WHERE id = ?`
  ).bind(variationIndex, audioUrl, songId).run(),

updateVariationCount: (db, songId, count) =>
  db.prepare(
    `UPDATE songs SET variation_count = ?, variation_index = 0,
     updated_at = datetime('now') WHERE id = ?`
  ).bind(count, songId).run(),
```

- [ ] **Step 2: Modify songs.ts — generate endpoint**

Read existing `songs.ts`. In `POST /generate`, after credit deduction:
- Look up user's plan: `const user = await userQueries.findById(c.env.DB, userId)`
- Calculate batchSize: `const batchSize = PLAN_VARIATIONS[user.plan as string] ?? 1`
- Pass `batchSize` in the DO start request body alongside existing fields

Import `PLAN_VARIATIONS` from `@melodia/shared`.

- [ ] **Step 3: Add POST /:id/regenerate endpoint**

Register BEFORE `/:id` wildcard routes. Uses `authGuard()`.

```
POST /regenerate/:id  (or register as songs.post("/:id/regenerate", ...))
  → Validate with RegenerateSongSchema
  → Verify ownership (findByIdAndUser)
  → Verify status is "completed" or "failed"
  → Deduct credit (same atomic pattern as generate)
  → Extract cached data based on keep:
    - "none": cachedBlueprint = undefined, cachedLyrics = undefined
    - "blueprint": cachedBlueprint = { title, genre, sub_genre, mood, bpm, key_signature, time_signature, duration_seconds, vocal_style, vocal_language, instruments, style_tags, artwork_mood (use mood), song_concept (use user_prompt) } from song record
    - "lyrics": same as "blueprint" PLUS cachedLyrics = song.lyrics
  → Clean up old R2 files: list prefix audio/{songId}/variation_, delete each. Also delete waveforms/{songId}/waveform.json
  → Update song status to "pending"
  → Get DO stub, call /start with cachedBlueprint, cachedLyrics, batchSize
  → Return 202
```

- [ ] **Step 4: Add PUT /:id/select-variation endpoint**

Uses `authGuard()`.

```
  → Validate with SelectVariationSchema
  → Verify ownership, status "completed"
  → Verify variation_index < song.variation_count
  → New audio_url = `audio/${songId}/variation_${variationIndex}.wav`
  → Call songQueries.selectVariation
  → Regenerate waveform: read WAV from R2, extract peaks (reuse postprocess waveform logic — extract it as a utility function or call postprocess helpers directly), upload to R2
  → Return updated song
```

Note: The waveform regeneration should reuse the peak extraction logic from `postprocess.service.ts`. If that logic is deeply embedded, consider extracting a `generateWaveformData(r2, audioKey, songId)` helper that both postProcess and select-variation can call.

- [ ] **Step 5: Add GET /:id/variations endpoint**

Uses `optionalAuthGuard()` (public songs accessible).

```
  → Fetch song, verify access (owner or public)
  → Build variations array from song.variation_count:
    for i in 0..variation_count: { index: i, is_selected: i === song.variation_index }
  → Return { variations, selected_index, count }
```

No R2 listing needed since we have `variation_count` on the record.

- [ ] **Step 6: Modify GET /:id/stream — add variation param**

In the existing stream endpoint:
- Read `variation` query param: `const variationParam = c.req.query("variation")`
- If present: parse as integer, validate `>= 0` and `< song.variation_count`
- Resolve audio key: `audio/${songId}/variation_${variationParam ?? song.variation_index}.wav`
- Use this key for R2 fetch instead of `song.audio_url`

- [ ] **Step 7: Verify typecheck**

```bash
npm run typecheck -w apps/api
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/db/queries.ts apps/api/src/routes/songs.ts
git commit -m "feat(api): add regenerate, select-variation, variations endpoints + batch generate"
```

---

## Chunk 2: Frontend — VariationTabs, RegenerateModal, SongView, Player

### Task 6: VariationTabs + RegenerateModal + useSongs Extensions

**Files:**
- Create: `apps/web/src/components/song/VariationTabs.tsx`
- Create: `apps/web/src/components/song/RegenerateModal.tsx`
- Modify: `apps/web/src/hooks/useSongs.ts`

- [ ] **Step 1: Create VariationTabs component**

Props: `variationCount`, `selectedIndex` (currently playing), `primaryIndex` (starred), `onSelect`, `onSetPrimary`

- Row of numbered buttons [1] [2] [3] [4]
- Active/playing: `bg-amber text-charcoal font-semibold`
- Inactive: `bg-surface-2 text-gray-400 hover:bg-surface-3`
- Primary variation: small star icon (★) on the tab
- "Set as primary" button: appears when playing a non-primary variation, calls `onSetPrimary`
- Hidden when `variationCount <= 1`
- Responsive: wrap on mobile if many tabs

- [ ] **Step 2: Create RegenerateModal component**

Props: `songId`, `isOpen`, `onClose`, `onRegenerated`

- Overlay backdrop with centered modal card (`bg-surface-1 rounded-2xl`)
- Title: "Regenerate Song"
- Three radio options with labels and descriptions:
  - "Fresh start" (none): "New blueprint, lyrics, music, and artwork"
  - "Keep blueprint" (blueprint): "Same song concept, new lyrics and music"
  - "Keep lyrics" (lyrics): "Same lyrics, new music and artwork" (default selected)
- Credit notice: "This will use 1 credit"
- Cancel (surface-2) + Regenerate (amber) buttons
- Loading state on submit
- On success: call `onRegenerated()`, close modal
- Close on Escape key and backdrop click

- [ ] **Step 3: Extend useSongs hook**

Add methods:
```typescript
regenerate: (songId, keep) => api.post(`/songs/${songId}/regenerate`, { keep }),
selectVariation: (songId, variationIndex) => api.put(`/songs/${songId}/select-variation`, { variation_index: variationIndex }),
getVariations: (songId) => api.get(`/songs/${songId}/variations`),
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/song/VariationTabs.tsx apps/web/src/components/song/RegenerateModal.tsx apps/web/src/hooks/useSongs.ts
git commit -m "feat(web): add VariationTabs, RegenerateModal, and variation/regenerate API methods"
```

---

### Task 7: WaveformPlayer + SongView Updates

**Files:**
- Modify: `apps/web/src/components/player/WaveformPlayer.tsx`
- Modify: `apps/web/src/pages/SongView.tsx`

- [ ] **Step 1: Update WaveformPlayer**

Read existing `WaveformPlayer.tsx`. Add `variationIndex` prop (default 0):

- When `variationIndex` changes (via `useEffect` dependency):
  - Show loading spinner
  - Fetch new audio blob: `api.getBlob(/api/songs/${songId}/stream?variation=${variationIndex})`
  - Revoke previous blob URL
  - Create new blob URL, set on audio element
  - Reset `currentTime` to 0
  - For waveform data: use flat fallback bars for non-primary variations (waveform.json only exists for primary)
- When `variationIndex` is 0 (primary): use existing waveform fetch logic

- [ ] **Step 2: Update SongView**

Read existing `SongView.tsx`. In completed mode, add:

**State:**
- `playingVariation: number` (which variation the player is playing, default `song.variation_index`)
- `isRegenerateOpen: boolean` (modal state)

**Layout (completed mode, between artwork header and player):**
- `VariationTabs` component with:
  - `variationCount={song.variation_count}`
  - `selectedIndex={playingVariation}`
  - `primaryIndex={song.variation_index}`
  - `onSelect={(i) => setPlayingVariation(i)}` — switches player audio
  - `onSetPrimary` — calls `useSongs().selectVariation(id, i)`, refetch song

**Action bar additions:**
- "Regenerate" button (surface-2 bg, between existing buttons)
- On click: `setIsRegenerateOpen(true)`

**RegenerateModal:**
- `isOpen={isRegenerateOpen}`
- `onClose={() => setIsRegenerateOpen(false)}`
- `onRegenerated` — refetch song data, call `refresh()` from auth context (credits changed), song will be in "pending" status so SongView automatically switches to generating mode

**Pass `variationIndex={playingVariation}` to WaveformPlayer.**

- [ ] **Step 3: Verify build**

```bash
npm run typecheck -w apps/web
npm run build -w apps/web
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/player/WaveformPlayer.tsx apps/web/src/pages/SongView.tsx
git commit -m "feat(web): add variation tabs and regeneration to SongView"
```

---

### Task 8: Integration Test + Deploy

- [ ] **Step 1: Re-run D1 migration (local + remote)**

```bash
cd apps/api
npx wrangler d1 execute melodia-db --local --file=src/db/schema.sql
npx wrangler d1 execute melodia-db --remote --file=src/db/schema.sql
```

- [ ] **Step 2: Verify backend typecheck**

```bash
npm run typecheck -w apps/api
```

- [ ] **Step 3: Verify frontend build**

```bash
npm run build -w apps/web
```

- [ ] **Step 4: Deploy API**

```bash
cd apps/api && npx wrangler deploy
```

- [ ] **Step 5: Deploy frontend**

```bash
cd apps/web
VITE_API_URL=https://melodia-api.ghwmelite.workers.dev npm run build
npx wrangler pages deploy dist --project-name=melodia --commit-dirty=true --branch=main
```

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "chore: verify Sub-project 6 integration — variations + regeneration"
git push
```

---

**End of plan. Total: 8 tasks across 2 chunks.**
