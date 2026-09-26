import Link from "next/link";

/** GitHub mark (lucide-react no longer ships brand icons). */
export function GithubMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export function LogoMark({
  className = "size-7",
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  const bg = inverted ? "#fff" : "var(--foreground)";
  const fg = inverted ? "var(--foreground)" : "#fff";
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" className={className}>
      <rect width="28" height="28" rx="7" fill={bg} />
      <circle cx="9" cy="9" r="2.2" fill={fg} />
      <circle cx="9" cy="19" r="2.2" fill={fg} />
      <circle cx="19.5" cy="14" r="2.8" fill="var(--accent)" />
      <path d="M11 9.8 17 13M11 18.2 17 15" stroke={fg} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">Enterprise KB Agent</span>
    </Link>
  );
}
