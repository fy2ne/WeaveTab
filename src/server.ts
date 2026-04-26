import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { connectToChrome } from "./cdp/connector.js";
import { blockStorageAccess } from "./security/guard.js";
import { checkRateLimit } from "./security/ratelimit.js";
import { logAction } from "./audit/logger.js";
import type { Config } from "./config/loader.js";
import { weaveRead } from "./tools/read.js";
import { weaveNavigate } from "./tools/navigate.js";
import { weaveClick } from "./tools/click.js";
import { weaveType } from "./tools/type.js";
import { weaveExtract } from "./tools/extract.js";
import { weaveTabs } from "./tools/tabs.js";
import { weaveScroll } from "./tools/scroll.js";
import { weaveScreenshot } from "./tools/screenshot.js";

type ToolHandler<T> = () => Promise<T>;

function withSecurity<T>(config: Config, handler: ToolHandler<T>): Promise<T> {
  const rl = checkRateLimit(config);
  if (!rl.allowed) {
    throw new Error(
      `⊘ Weave blocked: rate limit exceeded. Retry in ${rl.retryAfterMs}ms`
    );
  }
  return handler();
}

function isMutatingTool(name: string): boolean {
  return ["weave_navigate", "weave_click", "weave_type", "weave_scroll"].includes(name);
}

function assertSafeModeAllows(toolName: string, config: Config): void {
  if (config.safeMode && config.allow.length === 0 && isMutatingTool(toolName)) {
    throw new Error(
      `⊘ Weave blocked: ${toolName} is disabled in safeMode with empty allow list. Add domains to allow[] or set safeMode: false.`
    );
  }
}

function wrapError(err: unknown): { content: [{ type: "text"; text: string }]; isError: true } {
  const message = err instanceof Error ? err.message : String(err);
  logAction("ERROR", "server", message);
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

export async function startServer(config: Config): Promise<void> {
  const { session } = await connectToChrome(config);
  await blockStorageAccess(session);

  const server = new McpServer({
    name: "weavetab",
    version: "1.0.0",
  });

  server.tool("weave_read", "Read the current page as a semantic action map.", {}, async () => {
    try {
      return await withSecurity(config, async () => {
        const result = await weaveRead(session);
        return { content: [{ type: "text", text: result }] };
      });
    } catch (e) {
      return wrapError(e);
    }
  });

  server.tool(
    "weave_navigate",
    "Navigate the browser to a URL.",
    { url: z.string().describe("Full URL to navigate to") },
    async ({ url }) => {
      try {
        assertSafeModeAllows("weave_navigate", config);
        return await withSecurity(config, async () => {
          const result = await weaveNavigate(session, url, config);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        });
      } catch (e) {
        return wrapError(e);
      }
    }
  );

  server.tool(
    "weave_click",
    "Click an element by its action map ID (e.g. btn-1).",
    { id: z.string().describe("Element ID from weave_read action map") },
    async ({ id }) => {
      try {
        assertSafeModeAllows("weave_click", config);
        return await withSecurity(config, async () => {
          const result = await weaveClick(session, id, config);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        });
      } catch (e) {
        return wrapError(e);
      }
    }
  );

  server.tool(
    "weave_type",
    "Type text into a form field by its action map ID.",
    {
      id: z.string().describe("Element ID from weave_read action map"),
      text: z.string().describe("Text to type"),
      clearFirst: z.boolean().optional().describe("If true, clears the field before typing"),
    },
    async ({ id, text, clearFirst }) => {
      try {
        assertSafeModeAllows("weave_type", config);
        return await withSecurity(config, async () => {
          const result = await weaveType(session, id, text, clearFirst ?? false, config);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        });
      } catch (e) {
        return wrapError(e);
      }
    }
  );

  server.tool(
    "weave_extract",
    "Extract visible text content from the current page.",
    {
      selector: z.string().optional().describe("CSS selector to scope extraction (default: body)"),
      format: z.enum(["text", "json", "list"]).describe("Output format"),
    },
    async ({ selector, format }) => {
      try {
        return await withSecurity(config, async () => {
          const result = await weaveExtract(session, selector, format);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        });
      } catch (e) {
        return wrapError(e);
      }
    }
  );

  server.tool(
    "weave_tabs",
    "List all open tabs or switch to a tab by ID.",
    {
      action: z.enum(["list", "switch"]).describe("list all tabs or switch to one"),
      tabId: z.string().optional().describe("Tab ID to switch to (required for switch action)"),
    },
    async ({ action, tabId }) => {
      try {
        return await withSecurity(config, async () => {
          let result: unknown;
          if (action === "list") {
            result = await weaveTabs("list", undefined);
          } else {
            if (!tabId) throw new Error("✗ Weave failed: tabId required for switch");
            result = await weaveTabs("switch", tabId);
          }
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        });
      } catch (e) {
        return wrapError(e);
      }
    }
  );

  server.tool(
    "weave_scroll",
    "Scroll the current page in a direction.",
    {
      direction: z.enum(["up", "down", "top", "bottom"]).describe("Scroll direction"),
      amount: z.number().optional().describe("Pixels to scroll (default: 500)"),
    },
    async ({ direction, amount }) => {
      try {
        assertSafeModeAllows("weave_scroll", config);
        return await withSecurity(config, async () => {
          const result = await weaveScroll(session, direction, amount ?? 500, config);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        });
      } catch (e) {
        return wrapError(e);
      }
    }
  );

  server.tool("weave_screenshot", "Capture a PNG screenshot of the current tab.", {}, async () => {
    try {
      return await withSecurity(config, async () => {
        const result = await weaveScreenshot(session, config);
        return {
          content: [
            {
              type: "image",
              data: result.data,
              mimeType: "image/png",
            },
          ],
        };
      });
    } catch (e) {
      return wrapError(e);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
