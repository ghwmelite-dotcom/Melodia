# Melodia — Reference Track Inspiration Feature

**Date:** 2026-03-15
**Status:** Draft
**Scope:** Reference audio upload, Whisper transcription + LLM style analysis, enriched blueprint/lyrics generation, ACE-Step audio reference passthrough, upload UI, "Inspired by" display

---

## 1. Context

Melodia generates songs from text prompts. This feature adds the ability to upload a reference track — the AI analyzes it and draws inspiration from its style, mood, instrumentation, and energy to generate an original song. This mirrors how professional producers use reference tracks in real studios.

**Dependencies:**
- Song generation pipeline (Sub-project 2) — extended with new Stage 0
- Studio page (Sub-project 3) — add upload dropzone
- R2 storage — new `reference/` prefix
- Workers AI — Whisper for transcription, LLM for analysis
- ACE-Step — optional multimodal audio input

---

## 2. Technology Decisions

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Upload method | File upload (MP3/WAV, max 10MB) | No third-party dependencies, no copyright scraping |
| Audio analysis | Workers AI Whisper + LLM | Whisper extracts vocals, LLM extracts style DNA |
| ACE-Step integration | Multimodal input with fallback | Pass audio if supported, fall back to enriched tags |
| Storage | Per-song in R2, deleted with song | Enables regeneration with same reference |
| Credit cost | 1 credit (same as normal) | Reference is just a richer input, not a premium feature |
| Form encoding | multipart/form-data | Required for file upload alongside text fields |

---

## 3. New & Modified Files

### Backend

```
apps/api/src/
├── routes/
│   └── songs.ts                # MODIFY: accept multipart/form-data, upload reference to R2
├── services/
│   ├── reference.service.ts    # NEW: Whisper transcription + LLM style extraction
│   └── music.service.ts        # MODIFY: accept optional referenceAudioBase64
├── durable-objects/
│   └── song-session.ts         # MODIFY: add Stage 0 (reference analysis), pass to services
├── db/
│   ├── queries.ts              # MODIFY: add reference_url to song queries
│   └── schema.sql              # MODIFY: add reference_url column to songs table
```

### Shared

```
packages/shared/src/
├── schemas/song.ts             # MODIFY: add reference_url to SongDetailSchema
└── constants.ts                # MODIFY: add STAGE_TIMEOUTS.REFERENCE
```

### Frontend

```
apps/web/src/
├── pages/
│   ├── Studio.tsx              # MODIFY: add ReferenceUpload component
│   └── SongView.tsx            # MODIFY: add "Inspired by" mini player
├── components/
│   ├── studio/
│   │   └── ReferenceUpload.tsx # NEW: drag-and-drop audio upload
│   └── song/
│       └── GenerationProgress.tsx  # MODIFY: add "reference" stage
├── hooks/
│   └── useSongs.ts             # MODIFY: generate sends FormData
└── lib/
    └── api.ts                  # MODIFY: add postForm method
```

---

## 4. Schema Changes

Add to songs table in `schema.sql`:

```sql
reference_url TEXT,              -- R2 key of uploaded reference track (nullable)
```

Add `reference_url` to `SongDetailSchema` in shared package:

```typescript
reference_url: v.optional(v.nullable(v.string())),
```

---

## 5. API Changes

### 5.1 Generate Endpoint — Multipart Support

`POST /api/songs/generate` changes from JSON to **multipart/form-data**:

```
Content-Type: multipart/form-data

Fields:
  prompt: string (required)
  genre: string (optional)
  mood: string (optional)
  language: string (optional)
  duration: string (optional, parsed as number)
  reference: File (optional, audio/mpeg or audio/wav, max 10MB)
```

**Implementation:**
- Use Hono's `c.req.parseBody()` to parse multipart form data
- Validate reference file: check MIME type (`audio/mpeg`, `audio/wav`, `audio/x-wav`), check size <= 10MB (10 * 1024 * 1024 bytes)
- If reference provided: upload to R2 at `reference/{songId}/reference.{ext}` (determine extension from MIME type)
- Pass `referenceAudioKey` to the DO options
- Store `reference_url` on the song record

**Backward compatibility:** The endpoint should also still accept `application/json` for requests without a reference file. Check `Content-Type` header and parse accordingly.

### 5.2 Delete Endpoint — Reference Cleanup

