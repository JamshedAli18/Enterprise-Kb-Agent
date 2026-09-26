import { forward } from "@/lib/proxy";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  // Re-sending the parsed FormData lets fetch set a fresh multipart boundary.
  return forward("/voice-chat", {
    method: "POST",
    body: await request.formData(),
    signal: request.signal,
  });
}
