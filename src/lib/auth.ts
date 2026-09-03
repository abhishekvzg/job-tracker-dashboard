import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { mcp } from "@better-auth/mcp";
import { Pool } from "pg";

const BASE_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
export const MCP_RESOURCE = `${BASE_URL}/api/mcp`;

export const auth = betterAuth({
  baseURL: BASE_URL,
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  emailAndPassword: { enabled: true },
  plugins: [
    jwt(),
    mcp({
      loginPage: "/sign-in",
      consentPage: "/consent",
      resource: MCP_RESOURCE,
      // Only a logged-in session (the app owner) can register a client — no open
      // self-registration. Used once, by scripts/register-mcp-client.ts, to mint a
      // stable client_id/secret pasted into claude.ai's "Advanced settings".
      allowDynamicClientRegistration: true,
    }),
    nextCookies(),
  ],
});
