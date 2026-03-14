# Melodia — Sub-project 3: React Studio UI

**Date:** 2026-03-14
**Status:** Draft
**Scope:** Song generation form, real-time generation progress, waveform audio player, song detail page, song library (grid/list), dashboard update

---

## 1. Context

Sub-project 1 built the monorepo, auth, and frontend shell. Sub-project 2 built the song generation pipeline (Durable Object orchestrator, Workers AI, ACE-Step, R2 storage, WebSocket progress). Sub-project 3 builds the frontend UI that connects to the pipeline — the core product experience.

**Dependencies on Sub-project 2:**
- `POST /api/songs/generate` — trigger pipeline, returns song_id
- `GET /api/songs` — list user's songs with cursor pagination
- `GET /api/songs/:id` — full song details
- `GET /api/songs/:id/status` — lightweight status poll
- `GET /api/songs/:id/stream` — audio streaming from R2 with Range support
- `DELETE /api/songs/:id` — delete song + R2 assets
- `WS /api/songs/:id/live?token=<jwt>` — real-time generation progress
- `POST /api/lyrics/generate` — standalone lyrics (no credit cost)
- `POST /api/lyrics/refine` — refine lyrics with LLM critic

**Dependencies on Sub-project 1:**
- Auth context (`useAuth`), API client (`api`), `useApi` hook
- Layout component with nav bar
- Tailwind CSS theme tokens (charcoal, midnight, amber, coral, teal, surface-1/2/3)
- `@melodia/shared` types: `Song`, `SongDetail`, `GenerateSongInput`, `GENRES`, `SONG_STATUSES`

---

## 2. Technology Decisions

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Audio player | Custom waveform player (Canvas) | Signature visual element, no dependencies |
| Real-time updates | WebSocket via `useWebSocket` hook | Native browser WebSocket, reconnect + polling fallback |
| Library pagination | Infinite scroll with cursor | Smooth UX, matches API's cursor-based pagination |
| State management | Hooks + React Context (existing) | No new state library — useSongs hook wraps API calls |
| View toggle | Local state (grid/list) | Simple useState, persisted to localStorage |

---

## 3. New & Modified Files

```
apps/web/src/
├── pages/
│   ├── Studio.tsx              # NEW: song generation form
│   ├── SongView.tsx            # NEW: song detail (progress OR completed)
│   ├── Library.tsx             # NEW: song library with grid/list toggle
│   └── Dashboard.tsx           # MODIFY: add quick generate + recent songs
├── components/
│   ├── Layout.tsx              # MODIFY: add Studio + Library nav links
│   ├── player/
│   │   ├── WaveformPlayer.tsx  # NEW: audio player with waveform visualization
│   │   └── Waveform.tsx        # NEW: Canvas-based waveform renderer
│   ├── song/
│   │   ├── SongCard.tsx        # NEW: grid view card
│   │   ├── SongRow.tsx         # NEW: list view row
│   │   ├── SongMeta.tsx        # NEW: metadata display panel
│   │   ├── LyricsDisplay.tsx   # NEW: formatted lyrics with section markers
│   │   └── GenerationProgress.tsx  # NEW: real-time pipeline stage tracker
│   └── studio/
│       └── GenreSelector.tsx   # NEW: genre dropdown, African genres first
├── hooks/
│   ├── useWebSocket.ts         # NEW: WebSocket connection to DO
│   └── useSongs.ts             # NEW: song CRUD operations
├── lib/
│   └── api.ts                  # MODIFY: add getBlob() method for audio fetching
└── App.tsx                     # MODIFY: add new routes
```

---

## 4. Routes

| Route | Component | Auth | Description |
|-------|-----------|------|-------------|
| `/studio` | Studio | Protected | Song generation form |
| `/studio/song/:id` | SongView | Protected | Song detail / generation progress |
| `/library` | Library | Protected | Song library with grid/list toggle |
| `/dashboard` | Dashboard | Protected | Updated: quick generate + recent songs |

All new routes are protected (inside AuthGuard + Layout).

### Layout Nav Update

```
♪ Melodia    Studio    Library    Dashboard    Settings    [username] [Logout]
```

Studio and Library added as primary nav links. Active state matches existing NavLink pattern (white text + surface-3 background).

---

## 5. Song Generation Form (`/studio`)

### 5.1 Layout

