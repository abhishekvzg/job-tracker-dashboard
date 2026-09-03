import { listApps, type JobApp } from "./db";

export type ResolveResult =
  | { status: "found"; app: JobApp }
  | { status: "not_found" }
  | { status: "ambiguous"; candidates: JobApp[] };

// Mirrors the fuzzy company matching interpretCommand() in gemini.ts asks the model
// to do (case-insensitive, partial match) — kept explicit here since MCP tool calls
// don't go through an LLM step of their own before hitting this server.
export async function resolveApp(params: { id?: string; company?: string }): Promise<ResolveResult> {
  const apps = await listApps();

  if (params.id) {
    const app = apps.find((a) => a.id === params.id);
    return app ? { status: "found", app } : { status: "not_found" };
  }

  const q = (params.company ?? "").trim().toLowerCase();
  if (!q) return { status: "not_found" };

  const exact = apps.filter((a) => a.company.toLowerCase() === q);
  if (exact.length === 1) return { status: "found", app: exact[0] };

  const partial = apps.filter((a) => a.company.toLowerCase().includes(q));
  if (partial.length === 1) return { status: "found", app: partial[0] };
  if (partial.length > 1) return { status: "ambiguous", candidates: partial };
  return { status: "not_found" };
}
