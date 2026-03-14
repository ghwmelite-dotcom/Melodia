import { Hono } from "hono";
import type { Env, Variables } from "../types.js";
import { errorResponse } from "../middleware/error-handler.js";

const songs = new Hono<{ Bindings: Env; Variables: Variables }>();
songs.all("/*", (c) => errorResponse(c, "NOT_IMPLEMENTED", "Songs API coming in Sub-project 2"));
export default songs;
