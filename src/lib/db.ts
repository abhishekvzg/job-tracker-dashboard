import { supabase } from "./supabaseClient";
import type { Contact, JobApp, JobAppInput, LinkedContact } from "./types";

export type { Contact, JobApp, JobAppInput, LinkedContact };

type AppRow = {
  id: number;
  company: string;
  url: string;
  status: string;
  channel: string;
  remarks: string;
  extra: string;
  date_applied: string;
};

type ContactRow = {
  id: number;
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  linkedin: string;
  notes: string;
};

type LinkRow = { application_id: number; contact_id: number; is_primary: boolean };

function rowToContact(row: ContactRow): Contact {
  return {
    id: String(row.id),
    name: row.name,
    role: row.role,
    company: row.company,
    email: row.email,
    phone: row.phone,
    linkedin: row.linkedin,
    notes: row.notes,
  };
}

function contactToRow(data: Omit<Contact, "id">) {
  return {
    name: data.name,
    role: data.role,
    company: data.company,
    email: data.email,
    phone: data.phone,
    linkedin: data.linkedin,
    notes: data.notes,
  };
}

function appToRow(data: Omit<JobAppInput, "contactIds" | "primaryContactId">) {
  return {
    company: data.company,
    url: data.url,
    status: data.status,
    channel: data.channel,
    remarks: data.remarks,
    extra: data.extra,
    date_applied: data.dateApplied,
  };
}

/** Replaces an application's contact links with exactly the ones given. */
async function setAppContacts(appId: number, contactIds: string[], primaryContactId: string | null) {
  const { error: delError } = await supabase.from("application_contacts").delete().eq("application_id", appId);
  if (delError) throw new Error(delError.message);
  if (contactIds.length === 0) return;

  const rows = contactIds.map((cid) => ({
    application_id: appId,
    contact_id: Number(cid),
    is_primary: cid === (primaryContactId ?? contactIds[0]),
  }));
  const { error } = await supabase.from("application_contacts").insert(rows);
  if (error) throw new Error(error.message);
}

async function attachContacts(appRows: AppRow[]): Promise<JobApp[]> {
  const ids = appRows.map((r) => r.id);
  const byApp = new Map<number, LinkedContact[]>();

  if (ids.length > 0) {
    const { data: links, error: linkError } = await supabase
      .from("application_contacts")
      .select("*")
      .in("application_id", ids);
    if (linkError) throw new Error(linkError.message);

    const contactIds = [...new Set((links as LinkRow[]).map((l) => l.contact_id))];
    const contactsById = new Map<number, Contact>();
    if (contactIds.length > 0) {
      const { data: contacts, error: cErr } = await supabase.from("contacts").select("*").in("id", contactIds);
      if (cErr) throw new Error(cErr.message);
      (contacts as ContactRow[]).forEach((c) => contactsById.set(c.id, rowToContact(c)));
    }

    (links as LinkRow[]).forEach((l) => {
      const contact = contactsById.get(l.contact_id);
      if (!contact) return;
      const list = byApp.get(l.application_id) ?? [];
      list.push({ ...contact, isPrimary: l.is_primary });
      byApp.set(l.application_id, list);
    });
  }

  return appRows.map((row) => ({
    id: String(row.id),
    company: row.company,
    url: row.url,
    status: row.status,
    channel: row.channel,
    remarks: row.remarks,
    extra: row.extra,
    dateApplied: row.date_applied,
    contacts: (byApp.get(row.id) ?? []).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
  }));
}

export async function listApps(): Promise<JobApp[]> {
  const { data, error } = await supabase.from("job_applications").select("*").order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return attachContacts(data as AppRow[]);
}

export async function getApp(id: string): Promise<JobApp | null> {
  const { data, error } = await supabase.from("job_applications").select("*").eq("id", Number(id)).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return (await attachContacts([data as AppRow]))[0];
}

export async function createApp(data: JobAppInput): Promise<JobApp> {
  const { data: row, error } = await supabase.from("job_applications").insert(appToRow(data)).select("*").single();
  if (error) throw new Error(error.message);
  await setAppContacts((row as AppRow).id, data.contactIds, data.primaryContactId);
  return (await attachContacts([row as AppRow]))[0];
}

export async function updateApp(id: string, data: JobAppInput): Promise<void> {
  const { data: row, error } = await supabase
    .from("job_applications")
    .update(appToRow(data))
    .eq("id", Number(id))
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("NOT_FOUND");
  await setAppContacts(Number(id), data.contactIds, data.primaryContactId);
}

export async function deleteApp(id: string): Promise<void> {
  const { data: row, error } = await supabase
    .from("job_applications")
    .delete()
    .eq("id", Number(id))
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("NOT_FOUND");
}

export async function listContacts(): Promise<Contact[]> {
  const { data, error } = await supabase.from("contacts").select("*").order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ContactRow[]).map(rowToContact);
}

export async function createContact(data: Omit<Contact, "id">): Promise<Contact> {
  const { data: row, error } = await supabase.from("contacts").insert(contactToRow(data)).select("*").single();
  if (error) throw new Error(error.message);
  return rowToContact(row as ContactRow);
}

export async function updateContact(id: string, data: Omit<Contact, "id">): Promise<void> {
  const { data: row, error } = await supabase
    .from("contacts")
    .update(contactToRow(data))
    .eq("id", Number(id))
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("NOT_FOUND");
}

export async function deleteContact(id: string): Promise<void> {
  const { data: row, error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", Number(id))
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("NOT_FOUND");
}

/**
 * Resolves a person named in natural language (from the Gemini chat or an MCP tool
 * call) to a saved contact, creating one if nothing matches — so those flows can
 * keep taking a plain name without the caller knowing about contact ids.
 */
export async function findOrCreateContactByName(name: string, company = ""): Promise<Contact> {
  const trimmed = name.trim();
  const contacts = await listContacts();
  const lower = trimmed.toLowerCase();
  const match =
    contacts.find((c) => c.name.toLowerCase() === lower) ??
    contacts.find((c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()));
  if (match) return match;

  const isUrl = /^https?:\/\//i.test(trimmed);
  return createContact({
    name: isUrl ? trimmed.replace(/\/+$/, "").split("/").pop()!.replace(/-/g, " ") : trimmed,
    role: "",
    company,
    email: "",
    phone: "",
    linkedin: isUrl ? trimmed : "",
    notes: "",
  });
}
