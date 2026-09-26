import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  AudioLines,
  CircleCheck,
  FileText,
  Filter,
  HardDrive,
  Hash,
  Layers,
  MessagesSquare,
  Mic,
  Route,
  ShieldCheck,
  Volume2,
  Zap,
} from "lucide-react";
import { Reveal } from "@/components/reveal";

export function Capabilities() {
  return (
    <section id="capabilities" className="relative scroll-mt-16">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <Reveal>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
                Capabilities
              </p>
              <h2 className="mt-4 text-3xl leading-tight font-bold sm:text-4xl">
                Built for real workloads,
                <br className="hidden sm:block" /> not just demos.
              </h2>
            </div>
            <p className="max-w-sm leading-relaxed text-muted">
              Six production concerns, each handled explicitly in the agent graph — not left to the
              model to figure out.
            </p>
          </div>
        </Reveal>

        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          <Reveal className="md:col-span-2" delay={0}>
            <Card
              icon={Route}
              title="Multi-agent routing"
              body="A supervisor agent reads each question and dispatches only the sources it needs — irrelevant systems are never queried."
              visual={<RoutingVisual />}
            />
          </Reveal>
          <Reveal delay={80}>
            <Card
              icon={AudioLines}
              title="Voice input and output"
              body="Speak a question, hear the answer back — with transcript and text shown alongside."
              visual={<VoiceVisual />}
            />
          </Reveal>
          <Reveal delay={0}>
            <Card
              icon={Layers}
              title="Hybrid retrieval"
              body="Semantic vectors plus structured filters — dates, channels, folders — for precise context."
              visual={<HybridVisual />}
            />
          </Reveal>
          <Reveal delay={80}>
            <Card
              icon={Zap}
              title="Streaming responses"
              body="Tokens render as they are generated over server-sent events. No blank waiting."
              visual={<StreamingVisual />}
            />
          </Reveal>
          <Reveal delay={160}>
            <Card
              icon={MessagesSquare}
              title="Conversation memory"
              body="Thread-scoped checkpoints carry context across turns, so follow-ups just work."
              visual={<MemoryVisual />}
            />
          </Reveal>
          <Reveal className="md:col-span-2 lg:col-span-3" delay={0}>
            <Card
              wide
              icon={ShieldCheck}
              title="Automatic LLM fallback"
              body="Routing and synthesis both run on Groq for speed. If it is rate limited or fails, the same request is retried on Gemini transparently — the user just gets an answer."
              visual={<FallbackVisual />}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Card({
  icon: Icon,
  title,
  body,
  visual,
  wide = false,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  visual: ReactNode;
  wide?: boolean;
}) {
  return (
    <article
      className={`group relative flex h-full overflow-hidden rounded-3xl border border-line bg-surface p-2 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-foreground/15 hover:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.18)] ${
        wide ? "flex-col lg:flex-row-reverse" : "flex-col"
      }`}
    >
      <div
        className={`dot-grid relative flex items-center justify-center overflow-hidden rounded-[1.1rem] bg-background ${
          wide ? "h-52 lg:h-auto lg:min-h-56 lg:flex-[1.4]" : "h-52"
        }`}
      >
        {visual}
      </div>
      <div
        className={`p-5 sm:p-6 ${wide ? "lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:pr-10" : ""}`}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft transition-colors duration-500 group-hover:bg-accent">
            <Icon
              className="size-4 text-accent transition-colors duration-500 group-hover:text-white"
              strokeWidth={2}
            />
          </span>
          <h3 className="text-[17px] font-semibold">{title}</h3>
        </div>
        <p className="mt-3 leading-relaxed text-muted">{body}</p>
      </div>
    </article>
  );
}

/* ---------------- visuals ---------------- */

function Pill({
  children,
  active = false,
  dim = false,
  className = "",
}: {
  children: ReactNode;
  active?: boolean;
  dim?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shadow-sm ${
        active
          ? "border-accent/30 bg-surface text-foreground"
          : dim
            ? "border-dashed border-line bg-surface/60 text-muted/60 shadow-none"
            : "border-line bg-surface text-foreground"
      } ${className}`}
    >
      {children}
    </span>
  );
}

function RoutingVisual() {
  const targets = [
    { icon: Hash, label: "Slack", on: true, y: 18 },
    { icon: FileText, label: "Notion", on: true, y: 60 },
    { icon: HardDrive, label: "Drive", on: false, y: 102 },
  ];
  return (
    <div className="flex w-full max-w-lg items-center justify-center px-4 sm:px-6">
      <span className="hidden sm:inline-flex">
        <Pill>Question</Pill>
      </span>
      <div className="dash-line hidden h-px w-8 text-foreground/25 sm:block" />
      <div className="relative flex flex-col items-center">
        <span className="ring absolute inset-0 rounded-xl bg-accent/30" />
        <span className="relative rounded-xl bg-foreground px-3 py-2 text-xs font-medium text-background shadow-lg">
          Supervisor
        </span>
      </div>
      <svg
        viewBox="0 0 80 120"
        preserveAspectRatio="none"
        className="h-32 w-16 shrink-0 sm:w-20"
        aria-hidden="true"
      >
        {targets.map((t) => (
          <path
            key={t.label}
            d={`M0 60 C 40 60, 40 ${t.y}, 80 ${t.y}`}
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeWidth={1.5}
            className={t.on ? "dash-flow stroke-accent" : "stroke-foreground/15"}
            strokeDasharray={t.on ? undefined : "2 4"}
          />
        ))}
      </svg>
      <div className="flex flex-col gap-2">
        {targets.map(({ icon: Icon, label, on }) => (
          <Pill key={label} active={on} dim={!on}>
            <Icon className={`size-3.5 ${on ? "text-accent" : ""}`} />
            {label}
            {on ? (
              <CircleCheck className="size-3 text-accent" />
            ) : (
              <span className="text-[10px] font-normal">skipped</span>
            )}
          </Pill>
        ))}
      </div>
    </div>
  );
}

function VoiceVisual() {
  const heights = [30, 55, 80, 45, 95, 60, 35, 75, 50, 90, 40, 65, 30, 55, 85, 45, 25];
  return (
    <div className="flex w-full items-center justify-center gap-4 px-6">
      <div className="relative">
        <span className="ring absolute inset-0 rounded-full bg-accent/40" />
        <span className="relative flex size-11 items-center justify-center rounded-full bg-accent text-white shadow-lg">
          <Mic className="size-4.5" />
        </span>
      </div>
      <div className="flex h-14 items-center gap-[3px]">
        {heights.map((h, i) => (
          <span
            key={i}
            className="wave-bar w-[3px] rounded-full bg-foreground/70"
            style={{ height: `${h}%`, animationDelay: `${(i * 90) % 1100}ms` }}
          />
        ))}
      </div>
      <span className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-foreground shadow-sm">
        <Volume2 className="size-4.5" />
      </span>
    </div>
  );
}

function HybridVisual() {
  const results = [
    { label: "#pricing · Mar 12", w: "92%" },
    { label: "Pricing FAQ", w: "76%" },
    { label: "Q2 sales deck", w: "58%" },
  ];
  return (
    <div className="w-full max-w-[17rem] px-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill>
          <Layers className="size-3 text-accent" />
          semantic
        </Pill>
        <span className="text-xs text-muted">+</span>
        <Pill>
          <Filter className="size-3 text-accent" />
          channel = pricing
        </Pill>
      </div>
      <div className="mt-4 space-y-2.5">
        {results.map((r, i) => (
          <div key={r.label}>
            <div className="flex justify-between text-[11px] text-muted">
              <span>{r.label}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-black/[0.05]">
              <div
                className="grow-x h-full rounded-full bg-accent"
                style={{ width: r.w, opacity: 1 - i * 0.25, animationDelay: `${300 + i * 150}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StreamingVisual() {
  return (
    <div className="w-full max-w-[17rem] px-5">
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-muted uppercase">
          <span className="size-1.5 animate-pulse rounded-full bg-accent" />
          streaming
        </div>
        <p className="mt-2 text-[13px] leading-relaxed">
          <span className="type-loop inline">
            You can work remotely up to 4 days per week, with fully remote roles handled separately.
          </span>
        </p>
      </div>
    </div>
  );
}

function MemoryVisual() {
  return (
    <div className="w-full max-w-[16rem] px-5">
      <div className="relative space-y-2 pl-5">
        <span className="absolute top-2 bottom-2 left-[5px] w-px bg-gradient-to-b from-accent/60 to-accent/10" />
        {[
          { text: "What changed about pricing?", faded: true },
          { text: "When did that take effect?", faded: false },
        ].map((m) => (
          <div key={m.text} className="relative">
            <span
              className={`absolute top-1/2 -left-5 size-[11px] -translate-y-1/2 rounded-full border-2 border-background ${
                m.faded ? "bg-accent/40" : "bg-accent"
              }`}
            />
            <div
              className={`rounded-xl rounded-bl-sm px-3 py-2 text-xs ${
                m.faded ? "bg-foreground/80 text-background" : "bg-foreground text-background"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div className="relative pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 font-mono text-[10px] text-muted">
            thread_id · 8fc7d128…
          </span>
        </div>
      </div>
    </div>
  );
}

function FallbackVisual() {
  return (
    <div className="flex w-full max-w-xl flex-wrap items-center justify-center gap-y-3 px-6 sm:flex-nowrap">
      <Pill>Request</Pill>
      <div className="dash-line mx-2 h-px w-6 text-foreground/25 sm:w-10" />
      <div className="flex flex-col items-center gap-1.5">
        <Pill className="line-through decoration-foreground/30">Groq</Pill>
        <span className="rounded-full bg-red-50 px-2 py-0.5 font-mono text-[10px] text-red-600">
          429 rate limited
        </span>
      </div>
      <div className="mx-2 flex items-center text-accent">
        <div className="dash-line h-px w-6 sm:w-10" />
        <ArrowRight className="nudge-x size-3.5" />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <Pill active>
          Gemini
          <CircleCheck className="size-3 text-accent" />
        </Pill>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] text-accent">
          fallback
        </span>
      </div>
      <div className="dash-line mx-2 h-px w-6 text-foreground/25 sm:w-10" />
      <span className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-sm">
        Answer
      </span>
    </div>
  );
}
