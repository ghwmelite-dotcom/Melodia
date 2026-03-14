# Sub-project 4: Public, Explore & Social — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Melodia social — users can publish songs, browse public music via an explore page (New/Popular/Genre tabs), like songs, view public profiles, and see their liked songs.

**Architecture:** Add public-facing API routes (explore, profiles) alongside protected social routes (likes, publish). Refactor songs.ts from blanket auth to per-route auth with a new `optionalAuthGuard`. Frontend adds Explore page, Profile page, LikeButton, and updates to Library/SongView/SongCard.

**Tech Stack:** Hono (per-route middleware), D1 (JOINs for explore), KV (play count dedup), React, Tailwind CSS, `@melodia/shared` types

**Spec:** `docs/superpowers/specs/2026-03-14-melodia-subproject4-explore-social-design.md`

---

## Chunk 1: Backend — Schema, Middleware, Queries, Routes

### Task 1: Schema Migration + Shared Package Extensions

**Files:**
- Modify: `apps/api/src/db/schema.sql`
- Modify: `packages/shared/src/schemas/song.ts`
- Modify: `packages/shared/src/schemas/user.ts`

- [ ] **Step 1: Add new indexes to schema.sql**

Append to the indexes section:

```sql
-- Sub-project 4 indexes
CREATE INDEX IF NOT EXISTS idx_song_likes_user ON song_likes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_public_new ON songs(is_public, id DESC);
CREATE INDEX IF NOT EXISTS idx_songs_public_genre ON songs(is_public, genre, play_count DESC);
```

- [ ] **Step 2: Add shared types**

Add to `packages/shared/src/schemas/song.ts`:

```typescript
export const SongWithCreatorSchema = v.object({
  ...SongSchema.entries,
  creator_username: v.string(),
  is_liked: v.optional(v.boolean()),
  play_count: v.number(),
});
export type SongWithCreator = v.InferOutput<typeof SongWithCreatorSchema>;

export const UpdateSongSchema = v.object({
  is_public: v.optional(v.boolean()),
  title: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
});
export type UpdateSongInput = v.InferInput<typeof UpdateSongSchema>;
```

Add to `packages/shared/src/schemas/user.ts`:

```typescript
export const UserProfileSchema = v.object({
  username: v.string(),
  display_name: v.nullable(v.string()),
  avatar_url: v.nullable(v.string()),
  created_at: v.string(),
  song_count: v.number(),
});
export type UserProfile = v.InferOutput<typeof UserProfileSchema>;
```

Ensure all new types are exported from `packages/shared/src/index.ts`.

- [ ] **Step 3: Re-run local migration**

```bash
cd apps/api && npx wrangler d1 execute melodia-db --local --file=src/db/schema.sql
```

- [ ] **Step 4: Verify typecheck**

```bash
npm run typecheck -w packages/shared
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/ apps/api/src/db/schema.sql
git commit -m "feat: add explore indexes, SongWithCreator/UserProfile/UpdateSong shared types"
```

---

### Task 2: optionalAuthGuard Middleware

**Files:**
- Modify: `apps/api/src/middleware/auth.ts`

- [ ] **Step 1: Add optionalAuthGuard to existing auth.ts**

Read the existing `auth.ts` file. Add a new exported function alongside the existing `authGuard`:

```typescript
export function optionalAuthGuard() {
  return async (
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: Next
  ) => {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const payload = await verifyJwt(authHeader.slice(7), c.env.JWT_SECRET);
        c.set("userId", payload.sub);
      } catch {
        // Invalid token — continue as unauthenticated
      }
    }
    await next();
  };
}
```

