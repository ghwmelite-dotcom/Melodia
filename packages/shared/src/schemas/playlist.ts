import * as v from "valibot";

export const CreatePlaylistSchema = v.object({
  title: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  description: v.optional(v.pipe(v.string(), v.maxLength(500))),
});
export type CreatePlaylistInput = v.InferInput<typeof CreatePlaylistSchema>;
