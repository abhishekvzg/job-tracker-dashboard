import { createMcpHandler } from "mcp-handler";
import type { McpServer } from "@modelcontextprotocol/server";
import { requireMcpAuth } from "@better-auth/mcp";
import { z } from "zod";
import { auth, MCP_RESOURCE } from "@/lib/auth";
import { createApp, deleteApp, listApps, updateApp } from "@/lib/db";
import { STATUS_OPTIONS } from "@/lib/types";
import { resolveApp, type ResolveResult } from "@/lib/mcpResolve";

function toolResult(payload: unknown) {
  return { content: [{ type: "text" as const, text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) }] };
}

function unresolved(result: Exclude<ResolveResult, { status: "found" }>) {
  if (result.status === "not_found") return toolResult({ error: "No matching application found." });
  return toolResult({
    error: "Multiple applications match — ask which one, then retry with the exact id or an unambiguous company name.",
    candidates: result.candidates.map((a) => ({ id: a.id, company: a.company, status: a.status })),
  });
}

const mcpServerHandler = createMcpHandler(
  (server: McpServer) => {
    server.registerTool(
      "list_applications",
      {
        title: "List job applications",
        description: "List tracked job applications, optionally filtered by status and/or channel.",
        inputSchema: z.object({
          status: z.enum(STATUS_OPTIONS).optional(),
          channel: z.string().optional(),
        }),
      },
      async ({ status, channel }) => {
        const apps = await listApps();
        const filtered = apps.filter(
          (a) => (!status || a.status === status) && (!channel || a.channel.toLowerCase() === channel.toLowerCase())
        );
        return toolResult(filtered);
      }
    );

    server.registerTool(
      "find_application",
      {
        title: "Find a job application",
        description: "Search tracked applications by company name (case-insensitive, partial match).",
        inputSchema: z.object({ query: z.string() }),
      },
      async ({ query }) => {
        const result = await resolveApp({ company: query });
        if (result.status !== "found") return unresolved(result);
        return toolResult(result.app);
      }
    );

    server.registerTool(
      "add_application",
      {
        title: "Add a job application",
        description: "Add a new job application to the tracker.",
        inputSchema: z.object({
          company: z.string(),
          url: z.string().optional(),
          status: z.enum(STATUS_OPTIONS).optional(),
          channel: z.string().optional(),
          poc: z.string().optional(),
          remarks: z.string().optional(),
          dateApplied: z.string().optional(),
        }),
      },
      async ({ company, url, status, channel, poc, remarks, dateApplied }) => {
        const app = await createApp({
          company,
          url: url ?? "",
          status: status ?? "Applied",
          channel: channel ?? "",
          poc: poc ?? "",
          remarks: remarks ?? "",
          extra: "",
          dateApplied: dateApplied ?? new Date().toISOString().slice(0, 10),
        });
        return toolResult({ added: app });
      }
    );

    server.registerTool(
      "update_application",
      {
        title: "Update a job application",
        description:
          "Update fields on an existing application (e.g. change status). Identify it by id, or by company name (fuzzy match) if id is unknown.",
        inputSchema: z.object({
          id: z.string().optional(),
          company: z.string().optional(),
          newCompany: z.string().optional(),
          status: z.enum(STATUS_OPTIONS).optional(),
          url: z.string().optional(),
          channel: z.string().optional(),
          poc: z.string().optional(),
          remarks: z.string().optional(),
          dateApplied: z.string().optional(),
        }),
      },
      async ({ id, company, newCompany, status, url, channel, poc, remarks, dateApplied }) => {
        const resolved = await resolveApp({ id, company });
        if (resolved.status !== "found") return unresolved(resolved);
        const current = resolved.app;
        await updateApp(current.id, {
          company: newCompany ?? current.company,
          url: url ?? current.url,
          status: status ?? current.status,
          channel: channel ?? current.channel,
          poc: poc ?? current.poc,
          remarks: remarks ?? current.remarks,
          extra: current.extra,
          dateApplied: dateApplied ?? current.dateApplied,
        });
        return toolResult({ updated: current.id });
      }
    );

    server.registerTool(
      "delete_application",
      {
        title: "Delete a job application",
        description: "Delete an application from the tracker. Identify it by id, or by company name (fuzzy match).",
        inputSchema: z.object({ id: z.string().optional(), company: z.string().optional() }),
      },
      async ({ id, company }) => {
        const resolved = await resolveApp({ id, company });
        if (resolved.status !== "found") return unresolved(resolved);
        await deleteApp(resolved.app.id);
        return toolResult({ deleted: resolved.app.id });
      }
    );
  },
  { serverInfo: { name: "job-tracker-dashboard", version: "1.0.0" } }
);

const handler = requireMcpAuth(auth, (request) => mcpServerHandler(request), { resource: MCP_RESOURCE });

export { handler as POST };
