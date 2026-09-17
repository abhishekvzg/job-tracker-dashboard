import { createMcpHandler } from "mcp-handler";
import type { McpServer } from "@modelcontextprotocol/server";
import { requireMcpAuth } from "@better-auth/mcp";
import { z } from "zod";
import { auth, MCP_RESOURCE } from "@/lib/auth";
import {
  createApp,
  deleteApp,
  deleteContact,
  findContactByName,
  listApps,
  listContacts,
  updateApp,
  upsertContactByName,
} from "@/lib/db";
import { MAX_CONTACTS_PER_APPLICATION, STATUS_OPTIONS } from "@/lib/types";
import { resolveApp, type ResolveResult } from "@/lib/mcpResolve";
import { todayISO } from "@/lib/format";

function toolResult(payload: unknown) {
  return {
    content: [
      { type: "text" as const, text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) },
    ],
  };
}

function unresolved(result: Exclude<ResolveResult, { status: "found" }>) {
  if (result.status === "not_found") return toolResult({ error: "No matching application found." });
  return toolResult({
    error: "Multiple applications match — ask which one, then retry with the exact id or an unambiguous company name.",
    candidates: result.candidates.map((a) => ({ id: a.id, company: a.company, status: a.status })),
  });
}

const personShape = {
  name: z.string().describe("The person's name."),
  role: z.string().optional().describe("Their job title, e.g. 'Recruiter' or 'Hiring Manager'."),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedin: z.string().optional(),
  notes: z.string().optional().describe("Context: how you know them, what was discussed."),
  lastContacted: z.string().optional().describe("YYYY-MM-DD of the last time the user reached out."),
};

const mcpServerHandler = createMcpHandler(
  (server: McpServer) => {
    server.registerTool(
      "list_applications",
      {
        title: "List job applications",
        description: "List tracked job applications with their points of contact, optionally filtered.",
        inputSchema: z.object({
          status: z.enum(STATUS_OPTIONS).optional(),
          channel: z.string().optional(),
        }),
      },
      async ({ status, channel }) => {
        const apps = await listApps();
        return toolResult(
          apps.filter(
            (a) => (!status || a.status === status) && (!channel || a.channel.toLowerCase() === channel.toLowerCase())
          )
        );
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
        description: "Add a new job application. Points of contact can be included in the same call.",
        inputSchema: z.object({
          company: z.string(),
          url: z.string().optional(),
          status: z.enum(STATUS_OPTIONS).optional(),
          channel: z.string().optional(),
          remarks: z.string().optional(),
          dateApplied: z.string().optional(),
          contacts: z
            .array(z.object(personShape))
            .optional()
            .describe(`People at this company, up to ${MAX_CONTACTS_PER_APPLICATION}.`),
        }),
      },
      async ({ company, url, status, channel, remarks, dateApplied, contacts }) => {
        const app = await createApp({
          company,
          url: url ?? "",
          status: status ?? "Applied",
          channel: channel ?? "",
          remarks: remarks ?? "",
          extra: "",
          dateApplied: dateApplied ?? todayISO(),
        });
        for (const person of contacts ?? []) {
          await upsertContactByName(app.id, person.name, person);
        }
        const [fresh] = (await listApps()).filter((a) => a.id === app.id);
        return toolResult({ added: fresh ?? app });
      }
    );

    server.registerTool(
      "update_application",
      {
        title: "Update a job application",
        description:
          "Update an existing application (e.g. change status). Identify it by id, or by company name (fuzzy match).",
        inputSchema: z.object({
          id: z.string().optional(),
          company: z.string().optional(),
          newCompany: z.string().optional(),
          status: z.enum(STATUS_OPTIONS).optional(),
          url: z.string().optional(),
          channel: z.string().optional(),
          remarks: z.string().optional(),
          dateApplied: z.string().optional(),
        }),
      },
      async ({ id, company, newCompany, status, url, channel, remarks, dateApplied }) => {
        const resolved = await resolveApp({ id, company });
        if (resolved.status !== "found") return unresolved(resolved);
        const current = resolved.app;
        await updateApp(current.id, {
          company: newCompany ?? current.company,
          url: url ?? current.url,
          status: status ?? current.status,
          channel: channel ?? current.channel,
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
        description: "Delete an application and its points of contact. Identify by id or company name.",
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
      "save_contacts",
      {
        title: "Save points of contact for a company",
        description:
          "Add or update one or more people at a company, in a single call. Use this whenever the user mentions " +
          "reaching out to someone — pass everything they said about each person. Anyone already saved at that " +
          "company under the same name is updated in place rather than duplicated; fields you omit keep their " +
          "existing values. A person belongs to exactly one company. Set lastContacted (or markContactedToday) " +
          "when the user says they emailed or spoke to them.",
        inputSchema: z.object({
          company: z.string().describe("Company name — fuzzy matched against tracked applications."),
          contacts: z.array(z.object(personShape)).min(1),
          markContactedToday: z
            .boolean()
            .optional()
            .describe("Stamp today's date as lastContacted for every person in this call."),
        }),
      },
      async ({ company, contacts, markContactedToday }) => {
        const resolved = await resolveApp({ company });
        if (resolved.status !== "found") return unresolved(resolved);

        const existing = await listContacts(resolved.app.id);
        const names = new Set(existing.map((c) => c.name.toLowerCase()));
        const incomingNew = contacts.filter((p) => !names.has(p.name.trim().toLowerCase())).length;
        if (existing.length + incomingNew > MAX_CONTACTS_PER_APPLICATION) {
          return toolResult({
            error: `${resolved.app.company} already has ${existing.length} of a maximum ${MAX_CONTACTS_PER_APPLICATION} contacts; that call would add ${incomingNew} more.`,
          });
        }

        const saved = [];
        for (const person of contacts) {
          saved.push(
            await upsertContactByName(resolved.app.id, person.name, {
              ...person,
              lastContacted: markContactedToday ? todayISO() : person.lastContacted,
            })
          );
        }
        return toolResult({ company: resolved.app.company, saved });
      }
    );

    server.registerTool(
      "list_contacts",
      {
        title: "List points of contact",
        description: "List saved people, either across the whole tracker or for one company.",
        inputSchema: z.object({ company: z.string().optional() }),
      },
      async ({ company }) => {
        if (!company) {
          const apps = await listApps();
          return toolResult(
            apps.filter((a) => a.contacts.length > 0).map((a) => ({ company: a.company, contacts: a.contacts }))
          );
        }
        const resolved = await resolveApp({ company });
        if (resolved.status !== "found") return unresolved(resolved);
        return toolResult({ company: resolved.app.company, contacts: resolved.app.contacts });
      }
    );

    server.registerTool(
      "delete_contact",
      {
        title: "Remove a point of contact",
        description: "Remove one person from a company's application.",
        inputSchema: z.object({ company: z.string(), name: z.string() }),
      },
      async ({ company, name }) => {
        const resolved = await resolveApp({ company });
        if (resolved.status !== "found") return unresolved(resolved);
        const contact = await findContactByName(resolved.app.id, name);
        if (!contact) return toolResult({ error: `No contact named "${name}" at ${resolved.app.company}.` });
        await deleteContact(contact.id);
        return toolResult({ removed: contact.name, from: resolved.app.company });
      }
    );
  },
  { serverInfo: { name: "job-tracker-dashboard", version: "1.0.0" } }
);

const handler = requireMcpAuth(auth, (request) => mcpServerHandler(request), { resource: MCP_RESOURCE });

export { handler as POST };
