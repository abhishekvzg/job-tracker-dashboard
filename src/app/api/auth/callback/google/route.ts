import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client, saveToken } from "@/lib/googleAuth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  try {
    const client = getOAuth2Client();
    const { tokens } = await client.getToken(code);
    saveToken(tokens);
    return NextResponse.redirect(new URL("/?exportToSheets=1", req.url));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
