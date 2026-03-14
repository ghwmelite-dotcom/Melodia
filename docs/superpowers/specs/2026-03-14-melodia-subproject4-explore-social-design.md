# Melodia — Sub-project 4: Public, Explore & Social

**Date:** 2026-03-14
**Status:** Draft
**Scope:** Public song sharing, explore page (New/Popular/Genre tabs), public user profiles, like system with liked songs list, play count tracking

---

## 1. Context

Sub-projects 1-3 built the private creation experience: auth, song generation pipeline, and studio UI. Sub-project 4 makes Melodia social — users can publish songs, browse others' music, like songs, and view artist profiles.

**Dependencies:**
- D1 schema: `songs.is_public`, `songs.play_count`, `songs.like_count`, `song_likes` table, `users` table — all already exist
- Songs routes (Sub-project 2-3): CRUD, streaming
- Frontend: SongCard, SongRow, Library page, SongView page, Layout nav
- Auth: useAuth hook, authGuard middleware, API client

---

## 2. Technology Decisions

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Play count dedup | KV with 1-hour TTL | Prevents spam, simple, no new tables |
| Like UI | Optimistic updates | Instant feel, revert on API error |
| Explore pagination | Cursor-based (ULID) | Consistent with existing Library pattern |
| Public routes | No auth required for reading | Explore and profiles are public discovery |

---

## 3. New & Modified Files

### Backend

```
apps/api/src/
├── routes/
│   ├── songs.ts        # MODIFY: remove blanket authGuard, add per-route auth, add PUT /:id, like/unlike, liked list, play tracking. Named routes (/explore, /liked) registered BEFORE /:id wildcard.
│   ├── users.ts        # REPLACE stub: public profile + public songs (no auth required)
├── middleware/
│   └── auth.ts         # MODIFY: add optionalAuthGuard() that attaches userId if token present but doesn't reject unauthenticated requests
├── db/
│   ├── queries.ts      # EXTEND: explore, like, profile, play count queries
│   └── schema.sql      # MODIFY: add new indexes for explore/like queries
└── index.ts            # MODIFY: mount users route as public (no auth)
```

**Key structural change — songs.ts auth refactor:**
The current `songs.ts` applies `songs.use("/*", authGuard())` globally. This must be changed to per-route auth:
- Public routes (no auth): `GET /explore`, `GET /:id` (public songs), `GET /:id/stream` (public songs)
- Protected routes (authGuard): `POST /generate`, `GET /` (user's own songs), `GET /liked`, `POST /:id/like`, `DELETE /:id/like`, `PUT /:id`, `DELETE /:id`
- Optionally authenticated: `GET /:id` (returns `is_liked` when auth present), `GET /:id/stream` (tracks play count when auth present)

**Route ordering in songs.ts (CRITICAL):**
Named routes must be registered BEFORE `/:id` wildcard to prevent Hono matching "explore" or "liked" as a song ID:
```
songs.get("/explore", ...)      // First
songs.get("/liked", ...)        // Second
songs.get("/:id", ...)          // After named routes
songs.get("/:id/stream", ...)   // After named routes
```

### Frontend

```
apps/web/src/
├── pages/
│   ├── Explore.tsx         # NEW: tabbed explore page
│   ├── Profile.tsx         # NEW: public user profile
│   ├── Library.tsx         # MODIFY: add "Liked" filter
│   └── SongView.tsx        # MODIFY: add LikeButton + publish toggle
├── components/
│   ├── song/
│   │   ├── SongCard.tsx    # MODIFY: add like count + creator name
│   │   └── LikeButton.tsx  # NEW: heart toggle with count
│   └── explore/
│       └── GenreGrid.tsx   # NEW: genre card grid
├── hooks/
│   └── useSongs.ts         # MODIFY: add like, unlike, explore, profile methods
├── components/
│   └── Layout.tsx          # MODIFY: add Explore nav link
└── App.tsx                 # MODIFY: add /explore and /profile/:username routes
```

---

## 4. API Routes

### 4.1 Public Routes (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/songs/explore` | Browse public songs |
| GET | `/api/users/:username` | Public user profile |
| GET | `/api/users/:username/songs` | User's public songs (paginated) |

### 4.2 Protected Routes (auth required)

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/api/songs/:id` | Update song (toggle is_public, edit title) |
| POST | `/api/songs/:id/like` | Like a public song |
| DELETE | `/api/songs/:id/like` | Unlike a song |
| GET | `/api/songs/liked` | List current user's liked songs (paginated) |

### 4.3 Modified Routes

| Route | Change |
|-------|--------|
| `GET /api/songs/:id/stream` | Allow non-owners to stream public songs. Add play count tracking (KV dedup + D1 increment) for authenticated users. |
| `GET /api/songs/:id` | Allow unauthenticated access for public songs. Add `is_liked` boolean when authenticated (via `optionalAuthGuard`). |

### 4.3.1 New Middleware: `optionalAuthGuard`

Add to `apps/api/src/middleware/auth.ts`:

```typescript
export function optionalAuthGuard() {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const payload = await verifyJwt(authHeader.slice(7), c.env.JWT_SECRET);
        c.set("userId", payload.sub);
      } catch {
        // Invalid token — continue as unauthenticated (don't reject)
      }
    }
    await next();
  };
}
```

Used on `GET /api/songs/:id` and `GET /api/songs/:id/stream` to optionally identify the user without requiring auth.

### 4.3.2 Public Song Streaming

The stream endpoint changes from "owner only" to "owner OR public song":

```
GET /api/songs/:id/stream (optionalAuthGuard)
  → Fetch song by ID (not by user+id)
  → If song not found: 404
  → If song.is_public = 0 AND (no auth OR userId !== song.user_id): 403
  → If song.is_public = 1 OR userId === song.user_id: allow streaming
  → If authenticated: track play count via KV dedup
  → Stream audio from R2
