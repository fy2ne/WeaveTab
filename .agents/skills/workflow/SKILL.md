---
name: workflow
description: >-
  # WeaveTab — Global Build Workflow

  > This is the single source of truth for how WeaveTab is built.

  > Execute phases in order. Do not start a phase until the previous one is
  verified complete.

  > After each phase, update WeaveTab-log.md as required by RULES.md.
---

# WeaveTab — Global Build Workflow
> This is the single source of truth for how WeaveTab is built.
> Execute phases in order. Do not start a phase until the previous one is verified complete.
> After each phase, update WeaveTab-log.md as required by RULES.md.

---

## Project Overview

WeaveTab is a local MCP server that attaches to the user's running Chrome browser via CDP (Chrome DevTools Protocol). It reads the page as a semantic action map — no screenshots — and exposes clean MCP tools to any AI agent (OpenCode, Gemini CLI, Claude Code, Cursor). Published to npm under `@fy2ne/weavetab`. Zero cloud. Everything runs locally.

---

## Repository Structure

```
weavetab/
├── src/
│   ├── index.ts           ← Entry point. Boots the MCP server.
│   ├── server.ts          ← MCP server definition. Registers all tools.
│   ├── cdp/
│   │   ├── connector.ts   ← Connects to Chrome via CDP on port 9222.
│   │   └── walker.ts      ← DOM accessibility tree walker. Builds action map.
│   ├── tools/
│   │   ├── read.ts        ← weave_read tool
│   │   ├── navigate.ts    ← weave_navigate tool
│   │   ├── click.ts       ← weave_click tool
│   │   ├── type.ts        ← weave_type tool
│   │   ├── extract.ts     ← weave_extract tool
│   │   ├── tabs.ts        ← weave_tabs tool
│   │   ├── scroll.ts      ← weave_scroll tool
│   │   └── screenshot.ts  ← weave_screenshot tool (disabled by default)
│   ├── security/
│   │   ├── allowlist.ts   ← Domain allow/block list enforcement
│   │   ├── filter.ts      ← Hidden element filter (prompt injection defense)
│   │   ├── guard.ts       ← Blocks cookie/storage access, root detection
│   │   └── ratelimit.ts   ← Sliding window rate limiter (20 actions/min default)
│   ├── audit/
│   │   └── logger.ts      ← Writes every action to ~/.weavetab/audit.log
│   └── config/
│       └── loader.ts      ← Loads ~/.weavetab/config.json, applies defaults
├── WeaveTab-log.md        ← Agent progress log (append only)
├── RULES.md               ← Agent rules (do not modify during build)
├── WORKFLOW.md            ← This file
├── package.json
├── tsconfig.json
└── README.md
```

---

## Phase 0 — Project Initialization

**Goal:** Working TypeScript project that compiles and runs as an npx command.

### Tasks
1. Create `package.json` with these exact fields:
   - `name`: `@fy2ne/weavetab`
   - `version`: `1.0.0`
   - `bin`: `{ "weavetab": "./dist/index.js" }`
   - `main`: `./dist/index.js`
   - `type`: `module`
   - `files`: `["dist"]`
   - `scripts`: `{ "build": "tsc", "dev": "tsx src/index.ts", "prepublishOnly": "npm run build" }`

2. Create `tsconfig.json`:
   - `target`: `ES2022`
   - `module`: `NodeNext`
   - `moduleResolution`: `NodeNext`
   - `strict`: `true`
   - `outDir`: `./dist`
   - `rootDir`: `./src`
   - `declaration`: `true`

3. Install dependencies:
   - `@modelcontextprotocol/sdk` — MCP server framework
   - `chrome-remote-interface` — CDP connection to Chrome
   - `zod` — input validation for tool arguments

4. Create `src/index.ts` — prints the WeaveTab boot message and imports server.

5. Verify `npm run build` succeeds with zero errors.

**Log to WeaveTab-log.md when:** Build succeeds and `node dist/index.js` prints the boot message.

---

## Phase 1 — CDP Connector

**Goal:** WeaveTab can connect to a running Chrome instance and confirm the connection.

### Tasks

**`src/cdp/connector.ts`**
- Export an async function `connectToChrome(): Promise<ChromeClient>`
- Tries to connect to `http://127.0.0.1:9222`
- On success: prints `✓ Weaved. Ready.`
- On failure: prints `✗ Weave failed: Chrome not found on port 9222. Launch Chrome with --remote-debugging-port=9222` and exits with code 1
- Detects if Chrome debug port is exposed to non-localhost (check binding) — if so, warn and exit
- Returns a typed client object with the active tab's CDP session

**`src/cdp/walker.ts`**
- Export `buildActionMap(session): Promise<ActionMap>`
- Uses `Accessibility.getFullAXTree` via CDP to get the accessibility tree
- Walks the tree and collects only:
  - Buttons (`role: button`)
  - Links (`role: link`)
  - Text inputs, search boxes, textareas (`role: textbox`, `role: searchbox`, `role: combobox`)
  - Checkboxes and radio buttons
  - Select dropdowns
  - Any element with an `aria-label` or visible text
