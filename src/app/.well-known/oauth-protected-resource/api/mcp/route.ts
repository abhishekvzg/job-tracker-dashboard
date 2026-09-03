import { protectedResourceHandler } from "mcp-handler";
import { MCP_RESOURCE } from "@/lib/auth";

const BASE_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

// requireMcpAuth's 401 WWW-Authenticate header points here (RFC 9728, path-inserted
// well-known convention: /.well-known/oauth-protected-resource<resource-path>).
// Better Auth's mcp() plugin serves its own copy under /api/auth, but the challenge
// URL it generates is root-relative, so this mirrors it at the root path Claude follows.
export const GET = protectedResourceHandler({
  authServerUrls: [`${BASE_URL}/api/auth`],
  resourceUrl: MCP_RESOURCE,
});
