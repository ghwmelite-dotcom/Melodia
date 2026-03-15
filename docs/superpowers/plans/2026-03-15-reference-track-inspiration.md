# Reference Track Inspiration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to upload a reference audio track (MP3/WAV) that the AI analyzes and draws inspiration from — enriching the generation pipeline with style tags, mood, instrumentation, and optionally passing the audio to ACE-Step.

**Architecture:** Extends the existing pipeline with a new Stage 0 (Reference Analysis) using Workers AI Whisper for transcription and LLM for style extraction. The generate endpoint switches from JSON to multipart/form-data when a reference file is attached. Reference audio is stored per-song in R2 and deleted with the song. Frontend adds a drag-and-drop upload component to the Studio page.

**Tech Stack:** Workers AI (Whisper `@cf/openai/whisper`), Hono multipart parsing, R2, FormData API, React drag-and-drop

**Spec:** `docs/superpowers/specs/2026-03-15-melodia-reference-track-inspiration-design.md`

---

## Chunk 1: Backend — Schema, Service, Pipeline, Routes

### Task 1: Schema + Shared Package

**Files:**
- Modify: `apps/api/src/db/schema.sql`
- Modify: `packages/shared/src/schemas/song.ts`
- Modify: `packages/shared/src/constants.ts`

- [ ] **Step 1: Add reference_url column to songs table**

Add `reference_url TEXT,` to the songs table definition in `schema.sql`, after the `artwork_prompt` line.

- [ ] **Step 2: Add REFERENCE timeout and WHISPER model to constants**

Add to `STAGE_TIMEOUTS` in `packages/shared/src/constants.ts`:
```typescript
REFERENCE: 30_000,
```

Add to `AI_MODELS`:
```typescript
WHISPER: "@cf/openai/whisper",
```

- [ ] **Step 3: Add reference_url to SongDetailSchema**

In `packages/shared/src/schemas/song.ts`, add to `SongDetailSchema`:
```typescript
reference_url: v.optional(v.nullable(v.string())),
```

- [ ] **Step 4: Re-run migration + typecheck**

```bash
cd apps/api && npx wrangler d1 execute melodia-db --local --file=src/db/schema.sql
npm run typecheck -w packages/shared
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/ apps/api/src/db/schema.sql
git commit -m "feat: add reference_url column, WHISPER model, REFERENCE timeout"
```

---

### Task 2: Reference Analysis Service

**Files:**
- Create: `apps/api/src/services/reference.service.ts`

- [ ] **Step 1: Create reference analysis service**

Create `apps/api/src/services/reference.service.ts`:

Export type `ReferenceAnalysis`:
```typescript
export type ReferenceAnalysis = {
  transcription: string | null;
  style_description: string;
  extracted_tags: string;
  detected_genre: string;
  detected_mood: string;
  estimated_bpm: string;
  vocal_character: string;
  instrumentation: string;
};
```

Export function `analyzeReference(ai: Ai, audioBytes: ArrayBuffer): Promise<ReferenceAnalysis>`:

**Step 1 — Whisper transcription:**
- Call `ai.run(AI_MODELS.WHISPER, { audio: [...new Uint8Array(audioBytes)] })`
- Note: Workers AI Whisper expects audio as an array of numbers or a Uint8Array
- Extract `text` from response. If empty/null, set `transcription = null`
- Wrap in try/catch — if Whisper fails (unsupported format, too long), set `transcription = null` and continue