```

Similarly, `GET /api/songs/:id` becomes:
```
  → Fetch song by ID
  → If song.is_public = 0 AND (no auth OR userId !== song.user_id): 404
  → If authenticated: check is_liked from song_likes
  → Return song detail with is_liked
```

### 4.4 Explore Endpoint

```
GET /api/songs/explore?tab=new&genre=afrobeats&limit=20&cursor=<ulid>

Parameters:
  tab: "new" (default) | "popular" | "genre"
  genre: string (optional, required when tab=genre)
  limit: number (1-50, default 20)
  cursor: string (ULID for pagination)

Queries:
  tab=new     → WHERE is_public = 1 ORDER BY id DESC
  tab=popular → WHERE is_public = 1 ORDER BY play_count DESC, id DESC
  tab=genre   → WHERE is_public = 1 AND genre = ? ORDER BY play_count DESC, id DESC
```

Response includes song data plus creator info (`username` from users table via JOIN).

### 4.5 User Profile Endpoint

```
GET /api/users/:username

Response: {
  success: true,
  data: {
    username: string,
    display_name: string | null,
    avatar_url: string | null,
    created_at: string,
    song_count: number    // count of public songs
  }
}
```

Returns only public-safe fields. Never exposes email, phone, plan, credits, or auth method.

### 4.6 User Public Songs Endpoint

```
GET /api/users/:username/songs?limit=20&cursor=<ulid>

Response: {
  success: true,
  songs: Song[],          // Only is_public = 1 songs
  next_cursor: string | null
}
```

### 4.7 Like/Unlike Endpoints

```
POST /api/songs/:id/like
  → Verify song exists and is_public = 1
  → Verify userId !== song.user_id (cannot like your own song — return 400)
  → INSERT OR IGNORE into song_likes + UPDATE like_count atomically via db.batch()
  → Return { liked: true, like_count: number }

DELETE /api/songs/:id/like
  → DELETE FROM song_likes WHERE user_id = ? AND song_id = ?
  → If meta.changes === 1: UPDATE songs SET like_count = like_count - 1
  → Return { liked: false, like_count: number }
```

### 4.8 Liked Songs Endpoint

```
GET /api/songs/liked?limit=20&cursor=<ulid>

  → SELECT songs.* FROM song_likes
    JOIN songs ON songs.id = song_likes.song_id
    WHERE song_likes.user_id = ?
    ORDER BY song_likes.created_at DESC
    LIMIT ? OFFSET via cursor
```

### 4.9 Update Song Endpoint

```
PUT /api/songs/:id
  Body: { is_public?: boolean, title?: string }
  → Verify ownership
  → Update specified fields + updated_at
  → Return updated song
