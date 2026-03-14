# Sub-project 3: React Studio UI — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core studio experience — song generation form, real-time generation progress via WebSocket, waveform audio player, song detail page, and song library with grid/list toggle.

**Architecture:** Page-based routing with React Router. Three new pages (`/studio`, `/studio/song/:id`, `/library`) plus updated Dashboard. Custom hooks (`useWebSocket`, `useSongs`) wrap API and WebSocket connections. Canvas-based waveform player renders amplitude data. All components follow the existing dark theme with amber accents.

**Tech Stack:** React 19, React Router 7, Tailwind CSS 4, Canvas API (waveform), WebSocket API, `@melodia/shared` types

**Spec:** `docs/superpowers/specs/2026-03-14-melodia-subproject3-studio-ui-design.md`

---

## Chunk 1: Foundation — API Extension, Hooks, Shared UI Components

### Task 1: API Client — Add getBlob Method

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add getBlob method to ApiClient**

Read the existing `api.ts` file. Add a `getBlob(path)` method that performs an authenticated fetch and returns the response as a `Blob` instead of parsing JSON. This is needed for fetching audio WAV files from the stream endpoint.

The method should:
- Use the same auth header injection as other methods (`Authorization: Bearer <token>`)
- Include `credentials: "include"` for cookies
- Handle 401 with the same refresh-and-retry pattern as `request()`
- Return `response.blob()` instead of `response.json()`
- Throw on non-OK responses

- [ ] **Step 2: Verify build**

```bash
npm run typecheck -w apps/web
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add getBlob method to API client for audio streaming"
```

---

### Task 2: useSongs Hook

**Files:**
- Create: `apps/web/src/hooks/useSongs.ts`

- [ ] **Step 1: Create useSongs hook**

Returns plain async functions (no shared loading state — callers use `useApi` for independent loading tracking):

```typescript
import { api } from "../lib/api.js";
import type { GenerateSongInput, Song, SongDetail } from "@melodia/shared";

export function useSongs() {
  return {
    generate: async (input: GenerateSongInput): Promise<{ song_id: string }> => {
      const res = await api.post<{ song_id: string }>("/songs/generate", input);
      return res;
    },

    getSong: async (id: string): Promise<SongDetail> => {
      const res = await api.get<{ song: SongDetail }>(`/songs/${id}`);
      return res.song;
    },

    listSongs: async (opts?: { status?: string; cursor?: string }): Promise<{ songs: Song[]; next_cursor: string | null }> => {
      const params = new URLSearchParams();
      if (opts?.status) params.set("status", opts.status);
      if (opts?.cursor) params.set("cursor", opts.cursor);
      const query = params.toString();
      return api.get<{ songs: Song[]; next_cursor: string | null }>(`/songs${query ? `?${query}` : ""}`);
    },

    deleteSong: async (id: string): Promise<void> => {
      await api.delete(`/songs/${id}`);
    },

    getAudioBlob: async (id: string): Promise<Blob> => {
      return api.getBlob(`/songs/${id}/stream`);
    },
  };
}
```

Note: The actual implementation must match the API response shapes from the existing routes. Read `apps/api/src/routes/songs.ts` to understand response formats, then adapt the hook methods to extract the correct data fields. The API wraps responses in `{ success: true, ... }` patterns that vary per route.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useSongs.ts
git commit -m "feat(web): add useSongs hook for song CRUD operations"
```

---

### Task 3: useWebSocket Hook

**Files:**
- Create: `apps/web/src/hooks/useWebSocket.ts`

- [ ] **Step 1: Create useWebSocket hook**

```typescript
type StageUpdate = {
  stage: string;
  status: "in_progress" | "completed" | "failed";
  message?: string;
  data?: Record<string, unknown>;
};

type UseWebSocketReturn = {
  connectionStatus: "connecting" | "connected" | "disconnected";
  stages: StageUpdate[];
  currentStage: string | null;
  error: string | null;
  isComplete: boolean;
  isFailed: boolean;
};
```

Implementation details:
- Derives WS URL from `window.location`: `${protocol === "https:" ? "wss:" : "ws:"}//${host}/api/songs/${songId}/live?token=${token}`
- On mount: create WebSocket, set status to "connecting"
- `onopen`: set status to "connected"
- `onmessage`: parse JSON, handle message types:
  - If message has `type === "state"` or `generationState`: set initial state from stored DO state
  - If message has `type === "stage_update"`: append to stages array, update currentStage
  - If message has `type === "error"`: set error, set isFailed
  - Check for `stage === "completed"` → set isComplete
  - Check for `stage === "error"` → set isFailed
