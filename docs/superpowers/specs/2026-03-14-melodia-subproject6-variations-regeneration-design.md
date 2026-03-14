# Melodia — Sub-project 6: Multi-Variation & Selective Regeneration

**Date:** 2026-03-14
**Status:** Draft
**Scope:** Plan-based multi-variation generation (1/4/8), variation selection UI, selective regeneration (keep lyrics/blueprint/none), stream endpoint variation param

---

## 1. Context

Sub-projects 1-5 built the full platform: auth, pipeline, studio UI, social features, and Paystack billing. Currently, each generation produces a single audio variation (`batch_size: 1`). Sub-project 6 adds multi-variation generation and selective regeneration — the most impactful quality improvement for the core product.

**Dependencies:**
- Songs table: `variation_group_id`, `variation_index`, `is_selected_variation` columns — already exist but are repurposed (see Section 13 migration notes)
- ACE-Step: supports `batch_size` 1-8 natively
- R2: variation files stored as `audio/{songId}/variation_{i}.wav` — pattern already established
- DO pipeline: orchestrates generation stages — to be modified for batch_size + stage skipping
- `PLAN_CREDITS` in shared constants — pattern for plan-based limits
- WaveformPlayer, SongView — to be extended with variation tabs

---

## 2. Technology Decisions

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Variation limit | Plan-based (1/4/8) | Free stays at 1 (no change), paid tiers get multi-variation |
| Variation storage | Separate WAV files per variation in R2 | Simple, each variation independently streamable |
| Variation UI | Numbered tabs with single player | Reuses existing WaveformPlayer, minimal new components |
| Selective regen | Pipeline stage skipping with cached data | Reuses existing DO and services, no new infrastructure |
| Waveform on switch | Generate on-demand for non-selected variations | Avoids storing 8 waveform files per song |

---

## 3. New & Modified Files

### Backend

```
apps/api/src/
├── routes/
│   └── songs.ts            # MODIFY: batch_size in generate, add regenerate/select-variation/variations endpoints, variation param on stream
├── services/
│   └── music.service.ts    # MODIFY: support batch_size > 1, return multiple audio keys
├── durable-objects/
│   └── song-session.ts     # MODIFY: accept batchSize + cached data, skip stages
├── services/
│   └── postprocess.service.ts  # MODIFY: handle multiple audio keys, waveform for selected only
├── db/
│   └── queries.ts          # EXTEND: variation selection + update queries
```

### Shared

```
packages/shared/src/
├── constants.ts            # MODIFY: add PLAN_VARIATIONS
└── schemas/song.ts         # MODIFY: add RegenerateSongSchema, SelectVariationSchema
```

### Frontend

```
apps/web/src/
├── pages/
│   └── SongView.tsx            # MODIFY: add VariationTabs + Regenerate button
├── components/
│   ├── player/
│   │   └── WaveformPlayer.tsx  # MODIFY: accept variationIndex prop for switching
│   └── song/
│       ├── VariationTabs.tsx   # NEW: numbered tabs with star selection
│       └── RegenerateModal.tsx # NEW: selective regeneration dialog
└── hooks/
    └── useSongs.ts             # MODIFY: add regenerate, selectVariation, getVariations
```

---

## 4. Shared Package Extensions

### Constants

```typescript
export const PLAN_VARIATIONS: Record<string, number> = {
  free: 1,
  creator: 4,
  pro: 8,
  enterprise: 8,
};
```

### Schemas

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

---

## 5. API Routes

### 5.1 Modified: POST /api/songs/generate

Change: After credit deduction and song creation, look up the user's plan and pass `batchSize = PLAN_VARIATIONS[plan]` to the DO's `startGeneration`. The song record is created with `variation_index: 0` (default).

### 5.2 New: POST /api/songs/:id/regenerate (auth required)

