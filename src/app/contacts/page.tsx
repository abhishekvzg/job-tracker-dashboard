"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { fmtDate } from "@/lib/format";
import type { JobApp } from "@/lib/types";

/**
 * Read-only directory of everyone across the tracker. Contacts belong to exactly one
 * application, so adding and editing happens inside that application's row.
 */
export default function ContactsPage() {
  const [apps, setApps] = useState<JobApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/applications", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setApps(json.apps as JobApp[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount
    load();
  }, [load]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps
      .filter((a) => a.contacts.length > 0)
      .map((a) => ({
        app: a,
        contacts: q
          ? a.contacts.filter((c) =>
              [c.name, c.role, c.email, a.company].some((v) => (v || "").toLowerCase().includes(q))
            )
          : a.contacts,
      }))
      .filter((g) => g.contacts.length > 0)
      .sort((x, y) => x.app.company.localeCompare(y.app.company));
  }, [apps, search]);

  const total = apps.reduce((n, a) => n + a.contacts.length, 0);

  return (
    <main className="min-h-screen bg-[#fdfcfb] px-[5vw] pb-20 pt-8 text-[#1f1a17] dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-[28px] font-black tracking-tight">Contacts</h1>
          <p className="mt-1 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
            {total} {total === 1 ? "person" : "people"} across {groups.length}{" "}
            {groups.length === 1 ? "company" : "companies"} · add or edit from an application&apos;s row
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/"
            className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            ← Applications
          </Link>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <input
        type="text"
        placeholder="Search people or companies…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-5 w-full max-w-xs rounded-[10px] border border-black/12 bg-white px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-orange-600 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
      />

      {loading && apps.length === 0 ? (
        <p className="py-10 text-center text-sm font-bold text-neutral-400">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-sm font-bold text-neutral-400 dark:text-neutral-500">
          {total === 0
            ? "No contacts yet — expand an application on the Applications page and add a person."
            : "Nobody matches that search."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map(({ app, contacts }) => (
            <div
              key={app.id}
              className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-neutral-900"
            >
              <div className="mb-2.5 flex items-baseline justify-between gap-2">
                <Link href="/" className="text-[15px] font-black hover:text-orange-700 dark:hover:text-orange-400">
                  {app.company}
                </Link>
                <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500">{app.status}</span>
              </div>

              <div className="flex flex-col gap-2.5">
                {contacts.map((c) => (
                  <div key={c.id} className="border-t border-black/5 pt-2 first:border-0 first:pt-0 dark:border-white/5">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[13.5px] font-extrabold">{c.name}</span>
                      {c.role && (
                        <span className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400">{c.role}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-[12.5px] font-semibold">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-orange-700 hover:underline dark:text-orange-400">
                          {c.email}
                        </a>
                      )}
                      {c.phone && <span className="text-neutral-500 dark:text-neutral-400">{c.phone}</span>}
                      {c.linkedin && (
                        <a
                          href={c.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-700 hover:underline dark:text-orange-400"
                        >
                          LinkedIn ↗
                        </a>
                      )}
                    </div>
                    {c.lastContacted && (
                      <div className="mt-0.5 text-[11.5px] font-bold text-neutral-400 dark:text-neutral-500">
                        last contacted {fmtDate(c.lastContacted)}
                      </div>
                    )}
                    {c.notes && (
                      <p className="mt-0.5 text-[12.5px] font-medium leading-snug text-neutral-600 dark:text-neutral-400">
                        {c.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
