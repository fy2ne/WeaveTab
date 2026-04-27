# WeaveTab V2 — The "Ghost in the Machine"

> A local MCP server that acts as a sensory engine for your browser via CDP — no extensions, no cloud, and a fraction of the tokens.

---

## The Token Problem

Every browser MCP tool out there relies on screenshots:
- Takes a screenshot, encodes it as base64, and burns your entire context window on pixels.
- Takes another screenshot to verify a click worked.
- Spins up a fake Playwright session that breaks real site sessions (cookies gone, logged out).

**WeaveTab V2 does none of this.** It lives inside the browser's nervous system. It reads Chrome's accessibility tree, listens to network traffic, watches DOM mutations, and feels the page. Tokens spent on meaning, not pixels.

### Token Cost Comparison

| Action | Antigravity | browser-use | WeaveTab V2 |
|---|---|---|---|
| Read a page | ~1200 tokens (screenshot) | ~800 tokens (screenshot) | ~120 tokens (semantic JSON) |
| Click a button | ~1200 tokens (verify screenshot) | ~800 tokens | 0 extra tokens (telemetry) |
| Fill a form | ~3600 tokens (3 screenshots) | ~2400 tokens | ~200 tokens |
| Fork a GitHub repo | ~8000 tokens | ~6000 tokens | ~600 tokens |
| **Full Vercel project setup** | **~40,000 tokens** | **~30,000 tokens** | **~3,000 tokens** |

---

## How WeaveTab Beats the Alternatives

| Feature | WeaveTab V2 | BrowserMCP | browser-use | Playwright MCP |
|---|---|---|---|---|
| No extension required | ✓ | ✗ | ✓ | ✓ |
| No screenshots by default | ✓ | ✗ | ✗ | ✗ |
| Keeps your real session/cookies | ✓ (Dual-Track) | ✓ | ✗ | ✗ |
| Network & DOM Telemetry | ✓ | ✗ | ✗ | ✗ |
| Zero cloud / fully local | ✓ | ✗ | ✗ | ✗ |
| Real-time Visual Dashboard | ✓ | ✗ | ✗ | ✗ |

---

## The WeaveTab Dashboard

WeaveTab V2 includes a built-in zero-dependency local dashboard served at `http://localhost:3141`. 
It provides a real-time WebSocket stream of what the AI is doing, instant configuration updates, domain allow-listing, and one-click MCP configurations for Cursor, Claude Desktop, and Gemini.

---

## Prerequisites

- **Chrome** (any modern version)
- **Node.js 18+**

---

## Step 1 — Launch Chrome with Remote Debugging

You must start Chrome with the `--remote-debugging-port=9222` flag **before** running WeaveTab.

**Windows (PowerShell)**
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:TEMP\weavetab-chrome"
```

**macOS**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/weavetab-chrome
```

**Linux**
```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/weavetab-chrome
```

> **Tip:** Use `--user-data-dir` to keep this session separate from your main Chrome profile.
> If you want WeaveTab to act on your real logged-in session, omit `--user-data-dir` (Chrome will reuse your profile).

---

## Step 2 — Add WeaveTab to Your AI Agent

### OpenCode (`~/.opencode/config.json`)
```json
{
  "mcp": {
    "weavetab": {
      "command": "npx",
      "args": ["-y", "@fy2ne/weavetab"]
    }
  }
}
```

### Gemini CLI (`~/.gemini/settings.json`)
```json
{
  "mcpServers": {
    "weavetab": {
      "command": "npx",
      "args": ["-y", "@fy2ne/weavetab"]
    }
  }
}
```

