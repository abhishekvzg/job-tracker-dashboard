"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DateRangeCalendar } from "@/components/DateRangeCalendar";
import { AppFormModal, type AppFormState } from "@/components/AppFormModal";
import { ChatWidget } from "@/components/ChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CHANNEL_OPTIONS, STATUS_OPTIONS, type JobApp } from "@/lib/types";
import { fmtDate, fmtShort, statusStyle } from "@/lib/format";

type AuthState = "loading" | "no-credentials" | "unauthenticated" | "authenticated";
type SortBy = "dateDesc" | "dateAsc" | "companyAz" | "status";

const EMPTY_FORM: AppFormState = {
  id: null,
  company: "",
  url: "",
  status: "Applied",
  channel: "",
  poc: "",
  remarks: "",
  extra: "",
  dateApplied: "",
};

const QUOTES = [
  "Every application is a rep. Reps build strength.",
  "You only need one yes.",
  "Rejection is redirection.",
  "Consistency beats intensity.",
  "The right door opens when you keep knocking.",
  "Progress, not perfection — one application at a time.",
  "Your future employer is still out there looking too.",
  "Small steps daily lead to big leaps eventually.",
  "Confidence is built one submitted application at a time.",
  "Not yet is not never.",
];

function monthNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [apps, setApps] = useState<JobApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterChannel, setFilterChannel] = useState("All");
  const [sortBy, setSortBy] = useState<SortBy>("dateDesc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(monthNow());

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<AppFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/status");
      const json = await res.json();
      if (!json.hasCredentials) setAuthState("no-credentials");
      else if (!json.authenticated) setAuthState("unauthenticated");
      else setAuthState("authenticated");
    } catch {
      setError("Could not reach the server.");
    }
  }, []);

  const loadApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sheet", { cache: "no-store" });
      if (res.status === 401) {
        setAuthState("unauthenticated");
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to load applications");
      }
      const json = await res.json();
      setApps(json.apps as JobApp[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial auth check on mount
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (authState === "authenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch sheet data once authenticated
      loadApps();
    }
  }, [authState, loadApps]);

  function openAddModal() {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEditModal(app: JobApp) {
    setForm({ ...app });
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
  }

  function updateForm(field: keyof AppFormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function saveForm() {
    if (!form.company.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        company: form.company,
        url: form.url,
        status: form.status,
        channel: form.channel,
        poc: form.poc,
        remarks: form.remarks,
        extra: form.extra,
        dateApplied: form.dateApplied,
      };
      const res = form.id
        ? await fetch("/api/sheet", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: form.id, ...payload }),
          })
        : await fetch("/api/sheet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Save failed");
      }
      setModalOpen(false);
      await loadApps();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteApp(app: JobApp) {
    if (!window.confirm(`Delete the application for "${app.company}"? This removes the row from your Google Sheet.`)) {
      return;
    }
    setDeletingId(app.id);
    setError(null);
    try {
      const res = await fetch(`/api/sheet?id=${encodeURIComponent(app.id)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Delete failed");
      }
      await loadApps();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  const channelOptions = useMemo(() => {
    const set = new Set<string>(CHANNEL_OPTIONS);
    apps.forEach((a) => {
      if (a.channel) set.add(a.channel);
    });
    return Array.from(set);
  }, [apps]);

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = apps.filter((a) => {
      if (q && !a.company.toLowerCase().includes(q)) return false;
      if (filterStatus !== "All" && a.status !== filterStatus) return false;
      if (filterChannel !== "All" && (a.channel || "") !== filterChannel) return false;
      if (dateFrom && (!a.dateApplied || a.dateApplied < dateFrom)) return false;
      if (dateTo && (!a.dateApplied || a.dateApplied > dateTo)) return false;
      return true;
    });
    list = list.slice().sort((a, b) => {
      if (sortBy === "companyAz") return a.company.localeCompare(b.company);
      if (sortBy === "status") return a.status.localeCompare(b.status);
      const da = a.dateApplied || "";
      const db = b.dateApplied || "";
      return sortBy === "dateAsc" ? da.localeCompare(db) : db.localeCompare(da);
    });
    return list;
  }, [apps, search, filterStatus, filterChannel, dateFrom, dateTo, sortBy]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const kpis = [
    { label: "Total Applications", value: apps.length },
    { label: "Applied Today", value: apps.filter((a) => a.dateApplied === todayStr).length },
    { label: "In Interview", value: apps.filter((a) => a.status === "Interview").length },
    { label: "Not Yet Applied", value: apps.filter((a) => a.status === "Not Applied").length },
  ];

  function selectCalendarDay(dateStr: string) {
    if (!dateFrom || (dateFrom && dateTo)) {
      setDateFrom(dateStr);
      setDateTo("");
      return;
    }
    if (dateStr < dateFrom) {
      setDateFrom(dateStr);
      return;
    }
    setDateTo(dateStr);
    setCalendarOpen(false);
  }

  function shiftMonth(delta: number) {
    const [y, m] = calendarMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  if (authState === "loading") return <Center>Loading…</Center>;

  if (authState === "no-credentials") {
    return (
      <Center>
        <p className="max-w-sm text-center text-sm text-neutral-600 dark:text-neutral-400">
          Missing{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
            credentials.json
          </code>{" "}
          in the project root.
        </p>
      </Center>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <Center>
        <a
          href="/api/auth/google"
          className="rounded bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700"
        >
          Connect Google Sheets
        </a>
      </Center>
    );
  }

  const dateRangeLabel = !dateFrom ? "Date range" : dateTo ? `${fmtShort(dateFrom)} – ${fmtShort(dateTo)}` : `${fmtShort(dateFrom)} – …`;

  return (
    <main className="min-h-screen bg-[#fdfcfb] px-[5vw] pb-20 pt-8 text-[#1f1a17] dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-[28px] font-black tracking-tight">Job Application Tracker</h1>
          <p className="mt-1 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
            {apps.length} application{apps.length === 1 ? "" : "s"} tracked
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={loadApps}
            disabled={loading}
            className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-[15px] font-extrabold text-white shadow-[0_6px_16px_rgba(234,88,12,0.28)] hover:bg-orange-700"
          >
            <span className="text-lg leading-none">+</span> Add Application
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {/* KPIs */}
      <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-black/8 bg-white p-4 px-4.5 dark:border-white/10 dark:bg-neutral-900"
          >
            <div className="text-[26px] font-black text-orange-600 dark:text-orange-500">{kpi.value}</div>
            <div className="text-[12.5px] font-bold text-neutral-500 dark:text-neutral-400">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-black/8 bg-white p-3.5 dark:border-white/10 dark:bg-neutral-900">
        <input
          type="text"
          placeholder="Search company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[130px] flex-[0_1_190px] rounded-[10px] border border-black/12 bg-[#fdfcfb] px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-orange-600 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
        />

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="cursor-pointer rounded-[10px] border border-black/12 bg-[#fdfcfb] px-3.5 py-2.5 text-sm font-bold outline-none dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
        >
          <option value="All">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={filterChannel}
          onChange={(e) => setFilterChannel(e.target.value)}
          className="cursor-pointer rounded-[10px] border border-black/12 bg-[#fdfcfb] px-3.5 py-2.5 text-sm font-bold outline-none dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
        >
          <option value="All">All channels</option>
          {channelOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="cursor-pointer rounded-[10px] border border-black/12 bg-[#fdfcfb] px-3.5 py-2.5 text-sm font-bold outline-none dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
        >
          <option value="dateDesc">Newest first</option>
          <option value="dateAsc">Oldest first</option>
          <option value="companyAz">Company A-Z</option>
          <option value="status">Status</option>
        </select>

        <div className="relative">
          <div className="flex items-stretch overflow-hidden rounded-[10px] border border-black/12 bg-[#fdfcfb] dark:border-white/10 dark:bg-neutral-800">
            <button
              onClick={() => setCalendarOpen((v) => !v)}
              className={`flex items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-[13.5px] font-bold ${
                dateFrom ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-400 dark:text-neutral-500"
              }`}
            >
              📅 {dateRangeLabel}
            </button>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setCalendarOpen(false);
                }}
                className="border-l border-black/10 px-3 text-[13px] font-extrabold text-neutral-400 hover:bg-neutral-100 hover:text-red-600 dark:border-white/10 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-red-400"
              >
                ✕
              </button>
            )}
          </div>

          {calendarOpen && (
            <DateRangeCalendar
              month={calendarMonth}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onPrevMonth={() => shiftMonth(-1)}
              onNextMonth={() => shiftMonth(1)}
              onSelectDay={selectCalendarDay}
              onDone={() => setCalendarOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
        {filteredApps.map((app) => (
          <div
            key={app.id}
            className="flex flex-col gap-3 rounded-2xl border border-black/8 bg-white p-5 shadow-[0_1px_2px_rgba(31,26,23,0.03)] dark:border-white/10 dark:bg-neutral-900 dark:shadow-none"
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="text-[16.5px] font-extrabold">{app.company}</div>
              <div className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${statusStyle(app.status)}`}>
                {app.status}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-[12.5px] font-bold">
              <span className="rounded-lg bg-neutral-100 px-2.5 py-1 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                {app.channel || "No channel"}
              </span>
              {app.poc && (
                <span className="rounded-lg bg-neutral-100 px-2.5 py-1 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                  POC: {app.poc}
                </span>
              )}
              <span className="rounded-lg bg-neutral-100 px-2.5 py-1 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                {fmtDate(app.dateApplied)}
              </span>
            </div>

            {app.remarks && (
              <div className="text-[13.5px] font-medium leading-snug text-neutral-600 dark:text-neutral-400">
                {app.remarks}
              </div>
            )}

            <div className="mt-1 flex gap-2">
              {app.url ? (
                <a
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-[10px] bg-neutral-900 px-3 py-2.5 text-center text-[13.5px] font-extrabold text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                >
                  View Listing →
                </a>
              ) : (
                <div className="flex-1 rounded-[10px] bg-neutral-100 px-3 py-2.5 text-center text-[13.5px] font-extrabold text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
                  No link
                </div>
              )}
              <button
                onClick={() => openEditModal(app)}
                className="rounded-[10px] border border-black/12 bg-white px-3.5 py-2.5 text-[13.5px] font-extrabold hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
              >
                Edit
              </button>
              <button
                onClick={() => deleteApp(app)}
                disabled={deletingId === app.id}
                className="rounded-[10px] border border-red-200 bg-white px-3.5 py-2.5 text-[13.5px] font-extrabold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:bg-neutral-800 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                {deletingId === app.id ? "…" : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && filteredApps.length === 0 && (
        <div className="py-16 text-center text-[15px] font-bold text-neutral-400 dark:text-neutral-500">
          No applications match your filters.
        </div>
      )}

      {/* Marquee */}
      <div className="relative mt-7 overflow-hidden rounded-2xl border border-black/8 bg-white py-2.5 dark:border-white/10 dark:bg-neutral-900">
        <div className="flex w-max animate-[marquee-scroll_48s_linear_infinite] gap-3.5 pl-3.5 hover:[animation-play-state:paused]">
          {[...QUOTES, ...QUOTES].map((q, i) => (
            <div
              key={i}
              className="flex w-[300px] flex-none items-center gap-2.5 rounded-[10px] border border-black/8 bg-[#fdfcfb] px-3.5 py-2.5 dark:border-white/10 dark:bg-neutral-800"
            >
              <div className="text-[17px] font-black leading-none text-orange-600 dark:text-orange-500">“</div>
              <div className="text-[12.5px] font-bold leading-snug">{q}</div>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <AppFormModal form={form} saving={saving} onChange={updateForm} onCancel={closeModal} onSave={saveForm} />
      )}

      <ChatWidget onApplied={loadApps} />
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">{children}</div>
  );
}
