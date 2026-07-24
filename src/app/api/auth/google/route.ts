import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/googleAuth";

export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
