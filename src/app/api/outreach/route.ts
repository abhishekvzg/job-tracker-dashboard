import { NextRequest, NextResponse } from "next/server";
import { dailyProgress, deleteOutreach, followUpQueue, listOutreach, logOutreach, logReply, outreachStats } from "@/lib/db";

function statusFor(message: string) {
  if (message === "NOT_FOUND") return 404;
  return 500;
}

/**
 * GET /api/outreach                     -> every logged email
 * GET /api/outreach?contactId=3         -> one person's history
 * GET /api/outreach?view=dashboard      -> progress + stats + follow-up queue
 */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    if (params.get("view") === "dashboard") {
      const [progress, stats, followUps] = await Promise.all([dailyProgress(), outreachStats(), followUpQueue()]);
      return NextResponse.json({ progress, stats, followUps });
    }
    return NextResponse.json({ outreach: await listOutreach(params.get("contactId") ?? undefined) });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (typeof body?.company !== "string" || typeof body?.name !== "string" || !body.company.trim() || !body.name.trim()) {
      return NextResponse.json({ error: "company and name are required" }, { status: 400 });
    }
    return NextResponse.json(await logOutreach(body));
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (typeof body?.company !== "string" || typeof body?.name !== "string") {
      return NextResponse.json({ error: "company and name are required" }, { status: 400 });
    }
    const result = await logReply(body);
    if (!result) return NextResponse.json({ error: "No unanswered email found for that person" }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await deleteOutreach(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}
