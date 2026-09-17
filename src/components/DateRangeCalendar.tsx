"use client";

import { todayISO } from "@/lib/format";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Props = {
  month: string; // "YYYY-MM"
  dateFrom: string;
  dateTo: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (dateStr: string) => void;
  onDone: () => void;
};

export function DateRangeCalendar({ month, dateFrom, dateTo, onPrevMonth, onNextMonth, onSelectDay, onDone }: Props) {
  const [y, m] = month.split("-").map(Number);
  const firstOfMonth = new Date(y, m - 1, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const todayStr = todayISO();

  const cells: { day: number | null; dateStr: string }[] = [];
  for (let i = 0; i < startOffset; i++) cells.push({ day: null, dateStr: "" });
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, dateStr: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}` });
  }

  return (
    <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[296px] rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={onPrevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-sm font-bold text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
        >
          ‹
        </button>
        <div className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100">
          {MONTH_LABELS[m - 1]} {y}
        </div>
        <button
          onClick={onNextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-sm font-bold text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAY_LABELS.map((wd) => (
          <div key={wd} className="py-1 text-center text-[11px] font-extrabold text-neutral-400 dark:text-neutral-500">
            {wd}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, i) => {
          if (cell.day === null) return <div key={i} />;
          const isStart = cell.dateStr === dateFrom;
          const isEnd = cell.dateStr === dateTo;
          const inRange = !!dateFrom && !!dateTo && cell.dateStr > dateFrom && cell.dateStr < dateTo;
          const isToday = cell.dateStr === todayStr;

          let classes = "text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800";
          if (isStart || isEnd) classes = "bg-orange-600 text-white hover:bg-orange-700";
          else if (inRange)
            classes =
              "bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:hover:bg-orange-500/30";
          else if (isToday)
            classes = "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700";

          return (
            <button
              key={cell.dateStr}
              onClick={() => onSelectDay(cell.dateStr)}
              className={`aspect-square rounded-lg text-[12.5px] font-bold ${classes}`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={onDone}
          className="rounded-lg bg-orange-600 px-4 py-2 text-[12.5px] font-extrabold text-white hover:bg-orange-700"
        >
          Done
        </button>
      </div>
    </div>
  );
}
