import { z } from "zod";

export const schema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
});

export type OutputType = never;

