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
import { weave_peek } from "./tools/peek.js";
import { weave_wait } from "./sensors/wait.js";
import { youtubeDemo } from "./tools/youtube_demo.js";
import { logProfessional } from "./ui/cli.js";

import { startDashboardServer } from "./dashboard/server.js";

type ToolHandler<T> = (session: any, config: Config) => Promise<T>;

async function withSecurity<T>(config: Config, toolName: string, handler: ToolHandler<T>): Promise<T> {
  // Reload config for live allowlist updates
  const { loadConfig } = await import("./config/loader.js");
  const liveConfig = await loadConfig();
  
  const rl = checkRateLimit(liveConfig);
  if (!rl.allowed) {
    throw new Error(`⊘ Weave blocked: rate limit exceeded. Retry in ${rl.retryAfterMs}ms`);
  }

  assertSafeModeAllows(toolName, liveConfig);

  const { session } = await getOrConnect(liveConfig);
  return handler(session, liveConfig);
}

function isMutatingTool(name: string): boolean {
  return ["weave_navigate", "weave_click", "weave_type", "weave_scroll", "weave_key", "weave_youtube_demo", "weave_wait"].includes(name);
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
    version: "1.3.0",
  });

  server.tool(
    "weave_read",
    "Read the current page as a semantic action map.",
    {
      lite: z.boolean().optional().describe("If true, returns a minimal element list to save tokens"),
      scope: z.enum(["navigation", "main_content", "sidebar", "form", "modal", "utility"]).optional().describe("Restrict to a specific page area"),
      query: z.string().optional().describe("Filter elements by label or type (internal search)"),
      limit: z.number().optional().describe("Limit the number of elements returned"),
    },
    async (args) => {
      try {
        logProfessional("ACTION", "Server", `weave_read called: ${JSON.stringify(args)}`);
        return await withSecurity(config, "weave_read", async (session, liveConfig) => {
          const result = await weaveRead(session, args);
          return { content: [{ type: "text", text: result }] };
        });
      } catch (e) {
        return wrapError(e);
      }
    }
  );

  server.tool(
    "weave_navigate",
    "Navigate the browser to a URL.",
    { url: z.string().describe("Full URL to navigate to") },
    async ({ url }) => {
      try {
        logProfessional("ACTION", "Server", `weave_navigate: ${url}`);
        return await withSecurity(config, "weave_navigate", async (session, liveConfig) => {
          const result = await weaveNavigate(session, url, liveConfig);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        });
      } catch (e) {
        return wrapError(e);
      }
    }
  );

  server.tool(
    "weave_click",
    "Click an element by its action map ID or semantic label (Sniper mode).",
    {
      id: z.string().optional().describe("Element ID from weave_read action map"),
      label: z.string().optional().describe("Semantic label to click (e.g. 'Search', 'Login'). Server finds and clicks in one step."),
      intent: z.string().optional().describe("Semantic intent/type to click (e.g. 'SEARCH_BAR')"),
      backendNodeId: z.number().optional().describe("Stable browser node ID (Fastest/most reliable)"),
    },
    async (args) => {
      try {
        logProfessional("ACTION", "Server", `weave_click: ${args.label || args.id || args.intent}`);
        return await withSecurity(config, "weave_click", async (session, liveConfig) => {
          const result = await weaveClick(session, args, liveConfig);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        });
      } catch (e) {
        return wrapError(e);
      }
    }
  );

  server.tool(
    "weave_type",
    "Type text into a form field (Sniper mode).",
    {
      id: z.string().optional().describe("Element ID from weave_read action map"),
      label: z.string().optional().describe("Semantic label to type into (e.g. 'Search', 'Comment'). Server finds and types in one step."),
      intent: z.string().optional().describe("Semantic intent/type to type into (e.g. 'SEARCH_BAR')"),
      backendNodeId: z.number().optional().describe("Stable browser node ID"),
      text: z.string().describe("Text to type"),
      clearFirst: z.boolean().optional().describe("If true, clears the field before typing"),
    },
    async (args) => {
      try {
        logProfessional("ACTION", "Server", `weave_type: ${args.text.substring(0, 10)}... into ${args.label || args.id || args.intent}`);
        return await withSecurity(config, "weave_type", async (session, liveConfig) => {
          const result = await weaveType(session, args, liveConfig);
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
        logProfessional("ACTION", "Server", `weave_key: ${key}${modifiers ? ` + ${modifiers.join("+")}` : ""}`);
        return await withSecurity(config, "weave_key", async (session, liveConfig) => {
          const result = await weaveKey(session, key, modifiers, liveConfig);
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
      action: z.enum(["list", "switch", "close"]).describe("list all tabs or switch to one"),
      tabId: z.string().optional().describe("Tab ID to switch to (required for switch or close action)"),
    },
    async ({ action, tabId }) => {
      try {
        return await withSecurity(config, "weave_tabs", async (session) => {
          let result: unknown;
          if (action === "list") {
            const { getTabList } = await import("./cdp/connector.js");
            result = await getTabList();
          } else if (action === "close") {
            if (!tabId) throw new Error("✗ Weave failed: tabId required for close");
            const { weaveTabs } = await import("./tools/tabs.js");
            result = await weaveTabs("close", tabId);
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
        logProfessional("ACTION", "Server", `weave_scroll: ${direction} ${amount || 500}px`);
        return await withSecurity(config, "weave_scroll", async (session, liveConfig) => {
          const result = await weaveScroll(session, direction, amount ?? 500, liveConfig);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        });
      } catch (e) {
        return wrapError(e);
      }
    }
  );

  server.tool(
    "weave_wait",
    "Wait for navigation, element, network_idle, dom_stable, or duration.",
    {
      condition: z.enum(["navigation", "element", "network_idle", "dom_stable", "duration"]).describe("Condition to wait for"),
      selector: z.string().optional().describe("for 'element' condition"),
      intent: z.string().optional().describe("for 'element' condition using weave_find internally"),
      timeoutMs: z.number().optional().describe("max wait time (default 10000)"),
      durationMs: z.number().optional().describe("for 'duration' condition"),
    },
    async (args) => {
      try {
        logProfessional("ACTION", "Server", `weave_wait: ${args.condition}`);
        return await withSecurity(config, "weave_wait", async (session, liveConfig) => {
          const result = await weave_wait(session, args);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        });
      } catch (e) {
        return wrapError(e);
      }
    }
  );

  server.tool(
    "weave_peek",
    "Targeted Vision for Canvas and Complex UI",
    {
      x: z.number(),
      y: z.number(),
      width: z.number().optional(),
      height: z.number().optional(),
      element_id: z.string().optional(),
    },
    async (args) => {
      try {
        logProfessional("ACTION", "Server", `weave_peek: ${args.x}, ${args.y}`);
        return await withSecurity(config, "weave_peek", async (session, liveConfig) => {
          const result = await weave_peek(session, args, liveConfig);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        });
      } catch (e) {
        return wrapError(e);
      }
    }
  );

  server.tool("weave_screenshot", "Capture a PNG screenshot of the current tab.", {}, async () => {
    try {
      logProfessional("ACTION", "Server", "weave_screenshot called");
      return await withSecurity(config, "weave_screenshot", async (session, liveConfig) => {
        const result = await weaveScreenshot(session, liveConfig);
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
      return await withSecurity(config, "weave_youtube_demo", async (session, liveConfig) => {
        const result = await youtubeDemo(session, liveConfig);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      });
    } catch (e) {
      return wrapError(e);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logProfessional("INFO", "Main", "✓ WeaveTab Server Ready. Waiting for AI commands...");

  // Start the dashboard silently
  startDashboardServer().catch(() => {});
}