```

### 4.10 Play Count Tracking

On `GET /api/songs/:id/stream` (existing endpoint), add before streaming:

```
  → If user is authenticated:
    → KV key: played:{userId}:{songId}
    → If KV.get(key) is null:
      → KV.put(key, "1", { expirationTtl: 3600 })
      → UPDATE songs SET play_count = play_count + 1 WHERE id = ?
  → Continue with existing stream logic
```

Play count increment is fire-and-forget — don't block the stream response on it.

### 4.11 Song Detail Enhancement

On `GET /api/songs/:id`, if the request has a valid auth token (optional — don't require auth):

```
  → If authenticated:
    → Check song_likes for (userId, songId)
    → Include is_liked: boolean in response
  → If not authenticated:
    → is_liked: false
```

This means the song detail endpoint becomes optionally authenticated — it works for both public browsing (no auth) and authenticated viewing (with like status).

---

## 5. Query Helpers

### 5.1 Explore Queries

```typescript
export const exploreQueries = {
  newSongs: (db, { limit, cursor, genre? }) =>
    // SELECT songs.*, users.username as creator_username
    // FROM songs JOIN users ON songs.user_id = users.id
    // WHERE is_public = 1 [AND genre = ?] [AND songs.id < cursor]
    // ORDER BY songs.id DESC LIMIT ?
    // Cursor: ULID-based (standard cursor pagination)

  popularSongs: (db, { limit, offset, genre? }) =>
    // SELECT songs.*, users.username as creator_username
    // FROM songs JOIN users ON songs.user_id = users.id
    // WHERE is_public = 1 [AND genre = ?]
    // ORDER BY play_count DESC, songs.id DESC
    // LIMIT ? OFFSET ?
    // NOTE: Popular tab uses OFFSET pagination (not cursor) because
    // cursor-based pagination on non-unique sort columns (play_count)
    // requires complex composite cursors. OFFSET is acceptable here
    // since popular songs change slowly and deep pagination is rare.
};
```

### 5.2 Like Queries

```typescript
export const likeQueries = {
  // Like — use db.batch for atomicity (INSERT + UPDATE like_count)
  like: (db, userId, songId) =>
    db.batch([
      db.prepare("INSERT OR IGNORE INTO song_likes (user_id, song_id) VALUES (?, ?)").bind(userId, songId),
      db.prepare("UPDATE songs SET like_count = like_count + 1, updated_at = datetime('now') WHERE id = ?").bind(songId),
    ]),

  // Unlike — check deletion happened before decrementing
  unlike: (db, userId, songId) =>
    db.prepare("DELETE FROM song_likes WHERE user_id = ? AND song_id = ?").bind(userId, songId).run(),
  // Caller checks meta.changes === 1 before calling decrementLikeCount

  decrementLikeCount: (db, songId) =>
    db.prepare("UPDATE songs SET like_count = like_count - 1, updated_at = datetime('now') WHERE id = ?").bind(songId).run(),

  isLiked: (db, userId, songId) =>
    db.prepare("SELECT 1 as liked FROM song_likes WHERE user_id = ? AND song_id = ?").bind(userId, songId).first(),

  // Liked songs — paginated by song_likes.created_at DESC
  // Use ROWID-based offset since song_likes has no ULID id column
  likedSongs: (db, userId, { limit, offset }) =>
    db.prepare(
      `SELECT songs.* FROM song_likes
       JOIN songs ON songs.id = song_likes.song_id
       WHERE song_likes.user_id = ?
       ORDER BY song_likes.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(userId, limit, offset).all(),
};
```

### 5.3 Profile Queries

```typescript
export const profileQueries = {
  findByUsername: (db, username) =>
    // SELECT username, display_name, avatar_url, created_at FROM users WHERE username = ?
    // Plus: SELECT COUNT(*) as song_count FROM songs WHERE user_id = ? AND is_public = 1

  publicSongs: (db, userId, { limit, cursor }) =>
    // SELECT * FROM songs WHERE user_id = ? AND is_public = 1
    // ORDER BY id DESC, cursor-based
};
```

### 5.4 Song Update Queries

```typescript
export const songQueries = {
  // ... existing ...
  update: (db, id, fields: { is_public?: number; title?: string }) => ...,
  incrementPlayCount: (db, id) =>
    db.prepare("UPDATE songs SET play_count = play_count + 1 WHERE id = ?").bind(id).run(),
};
```

---

## 6. Frontend — Explore Page (`/explore`)

### 6.1 Layout

```
┌─────────────────────────────────────────────┐
│  Explore                                    │
│                                             │
│  [ New ]  [ Popular ]  [ Genre ]            │
│  ──────────────────────────────             │
│                                             │
│  (New tab — vertical song feed)             │
│  ┌─────────┐ Accra Nights                   │
│  │ ARTWORK │ by @testuser · Afrobeats       │
│  │         │ ♡ 12  ▶ 45  · 3:30            │
│  └─────────┘                                │
│                                             │
│  ┌─────────┐ Lagos Groove                   │
│  │ ARTWORK │ by @djmix · Hip-hop            │
│  │         │ ♡ 8   ▶ 23  · 2:45            │
│  └─────────┘                                │
│                                             │
│  (Genre tab — genre card grid)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Afrobeats│ │ Hip-hop  │ │ R&B      │    │
│  └──────────┘ └──────────┘ └──────────┘    │
└─────────────────────────────────────────────┘
```

### 6.2 Tab Behavior

- **New:** SongCard feed sorted by newest. Shows creator username linking to `/profile/:username`. Each card shows like count (heart icon) and play count (play icon).
- **Popular:** Same layout, sorted by play count. Play count displayed prominently.
- **Genre:** Shows `GenreGrid` — responsive grid of genre cards (gradient background + genre name). Click → switches to a song feed filtered by that genre with a back button.

### 6.3 GenreGrid Component

Responsive grid of genre cards. Each card:
- Genre-appropriate gradient background (reuse SongCard gradient logic)
- Genre name centered, bold white text
- Click → sets `genre` filter, switches to song feed view within the Genre tab

Genres shown: African genres first, then alphabetical (same ordering as GenreSelector).

### 6.4 Explore SongCard Variant

The existing `SongCard` needs these additions for explore:
- Creator username (with `@` prefix) linking to `/profile/:username`
- Like count with heart icon
- Play count with play icon
- Like button (if authenticated)

---

## 7. Frontend — Profile Page (`/profile/:username`)

```
┌─────────────────────────────────────────┐
│  [avatar circle]                        │
│  username                               │
│  Joined March 2026 · 12 songs          │
│                                         │
│  ── Public Songs ──                     │
│  [SongCard] [SongCard] [SongCard]       │
│  [SongCard] [SongCard] [SongCard]       │
└─────────────────────────────────────────┘
```

- Fetch profile via `GET /api/users/:username`
- Fetch songs via `GET /api/users/:username/songs`
- Responsive song grid (reuse SongCard)
- 404 if username not found
- Avatar: 80x80 circle, fallback to initials on gradient background
- Public route — accessible without login

---

## 8. Frontend — Component Updates

### 8.1 LikeButton Component

```typescript
type LikeButtonProps = {
  songId: string;
  initialLiked: boolean;
  initialCount: number;
};
```

- Heart icon: filled coral when liked, outline gray when not
- Click: optimistic toggle (update UI immediately), call like/unlike API
- On API error: revert to previous state, show brief error toast
- Shows count next to heart
- If not authenticated (useAuth): redirect to `/login` on click

### 8.2 SongCard Updates

Add optional props for explore context:
- `creatorUsername?: string` — shows "by @username" linking to profile
- `likeCount?: number` + `playCount?: number` — shown with icons
- `isLiked?: boolean` + `songId` — renders LikeButton when provided
- `linkTo?: string` — overrides default link destination. In Library context: `/studio/song/:id`. In Explore/Profile context: also `/studio/song/:id` (the SongView page will handle public songs correctly via the updated optionalAuth song detail endpoint).

### 8.3 SongView Updates

Add to completed mode:
- `LikeButton` in the song header (next to delete button)
- Publish toggle: switch or button that calls `PUT /api/songs/:id` with `{ is_public: !current }`
- Status badge: "Public" (teal) or "Private" (gray) next to title

### 8.4 Library Updates

Add "Liked" option to the status filter dropdown. When selected:
- Fetch from `GET /api/songs/liked` instead of `GET /api/songs`
- These are other users' songs that the current user has liked
- Same SongCard/SongRow rendering

### 8.5 Layout Nav Update

Add "Explore" to nav: `Studio | Library | Explore | Dashboard | Settings`

---

## 9. Hooks Update (useSongs)

Add methods to existing `useSongs` hook:

```typescript
// Explore
exploreSongs: (opts: { tab: string; genre?: string; cursor?: string }) => Promise<{ songs: SongWithCreator[]; next_cursor: string | null }>;

// Likes
likeSong: (songId: string) => Promise<{ liked: boolean; like_count: number }>;
unlikeSong: (songId: string) => Promise<{ liked: boolean; like_count: number }>;
likedSongs: (opts?: { cursor?: string }) => Promise<{ songs: Song[]; next_cursor: string | null }>;

// Profile
getProfile: (username: string) => Promise<UserProfile>;
getProfileSongs: (username: string, opts?: { cursor?: string }) => Promise<{ songs: Song[]; next_cursor: string | null }>;

// Update
updateSong: (id: string, fields: { is_public?: boolean; title?: string }) => Promise<SongDetail>;
```

---

## 10. Shared Package Extensions

Add to `packages/shared/src/schemas/song.ts`:

```typescript
// Song with creator info (for explore)
export const SongWithCreatorSchema = v.object({
  ...SongSchema.entries,
  creator_username: v.string(),
  is_liked: v.optional(v.boolean()),
});
export type SongWithCreator = v.InferOutput<typeof SongWithCreatorSchema>;

// User profile (public)
export const UserProfileSchema = v.object({
  username: v.string(),
  display_name: v.nullable(v.string()),
  avatar_url: v.nullable(v.string()),
  created_at: v.string(),
  song_count: v.number(),
});
export type UserProfile = v.InferOutput<typeof UserProfileSchema>;

// Song update input
export const UpdateSongSchema = v.object({
  is_public: v.optional(v.boolean()),
  title: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
});
export type UpdateSongInput = v.InferInput<typeof UpdateSongSchema>;
```

---

## 11. App.tsx Route Updates

```
// Public routes (no AuthGuard)
/explore                → Explore page
/profile/:username      → Profile page

// Protected routes (inside AuthGuard + Layout)
/studio, /studio/song/:id, /library, /dashboard, /settings  → existing
```

Note: `/explore` and `/profile/:username` are public — they render outside the `AuthGuard` wrapper but still inside `Layout` (so the nav bar shows, with login CTA if not authenticated).

---

## 12. Schema Migrations

Add new indexes to `apps/api/src/db/schema.sql`:

```sql
-- Sub-project 4 indexes
CREATE INDEX IF NOT EXISTS idx_song_likes_user ON song_likes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_public_new ON songs(is_public, id DESC);
CREATE INDEX IF NOT EXISTS idx_songs_public_genre ON songs(is_public, genre, play_count DESC);
```

These support:
- `idx_song_likes_user`: Liked songs query (user's liked songs ordered by recency)
- `idx_songs_public_new`: New tab on explore (public songs newest first)
- `idx_songs_public_genre`: Genre tab on explore (public songs by genre, sorted by popularity)

The existing `idx_songs_public` on `(is_public, play_count DESC)` covers the popular tab.

---

## 13. Out of Scope (Deferred)

- Vectorize embeddings / "songs like this" recommendations
- Social sharing (Open Graph meta tags, audio previews)
- Embed player (share songs on other sites)
- Follow/follower system
- Comments on songs
- User bio / social links on profile
- Audio download (MP3 transcoding needed)
- Song search (full-text)

## 13. Known Limitations

- **Play count accuracy:** KV-based dedup is per-user. Unauthenticated listens don't increment play count (stream endpoint requires auth).
- **Like count consistency:** `like_count` on songs table is denormalized. In edge cases (concurrent likes), the count could drift from the actual `song_likes` rows. Acceptable at early scale.
- **Popular tab pagination:** Cursor-based pagination on `play_count DESC` is imperfect when counts are equal (many songs with 0 plays). Using `play_count DESC, id DESC` as a composite sort handles this adequately.
- **No search:** Users discover songs only through explore tabs or direct profile links. Full-text search is deferred.
