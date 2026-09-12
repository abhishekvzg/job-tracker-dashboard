import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { listApps } from "@/lib/db";

const HEADERS = [
  "ID",
  "Company",
  "Application URL",
  "Status",
  "Channel",
  "Point of contact",
  "Contact details",
  "Remarks",
  "Date Applied",
];

function contactDetails(app: Awaited<ReturnType<typeof listApps>>[number]) {
  return app.contacts
    .map((c) => [c.name, c.role, c.company, c.email, c.phone, c.linkedin].filter(Boolean).join(" | "))
    .join("\n");
}

export async function GET() {
  const apps = await listApps();
  const rows = [
    HEADERS,
    ...apps.map((a) => [
      a.id,
      a.company,
      a.url,
      a.status,
      a.channel,
      a.contacts.find((c) => c.isPrimary)?.name ?? a.contacts[0]?.name ?? "",
      contactDetails(a),
      a.remarks,
      a.dateApplied,
    ]),
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