### Claude Code (`~/.claude/claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "weavetab": {
      "command": "npx",
      "args": ["-y", "@fy2ne/weavetab"]
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "weavetab": {
      "command": "npx",
      "args": ["-y", "@fy2ne/weavetab"]
    }
  }
}
```

---

## Configuration

WeaveTab stores its config at `~/.weavetab/config.json`. It is created automatically on first run with safe defaults.

```json
{
  "allow": [],
  "block": [],
  "safeMode": true,
  "screenshot": false,
  "maxActionsPerMinute": 20
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `allow` | `string[]` | `[]` | Glob patterns for allowed domains |
| `block` | `string[]` | `[]` | Glob patterns for blocked domains |
| `safeMode` | `boolean` | `true` | Only read-only tools work if allow is empty |
| `screenshot` | `boolean` | `false` | Enables full page screenshots |
| `peek` | `boolean` | `false` | Enables 300x300 webp crops via `weave_peek` |
| `persistentProfile` | `boolean` | `false` | Enables using your actual browser profile cookies |
| `maxActionsPerMinute` | `number` | `20` | Sliding window rate limit |

---

## Tools Reference

### `weave_read`
Reads the current Chrome tab as a semantic action map. No screenshots. Returns a list of interactive elements with IDs, roles, and labels.

**Arguments:** none

**Returns:**
```json
{
  "url": "https://example.com",
  "title": "Example",
  "elements": [
    { "id": "btn-1", "role": "button", "label": "Sign in" },
    { "id": "inp-2", "role": "textbox", "label": "Email" },
    { "id": "lnk-3", "role": "link", "label": "Forgot password?" }
  ]
}
```

---

### `weave_wait` (New in V2)
Smart deterministic wait system. Eliminates arbitrary sleep timeouts.
**Conditions:** `navigation`, `element`, `network_idle`, `dom_stable`, `duration`
**Returns:** `{ condition_met: true, waited_ms: 800 }`

---

### `weave_peek` (New in V2)
Targeted 300x300 WebP crop for Canvas apps (Figma, Games) where the DOM provides no semantic information. Opt-in via `peek: true`.
**Returns:** Base64 webp image + estimated token cost (usually ~40-80).

---

### `weave_find` (New in V2)
Finds a semantic element by intent (e.g. `search bar`, `login button`) without needing an exact action map ID.

---
Navigates Chrome to a URL. Blocked in `safeMode` unless the domain is in `allow`.

**Arguments:**
| Name | Type | Required | Description |
|---|---|---|---|
| `url` | `string` | ✓ | Full URL to navigate to |

**Returns:** `{ success: true, url: string, title: string }`

---

### `weave_click`
Clicks an element by its action map ID from `weave_read`. Blocked in `safeMode`.

**Arguments:**
| Name | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✓ | Element ID (e.g. `btn-1`) |

**Returns:** `{ success: true, clicked: string }`

---

### `weave_type`
Types text into a form field by its action map ID. Blocked in `safeMode`. The actual text is **never** written to the audit log — only `[REDACTED]`.

**Arguments:**
| Name | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✓ | Element ID (e.g. `inp-2`) |
| `text` | `string` | ✓ | Text to type |
| `clearFirst` | `boolean` | — | If `true`, clears the field before typing |

**Returns:** `{ success: true }`

---

### `weave_extract`
Extracts visible text from the page. Skips hidden elements. Never accesses cookies or storage.

**Arguments:**
| Name | Type | Required | Description |
|---|---|---|---|
| `selector` | `string` | — | CSS selector to scope extraction (default: `body`) |
| `format` | `"text" \| "json" \| "list"` | ✓ | Output format |

**Returns:** `{ format, content, charCount }`

---

### `weave_tabs`
Lists all open Chrome tabs or switches to one by ID.

**Arguments:**
| Name | Type | Required | Description |
|---|---|---|---|
| `action` | `"list" \| "switch"` | ✓ | What to do |
| `tabId` | `string` | if switch | Tab ID from `list` action |

**Returns (list):** `{ tabs: [{ id, title, url }] }`  
**Returns (switch):** `{ success: true, title: string }`

---

### `weave_scroll`
Scrolls the current page.

**Arguments:**
| Name | Type | Required | Description |
|---|---|---|---|
| `direction` | `"up" \| "down" \| "top" \| "bottom"` | ✓ | Scroll direction |
| `amount` | `number` | — | Pixels to scroll (default: 500) |

**Returns:** `{ success: true, direction }`

---

### `weave_screenshot`
Captures a PNG screenshot. **Disabled by default.** Set `screenshot: true` in `~/.weavetab/config.json` to enable.

**Arguments:** none

**Returns:** MCP image content (base64 PNG)

---

## Security

WeaveTab was designed from the ground up to be safe to give to an AI agent:

| Protection | How it works |
|---|---|
| **Domain allowlist** | `weave_navigate`, `weave_click`, `weave_type`, `weave_scroll` check the current URL against `allow`/`block` patterns before any CDP call |
| **Hidden element filter** | Two-pass defense: AX tree `ignored` flag + label inspection for zero-width Unicode chars and excessive whitespace (prompt injection attacks) |
| **Storage hard-block** | `document.cookie`, `localStorage`, `sessionStorage` are overridden via CDP `Page.addScriptToEvaluateOnNewDocument` to return empty values on every page |
| **Root detection** | If WeaveTab detects it is running as root/admin, it exits immediately |
| **Rate limiter** | Sliding window (not a resettable counter). Default: 20 actions/minute. Returns exact retry-after time |
| **Local only** | Chrome debug port is only accessed via `127.0.0.1`. No data leaves your machine. |
| **Screenshot opt-in** | Screenshots are hard-blocked unless `screenshot: true` is set in config |

---

## Audit Log

Every tool call is written synchronously to `~/.weavetab/audit.log`. The log survives crashes.

**Location:** `~/.weavetab/audit.log`

**Format:**
```
[2026-04-26T09:00:00.000Z]  weave_read  https://github.com  →  42 elements
[2026-04-26T09:00:05.000Z]  weave_click  btn-3              →  Sign in
[2026-04-26T09:00:08.000Z]  weave_type  inp-4               →  [REDACTED]
```

`weave_type` always logs `[REDACTED]` instead of the actual text typed.

---

## License

MIT © fy2ne