```
┌─────────────────────────────────────────────┐
│  Create a Song                              │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │  Describe your song...                  ││
│  │  e.g., "Afrobeats love song about      ││
│  │  Accra at night"                        ││
│  │                                         ││
│  └─────────────────────────────────────────┘│
│                                             │
│  [▾ Customize]  (collapsed by default)      │
│                                             │
│  ┌─ Advanced (when expanded) ─────────────┐ │
│  │ Genre:    [▼ Select genre    ]         │ │
│  │ Mood:     [________________ ]          │ │
│  │ Language: [▼ English        ]          │ │
│  │ Duration: [───●─────] 3:00             │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  [♪ Generate Song]         4 credits left   │
└─────────────────────────────────────────────┘
```

### 5.2 Behavior

- **Prompt textarea:** 4-6 rows, max 1000 chars, required. `surface-2` background, `focus:ring-amber`.
- **Customize toggle:** Expands/collapses advanced section with smooth CSS transition.
- **GenreSelector:** Dropdown grouping African genres first (Afrobeats, Afro-fusion, Afro-soul, Highlife, Hiplife, Amapiano, Afro-house), then alphabetical. Uses `GENRES` from `@melodia/shared`.
- **Mood:** Free text input, placeholder "romantic, energetic, melancholy..."
- **Language:** Dropdown — English (default), French, Spanish, Yoruba, Twi, Pidgin, Portuguese, Arabic.
- **Duration:** Range slider, 30-600 seconds, default 180, displays formatted time (MM:SS).
- **Credits badge:** Shows `user.credits_remaining` from auth context.
- **Generate button:** Amber gradient, disabled while loading. On click:
  1. Validate prompt not empty
  2. Call `useSongs().generate({ prompt, genre?, mood?, language?, duration? })`
  3. On 202: navigate to `/studio/song/{song_id}`
  4. On error: show error banner (insufficient credits, validation, etc.)

---

## 6. Song View (`/studio/song/:id`)

Three modes based on song status:

### 6.1 Generating Mode (status is pending/generating_*/processing)

```
┌─────────────────────────────────────────┐
│  Creating your song...                  │
│  "Afrobeats love song about Accra..."   │
│                                         │
│  ✓ Blueprint created — Accra Nights     │
│  ✓ Lyrics written                       │
│  ✓ Lyrics refined                       │
│  ◉ Generating music...                  │
│  ○ Creating artwork                     │
│  ○ Finalizing                           │
│                                         │
│  [soft pulsing animation]               │
└─────────────────────────────────────────┘
```

**GenerationProgress component:**
- Uses `useWebSocket(songId, accessToken)` for real-time updates
- 7 UI stages displayed: Blueprint, Lyrics, Refinement, Music, Artwork, Processing, Complete
- Each stage shows icon: `○` pending, `◉` in progress (with spinner), `✓` completed (green), `✗` failed (coral)
- Stage messages update from WebSocket data
- On "completed" message: fetch full song details, call `refresh()` from auth context to update credits, transition to completed mode
- On WebSocket disconnect: fall back to polling `GET /api/songs/:id/status` every 3 seconds. On WebSocket reconnect, call `refresh()` for a fresh token before reconnecting.
- Pulsing ambient animation on the card background during generation

**Stage mapping — DB status vs WebSocket stages:**

The D1 `status` column stores coarse-grained status (`SONG_STATUSES`). The WebSocket pushes fine-grained stage events. The `GenerationProgress` component maps WebSocket events to UI stages:

| WebSocket `stage` | UI Label | D1 `status` during this stage |
|-------------------|----------|-------------------------------|
| `blueprint` | Blueprint created | `generating_lyrics` |
| `lyrics` | Lyrics written | `generating_lyrics` |
| `refinement` | Lyrics refined | `generating_lyrics` |
| `music` | Generating music | `generating_music` |
| `artwork` | Creating artwork | `generating_artwork` |
| `processing` | Finalizing | `processing` |
| `completed` | Complete | `completed` |
| `error` | Failed | `failed` |

When polling (fallback), map D1 status to the most recent known stage. For example, `generating_music` means blueprint/lyrics/refinement are done and music is in progress.

### 6.2 Completed Mode (status == completed)

```
┌─────────────────────────────────────────────────┐
│  ┌──────────┐   Accra Nights                    │
│  │          │   Afrobeats · Afro-soul            │
│  │ ARTWORK  │   Dm · 95 BPM · 3:30              │
│  │  cover   │                                    │
│  └──────────┘   [Delete]                         │
│                                                   │
│  ▁▂▃▅▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇▅▃▂▁  1:45 / 3:30    │
│  [◀◀]  [▶ Play]  [▶▶]                           │
│                                                   │
│  ── Lyrics ──                ── Details ──        │
│  [Verse 1]                   Genre: Afrobeats     │
│  Walking through the          Sub: Afro-soul      │
│  streets of Accra...          Key: D minor        │
│                               BPM: 95             │
│  [Chorus]                     Duration: 3:30      │
│  Under the lights tonight...  Vocal: Smooth male  │
│                               Language: English    │
│                               Instruments: perc,   │
│                               guitar, synth...     │
└─────────────────────────────────────────────────┘
```

