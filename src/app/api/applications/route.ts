import { NextRequest, NextResponse } from "next/server";
import { createApp, deleteApp, listApps, updateApp } from "@/lib/db";
import type { JobAppInput } from "@/lib/types";

function statusFor(message: string) {
  if (message === "NOT_FOUND") return 404;
  return 500;
}

function isValidAppPayload(body: unknown): body is JobAppInput {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return ["company", "url", "status", "channel", "remarks", "extra", "dateApplied"].every(
    (k) => typeof b[k] === "string"
  );
}

export async function GET() {
  try {
    return NextResponse.json({ apps: await listApps() });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!isValidAppPayload(body)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    return NextResponse.json({ app: await createApp(body) });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...rest } = (body ?? {}) as { id?: unknown };
    if (typeof id !== "string" || !isValidAppPayload(rest)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    await updateApp(id, rest);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await deleteApp(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}
