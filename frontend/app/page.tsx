import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowRight,
  AudioLines,
  Check,
  Combine,
  FileText,
  GitBranch,
  HardDrive,
  Hash,
  MessageSquareText,
  Mic,
  Route,
  Search,
  Sparkles,
  Volume2,
  Zap,
} from "lucide-react";
import { GithubMark, Wordmark } from "@/components/brand";
import { Capabilities } from "@/components/home/capabilities";
import { Footer } from "@/components/home/footer";
import { Overview } from "@/components/home/overview";
import { TechStack } from "@/components/home/tech-stack";
import { Reveal } from "@/components/reveal";
import { GITHUB_URL } from "@/lib/config";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 overflow-x-clip">
        <Hero />
        <Overview />
        <Architecture />
        <Capabilities />
        <TechStack />
        <ClosingCta />
      </main>
      <Footer />
    </>
  );
}

/* ------------------------------------------------------------------ */

const NAV = [
  { href: "#overview", label: "Overview" },
  { href: "#architecture", label: "Architecture" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#stack", label: "Stack" },
];

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Wordmark />
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="transition-colors hover:text-foreground">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            className="hidden size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-foreground sm:flex"
          >
            <GithubMark />
          </a>
          <Link
            href="/chat"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-85"
          >
            Open chat
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative isolate">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="drift absolute -top-32 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-accent/15 blur-3xl" />
        <div className="drift absolute top-40 left-[-15%] h-80 w-80 rounded-full bg-accent/10 blur-3xl [animation-delay:-8s]" />
        <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,#000_20%,transparent_70%)]" />
      </div>
      <div className="mx-auto max-w-6xl px-5 pt-20 pb-24 sm:px-8 sm:pt-28 sm:pb-32">
        <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="rise inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-accent" />
              LangGraph · MCP · Hybrid RAG · Voice
            </p>
            <h1
              style={{ animationDelay: "90ms" }}
              className="rise mt-6 text-4xl leading-[1.05] font-bold sm:text-6xl"
            >
              One question.
              <br />
              <span className="text-muted">Every source of truth.</span>
            </h1>
            <p
              style={{ animationDelay: "180ms" }}
              className="rise mt-6 max-w-lg text-lg leading-relaxed text-muted"
            >
              A multi-agent knowledge assistant that routes each question across Slack, Notion and
              Google Drive, retrieves with hybrid search, and streams back one grounded answer — by
              text or by voice.
            </p>
            <div
              style={{ animationDelay: "270ms" }}
              className="rise mt-10 flex flex-wrap items-center gap-3"
            >
              <Link
                href="/chat"
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-[15px] font-medium text-white shadow-[0_8px_24px_-8px_var(--accent)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-10px_var(--accent)]"
              >
                Try the assistant
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-6 text-[15px] font-medium transition-colors hover:border-foreground/30"
              >
                <GithubMark />
                View source
              </a>
            </div>
          </div>
          <div style={{ animationDelay: "250ms" }} className="rise">
            <div className="float">
              <HeroPreview />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroPreview() {
  const steps = [
    { label: "Supervisor routed to", value: "Notion, Slack" },
    { label: "Parallel MCP retrieval", value: "2 sources" },
    { label: "Synthesizing with", value: "Groq" },
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-accent-soft via-transparent to-transparent" />
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.18)] sm:p-6">
        <div className="flex justify-end">
          <p className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm text-background">
            What is our parental leave policy, and did engineering ship anything about it?
          </p>
        </div>
        <div className="mt-5 space-y-2.5 border-l border-line pl-4">
          {steps.map((s, i) => (
            <div
              key={s.label}
              style={{ animationDelay: `${700 + i * 350}ms` }}
              className="rise flex items-center gap-2 text-xs text-muted"
            >
              <Check className="size-3.5 text-accent" />
              <span>{s.label}</span>
              <span className="font-medium text-foreground">{s.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft">
            <Sparkles className="size-3.5 text-accent" />
          </div>
          <div className="flex-1 space-y-2 pt-1.5">
            <div className="shimmer h-2 w-full rounded-full" />
            <div className="shimmer h-2 w-11/12 rounded-full" />
            <div className="flex items-center">
              <div className="shimmer h-2 w-7/12 rounded-full" />
              <span className="stream-caret ml-1 !h-3 !w-1.5 rounded-sm" />
            </div>
            <div style={{ animationDelay: "1900ms" }} className="rise flex gap-1.5 pt-3">
              <SourceChip icon={FileText} label="Notion" />
              <SourceChip icon={Hash} label="Slack" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-[11px] font-medium text-muted">
      <Icon className="size-3" />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */

function SectionHeading({
  eyebrow,
  title,
  body,
  invert = false,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  invert?: boolean;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">{eyebrow}</p>
      <h2 className="mt-4 text-3xl leading-tight font-bold sm:text-4xl">{title}</h2>
      {body && (
        <p className={`mt-5 text-lg leading-relaxed ${invert ? "text-white/60" : "text-muted"}`}>
          {body}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

type Stage = {
  step: string;
  icon: LucideIcon;
  title: string;
  body: string;
  items?: { icon: LucideIcon; label: string }[];
};

const STAGES: Stage[] = [
  {
    step: "01",
    icon: MessageSquareText,
    title: "User query",
    body: "Typed or spoken question, with a thread id for memory.",
  },
  {
    step: "02",
    icon: Route,
    title: "Supervisor routing",
    body: "Picks relevant sources and extracts filters like dates and channels.",
  },
  {
    step: "03",
    icon: GitBranch,
    title: "Parallel MCP retrieval",
    body: "One MCP tool server per source, queried concurrently.",
    items: [
      { icon: Hash, label: "Slack" },
      { icon: FileText, label: "Notion" },
      { icon: HardDrive, label: "Drive" },
    ],
  },
  {
    step: "04",
    icon: Search,
    title: "Hybrid search",
    body: "Cohere embeddings in Pinecone, combined with structured metadata filters.",
  },
  {
    step: "05",
    icon: Combine,
    title: "Synthesis",
    body: "Groq as primary model, Gemini as automatic fallback.",
  },
  {
    step: "06",
    icon: Zap,
    title: "Streamed answer",
    body: "Tokens delivered over server-sent events as they are generated.",
  },
];

function Architecture() {
  return (
    <section
      id="architecture"
      className="relative isolate scroll-mt-16 overflow-hidden bg-foreground text-white"
    >
      <div className="drift pointer-events-none absolute -top-40 -left-40 -z-10 h-[30rem] w-[30rem] rounded-full bg-accent/15 blur-3xl" />
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <Reveal>
          <SectionHeading
            eyebrow="Architecture"
            title="From question to grounded answer in six stages."
            body="A LangGraph state machine orchestrates the flow, served by FastAPI and deployed in Docker on Render."
            invert
          />
        </Reveal>

        <div className="mt-16 flex flex-col items-stretch xl:flex-row">
          {STAGES.map((stage, i) => (
            <Reveal
              key={stage.step}
              delay={i * 90}
              className="flex flex-col items-stretch xl:flex-1 xl:flex-row"
            >
              <StageCard stage={stage} />
              {i < STAGES.length - 1 && (
                <div className="flex items-center justify-center py-2 text-accent xl:px-1.5 xl:py-0">
                  <ArrowDown
                    className="nudge-y size-4 xl:hidden"
                    style={{ animationDelay: `${i * 300}ms` }}
                  />
                  <ArrowRight
                    className="nudge-x hidden size-4 xl:block"
                    style={{ animationDelay: `${i * 300}ms` }}
                  />
                </div>
              )}
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <div className="mt-6 grid gap-4 rounded-2xl border border-dashed border-white/15 p-6 sm:grid-cols-[auto_1fr_1fr] sm:items-center sm:gap-8">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AudioLines className="size-4 text-accent" />
              Voice I/O layer
            </div>
            <div className="flex items-start gap-3 text-sm text-white/60">
              <Mic className="mt-0.5 size-4 shrink-0 text-white/80" />
              <span>
                <span className="font-medium text-white">Speech in.</span> Audio is transcribed with
                Whisper (Groq) and enters the pipeline as a query.
              </span>
            </div>
            <div className="flex items-start gap-3 text-sm text-white/60">
              <Volume2 className="mt-0.5 size-4 shrink-0 text-white/80" />
              <span>
                <span className="font-medium text-white">Speech out.</span> The final answer is
                voiced with Deepgram Aura and returned as MP3.
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function StageCard({ stage }: { stage: Stage }) {
  const { icon: Icon } = stage;
  return (
    <div className="group flex-1 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-accent/50 hover:bg-white/[0.06] xl:min-h-64">
      <div className="flex items-center justify-between">
        <Icon
          className="size-5 text-accent transition-transform duration-500 group-hover:scale-110"
          strokeWidth={1.75}
        />
        <span className="font-mono text-[11px] text-white/35">{stage.step}</span>
      </div>
      <h3 className="mt-5 text-[15px] font-semibold">{stage.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{stage.body}</p>
      {stage.items && (
        <div className="mt-4 flex flex-wrap gap-1.5 xl:flex-col">
          {stage.items.map(({ icon: ItemIcon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white/80"
            >
              <ItemIcon className="size-3" />
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ClosingCta() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8 sm:pb-32">
      <Reveal>
        <div className="relative isolate flex flex-col items-start justify-between gap-8 overflow-hidden rounded-3xl bg-accent-soft px-8 py-12 sm:flex-row sm:items-center sm:px-12">
          <div className="drift pointer-events-none absolute -right-20 -bottom-24 -z-10 h-64 w-64 rounded-full bg-accent/25 blur-3xl" />
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">See it answer in real time.</h2>
            <p className="mt-2 text-muted">Ask about policies, pricing, incidents or projects.</p>
          </div>
          <Link
            href="/chat"
            className="group inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-foreground px-6 text-[15px] font-medium text-background transition-all duration-300 hover:-translate-y-0.5"
          >
            Open the chatbot
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