- `onclose`: set status to "disconnected", auto-reconnect once after 2 seconds
- `onerror`: set error
- On unmount: close connection via cleanup ref
- Use `useRef` for WebSocket instance, `useState` for reactive state
- Use `useCallback` to avoid stale closures in event handlers

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useWebSocket.ts
git commit -m "feat(web): add useWebSocket hook for real-time generation progress"
```

---

### Task 4: GenreSelector Component

**Files:**
- Create: `apps/web/src/components/studio/GenreSelector.tsx`

- [ ] **Step 1: Create GenreSelector**

A styled `<select>` dropdown that groups genres with African genres first:

```
Group 1: "African" — afrobeats, afro-fusion, afro-soul, highlife, hiplife, amapiano, afro-house, kizomba, zouk
Group 2: "All Genres" — remaining genres alphabetically
```

Props: `value: string | undefined`, `onChange: (genre: string | undefined) => void`

Uses `GENRES` from `@melodia/shared`. First option is "Any genre" (maps to undefined).

Style: matches existing input pattern — `bg-surface-2 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber`

Use `<optgroup>` for visual grouping.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/studio/GenreSelector.tsx
git commit -m "feat(web): add GenreSelector with African genres prioritized"
```

---

## Chunk 2: Player & Song Display Components

### Task 5: Waveform Canvas Component

**Files:**
- Create: `apps/web/src/components/player/Waveform.tsx`

- [ ] **Step 1: Create Waveform component**

Canvas-based waveform visualization:

Props:
```typescript
type WaveformProps = {
  data: number[];         // ~200 amplitude values (0-1)
  progress: number;       // 0-1 playback position
  onSeek: (position: number) => void;  // Called with 0-1 position on click
};
```

Implementation:
- Uses `useRef<HTMLCanvasElement>` and `useEffect` to draw
- Canvas fills container width, fixed 64px height
- Redraws when `data`, `progress`, or container width changes (use ResizeObserver)
- Each bar: width = `canvasWidth / data.length - 1` (1px gap), height = `amplitude * canvasHeight`
- Bars at position <= `progress`: amber color (`#F0A500`)
- Bars at position > `progress`: surface-3 color (`#2D2D50`)
- Rounded bar caps: use `ctx.lineCap = "round"` or draw rounded rects
- Click handler: calculate position from `event.offsetX / canvas.width`, call `onSeek(position)`
- Fallback: if `data` is empty, render 200 bars of equal small height (flat line)

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/player/Waveform.tsx
git commit -m "feat(web): add Canvas-based waveform visualization component"
```

---

### Task 6: WaveformPlayer Component

**Files:**
- Create: `apps/web/src/components/player/WaveformPlayer.tsx`

- [ ] **Step 1: Create WaveformPlayer**

Full audio player combining HTML5 `<audio>` (hidden) with the `Waveform` component as a visual seek bar.

Props:
```typescript
type WaveformPlayerProps = {
  songId: string;
  waveformData: number[] | null;  // From song detail, null = loading/missing
};
```

State: `isPlaying`, `currentTime`, `duration`, `isLoading`, `audioBlobUrl`

Implementation:
- On mount: call `useSongs().getAudioBlob(songId)` to fetch audio as blob, create object URL
- Hidden `<audio ref={audioRef}>` with `src={audioBlobUrl}`
- `onloadedmetadata`: set `duration`
- `ontimeupdate`: set `currentTime`
- Play/pause button: toggle `audioRef.current.play()` / `audioRef.current.pause()`
- Skip buttons: `audioRef.current.currentTime += 10` (forward) / `-= 10` (back)
- Waveform `onSeek`: `audioRef.current.currentTime = position * duration`
- Progress calculation: `currentTime / duration`
- Time display: format as `M:SS / M:SS`
- Loading state: show spinner while fetching audio blob
- On unmount: `URL.revokeObjectURL(audioBlobUrl)` to free memory

Layout:
```
[Waveform ▁▂▃▅▇▅▃▂▁▂▃▅▇█▇▅▃▂▁]  1:45 / 3:30
   [◀◀ 10s]   [▶ Play]   [10s ▶▶]
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/player/WaveformPlayer.tsx
git commit -m "feat(web): add WaveformPlayer with audio blob fetch and seek"
```

---

### Task 7: SongCard & SongRow Components

**Files:**
- Create: `apps/web/src/components/song/SongCard.tsx`
- Create: `apps/web/src/components/song/SongRow.tsx`

- [ ] **Step 1: Create SongCard (grid view)**

Props: `song: Song`, `compact?: boolean` (for Dashboard carousel)

Layout:
- Artwork image (aspect-ratio 1:1, rounded-t-2xl). If no artwork_url: gradient placeholder (genre-based hue or surface-2 with a music note icon)
- Status badge overlay on artwork: colored dot + text (Completed/Generating/Failed)
- For generating songs: pulse animation on badge
- Below artwork: title (line-clamp-1), genre text (gray-400), duration (formatted MM:SS)
- Entire card is a `<Link to={/studio/song/${song.id}}>`
- Card style: `bg-surface-1 rounded-2xl border border-surface-3 hover:border-amber/30 transition-colors`
- Compact variant: smaller artwork, no duration display

- [ ] **Step 2: Create SongRow (list view)**

Props: `song: Song`

Layout (single row):
- 40x40 artwork thumbnail (rounded-lg) or placeholder
- Title (flex-1, truncate)
- Genre badge (small, gray)
- Status badge (colored dot + text)
- Duration (formatted MM:SS, or "—" if null)
- Relative date ("Today", "2d ago", etc.) — calculate from `song.created_at`
- Entire row is a `<Link>`, hover background: `hover:bg-surface-2`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/song/
git commit -m "feat(web): add SongCard and SongRow display components"
```

