import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/lib/auth";

// Better Auth's OAuth endpoints live under /api/auth, so its RFC 8414 metadata
// isn't reachable at the site root by default — this re-exports it there,
// which is where Claude (and RFC 8414 clients generally) expect to find it.
export const GET = oauthProviderAuthServerMetadata(auth);