Add `reference/{songId}/` to the R2 prefix cleanup list in `DELETE /api/songs/:id`.

### 5.3 Stream Reference Endpoint

Add a new route for streaming the reference track:

```
GET /api/songs/:id/reference (auth required, owner only)
  → Fetch song, verify ownership
  → If no reference_url: return 404
  → Stream from R2 with correct Content-Type
```

---

## 6. Reference Analysis Service

### `reference.service.ts`

```typescript
type ReferenceAnalysis = {
  transcription: string | null;
  style_description: string;
  extracted_tags: string;
  detected_genre: string;
  detected_mood: string;
  estimated_bpm: string;
  vocal_character: string;
  instrumentation: string;
};

async function analyzeReference(
  ai: Ai,
  audioBytes: ArrayBuffer
): Promise<ReferenceAnalysis>
```

**Step 1 — Whisper transcription:**
- Call Workers AI `@cf/openai/whisper` with raw audio bytes
- Returns transcribed text (or empty if instrumental)
- Timeout: `STAGE_TIMEOUTS.REFERENCE` (30 seconds)

**Step 2 — LLM style analysis:**
- System prompt instructs the LLM to act as a music producer analyzing a reference track
- User message includes: transcription text (if any), note about audio characteristics
- LLM outputs JSON with: `style_description`, `extracted_tags`, `detected_genre`, `detected_mood`, `estimated_bpm`, `vocal_character`, `instrumentation`
- Model: `AI_MODELS.LYRICS_PRIMARY` with fallback
- Temperature: 0.7
- Parse JSON response, validate fields

**Limitation:** The LLM doesn't actually "hear" the audio — it works from the Whisper transcription plus any context the user provided. This is sufficient for style tag extraction since vocals reveal genre, language, cadence, and theme. Purely instrumental tracks will produce less specific analysis, supplemented by the user's text prompt.

---

## 7. Pipeline Modification

### Durable Object — Stage 0

```
startGeneration options gain: referenceAudioKey?: string

Pipeline:
  Stage 0 — Reference Analysis (ONLY if referenceAudioKey provided):
    → broadcast({ stage: "reference", status: "in_progress" })
    → Read reference audio from R2 (this.env.R2_BUCKET.get(referenceAudioKey))
    → Call analyzeReference(this.env.AI, audioBytes)
    → Store analysis in DO state
    → broadcast({ stage: "reference", status: "completed", data: { genre, mood } })

  Stage 1 — Blueprint (enriched if reference exists):
    → If referenceAnalysis exists, append to the user message:
      "REFERENCE TRACK ANALYSIS:
       Style: {style_description}
       Tags: {extracted_tags}
       Genre: {detected_genre}, Mood: {detected_mood}
       Vocal: {vocal_character}, Instruments: {instrumentation}
       BPM estimate: {estimated_bpm}

       Use this as creative inspiration. Match the energy, production style,
       and musical character while creating something completely original."
    → User overrides (genre, mood, etc.) still take priority if explicitly provided

  Stage 2-3 — Lyrics (enriched if reference has transcription):
    → If referenceAnalysis.transcription is not null, append to lyrics prompt:
      "The reference track had lyrics with this theme and cadence:
       '{transcription snippet (first 500 chars)}'
       Draw thematic inspiration but write completely original lyrics."

  Stage 4 — Music (ACE-Step with optional reference):
    → Style tags = blueprint.style_tags + referenceAnalysis.extracted_tags (merged, deduplicated)
    → If referenceAudioKey exists:
      → Read reference from R2, encode as base64
      → Pass as multimodal audio input in chat completions message
      → If ACE-Step returns error (doesn't support audio input): catch, retry without audio, log warning
    → Otherwise: generate normally with enriched tags

  Stages 5-7 — unchanged
```

### Music Service Modification

```typescript
generateMusic(
  env, blueprint, lyrics, songId, batchSize, timeoutMs?,
  referenceAudioBase64?  // NEW optional parameter
): Promise<MusicResult>
```

When `referenceAudioBase64` is provided, the chat completions message becomes multimodal:

```typescript
messages: [{
  role: "user",
  content: [
    { type: "text", text: `tags: ${enrichedTags}\nlyrics: ${lyrics}` },
    { type: "audio_url", audio_url: { url: `data:audio/mpeg;base64,${referenceAudioBase64}` } }
  ]
}]
```

