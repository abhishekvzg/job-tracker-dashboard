# Job Application Tracker

A minimal Next.js dashboard for a job application tracker, backed by Supabase.

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
   ```

2. From Project Settings → API, copy the Project URL and the `service_role` secret key
   (not `anon` — this one is server-only and must never reach the browser). Copy
   `.env.local.example` to `.env.local` and fill in `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
3. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

4. Open http://localhost:3000 — no further sign-in is required; the app reads and
   writes `job_applications` directly.

## AI chat editor

The chat bubble (bottom-right) lets you add/update/delete applications with natural language,
e.g. "Mark Mastercard as Interview" or "Add an application to Google, applied via LinkedIn today".
It uses Gemini to turn your message into a proposed change, which you then confirm before it's
written to the database — it never writes automatically.

1. Get a free key at https://aistudio.google.com/apikey
2. Add it to `.env.local` as `GEMINI_API_KEY`
3. Restart the dev server

## Exporting

- **Download Excel** — streams an `.xlsx` of every tracked application, with the same
  column layout the tracker used back when it was a Google Sheet.
- **Export to Google Sheets** — pushes the current data into a Google Sheet on demand.
  This is a one-way, on-demand export, not a live sync, and needs a one-time Google
  OAuth connection (separate from — and unrelated to — the Supabase datastore above).
  See `credentials.json` / `GOOGLE_CLIENT_ID` setup below.

### Google OAuth setup (only needed for the Sheets export button)

1. Place your OAuth client file at the project root as `credentials.json`
   (Google Cloud Console → APIs & Services → Credentials → OAuth client, Web application type).
   Make sure `http://localhost:3000/api/auth/callback/google` is registered as an
   authorized redirect URI on that client.
2. Set `GOOGLE_SHEET_ID` / `GOOGLE_SHEET_RANGE` in `.env.local` to the sheet you want to
   export into.
3. Click **Export to Google Sheets** in the app once; the resulting token is saved to
   `token.json` at the project root (git-ignored) and refreshed automatically.

For a deployed environment (e.g. Vercel), `credentials.json` and `token.json` won't work
(read-only/ephemeral filesystem):

1. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` as env vars (same OAuth client
   `credentials.json` came from) instead of relying on the file.
2. Add your production callback URL (`https://<domain>/api/auth/callback/google`)
   as an authorized redirect URI on that OAuth client in Google Cloud Console, and
   set `GOOGLE_REDIRECT_URI` to that same URL.
3. Attach a KV/Redis store to the project (Vercel: Storage tab → Create Database).
   Once linked, Vercel injects `KV_REST_API_URL` / `KV_REST_API_TOKEN` automatically —
   the app uses these to persist the OAuth token instead of `token.json`.

## Connecting from claude.ai

The app exposes a remote MCP server at `/api/mcp`, so you can manage applications
from inside a claude.ai chat (web, desktop, or mobile) — e.g. "mark my Stripe
application as Interview." It's a single-owner setup: only one account can ever
exist, and only that account's OAuth client can reach the tools.

1. Create a table for Better Auth's own tables: run `npx auth@latest migrate`
   (needs `DATABASE_URL` set — see `.env.local.example`).
2. Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `OWNER_EMAIL`
   in `.env.local` (or your deployed environment's env vars — `BETTER_AUTH_URL`
   must be that environment's own public URL).
3. Create the one owner account once: `npm run seed:user -- you@example.com yourPassword`
4. Register a stable OAuth client for Claude:
   `npm run register:mcp-client -- you@example.com yourPassword` — this prints a
   `client_id` / `client_secret`.
5. In claude.ai: **Settings → Connectors → Add custom connector** → enter
   `https://<your-domain>/api/mcp` → **Advanced settings** → paste in the
   `client_id` / `client_secret` from step 4 → connect, signing in with the
   owner account from step 3.

Steps 3–5 need to be run against whichever URL claude.ai will actually talk to
(the deployed URL, not localhost) — run them again after deploying if you only
tested locally first.

Tools exposed: `list_applications`, `find_application`, `add_application`,
`update_application`, `delete_application`. Update/delete accept either an `id`
or a `company` name (fuzzy match); an ambiguous company name returns the list of
candidates instead of guessing.

## Deploying (e.g. Vercel)

Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL` as env
vars. If you also want the Google Sheets export in production, add the Google env vars
and KV store described above. For the claude.ai MCP connector, add `DATABASE_URL`,
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the deployed URL), and `OWNER_EMAIL`, then
follow "Connecting from claude.ai" above.
