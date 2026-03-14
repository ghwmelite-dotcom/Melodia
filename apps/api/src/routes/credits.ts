import { Hono } from "hono";
import type { Env, Variables } from "../types.js";
import { authGuard } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import { creditQueries } from "../db/queries.js";

type HonoContext = { Bindings: Env; Variables: Variables };

const credits = new Hono<HonoContext>();

credits.use("/*", authGuard());

// GET / — return credit balance
credits.get("/", async (c) => {
  const userId = c.get("userId");

  const balance = await creditQueries.getBalance(c.env.DB, userId);
  if (!balance) {
    throw new AppError("NOT_FOUND", "User not found.", 404);
  }

  return c.json({ success: true, data: balance });
});

// GET /history — return transaction history
credits.get("/history", async (c) => {
  const userId = c.get("userId");

  const url = new URL(c.req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const result = await creditQueries.getHistory(c.env.DB, userId, limit, offset);

  return c.json({ success: true, data: result.results, meta: { limit, offset } });
});

export default credits;
