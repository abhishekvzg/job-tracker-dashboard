import { NextRequest, NextResponse } from "next/server";
import { createContact, deleteContact, listContacts, updateContact } from "@/lib/db";
import type { Contact } from "@/lib/types";

function statusFor(message: string) {
  if (message === "NOT_FOUND") return 404;
  return 500;
}

function isValidPayload(body: unknown): body is Omit<Contact, "id"> {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.name === "string" &&
    b.name.trim().length > 0 &&
    ["role", "company", "email", "phone", "linkedin", "notes"].every((k) => typeof b[k] === "string")
  );
}

export async function GET() {
  try {
    return NextResponse.json({ contacts: await listContacts() });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!isValidPayload(body)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    return NextResponse.json({ contact: await createContact(body) });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: statusFor(message) });
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
    return NextResponse.json({ error: message }, { status: statusFor(message) });
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
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}
