import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { GithubMark, LogoMark } from "@/components/brand";
import { Reveal } from "@/components/reveal";
import { AUTHOR_URL, GITHUB_URL } from "@/lib/config";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { label: "Overview", href: "#overview" },
      { label: "Architecture", href: "#architecture" },
      { label: "Capabilities", href: "#capabilities" },
      { label: "Tech stack", href: "#stack" },
    ],
  },
  {
    title: "Product",
    links: [
      { label: "Chatbot", href: "/chat" },
      { label: "Source code", href: GITHUB_URL, external: true },
    ],
  },
  {
    title: "Sources",
    links: [
      { label: "Slack", href: "#overview" },
      { label: "Notion", href: "#overview" },
      { label: "Google Drive", href: "#overview" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden bg-foreground text-white">
      <div className="drift pointer-events-none absolute -top-40 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-5 pt-20 sm:px-8 sm:pt-24">
        <Reveal>
          <div className="grid gap-14 lg:grid-cols-[1.3fr_2fr]">
            <div>
              <Link href="/" className="inline-flex items-center gap-2.5">
                <LogoMark inverted />
                <span className="text-[15px] font-semibold tracking-tight">
                  Enterprise KB Agent
                </span>
              </Link>
              <p className="mt-5 max-w-xs leading-relaxed text-white/55">
                One question, every source of truth. A multi-agent assistant for knowledge scattered
                across Slack, Notion and Google Drive.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/chat"
                  className="group inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-foreground transition-transform duration-300 hover:-translate-y-0.5"
                >
                  Try it live
                  <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="GitHub repository"
                  className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 text-white/80 transition-colors hover:border-white/40 hover:text-white"
                >
                  <GithubMark />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              {COLUMNS.map((col) => (
                <div key={col.title}>
                  <p className="text-xs font-medium tracking-[0.18em] text-white/40 uppercase">
                    {col.title}
                  </p>
                  <ul className="mt-5 space-y-3 text-sm">
                    {col.links.map((l) => (
                      <li key={l.label}>
                        {"external" in l && l.external ? (
                          <a
                            href={l.href}
                            target="_blank"
                            rel="noreferrer"
                            className="group inline-flex items-center gap-1 text-white/70 transition-colors hover:text-white"
                          >
                            {l.label}
                            <ArrowUpRight className="size-3 opacity-50 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
                          </a>
                        ) : (
                          <Link
                            href={l.href}
                            className="text-white/70 transition-colors hover:text-white"
                          >
                            {l.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div
          aria-hidden="true"
          className="mt-20 bg-gradient-to-b from-white/[0.14] to-white/0 bg-clip-text text-center text-[18vw] leading-[0.8] font-bold tracking-tighter text-transparent select-none lg:text-[13rem]"
        >
          KB Agent
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 py-8 text-sm text-white/45 sm:flex-row">
          <p>© {year} Enterprise KB Agent. All rights reserved.</p>
          <p>
            Designed and developed by{" "}
            <a
              href={AUTHOR_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-white underline decoration-accent decoration-2 underline-offset-4 transition-colors hover:text-accent"
            >
              Jamshed
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
