import { API_BASE_URL } from "./config";

/**
 * The FastAPI backend does not send CORS headers, so the browser can't call
 * it directly. These route handlers forward requests server-side and pipe the
 * upstream SSE body straight back without buffering, so tokens still arrive
 * one by one.
 */
export async function forward(
  path: string,
  init: RequestInit & { signal?: AbortSignal },
): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE_URL}${path}`, { ...init, cache: "no-store" });
  } catch (err) {
    return Response.json(
      { type: "UpstreamUnreachable", message: `Could not reach the backend: ${String(err)}` },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
