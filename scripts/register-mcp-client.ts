// One-off: signs in as the owner account and registers a single, stable OAuth
// client for Claude (skip_consent: true, so the rarely-tested /consent page is
// never actually exercised in normal use). Prints the client_id/client_secret to
// paste into claude.ai's custom-connector "Advanced settings". Run this against
// whichever server claude.ai will actually connect to (the deployed URL) by
// setting BETTER_AUTH_URL before running.
import { config } from "dotenv";
config({ path: ".env.local" });
import { Client } from "pg";

const CLAUDE_CALLBACK = "https://claude.ai/api/mcp/auth_callback";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: npm run register:mcp-client -- <email> <password>");
    process.exit(1);
  }

  const base = process.env.BETTER_AUTH_URL || "http://localhost:3000";

  const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email, password }),
  });
  if (!signIn.ok) {
    console.error("Sign-in failed:", await signIn.text());
    process.exit(1);
  }
  const cookies = (signIn.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  if (!cookies) {
    console.error("No session cookie returned from sign-in.");
    process.exit(1);
  }

  // skip_consent isn't accepted by /oauth2/register's RFC 7591 schema (nor by
  // /oauth2/create-client or /oauth2/update-client) — it's deliberately not settable
  // over HTTP. Register normally, then flip that one column directly in Postgres.
  const register = await fetch(`${base}/api/auth/oauth2/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookies, Origin: base },
    body: JSON.stringify({
      client_name: "Claude",
      redirect_uris: [CLAUDE_CALLBACK],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });
  const json = await register.json().catch(() => ({}));
  if (!register.ok) {
    console.error("Registration failed:", json);
    process.exit(1);
  }

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query('UPDATE "oauthClient" SET "skipConsent" = true WHERE "clientId" = $1', [json.client_id]);
  await db.end();

  console.log(`\nRegistered OAuth client for Claude on ${base} (skip_consent enabled)\n`);
  console.log("client_id:    ", json.client_id);
  console.log("client_secret:", json.client_secret);
  console.log("\nPaste these into claude.ai's custom connector 'Advanced settings'.");
}

main();