- Assigns sequential IDs: `btn-1`, `lnk-2`, `inp-3`, etc.
- Filters out any node where `ignored: true` in the AX tree (hidden elements — prompt injection defense)
- Returns typed `ActionMap`:
  ```typescript
  type ActionMap = {
    url: string;
    title: string;
    elements: ActionElement[];
  }
  type ActionElement = {
    id: string;
    role: string;
    label: string;
    value?: string;
  }
  ```

**Log to WeaveTab-log.md when:** Connector works and walker returns a valid ActionMap from a real Chrome tab.

---

## Phase 2 — Security Layer

**Goal:** All four security systems are active before any tool can execute.

> Build this entire phase before touching tools. Security is not optional and is not added later.

### Tasks

**`src/config/loader.ts`**
- Loads `~/.weavetab/config.json` if it exists
- If file does not exist, creates it with safe defaults:
  ```json
  {
    "allow": [],
    "block": [],
    "safeMode": true,
    "screenshot": false,
    "maxActionsPerMinute": 20
  }
  ```
- When `safeMode: true` and `allow` is empty: only `weave_read`, `weave_tabs`, `weave_extract` work. `weave_click`, `weave_type`, `weave_navigate` are blocked.
- Exports a typed `Config` object used by all other modules.

**`src/security/allowlist.ts`**
- Export `checkDomain(url: string, config: Config): AllowResult`
- Returns `{ allowed: true }` or `{ allowed: false, reason: string }`
- Logic:
  1. If `config.block` has a matching pattern → blocked
  2. If `config.allow` is non-empty and URL does not match any pattern → blocked
  3. If `config.allow` is empty and `safeMode: false` → allowed (user opted in explicitly)
  4. Supports `*` wildcard in patterns (e.g. `*.gov`, `bank*`)
- This function must be called at the top of every mutating tool (navigate, click, type, scroll)

**`src/security/filter.ts`**
- Export `filterHidden(elements: ActionElement[]): ActionElement[]`
- Already handled at the walker level (AX tree `ignored` flag), but this is a second pass
- Removes any element whose label contains zero-width characters, excessive whitespace, or is over 500 chars (likely injected garbage)

**`src/security/guard.ts`**
- Export `assertNotRoot(): void` — checks `process.getuid?.() === 0`, exits with error if true
- Export `blockStorageAccess(session): void` — overrides `document.cookie`, `localStorage`, `sessionStorage` getters via CDP `Runtime.addBinding` so they return empty strings and log a warning if accessed
- `blockStorageAccess` must be called immediately after connecting to any tab

**`src/security/ratelimit.ts`**
- Sliding window rate limiter
- Tracks timestamps of last N actions in a circular buffer
- Export `checkRateLimit(config: Config): RateLimitResult`
- Returns `{ allowed: true }` or `{ allowed: false, retryAfterMs: number }`
- Must be called at the start of every tool handler

**Log to WeaveTab-log.md when:** All four security modules are implemented, typed, and have no TypeScript errors.

---

## Phase 3 — MCP Server + Tools

**Goal:** All 8 tools are registered and working end-to-end through the MCP protocol.

Build tools in this order. Test each one before moving to the next.

### `src/server.ts`
- Creates the MCP server using `@modelcontextprotocol/sdk`
- Registers all 8 tools with their Zod schemas
- On every tool call: runs security checks first (allowlist → rate limit → guard), then executes
- Handles errors uniformly: any thrown error returns a structured MCP error response with a Weave-branded message

---

### Tool: `weave_read`
**File:** `src/tools/read.ts`
- No arguments
- Gets current tab, runs walker, applies `filterHidden`
- Returns JSON ActionMap
- Log format: `⟳ Weaving: reading page [url]` → `✓ Weaved: [N] elements found`

---

### Tool: `weave_navigate`
**File:** `src/tools/navigate.ts`
- Argument: `{ url: string }`
- Validate URL format with `new URL()` — throw if invalid
- Run allowlist check — throw if blocked
- CDP: `Page.navigate({ url })`
- Wait for `Page.loadEventFired`
- Returns `{ success: true, url: string, title: string }`
- Log: `⟳ Weaving: navigating to [url]` → `✓ Weaved: arrived at [title]`

---

### Tool: `weave_click`
**File:** `src/tools/click.ts`
- Argument: `{ id: string }` (element ID from ActionMap, e.g. `btn-1`)
- Run allowlist check on current tab URL
- Find element in last ActionMap by ID
- Use CDP `DOM.getDocument` + `DOM.querySelector` to find the real node by its AX node ID
- CDP `Input.dispatchMouseEvent` to click it
- Returns `{ success: true, clicked: label }`
- Log: `⟳ Weaving: clicking [label]` → `✓ Weaved: clicked [label]`

---

### Tool: `weave_type`
**File:** `src/tools/type.ts`
- Arguments: `{ id: string, text: string, clearFirst?: boolean }`
- Run allowlist check
- Find element by ID in last ActionMap
- If `clearFirst: true`, select all and delete before typing
- CDP `Input.dispatchKeyEvent` for each character
- Audit log writes `[REDACTED]` instead of actual text
- Returns `{ success: true }`
- Log: `⟳ Weaving: typing into [label]` → `✓ Weaved: typed into [label]`

