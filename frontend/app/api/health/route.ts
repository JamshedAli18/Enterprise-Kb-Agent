import { forward } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return forward("/health", { method: "GET", signal: request.signal });
}