```
POST /api/songs/:id/regenerate { keep: "none" | "blueprint" | "lyrics" }
  → Verify ownership
  → Verify song status is "completed" or "failed"
  → Deduct 1 credit (same atomic deduction as generate)
  → Fetch existing song data:
    - If keep === "blueprint": extract blueprint fields from song record
    - If keep === "lyrics": extract blueprint fields + lyrics from song record
    - If keep === "none": nothing cached
  → Delete existing R2 variation files (list prefix audio/{songId}/variation_, delete each) to prevent orphans from prior generation
  → Delete existing waveform (waveforms/{songId}/waveform.json)
  → Update song status to "pending"
  → Get DO stub, call /start with cachedBlueprint and/or cachedLyrics + batchSize from plan
  → Return 202 { song_id, status: "pending" }

**Credit refund on failure:** The existing DO catch block already handles credit refund for failed pipelines. This also covers regeneration failures since the DO's error handler fetches the user_id from the song record and refunds generically.

**Music stage timeout:** For `batchSize > 1`, the music stage timeout should scale: `STAGE_TIMEOUTS.MUSIC * Math.min(batchSize, 2)`. Generating 4-8 variations is parallelized by ACE-Step internally, so it doesn't take 4-8x longer — roughly 1.5-2x is typical.
```

The DO runs the pipeline, skipping cached stages. The song is updated in-place (same song ID, new audio/artwork).

### 5.3 New: PUT /api/songs/:id/select-variation (auth required)

```
PUT /api/songs/:id/select-variation { variation_index: number }
  → Verify ownership
  → Verify song status is "completed"
  → Verify variation_index < song.variation_count (derived from R2 listing or stored on record)
  → Update song: variation_index, audio_url = audio/{songId}/variation_{index}.wav
  → Regenerate waveform for the newly selected variation:
    - Read the variation WAV from R2
    - Extract peaks (same postprocess logic)
    - Upload new waveform.json to R2
  → Return updated song
```

### 5.4 New: GET /api/songs/:id/variations (auth required or public if song is public)

```
GET /api/songs/:id/variations
  → Fetch song, verify access (owner or public)
  → List R2 objects with prefix audio/{songId}/variation_
  → Return: {
      variations: [
        { index: 0, is_selected: true },
        { index: 1, is_selected: false },
        { index: 2, is_selected: false },
        { index: 3, is_selected: false },
      ],
      selected_index: 0,
      count: 4,
    }
```

### 5.5 Modified: GET /api/songs/:id/stream

Add `?variation=N` query parameter:
- If `variation` param present: stream `audio/{songId}/variation_{N}.wav`
- If absent: stream `audio/{songId}/variation_{song.variation_index}.wav` (the selected one)
- Validate N is a non-negative integer within the variation count
- All existing behavior (Range headers, play count tracking) remains

---

## 6. Music Service Modification

### Current

```typescript
generateMusic(env, blueprint, lyrics, songId): Promise<{ audioKey: string; seed: number }>
```

### Modified

```typescript
type MusicResult = {
  audioKeys: string[];     // ["audio/{id}/variation_0.wav", "audio/{id}/variation_1.wav", ...]
  seeds: number[];         // One seed per variation
  variationCount: number;
};

generateMusic(env, blueprint, lyrics, songId, batchSize = 1): Promise<MusicResult>
```

**Real mode (ACE-Step):**
- Send `batch_size: batchSize` in the request
- ACE-Step returns multiple audio outputs
- Upload each as `audio/{songId}/variation_{i}.wav`
- Collect seeds from response

**Mock mode:**
- Generate `batchSize` silent WAV files
- Each gets a slightly different seed (0, 1, 2, ...)
- Upload each to R2

---

## 7. Durable Object Modification

### Modified startGeneration signature

```typescript
startGeneration(songId, userPrompt, userId, options: {
  genre?, mood?, language?, duration?,
  batchSize?: number,           // Default 1
  cachedBlueprint?: SongBlueprint,  // Skip blueprint stage
  cachedLyrics?: string,           // Skip lyrics + refinement stages
})
```

