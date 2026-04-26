import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getOrConnect } from "./cdp/connector.js";
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
import { weaveKey } from "./tools/key.js";
import { weaveFind } from "./tools/find.js";
import { youtubeDemo } from "./tools/youtube_demo.js";

type ToolHandler<T> = (session: any) => Promise<T>;

async function withSecurity<T>(config: Config, toolName: string, handler: ToolHandler<T>): Promise<T> {
  const rl = checkRateLimit(config);
  if (!rl.allowed) {
    throw new Error(`⊘ Weave blocked: rate limit exceeded. Retry in ${rl.retryAfterMs}ms`);
  }

  assertSafeModeAllows(toolName, config);

  const { session } = await getOrConnect(config);
  return handler(session);
}

function isMutatingTool(name: string): boolean {
  return ["weave_navigate", "weave_click", "weave_type", "weave_scroll", "weave_key", "weave_youtube_demo"].includes(name);
}

function assertSafeModeAllows(toolName: string, config: Config): void {
  if (config.safeMode && config.allow.length === 0 && isMutatingTool(toolName)) {
    throw new Error(
      `⊘ Weave blocked: safeMode is active and no domains are allowed.\nTo allow this domain, edit ~/.weavetab/config.json:\n{\n  "safeMode": false,\n  "allow": ["youtube.com"]\n}\nThen restart WeaveTab.`
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
  if (config.safeMode && config.allow.length === 0) {
    process.stderr.write("⚠ Weave warning: safeMode is active with an empty allow list. Mutating tools are disabled.\n");
  }

  const server = new McpServer({
    name: "weavetab",
    version: "1.2.1",
  });

  server.tool("weave_read", "Read the current page as a semantic action map.", {}, async () => {
    try {
      return await withSecurity(config, "weave_read", async (session) => {
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
        return await withSecurity(config, "weave_navigate", async (session) => {
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
        return await withSecurity(config, "weave_click", async (session) => {
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
        return await withSecurity(config, "weave_type", async (session) => {
          const result = await weaveType(session, id, text, clearFirst ?? false, config);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        });
      } catch (e) {
        return wrapError(e);
      }
    }
  );

  server.tool(
    "weave_key",
    "Press a physical key (Enter, Escape, etc.) with optional modifiers.",
    {
      key: z.string().describe("Key to press (e.g. Enter, Escape, ArrowUp, or single character)"),
      modifiers: z.array(z.enum(["Alt", "Ctrl", "Meta", "Shift"])).optional().describe("Optional modifier keys"),
    },
    async ({ key, modifiers }) => {
      try {
        return await withSecurity(config, "weave_key", async (session) => {
          const result = await weaveKey(session, key, modifiers, config);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        });
      } catch (e) {
        return wrapError(e);
      }
    }
  );

  server.tool(
    "weave_find",
    "Find an element by semantic intent (e.g. 'search bar', 'login button').",
    {
      intent: z.string().describe("The semantic intent to find"),
      group: z.enum(["navigation", "main_content", "sidebar", "form", "modal", "utility"]).optional().describe("Optional group to restrict search"),
    },
    async ({ intent, group }) => {
      try {
        return await withSecurity(config, "weave_find", async (session) => {
          const result = await weaveFind(session, intent, group);
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
        return await withSecurity(config, "weave_extract", async (session) => {
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
        return await withSecurity(config, "weave_tabs", async (session) => {
          let result: unknown;
          if (action === "list") {
            const { getTabList } = await import("./cdp/connector.js");
            result = await getTabList();
          } else {
            if (!tabId) throw new Error("✗ Weave failed: tabId required for switch");
            const { connectToTab } = await import("./cdp/connector.js");
            await connectToTab(tabId);
            result = { success: true, switchedTo: tabId };
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
        return await withSecurity(config, "weave_scroll", async (session) => {
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
      return await withSecurity(config, "weave_screenshot", async (session) => {
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

  server.tool("weave_youtube_demo", "Run a full YouTube MrBeast search and quality setting demo.", {}, async () => {
    try {
      return await withSecurity(config, "weave_youtube_demo", async (session) => {
        const result = await youtubeDemo(session, config);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      });
    } catch (e) {
      return wrapError(e);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