**Step 2 — LLM style analysis:**
- System prompt: "You are a world-class music producer. Analyze this reference track based on the provided transcription and context. Output valid JSON with fields: style_description (2-3 sentences), extracted_tags (10+ comma-separated), detected_genre, detected_mood (2-3 descriptors), estimated_bpm, vocal_character, instrumentation."
- User message: includes transcription text (if available) or "Instrumental track — no vocals detected"
- Model: `AI_MODELS.LYRICS_PRIMARY` with fallback to `AI_MODELS.LYRICS_FALLBACK`
- Temperature: 0.7, max_tokens: 500
- Parse JSON response, validate all fields exist
- On parse failure: retry once with explicit "Output ONLY valid JSON" instruction

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/services/reference.service.ts
git commit -m "feat(api): add reference analysis service — Whisper transcription + LLM style extraction"
```

---

### Task 3: Music Service — Reference Audio Passthrough

**Files:**
- Modify: `apps/api/src/services/music.service.ts`

- [ ] **Step 1: Add optional referenceAudioBase64 parameter**

Read existing `music.service.ts`. Add `referenceAudioBase64?: string` as the last optional parameter to both `generateRealMusic` and the main `generateMusic` export.

In `generateRealMusic`, when `referenceAudioBase64` is provided, change the chat completions message to multimodal format:

```typescript
const messages = referenceAudioBase64
  ? [{
      role: "user" as const,
      content: [
        { type: "text", text: `tags: ${blueprint.style_tags}\nlyrics: ${lyrics}` },
        { type: "audio_url", audio_url: { url: `data:audio/mpeg;base64,${referenceAudioBase64}` } }
      ]
    }]
  : [{
      role: "user" as const,
      content: `tags: ${blueprint.style_tags}\nlyrics: ${lyrics}`
    }];
```

Wrap the ACE-Step call in a try/catch. If it fails with the multimodal message (ACE-Step may not support audio input), retry without the audio reference and log a warning:
```typescript
try {
  // Try with reference audio
  response = await fetch(..., { body: JSON.stringify({ ...payload, messages: multimodalMessages }) });
  if (!response.ok) throw new Error("Multimodal not supported");
} catch {
  console.warn("ACE-Step rejected audio reference, falling back to text-only");
  response = await fetch(..., { body: JSON.stringify({ ...payload, messages: textOnlyMessages }) });
}
```

Pass `referenceAudioBase64` through from `generateMusic` to `generateRealMusic`. Mock mode ignores it (no change to mock).

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/services/music.service.ts
git commit -m "feat(api): add reference audio passthrough to music service with fallback"
```

---

### Task 4: Durable Object — Stage 0 + Pipeline Enrichment

**Files:**
- Modify: `apps/api/src/durable-objects/song-session.ts`

- [ ] **Step 1: Extend DO for reference analysis**

Read existing `song-session.ts`. Make these changes:

**1. Import reference service:**
```typescript
import { analyzeReference, type ReferenceAnalysis } from "../services/reference.service.js";
```

**2. Add `referenceAudioKey` to StartBody options:**
```typescript
options: {
  // existing fields...
  referenceAudioKey?: string;
}
```

**3. Add Stage 0 before blueprint in `startGeneration`:**

```typescript
let referenceAnalysis: ReferenceAnalysis | undefined;
let referenceAudioBase64: string | undefined;

if (options.referenceAudioKey) {
  // Stage 0: Reference Analysis
  await this.updateStage("reference", "in_progress");
  await songQueries.updateStatus(this.env.DB, songId, "generating_lyrics");

  const refObject = await this.env.R2_BUCKET.get(options.referenceAudioKey);
  if (refObject) {
    const audioBytes = await refObject.arrayBuffer();
    referenceAnalysis = await analyzeReference(this.env.AI, audioBytes);

    // Encode for ACE-Step passthrough
    const uint8 = new Uint8Array(audioBytes);
    referenceAudioBase64 = btoa(String.fromCharCode(...uint8));
    // Note: for large files, use chunked btoa to avoid call stack limits
  }

  await this.updateStage("reference", "completed", {
    genre: referenceAnalysis?.detected_genre,
    mood: referenceAnalysis?.detected_mood,
  });
}
```

**Important: Base64 encoding for large files.** The `btoa(String.fromCharCode(...uint8))` pattern fails for files > ~100KB due to argument limits. Use a chunked approach:
```typescript
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
```

**4. Enrich blueprint prompt if reference exists:**

