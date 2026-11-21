import { Hono } from "hono";
import { z } from "zod";
import { roleAtLeast } from "@/shared/auth";
import type { ModuleContext, ServerModule, ToolDefinition } from "@/modules/types.server";
import { getContext } from "../context";
import type { AppEnv } from "../env";
import { toErrorBody } from "../lib/errors";
import { coreTools } from "./core-tools";

/**
 * Model Context Protocol server (Streamable HTTP, stateless, JSON responses).
 * Connect any MCP client to POST {APP_URL}/mcp with `Authorization: Bearer sk_…`
 * (create the token in Settings → API tokens). Every module tool is exposed
 * with the token owner's permissions.
 */
const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | { jsonrpc: "2.0"; id: string | number | null; error: { code: number; message: string } };

export function allTools(modules: readonly ServerModule[]): ToolDefinition[] {
  return [...coreTools(modules), ...modules.flatMap((module) => module.tools ?? [])];
}

export function toolInputJsonSchema(tool: ToolDefinition): Record<string, unknown> {
  const schema = z.toJSONSchema(tool.input, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

async function handle(message: JsonRpcRequest, ctx: ModuleContext, tools: ToolDefinition[], appName: string): Promise<JsonRpcResponse | null> {
  const id = message.id ?? null;
  const ok = (result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, text: string): JsonRpcResponse => ({ jsonrpc: "2.0", id, error: { code, message: text } });

  // Notifications (no id) get no response body.
  if (message.id === undefined) return null;

  switch (message.method) {
    case "initialize": {
      const requested = String(message.params?.protocolVersion ?? "");
      return ok({
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "sistemele", title: appName, version: "0.1.0" },
        instructions: `Business tools for ${appName}. Read before you write: list or get records first, then create or update. Money is in integer cents; VAT rates are basis points (2100 = 21%). Dates are YYYY-MM-DD.`,
      });
    }
    case "ping":
      return ok({});
    case "tools/list": {
      const visible = tools.filter((tool) => ctx.user && roleAtLeast(ctx.user.role, tool.minRole ?? "member"));
      return ok({
        tools: visible.map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: toolInputJsonSchema(tool),
          annotations: { title: tool.title, readOnlyHint: Boolean(tool.readOnly), destructiveHint: false, openWorldHint: false },
        })),
      });
    }
    case "tools/call": {
      const name = String(message.params?.name ?? "");
      const tool = tools.find((candidate) => candidate.name === name);
      if (!tool) return fail(-32602, `Unknown tool: ${name}`);
      try {
        ctx.requireRole(tool.minRole ?? "member");
        const input = tool.input.parse(message.params?.arguments ?? {});
        const result = await tool.run(input, ctx);
        const structured = result !== null && typeof result === "object" && !Array.isArray(result) ? (result as Record<string, unknown>) : { result };
        return ok({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: structured });
      } catch (error) {
        const { body } = toErrorBody(error);
        const details = body.error.issues ? `\n${JSON.stringify(body.error.issues, null, 2)}` : "";
        return ok({ isError: true, content: [{ type: "text", text: `${body.error.message}${details}` }] });
      }
    }
    default:
      return fail(-32601, `Method not found: ${message.method}`);
  }
}

export function mcpRoutes(modules: readonly ServerModule[]) {
  const tools = allTools(modules);
  return new Hono<AppEnv>()
    .post("/", async (c) => {
      const ctx = getContext(c);
      if (!ctx.user) {
        c.header("WWW-Authenticate", 'Bearer realm="sistemele", error="invalid_token"');
        return c.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Send Authorization: Bearer <API token>. Create one in Settings → API tokens." } }, 401);
      }
      let payload: unknown;
      try {
        payload = await c.req.json();
      } catch {
        return c.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
      }
      const messages = (Array.isArray(payload) ? payload : [payload]) as JsonRpcRequest[];
      // One HTTP request runs at most 20 calls, so a batch cannot fan out into thousands of writes or emails.
      if (messages.length > 20) return c.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Send at most 20 messages in one batch." } }, 400);
      const responses = (await Promise.all(messages.map((message) => handle(message, ctx, tools, c.env.APP_NAME)))).filter(
        (response): response is JsonRpcResponse => response !== null,
      );
      if (responses.length === 0) return c.body(null, 202);
      return c.json(Array.isArray(payload) ? responses : responses[0]);
    })
    .get("/", (c) => c.body(null, 405, { Allow: "POST" }))
    .delete("/", (c) => c.body(null, 405, { Allow: "POST" }));
}
