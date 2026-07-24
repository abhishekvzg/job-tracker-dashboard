export type JobApp = {
  id: string;
  company: string;
  url: string;
  status: string;
  channel: string;
  poc: string;
  remarks: string;
  extra: string;
  dateApplied: string;
};

export const STATUS_OPTIONS = ["Applied", "Not Applied", "Interview", "Offer", "Rejected", "Ghosted"] as const;
export const CHANNEL_OPTIONS = ["LinkedIn", "Referral", "Mail", "Company Website", "Naukri", "Other"] as const;
