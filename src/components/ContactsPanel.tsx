"use client";

import { useState } from "react";
import { MAX_CONTACTS_PER_APPLICATION, type Contact } from "@/lib/types";
import { fmtDate, todayISO } from "@/lib/format";

type Draft = Omit<Contact, "id" | "applicationId">;

const EMPTY_DRAFT: Draft = { name: "", role: "", email: "", phone: "", linkedin: "", notes: "", lastContacted: "" };

const input =
  "w-full box-border rounded-[8px] border border-neutral-300 px-2.5 py-1.5 text-[13px] font-semibold outline-none focus:border-orange-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500";

/**
 * Points of contact for one application. Contacts belong to exactly one application,
 * so everything here is add/edit/remove in place — there's no shared picker.
 */
export function ContactsPanel({
  applicationId,
  contacts,
  onChanged,
}: {
  applicationId: string;
  contacts: Contact[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atLimit = contacts.length >= MAX_CONTACTS_PER_APPLICATION;

  function set(field: keyof Draft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  function startAdd() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setAdding(true);
    setError(null);
  }

  function startEdit(c: Contact) {
    setDraft({
      name: c.name,
      role: c.role,
      email: c.email,
      phone: c.phone,
      linkedin: c.linkedin,
      notes: c.notes,
      lastContacted: c.lastContacted,
    });
    setEditingId(c.id);
    setAdding(false);
    setError(null);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  async function save() {
    if (!draft.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const payload = { ...draft, applicationId };
      const res = await fetch("/api/contacts", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not save");
      cancel();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Contact) {
    if (!window.confirm(`Remove ${c.name} from this application?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts?id=${encodeURIComponent(c.id)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Could not remove");
      }
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function markContactedToday(c: Contact) {
    setBusy(true);
    setError(null);
    try {
      const today = todayISO();
      const res = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: c.id,
          applicationId,
          name: c.name,
          role: c.role,
          email: c.email,
          phone: c.phone,
          linkedin: c.linkedin,
          notes: c.notes,
          lastContacted: today,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Could not update");
      }
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          Points of contact
        </span>
        <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-600">
          {contacts.length}/{MAX_CONTACTS_PER_APPLICATION}
        </span>
        {!adding && !editingId && (
          <button
            onClick={startAdd}
            disabled={atLimit}
            title={atLimit ? `Limit of ${MAX_CONTACTS_PER_APPLICATION} reached` : undefined}
            className="text-[12px] font-extrabold text-orange-700 hover:underline disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline dark:text-orange-400 dark:disabled:text-neutral-600"
          >
            + Add person
          </button>
        )}
      </div>

      {error && (
        <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {contacts.length === 0 && !adding && (
        <p className="text-[13px] font-semibold text-neutral-400 dark:text-neutral-600">None yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {contacts.map((c) =>
          editingId === c.id ? (
            <ContactForm key={c.id} draft={draft} set={set} onSave={save} onCancel={cancel} busy={busy} />
          ) : (
            <div
              key={c.id}
              className="rounded-[10px] border border-black/8 bg-white px-3 py-2 dark:border-white/10 dark:bg-neutral-900"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[13.5px] font-extrabold">{c.name}</span>
                {c.role && (
                  <span className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400">{c.role}</span>
                )}
                {c.lastContacted && (
                  <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10.5px] font-extrabold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                    last contacted {fmtDate(c.lastContacted)}
                  </span>
                )}
              </div>

              <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12.5px] font-semibold">
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

              {c.notes && (
                <p className="mt-1 text-[12.5px] font-medium leading-snug text-neutral-600 dark:text-neutral-400">
                  {c.notes}
                </p>
              )}

              <div className="mt-1.5 flex flex-wrap gap-2">
                <button
                  onClick={() => markContactedToday(c)}
                  disabled={busy}
                  className="rounded-[8px] border border-black/12 bg-white px-2 py-1 text-[11.5px] font-extrabold hover:bg-neutral-50 disabled:opacity-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
                >
                  Contacted today
                </button>
                <button
                  onClick={() => startEdit(c)}
                  className="rounded-[8px] border border-black/12 bg-white px-2 py-1 text-[11.5px] font-extrabold hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(c)}
                  disabled={busy}
                  className="rounded-[8px] border border-red-200 bg-white px-2 py-1 text-[11.5px] font-extrabold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:bg-neutral-800 dark:text-red-400"
                >
                  Remove
                </button>
              </div>
            </div>
          )
        )}

        {adding && <ContactForm draft={draft} set={set} onSave={save} onCancel={cancel} busy={busy} />}
      </div>
    </div>
  );
}

function ContactForm({
  draft,
  set,
  onSave,
  onCancel,
  busy,
}: {
  draft: Draft;
  set: (field: keyof Draft, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-[10px] border border-dashed border-neutral-300 bg-white p-2.5 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={input} placeholder="Name *" value={draft.name} onChange={(e) => set("name", e.target.value)} />
        <input className={input} placeholder="Role" value={draft.role} onChange={(e) => set("role", e.target.value)} />
        <input className={input} placeholder="Email" value={draft.email} onChange={(e) => set("email", e.target.value)} />
        <input className={input} placeholder="Phone" value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
        <input
          className={input}
          placeholder="LinkedIn URL"
          value={draft.linkedin}
          onChange={(e) => set("linkedin", e.target.value)}
        />
        <label className="flex items-center gap-2 text-[11.5px] font-bold text-neutral-500 dark:text-neutral-400">
          Last contacted
          <input
            type="date"
            className={input}
            value={draft.lastContacted}
            onChange={(e) => set("lastContacted", e.target.value)}
          />
        </label>
      </div>
      <textarea
        className={`${input} mt-2 resize-y font-medium`}
        rows={2}
        placeholder="Notes — how you know them, what you discussed…"
        value={draft.notes}
        onChange={(e) => set("notes", e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={onCancel}
          className="rounded-[8px] border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-extrabold hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!draft.name.trim() || busy}
          className="rounded-[8px] bg-orange-600 px-3 py-1.5 text-[12px] font-extrabold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
