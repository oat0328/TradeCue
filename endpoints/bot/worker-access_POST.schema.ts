import { z } from "zod";
export const schema=z.object({action:z.enum(["issue","revoke"]),paperExecutionEnabled:z.boolean().default(false)}).strict();
export type OutputType={enabled:boolean;paperExecutionEnabled:boolean;token?:string};
