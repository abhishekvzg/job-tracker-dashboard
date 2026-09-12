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
      // claude.ai's connector UI never collects a pre-registered client_id/secret —
      // it expects to self-register via RFC 7591 before the user ever signs in, so
      // registration has to be open. Registering grants nothing on its own: issuing a
      // token still requires signing in, and sign-up is restricted to OWNER_EMAIL.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
    }),
    nextCookies(),
  ],
});