Before calling `generateBlueprint`, if `referenceAnalysis` exists, append to the user prompt:
```typescript
let enrichedPrompt = userPrompt;
if (referenceAnalysis) {
  enrichedPrompt += `\n\nREFERENCE TRACK ANALYSIS:\nStyle: ${referenceAnalysis.style_description}\nTags: ${referenceAnalysis.extracted_tags}\nGenre: ${referenceAnalysis.detected_genre}, Mood: ${referenceAnalysis.detected_mood}\nVocal: ${referenceAnalysis.vocal_character}, Instruments: ${referenceAnalysis.instrumentation}\nBPM estimate: ${referenceAnalysis.estimated_bpm}\n\nUse this as creative inspiration. Match the energy and production style while creating something completely original.`;
}
```

**5. Enrich lyrics prompt if reference has transcription:**

Before calling `generateLyrics`, if `referenceAnalysis?.transcription` is not null, the blueprint's `song_concept` should be enriched. The simplest way: modify the blueprint object's `song_concept` field to append:
```typescript
if (referenceAnalysis?.transcription) {
  blueprint.song_concept = (blueprint.song_concept || "") +
    ` The reference track had lyrics with this theme: "${referenceAnalysis.transcription.slice(0, 500)}". Draw thematic inspiration but write completely original lyrics.`;
}
```

**6. Pass referenceAudioBase64 to generateMusic:**

```typescript
const musicResult = await generateMusic(
  this.env, blueprint, refined, songId, batchSize, musicTimeoutMs,
  referenceAudioBase64  // new parameter
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/durable-objects/song-session.ts
git commit -m "feat(api): add Stage 0 reference analysis + pipeline enrichment in DO"
```

---

### Task 5: Songs Routes — Multipart Upload + Reference Endpoints

**Files:**
- Modify: `apps/api/src/routes/songs.ts`
- Modify: `apps/api/src/db/queries.ts`

- [ ] **Step 1: Add reference_url to song queries**

In `queries.ts`, add `reference_url` to `updateCompleted` query's SET clause, bind params, and fields type.

Add a new query to `songQueries`:
```typescript
updateReferenceUrl: (db, songId, referenceUrl) =>
  db.prepare("UPDATE songs SET reference_url = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(referenceUrl, songId).run(),
```

- [ ] **Step 2: Modify generate endpoint for multipart/form-data**

Read existing `songs.ts`. Modify `POST /generate`:

Check `Content-Type` header to determine parsing mode:
```typescript
const contentType = c.req.header("Content-Type") || "";
let prompt: string, genre: string | undefined, mood: string | undefined,
    language: string | undefined, duration: number | undefined;
let referenceFile: File | null = null;

if (contentType.includes("multipart/form-data")) {
  const body = await c.req.parseBody();
  prompt = body.prompt as string;
  genre = body.genre as string | undefined;
  mood = body.mood as string | undefined;
  language = body.language as string | undefined;
  duration = body.duration ? Number(body.duration) : undefined;
  referenceFile = body.reference as File | null;
} else {
  // JSON mode (backward compatible)
  const body = await c.req.json();
  // ... existing validation
}
```

Validate reference file if provided:
```typescript
if (referenceFile) {
  const validTypes = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/wave"];
  if (!validTypes.includes(referenceFile.type)) {
    throw new AppError("VALIDATION_ERROR", "Reference must be MP3 or WAV", 400);
  }
  if (referenceFile.size > 10 * 1024 * 1024) {
    throw new AppError("VALIDATION_ERROR", "Reference file must be under 10MB", 400);
  }
}
```

After song creation, upload reference to R2:
```typescript
let referenceAudioKey: string | undefined;
if (referenceFile) {
  const ext = referenceFile.type.includes("wav") ? "wav" : "mp3";
  referenceAudioKey = `reference/${songId}/reference.${ext}`;
  const arrayBuffer = await referenceFile.arrayBuffer();
  await c.env.R2_BUCKET.put(referenceAudioKey, arrayBuffer, {
    httpMetadata: { contentType: referenceFile.type },
  });
  await songQueries.updateReferenceUrl(c.env.DB, songId, referenceAudioKey);
}
```

Pass `referenceAudioKey` in the DO start request body.

