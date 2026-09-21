export const MAX_CONTACTS_PER_APPLICATION = 10;

export type Contact = {
  id: string;
  applicationId: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  linkedin: string;
  notes: string;
  /** YYYY-MM-DD of the last time you reached out. Empty if never. */
  lastContacted: string;
};

export type ContactInput = Omit<Contact, "id">;

export type JobApp = {
  id: string;
  company: string;
  url: string;
  status: string;
  channel: string;
  remarks: string;
  extra: string;
  dateApplied: string;
  contacts: Contact[];
};

export type JobAppInput = Omit<JobApp, "id" | "contacts">;

export const STATUS_OPTIONS = ["New", "Applied", "HR Call", "Interview", "Rejected", "Job Offered"] as const;

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

// The only channels an application can be logged through. "" (unset) is also valid —
// callers just can't invent a new one; anything that doesn't fit goes in "Others".
export const CHANNEL_OPTIONS = ["LinkedIn", "Naukri", "Email", "Company Website", "YCombinator", "Others"] as const;

export function isValidChannel(channel: string): boolean {
  return channel === "" || (CHANNEL_OPTIONS as readonly string[]).includes(channel);
}
