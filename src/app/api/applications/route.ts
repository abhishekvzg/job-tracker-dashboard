import { NextRequest, NextResponse } from "next/server";
import { createApp, deleteApp, listApps, updateApp, type JobApp } from "@/lib/db";

function statusFor(message: string) {
  if (message === "NOT_FOUND") return 404;
  return 500;
}

function isValidAppPayload(body: unknown): body is Omit<JobApp, "id"> {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.company === "string" &&
    typeof b.url === "string" &&
    typeof b.status === "string" &&
    typeof b.channel === "string" &&
    typeof b.poc === "string" &&
    typeof b.remarks === "string" &&
    typeof b.extra === "string" &&
    typeof b.dateApplied === "string"
  );
}

export async function GET() {
  try {
    const apps = await listApps();
    return NextResponse.json({ apps });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!isValidAppPayload(body)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const app = await createApp(body);
    return NextResponse.json({ app });
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
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    await deleteApp(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}
