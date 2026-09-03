"use client";

import { useState } from "react";

// Fallback screen — the one real client (Claude) is registered with skip_consent,
// so /oauth2/authorize normally never redirects here. Kept correct in case a scope
// or client configuration change ever routes a request through consent.
export default function ConsentPage() {
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(accept: boolean) {
    setSubmitting(accept ? "approve" : "deny");
    setError(null);
    try {
      const oauthQuery = window.location.search.slice(1);
      const res = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept, oauth_query: oauthQuery }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.error || "Could not record consent");
      if (json.redirect_uri) {
        window.location.href = json.redirect_uri;
      } else {
        setError("No redirect returned — close this tab and try connecting again.");
        setSubmitting(null);
      }
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fdfcfb] p-6 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-2xl border border-black/8 bg-white p-7 dark:border-white/10 dark:bg-neutral-900">
        <h1 className="mb-3 text-lg font-black text-neutral-900 dark:text-neutral-100">Authorize access</h1>
        <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
          An application is requesting access to your Job Application Tracker.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex gap-2.5">
          <button
            onClick={() => respond(false)}
            disabled={submitting !== null}
            className="flex-1 rounded-[10px] border border-neutral-300 bg-white py-2.5 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {submitting === "deny" ? "…" : "Deny"}
          </button>
          <button
            onClick={() => respond(true)}
            disabled={submitting !== null}
            className="flex-1 rounded-[10px] bg-orange-600 py-2.5 text-sm font-extrabold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {submitting === "approve" ? "…" : "Approve"}
          </button>
        </div>
      </div>
    </main>
  );
}
