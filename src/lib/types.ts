export type Contact = {
  id: string;
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  linkedin: string;
  notes: string;
};

export type LinkedContact = Contact & { isPrimary: boolean };

export type JobApp = {
  id: string;
  company: string;
  url: string;
  status: string;
  channel: string;
  remarks: string;
  extra: string;
  dateApplied: string;
  contacts: LinkedContact[];
};

export type JobAppInput = Omit<JobApp, "id" | "contacts"> & {
  contactIds: string[];
  primaryContactId: string | null;
};

export const STATUS_OPTIONS = ["New", "Applied", "HR Call", "Interview", "Rejected", "Job Offered"] as const;

export const TERMINAL_STATUSES = ["Rejected", "Job Offered"] as const;

// The expected next step(s) for each status. Used to surface the likely choice
// first — every status stays selectable, since reality skips steps.
export const NEXT_STATUSES: Record<string, readonly string[]> = {
  New: ["Applied"],
  Applied: ["HR Call", "Rejected"],
  "HR Call": ["Interview", "Rejected"],
  Interview: ["Job Offered", "Rejected"],
  Rejected: [],
  "Job Offered": [],
};

export const CHANNEL_OPTIONS = ["LinkedIn", "Referral", "Mail", "Company Website", "Naukri", "Other"] as const;

export function primaryContact(app: JobApp): LinkedContact | null {
  return app.contacts.find((c) => c.isPrimary) ?? app.contacts[0] ?? null;
}
