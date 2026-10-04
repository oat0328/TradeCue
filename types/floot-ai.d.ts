declare module "@floot/ai" {
  export class FlootAiOutOfCreditsError extends Error {}
  export class FlootAiRateLimitError extends Error {}
  export const flootAi: {
    chat(args: unknown): Promise<{output_text?: string | null}>;
  };
}
