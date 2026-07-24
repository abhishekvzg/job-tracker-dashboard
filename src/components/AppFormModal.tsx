"use client";

import { STATUS_OPTIONS, CHANNEL_OPTIONS, type JobApp } from "@/lib/types";

export type AppFormState = Omit<JobApp, "id"> & { id: string | null };

type Props = {
  form: AppFormState;
  saving: boolean;
  onChange: (field: keyof AppFormState, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

const inputClasses =
  "w-full box-border rounded-[10px] border border-neutral-300 px-3.5 py-2.5 text-[14.5px] font-semibold outline-none focus:border-orange-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500";

export function AppFormModal({ form, saving, onChange, onCancel, onSave }: Props) {
  const canSave = form.company.trim().length > 0 && !saving;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-neutral-900/45 p-5 dark:bg-black/60"
      onClick={onCancel}
    >
      <div
        className="max-h-[88vh] w-full max-w-[460px] overflow-y-auto rounded-2xl bg-white p-7 shadow-2xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-lg font-black text-neutral-900 dark:text-neutral-100">
          {form.id ? "Edit Application" : "Add Application"}
        </div>

        <div className="flex flex-col gap-3.5">
          <Field label="Company *">
            <input
              type="text"
              value={form.company}
              onChange={(e) => onChange("company", e.target.value)}
              placeholder="e.g. Phenom"
              className={inputClasses}
            />
          </Field>

          <Field label="Application URL">
            <input
              type="text"
              value={form.url}
              onChange={(e) => onChange("url", e.target.value)}
              placeholder="https://..."
              className={inputClasses}
            />
          </Field>

          <div className="flex gap-3">
            <Field label="Status" className="flex-1">
              <select value={form.status} onChange={(e) => onChange("status", e.target.value)} className={inputClasses}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Channel" className="flex-1">
              <select value={form.channel} onChange={(e) => onChange("channel", e.target.value)} className={inputClasses}>
                <option value="">—</option>
                {CHANNEL_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex gap-3">
            <Field label="POC" className="flex-1">
              <input
                type="text"
                value={form.poc}
                onChange={(e) => onChange("poc", e.target.value)}
                placeholder="Name"
                className={inputClasses}
              />
            </Field>
            <Field label="Date applied" className="flex-1">
              <input
                type="date"
                value={form.dateApplied}
                onChange={(e) => onChange("dateApplied", e.target.value)}
                className={inputClasses}
              />
            </Field>
          </div>

          <Field label="Remarks">
            <textarea
              value={form.remarks}
              onChange={(e) => onChange("remarks", e.target.value)}
              placeholder="Notes, follow-ups, interview details..."
              rows={3}
              className={`${inputClasses} resize-y font-medium`}
            />
          </Field>
        </div>

        <div className="mt-6 flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 rounded-[10px] border border-neutral-300 bg-white py-3 text-[14.5px] font-extrabold text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!canSave}
            className="flex-1 rounded-[10px] bg-orange-600 py-3 text-[14.5px] font-extrabold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[12.5px] font-extrabold text-neutral-500 dark:text-neutral-400">{label}</label>
      {children}
    </div>
  );
}