**Layout:**
- Desktop: two-column below player (lyrics left, metadata right)
- Mobile: single column (artwork + player → metadata → lyrics)

**Components used:**
- `WaveformPlayer` — full audio player with waveform
- `LyricsDisplay` — formatted lyrics with styled section headers
- `SongMeta` — genre, key, BPM, duration, vocal style, language, instruments
- Artwork displayed as rounded card with subtle shadow/glow

**Artwork:** Loaded from `/api/songs/:id` `artwork_url` field. Displayed as 200x200 on desktop, full-width on mobile. Fallback gradient placeholder if null.

**Delete button:** Confirms with dialog ("Are you sure? This cannot be undone."), calls `DELETE /api/songs/:id`, redirects to `/library`.

### 6.3 Failed Mode (status == failed)

- Shows the original prompt
- Error message from the pipeline
- "Credits refunded" notice
- "Try Again" button → navigates to `/studio` with prompt pre-filled via URL search params (`?prompt=...`)

---

## 7. Waveform Audio Player

### 7.1 WaveformPlayer Component

Full audio player with:
- HTML5 `<audio>` element (hidden, for playback)
- `Waveform` component (visual seek bar)
- Play/Pause button (large, centered)
- Skip back/forward 10s buttons
- Current time / total duration display
- Audio source: `/api/songs/:id/stream` (authenticated, via fetch with Bearer token → createObjectURL)

**State:** `isPlaying`, `currentTime`, `duration`, `isLoading`

**Audio loading:** Since the stream endpoint requires auth, fetch the audio via the API client's `getBlob()` method (to be added in Sub-project 3), create an object URL via `URL.createObjectURL()`, and set as `<audio>` source. Cache the blob URL per song to avoid re-fetching.

**ApiClient modification required:** Add a `getBlob(path)` method to `apps/web/src/lib/api.ts` that performs an authenticated fetch and returns `response.blob()` instead of `response.json()`. This is needed because the audio stream endpoint returns binary WAV data, not JSON.

### 7.2 Waveform Component (Canvas)

- Receives `data: number[]` (~200 amplitude values, 0-1) and `progress: number` (0-1)
- Renders vertical bars on a Canvas element
- Bars before `progress` position: amber color
- Bars after `progress` position: surface-3 color
- Click anywhere on the waveform → calculate position, seek audio to that time
- Responsive: redraws on container resize
- Height: 64px, width: 100% of container
- Bar width: calculated from canvas width / data length, with 1px gap between bars
- Rounded bar caps for polished look

### 7.3 Waveform Data Loading

- Fetch waveform data: `GET /api/songs/:id` returns `waveform_url`
- Fetch the JSON from the waveform URL (proxied through the stream endpoint or a new lightweight endpoint)
- For MVP: embed waveform data fetch in the song detail API response, or fetch the waveform.json from R2 via a simple API route
- Fallback: if no waveform data, generate a flat visualization (all bars same height)

---

## 8. Song Library (`/library`)

### 8.1 Header

```
Your Songs (12)                    [▦ Grid] [≡ List]    Status: [▼ All]
```

- Song count from API response
- View toggle: persisted to `localStorage('melodia-library-view')`
- Status filter dropdown: All, Completed, Generating, Failed

### 8.2 Grid View (default)

Responsive grid: 1 col (mobile), 2 cols (sm), 3 cols (md), 4 cols (lg).

**SongCard component:**
- Artwork image fills top half (aspect-ratio: 1/1). If no artwork: gradient placeholder with genre-based color + status indicator
- Below artwork: title (truncated), genre badge, status badge (colored dot), duration
- Play button overlay on artwork hover (completed songs)
- Click → navigate to `/studio/song/:id`
- Status badges: green dot "Completed", amber dot "Generating" (with pulse animation), coral dot "Failed"

### 8.3 List View

**SongRow component:**
- 40x40 artwork thumbnail (or placeholder)
- Title, genre, status badge, duration (formatted MM:SS), relative date ("Today", "2d ago")
- Click row → navigate to `/studio/song/:id`

### 8.4 Infinite Scroll Pagination

