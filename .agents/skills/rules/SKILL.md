---
name: rules
description: |-
  # WeaveTab — Agent Rules
  > Read this file completely before writing a single line of code.
  > These rules are absolute. Do not skip, summarize, or reinterpret them.
---

# WeaveTab — Agent Rules
> Read this file completely before writing a single line of code.
> These rules are absolute. Do not skip, summarize, or reinterpret them.

---

## Identity & Ownership

- **Project:** WeaveTab
- **Owner:** fy2ne
- **Repo:** `fy2ne/WeaveTab`
- **Package:** `@fy2ne/weavetab`
- **npm command:** `npx @fy2ne/weavetab`
- **Language:** TypeScript (Node.js)
- **License:** MIT
- **Brand voice in terminal:** Every status line uses Weave-themed language.
  - Starting → `⟳ Weaving into Chrome...`
  - Ready → `✓ Weaved. Ready.`
  - Action → `⟳ Weaving: [action description]`
  - Done → `✓ Weaved: [result]`
  - Error → `✗ Weave failed: [reason]`
  - Blocked → `⊘ Weave blocked: [reason]`

---

## Core Principles

### 1. No Placeholders. Ever.
Never write placeholder code, mock functions, fake data, TODO stubs, or `// implement later` comments.
Every function you write must be fully implemented and functional.
If you are unsure how to implement something, stop and ask fy2ne before writing incomplete code.

### 2. No Unnecessary Dependencies
Before adding any npm package, ask yourself: can this be done with Node.js built-ins or what is already installed?
If a package is truly needed, it must be the smallest, most maintained option available.
Never add packages just because they are popular.

### 3. Real Security Only
Every security measure described in the architecture must be implemented for real, not simulated.
- Domain allowlist must actually block requests before CDP is called.
- Hidden element filter must run before any data leaves the DOM walker.
- Cookie/localStorage/sessionStorage access must be hard-blocked at the tool handler level.
- Rate limiter must be a real token-bucket or sliding window implementation, not a counter that resets on restart.
- Audit log must write to disk on every action, not buffered.

### 4. TypeScript Strictness
- `strict: true` in tsconfig. No exceptions.
- No `any` types unless interfacing with an external untyped library, and even then, wrap it immediately.
- All functions must have explicit return types.
- All errors must be typed and handled — no silent catches.

### 5. One File Per Concern
Follow the module structure in the workflow exactly.
Do not put multiple responsibilities in one file.
Do not create files that are not in the workflow unless you explain why to fy2ne first.

---

## Wall Detection — Critical Rule

If at any point during development you notice any of the following, **stop immediately and tell fy2ne before continuing:**

- The approach you are taking will not work for a reason you can see ahead (architectural dead end)
- A dependency or Node.js/Chrome API does not work the way the plan assumes
- A security rule and a feature requirement are in direct conflict
- The current task will break something already built
- You realize the workflow order needs to change
- npm publish or the npx flow will not work with the current structure
- Chrome CDP behaves differently than documented for a feature you need

**Do not silently work around the wall. Do not pick the easiest path without telling fy2ne.**
Say exactly: `"⚠️ Wall detected: [description of the problem and why it blocks us]"`
Then wait for direction.

---

## Logging Rule — WeaveTab-log.md

After completing any of the following, you must append a summary to `WeaveTab-log.md` in the project root:

- A full module is implemented (e.g., the CDP connector, the DOM walker, the rate limiter)
- A MCP tool is fully working end-to-end
- A security layer is implemented and tested
- A bug was found and fixed
- The package is successfully published or the build pipeline works

**Format for every entry:**

```
## [YYYY-MM-DD] — [Short title of what was done]

### What was built
[2-5 sentences describing exactly what was implemented]

### Files changed
- `src/file.ts` — [what changed]

### Status
✓ Complete / ⚠ Partial (reason) / ✗ Blocked (reason)

### Next
[What comes next according to the workflow]
```

Do not write vague summaries. Be specific about what works and what does not.

---

## What You Are NOT Allowed To Do

- Generate any UI (no React, no HTML frontend, no dashboard — this is a CLI/MCP tool only)
- Add cloud functionality, remote servers, or any network calls that leave the user's machine (except the npm registry at publish time)
- Access `document.cookie`, `localStorage`, or `sessionStorage` in any CDP execution — hard block, no exceptions, not even for debugging
- Take screenshots unless the `weave_screenshot` tool is explicitly called AND `screenshot: true` is set in the user's config
- Run with elevated (root/admin) privileges — if the process detects it is running as root, it must warn and exit
- Write to any path outside `~/.weavetab/` and the project directory
- Expose the Chrome debug port to anything outside `127.0.0.1`

---

## Code Style

- Use `async/await` everywhere. No raw Promise chains.
- Log to console using the Weave brand voice only — no raw `console.log("debug")` left in production code.
- All user-facing errors must be human-readable. No stack traces printed to the user unless `--debug` flag is active.
- Keep functions under 40 lines. If a function is getting long, extract a helper.
- Comment only non-obvious logic. Do not comment what the code obviously does.