---

### Tool: `weave_extract`
**File:** `src/tools/extract.ts`
- Arguments: `{ selector?: string, format: "text" | "json" | "list" }`
- Runs CDP `Runtime.evaluate` with a safe script that reads only `innerText` and `textContent` from visible elements
- The script must NOT access `cookie`, `localStorage`, `sessionStorage` — if selector targets these, return error
- Returns structured content based on `format`
- Log: `⟳ Weaving: extracting from [url]` → `✓ Weaved: extracted [N] chars`

---

### Tool: `weave_tabs`
**File:** `src/tools/tabs.ts`
- Arguments: `{ action: "list" | "switch", tabId?: string }`
- `list`: returns all open tabs as `[{ id, title, url }]`
- `switch`: activates tab by ID via CDP `Target.activateTarget`
- Log: `⟳ Weaving: listing tabs` / `⟳ Weaving: switching to [title]`

---

### Tool: `weave_scroll`
**File:** `src/tools/scroll.ts`
- Arguments: `{ direction: "up" | "down" | "top" | "bottom", amount?: number }`
- CDP `Input.dispatchMouseEvent` scroll events
- `amount` defaults to 500px
- Log: `⟳ Weaving: scrolling [direction]`

---

### Tool: `weave_screenshot`
**File:** `src/tools/screenshot.ts`
- Arguments: none
- First check: if `config.screenshot !== true`, return error: `⊘ Weave blocked: screenshots disabled. Set screenshot: true in ~/.weavetab/config.json`
- If enabled: CDP `Page.captureScreenshot({ format: "png" })`
- Returns base64 PNG
- Log: `⟳ Weaving: capturing screenshot` → `✓ Weaved: screenshot [WxH]`

**Log to WeaveTab-log.md when:** Each tool is complete. One entry per tool.

---

## Phase 4 — Audit Logger

**Goal:** Every tool action is written to disk.

**`src/audit/logger.ts`**
- Ensures `~/.weavetab/` directory exists on startup
- Opens `~/.weavetab/audit.log` in append mode
- Export `logAction(action: string, target: string, result: string): void`
- Format: `[ISO timestamp]  [action padded to 10 chars]  [target]  →  [result]`
- `weave_type` always writes `[REDACTED]` as the target value
- Must be synchronous write (`fs.appendFileSync`) — no buffering, no async — so logs survive crashes

**Log to WeaveTab-log.md when:** Logger is integrated into all 8 tools and verified writing to disk.

---

## Phase 5 — README + Polish

**Goal:** A developer who has never heard of WeaveTab can read the README and be set up in 3 minutes.

### README.md must contain (in order):
1. One-line description
2. The problem it solves (token waste, extension requirements, fake sessions)
3. How it is different from BrowserMCP, browser-use, Playwright MCP (one table)
4. Prerequisites (Chrome, Node 18+)
5. Setup: exactly how to launch Chrome with `--remote-debugging-port=9222` on Windows, Mac, Linux
6. Installation: the exact JSON to paste into OpenCode / Gemini CLI / Claude Code config
7. Config reference: `~/.weavetab/config.json` all fields explained
8. Tools reference: all 8 tools, arguments, what they return
9. Security section: explain what WeaveTab protects against
10. Audit log: where it is, what it looks like

### package.json final check:
- `description`, `keywords`, `homepage`, `repository`, `author: "fy2ne"` all filled in
- `engines: { "node": ">=18" }`

**Log to WeaveTab-log.md when:** README is complete.

---

## Phase 6 — Publish

**Goal:** Anyone in the world can run `npx @quiten/weavetab` and it works.

### Tasks
1. `npm run build` — must succeed with zero errors and zero warnings
2. `npm pack` — inspect the tarball, confirm only `dist/` and `README.md` and `package.json` are included (no `src/`, no `node_modules/`)
3. `npm login` with fy2ne's npm account (scoped to `@fy2ne`)
4. `npm publish --access public`
5. Test: on a clean machine (or temp directory), run `npx @fy2ne/weavetab` and confirm it boots

**Log to WeaveTab-log.md when:** Publish succeeds and npx command works.

---

## Completion Criteria

WeaveTab is done when all of the following are true:

- [ ] `npx @fy2ne/weavetab` boots and prints the Weave brand messages
- [ ] Connects to Chrome on port 9222 without an extension
- [ ] `weave_read` returns a semantic action map with no screenshots
- [ ] All 8 tools work end-to-end through the MCP protocol
- [ ] Domain allowlist blocks correctly configured domains
- [ ] Hidden elements are filtered from every action map
- [ ] Cookie/storage access is hard-blocked
- [ ] Rate limiter triggers at the configured limit
- [ ] Audit log writes correctly for all 8 tools
- [ ] `WeaveTab-log.md` has an entry for every completed phase
- [ ] README covers setup in under 3 minutes for a new user
- [ ] Zero TypeScript errors on `npm run build`
- [ ] Package published and installable via npx