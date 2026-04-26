# WeaveTab — Agent Progress Log

---

## 2026-04-26 — Phase 0: Project Initialization

### What was built
Created `package.json` with all required fields (`@fy2ne/weavetab`, `bin`, `type: module`, `files: ["dist"]`, `engines: {node: ">=18"}`). Created `tsconfig.json` with `strict: true`, `target: ES2022`, `module: NodeNext`. Installed all three runtime dependencies (`@modelcontextprotocol/sdk`, `chrome-remote-interface`, `zod`) and devDependencies (`typescript`, `tsx`, `@types/node`, `@types/chrome-remote-interface`). Created `src/index.ts` entry point that prints Weave brand boot message, guards against root, loads config, and starts the server. Fixed `@types/chrome-remote-interface` version from `^0.31.15` to `^0.33.0` (latest available). `npm run build` produces zero errors and zero warnings. `node dist/index.js` prints `⟳ Weaving into Chrome...` then exits cleanly with the expected error when Chrome is not running.

### Files changed
- `package.json` — created with all workflow-required fields
- `tsconfig.json` — created with strict: true, NodeNext, ES2022
- `src/index.ts` — entry point with boot message, root guard, config load, server start

### Status
✓ Complete

### Next
Phase 1 — CDP Connector + DOM Walker

---

## 2026-04-26 — Phase 1: CDP Connector + DOM Walker

### What was built
`src/cdp/connector.ts` exports `connectToChrome()` which connects exclusively to `127.0.0.1:9222`, finds the first non-blank page target, enables Accessibility/DOM/Page/Runtime domains, and returns a typed `ChromeClient`. Also exports `getTabList()` and `connectToTab()` helpers used by the tabs tool. `src/cdp/walker.ts` exports `buildActionMap()` which calls `Accessibility.getFullAXTree`, walks all nodes recursively, skips `ignored: true` nodes (AX-level hidden element defense), collects only interactive roles (button, link, textbox, searchbox, combobox, checkbox, radio, etc.), assigns sequential role-prefixed IDs (`btn-1`, `lnk-2`, `inp-3`), and calls `filterHidden` as a second pass. Returns typed `ActionMap` with url, title, and elements.

### Files changed
- `src/cdp/connector.ts` — created: Chrome connection, typed ChromeClient, localhost-only
- `src/cdp/walker.ts` — created: AX tree walk, role filter, sequential ID assignment, hidden filter

### Status
✓ Complete

### Next
Phase 2 — Security Layer

---

## 2026-04-26 — Phase 2: Security Layer

### What was built
All four security modules implemented with real logic, no stubs. `allowlist.ts`: glob `*` wildcard pattern matching against hostname, block-first priority, returns typed `AllowResult | BlockResult`. `filter.ts`: second-pass hidden element filter strips labels with zero-width Unicode chars, labels over 500 chars, and excessive whitespace (prompt injection defense). `guard.ts`: `assertNotRoot()` exits process if `process.getuid() === 0`; `blockStorageAccess()` injects a CDP `addScriptToEvaluateOnNewDocument` script that overrides `document.cookie`, `localStorage`, and `sessionStorage` with inert proxies — applies to current page and all future navigations. `ratelimit.ts`: real sliding window using a timestamp array; evicts expired entries on each call; returns exact `retryAfterMs` when blocked; does not reset on process restart within the same session.

### Files changed
- `src/security/allowlist.ts` — created: glob domain allow/block check
- `src/security/filter.ts` — created: second-pass hidden element filter
- `src/security/guard.ts` — created: root detection + storage blocker via CDP injection
- `src/security/ratelimit.ts` — created: sliding window rate limiter

### Status
✓ Complete

### Next
Phase 3 — MCP Server + Tools

---

## 2026-04-26 — Phase 3: MCP Server + All 8 Tools

### What was built
`src/server.ts` creates the MCP server using `@modelcontextprotocol/sdk`, connects to Chrome, immediately calls `blockStorageAccess`, then registers all 8 tools with Zod schemas. Every tool call runs through `withSecurity` (rate limit check) and `assertSafeModeAllows` (blocks mutating tools in safeMode with empty allow list) before executing. Errors are caught and returned as structured MCP error responses with Weave-branded messages. Tools implemented: `weave_read` (AX map, no screenshots), `weave_navigate` (URL validation + allowlist + loadEventFired wait), `weave_click` (resolves element via `DOM.resolveNode` + `callFunctionOn` — no coordinate guessing), `weave_type` (char-by-char key dispatch, `clearFirst` support, audit always logs `[REDACTED]`), `weave_extract` (safe TreeWalker script, visible text only, 3 output formats), `weave_tabs` (list + switch via `Target.activateTarget`), `weave_scroll` (smooth scroll in 4 directions via `Runtime.evaluate`), `weave_screenshot` (hard-blocked unless `config.screenshot === true`).

### Files changed
- `src/server.ts` — created: MCP server, all 8 tools registered with Zod schemas + security checks
- `src/tools/read.ts` — created
- `src/tools/navigate.ts` — created
- `src/tools/click.ts` — created
- `src/tools/type.ts` — created
- `src/tools/extract.ts` — created
- `src/tools/tabs.ts` — created
- `src/tools/scroll.ts` — created
- `src/tools/screenshot.ts` — created

### Status
✓ Complete

### Next
Phase 4 — Audit Logger integration verification

---

## 2026-04-26 — Phase 4: Audit Logger

### What was built
`src/audit/logger.ts` ensures `~/.weavetab/` exists on module load, then exports `logAction(action, target, result)` which writes a fixed-format line synchronously via `fs.appendFileSync` — no buffering, no async, survives crashes. Integrated into all 8 tools: `weave_read`, `weave_navigate`, `weave_click`, `weave_type` (target = `[REDACTED]`), `weave_extract`, `weave_tabs`, `weave_scroll`, `weave_screenshot`. Also logs `ERROR` entries from the server's `wrapError` handler.

### Files changed
- `src/audit/logger.ts` — created: synchronous disk logger
- All 8 tool files — each calls `logAction` with appropriate action/target/result

### Status
✓ Complete

### Next
Phase 5 — README + Polish

---

## 2026-04-26 — Phase 5: README + Package Polish

### What was built
`README.md` written covering all 10 required sections: one-line description, problem statement, comparison table vs BrowserMCP/browser-use/Playwright MCP, prerequisites, Chrome launch commands for Windows/Mac/Linux, MCP config JSON for OpenCode/Gemini CLI/Claude Code/Cursor, config reference for all fields, full tools reference with argument tables, security section explaining all 5 protection layers, and audit log format. `package.json` finalized with `description`, `keywords`, `homepage`, `repository`, `author: "fy2ne"`, and `engines: { node: ">=18" }`. `npm run build` still produces zero errors.

### Files changed
- `README.md` — created: full documentation covering all 10 workflow-required sections
- `package.json` — all metadata fields populated

### Status
✓ Complete

### Next
Phase 6 — `npm pack` verification then publish