- Initial load: 20 songs
- IntersectionObserver on a sentinel element at bottom of list
- When visible: fetch next page using `cursor` from previous response's `next_cursor`
- Show loading spinner while fetching
- Stop when `next_cursor` is null

### 8.5 Empty State

Centered message: "No songs yet" with a music note icon and "Create your first song" CTA button linking to `/studio`.

---

## 9. Updated Dashboard (`/dashboard`)

### 9.1 Quick Generate

Compact inline form at the top of the dashboard:

```
┌──────────────────────────────────────────────────┐
│  What do you want to create?                     │
│  [________________________________] [Generate ♪] │
└──────────────────────────────────────────────────┘
```

Single-line input (not textarea). On submit: calls generate API, navigates to SongView. Same logic as Studio but streamlined for quick access.

### 9.2 Recent Songs

Horizontal scroll of last 5 songs using `SongCard` component (compact variant). "View All →" link to `/library`.

### 9.3 Stats Cards

Keep existing: credits remaining, plan badge, member since. Already implemented.

---

## 10. Hooks

### 10.1 useWebSocket

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

function useWebSocket(songId: string, token: string): UseWebSocketReturn;
```

- Derives WebSocket URL from current location: `ws(s)://{host}/api/songs/{songId}/live?token={token}`
- On mount: connect, receive initial state
- On message: parse JSON, append to stages array, update currentStage
- On close: set status to disconnected. Auto-reconnect once after 2 seconds. If reconnect fails, set error.
- On unmount: close connection
- `isComplete`: true when a stage with `stage === "completed"` is received
- `isFailed`: true when a stage with `stage === "error"` is received

### 10.2 useSongs

```typescript
type UseSongsReturn = {
  generate: (input: GenerateSongInput) => Promise<{ song_id: string }>;
  getSong: (id: string) => Promise<SongDetail>;
  listSongs: (opts?: { status?: string; cursor?: string }) => Promise<{ songs: Song[]; next_cursor: string | null }>;
  deleteSong: (id: string) => Promise<void>;
};

function useSongs(): UseSongsReturn;
```

Each method is a standalone async function that callers wrap with the existing `useApi` hook for independent loading/error tracking. `useSongs` does NOT maintain a shared loading state — instead it returns plain async functions. Example usage:

```typescript
const songs = useSongs();
const { call, loading, error } = useApi();
const result = await call(() => songs.listSongs({ status: "completed" }));
```

This avoids the problem of a single `loading` boolean being ambiguous when multiple operations run concurrently (e.g., listing songs while deleting one).

---

## 11. Design Tokens & Styling Patterns

All new components follow the existing design system:

- **Cards:** `bg-surface-1 rounded-2xl border border-surface-3` with optional `hover:border-amber/30` for interactive cards
- **Inputs:** `bg-surface-2 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-amber`
- **Primary button:** `bg-amber text-charcoal font-semibold rounded-xl hover:bg-amber/90 disabled:opacity-50`
- **Status badges:** Completed = `bg-teal/20 text-teal`, Generating = `bg-amber/20 text-amber`, Failed = `bg-coral/20 text-coral`
- **Section headers in lyrics:** `text-amber font-semibold text-sm uppercase tracking-wide`
- **Metadata labels:** `text-gray-400 text-sm`, values in `text-white`
- **Responsive:** Mobile-first, breakpoints at `sm` (640), `md` (768), `lg` (1024)

---

## 12. Out of Scope (Deferred)

- Standalone lyrics generation/refinement UI (Sub-project 4 — API exists but no UI in this sub-project)
- Lyrics editing / inline edit mode (Sub-project 4)
- Song regeneration / remix (Sub-project 4)
- Multi-variation selection UI (Sub-project 4)
- Audio download button (Sub-project 4 — need MP3 transcoding)
- Public sharing / embed player (Sub-project 4)
- Playlist management (Sub-project 4)
- Persistent bottom player bar (Sub-project 4)
- Like/favorite functionality (Sub-project 4)
- Explore page / genre browsing (Sub-project 4)

## 13. Known Limitations

- **Audio loading:** WAV files are large (~30MB). The player fetches the entire file as a blob before playback starts. This may cause a brief loading delay on slow connections. Streaming playback from blob URL works but initial fetch is blocking.
- **Waveform data dependency:** If the pipeline's post-processing step fails to generate waveform data, the player shows a flat visualization fallback.
- **WebSocket on mobile:** Mobile browsers may aggressively kill WebSocket connections when the app is backgrounded. The polling fallback handles this gracefully.
- **No offline support:** All data requires API connectivity. No service worker caching.
