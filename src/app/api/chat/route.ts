import { NextRequest, NextResponse } from "next/server";
import { interpretCommand, type ChatAction, type ChatTurn } from "@/lib/gemini";
import { createApp, deleteApp, getApp, listApps, updateApp, upsertContactByName } from "@/lib/db";

function statusFor(message: string) {
  if (message === "MISSING_GEMINI_KEY") return 501;
  if (message === "NOT_FOUND") return 404;
  return 500;
}

function isChatAction(body: unknown): body is ChatAction {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    (b.intent === "create" || b.intent === "update" || b.intent === "delete") &&
    typeof b.id === "string" &&
    typeof b.company === "string" &&
    typeof b.url === "string" &&
    typeof b.status === "string" &&
    typeof b.channel === "string" &&
    typeof b.poc === "string" &&
    typeof b.remarks === "string" &&
    typeof b.dateApplied === "string"
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Apply mode: the client already showed the user this proposed action and they confirmed it.
    if (body.applyAction) {
      if (!isChatAction(body.applyAction)) {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }
      const action = body.applyAction as ChatAction;

      if (action.intent === "create") {
        if (!action.company.trim()) {
          return NextResponse.json({ error: "Missing company name" }, { status: 400 });
        }
        const app = await createApp({
          company: action.company,
          url: action.url,
          status: action.status,
          channel: action.channel,
          remarks: action.remarks,
          extra: "",
          dateApplied: action.dateApplied,
        });
        // A person named in chat becomes a contact on this application.
        if (action.poc.trim()) await upsertContactByName(app.id, action.poc);
        return NextResponse.json({ applied: true, app });
      }

      if (action.intent === "update") {
        const current = await getApp(action.id);
        if (!current) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

        await updateApp(action.id, {
          company: action.company,
          url: action.url,
          status: action.status,
          channel: action.channel,
          remarks: action.remarks,
          extra: current.extra,
          dateApplied: action.dateApplied,
        });
        if (action.poc.trim()) await upsertContactByName(action.id, action.poc);
        return NextResponse.json({ applied: true });
      }

      if (action.intent === "delete") {
        await deleteApp(action.id);
        return NextResponse.json({ applied: true });
      }

      return NextResponse.json({ error: "Nothing to apply" }, { status: 400 });
    }

    // Parse mode: interpret the user's message and propose an action (does not write anything).
    const message = typeof body.message === "string" ? body.message : "";
    if (!message.trim()) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    const history: ChatTurn[] = Array.isArray(body.history)
      ? (body.history as unknown[])
          .filter(
            (t): t is ChatTurn =>
              !!t &&
              typeof t === "object" &&
              ((t as ChatTurn).role === "user" || (t as ChatTurn).role === "assistant") &&
              typeof (t as ChatTurn).text === "string"
          )
          .slice(-12)
      : [];

    const apps = await listApps();
    const action = await interpretCommand(message, apps, history);
    return NextResponse.json({ action });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}
