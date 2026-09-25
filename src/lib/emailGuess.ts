/**
 * When you can't find someone's address, send to every plausible permutation at
 * their company domain — first in To, the rest in BCC, so one send covers them all
 * and the recipient never sees the guesswork.
 */
export type EmailGuess = { to: string; bcc: string[]; all: string[] };

function clean(part: string): string {
  return part
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function guessEmails(fullName: string, domain: string): EmailGuess {
  const host = normalizeDomain(domain);
  const parts = fullName.trim().split(/\s+/).map(clean).filter(Boolean);
  if (parts.length === 0 || !host) return { to: "", bcc: [], all: [] };

  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";

  const locals = last
    ? [
        `${first}.${last}`,
        `${first[0]}${last[0]}`,
        `${first[0]}${last}`,
        `${first}${last[0]}`,
        first,
        last,
      ]
    : [first];

  const all = [...new Set(locals)].map((local) => `${local}@${host}`);
  return { to: all[0], bcc: all.slice(1), all };
}
