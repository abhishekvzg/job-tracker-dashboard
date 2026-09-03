import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { listApps } from "@/lib/db";

// Matches the header row of the Google Sheet this tracker used before migrating to Supabase.
const HEADERS = ["ID", "Company", "application url", "Application Status", "Channel", "POC", "Remarks", "Column 1", "Date Applied"];

export async function GET() {
  const apps = await listApps();
  const rows = [
    HEADERS,
    ...apps.map((a) => [a.id, a.company, a.url, a.status, a.channel, a.poc, a.remarks, a.extra, a.dateApplied]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="job-applications-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
