import { z } from "zod";
export const schema=z.object({dryRun:z.boolean().default(true)}).strict();
export type OutputType={status:string;message:string;action?:unknown;checkedAt:string};
