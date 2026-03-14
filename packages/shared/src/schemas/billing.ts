import * as v from "valibot";

export const SubscribeSchema = v.object({
  plan: v.picklist(["creator", "pro"]),
});
export type SubscribeInput = v.InferInput<typeof SubscribeSchema>;
