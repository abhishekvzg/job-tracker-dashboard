import { NextRequest, NextResponse } from "next/server";
import { createContact, deleteContact, listContacts, updateContact } from "@/lib/db";
import { MAX_CONTACTS_PER_APPLICATION, type ContactInput } from "@/lib/types";

function statusFor(message: string) {
  if (message === "NOT_FOUND") return 404;
  if (message === "TOO_MANY_CONTACTS") return 409;
  return 500;
}

function errorBody(message: string) {
  if (message === "TOO_MANY_CONTACTS") {
    return { error: `An application can have at most ${MAX_CONTACTS_PER_APPLICATION} points of contact.` };
  }
  return { error: message };
}

function isValidPayload(body: unknown): body is ContactInput {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.applicationId === "string" &&
    b.applicationId.length > 0 &&
    typeof b.name === "string" &&
    b.name.trim().length > 0 &&
    ["role", "email", "phone", "linkedin", "notes", "lastContacted"].every((k) => typeof b[k] === "string")
  );
}

export async function GET(req: NextRequest) {
  try {
    const applicationId = req.nextUrl.searchParams.get("applicationId") ?? undefined;
    return NextResponse.json({ contacts: await listContacts(applicationId) });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json(errorBody(message), { status: statusFor(message) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!isValidPayload(body)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    return NextResponse.json({ contact: await createContact(body) });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json(errorBody(message), { status: statusFor(message) });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...rest } = (body ?? {}) as { id?: unknown };
    if (typeof id !== "string" || !isValidPayload(rest)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    await updateContact(id, rest);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json(errorBody(message), { status: statusFor(message) });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await deleteContact(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json(errorBody(message), { status: statusFor(message) });
  }
}