- [ ] **Step 3: Add GET /:id/reference endpoint**

Add before the `/:id` wildcard route:

```typescript
songs.get("/:id/reference", authGuard(), async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.param();

  const song = await songQueries.findByIdAndUser(c.env.DB, id, userId);
  if (!song || !(song as any).reference_url) {
    throw new AppError("NOT_FOUND", "Reference not found", 404);
  }

  const r2Object = await c.env.R2_BUCKET.get((song as any).reference_url);
  if (!r2Object) throw new AppError("NOT_FOUND", "Reference file not found", 404);

  const contentType = (song as any).reference_url.endsWith(".wav") ? "audio/wav" : "audio/mpeg";
  return new Response(r2Object.body, {
    headers: { "Content-Type": contentType, "Content-Length": String(r2Object.size) },
  });
});
```

- [ ] **Step 4: Add reference cleanup to DELETE endpoint**

In the existing `DELETE /:id` handler, add `reference/${id}/` to the R2 prefix cleanup list.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck -w apps/api
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/songs.ts apps/api/src/db/queries.ts
git commit -m "feat(api): add multipart upload, reference streaming, and R2 cleanup for reference tracks"
```

---

## Chunk 2: Frontend — Upload Component, Studio, SongView, Progress

### Task 6: API Client postForm + useSongs Update

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/hooks/useSongs.ts`

- [ ] **Step 1: Add postForm method to API client**

Read existing `api.ts`. Add a `postForm` method:

```typescript
async postForm<T>(path: string, formData: FormData, options: Omit<RequestOptions, "body" | "method"> = {}): Promise<T> {
  // Same pattern as post() but:
  // - Do NOT set Content-Type header (browser auto-sets multipart boundary)
  // - Send formData as body directly
  // - Same auth header, credentials, 401 retry pattern
}
```

- [ ] **Step 2: Update useSongs generate method**

Modify `generate` in `useSongs.ts` to accept an optional `referenceFile`:

```typescript
generate: async (input: GenerateSongInput & { referenceFile?: File }) => {
  const { referenceFile, ...fields } = input;

  if (referenceFile) {
    const formData = new FormData();
    formData.append("prompt", fields.prompt);
    if (fields.genre) formData.append("genre", fields.genre);
    if (fields.mood) formData.append("mood", fields.mood);
    if (fields.language) formData.append("language", fields.language);
    if (fields.duration) formData.append("duration", String(fields.duration));
    formData.append("reference", referenceFile);
    return api.postForm<{ song_id: string }>("/api/songs/generate", formData);
  }

  // No reference — use JSON (backward compatible)
  return api.post<{ song_id: string }>("/api/songs/generate", fields);
},
```

Add a method to get the reference audio:
```typescript
getReferenceBlob: async (songId: string): Promise<Blob> => {
  return api.getBlob(`/api/songs/${songId}/reference`);
},
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/hooks/useSongs.ts
git commit -m "feat(web): add postForm API method and reference file support in useSongs"
```

---

### Task 7: ReferenceUpload Component

**Files:**
- Create: `apps/web/src/components/studio/ReferenceUpload.tsx`

- [ ] **Step 1: Create drag-and-drop upload component**

Props:
```typescript
type ReferenceUploadProps = {
  file: File | null;
  onFileSelect: (file: File | null) => void;
};
```

