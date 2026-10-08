// Polling only: never retries a trading mutation.
export function brokerPollInterval(error:unknown, normal:number){
 const message=error instanceof Error?error.message:String(error??"");
 return /TOO_MANY_REQUESTS|rate.?limit|\b429\b/i.test(message)?Math.max(normal,300_000):normal;
}