### Pipeline with stage skipping

```
Stage 1 — Blueprint:
  if (options.cachedBlueprint):
    blueprint = options.cachedBlueprint
    broadcast({ stage: "blueprint", status: "completed", data: { title: blueprint.title, genre: blueprint.genre } })
    // Skip — no LLM call
  else:
    blueprint = await generateBlueprint(...)
    broadcast as normal
    songQueries.updateTitle(...)

Stage 2 — Lyrics:
  if (options.cachedLyrics):
    lyrics = options.cachedLyrics
    broadcast({ stage: "lyrics", status: "completed" })
    broadcast({ stage: "refinement", status: "completed" })
    // Skip — no LLM calls
  else:
    lyrics = await generateLyrics(...)
    refined = await refineLyrics(...)
    broadcast as normal

Stage 3 — Music:
  batchSize = options.batchSize ?? 1
  musicResult = await generateMusic(env, blueprint, lyrics, songId, batchSize)
  broadcast({ stage: "music", status: "completed", data: { variation_count: musicResult.variationCount } })

Stage 4 — Artwork:
  // Always regenerated (cheap, should match current generation)
  artworkResult = await generateArtwork(...)

Stage 5 — Post-processing:
  await postProcess(env, songId, blueprint, lyrics, musicResult, artworkResult)
  // postProcess handles multiple audio keys, waveform for variation_0 only
```

### Regeneration flow

When called from `/api/songs/:id/regenerate`, the DO receives cached data:
- `keep === "none"`: no cached data → full pipeline
- `keep === "blueprint"`: `cachedBlueprint` set from song record → skips stage 1
- `keep === "lyrics"`: `cachedBlueprint` + `cachedLyrics` set → skips stages 1-2

The DO doesn't know it's a regeneration — it just sees cached inputs and skips accordingly.

---

## 8. Post-Processing Modification

`postProcess` receives `MusicResult` instead of a single audio key:

- Generate waveform for `variation_0` only (the default selected)
- Store `variation_count` on the song record via `updateCompleted`
- `audio_url` set to `audio/{songId}/variation_0.wav` (default selected)
- All seeds stored (e.g., as JSON in `ace_step_seed` or a new field)

The `updateCompleted` query already accepts `ace_step_seed` — for multi-variation, store the first seed. Individual seeds per variation can be derived from the R2 listing if needed later.

---

## 9. Song Query Extensions

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

Note: The songs table doesn't have a `variation_count` column. Options:
1. Derive from R2 listing (list objects with prefix `audio/{songId}/variation_`)
2. Add a column — simplest, avoid R2 listing on every request

**Recommendation:** Add `variation_count INTEGER DEFAULT 1` to the songs table. Update in `updateCompleted`.

---

## 10. Frontend — VariationTabs Component

```typescript
type VariationTabsProps = {
  variationCount: number;
  selectedIndex: number;       // Currently playing
  primaryIndex: number;        // Starred as primary
  onSelect: (index: number) => void;
  onSetPrimary: (index: number) => void;
};
```

Layout:
```
[ ▶1 ] [ 2 ] [ 3 ] [ 4 ]     ★ Set as primary
```

- Row of numbered buttons
- Playing tab: amber background + white text
- Non-playing: surface-2 background + gray text
- Primary variation: small star icon on the tab
- "Set as primary" button: only shown when playing a non-primary variation
- Click tab: `onSelect(index)` — parent switches WaveformPlayer to that variation
- Click "Set as primary": `onSetPrimary(index)` — API call, updates star

Hidden when `variationCount === 1`.

---

## 11. Frontend — RegenerateModal Component

```typescript
type RegenerateModalProps = {
  songId: string;
  isOpen: boolean;
  onClose: () => void;
  onRegenerated: () => void;
};
```

