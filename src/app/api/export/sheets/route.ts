import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthorizedClient } from "@/lib/googleAuth";
import { listApps } from "@/lib/db";

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const TAB_NAME = process.env.GOOGLE_SHEET_RANGE || "Sheet1";

function statusFor(message: string) {
  if (message === "NOT_AUTHENTICATED" || message === "MISSING_CREDENTIALS") return 401;
  return 500;
}

export async function POST() {
  if (!SHEET_ID) {
    return NextResponse.json({ error: "Missing GOOGLE_SHEET_ID env var" }, { status: 400 });
  }
  try {
    const auth = await getAuthorizedClient();
    const sheets = google.sheets({ version: "v4", auth });
    const apps = await listApps();

    // Leave the header row (row 1) untouched; overwrite everything below it.
    await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `${TAB_NAME}!A2:I` });

    if (apps.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${TAB_NAME}!A2`,
        valueInputOption: "RAW",
        requestBody: {
          values: apps.map((a) => [a.id, a.company, a.url, a.status, a.channel, a.poc, a.remarks, a.extra, a.dateApplied]),
        },
      });
    }

    return NextResponse.json({ exported: apps.length });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}
