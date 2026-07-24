import { NextResponse } from "next/server";
import { hasCredentials, hasToken } from "@/lib/googleAuth";

export async function GET() {
  const credentialsPresent = hasCredentials();
  return NextResponse.json({
    hasCredentials: credentialsPresent,
    authenticated: credentialsPresent && (await hasToken()),
  });
}
