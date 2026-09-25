# Job Application Tracker

A minimal Next.js dashboard for tracking job applications and the people attached to
them, backed by Supabase. Manageable from the web UI, an in-app AI chat, or directly
from a claude.ai conversation over MCP.

## Setup

1. Create a Supabase project, then in its SQL editor run:

   ```sql
   create table job_applications (
     id bigint generated always as identity primary key,
     company text not null default '',
     url text not null default '',
     status text not null default '',
     channel text not null default '',
     poc text not null default '',
     remarks text not null default '',
     extra text not null default '',
     date_applied text not null default '',
     created_at timestamptz not null default now()
   );

   create table contacts (
     id bigint generated always as identity primary key,
     name text not null,
     role text not null default '',
     company text not null default '',
     email text not null default '',
     phone text not null default '',
     linkedin text not null default '',
     notes text not null default '',
     created_at timestamptz not null default now()
   );

   create table application_contacts (
     application_id bigint not null references job_applications(id) on delete cascade,
     contact_id bigint not null references contacts(id) on delete cascade,
     is_primary boolean not null default false,
     primary key (application_id, contact_id)
   );
   ```

2. From Project Settings → API, copy the Project URL and the `service_role` secret key
   (not `anon` — this one is server-only and must never reach the browser). Copy
   `.env.local.example` to `.env.local` and fill in `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
3. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

4. Open http://localhost:3000 — no sign-in is required for the dashboard itself.

## Applications and contacts

Each application moves through `New → Applied → HR Call → Interview → Rejected / Job Offered`.
The dropdown marks the usual next step with `→`, but any status stays selectable.

People live in their own **Contacts** page, so a recruiter or referrer is saved once and
reused across applications. An application can link several people, one marked primary —
that's the one shown in the table's "Point of contact" column.

## AI chat editor

The chat bubble (bottom-right) lets you add/update/delete applications with natural
language, e.g. "Mark Mastercard as Interview". It uses Gemini to turn your message into a
proposed change, which you confirm before it's written — it never writes automatically.
Naming a person attaches them, matching an existing contact or creating one.

1. Get a free key at https://aistudio.google.com/apikey
2. Add it to `.env.local` as `GEMINI_API_KEY`
3. Restart the dev server

## Exporting

**Download Excel** streams an `.xlsx` of every application, including primary contact and
full contact details.

## Using it from claude.ai

The app exposes a remote MCP server at `/api/mcp`, so applications can be managed from a
claude.ai chat. Better Auth acts as the OAuth 2.1 provider; Claude registers itself via
dynamic client registration, then you sign in with the single owner account.

One-time setup:

```bash
npx auth migrate                                     # Better Auth's own tables
npm run seed:user -- <owner-email> <password>        # the single owner account
```

Then in claude.ai: Settings → Connectors → Add custom connector → the deployed
`/api/mcp` URL. Leave authentication on "Sign in now" and OAuth client on "Register
automatically".

Tools exposed: `list_applications`, `find_application`, `add_application`,
`update_application`, `delete_application`, `save_contacts`, `list_contacts`,
`delete_contact`, plus the cold email tools below.

## The 30-day cold email routine

Based on Ankur Warikoo's approach: find someone senior in the role you want (**not** HR —
they get too many of these), send one email so personalised it couldn't have been sent to
anyone else, and do that **3× a day for 30 days**. Cold emails convert at 1–2%; personalised
ones at 8–10%, so ~100 emails is roughly 8–10 replies, 3–5 interviews, 1–2 offers.

The tracker is the scoreboard; claude.ai runs the loop. Paste this into a claude.ai chat:

> Run my cold email routine. Check `outreach_today`, then `suggest_targets`. For each
> target, draft a personalised email — use the company, role and remarks for context, and
> for follow-ups reference the previous angle. Create each as a Gmail draft for me to
> review, then log it with `log_outreach` including the angle in `notes`.

Claude will use the Gmail connector for the drafts and leave them unsent for you to check.
For an address you don't have, `guess_emails` returns the usual permutations at the
company domain — send to the first and BCC the rest, so one send covers them all.

Sweeping for replies:

> Search Gmail for replies from anyone in `list_contacts`, and `log_reply` for each one
> you find. If a reply leads to a call, move the application to HR Call.

Cold email tools: `outreach_today` (daily progress, streak, challenge day),
`suggest_targets` (who to write to next, with personalisation context),
`log_outreach`, `log_reply`, `outreach_history`, `outreach_stats`, `guess_emails`.

Logging an email for a company that isn't tracked yet creates the application
automatically (channel `Email`, status `Applied`) and attaches the person — the cold email
*is* the application in this playbook. The dashboard shows today's quota, the streak, the
response rate, and anyone silent for 5+ days.

## Deploying (e.g. Vercel)

Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, `OWNER_EMAIL`, `GEMINI_API_KEY`, `GEMINI_MODEL`.

`BETTER_AUTH_SECRET` must match whatever local development uses, since both point at the
same database and the JWKS signing key is encrypted with it.