This attaches `userId` if a valid token is present but doesn't reject unauthenticated requests.

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck -w apps/api
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/middleware/auth.ts
git commit -m "feat(api): add optionalAuthGuard middleware for public+auth endpoints"
```

---

### Task 3: Query Helpers — Explore, Like, Profile, Play Count

**Files:**
- Modify: `apps/api/src/db/queries.ts`

- [ ] **Step 1: Add explore, like, profile, and song update queries**

Read existing `queries.ts`. Add these new query namespaces:

**exploreQueries:**
- `newSongs(db, { limit, cursor?, genre? })` — SELECT songs.*, users.username as creator_username FROM songs JOIN users WHERE is_public = 1, optional genre filter, cursor pagination (id < cursor), ORDER BY id DESC
- `popularSongs(db, { limit, offset, genre? })` — Same JOIN, ORDER BY play_count DESC, id DESC, LIMIT/OFFSET pagination

**likeQueries:**
- `like(db, userId, songId)` — db.batch: INSERT OR IGNORE song_likes + UPDATE songs like_count + 1
- `unlike(db, userId, songId)` — DELETE from song_likes, return result
- `decrementLikeCount(db, songId)` — UPDATE songs like_count - 1
- `isLiked(db, userId, songId)` — SELECT 1 FROM song_likes
- `likedSongs(db, userId, { limit, offset })` — JOIN song_likes with songs, ORDER BY song_likes.created_at DESC

**profileQueries:**
- `findByUsername(db, username)` — SELECT public fields (username, display_name, avatar_url, created_at) from users
- `countPublicSongs(db, userId)` — SELECT COUNT(*) from songs WHERE user_id AND is_public = 1
- `publicSongs(db, userId, { limit, cursor? })` — SELECT * FROM songs WHERE user_id AND is_public = 1, cursor pagination

**Add to existing songQueries:**
- `update(db, id, fields: { is_public?, title? })` — dynamic SET with updated_at
- `incrementPlayCount(db, id)` — UPDATE play_count + 1
- `findByIdPublic(db, id)` — SELECT * FROM songs WHERE id = ? (no user filter, for public access)

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck -w apps/api
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/queries.ts
git commit -m "feat(api): add explore, like, profile, and play count query helpers"
```

---

### Task 4: Songs Routes — Refactor Auth + Add New Endpoints

**Files:**
- Modify: `apps/api/src/routes/songs.ts`

- [ ] **Step 1: Refactor songs.ts**

This is the most complex task. Read the existing `songs.ts` carefully. Make these changes:

**1. Remove blanket `songs.use("/*", authGuard())`** — replace with per-route middleware.

**2. Register named routes BEFORE /:id wildcard** (critical for Hono routing):

```
// Public routes (no auth or optional auth)
songs.get("/explore", ...)                    // BEFORE /:id
songs.get("/liked", authGuard(), ...)         // BEFORE /:id (protected)

// Optionally authenticated routes
songs.get("/:id", optionalAuthGuard(), ...)   // After named routes
songs.get("/:id/stream", optionalAuthGuard(), ...)

// Protected routes
songs.post("/generate", authGuard(), ...)
songs.get("/", authGuard(), ...)              // User's own songs
songs.put("/:id", authGuard(), ...)
songs.post("/:id/like", authGuard(), ...)
songs.delete("/:id/like", authGuard(), ...)
songs.delete("/:id", authGuard(), ...)
```

**3. New endpoints:**

**GET /explore:** Parse query params (tab, genre, limit, cursor/offset). Call exploreQueries.newSongs or popularSongs. Return `{ songs: [...], next_cursor }`.

**GET /liked:** Call likeQueries.likedSongs with userId, return `{ songs: [...] }`. Uses offset pagination (page query param).

**PUT /:id:** Validate with UpdateSongSchema. Verify ownership. Validate at least one field provided. Call songQueries.update. Return updated song.

**POST /:id/like:** Verify song exists (findByIdPublic), is_public = 1, userId !== song.user_id. Call likeQueries.like (batch). Return `{ liked: true, like_count }`.

**DELETE /:id/like:** Call likeQueries.unlike, check meta.changes, call decrementLikeCount if deleted. Return `{ liked: false, like_count }`.

**4. Modify GET /:id:** Use `findByIdPublic` instead of `findByIdAndUser`. Check access: if not public AND not owner → 404. If authenticated, check `isLiked`. Return song with `is_liked`.

**5. Modify GET /:id/stream:** Use `findByIdPublic`. Check access: if not public AND not owner → 403. Add play count tracking: if authenticated, check KV `played:{userId}:{songId}`, if null → put with 3600 TTL + incrementPlayCount. Fire-and-forget (don't await the KV/D1 calls, use `c.executionContext.waitUntil()` or just don't block).

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck -w apps/api
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/songs.ts
git commit -m "feat(api): refactor songs auth to per-route, add explore/like/publish/play-count endpoints"
```

---

### Task 5: Users Routes — Replace Stub

**Files:**
- Replace: `apps/api/src/routes/users.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Replace users.ts stub with public profile routes**

No auth required on any of these routes:

**GET /:username:** Call profileQueries.findByUsername. If not found → 404. Call profileQueries.countPublicSongs. Return `{ username, display_name, avatar_url, created_at, song_count }`.

