"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DateRangeCalendar } from "@/components/DateRangeCalendar";
import { AppFormModal, type AppFormState } from "@/components/AppFormModal";
import { ChatWidget } from "@/components/ChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CHANNEL_OPTIONS, STATUS_OPTIONS, type JobApp } from "@/lib/types";
import { fmtDate, fmtShort, statusStyle } from "@/lib/format";

type SortKey = "company" | "status" | "date" | "channel";
type SortDir = "asc" | "desc";

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
  const [apps, setApps] = useState<JobApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterChannel, setFilterChannel] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(monthNow());

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<AppFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingSheets, setExportingSheets] = useState(false);

  const loadApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/applications", { cache: "no-store" });
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount
    loadApps();
  }, [loadApps]);

  const exportToSheets = useCallback(async () => {
    setExportingSheets(true);
    setError(null);
    try {
      const res = await fetch("/api/export/sheets", { method: "POST" });
      if (res.status === 401) {
        window.location.href = "/api/auth/google";
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Export failed");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExportingSheets(false);
    }
  }, []);

  useEffect(() => {
    // Google OAuth callback redirects here with this flag once the user has connected;
    // pick the export back up automatically instead of making them click twice.
    const params = new URLSearchParams(window.location.search);
    if (!params.has("exportToSheets")) return;
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resume export after OAuth redirect
    exportToSheets();
  }, [exportToSheets]);

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
        ? await fetch("/api/applications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: form.id, ...payload }),
          })
        : await fetch("/api/applications", {
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
    if (!window.confirm(`Delete the application for "${app.company}"? This removes it from your tracker.`)) {
      return;
    }
    setDeletingId(app.id);
    setError(null);
    try {
      const res = await fetch(`/api/applications?id=${encodeURIComponent(app.id)}`, { method: "DELETE" });
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
    const list = apps.filter((a) => {
      if (q && !a.company.toLowerCase().includes(q)) return false;
      if (filterStatus !== "All" && a.status !== filterStatus) return false;
      if (filterChannel !== "All" && (a.channel || "") !== filterChannel) return false;
      if (dateFrom && (!a.dateApplied || a.dateApplied < dateFrom)) return false;
      if (dateTo && (!a.dateApplied || a.dateApplied > dateTo)) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return list.slice().sort((a, b) => {
      let cmp = 0;
      if (sortKey === "company") cmp = a.company.localeCompare(b.company);
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      else if (sortKey === "channel") cmp = (a.channel || "").localeCompare(b.channel || "");
      else cmp = (a.dateApplied || "").localeCompare(b.dateApplied || "");
      if (cmp === 0) cmp = a.company.localeCompare(b.company);
      return cmp * dir;
    });
  }, [apps, search, filterStatus, filterChannel, dateFrom, dateTo, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  }

  async function changeStatus(app: JobApp, status: string) {
    if (status === app.status) return;
    setStatusSavingId(app.id);
    setError(null);
    try {
      const res = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: app.id,
          company: app.company,
          url: app.url,
          status,
          channel: app.channel,
          poc: app.poc,
          remarks: app.remarks,
          extra: app.extra,
          dateApplied: app.dateApplied,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Status update failed");
      }
      await loadApps();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStatusSavingId(null);
    }
  }

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

  if (loading && apps.length === 0) return <Center>Loading…</Center>;

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
          <a
            href="/api/export/xlsx"
            className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            Download Excel
          </a>
          <button
            onClick={exportToSheets}
            disabled={exportingSheets}
            className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            {exportingSheets ? "Exporting…" : "Export to Google Sheets"}
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

      {/* Applications list */}
      <div className="overflow-x-auto rounded-2xl border border-black/8 bg-white shadow-[0_1px_2px_rgba(31,26,23,0.03)] dark:border-white/10 dark:bg-neutral-900 dark:shadow-none">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-black/8 dark:border-white/10">
              {(
                [
                  ["company", "Company"],
                  ["status", "Status"],
                  ["date", "Date applied"],
                  ["channel", "Channel"],
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <th key={key} className="p-0">
                  <button
                    onClick={() => toggleSort(key)}
                    className="flex w-full items-center gap-1.5 px-4 py-3 text-[12.5px] font-extrabold uppercase tracking-wide text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                  >
                    {label}
                    <span className={`text-[10px] ${sortKey === key ? "opacity-100" : "opacity-25"}`}>
                      {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : "▲▼"}
                    </span>
                  </button>
                </th>
              ))}
              <th className="w-10 p-0" aria-label="Expand" />
            </tr>
          </thead>
          <tbody>
            {filteredApps.map((app) => {
              const expanded = expandedId === app.id;
              return (
                <FragmentRow
                  key={app.id}
                  app={app}
                  expanded={expanded}
                  statusSaving={statusSavingId === app.id}
                  deleting={deletingId === app.id}
                  onToggle={() => setExpandedId(expanded ? null : app.id)}
                  onChangeStatus={(s) => changeStatus(app, s)}
                  onEdit={() => openEditModal(app)}
                  onDelete={() => deleteApp(app)}
                />
              );
            })}
          </tbody>
        </table>
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

function FragmentRow({
  app,
  expanded,
  statusSaving,
  deleting,
  onToggle,
  onChangeStatus,
  onEdit,
  onDelete,
}: {
  app: JobApp;
  expanded: boolean;
  statusSaving: boolean;
  deleting: boolean;
  onToggle: () => void;
  onChangeStatus: (status: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-black/5 transition-colors hover:bg-orange-50/40 dark:border-white/5 dark:hover:bg-neutral-800/60 ${
          expanded ? "bg-orange-50/60 dark:bg-neutral-800/80" : ""
        }`}
      >
        <td className="px-4 py-3 text-[14.5px] font-extrabold">{app.company}</td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <select
            value={app.status}
            disabled={statusSaving}
            onChange={(e) => onChangeStatus(e.target.value)}
            className={`cursor-pointer appearance-none rounded-full border-0 px-3 py-1.5 pr-6 text-[12px] font-extrabold outline-none disabled:opacity-50 ${statusStyle(app.status)}`}
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='6'%3E%3Cpath d='M0 0l4 6 4-6z' fill='%23888'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px center",
            }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 text-[13.5px] font-bold text-neutral-600 dark:text-neutral-400">
          {fmtDate(app.dateApplied)}
        </td>
        <td className="px-4 py-3 text-[13.5px] font-bold text-neutral-600 dark:text-neutral-400">
          {app.channel || <span className="text-neutral-400 dark:text-neutral-600">—</span>}
        </td>
        <td className="px-3 py-3 text-center text-[11px] text-neutral-400">{expanded ? "▲" : "▼"}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-black/5 bg-[#fdfcfb] dark:border-white/5 dark:bg-neutral-950/40">
          <td colSpan={5} className="px-5 py-4">
            <div className="grid gap-x-8 gap-y-2.5 text-[13.5px] sm:grid-cols-2">
              <DetailField label="Listing URL">
                {app.url ? (
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="break-all font-bold text-orange-700 underline-offset-2 hover:underline dark:text-orange-400"
                  >
                    {app.url}
                  </a>
                ) : (
                  <Muted>None</Muted>
                )}
              </DetailField>
              <DetailField label="Point of contact">
                {app.poc ? <span className="font-bold">{app.poc}</span> : <Muted>None saved</Muted>}
              </DetailField>
              <DetailField label="Remarks">
                {app.remarks ? (
                  <span className="font-medium leading-snug text-neutral-700 dark:text-neutral-300">{app.remarks}</span>
                ) : (
                  <Muted>None</Muted>
                )}
              </DetailField>
              {app.extra && (
                <DetailField label="Extra">
                  <span className="font-medium leading-snug text-neutral-700 dark:text-neutral-300">{app.extra}</span>
                </DetailField>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {app.url && (
                <a
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-[10px] bg-neutral-900 px-3.5 py-2 text-[13px] font-extrabold text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                >
                  View Listing →
                </a>
              )}
              <button
                onClick={onEdit}
                className="rounded-[10px] border border-black/12 bg-white px-3.5 py-2 text-[13px] font-extrabold hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
              >
                Edit
              </button>
              <button
                onClick={onDelete}
                disabled={deleting}
                className="rounded-[10px] border border-red-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:bg-neutral-800 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                {deleting ? "…" : "Delete"}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        {label}
      </div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-neutral-400 dark:text-neutral-600">{children}</span>;
}
