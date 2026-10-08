import superjson from "superjson";
import { getServerUserSession } from "./getServerUserSession";
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function apiUser(request: Request, admin = false) {
  if (request.method === "POST") {
    const origin = request.headers.get("origin");
    if (origin && !["https://gettradecue.com", "https://www.gettradecue.com", "https://cuetrade.floot.app", "https://68777a84-59fb-4e1d-8f5e-99e526f02f78.sandbox.floot.app", "https://floot.com"].includes(origin)) throw new ApiError(403, "Request origin not allowed");
  }
  let result; try { result = await getServerUserSession(request); } catch { throw new ApiError(401, "Sign in to continue"); }
  if (admin && result.user.role !== "admin") throw new ApiError(403, "Owner access required");
  return result.user;
}
export function apiJson(data: unknown, status = 200) { return new Response(superjson.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
export function apiFailure(error: unknown) {
  return apiJson({ error: error instanceof Error ? error.message : "Request failed" }, error instanceof ApiError ? error.status : 400);
}
