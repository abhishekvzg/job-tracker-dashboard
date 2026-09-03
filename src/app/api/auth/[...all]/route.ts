import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Sign-up is open by default in Better Auth's emailAndPassword plugin — anyone who
// found this URL could otherwise create their own account, then (allowDynamicClientRegistration
// is session-backed-only, but *any* session qualifies) register an OAuth client and
// obtain a valid token for /api/mcp. This is a single-owner app, so sign-up is
// restricted to one pre-approved email before it ever reaches Better Auth's handler.
const OWNER_EMAIL = process.env.OWNER_EMAIL;

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

export async function POST(request: Request) {
  if (new URL(request.url).pathname.endsWith("/sign-up/email")) {
    if (!OWNER_EMAIL) {
      return Response.json({ error: "Sign-up is disabled: OWNER_EMAIL is not configured." }, { status: 403 });
    }
    const body = await request
      .clone()
      .json()
      .catch(() => ({}) as Record<string, unknown>);
    if (body.email !== OWNER_EMAIL) {
      return Response.json({ error: "Sign-up is restricted to the app owner." }, { status: 403 });
    }
  }
  return handlers.POST(request);
}
