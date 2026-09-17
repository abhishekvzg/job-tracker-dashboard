import { supabase } from "./supabaseClient";
import { MAX_CONTACTS_PER_APPLICATION, type Contact, type ContactInput, type JobApp, type JobAppInput } from "./types";

export type { Contact, ContactInput, JobApp, JobAppInput };

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
  application_id: number;
  name: string;
  role: string;
  email: string;
  phone: string;
  linkedin: string;
  notes: string;
  last_contacted: string;
};

function rowToContact(row: ContactRow): Contact {
  return {
    id: String(row.id),
    applicationId: String(row.application_id),
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    linkedin: row.linkedin,
    notes: row.notes,
    lastContacted: row.last_contacted,
  };
}

function contactToRow(data: ContactInput) {
  return {
    application_id: Number(data.applicationId),
    name: data.name,
    role: data.role,
    email: data.email,
    phone: data.phone,
    linkedin: data.linkedin,
    notes: data.notes,
    last_contacted: data.lastContacted,
  };
}

function appToRow(data: JobAppInput) {
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

async function attachContacts(appRows: AppRow[]): Promise<JobApp[]> {
  const ids = appRows.map((r) => r.id);
  const byApp = new Map<number, Contact[]>();

  if (ids.length > 0) {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .in("application_id", ids)
      .order("id", { ascending: true });
    if (error) throw new Error(error.message);
    (data as ContactRow[]).forEach((row) => {
      const list = byApp.get(row.application_id) ?? [];
      list.push(rowToContact(row));
      byApp.set(row.application_id, list);
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
    contacts: byApp.get(row.id) ?? [],
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

export async function listContacts(applicationId?: string): Promise<Contact[]> {
  let query = supabase.from("contacts").select("*").order("id", { ascending: true });
  if (applicationId) query = query.eq("application_id", Number(applicationId));
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as ContactRow[]).map(rowToContact);
}

export async function createContact(data: ContactInput): Promise<Contact> {
  const existing = await listContacts(data.applicationId);
  if (existing.length >= MAX_CONTACTS_PER_APPLICATION) throw new Error("TOO_MANY_CONTACTS");

  const { data: row, error } = await supabase.from("contacts").insert(contactToRow(data)).select("*").single();
  if (error) throw new Error(error.message);
  return rowToContact(row as ContactRow);
}

export async function updateContact(id: string, data: ContactInput): Promise<void> {
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
 * Finds a person by name within one application. Contacts are scoped to a single
 * application, so the same name at two companies stays two separate records.
 */
export async function findContactByName(applicationId: string, name: string): Promise<Contact | null> {
  const contacts = await listContacts(applicationId);
  const lower = name.trim().toLowerCase();
  return (
    contacts.find((c) => c.name.toLowerCase() === lower) ??
    contacts.find((c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())) ??
    null
  );
}

/** Creates the contact if this application doesn't already have someone by that name. */
export async function upsertContactByName(
  applicationId: string,
  name: string,
  fields: Partial<Omit<ContactInput, "applicationId" | "name">> = {}
): Promise<Contact> {
  const existing = await findContactByName(applicationId, name);
  if (existing) {
    const merged: ContactInput = {
      applicationId,
      name: existing.name,
      role: fields.role ?? existing.role,
      email: fields.email ?? existing.email,
      phone: fields.phone ?? existing.phone,
      linkedin: fields.linkedin ?? existing.linkedin,
      notes: fields.notes ?? existing.notes,
      lastContacted: fields.lastContacted ?? existing.lastContacted,
    };
    await updateContact(existing.id, merged);
    return { ...merged, id: existing.id };
  }

  const isUrl = /^https?:\/\//i.test(name.trim());
  return createContact({
    applicationId,
    name: isUrl ? name.trim().replace(/\/+$/, "").split("/").pop()!.replace(/-/g, " ") : name.trim(),
    role: fields.role ?? "",
    email: fields.email ?? "",
    phone: fields.phone ?? "",
    linkedin: fields.linkedin ?? (isUrl ? name.trim() : ""),
    notes: fields.notes ?? "",
    lastContacted: fields.lastContacted ?? "",
  });
}
