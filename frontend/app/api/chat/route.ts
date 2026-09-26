import { forward } from "@/lib/proxy";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  return forward("/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
    signal: request.signal,
  });
}
