/**
 * Client for the Enterprise KB Agent API. Requests go through the same-origin
 * /api proxy routes (see lib/proxy.ts). SSE is parsed by hand from a fetch
 * ReadableStream because EventSource can't POST.
 */

export type Decision = {
  sources: string[];
  filters: Record<string, unknown>;
};

export type DoneEvent = {
  thread_id: string;
  router_used: string;
  decision: Decision | null;
  synth_used: string;
  routing_time: number;
  retrieval_time: number;
  synthesis_time: number;
  // /voice-chat only
  transcript?: string;
  answer_audio_base64?: string;
};

export type ErrorEvent = { type: string; message: string };

export type StreamHandlers = {
  onToken: (token: string) => void;
  onTranscript?: (text: string) => void;
  onDone: (done: DoneEvent) => void;
  onError: (error: ErrorEvent) => void;
};

export async function streamChat(
  question: string,
  threadId: string | null,
  handlers: StreamHandlers,
  signal?: AbortSignal,
) {
  const body: { question: string; thread_id?: string } = { question };
  if (threadId) body.thread_id = threadId;

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  await consumeStream(res, handlers);
}

export async function streamVoiceChat(
  audio: Blob,
  filename: string,
  threadId: string | null,
  handlers: StreamHandlers,
  signal?: AbortSignal,
) {
  const form = new FormData();
  form.append("file", audio, filename);
  if (threadId) form.append("thread_id", threadId);

  const res = await fetch("/api/voice-chat", { method: "POST", body: form, signal });
  await consumeStream(res, handlers);
}

export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch("/api/health", { cache: "no-store", signal });
    if (!res.ok) return false;
    const json = (await res.json()) as { status?: string };
    return json.status === "ok";
  } catch {
    return false;
  }
}

async function consumeStream(res: Response, handlers: StreamHandlers) {
  if (!res.ok || !res.body) {
    let message = `Request failed with status ${res.status}`;
    try {
      const json = await res.json();
      message = json.message ?? json.detail ?? message;
      if (typeof message !== "string") message = JSON.stringify(message);
    } catch {
      // non-JSON error body; keep the status message
    }
    handlers.onError({ type: `HTTP ${res.status}`, message });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  const dispatch = (block: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue;
      const idx = line.indexOf(":");
      const field = idx === -1 ? line : line.slice(0, idx);
      let value = idx === -1 ? "" : line.slice(idx + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") event = value;
      else if (field === "data") dataLines.push(value);
    }
    if (dataLines.length === 0) return;

    let data: unknown;
    try {
      data = JSON.parse(dataLines.join("\n"));
    } catch {
      return;
    }

    if (event === "message") {
      const token = (data as { token?: unknown }).token;
      if (typeof token === "string") handlers.onToken(token);
    } else if (event === "transcript") {
      handlers.onTranscript?.((data as { text: string }).text);
    } else if (event === "done") {
      finished = true;
      handlers.onDone(data as DoneEvent);
    } else if (event === "error") {
      finished = true;
      handlers.onError(data as ErrorEvent);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, "\n");
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      dispatch(buffer.slice(0, sep));
      buffer = buffer.slice(sep + 2);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) dispatch(buffer);

  if (!finished) {
    handlers.onError({
      type: "StreamClosed",
      message: "The connection closed before the answer finished.",
    });
  }
}

export function base64ToAudioUrl(b64: string, mime = "audio/mpeg"): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}
