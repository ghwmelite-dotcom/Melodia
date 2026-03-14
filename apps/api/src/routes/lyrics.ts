import { Hono } from "hono";
import type { Env, Variables } from "../types.js";
import { errorResponse } from "../middleware/error-handler.js";

const lyrics = new Hono<{ Bindings: Env; Variables: Variables }>();
lyrics.all("/*", (c) => errorResponse(c, "NOT_IMPLEMENTED", "Lyrics API coming in Sub-project 2"));
export default lyrics;
