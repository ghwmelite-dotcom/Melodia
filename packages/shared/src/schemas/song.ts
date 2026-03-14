import * as v from "valibot";
import { SONG_STATUSES } from "../constants.js";

// Input for song generation
export const GenerateSongSchema = v.object({
  prompt: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
  genre: v.optional(v.string()),
  mood: v.optional(v.string()),
  language: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(5))),
  duration: v.optional(v.pipe(v.number(), v.minValue(30), v.maxValue(600))),
});
export type GenerateSongInput = v.InferInput<typeof GenerateSongSchema>;

// Standalone lyrics generation
export const GenerateLyricsSchema = v.object({
  prompt: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
  genre: v.optional(v.string()),
  mood: v.optional(v.string()),
});
export type GenerateLyricsInput = v.InferInput<typeof GenerateLyricsSchema>;

// Lyrics refinement
export const RefineLyricsSchema = v.object({
  lyrics: v.pipe(v.string(), v.minLength(1), v.maxLength(10000)),
  genre: v.optional(v.string()),
  mood: v.optional(v.string()),
});
export type RefineLyricsInput = v.InferInput<typeof RefineLyricsSchema>;

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

export const SongDetailSchema = v.object({
  ...SongSchema.entries,
  lyrics: v.nullable(v.string()),
  lyrics_structured: v.nullable(v.string()),
  style_tags: v.nullable(v.string()),
  key_signature: v.nullable(v.string()),
  time_signature: v.nullable(v.string()),
  vocal_style: v.nullable(v.string()),
  vocal_language: v.nullable(v.string()),
  instruments: v.nullable(v.string()),
  artwork_prompt: v.nullable(v.string()),
  waveform_url: v.nullable(v.string()),
  stems_url: v.nullable(v.string()),
  ace_step_seed: v.nullable(v.number()),
  ace_step_model: v.nullable(v.string()),
  generation_started_at: v.nullable(v.string()),
  generation_completed_at: v.nullable(v.string()),
});
export type SongDetail = v.InferOutput<typeof SongDetailSchema>;
