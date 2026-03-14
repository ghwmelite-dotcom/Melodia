import { Hono } from "hono";
import * as v from "valibot";
import { UpdateProfileSchema } from "@melodia/shared";
import type { Env, Variables } from "../types.js";
import { authGuard } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import { userQueries } from "../db/queries.js";

type HonoContext = { Bindings: Env; Variables: Variables };

const settings = new Hono<HonoContext>();

settings.use("/*", authGuard());

// PUT / — update user profile
settings.put("/", async (c) => {
  const userId = c.get("userId");

  const body = await c.req.json().catch(() => {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON body", 400);
  });

  const result = v.safeParse(UpdateProfileSchema, body);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      result.issues.map((i) => i.message).join(", "),
      400
    );
  }

  const { username, display_name } = result.output;

  // Check username uniqueness if changing
  if (username !== undefined) {
    const existing = await userQueries.findByUsername(c.env.DB, username);
    if (existing && (existing as { id: string }).id !== userId) {
      throw new AppError("VALIDATION_ERROR", "Username is already taken.", 400);
    }
  }

  await userQueries.updateProfile(c.env.DB, userId, { username, display_name });

  const user = await userQueries.findById(c.env.DB, userId);
  if (!user) {
    throw new AppError("NOT_FOUND", "User not found.", 404);
  }

  // Strip sensitive fields before returning
  const { password_hash: _ph, google_id: _gi, ...safeUser } = user as Record<string, unknown>;

  return c.json({ success: true, user: safeUser });
});

export default settings;
