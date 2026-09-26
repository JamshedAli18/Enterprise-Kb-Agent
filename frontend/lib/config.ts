export const DEFAULT_API_BASE_URL = "https://enterprise-kb-agent.onrender.com";

/** Upstream FastAPI service. Read server-side by the /api proxy routes. */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

export const GITHUB_URL = "https://github.com/JamshedAli18/Enterprise-Kb-Agent";

export const AUTHOR_URL = "https://github.com/JamshedAli18";
