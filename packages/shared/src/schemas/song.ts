import * as v from "valibot";
import { SONG_STATUSES } from "../constants.js";

export const SongSchema = v.object({
  id: v.string(),
  user_id: v.string(),
  title: v.string(),
  status: v.picklist(SONG_STATUSES),
  user_prompt: v.string(),
  genre: v.nullable(v.string()),
  sub_genre: v.nullable(v.string()),
  mood: v.nullable(v.string()),
  bpm: v.nullable(v.number()),
  duration_seconds: v.number(),
  audio_url: v.nullable(v.string()),
  artwork_url: v.nullable(v.string()),
  is_public: v.boolean(),
  play_count: v.number(),
  like_count: v.number(),
  created_at: v.string(),
});
export type Song = v.InferOutput<typeof SongSchema>;
