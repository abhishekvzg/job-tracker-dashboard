import { google, sheets_v4 } from "googleapis";
import { getAuthorizedClient } from "./googleAuth";
import type { JobApp } from "./types";

export type { JobApp };

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1ZnfMcQLClmwE_sKN7Aa92b6hfCGkhVUmnkmnhZ-P5lo";
const TAB_NAME = process.env.GOOGLE_SHEET_RANGE || "Sheet1";
const FULL_RANGE = `${TAB_NAME}!A:I`;

function rowToApp(row: string[]): JobApp {
  return {
    id: row[0] ?? "",
    company: row[1] ?? "",
    url: row[2] ?? "",
    status: row[3] ?? "",
    channel: row[4] ?? "",
    poc: row[5] ?? "",
    remarks: row[6] ?? "",
    extra: row[7] ?? "",
    dateApplied: row[8] ?? "",
  };
}

function appToRow(app: JobApp): string[] {
  return [app.id, app.company, app.url, app.status, app.channel, app.poc, app.remarks, app.extra, app.dateApplied];
}

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  const auth = await getAuthorizedClient();
  return google.sheets({ version: "v4", auth });
}

async function getTabSheetId(sheets: sheets_v4.Sheets): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const tab = meta.data.sheets?.find((s) => s.properties?.title === TAB_NAME);
  if (tab?.properties?.sheetId == null) throw new Error(`Tab "${TAB_NAME}" not found`);
  return tab.properties.sheetId;
}

async function findRowNumberById(sheets: sheets_v4.Sheets, id: string): Promise<number> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${TAB_NAME}!A:A` });
  const values = (res.data.values ?? []) as string[][];
  const index = values.findIndex((row, i) => i > 0 && row[0] === id);
  if (index === -1) throw new Error("NOT_FOUND");
  return index + 1; // 1-based row number, matches sheet row numbering
}

export async function listApps(): Promise<JobApp[]> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: FULL_RANGE });
  const values = (res.data.values ?? []) as string[][];
  const [, ...dataRows] = values;
  return dataRows.filter((row) => row.some((cell) => cell)).map(rowToApp);
}

export async function getApp(id: string): Promise<JobApp | null> {
  const apps = await listApps();
  return apps.find((a) => a.id === id) ?? null;
}

export async function createApp(data: Omit<JobApp, "id">): Promise<JobApp> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${TAB_NAME}!A:A` });
  const ids = ((res.data.values ?? []) as string[][])
    .slice(1)
    .map((r) => Number(r[0]))
    .filter((n) => !Number.isNaN(n));
  const nextId = String((ids.length ? Math.max(...ids) : 0) + 1);
  const app: JobApp = { ...data, id: nextId };

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: FULL_RANGE,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [appToRow(app)] },
  });

  return app;
}

export async function updateApp(id: string, data: Omit<JobApp, "id">): Promise<void> {
  const sheets = await getSheetsClient();
  const rowNumber = await findRowNumberById(sheets, id);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${TAB_NAME}!A${rowNumber}:I${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [appToRow({ ...data, id })] },
  });
}

export async function deleteApp(id: string): Promise<void> {
  const sheets = await getSheetsClient();
  const rowNumber = await findRowNumberById(sheets, id);
  const sheetId = await getTabSheetId(sheets);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber },
          },
        },
      ],
    },
  });
}
