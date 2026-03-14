import * as v from "valibot";
import { PLANS, AUTH_METHODS } from "../constants.js";

export const UserSchema = v.object({
  id: v.string(),
  email: v.nullable(v.string()),
  phone: v.nullable(v.string()),
  username: v.string(),
  display_name: v.nullable(v.string()),
  avatar_url: v.nullable(v.string()),
  plan: v.picklist(PLANS),
  primary_auth_method: v.picklist(AUTH_METHODS),
  credits_remaining: v.number(),
  is_verified: v.boolean(),
  created_at: v.string(),
});
export type User = v.InferOutput<typeof UserSchema>;
