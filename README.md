<div align="center">

# WeaveTab V2

**The Zero-Setup Local Browser MCP for AI Agents**

[![npm version](https://badge.fury.io/js/%40fy2ne%2Fweavetab.svg)](https://badge.fury.io/js/%40fy2ne%2Fweavetab)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

</div>

WeaveTab is a lightweight, local Model Context Protocol (MCP) server that empowers AI agents to seamlessly interact with web browsers using Chrome DevTools Protocol (CDP). 

Unlike other solutions, WeaveTab is completely **autonomous and zero-setup**. It automatically launches a sandboxed browser profile parallel to your daily browsing—meaning you **never have to close your browser or mess with debugging ports again.**

## 🌟 Key Features

* **Zero-Setup Autonomous Browser:** Runs completely parallel to your existing browser via an isolated sandbox. No manual port configuration, no closing your personal browser.
* **No Extensions Required:** Connects directly via native CDP.
* **Semantic Action Map:** `weave_read` returns a parsed, highly compressed DOM semantic map, significantly reducing token consumption.
* **Sniper Mode Actions:** `weave_click` and `weave_type` automatically locate and interact with elements in one step based on their intent or label.
* **Local & Secure:** No cloud dependencies. Built-in rate limiting and optional Safe Mode.
* **Screenshot Support:** Optionally use `weave_screenshot` to capture current tabs, or `weave_peek` for targeted vision on specific elements/canvas.

## 🚀 Quick Start (MCP Integration)

The easiest way to use WeaveTab is via `npx`. Add the following to your MCP client configuration (e.g., Cursor, OpenCode, Claude Desktop).

### Cursor / OpenCode

Add this to your IDE's MCP configuration settings:

```json
{
  "mcpServers": {
    "weavetab": {
      "command": "npx",
      "args": ["-y", "@fy2ne/weavetab@latest"]
    }
  }
}
```

### Claude Desktop

Edit your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "weavetab": {
      "command": "npx",
      "args": ["-y", "@fy2ne/weavetab@latest"]
    }
  }
}
```

## 🛠️ Tool Arsenal

WeaveTab exposes a rich set of specialized tools for your AI:

* **`weave_read`**: Reads the page and returns a semantic action map.
* **`weave_click`**: Clicks elements by label, intent, or ID.
* **`weave_type`**: Types text into forms securely.
* **`weave_navigate`**: Navigates to a target URL.
* **`weave_scroll`**: Scrolls up, down, top, or bottom.
* **`weave_wait`**: Wait for specific states (navigation, element, DOM stability).
* **`weave_tabs`**: List open tabs or switch between them.
* **`weave_extract`**: Extract visible content to text or JSON.
* **`weave_screenshot`**: Capture a PNG of the current view.
* **`weave_peek`**: Targeted vision over specific coordinates.
* **`weave_key`**: Press physical keys and modifiers.
* **`weave_find`**: Find elements semantically without extracting the full page.

## 🛡️ Security & Configuration

WeaveTab respects your system. It actively refuses to run as `root`/`sudo`.

On first run, WeaveTab generates a configuration file at `~/.weavetab/config.json`:

```json
{
  "safeMode": false,
  "allow": [],
  "rateLimitMs": 1000,
  "preferredBrowser": "google-chrome",
  "persistentProfile": false,
  "screenshot": true,
  "peek": true
}
```

### Safety Features
* **Storage hard-block**: Disables scripts accessing cookies/localStorage in specific environments.
* **Root Detection**: Exits if run with root permissions.
* **Domain Allowlist**: Prevents your agent from going to untrusted sites when `safeMode` is active.
* **Audit Logging**: Every action taken by the AI is cleanly logged locally at `~/.weavetab/audit.log` for your review.

## 🤝 Contributing

Contributions are welcome!

```bash
git clone https://github.com/fy2ne/WeaveTab.git
cd WeaveTab
npm install
npm run build
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
