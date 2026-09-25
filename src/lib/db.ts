import { supabase } from "./supabaseClient";
import {
  DAILY_OUTREACH_GOAL,
  FOLLOW_UP_AFTER_DAYS,
  MAX_CONTACTS_PER_APPLICATION,
  type Contact,
  type ContactInput,
  type JobApp,
  type JobAppInput,
  type Outreach,
  type OutreachInput,
} from "./types";
import { todayISO } from "./format";

export type { Contact, ContactInput, JobApp, JobAppInput, Outreach, OutreachInput };

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

// ---------------------------------------------------------------------------
// Cold email outreach
// ---------------------------------------------------------------------------

type OutreachRow = {
  id: number;
  contact_id: number;
  sent_on: string;
  subject: string;
  notes: string;
  is_follow_up: boolean;
  replied_on: string;
  reply_notes: string;
};

function rowToOutreach(row: OutreachRow): Outreach {
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    sentOn: row.sent_on,
    subject: row.subject,
    notes: row.notes,
    isFollowUp: row.is_follow_up,
    repliedOn: row.replied_on,
    replyNotes: row.reply_notes,
  };
}

/** Shifts a YYYY-MM-DD date by whole days without tripping over timezones. */
function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.floor((Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / 86400000);
}

export async function listOutreach(contactId?: string): Promise<Outreach[]> {
  let query = supabase
    .from("outreach")
    .select("*")
    .order("sent_on", { ascending: false })
    .order("id", { ascending: false });
  if (contactId) query = query.eq("contact_id", Number(contactId));
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as OutreachRow[]).map(rowToOutreach);
}

