export const STATUS_STYLES: Record<string, string> = {
  New: "bg-stone-100 text-stone-500 dark:bg-neutral-500/15 dark:text-neutral-300",
  Applied: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "HR Call": "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  Interview: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  Rejected: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  "Job Offered": "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

export function statusStyle(status: string): string {
  return STATUS_STYLES[status] ?? "bg-stone-100 text-stone-500 dark:bg-neutral-500/15 dark:text-neutral-300";
}

export function fmtShort(d: string): string {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtDate(d: string): string {
  if (!d) return "No date";
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
