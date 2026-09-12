"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Contact } from "@/lib/types";

type FormState = Omit<Contact, "id"> & { id: string | null };

const EMPTY: FormState = {
  id: null,
  name: "",
  role: "",
  company: "",
  email: "",
  phone: "",
  linkedin: "",
  notes: "",
};

const inputClasses =
  "w-full box-border rounded-[10px] border border-neutral-300 px-3.5 py-2.5 text-[14.5px] font-semibold outline-none focus:border-orange-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load contacts");
      setContacts(json.contacts as Contact[]);
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

  function change(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { id, ...payload } = form;
      const res = await fetch("/api/contacts", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id, ...payload } : payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Save failed");
      }
      setForm(EMPTY);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(contact: Contact) {
    if (!window.confirm(`Delete ${contact.name}? They'll be unlinked from any applications.`)) return;
    setDeletingId(contact.id);
    setError(null);
    try {
      const res = await fetch(`/api/contacts?id=${encodeURIComponent(contact.id)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Delete failed");
      }
      if (form.id === contact.id) setForm(EMPTY);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? contacts.filter((c) =>
        [c.name, c.company, c.role, c.email].some((v) => v.toLowerCase().includes(q))
      )
    : contacts;

  return (
    <main className="min-h-screen bg-[#fdfcfb] px-[5vw] pb-20 pt-8 text-[#1f1a17] dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-[28px] font-black tracking-tight">Contacts</h1>
          <p className="mt-1 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
            {contacts.length} {contacts.length === 1 ? "person" : "people"} saved
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

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Add / edit form */}
        <div className="h-fit rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-neutral-900">
          <div className="mb-4 text-[15px] font-black">{form.id ? "Edit contact" : "Add contact"}</div>
          <div className="flex flex-col gap-3">
            <Field label="Name *">
              <input className={inputClasses} value={form.name} onChange={(e) => change("name", e.target.value)} placeholder="e.g. Suraaj" />
            </Field>
            <div className="flex gap-3">
              <Field label="Role" className="flex-1">
                <input className={inputClasses} value={form.role} onChange={(e) => change("role", e.target.value)} placeholder="Recruiter" />
              </Field>
              <Field label="Company" className="flex-1">
                <input className={inputClasses} value={form.company} onChange={(e) => change("company", e.target.value)} placeholder="Mastercard" />
              </Field>
            </div>
            <Field label="Email">
              <input className={inputClasses} value={form.email} onChange={(e) => change("email", e.target.value)} placeholder="name@company.com" />
            </Field>
            <div className="flex gap-3">
              <Field label="Phone" className="flex-1">
                <input className={inputClasses} value={form.phone} onChange={(e) => change("phone", e.target.value)} />
              </Field>
              <Field label="LinkedIn" className="flex-1">
                <input className={inputClasses} value={form.linkedin} onChange={(e) => change("linkedin", e.target.value)} placeholder="https://…" />
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                className={`${inputClasses} resize-y font-medium`}
                rows={2}
                value={form.notes}
                onChange={(e) => change("notes", e.target.value)}
                placeholder="How you know them, context…"
              />
            </Field>
          </div>
          <div className="mt-5 flex gap-2.5">
            {form.id && (
              <button
                onClick={() => setForm(EMPTY)}
                className="flex-1 rounded-[10px] border border-neutral-300 bg-white py-2.5 text-sm font-extrabold hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              >
                Cancel
              </button>
            )}
            <button
              onClick={save}
              disabled={!form.name.trim() || saving}
              className="flex-1 rounded-[10px] bg-orange-600 py-2.5 text-sm font-extrabold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : form.id ? "Save changes" : "Add contact"}
            </button>
          </div>
        </div>

        {/* List */}
        <div>
          <input
            type="text"
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3 w-full max-w-xs rounded-[10px] border border-black/12 bg-white px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-orange-600 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
          />

          {loading && contacts.length === 0 ? (
            <p className="py-10 text-center text-sm font-bold text-neutral-400">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm font-bold text-neutral-400 dark:text-neutral-500">
              {contacts.length === 0 ? "No contacts yet — add your first one on the left." : "No contacts match that search."}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-neutral-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[15px] font-extrabold">{c.name}</div>
                      <div className="text-[12.5px] font-bold text-neutral-500 dark:text-neutral-400">
                        {[c.role, c.company].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-col gap-1 text-[13px] font-semibold">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="text-orange-700 hover:underline dark:text-orange-400">
                        {c.email}
                      </a>
                    )}
                    {c.phone && <span className="text-neutral-600 dark:text-neutral-400">{c.phone}</span>}
                    {c.linkedin && (
                      <a
                        href={c.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-orange-700 hover:underline dark:text-orange-400"
                      >
                        LinkedIn ↗
                      </a>
                    )}
                    {c.notes && <p className="mt-1 font-medium text-neutral-600 dark:text-neutral-400">{c.notes}</p>}
                  </div>

                  <div className="mt-3.5 flex gap-2">
                    <button
                      onClick={() => setForm({ ...c })}
                      className="rounded-[10px] border border-black/12 bg-white px-3 py-1.5 text-[12.5px] font-extrabold hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(c)}
                      disabled={deletingId === c.id}
                      className="rounded-[10px] border border-red-200 bg-white px-3 py-1.5 text-[12.5px] font-extrabold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:bg-neutral-800 dark:text-red-400"
                    >
                      {deletingId === c.id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
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
