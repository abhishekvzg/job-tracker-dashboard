"use client";

import { useCallback, useEffect, useState } from "react";
import { CHALLENGE_DAYS, FOLLOW_UP_AFTER_DAYS } from "@/lib/types";
import type { DailyProgress, OutreachStats, Target } from "@/lib/db";

type Dashboard = { progress: DailyProgress; stats: OutreachStats; followUps: Target[] };

/**
 * The daily cold email discipline: today's quota, the streak, and who has gone quiet.
 * Sending happens in Claude — this is the scoreboard and the nudge.
 */
export function ColdEmailPanel({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [showQueue, setShowQueue] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/outreach?view=dashboard", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      // Scoreboard only — a failure here shouldn't disturb the applications table.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reload when applications change
    load();
  }, [load, refreshKey]);

  if (!data) return null;
  const { progress, stats, followUps } = data;
  const done = progress.sentToday >= progress.goal;

  return (
    <div className="mb-3.5 rounded-2xl border border-black/8 bg-white p-4 px-4.5 dark:border-white/10 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            Cold emails today
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex gap-1.5">
              {Array.from({ length: progress.goal }).map((_, i) => (
                <span
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full ${
                    i < progress.sentToday
                      ? "bg-orange-600"
                      : "border-2 border-neutral-300 dark:border-neutral-600"
                  }`}
                />
              ))}
            </div>
            <span className="text-[15px] font-black">
              {progress.sentToday}/{progress.goal}
            </span>
            {done && <span className="text-[12px] font-extrabold text-emerald-600 dark:text-emerald-400">done</span>}
          </div>
        </div>

        <Stat label="Streak" value={progress.streak > 0 ? `${progress.streak}d` : "—"} />
        <Stat
          label="Challenge"
          value={progress.challengeDay ? `Day ${Math.min(progress.challengeDay, CHALLENGE_DAYS)}/${CHALLENGE_DAYS}` : "—"}
        />
        <Stat label="Sent" value={String(stats.sent)} />
        <Stat
          label="Replies"
          value={stats.sent ? `${stats.replied} · ${stats.responseRate}%` : "—"}
          hint={stats.sent ? "8–10% is the target" : undefined}
        />
        <Stat label="Interviews" value={String(stats.interviews)} />

        {followUps.length > 0 && (
          <button
            onClick={() => setShowQueue((v) => !v)}
            className="ml-auto rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12.5px] font-extrabold text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
          >
            {followUps.length} follow-up{followUps.length === 1 ? "" : "s"} due {showQueue ? "▲" : "▼"}
          </button>
        )}
      </div>

      {showQueue && followUps.length > 0 && (
        <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/5">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            Silent for {FOLLOW_UP_AFTER_DAYS}+ days
          </div>
          <div className="flex flex-col gap-1.5">
            {followUps.map((t) => (
              <div key={`${t.applicationId}-${t.contactId}`} className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                <span className="font-extrabold">{t.contactName}</span>
                <span className="font-bold text-neutral-500 dark:text-neutral-400">{t.company}</span>
                <span className="text-[12px] font-bold text-amber-700 dark:text-amber-400">
                  {t.daysSinceLastEmail}d ago
                </span>
                {t.lastAngle && (
                  <span className="text-[12px] font-medium text-neutral-400 dark:text-neutral-500">— {t.lastAngle}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-[15px] font-black">{value}</div>
      {hint && <div className="text-[10.5px] font-bold text-neutral-400 dark:text-neutral-600">{hint}</div>}
    </div>
  );
}
