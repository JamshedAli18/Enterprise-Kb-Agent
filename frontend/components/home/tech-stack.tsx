import type { LucideIcon } from "lucide-react";
import { AppWindow, AudioLines, BrainCircuit, Database, Server, Workflow } from "lucide-react";
import { Reveal } from "@/components/reveal";

type Tool = { name: string; role: string; mono: string };

const LAYERS: { icon: LucideIcon; name: string; body: string; tools: Tool[] }[] = [
  {
    icon: AppWindow,
    name: "Interface",
    body: "Product page and streaming chat client.",
    tools: [{ name: "Next.js", role: "App Router UI", mono: "N" }],
  },
  {
    icon: Server,
    name: "API and delivery",
    body: "Streams answers over SSE from a containerised service.",
    tools: [
      { name: "FastAPI", role: "SSE streaming API", mono: "Fa" },
      { name: "Docker", role: "Container image", mono: "Dk" },
      { name: "Render", role: "Cloud hosting", mono: "R" },
    ],
  },
  {
    icon: Workflow,
    name: "Orchestration",
    body: "Stateful agent graph with per-source tool servers.",
    tools: [
      { name: "LangGraph", role: "Agent state graph", mono: "LG" },
      { name: "LangChain", role: "Tool adapters", mono: "LC" },
      { name: "MCP", role: "Source tool servers", mono: "M" },
    ],
  },
  {
    icon: Database,
    name: "Retrieval",
    body: "Namespaced vector index with metadata filtering.",
    tools: [
      { name: "Pinecone", role: "Vector database", mono: "Pc" },
      { name: "Cohere", role: "embed-v4 embeddings", mono: "Co" },
    ],
  },
  {
    icon: BrainCircuit,
    name: "Language models",
    body: "Fast primary model with automatic fallback.",
    tools: [
      { name: "Groq", role: "Primary LLM", mono: "Gq" },
      { name: "Gemini", role: "Fallback LLM", mono: "Ge" },
    ],
  },
  {
    icon: AudioLines,
    name: "Voice",
    body: "Speech in and speech out around the same pipeline.",
    tools: [
      { name: "Whisper", role: "Speech to text (Groq)", mono: "W" },
      { name: "Deepgram", role: "Aura text to speech", mono: "Dg" },
    ],
  },
];

const MARQUEE = [
  "LangGraph",
  "LangChain",
  "MCP",
  "FastAPI",
  "Pinecone",
  "Cohere",
  "Groq",
  "Gemini",
  "Deepgram",
  "Whisper",
  "Docker",
  "Render",
  "Next.js",
];

export function TechStack() {
  return (
    <section id="stack" className="scroll-mt-16 border-t border-line">
      <div className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
        <Reveal>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
                Tech stack
              </p>
              <h2 className="mt-4 text-3xl leading-tight font-bold sm:text-4xl">
                Proven tools,
                <br className="hidden sm:block" /> composed layer by layer.
              </h2>
            </div>
            <p className="max-w-sm leading-relaxed text-muted">
              Thirteen technologies across six layers — each chosen for one job and wired together
              through clear interfaces.
            </p>
          </div>
        </Reveal>
      </div>

      <Reveal delay={100}>
        <div className="marquee-mask mt-14 overflow-hidden border-y border-line bg-surface py-5">
          <div className="marquee flex w-max">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
                {MARQUEE.map((name) => (
                  <span
                    key={name}
                    className="flex items-center text-2xl font-semibold tracking-tight text-foreground/80 sm:text-3xl"
                  >
                    <span className="px-6 sm:px-8">{name}</span>
                    <span className="size-1.5 rounded-full bg-accent" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:pb-32">
        <div className="relative">
          {/* spine */}
          <span className="absolute top-6 bottom-6 left-[19px] hidden w-px bg-gradient-to-b from-line via-accent/40 to-line md:block" />
          {LAYERS.map((layer, i) => (
            <Reveal key={layer.name} delay={i * 70}>
              <div
                className={`group relative grid gap-5 py-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-10 md:pl-16 ${i < LAYERS.length - 1 ? "border-b border-line" : ""}`}
              >
                <div className="flex items-start gap-4">
                  <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-foreground transition-all duration-500 group-hover:border-accent group-hover:bg-accent group-hover:text-white md:absolute md:top-7 md:left-0">
                    <layer.icon className="size-[18px]" strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="font-mono text-[11px] text-muted">
                      {String(i + 1).padStart(2, "0")} / {String(LAYERS.length).padStart(2, "0")}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">{layer.name}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{layer.body}</p>
                  </div>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {layer.tools.map((t) => (
                    <div
                      key={t.name}
                      className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_12px_24px_-16px_rgba(0,0,0,0.25)]"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-[11px] font-semibold tracking-tight text-background">
                        {t.mono}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{t.name}</p>
                        <p className="truncate text-xs text-muted">{t.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
