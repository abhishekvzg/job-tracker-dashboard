"use client";

import { useState } from "react";
import { STATUS_OPTIONS, CHANNEL_OPTIONS, NEXT_STATUSES, type Contact } from "@/lib/types";

export type AppFormState = {
  id: string | null;
  company: string;
  url: string;
  status: string;
  channel: string;
  remarks: string;
  extra: string;
  dateApplied: string;
  contactIds: string[];
  primaryContactId: string | null;
};

type Props = {
  form: AppFormState;
  saving: boolean;
  contacts: Contact[];
  onChange: (field: keyof AppFormState, value: string) => void;
  onContactsChange: (contactIds: string[], primaryContactId: string | null) => void;
  onContactCreated: (contact: Contact) => void;
  onCancel: () => void;
  onSave: () => void;
};

const inputClasses =
  "w-full box-border rounded-[10px] border border-neutral-300 px-3.5 py-2.5 text-[14.5px] font-semibold outline-none focus:border-orange-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500";

export function AppFormModal({
  form,
  saving,
  contacts,
  onChange,
  onContactsChange,
  onContactCreated,
  onCancel,
  onSave,
}: Props) {
  const [addingContact, setAddingContact] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLinkedin, setNewLinkedin] = useState("");
  const [creating, setCreating] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  const canSave = form.company.trim().length > 0 && !saving;
  const suggested = NEXT_STATUSES[form.status] ?? [];

  function toggleContact(id: string) {
    const next = form.contactIds.includes(id)
      ? form.contactIds.filter((c) => c !== id)
      : [...form.contactIds, id];
    const primary = next.includes(form.primaryContactId ?? "") ? form.primaryContactId : (next[0] ?? null);
    onContactsChange(next, primary);
  }

  async function createContact() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          role: "",
          company: form.company,
          email: "",
          phone: "",
          linkedin: newLinkedin.trim(),
          notes: "",
        }),
      });
      const json = await res.json();
      if (res.ok && json.contact) {
        onContactCreated(json.contact as Contact);
        onContactsChange([...form.contactIds, json.contact.id], form.primaryContactId ?? json.contact.id);
        setNewName("");
        setNewLinkedin("");
        setAddingContact(false);
      }
    } finally {
      setCreating(false);
    }
  }

  const q = contactSearch.trim().toLowerCase();
  const visible = q
    ? contacts.filter((c) => [c.name, c.company, c.role].some((v) => v.toLowerCase().includes(q)))
    : contacts;

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
                    {suggested.includes(s) ? `→ ${s}` : s}
                  </option>
                ))}
              </select>
              {suggested.length > 0 && (
                <p className="mt-1 text-[11.5px] font-semibold text-neutral-400 dark:text-neutral-500">
                  Usually next: {suggested.join(" or ")}
                </p>
              )}
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

          <Field label="Date applied">
            <input
              type="date"
              value={form.dateApplied}
              onChange={(e) => onChange("dateApplied", e.target.value)}
              className={inputClasses}
            />
          </Field>

          {/* Contacts */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[12.5px] font-extrabold text-neutral-500 dark:text-neutral-400">
                Points of contact
              </label>
              <button
                type="button"
                onClick={() => setAddingContact((v) => !v)}
                className="text-[12px] font-extrabold text-orange-700 hover:underline dark:text-orange-400"
              >
                {addingContact ? "Cancel" : "+ New person"}
              </button>
            </div>

            {addingContact && (
              <div className="mb-2.5 flex flex-col gap-2 rounded-[10px] border border-dashed border-neutral-300 p-2.5 dark:border-neutral-700">
                <input
                  className={inputClasses}
                  placeholder="Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <input
                  className={inputClasses}
                  placeholder="LinkedIn URL (optional)"
                  value={newLinkedin}
                  onChange={(e) => setNewLinkedin(e.target.value)}
                />
                <button
                  type="button"
                  onClick={createContact}
                  disabled={!newName.trim() || creating}
                  className="rounded-[10px] bg-neutral-900 py-2 text-[13px] font-extrabold text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                >
                  {creating ? "Adding…" : "Add & attach"}
                </button>
              </div>
            )}

            {contacts.length > 3 && (
              <input
                className={`${inputClasses} mb-2`}
                placeholder="Search people…"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
              />
            )}

            {contacts.length === 0 ? (
              <p className="text-[13px] font-semibold text-neutral-400 dark:text-neutral-500">
                No contacts saved yet — add one above.
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto rounded-[10px] border border-neutral-200 dark:border-neutral-700">
                {visible.map((c) => {
                  const checked = form.contactIds.includes(c.id);
                  const isPrimary = form.primaryContactId === c.id;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-2.5 border-b border-neutral-100 px-3 py-2 last:border-0 dark:border-neutral-800"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleContact(c.id)}
                        className="h-4 w-4 accent-orange-600"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-bold">{c.name}</div>
                        {(c.role || c.company) && (
                          <div className="truncate text-[11.5px] font-semibold text-neutral-400 dark:text-neutral-500">
                            {[c.role, c.company].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>
                      {checked && (
                        <button
                          type="button"
                          onClick={() => onContactsChange(form.contactIds, c.id)}
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                            isPrimary
                              ? "bg-orange-600 text-white"
                              : "border border-neutral-300 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-400"
                          }`}
                        >
                          {isPrimary ? "Primary" : "Set primary"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
