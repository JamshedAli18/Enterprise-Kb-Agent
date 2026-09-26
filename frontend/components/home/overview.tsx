import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, FileText, HardDrive, Hash, Sparkles } from "lucide-react";
import { Reveal } from "@/components/reveal";

export function Overview() {
  return (
    <section id="overview" className="scroll-mt-16 border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <Reveal>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
                Overview
              </p>
              <h2 className="mt-4 text-3xl leading-tight font-bold sm:text-4xl">
                A single assistant for knowledge
                <br className="hidden sm:block" /> scattered across tools.
              </h2>
            </div>
            <p className="max-w-sm leading-relaxed text-muted">
              Company knowledge lives in chat threads, wiki pages and shared drives. Instead of
              searching each one, ask once in plain language.
            </p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <ConvergenceCard />
        </Reveal>

        <div className="mt-4 grid gap-4 md:grid-cols-3 [&>*]:min-w-0">
          <Reveal delay={0}>
            <SourceCard
              icon={Hash}
              name="Slack"
              stat="24 messages · 7 channels"
              body="Release notes, incident threads and team announcements."
              filters={["channel", "date_from", "date_to"]}
              preview={<SlackPreview />}
            />
          </Reveal>
          <Reveal delay={90}>
            <SourceCard
              icon={FileText}
              name="Notion"
              stat="10 pages"
              body="Policies, handbooks and runbooks — the written record of how things work."
              filters={["page"]}
              preview={<NotionPreview />}
            />
          </Reveal>
          <Reveal delay={180}>
            <SourceCard
              icon={HardDrive}
              name="Google Drive"
              stat="8 documents · 6 folders"
              body="Pricing sheets, whitepapers, postmortems and templates."
              filters={["folder", "filetype"]}
              preview={<DrivePreview />}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------------- convergence (hero card) ---------------- */

const POINTS = [
  "No switching between tools or guessing where something lives",
  "Every answer cites the source it came from",
  "Follow-up questions keep the conversation's context",
];

function ConvergenceCard() {
  const sources: { icon: LucideIcon; label: string; y: number; on: boolean }[] = [
    { icon: Hash, label: "Slack", y: 20, on: false },
    { icon: FileText, label: "Notion", y: 60, on: true },
    { icon: HardDrive, label: "Drive", y: 100, on: false },
  ];
  return (
    <article className="group mt-16 flex flex-col overflow-hidden rounded-3xl border border-line bg-surface p-2 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-foreground/15 hover:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.18)] lg:flex-row">
      <div className="flex flex-col justify-center p-6 sm:p-8 lg:flex-1 lg:pr-4">
        <h3 className="text-2xl leading-snug font-bold">
          Ask once.
          <br />
          <span className="text-muted">Get one grounded answer.</span>
        </h3>
        <p className="mt-4 max-w-md leading-relaxed text-muted">
          A supervisor agent decides which sources matter, specialist retrievers search them in
          parallel, and a language model writes a single answer from what they found.
        </p>
        <ul className="mt-6 space-y-3">
          {POINTS.map((p) => (
            <li key={p} className="flex items-start gap-3 text-[15px]">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                <Check className="size-3 text-accent" strokeWidth={2.5} />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>

      <div className="dot-grid relative flex min-h-72 items-center justify-center overflow-hidden rounded-[1.1rem] bg-background px-4 py-10 sm:px-8 lg:flex-[1.25]">
        <div className="drift pointer-events-none absolute right-10 bottom-0 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex w-full max-w-lg items-center">
          <div className="flex shrink-0 flex-col gap-3">
            {sources.map(({ icon: Icon, label, on }) => (
              <span
                key={label}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm ${
                  on ? "border-accent/30 bg-surface" : "border-line bg-surface text-muted"
                }`}
              >
                <Icon className={`size-3.5 ${on ? "text-accent" : ""}`} />
                {label}
              </span>
            ))}
          </div>
          <svg
            viewBox="0 0 80 120"
            preserveAspectRatio="none"
            className="h-32 w-10 shrink-0 sm:w-20"
            aria-hidden="true"
          >
            {sources.map((s) => (
              <path
                key={s.label}
                d={`M0 ${s.y} C 40 ${s.y}, 40 60, 80 60`}
                fill="none"
                vectorEffect="non-scaling-stroke"
                strokeWidth={1.5}
                className={s.on ? "dash-flow stroke-accent" : "dash-flow stroke-foreground/20"}
              />
            ))}
          </svg>
          <div className="float min-w-0 flex-1 rounded-2xl border border-line bg-surface p-4 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.25)]">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-accent-soft">
                <Sparkles className="size-3 text-accent" />
              </span>
              <span className="text-xs font-medium">Answer</span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed">
              All new parents, including adoptive and foster parents, are eligible for{" "}
              <span className="font-semibold">16 weeks of paid parental leave</span>, taken within
              the first 12 months.
            </p>
            <span className="mt-3 inline-flex max-w-full items-center gap-1 truncate rounded-md border border-line px-2 py-0.5 text-[11px] font-medium text-muted">
              <FileText className="size-3 shrink-0" />
              <span className="truncate">Notion · Parental Leave Policy</span>
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ---------------- per-source cards ---------------- */

function SourceCard({
  icon: Icon,
  name,
  stat,
  body,
  filters,
  preview,
}: {
  icon: LucideIcon;
  name: string;
  stat: string;
  body: string;
  filters: string[];
  preview: ReactNode;
}) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface p-2 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-foreground/15 hover:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.18)]">
      <div className="dot-grid relative h-48 overflow-hidden rounded-[1.1rem] bg-background p-4">
        {preview}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent" />
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft transition-colors duration-500 group-hover:bg-accent">
            <Icon
              className="size-4 text-accent transition-colors duration-500 group-hover:text-white"
              strokeWidth={2}
            />
          </span>
          <div>
            <h3 className="text-[17px] leading-tight font-semibold">{name}</h3>
            <p className="text-xs text-muted">{stat}</p>
          </div>
        </div>
        <p className="mt-3 leading-relaxed text-muted">{body}</p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-5">
          <span className="mr-1 text-[11px] text-muted">Filters</span>
          {filters.map((f) => (
            <span
              key={f}
              className="rounded-md bg-black/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-foreground/70"
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function SlackPreview() {
  const messages = [
    {
      channel: "pricing",
      author: "Alice",
      text: "Enterprise tier now includes unlimited seats; starter drops to $39/month.",
    },
    {
      channel: "incidents",
      author: "Jack",
      text: "Root cause identified: a bad config push to the load balancer. Rolling back now.",
    },
    {
      channel: "hr",
      author: "Grace",
      text: "Parental leave policy has been updated - now offering 16 weeks paid leave.",
    },
  ];
  return (
    <div className="space-y-2.5">
      {messages.map((m, i) => (
        <div
          key={m.channel}
          className="rounded-xl border border-line bg-surface p-2.5 shadow-sm transition-transform duration-500 group-hover:translate-x-1"
          style={{ transitionDelay: `${i * 60}ms` }}
        >
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="flex size-4 items-center justify-center rounded bg-foreground text-[8px] font-semibold text-background">
              {m.author[0]}
            </span>
            <span className="font-semibold">{m.author}</span>
            <span className="text-accent">#{m.channel}</span>
          </div>
          <p className="mt-1 truncate text-[11px] text-muted">{m.text}</p>
        </div>
      ))}
    </div>
  );
}

function NotionPreview() {
  const pages = [
    "Remote Work Policy",
    "Parental Leave Policy",
    "Incident Response Runbook",
    "Q3 Roadmap",
    "Security Policy",
  ];
  return (
    <div className="rounded-xl border border-line bg-surface p-2 shadow-sm">
      {pages.map((p, i) => (
        <div
          key={p}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] ${
            i === 1 ? "bg-accent-soft font-medium text-foreground" : "text-muted"
          }`}
        >
          <FileText className={`size-3.5 shrink-0 ${i === 1 ? "text-accent" : ""}`} />
          <span className="truncate">{p}</span>
        </div>
      ))}
    </div>
  );
}

function DrivePreview() {
  const files = [
    { name: "2026_pricing_sheet", folder: "Sales" },
    { name: "employee_handbook", folder: "HR" },
    { name: "incident_postmortem", folder: "Engineering" },
    { name: "security_whitepaper", folder: "Security" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {files.map((f, i) => (
        <div
          key={f.name}
          className="rounded-xl border border-line bg-surface p-2.5 shadow-sm transition-transform duration-500 group-hover:-translate-y-0.5"
          style={{ transitionDelay: `${i * 60}ms` }}
        >
          <div className="flex h-9 items-center justify-center rounded-md bg-black/[0.035]">
            <span className="rounded bg-foreground px-1 py-px font-mono text-[8px] font-semibold text-background">
              PDF
            </span>
          </div>
          <p className="mt-1.5 truncate text-[11px] font-medium">{f.name}</p>
          <p className="truncate text-[10px] text-muted">{f.folder}</p>
        </div>
      ))}
    </div>
  );
}
