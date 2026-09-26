"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUp,
  Mic,
  Square,
  SquarePen,
  X,
} from "lucide-react";
import { LogoMark } from "@/components/brand";
import {
  base64ToAudioUrl,
  checkHealth,
  streamChat,
  streamVoiceChat,
  type StreamHandlers,
} from "@/lib/api";
import { SILENT_WAV } from "@/lib/silent-audio";
import { MessageItem } from "./message-item";
import type { AssistantMessage, Message } from "./types";

const SUGGESTIONS = [
  "What changed about pricing recently?",
  "How many days can I work remotely?",
  "What happened during the August 22 incident?",
  "What is our parental leave policy, and did engineering ship anything about it?",
];

type Health = "checking" | "waking" | "online" | "offline";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // thread_id from the last `done` event; sent with every follow-up for multi-turn memory.
  const [threadId, setThreadId] = useState<string | null>(null);
  const threadIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [health, setHealth] = useState<Health>("checking");

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const discardRecordingRef = useRef(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlsRef = useRef<string[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [blockedId, setBlockedId] = useState<string | null>(null);
  const [canSpeak, setCanSpeak] = useState(false);
  const speechTokenRef = useRef(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ---------------- health / cold-start indicator ---------------- */

  const runHealthCheck = useCallback(async () => {
    setHealth("checking");
    // Render's free tier sleeps; a slow health check usually means it's waking up.
    const slow = setTimeout(() => setHealth((h) => (h === "checking" ? "waking" : h)), 3500);
    const ok = await checkHealth();
    clearTimeout(slow);
    setHealth(ok ? "online" : "offline");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kick off initial async check
    void runHealthCheck();
  }, [runHealthCheck]);

  /* ---------------- scrolling ---------------- */

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  /* ---------------- cleanup ---------------- */

  useEffect(() => {
    // Client-only check, so server and first client render agree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanSpeak(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  useEffect(() => {
    const urls = audioUrlsRef.current;
    return () => {
      abortRef.current?.abort();
      audioRef.current?.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = setInterval(() => setRecordSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(timer);
  }, [recording]);

  /* ---------------- message helpers ---------------- */

  const patchMessage = useCallback((id: string, patch: (m: Message) => Message) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? patch(m) : m)));
  }, []);

  const patchAssistant = useCallback(
    (id: string, patch: Partial<AssistantMessage> | ((m: AssistantMessage) => Partial<AssistantMessage>)) =>
      patchMessage(id, (m) =>
        m.role === "assistant" ? { ...m, ...(typeof patch === "function" ? patch(m) : patch) } : m,
      ),
    [patchMessage],
  );

  /**
   * One shared <audio> element for every spoken answer. Strict-autoplay browsers
   * (Safari/iOS, some Firefox setups) only allow playback on an element that was
   * started inside a user gesture, and the answer audio arrives many seconds
   * after the click — so we unlock this element during the click (unlockAudio)
   * and reuse it when the `done` event lands.
   */
  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = "auto";
      el.onended = () => setPlayingId(null);
      // A queued pause from a previous source must not clear the new one.
      el.onpause = () => {
        if (el.paused) setPlayingId(null);
      };
      audioRef.current = el;
    }
    return audioRef.current;
  }, []);

  const unlockAudio = useCallback(() => {
    const el = getAudio();
    if (!el.paused) return;
    el.src = SILENT_WAV;
    el.play().catch(() => {});
  }, [getAudio]);

  /** Cancels browser speech synthesis; bumping the token silences stale utterance callbacks. */
  const stopSpeech = useCallback(() => {
    speechTokenRef.current++;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const stopAllPlayback = useCallback(() => {
    audioRef.current?.pause();
    stopSpeech();
    setPlayingId(null);
  }, [stopSpeech]);

  /**
   * Text answers have no backend audio, so they are read aloud with the
   * browser's speech synthesis. Queued sentence by sentence because Chrome
   * silently cuts off single utterances longer than ~15 seconds.
   */
  const speakText = useCallback(
    (id: string, text: string) => {
      audioRef.current?.pause();
      stopSpeech();
      const token = speechTokenRef.current;
      const plain = text
        .replace(/\*\*|`|^#+\s*/gm, "")
        .replace(/^\s*[*\-•]\s+/gm, "")
        .trim();
      const sentences = plain.match(/[^.!?\n]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
      if (sentences.length === 0) return;

      setBlockedId(null);
      setPlayingId(id);
      sentences.forEach((sentence, i) => {
        const u = new SpeechSynthesisUtterance(sentence);
        if (i === sentences.length - 1) {
          u.onend = () => {
            if (speechTokenRef.current === token) setPlayingId(null);
          };
        }
        u.onerror = () => {
          if (speechTokenRef.current === token) setPlayingId(null);
        };
        window.speechSynthesis.speak(u);
      });
    },
    [stopSpeech],
  );

  const playAudio = useCallback(
    (id: string, url: string) => {
      const el = getAudio();
      stopSpeech();
      el.pause();
      // Resume a paused answer from where it stopped; otherwise start fresh.
      if (el.src !== url || el.ended) el.src = url;
      setBlockedId(null);
      setPlayingId(id);
      el.play().catch(() => {
        // Still blocked: surface an explicit play button instead of failing silently.
        setPlayingId(null);
        setBlockedId(id);
      });
    },
    [getAudio, stopSpeech],
  );

  const togglePlay = useCallback(
    (m: AssistantMessage) => {
      if (playingId === m.id) stopAllPlayback();
      else if (m.audioUrl) playAudio(m.id, m.audioUrl);
      else if (canSpeak) speakText(m.id, m.content);
    },
    [canSpeak, playAudio, playingId, speakText, stopAllPlayback],
  );

  /** Shared streaming lifecycle for /chat and /voice-chat. */
  const runStream = useCallback(
    async (
      assistantId: string,
      start: (handlers: StreamHandlers, signal: AbortSignal) => Promise<void>,
      extra?: Partial<StreamHandlers>,
    ) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      stickToBottomRef.current = true;

      const handlers: StreamHandlers = {
        onToken: (token) =>
          patchAssistant(assistantId, (m) => ({ content: m.content + token, status: "streaming" })),
        onTranscript: extra?.onTranscript,
        onDone: (done) => {
          if (done.thread_id) {
            threadIdRef.current = done.thread_id;
            setThreadId(done.thread_id);
          }
          let audioUrl: string | undefined;
          if (done.answer_audio_base64) {
            try {
              audioUrl = base64ToAudioUrl(done.answer_audio_base64);
              audioUrlsRef.current.push(audioUrl);
            } catch {
              audioUrl = undefined;
            }
          }
          patchAssistant(assistantId, { status: "done", meta: done, audioUrl });
          extra?.onDone?.(done);
          if (audioUrl) playAudio(assistantId, audioUrl);
        },
        onError: (error) => {
          patchAssistant(assistantId, { status: "error", error });
          extra?.onError?.(error);
        },
      };

      try {
        await start(handlers, controller.signal);
      } catch (err) {
        if (controller.signal.aborted) {
          patchAssistant(assistantId, { status: "stopped" });
        } else {
          handlers.onError({
            type: "NetworkError",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setBusy(false);
      }
    },
    [patchAssistant, playAudio],
  );

  /* ---------------- text chat ---------------- */

  const sendText = useCallback(
    (raw: string) => {
      const question = raw.trim();
      if (!question || busy) return;
      const assistantId = newId();
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "user", content: question, via: "text" },
        { id: assistantId, role: "assistant", content: "", status: "pending", question },
      ]);
      setInput("");
      void runStream(assistantId, (h, signal) =>
        streamChat(question, threadIdRef.current, h, signal),
      );
    },
    [busy, runStream],
  );

  /* ---------------- voice chat ---------------- */

  const sendVoice = useCallback(
    (blob: Blob, filename: string) => {
      const userId = newId();
      const assistantId = newId();
      setMessages((prev) => [
        ...prev,
        { id: userId, role: "user", content: "", via: "voice", transcribing: true },
        { id: assistantId, role: "assistant", content: "", status: "pending" },
      ]);
      const setTranscript = (text: string) =>
        patchMessage(userId, (m) =>
          m.role === "user" ? { ...m, content: text || "(no speech detected)", transcribing: false } : m,
        );
      void runStream(
        assistantId,
        (h, signal) => streamVoiceChat(blob, filename, threadIdRef.current, h, signal),
        {
          onTranscript: setTranscript,
          onDone: (done) => {
            if (done.transcript !== undefined) setTranscript(done.transcript);
          },
          onError: () =>
            patchMessage(userId, (m) =>
              m.role === "user" && m.transcribing
                ? { ...m, content: "(voice message)", transcribing: false }
                : m,
            ),
        },
      );
    },
    [patchMessage, runStream],
  );

  const startRecording = useCallback(async () => {
    setMicError(null);
    unlockAudio(); // must run synchronously inside the click, before any await
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicError("Voice recording isn't supported in this browser.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError("Microphone access was denied.");
      return;
    }

    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find(
      (t) => MediaRecorder.isTypeSupported(t),
    );
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    discardRecordingRef.current = false;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      setRecording(false);
      if (discardRecordingRef.current || chunks.length === 0) return;
      const type = recorder.mimeType || mimeType || "audio/webm";
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      sendVoice(new Blob(chunks, { type }), `recording.${ext}`);
    };

    recorderRef.current = recorder;
    recorder.start();
    setRecordSeconds(0);
    setRecording(true);
  }, [sendVoice, unlockAudio]);

  const stopRecording = useCallback(
    (discard: boolean) => {
      if (!discard) unlockAudio();
      discardRecordingRef.current = discard;
      recorderRef.current?.stop();
    },
    [unlockAudio],
  );

  /* ---------------- misc actions ---------------- */

  const stopStreaming = () => abortRef.current?.abort();

  const newConversation = () => {
    abortRef.current?.abort();
    stopAllPlayback();
    setBlockedId(null);
    setMessages([]);
    threadIdRef.current = null;
    setThreadId(null);
    setInput("");
    textareaRef.current?.focus();
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [input]);

  const empty = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Top bar */}
      <header className="shrink-0 border-b border-line bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              aria-label="Back to home"
              className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <LogoMark className="size-6" />
            <span className="text-sm font-semibold tracking-tight">KB Agent</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <HealthBadge health={health} onRetry={runHealthCheck} />
            <button
              type="button"
              onClick={newConversation}
              disabled={empty && !threadId}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm text-muted transition-colors hover:bg-black/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <SquarePen className="size-4" />
              <span className="hidden sm:inline">New chat</span>
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto">
        <div className={`mx-auto max-w-3xl px-4 sm:px-6 ${empty ? "h-full" : ""}`}>
          {empty ? (
            <EmptyState onPick={sendText} disabled={busy} />
          ) : (
            <div className="space-y-8 py-8 sm:py-10">
              {messages.map((m) => (
                <MessageItem
                  key={m.id}
                  message={m}
                  playing={playingId === m.id}
                  autoplayBlocked={blockedId === m.id}
                  canSpeak={canSpeak}
                  onTogglePlay={togglePlay}
                  onRetry={sendText}
                  canRetry={!busy}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 bg-gradient-to-t from-background via-background to-background/0 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          {micError && (
            <p role="alert" className="mb-2 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
              {micError}
              <button type="button" onClick={() => setMicError(null)} aria-label="Dismiss">
                <X className="size-3.5" />
              </button>
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendText(input);
            }}
            className="flex items-end gap-2 rounded-3xl border border-line bg-surface p-2 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] transition-colors focus-within:border-foreground/25"
          >
            {recording ? (
              <div className="flex h-10 flex-1 items-center gap-3 pl-3">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
                </span>
                <span className="text-sm">Recording</span>
                <span className="font-mono text-sm text-muted tabular-nums">
                  {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, "0")}
                </span>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    sendText(input);
                  }
                }}
                rows={1}
                placeholder="Ask about policies, pricing, incidents…"
                aria-label="Message"
                className="max-h-44 min-h-10 flex-1 resize-none bg-transparent py-2 pl-3 text-[15px] leading-6 font-light outline-none placeholder:text-muted/70"
              />
            )}

            {recording ? (
              <>
                <IconButton label="Cancel recording" onClick={() => stopRecording(true)} variant="ghost">
                  <X className="size-4" />
                </IconButton>
                <IconButton label="Stop and send recording" onClick={() => stopRecording(false)} variant="accent">
                  <ArrowUp className="size-4" />
                </IconButton>
              </>
            ) : (
              <>
                <IconButton label="Record a voice question" onClick={startRecording} variant="ghost" disabled={busy}>
                  <Mic className="size-4" />
                </IconButton>
                {busy ? (
                  <IconButton label="Stop generating" onClick={stopStreaming} variant="solid">
                    <Square className="size-3 fill-current" />
                  </IconButton>
                ) : (
                  <IconButton label="Send message" type="submit" variant="accent" disabled={!input.trim()}>
                    <ArrowUp className="size-4" />
                  </IconButton>
                )}
              </>
            )}
          </form>
          <p className="mt-2 text-center text-[11px] text-muted/80">
            Answers are generated from Slack, Notion and Drive sample data and may be imperfect.
          </p>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  variant,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  variant: "ghost" | "accent" | "solid";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const styles = {
    ghost: "text-muted hover:bg-black/5 hover:text-foreground",
    accent: "bg-accent text-white hover:opacity-90",
    solid: "bg-foreground text-background hover:opacity-85",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex size-10 shrink-0 items-center justify-center rounded-full transition disabled:pointer-events-none disabled:opacity-35 ${styles}`}
    >
      {children}
    </button>
  );
}

function HealthBadge({ health, onRetry }: { health: Health; onRetry: () => void }) {
  const map: Record<Health, { dot: string; label: string }> = {
    checking: { dot: "bg-muted/50", label: "Connecting" },
    waking: { dot: "bg-amber-500 animate-pulse", label: "Waking server" },
    online: { dot: "bg-emerald-500", label: "Online" },
    offline: { dot: "bg-red-500", label: "Offline — retry" },
  };
  const { dot, label } = map[health];
  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={health !== "offline"}
      className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs text-muted disabled:cursor-default"
      title={health === "waking" ? "The backend sleeps when idle; the first request can take up to a minute." : undefined}
    >
      <span className={`size-1.5 rounded-full ${dot}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function EmptyState({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div className="flex min-h-full flex-col justify-center py-12 sm:py-16">
      <h1 className="text-3xl font-bold sm:text-4xl">What would you like to know?</h1>
      <p className="mt-3 max-w-md text-muted">
        Ask in plain language or use the microphone. Answers draw on Slack, Notion and Google
        Drive.
      </p>
      <div className="mt-10 grid gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={disabled}
            onClick={() => onPick(q)}
            className="rounded-2xl border border-line bg-surface px-4 py-3.5 text-left text-sm leading-snug transition-colors hover:border-foreground/25 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
