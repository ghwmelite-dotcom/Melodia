import { Hono } from "hono";
import type { Env, Variables } from "../types.js";
import { errorResponse } from "../middleware/error-handler.js";

const playlists = new Hono<{ Bindings: Env; Variables: Variables }>();
playlists.all("/*", (c) => errorResponse(c, "NOT_IMPLEMENTED", "Playlists API coming in Sub-project 4"));
export default playlists;
