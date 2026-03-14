import { Hono } from "hono";
import type { Env, Variables } from "../types.js";
import { AppError } from "../middleware/error-handler.js";
import { profileQueries } from "../db/queries.js";

type HonoContext = { Bindings: Env; Variables: Variables };

const users = new Hono<HonoContext>();

// ----------------------------------------------------------------------------
// GET /:username  — public user profile
// ----------------------------------------------------------------------------
users.get("/:username", async (c) => {
  const { username } = c.req.param();

  const user = (await profileQueries.findByUsername(c.env.DB, username)) as {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: string;
  } | null;

  if (!user) {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }

  const countResult = await profileQueries.countPublicSongs(
    c.env.DB,
    user.id
  );
  const song_count = countResult?.count ?? 0;

  return c.json({
    success: true,
    profile: {
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      song_count,
    },
  });
});

// ----------------------------------------------------------------------------
// GET /:username/songs  — paginated public songs for a profile
// ----------------------------------------------------------------------------
users.get("/:username/songs", async (c) => {
  const { username } = c.req.param();
  const { limit: limitStr, cursor } = c.req.query();

  const limit = Math.min(parseInt(limitStr ?? "20", 10) || 20, 50);

  const user = (await profileQueries.findByUsername(c.env.DB, username)) as {
    id: string;
  } | null;

  if (!user) {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }

  const result = await profileQueries.publicSongs(c.env.DB, user.id, {
    limit,
    cursor: cursor || undefined,
  });

  const results = (result.results ?? []) as Record<string, unknown>[];

  let next_cursor: string | null = null;
  if (results.length > limit) {
    const lastItem = results.pop();
    next_cursor = (lastItem?.id as string) ?? null;
  }

  return c.json({ success: true, songs: results, next_cursor });
});

export default users;