**GET /:username/songs:** Call profileQueries.findByUsername (to get user_id). Call profileQueries.publicSongs with cursor pagination. Return `{ songs: [...], next_cursor }`.

- [ ] **Step 2: Update index.ts — remove auth from users route**

The current `index.ts` mounts users routes. Verify it's mounted without blanket auth (check current mount — the users route was a stub, it may already be auth-free or may need the mount to be outside any auth middleware).

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck -w apps/api
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/users.ts apps/api/src/index.ts
git commit -m "feat(api): replace users stub with public profile and songs endpoints"
```

---

## Chunk 2: Frontend — Components, Pages, Integration

### Task 6: LikeButton Component + useSongs Extensions

**Files:**
- Create: `apps/web/src/components/song/LikeButton.tsx`
- Modify: `apps/web/src/hooks/useSongs.ts`

- [ ] **Step 1: Create LikeButton**

Props: `songId: string`, `initialLiked: boolean`, `initialCount: number`

- Heart icon (SVG or emoji): filled coral when liked, outline gray when not
- Optimistic toggle: update local state immediately on click, call API, revert on error
- Shows count next to heart
- If not authenticated (check `useAuth().isAuthenticated`): navigate to `/login` on click
- Prevent event bubbling (stopPropagation) so clicking like doesn't navigate the parent card link
- Compact styling: inline-flex, gap-1, text-sm

- [ ] **Step 2: Extend useSongs hook**

Add new methods:

```typescript
exploreSongs: (opts) => api.get(`/songs/explore?${params}`),
likeSong: (songId) => api.post(`/songs/${songId}/like`),
unlikeSong: (songId) => api.delete(`/songs/${songId}/like`),
likedSongs: (opts) => api.get(`/songs/liked?${params}`),
getProfile: (username) => api.get(`/users/${username}`),
getProfileSongs: (username, opts) => api.get(`/users/${username}/songs?${params}`),
updateSong: (id, fields) => api.put(`/songs/${id}`, fields),
```

Note: Some of these call `/users/` endpoints. That's fine — useSongs is the general data hook, not tied to one API prefix.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/song/LikeButton.tsx apps/web/src/hooks/useSongs.ts
git commit -m "feat(web): add LikeButton component and explore/like/profile methods to useSongs"
```

---

### Task 7: SongCard + SongView Updates

**Files:**
- Modify: `apps/web/src/components/song/SongCard.tsx`
- Modify: `apps/web/src/pages/SongView.tsx`

- [ ] **Step 1: Update SongCard**

Read existing SongCard. Add optional props:
- `creatorUsername?: string` — renders "by @username" as a Link to `/profile/:username`
- `likeCount?: number` + `playCount?: number` — renders with heart/play icons
- `isLiked?: boolean` + `songId?: string` — renders LikeButton when songId provided
- `showSocialStats?: boolean` — toggles the social info display (false for Library, true for Explore)

- [ ] **Step 2: Update SongView**

Read existing SongView. In the completed mode, add:
- `LikeButton` in the header area (only if song is not owned by current user, and song is public)
- Publish toggle: button/switch that calls `useSongs().updateSong(id, { is_public: !current })`, updates local state
- Badge next to title: "Public" (teal bg) or "Private" (gray bg), only shown for owner

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/song/SongCard.tsx apps/web/src/pages/SongView.tsx
git commit -m "feat(web): add social stats to SongCard and publish/like to SongView"
```

---

### Task 8: GenreGrid Component

**Files:**
- Create: `apps/web/src/components/explore/GenreGrid.tsx`

- [ ] **Step 1: Create GenreGrid**

Props: `onSelectGenre: (genre: string) => void`

Responsive grid of genre cards. Each card:
- Genre-appropriate gradient background (reuse the gradient logic from SongCard's placeholder)
- Genre name centered in bold white text, text-shadow for readability
- Click calls `onSelectGenre(genre)`
- Responsive: 2 cols mobile, 3 cols tablet, 4 cols desktop
- African genres first, then alphabetical (same grouping as GenreSelector)
- Card style: `rounded-2xl h-24 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform`

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/explore/GenreGrid.tsx
git commit -m "feat(web): add GenreGrid component for explore genre browsing"
```

---

### Task 9: Explore Page

**Files:**
- Create: `apps/web/src/pages/Explore.tsx`

- [ ] **Step 1: Create Explore page**

Tabbed page at `/explore` with three tabs: New, Popular, Genre.

