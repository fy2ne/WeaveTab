# WeaveTab

> A local MCP server that attaches to your running Chrome browser via CDP — no extensions, no cloud, no screenshots by default.

---

## The Problem

Every browser MCP tool out there either:
- Requires a Chrome extension installed permanently
- Takes a screenshot, encodes it as base64, and burns your entire context window on pixels
- Spins up a fake Playwright session that breaks real site sessions (cookies gone, logged out)
- Sends your browser activity to a remote server

**WeaveTab does none of this.** It reads Chrome's accessibility tree — the same semantic map a screen reader uses — and gives your AI agent clean, structured data to act on. Tokens spent on meaning, not pixels.

---

## How WeaveTab Beats the Alternatives

| Feature | WeaveTab | BrowserMCP | browser-use | Playwright MCP |
|---|---|---|---|---|
| No extension required | ✓ | ✗ | ✓ | ✓ |
| No screenshots by default | ✓ | ✗ | ✗ | ✗ |
| Keeps your real session/cookies | ✓ | ✓ | ✗ | ✗ |
| Zero cloud / fully local | ✓ | ✗ | ✗ | ✗ |
| Prompt injection defense | ✓ | ✗ | ✗ | ✗ |
| Audit log on disk | ✓ | ✗ | ✗ | ✗ |
| Rate limiting built-in | ✓ | ✗ | ✗ | ✗ |
| TypeScript strict, no any | ✓ | – | – | – |

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
| `allow` | `string[]` | `[]` | Glob patterns for allowed domains (e.g. `["*.github.com", "docs.*"]`). Empty = allow all (when `safeMode` is false) |
| `block` | `string[]` | `[]` | Glob patterns for blocked domains. Block takes priority over allow. |
| `safeMode` | `boolean` | `true` | When `true` and `allow` is empty: only read-only tools work (`weave_read`, `weave_tabs`, `weave_extract`) |
| `screenshot` | `boolean` | `false` | Must be `true` to use `weave_screenshot` |
| `maxActionsPerMinute` | `number` | `20` | Sliding window rate limit. Protects against runaway agents. |

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

### `weave_navigate`
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
