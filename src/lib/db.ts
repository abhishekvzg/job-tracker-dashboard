import { supabase } from "./supabaseClient";
import type { JobApp } from "./types";

export type { JobApp };

type Row = {
  id: number;
  company: string;
  url: string;
  status: string;
  channel: string;
  poc: string;
  remarks: string;
  extra: string;
  date_applied: string;
};

function rowToApp(row: Row): JobApp {
  return {
    id: String(row.id),
    company: row.company,
    url: row.url,
    status: row.status,
    channel: row.channel,
    poc: row.poc,
    remarks: row.remarks,
    extra: row.extra,
    dateApplied: row.date_applied,
  };
}

function appToRow(data: Omit<JobApp, "id">) {
  return {
    company: data.company,
    url: data.url,
    status: data.status,
    channel: data.channel,
    poc: data.poc,
    remarks: data.remarks,
    extra: data.extra,
    date_applied: data.dateApplied,
  };
}

export async function listApps(): Promise<JobApp[]> {
  const { data, error } = await supabase.from("job_applications").select("*").order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Row[]).map(rowToApp);
}

export async function getApp(id: string): Promise<JobApp | null> {
  const { data, error } = await supabase.from("job_applications").select("*").eq("id", Number(id)).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToApp(data as Row) : null;
}

export async function createApp(data: Omit<JobApp, "id">): Promise<JobApp> {
  const { data: row, error } = await supabase.from("job_applications").insert(appToRow(data)).select("*").single();
  if (error) throw new Error(error.message);
  return rowToApp(row as Row);
}

export async function updateApp(id: string, data: Omit<JobApp, "id">): Promise<void> {
  const { data: row, error } = await supabase
    .from("job_applications")
    .update(appToRow(data))
    .eq("id", Number(id))
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("NOT_FOUND");
}

export async function deleteApp(id: string): Promise<void> {
  const { data: row, error } = await supabase
    .from("job_applications")
    .delete()
    .eq("id", Number(id))
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("NOT_FOUND");
}