Implementation:
- Drop zone with `onDragOver`, `onDragLeave`, `onDrop` handlers
- Hidden `<input type="file" accept="audio/mpeg,audio/wav,.mp3,.wav">`
- Click zone triggers file input
- Drag-over state: amber border + tint
- Default state: dashed border, music note icon, "Drop a reference track or click to browse", "MP3 or WAV, max 10MB"
- After file selected: solid border, filename + size (formatted KB/MB) + remove (✕) button
- Client-side validation: check MIME type and size, show error message below dropzone
- Format file size: `(size / 1024 / 1024).toFixed(1) + " MB"` or `(size / 1024).toFixed(0) + " KB"`
- Styling: surface-1 background, surface-3 dashed border, amber on drag-over, rounded-2xl

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/studio/ReferenceUpload.tsx
git commit -m "feat(web): add ReferenceUpload drag-and-drop component"
```

---

### Task 8: Studio Page + SongView + GenerationProgress Updates

**Files:**
- Modify: `apps/web/src/pages/Studio.tsx`
- Modify: `apps/web/src/pages/SongView.tsx`
- Modify: `apps/web/src/components/song/GenerationProgress.tsx`

- [ ] **Step 1: Add ReferenceUpload to Studio page**

Read existing `Studio.tsx`. Add state: `const [referenceFile, setReferenceFile] = useState<File | null>(null);`

Add `ReferenceUpload` component between the prompt textarea and the "Customize" toggle:
```tsx
<ReferenceUpload file={referenceFile} onFileSelect={setReferenceFile} />
```

Modify the generate submit handler to pass `referenceFile`:
```typescript
const result = await call(() =>
  songs.generate({ prompt, genre, mood, language, duration, referenceFile: referenceFile || undefined })
);
```

Reset `referenceFile` after successful generation.

- [ ] **Step 2: Add "Inspired by" section to SongView**

Read existing `SongView.tsx`. In the completed mode, if `song.reference_url` is truthy, add below the song title/info area:

```tsx
{song.reference_url && (
  <div className="flex items-center gap-3 mt-3 px-4 py-2 bg-surface-2 rounded-xl">
    <span className="text-amber">🎵</span>
    <span className="text-sm text-gray-400">Inspired by reference track</span>
    <audio
      controls
      src={referenceBlobUrl}
      className="h-8 flex-1"
      style={{ maxWidth: 200 }}
    />
  </div>
)}
```

Fetch the reference blob on mount if `song.reference_url` exists:
```typescript
useEffect(() => {
  if (song?.reference_url) {
    songs.getReferenceBlob(song.id).then(blob => {
      setReferenceBlobUrl(URL.createObjectURL(blob));
    }).catch(() => {}); // Non-critical
  }
  return () => { if (referenceBlobUrl) URL.revokeObjectURL(referenceBlobUrl); };
}, [song?.reference_url]);
```

- [ ] **Step 3: Add reference stage to GenerationProgress**

Read existing `GenerationProgress.tsx`. Add `"reference"` stage:

The stages list should be dynamic — if the song has a reference, include the reference stage:

```typescript
const stages = [
  ...(hasReference ? [{ key: "reference", label: "Analyzing reference", icon: "🎵" }] : []),
  { key: "blueprint", label: "Creating blueprint", icon: "🗺️" },
  // ... rest unchanged
];
```

Determine `hasReference` from: the WebSocket broadcasts a `reference` stage event (if it appears, the song has a reference), or from the song's `reference_url` field if available.

- [ ] **Step 4: Typecheck + build**

```bash
npm run typecheck -w apps/web
npm run build -w apps/web
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/Studio.tsx apps/web/src/pages/SongView.tsx apps/web/src/components/song/GenerationProgress.tsx
git commit -m "feat(web): add reference upload to Studio, 'Inspired by' to SongView, reference stage to progress"
```

---

### Task 9: Deploy + Push

- [ ] **Step 1: Run D1 migration (local + remote)**

```bash
cd apps/api
npx wrangler d1 execute melodia-db --local --file=src/db/schema.sql
npx wrangler d1 execute melodia-db --remote --file=src/db/schema.sql
```

- [ ] **Step 2: Deploy API**

```bash
cd apps/api && npx wrangler deploy
```

- [ ] **Step 3: Build + deploy frontend**

```bash
cd apps/web
VITE_API_URL=https://melodia-api.ghwmelite.workers.dev npm run build
npx wrangler pages deploy dist --project-name=melodia --commit-dirty=true --branch=main
```

- [ ] **Step 4: Commit + push**

```bash
git add -A
git commit -m "chore: deploy reference track inspiration feature"
git push
```

---

**End of plan. Total: 9 tasks across 2 chunks.**
