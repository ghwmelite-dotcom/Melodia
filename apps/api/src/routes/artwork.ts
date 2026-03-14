import { Hono } from "hono";
import type { Env, Variables } from "../types.js";
import { errorResponse } from "../middleware/error-handler.js";

const artwork = new Hono<{ Bindings: Env; Variables: Variables }>();
artwork.all("/*", (c) => errorResponse(c, "NOT_IMPLEMENTED", "Artwork API coming in Sub-project 2"));
export default artwork;
