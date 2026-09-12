import { createMcpHandler } from "mcp-handler";
import type { McpServer } from "@modelcontextprotocol/server";
import { requireMcpAuth } from "@better-auth/mcp";
import { z } from "zod";
import { auth, MCP_RESOURCE } from "@/lib/auth";
import {
  createApp,
  createContact,
  deleteApp,
  findOrCreateContactByName,
  listApps,
  listContacts,
  updateApp,
} from "@/lib/db";
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
        // A name here is matched against saved contacts and created if new, so callers
        // can keep passing a plain name without knowing about contact ids.
        const contact = poc?.trim() ? await findOrCreateContactByName(poc, company) : null;
        const app = await createApp({
          company,
          url: url ?? "",
          status: status ?? "Applied",
          channel: channel ?? "",
          remarks: remarks ?? "",
          extra: "",
          dateApplied: dateApplied ?? new Date().toISOString().slice(0, 10),
          contactIds: contact ? [contact.id] : [],
          primaryContactId: contact?.id ?? null,
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

        let contactIds = current.contacts.map((c) => c.id);
        let primaryContactId = current.contacts.find((c) => c.isPrimary)?.id ?? contactIds[0] ?? null;
        if (poc?.trim()) {
          const contact = await findOrCreateContactByName(poc, current.company);
          if (!contactIds.includes(contact.id)) contactIds = [...contactIds, contact.id];
          primaryContactId = contact.id;
        }

        await updateApp(current.id, {
          company: newCompany ?? current.company,
          url: url ?? current.url,
          status: status ?? current.status,
          channel: channel ?? current.channel,
          remarks: remarks ?? current.remarks,
          extra: current.extra,
          dateApplied: dateApplied ?? current.dateApplied,
          contactIds,
          primaryContactId,
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

    server.registerTool(
      "list_contacts",
      {
        title: "List saved contacts",
        description: "List every saved person (recruiters, referrers, hiring managers) with their details.",
        inputSchema: z.object({}),
      },
      async () => toolResult(await listContacts())
    );

    server.registerTool(
      "add_contact",
      {
        title: "Add a contact",
        description:
          "Save a new person. Use this when the user shares someone's details; attach them to an application with add_application/update_application's poc field.",
        inputSchema: z.object({
          name: z.string(),
          role: z.string().optional(),
          company: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          linkedin: z.string().optional(),
          notes: z.string().optional(),
        }),
      },
      async ({ name, role, company, email, phone, linkedin, notes }) =>
        toolResult({
          added: await createContact({
            name,
            role: role ?? "",
            company: company ?? "",
            email: email ?? "",
            phone: phone ?? "",
            linkedin: linkedin ?? "",
            notes: notes ?? "",
          }),
        })
    );
  },
  { serverInfo: { name: "job-tracker-dashboard", version: "1.0.0" } }
);

const handler = requireMcpAuth(auth, (request) => mcpServerHandler(request), { resource: MCP_RESOURCE });

export { handler as POST };
