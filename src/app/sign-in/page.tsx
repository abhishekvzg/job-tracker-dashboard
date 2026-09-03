"use client";

import { useState } from "react";

// Params Better Auth's OAuth provider cares about when re-starting /oauth2/authorize
// after login. Signing/expiry params (sig, exp, ba_pl, ...) are intentionally dropped —
// a fresh authorize call is simplest once a session cookie exists.
const OAUTH_PARAMS = [
  "client_id",
  "redirect_uri",
  "response_type",
  "scope",
  "state",
  "code_challenge",
  "code_challenge_method",
  "resource",
];

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || json.error || "Sign in failed");
      }

      const incoming = new URLSearchParams(window.location.search);
      const forward = new URLSearchParams();
      for (const key of OAUTH_PARAMS) {
        const value = incoming.get(key);
        if (value) forward.set(key, value);
      }

      if ([...forward.keys()].length > 0) {
        window.location.href = `/api/auth/oauth2/authorize?${forward.toString()}`;
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fdfcfb] p-6 dark:bg-neutral-950">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-black/8 bg-white p-7 dark:border-white/10 dark:bg-neutral-900"
      >
        <h1 className="mb-1 text-lg font-black text-neutral-900 dark:text-neutral-100">Sign in</h1>
        <p className="mb-5 text-sm text-neutral-500 dark:text-neutral-400">Job Application Tracker</p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <label className="mb-3 block">
          <span className="mb-1 block text-[12.5px] font-extrabold text-neutral-500 dark:text-neutral-400">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-[10px] border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-orange-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </label>

        <label className="mb-5 block">
          <span className="mb-1 block text-[12.5px] font-extrabold text-neutral-500 dark:text-neutral-400">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[10px] border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-orange-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-[10px] bg-orange-600 py-2.5 text-sm font-extrabold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
