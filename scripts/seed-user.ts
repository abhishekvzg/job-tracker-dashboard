// One-off: creates the single owner account used to sign in during the MCP OAuth
// flow. Run against whichever server you want the account to exist on (local for
// testing, the deployed URL for the account claude.ai will actually authenticate
// against) by setting BETTER_AUTH_URL before running.
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: npm run seed:user -- <email> <password> [name]");
    process.exit(1);
  }

  const base = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email, password, name: name || "Owner" }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Failed:", json);
    process.exit(1);
  }
  console.log(`Created user ${json.user?.email ?? email} on ${base}`);
}

main();