Modal dialog with:
- Title: "Regenerate Song"
- Three radio options with descriptions:
  - "Fresh start" (keep: "none") — "New blueprint, lyrics, music, and artwork"
  - "Keep blueprint" (keep: "blueprint") — "Same song concept, new lyrics and music"
  - "Keep lyrics" (keep: "lyrics") — "Same lyrics, new music and artwork"
- Default selected: "Keep lyrics"
- Credit cost notice: "This will use 1 credit"
- Cancel + Regenerate buttons
- Loading state during API call
- On success: `onRegenerated()` → parent refetches song, switches to generating mode

---

## 12. Frontend — SongView & WaveformPlayer Updates

### SongView

Add to completed mode:
- `VariationTabs` between artwork/info and the player
- "Regenerate" button in the action bar
- `RegenerateModal` (controlled by local state)
- When regeneration starts: reset to generating mode (show GenerationProgress)
- Pass `variationIndex` state to WaveformPlayer

### WaveformPlayer

Add `variationIndex` prop (default 0):
- When `variationIndex` changes: fetch new audio blob from `/api/songs/:id/stream?variation={index}`
- Revoke previous blob URL
- Reset playback to 0:00
- Show loading spinner during fetch
- Waveform data: fetch from API or generate flat fallback (waveform.json is only for the primary variation)

### useSongs Extensions

```typescript
regenerate: (songId: string, keep: "none" | "blueprint" | "lyrics") => Promise<{ song_id: string }>;
selectVariation: (songId: string, variationIndex: number) => Promise<SongDetail>;
getVariations: (songId: string) => Promise<{ variations: { index: number; is_selected: boolean }[]; count: number }>;
```

---

## 13. Schema Migration

### 13.1 Add `variation_count` column

Add to `apps/api/src/db/schema.sql` in the songs table definition:

```sql
variation_count INTEGER DEFAULT 1,
```

### 13.2 Existing variation columns — clarification

The songs table already has these columns from the original schema:

- **`variation_index INTEGER DEFAULT 0`** — **USED.** Tracks which variation (0-based) is currently selected as primary. Updated by `select-variation` endpoint.
- **`variation_group_id TEXT`** — **DEPRECATED.** The original design envisioned separate song rows per variation linked by a group ID. Sub-project 6 takes a different approach: one song row with multiple R2 files. This column is kept but not used — no migration needed, just ignore it.
- **`is_selected_variation BOOLEAN DEFAULT FALSE`** — **DEPRECATED.** Replaced by `variation_index` which is more precise (stores the index, not just a boolean). This column is kept but not used.

The single-row-multi-file approach is simpler: one song record, multiple `audio/{songId}/variation_{i}.wav` files in R2, `variation_index` tracks the selection, `variation_count` tracks how many exist.

### 13.3 Update `updateCompleted` query

Add `variation_count` to the `updateCompleted` query's SET clause and fields type:

```sql
-- Add to the SET clause in updateCompleted:
variation_count = ?,
```

The `fields` parameter type gains `variation_count: number`.

---

## 14. Out of Scope (Deferred)

- ACE-Step cover mode (reference audio reimagining)
- ACE-Step repaint mode (section regeneration)
- Stem separation
- Audio download (MP3 transcoding)
- Batch generation via Queue
- API access for Pro users
- Style presets library
- LoRA training
- Distribution pipeline

## 15. Known Limitations

- **Waveform only for primary variation:** Switching to a non-primary variation shows a flat waveform fallback. Generating waveforms on-the-fly for each variation would add latency.
- **Regeneration replaces in-place:** The old audio is overwritten, not preserved. Users can't go back to a previous generation. Version history is deferred.
- **ACE-Step batch_size response format:** The exact response format for batch_size > 1 needs validation against the actual ACE-Step API. The mock implementation handles arrays cleanly, but the real API integration may need adjustment.
- **No variation-specific metadata:** All variations share the same blueprint, lyrics, and artwork. Only the audio differs.