With try/catch fallback to text-only if the API rejects multimodal input.

---

## 8. Post-Processing Update

Add `reference_url` to the `updateCompleted` query fields so it's stored on the song record. The reference R2 key is passed through the pipeline and saved at completion.

---

## 9. Frontend — ReferenceUpload Component

### `ReferenceUpload.tsx`

```typescript
type ReferenceUploadProps = {
  file: File | null;
  onFileSelect: (file: File | null) => void;
};
```

**Dropzone UI:**
- Dashed border container (`border-dashed border-2 border-surface-3`)
- Drag-over state: amber border + amber background tint
- Icon: music note
- Text: "Drop a reference track or click to browse"
- Subtitle: "MP3 or WAV, max 10MB"
- Hidden `<input type="file" accept="audio/mpeg,audio/wav">`
- Click anywhere to trigger file input

**After file selected:**
- Show: music icon + filename + file size (formatted) + remove button (✕)
- Remove button clears the file (`onFileSelect(null)`)
- Solid border, surface-1 background

**Client-side validation:**
- Check MIME type: reject anything not `audio/mpeg` or `audio/wav`
- Check size: reject files > 10MB with clear error message
- Show validation error below the dropzone

---

## 10. Frontend — Studio Page Update

Add `ReferenceUpload` between the prompt textarea and the "Customize" toggle:

```
[Prompt textarea]
[ReferenceUpload - optional]
[Customize toggle → advanced options]
[Generate button + credits]
```

**Form submission change:**
- If reference file is set: use `FormData` via `api.postForm()`
- If no reference: use JSON via `api.post()` (backward compatible)
- The `useSongs().generate()` method handles both cases

### API Client — postForm Method

Add to `apps/web/src/lib/api.ts`:

```typescript
async postForm<T>(path: string, formData: FormData): Promise<T> {
  // Same as post() but:
  // - Don't set Content-Type (browser sets it with boundary for multipart)
  // - Send FormData directly as body
  // - Same auth header injection and 401 retry
}
```

---

## 11. Frontend — SongView "Inspired by" Section

In completed mode, if `song.reference_url` is truthy, show below the song title:

```
🎵 Inspired by: reference-track.mp3  [▶ Play]
```

- Small inline audio player (HTML5 `<audio>` with controls)
- Audio source: `GET /api/songs/:id/reference` (authenticated)
- Fetch as blob (same as main audio player pattern)
- Compact — doesn't dominate the page

---

## 12. Frontend — GenerationProgress Update

Add `"reference"` to the stages list. When the song has a `reference_url`, show it as the first stage:

```typescript
const STAGES = [
  // Conditionally included:
  { key: "reference", label: "Analyzing reference", icon: "🎵" },
  // Always:
  { key: "blueprint", label: "Creating blueprint", icon: "🗺️" },
  // ...
];
```

The GenerationProgress component checks if the song has a reference and includes/excludes the stage accordingly.

---

## 13. Constants Update

Add to `STAGE_TIMEOUTS`:

```typescript
REFERENCE: 30_000,  // 30 seconds for Whisper + LLM analysis
```

Add to `AI_MODELS`:

```typescript
WHISPER: "@cf/openai/whisper",
```

---

## 14. Out of Scope (Deferred)

- URL-based reference (YouTube/SoundCloud/Spotify links)
- Reference library (save and reuse references across songs)
- Audio fingerprinting / similarity matching
- Reference track waveform visualization in upload UI
- Multiple reference tracks per generation
- Reference-based genre auto-detection as a standalone feature

## 15. Known Limitations

- **LLM doesn't hear audio:** The style analysis relies on Whisper transcription, not direct audio analysis. Instrumental tracks produce less specific analysis. The user's text prompt compensates.
- **ACE-Step multimodal support uncertain:** If ACE-Step doesn't accept audio in the chat completions message, the system falls back to enriched text tags only. The reference still helps via better blueprint/lyrics.
- **10MB file limit:** Large high-quality WAV files may exceed this. Users can convert to MP3 first. The limit keeps upload times reasonable on mobile.
- **No audio preview before generation:** The user uploads the file but can't preview it in the browser before generating. The file input shows the filename only.
- **Reference analysis quality:** Whisper + LLM analysis is an approximation. It captures genre, mood, vocal style, and lyrical themes well, but can't perfectly capture production nuances like specific synthesizer sounds or mixing techniques.