State: `activeTab` ("new" | "popular" | "genre"), `selectedGenre` (for genre tab), `songs`, `nextCursor`/`page`, `loading`

**Tab bar:** Three buttons, active tab has amber underline/background. Matches the design system.

**New tab:** Fetch `exploreSongs({ tab: "new", cursor })`. Render SongCards in a vertical feed (responsive grid). Show creator username, like/play counts, LikeButton. Infinite scroll with IntersectionObserver (same pattern as Library).

**Popular tab:** Fetch `exploreSongs({ tab: "popular", offset: page * 20 })`. Same card layout. Show play count prominently. Pagination via "Load More" button (offset-based, not infinite scroll — since popular rankings are stable).

**Genre tab:** Initially shows `GenreGrid`. When a genre is selected, shows song feed filtered by that genre with a "Back to Genres" button. Fetch `exploreSongs({ tab: "genre", genre: selectedGenre })`.

**No auth required:** The page works for unauthenticated users. LikeButton redirects to login if not authenticated.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/Explore.tsx
git commit -m "feat(web): add Explore page with New/Popular/Genre tabs"
```

---

### Task 10: Profile Page

**Files:**
- Create: `apps/web/src/pages/Profile.tsx`

- [ ] **Step 1: Create Profile page**

Public page at `/profile/:username`.

- Fetch profile via `useSongs().getProfile(username)`
- Fetch songs via `useSongs().getProfileSongs(username)`
- Header: avatar circle (80x80, fallback to first letter on gradient), username, "Joined [month year]", "[N] songs"
- Songs grid: responsive SongCard grid (same as Library grid view)
- Infinite scroll for songs
- 404 state: "User not found" message
- Loading state: spinner

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/Profile.tsx
git commit -m "feat(web): add public Profile page with user info and songs"
```

---

### Task 11: Library Update + Routes + Nav

**Files:**
- Modify: `apps/web/src/pages/Library.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/Layout.tsx`

- [ ] **Step 1: Update Library with "Liked" filter**

Read existing Library.tsx. Add "Liked" to the status filter options: All, Completed, Failed, Liked.

When "Liked" is selected:
- Fetch from `useSongs().likedSongs()` instead of `listSongs()`
- Show these as regular SongCards/SongRows (they're other users' songs)
- Pagination may use offset instead of cursor (since liked endpoint uses offset)

- [ ] **Step 2: Add routes to App.tsx**

Add `/explore` and `/profile/:username` as lazy-loaded routes. These are PUBLIC routes — render inside `Layout` but outside `AuthGuard`:

```typescript
// Public routes with Layout (nav shows, login CTA if not authed)
<Route element={<Layout />}>
  <Route path="/explore" element={<Explore />} />
  <Route path="/profile/:username" element={<Profile />} />
</Route>
```

This means Layout needs to handle the case where `useAuth().isAuthenticated` is false — show "Sign In" button instead of username/logout.

- [ ] **Step 3: Update Layout.tsx**

Add "Explore" nav link. Update nav to handle unauthenticated state:
- Authenticated: Studio | Library | Explore | Dashboard | Settings | [username] | Logout
- Unauthenticated: Explore | Sign In | Get Started

- [ ] **Step 4: Verify build**

```bash
npm run typecheck -w apps/web
npm run build -w apps/web
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/Library.tsx apps/web/src/App.tsx apps/web/src/components/Layout.tsx
git commit -m "feat(web): add Liked filter to Library, public routes, Explore nav link"
```

---

### Task 12: Integration Test + Push

- [ ] **Step 1: Re-run D1 migration**

```bash
cd apps/api && npx wrangler d1 execute melodia-db --local --file=src/db/schema.sql
```

- [ ] **Step 2: Start API and test backend endpoints**

```bash
npx wrangler dev --port 8787
```

Test in another terminal:

1. Register + login to get token
2. Generate a song (POST /api/songs/generate)
3. Wait for completion, then publish: `PUT /api/songs/:id` with `{ "is_public": true }`
4. Browse explore: `GET /api/songs/explore?tab=new` (no auth) — should see the published song
5. Like the song from a second user (register another, then POST /api/songs/:id/like)
6. Check liked songs: `GET /api/songs/liked`
7. View profile: `GET /api/users/:username`
8. View profile songs: `GET /api/users/:username/songs`

- [ ] **Step 3: Verify frontend build**

```bash
npm run build -w apps/web
```

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "chore: verify Sub-project 4 integration"
git push
```

---

**End of plan. Total: 12 tasks across 2 chunks.**
