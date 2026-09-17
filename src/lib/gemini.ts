import { STATUS_OPTIONS, CHANNEL_OPTIONS, type JobApp } from "./types";
import { todayISO } from "./format";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export type ChatAction = {
  intent: "create" | "update" | "delete" | "question" | "unclear";
  id: string;
  company: string;
  url: string;
  status: string;
  channel: string;
  poc: string;
  remarks: string;
  dateApplied: string;
  summary: string;
};

export type ChatTurn = { role: "user" | "assistant"; text: string };

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    intent: { type: "STRING", enum: ["create", "update", "delete", "question", "unclear"] },
    id: { type: "STRING" },
    company: { type: "STRING" },
    url: { type: "STRING" },
    status: { type: "STRING" },
    channel: { type: "STRING" },
    poc: { type: "STRING" },
    remarks: { type: "STRING" },
    dateApplied: { type: "STRING" },
    summary: { type: "STRING" },
  },
  required: ["intent", "summary", "id", "company", "url", "status", "channel", "poc", "remarks", "dateApplied"],
};

function normalizeStatus(status: string, fallback: string): string {
  const match = STATUS_OPTIONS.find((s) => s.toLowerCase() === status.trim().toLowerCase());
  return match ?? fallback;
}

export async function interpretCommand(message: string, apps: JobApp[], history: ChatTurn[] = []): Promise<ChatAction> {
  if (!GEMINI_API_KEY) {
    throw new Error("MISSING_GEMINI_KEY");
  }

  const today = todayISO();
  const listing =
    apps
      .map(
        (a) =>
          `id=${a.id} | company="${a.company}" | url="${a.url}" | status="${a.status}" | channel="${a.channel}" | poc="${a.contacts.map((c) => c.name).join(", ")}" | remarks="${a.remarks}" | dateApplied="${a.dateApplied}"`
      )
      .join("\n") || "(no applications tracked yet)";

  const conversation =
    history
      .slice(-12)
      .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.text}`)
      .join("\n") || "(no earlier messages)";

  const prompt = `You are an assistant embedded in a personal job application tracker web app.
Today's date is ${today} (YYYY-MM-DD format).
Valid status values: ${STATUS_OPTIONS.join(", ")}.
Common channel values: ${CHANNEL_OPTIONS.join(", ")} (free text also allowed).

Current tracked applications, with every current field value (use these exact values to fill in
anything the user's message does not explicitly change):
${listing}

Conversation so far in this chat (use it for context — e.g. the user may be answering a
follow-up question you asked, adding details to something discussed earlier, or saying "skip"):
${conversation}

Given the user's latest message below, decide the intent and produce the resulting record:
- "update": the user wants to change an existing application. Pick the id of the best-matching company above (case-insensitive, partial match OK). Return the FULL resulting record by copying every field's exact current value from the listing above, then overwriting only the field(s) the message explicitly asks to change. Never blank out a field that has a current value unless the user explicitly asks to clear it.
- "create": the user wants to add a new application that is not in the list above. Leave "id" as an empty string. Fill fields from the message; leave unspecified fields as an empty string, except status (default "Applied" if not mentioned) and dateApplied (default to today if not mentioned).
- "delete": the user wants to remove an application. Pick the matching id; other fields can mirror the current record.
- "question": use this to ask ONE short round of follow-up questions before proposing a change, ONLY when ALL of these hold:
  1. The intent would otherwise be "create" (a new application), AND
  2. one or more genuinely useful fields are missing from the user's message — point of contact (a recruiter/referrer name or LinkedIn profile URL to follow up with later), channel, listing URL, or date applied — AND
  3. you have NOT already asked a follow-up question earlier in this conversation (check the conversation above; if an assistant turn already asked, NEVER ask again — proceed with what you have).
  Put the question(s) in "summary" as one friendly message covering all missing fields at once (e.g. "Before I add this — do you have a point of contact or their LinkedIn URL so you can follow up later? And which channel did you apply through?"). Mention that they can reply "skip" to save it as-is. Leave the other fields as empty strings.
  If the user's reply declines, says "skip"/"no", or simply doesn't answer parts of the question, proceed to "create" using whatever information exists — never ask twice, never block on missing fields.
  Never use "question" for update or delete intents.
- "unclear": the message does not map to a clear action, or no confident company match exists. Explain what is unclear in "summary" and leave id/company/url/status/channel/poc/remarks/dateApplied as empty strings.

When the user is answering a follow-up question, combine their answer(s) with the details from their earlier messages in the conversation to produce the complete "create" record.

For "create"/"update"/"delete", always set "summary" to one short, specific sentence describing exactly what will happen if this is applied (e.g. "Update Mastercard: status -> Interview"), written so a human can confirm it before anything is saved. Never say a change has already been made.

User's latest message: "${message}"`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.2,
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GEMINI_ERROR: ${res.status} ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");

  const parsed = JSON.parse(text) as ChatAction;
  const fallbackApp = apps.find((a) => a.id === parsed.id);
  parsed.status = normalizeStatus(parsed.status, fallbackApp?.status ?? "Applied");
  return parsed;
}