---

### Task 8: SongMeta, LyricsDisplay & GenerationProgress Components

**Files:**
- Create: `apps/web/src/components/song/SongMeta.tsx`
- Create: `apps/web/src/components/song/LyricsDisplay.tsx`
- Create: `apps/web/src/components/song/GenerationProgress.tsx`

- [ ] **Step 1: Create SongMeta**

Props: `song: SongDetail`

Displays metadata in a labeled list:
- Genre / Sub-genre
- Key signature
- BPM
- Duration (formatted)
- Vocal style
- Language
- Instruments (parse JSON array, display as comma-separated or tags)
- Time signature

Style: label in `text-gray-400 text-sm`, value in `text-white`. Vertical stack of key-value pairs.

- [ ] **Step 2: Create LyricsDisplay**

Props: `lyrics: string | null`

Parses lyrics text and renders with styled section headers:
- Split by lines, detect `[Section Name]` patterns
- Section headers: `text-amber font-semibold text-sm uppercase tracking-wide mt-6 mb-2`
- Lyrics lines: `text-gray-200 leading-relaxed`
- Blank lines between sections
- If lyrics is null: show "Lyrics not available" placeholder

- [ ] **Step 3: Create GenerationProgress**

Props: `songId: string`

Uses `useWebSocket` hook to display real-time pipeline progress.

7 stages with labels:
```typescript
const STAGES = [
  { key: "blueprint", label: "Creating blueprint" },
  { key: "lyrics", label: "Writing lyrics" },
  { key: "refinement", label: "Refining lyrics" },
  { key: "music", label: "Generating music" },
  { key: "artwork", label: "Creating artwork" },
  { key: "processing", label: "Finalizing" },
  { key: "completed", label: "Complete" },
];
```

For each stage, determine status from the `stages` array returned by `useWebSocket`:
- Not yet reached: `○` icon, gray text
- In progress: `◉` icon with spin animation, amber text
- Completed: `✓` icon, teal text
- Failed: `✗` icon, coral text

Gets `accessToken` from `useAuth` context.

When `isComplete` is true: the parent component (SongView) should refetch song details and transition to completed mode.

When `isFailed` is true: display error message.

