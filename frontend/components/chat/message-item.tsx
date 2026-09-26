"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CircleAlert,
  FileText,
  HardDrive,
  Hash,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { AssistantMessage, Message, UserMessage } from "./types";

const SOURCE_META: Record<string, { label: string; icon: LucideIcon }> = {
  slack: { label: "Slack", icon: Hash },
  notion: { label: "Notion", icon: FileText },
  drive: { label: "Drive", icon: HardDrive },
};

type Props = {
  message: Message;
  playing: boolean;
  autoplayBlocked: boolean;
  /** Speech output available (backend MP3, or browser speech synthesis for text answers). */
  canSpeak: boolean;
  onTogglePlay: (message: AssistantMessage) => void;
  onRetry: (question: string) => void;
  canRetry: boolean;
};

export function MessageItem(props: Props) {
  return props.message.role === "user" ? (
    <UserBubble message={props.message} />
  ) : (
    <AssistantBlock {...props} message={props.message} />
  );
}

function UserBubble({ message }: { message: UserMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] sm:max-w-[75%]">
        {message.via === "voice" && (
          <p className="mb-1.5 flex items-center justify-end gap-1.5 text-xs text-muted">
            <Mic className="size-3" />
            {message.transcribing ? "Transcribing your voice" : "You said"}
          </p>
        )}
        <div className="rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-background">
          {message.transcribing ? <TypingDots light /> : message.content}
        </div>
      </div>
    </div>
  );
}

function AssistantBlock({
  message,
  playing,
  autoplayBlocked,
  canSpeak,
  onTogglePlay,
  onRetry,
  canRetry,
}: Props & { message: AssistantMessage }) {
  const sources = (message.meta?.decision?.sources ?? []).map((s) => s.toLowerCase());
  const isLive = message.status === "pending" || message.status === "streaming";
  const canPlay =
    !!message.audioUrl ||
    (!!message.content.trim() && (message.status === "done" || message.status === "stopped"));
  const playDisabled = !message.audioUrl && !canSpeak;

  return (
    <div className="flex gap-3 sm:gap-4">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft">
        <Sparkles className="size-3.5 text-accent" />
      </div>

      <div className="min-w-0 flex-1">
        {message.status === "pending" && !message.content ? (
          <div className="flex h-7 items-center gap-3 text-sm text-muted">
            <TypingDots />
            <span>Routing and retrieving</span>
          </div>
        ) : (
          message.content && (
            <div className="space-y-1.5 text-[15px] leading-relaxed break-words">
              {renderAnswer(message.content, isLive)}
            </div>
          )
        )}

        {message.status === "stopped" && (
          <p className="mt-2 text-xs text-muted">Response stopped.</p>
        )}

        {message.status === "error" && message.error && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-600" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{message.error.type || "Error"}</p>
              <p className="mt-0.5 break-words text-red-800/80">{message.error.message}</p>
            </div>
            {canRetry && message.question && (
              <button
                type="button"
                onClick={() => onRetry(message.question!)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                <RotateCcw className="size-3" />
                Retry
              </button>
            )}
          </div>
        )}

        {(sources.length > 0 || message.meta || canPlay) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {canPlay && (
              <button
                type="button"
                onClick={() => onTogglePlay(message)}
                disabled={playDisabled}
                aria-label={playing ? "Pause answer" : "Play answer"}
                title={
                  playDisabled
                    ? "Read-aloud isn't supported in this browser"
                    : autoplayBlocked
                      ? "Your browser blocked autoplay — tap to play"
                      : playing
                        ? "Pause"
                        : "Play"
                }
                className={`flex size-[22px] items-center justify-center rounded-md border transition-colors disabled:opacity-40 ${
                  playing || autoplayBlocked
                    ? "border-accent bg-accent text-white"
                    : "border-line bg-surface text-muted hover:border-accent/40 hover:text-accent"
                }`}
              >
                {playing ? (
                  <Pause className="size-3 fill-current" />
                ) : (
                  <Play className="size-3 translate-x-px fill-current" />
                )}
              </button>
            )}
            {sources.map((s) => {
              const meta = SOURCE_META[s];
              const Icon = meta?.icon ?? FileText;
              return (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-muted"
                >
                  <Icon className="size-3" />
                  {meta?.label ?? s}
                </span>
              );
            })}
            {message.meta && <MetaLine meta={message.meta} />}
          </div>
        )}
      </div>
    </div>
  );
}

function MetaLine({ meta }: { meta: NonNullable<AssistantMessage["meta"]> }) {
  const parts = [meta.routing_time, meta.retrieval_time, meta.synthesis_time];
  const total = parts.reduce<number>((sum, t) => sum + (typeof t === "number" ? t : 0), 0);
  const model = describeModel(meta.synth_used);
  const breakdown = `Routing ${fmt(meta.routing_time)} · Retrieval ${fmt(meta.retrieval_time)} · Synthesis ${fmt(meta.synthesis_time)}`;
  return (
    <span className="ml-1 text-[11px] text-muted/80" title={`${breakdown}\nRouter: ${meta.router_used}\nSynthesis: ${meta.synth_used}`}>
      {[model, total > 0 ? `${total.toFixed(1)}s` : null].filter(Boolean).join(" · ")}
    </span>
  );
}

function fmt(t: number | undefined) {
  return typeof t === "number" ? `${t.toFixed(2)}s` : "–";
}

function describeModel(used: string | undefined) {
  if (!used) return null;
  const u = used.toLowerCase();
  if (u.includes("gemini")) return "Gemini fallback";
  if (u.includes("groq")) return "Groq";
  return used;
}

export function TypingDots({ light = false }: { light?: boolean }) {
  const color = light ? "bg-background/70" : "bg-muted";
  return (
    <span className="inline-flex items-center gap-1" aria-label="Loading">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className={`typing-dot size-1.5 rounded-full ${color}`}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * Lightweight rendering for partially streamed markdown: bullet and numbered
 * lines, headings, **bold** and `code`. A full markdown parser would reflow
 * mid-stream as syntax completes; this stays stable token to token.
 */
function renderAnswer(text: string, live: boolean): ReactNode[] {
  const lines = text.split("\n");
  const caret = <span className="stream-caret" aria-hidden="true" />;
  return lines.map((line, i) => {
    const tail = live && i === lines.length - 1 ? caret : null;
    if (!line.trim()) return tail ? <p key={i}>{tail}</p> : <div key={i} className="h-1" />;

    const bullet = line.match(/^\s*[*\-•]\s+(.*)$/);
    if (bullet) {
      return (
        <div key={i} className="flex gap-2.5 pl-1">
          <span className="mt-[0.7em] size-1 shrink-0 rounded-full bg-foreground/50" />
          <span>{renderInline(bullet[1])}{tail}</span>
        </div>
      );
    }
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      return (
        <div key={i} className="flex gap-2.5 pl-1">
          <span className="shrink-0 text-muted tabular-nums">{numbered[1]}.</span>
          <span>{renderInline(numbered[2])}{tail}</span>
        </div>
      );
    }
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      return (
        <p key={i} className="pt-2 font-semibold">
          {renderInline(heading[1])}{tail}
        </p>
      );
    }
    return (
      <p key={i}>
        {renderInline(line)}{tail}
      </p>
    );
  });
}

/** Inline formatting: **bold** and `code`. */
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
