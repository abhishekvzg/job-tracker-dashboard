# Job Application Tracker

A minimal Next.js dashboard that reads and writes a job application tracker stored in
Google Sheets.

## Setup

1. Place your OAuth client file at the project root as `credentials.json`
   (Google Cloud Console → APIs & Services → Credentials → OAuth client, Web application type).
   Make sure `http://localhost:3000/api/auth/callback/google` is registered as an
   authorized redirect URI on that client.
2. Copy `.env.local.example` to `.env.local` and adjust `GOOGLE_SHEET_ID` /
   `GOOGLE_SHEET_RANGE` if needed (defaults to the sheet ID provided and tab `Sheet1`).
3. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

4. Open http://localhost:3000 and click **Connect Google Sheets** to authorize.
   The resulting token is saved to `token.json` at the project root (git-ignored)
   and refreshed automatically.

## AI chat editor

The chat bubble (bottom-right) lets you add/update/delete applications with natural language,
e.g. "Mark Mastercard as Interview" or "Add an application to Google, applied via LinkedIn today".
It uses Gemini to turn your message into a proposed change, which you then confirm before it's
written to the sheet — it never writes automatically.

1. Get a free key at https://aistudio.google.com/apikey
2. Add it to `.env.local` as `GEMINI_API_KEY`
3. Restart the dev server

## Notes

- The first row of the sheet is treated as the header row; all other rows render
  as-is, in whatever column order the sheet uses.
- The column whose header matches "status" (case-insensitive) is rendered as an
  editable dropdown; changing it writes straight back to that cell in the sheet.
- `credentials.json` and `token.json` are git-ignored — never commit them.

## Deploying (e.g. Vercel)

`credentials.json` and `token.json` are local files and won't work on serverless
hosting (read-only/ephemeral filesystem), so for a deployed environment:

1. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` as env vars (same OAuth client
   `credentials.json` came from) instead of relying on the file.
2. Add your production callback URL (`https://<domain>/api/auth/callback/google`)
   as an authorized redirect URI on that OAuth client in Google Cloud Console, and
   set `GOOGLE_REDIRECT_URI` to that same URL.
3. Attach a KV/Redis store to the project (Vercel: Storage tab → Create Database).
   Once linked, Vercel injects `KV_REST_API_URL` / `KV_REST_API_TOKEN` automatically —
   the app uses these to persist the OAuth token instead of `token.json`.
4. Set `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_RANGE`, `GEMINI_API_KEY`, `GEMINI_MODEL` as
   env vars too.
5. After the first deploy, visit the site and click **Connect Google Sheets** once
   to run the OAuth consent flow in production.