Polling fallback: if `connectionStatus === "disconnected"` and not complete/failed, set up a `setInterval` that polls `GET /api/songs/:id/status` every 3 seconds. Map D1 status to stage progress using the mapping table from the spec:
- `pending` → no stages done
- `generating_lyrics` → blueprint may be done, lyrics in progress
- `generating_music` → blueprint+lyrics+refinement done, music in progress
- `generating_artwork` → music done, artwork in progress
- `processing` → artwork done, processing in progress
- `completed` → all done
- `failed` → show error

Pulsing background animation on the card container during generation.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/song/
git commit -m "feat(web): add SongMeta, LyricsDisplay, and GenerationProgress components"
```

---

## Chunk 3: Pages, Routes & Integration

### Task 9: Studio Page (Song Generation Form)

**Files:**
- Create: `apps/web/src/pages/Studio.tsx`

- [ ] **Step 1: Create Studio page**

The song generation form at `/studio`.

Layout:
- Page title: "Create a Song"
- Large textarea (4-6 rows) for the prompt
- Read `?prompt=` from URL search params to pre-fill (for "Try Again" from failed songs)
- "Customize" toggle button that expands/collapses the advanced section
- Advanced section (collapsible with CSS transition `max-height` + `overflow-hidden`):
  - `GenreSelector` component
  - Mood text input
  - Language dropdown (`<select>` with options: English, French, Spanish, Yoruba, Twi, Pidgin, Portuguese, Arabic)
  - Duration slider (`<input type="range" min={30} max={600} step={15}>`) with formatted MM:SS display
- "Generate Song" button (amber, full width) — disabled if prompt is empty or loading
- Credits badge: `{user.credits_remaining} credits remaining` from `useAuth()`
- Error banner for API errors (insufficient credits, validation)

On submit:
1. Call `useSongs().generate(...)` wrapped in `useApi().call()`
2. On success: `navigate(\`/studio/song/${result.song_id}\`)`
3. On error: show error message

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/Studio.tsx
git commit -m "feat(web): add Studio page — song generation form with advanced options"
```

---

### Task 10: SongView Page (Detail / Progress)

**Files:**
- Create: `apps/web/src/pages/SongView.tsx`

- [ ] **Step 1: Create SongView page**

The song detail page at `/studio/song/:id`. Has three modes:

**Common:** Fetch song via `useSongs().getSong(id)` on mount. Get `id` from `useParams()`.

**Mode 1 — Generating** (status is pending/generating_*/processing):
- Show `GenerationProgress` component with `songId`
- Display the user prompt below the title
- When `GenerationProgress` signals completion (via callback prop or re-fetch): re-fetch song details, switch to completed mode
- Call `refresh()` from `useAuth()` to update credit count after completion

**Mode 2 — Completed** (status === "completed"):
- Top section: artwork image (200x200 desktop, full-width mobile) + song title + genre/sub-genre + key/BPM/duration
- Delete button with confirmation dialog (`window.confirm()`)
- `WaveformPlayer` component with waveform data from song detail
  - Parse `waveform_url` — fetch waveform JSON. For MVP, if the song detail doesn't include inline waveform data, fetch it via `api.get()` from a relative path or pass null for fallback
- Two-column layout (desktop): lyrics left, metadata right
  - `LyricsDisplay` with `song.lyrics`
  - `SongMeta` with full song detail
- Mobile: single column stack (artwork → player → meta → lyrics)

**Mode 3 — Failed** (status === "failed"):
- Show original prompt
- Error message (if available in song data)
- "Credits have been refunded" notice
- "Try Again" button → `navigate(\`/studio?prompt=${encodeURIComponent(song.user_prompt)}\`)`
- "Back to Library" link

**Loading state:** Show spinner while fetching song details.
**Not found:** Show 404 message if song doesn't exist or belongs to another user.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/SongView.tsx
git commit -m "feat(web): add SongView page — generation progress, completed detail, failed state"
```

---

### Task 11: Library Page

**Files:**
- Create: `apps/web/src/pages/Library.tsx`

- [ ] **Step 1: Create Library page**

The song library at `/library`.

**Header:**
- "Your Songs" title with count
- View toggle buttons (Grid icon / List icon) — persist to `localStorage("melodia-library-view")`
- Status filter `<select>`: All, Completed, Generating, Failed
  - "Generating" maps to API query: don't filter by single status — instead filter client-side or show pending/generating_* statuses. Simplest: just pass `status=completed` or `status=failed`, and "All" sends no status param. "Generating" = no status param, then client-filter. Actually, the API supports individual status values, so for "Generating" use a client-side approach: fetch all and filter, or make multiple calls. Simplest approach: just use All/Completed/Failed as API filters, and "Generating" is covered by "All".

**Body:**
- If `viewMode === "grid"`: render songs as `SongCard` in responsive grid (`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`)
- If `viewMode === "list"`: render songs as `SongRow` in a vertical list

**Infinite scroll:**
- Use `useRef` + `IntersectionObserver` on a sentinel `<div>` at the bottom
- When sentinel enters viewport and `next_cursor` exists and not already loading: fetch next page
- Append results to existing songs array
- Show spinner while loading more
- Hide sentinel when `next_cursor` is null

**Empty state:** When no songs exist (first page returns empty array):
- Music note icon (text emoji or SVG)
- "No songs yet" heading
- "Create your first song" amber button → `/studio`

**Filter-aware empty state:** When filter returns no results but user has songs:
- "No [status] songs" text without create CTA

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/Library.tsx
git commit -m "feat(web): add Library page — grid/list toggle, infinite scroll, status filter"
```

---

### Task 12: Dashboard Update

**Files:**
- Modify: `apps/web/src/pages/Dashboard.tsx`

- [ ] **Step 1: Update Dashboard with quick generate + recent songs**

Read existing `Dashboard.tsx` first. Keep the existing stats cards (credits, plan, member since). Add:

**Quick generate section (top of page):**
- Single-line input: "What do you want to create?" + "Generate" button inline
- On submit: same flow as Studio — call generate API, navigate to SongView
- Compact form, no advanced options

**Recent songs section (below quick generate, above stats):**
- Fetch last 5 songs via `useSongs().listSongs({ limit: 5 })` — actually the API uses cursor pagination with limit, so just pass limit=5
- Display as horizontal scroll of `SongCard` components (compact variant)
- "View All →" link to `/library` at the right
- If no songs: show "Create your first song" CTA linking to `/studio`
- Use `overflow-x-auto` with `flex gap-4` for horizontal scroll, `snap-x` for snapping

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/Dashboard.tsx
git commit -m "feat(web): update Dashboard with quick generate and recent songs"
```

---

### Task 13: Routes & Layout Navigation

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/Layout.tsx`

- [ ] **Step 1: Add new routes to App.tsx**

Read existing `App.tsx`. Add the new routes inside the protected `AuthGuard > Layout` group:

```typescript
<Route path="/studio" element={<Studio />} />
<Route path="/studio/song/:id" element={<SongView />} />
<Route path="/library" element={<Library />} />
```

Import the new pages as lazy-loaded components (matching existing pattern with `React.lazy`).

- [ ] **Step 2: Update Layout.tsx navigation**

Read existing `Layout.tsx`. Add "Studio" and "Library" as nav links, using the same NavLink pattern as existing Dashboard/Settings links. Order: Studio, Library, Dashboard, Settings.

- [ ] **Step 3: Verify build**

```bash
npm run build -w apps/web
```

Expected: Build succeeds with all pages code-split.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/Layout.tsx
git commit -m "feat(web): add Studio, SongView, Library routes and nav links"
```

---

### Task 14: Build Verification & Push

- [ ] **Step 1: Full typecheck**

```bash
npm run typecheck -w apps/web
```

Fix any type errors.

- [ ] **Step 2: Build**

```bash
npm run build -w apps/web
```

Verify all pages are code-split into chunks.

- [ ] **Step 3: Visual smoke test**

Start both servers:
```bash
npm run dev:api   # Terminal 1
npm run dev:web   # Terminal 2
```

Verify in browser at `http://localhost:5173`:
1. Login → Dashboard shows quick generate + stats
2. Navigate to Studio → generation form renders
3. Navigate to Library → empty state shows
4. Nav links work and highlight correctly

- [ ] **Step 4: Commit any fixes and push**

```bash
git add -A
git commit -m "chore: verify Sub-project 3 build and fix any issues"
git push
```

---

**End of plan. Total: 14 tasks across 3 chunks.**
