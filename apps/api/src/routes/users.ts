import { Hono } from "hono";
import type { Env, Variables } from "../types.js";
import { errorResponse } from "../middleware/error-handler.js";

const users = new Hono<{ Bindings: Env; Variables: Variables }>();
users.all("/*", (c) => errorResponse(c, "NOT_IMPLEMENTED", "Users API coming in Sub-project 4"));
export default users;