export async function createOutreach(data: OutreachInput): Promise<Outreach> {
  const { data: row, error } = await supabase
    .from("outreach")
    .insert({
      contact_id: Number(data.contactId),
      sent_on: data.sentOn,
      subject: data.subject,
      notes: data.notes,
      is_follow_up: data.isFollowUp,
      replied_on: data.repliedOn,
      reply_notes: data.replyNotes,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  // Keep the contact's own summary field in step, so the existing UI stays correct.
  const contact = (await listContacts()).find((c) => c.id === data.contactId);
  if (contact && data.sentOn > contact.lastContacted) {
    await updateContact(contact.id, { ...contact, lastContacted: data.sentOn });
  }
  return rowToOutreach(row as OutreachRow);
}

export async function deleteOutreach(id: string): Promise<void> {
  const { data: row, error } = await supabase
    .from("outreach")
    .delete()
    .eq("id", Number(id))
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("NOT_FOUND");
}

async function findAppByCompany(company: string): Promise<JobApp | undefined> {
  const apps = await listApps();
  const q = company.trim().toLowerCase();
  return apps.find((a) => a.company.toLowerCase() === q) ?? apps.find((a) => a.company.toLowerCase().includes(q));
}

/**
 * Records a cold email. Creates the application and the contact when they don't
 * exist yet — in this playbook the email *is* the application, so the tracker
 * can't drift from what was actually sent.
 */
export async function logOutreach(params: {
  company: string;
  name: string;
  email?: string;
  role?: string;
  linkedin?: string;
  subject?: string;
  notes?: string;
  isFollowUp?: boolean;
  sentOn?: string;
}): Promise<{ outreach: Outreach; contact: Contact; application: JobApp; createdApplication: boolean }> {
  const sentOn = params.sentOn || todayISO();

  let application = await findAppByCompany(params.company);
  let createdApplication = false;
  if (!application) {
    application = await createApp({
      company: params.company.trim(),
      url: "",
      status: "Applied",
      channel: "Email",
      remarks: "",
      extra: "",
      dateApplied: sentOn,
    });
    createdApplication = true;
  }

  const contact = await upsertContactByName(application.id, params.name, {
    email: params.email,
    role: params.role,
    linkedin: params.linkedin,
    lastContacted: sentOn,
  });

  const outreach = await createOutreach({
    contactId: contact.id,
    sentOn,
    subject: params.subject ?? "",
    notes: params.notes ?? "",
    isFollowUp: params.isFollowUp ?? false,
    repliedOn: "",
    replyNotes: "",
  });

  const fresh = (await listApps()).find((a) => a.id === application.id) ?? application;
  return { outreach, contact, application: fresh, createdApplication };
}

/** Marks the most recent unanswered email to this person as replied. */
export async function logReply(params: {
  company: string;
  name: string;
  repliedOn?: string;
  notes?: string;
}): Promise<{ outreach: Outreach; contact: Contact } | null> {
  const application = await findAppByCompany(params.company);
  if (!application) return null;

  const contact = await findContactByName(application.id, params.name);
  if (!contact) return null;

  const waiting = (await listOutreach(contact.id)).filter((o) => !o.repliedOn);
  if (waiting.length === 0) return null;

  const target = waiting[0];
  const repliedOn = params.repliedOn || todayISO();
  const { error } = await supabase
    .from("outreach")
    .update({ replied_on: repliedOn, reply_notes: params.notes ?? "" })
    .eq("id", Number(target.id));
  if (error) throw new Error(error.message);

  return { outreach: { ...target, repliedOn, replyNotes: params.notes ?? "" }, contact };
}

export type DailyProgress = {
  today: string;
  sentToday: number;
  goal: number;
  remaining: number;
  /** Consecutive days up to today where the full goal was met. */
  streak: number;
  /** Day N of the challenge, counting from the first email ever logged. */
  challengeDay: number | null;
  totalSent: number;
};

export async function dailyProgress(): Promise<DailyProgress> {
  const all = await listOutreach();
  const today = todayISO();

  const byDay = new Map<string, number>();
  all.forEach((o) => byDay.set(o.sentOn, (byDay.get(o.sentOn) ?? 0) + 1));
  const sentToday = byDay.get(today) ?? 0;

  // Today only breaks the streak once it's over, so counting starts at yesterday
  // unless today's goal is already met.
  let streak = 0;
  let cursor = sentToday >= DAILY_OUTREACH_GOAL ? today : shiftDate(today, -1);
  while ((byDay.get(cursor) ?? 0) >= DAILY_OUTREACH_GOAL) {
    streak++;
    cursor = shiftDate(cursor, -1);
  }

  const firstDay = all.length > 0 ? all.map((o) => o.sentOn).sort()[0] : null;

  return {
    today,
    sentToday,
    goal: DAILY_OUTREACH_GOAL,
    remaining: Math.max(0, DAILY_OUTREACH_GOAL - sentToday),
    streak,
    challengeDay: firstDay ? daysBetween(firstDay, today) + 1 : null,
    totalSent: all.length,
  };
}

export type OutreachStats = {
  sent: number;
  replied: number;
  responseRate: number;
  interviews: number;
  offers: number;
  sinceDays: number | null;
};

export async function outreachStats(days?: number): Promise<OutreachStats> {
  const all = await listOutreach();
  const cutoff = days ? shiftDate(todayISO(), -days) : null;
  const scoped = cutoff ? all.filter((o) => o.sentOn >= cutoff) : all;
  const replied = scoped.filter((o) => o.repliedOn).length;

  // How far the cold-emailed companies actually got.
  const contactIds = new Set(scoped.map((o) => o.contactId));
  const touched = (await listApps()).filter((a) => a.contacts.some((c) => contactIds.has(c.id)));

  return {
    sent: scoped.length,
    replied,
    responseRate: scoped.length ? Math.round((replied / scoped.length) * 1000) / 10 : 0,
    interviews: touched.filter((a) => a.status === "Interview" || a.status === "Job Offered").length,
    offers: touched.filter((a) => a.status === "Job Offered").length,
    sinceDays: days ?? null,
  };
}

export type Target = {
  reason: "never_emailed" | "follow_up_due" | "no_contacts";
  company: string;
  applicationId: string;
  contactName?: string;
  contactId?: string;
  email?: string;
  role?: string;
  linkedin?: string;
  daysSinceLastEmail?: number;
  lastAngle?: string;
  /** Context to personalise with. */
  applicationUrl: string;
  remarks: string;
  status: string;
};

/**
 * Who to write to next, in priority order: people you have an address for but have
 * never written to, then anyone gone quiet past the follow-up window, then companies
 * where nobody has been found yet (go search LinkedIn).
 */
export async function suggestTargets(limit = DAILY_OUTREACH_GOAL): Promise<Target[]> {
  const apps = await listApps();
  const all = await listOutreach();
  const today = todayISO();

  const byContact = new Map<string, Outreach[]>();
  all.forEach((o) => byContact.set(o.contactId, [...(byContact.get(o.contactId) ?? []), o]));

  const open = apps.filter((a) => a.status !== "Rejected" && a.status !== "Job Offered");
  const base = (a: JobApp) => ({
    company: a.company,
    applicationId: a.id,
    applicationUrl: a.url,
    remarks: a.remarks,
    status: a.status,
  });

  const neverEmailed: Target[] = [];
  const followUps: Target[] = [];
  const noContacts: Target[] = [];

  for (const a of open) {
    if (a.contacts.length === 0) {
      noContacts.push({ ...base(a), reason: "no_contacts" });
      continue;
    }
    for (const c of a.contacts) {
      const history = byContact.get(c.id);
      if (!history) {
        if (c.email) {
          neverEmailed.push({
            ...base(a),
            reason: "never_emailed",
            contactName: c.name,
            contactId: c.id,
            email: c.email,
            role: c.role,
            linkedin: c.linkedin,
          });
        }
        continue;
      }
      if (history.some((o) => o.repliedOn)) continue;
      const latest = history.map((o) => o.sentOn).sort().reverse()[0];
      const days = daysBetween(latest, today);
      if (days < FOLLOW_UP_AFTER_DAYS) continue;
      followUps.push({
        ...base(a),
        reason: "follow_up_due",
        contactName: c.name,
        contactId: c.id,
        email: c.email,
        role: c.role,
        linkedin: c.linkedin,
        daysSinceLastEmail: days,
        lastAngle: history.find((o) => o.sentOn === latest)?.notes,
      });
    }
  }

  return [...neverEmailed, ...followUps, ...noContacts].slice(0, limit);
}

export async function followUpQueue(): Promise<Target[]> {
  return (await suggestTargets(500)).filter((t) => t.reason === "follow_up_due");
}
