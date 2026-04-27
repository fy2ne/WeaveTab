import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { fileURLToPath } from "node:url";
import { loadConfig, saveConfig } from "../config/loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WeaveTab V2 Dashboard</title>
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #111118;
      --border: #1e1e2e;
      --accent: #7C3AED;
      --text: #e2e8f0;
      --success: #10b981;
      --error: #ef4444;
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo {
      font-weight: 700;
      font-size: 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .version { color: #64748b; font-weight: normal; font-size: 0.8rem; }
    .status { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: pulse 2s infinite; }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.4); }
      70% { box-shadow: 0 0 0 6px rgba(124, 58, 237, 0); }
      100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
    }
    .grid {
      display: grid;
      grid-template-columns: 350px 1fr;
      grid-template-rows: auto 1fr;
      gap: 1.5rem;
      padding: 1.5rem;
      flex: 1;
      overflow: hidden;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
    }
    h2 { margin-top: 0; font-size: 1rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    .log-stream { flex: 1; overflow-y: auto; font-family: monospace; font-size: 0.85rem; line-height: 1.5; color: #a1a1aa; }
    .log-entry { margin-bottom: 0.25rem; }
    .log-time { color: #64748b; margin-right: 0.5rem; }
    .log-tool { color: var(--accent); font-weight: bold; width: 140px; display: inline-block; }
    .log-success { color: var(--success); }
    .log-error { color: var(--error); }
    .input-group { margin-bottom: 1rem; }
    label { display: block; font-size: 0.85rem; margin-bottom: 0.5rem; color: #94a3b8; }
    input[type="text"], input[type="number"] { width: 100%; background: #0a0a0f; border: 1px solid var(--border); color: var(--text); padding: 0.5rem; border-radius: 4px; box-sizing: border-box; }
    .toggle { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .switch { position: relative; display: inline-block; width: 40px; height: 20px; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--border); transition: .2s; border-radius: 20px; }
    .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 2px; bottom: 2px; background-color: white; transition: .2s; border-radius: 50%; }
    input:checked + .slider { background-color: var(--accent); }
    input:checked + .slider:before { transform: translateX(20px); }
    .tag-list { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
    .tag { background: #1e1e2e; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; display: flex; align-items: center; gap: 0.5rem; }
    .tag-remove { cursor: pointer; color: var(--error); font-weight: bold; }
    button { background: var(--accent); color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-weight: 600; }
    button:hover { filter: brightness(1.1); }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
    .stat-box { background: #0a0a0f; border: 1px solid var(--border); padding: 1rem; border-radius: 6px; text-align: center; }
    .stat-value { font-size: 1.5rem; font-weight: bold; color: var(--accent); margin-bottom: 0.25rem; }
    .stat-label { font-size: 0.75rem; color: #94a3b8; }
    pre { background: #0a0a0f; border: 1px solid var(--border); padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.8rem; }
  </style>
</head>
<body>

<header>
  <div class="logo">WeaveTab <span class="version">v2.0.0 "Ghost"</span></div>
  <div class="status"><div class="dot" id="conn-dot"></div> <span id="conn-text">● Connected</span></div>
</header>

<div class="grid">
  <!-- Sidebar -->
  <div style="display: flex; flex-direction: column; gap: 1.5rem;">
    
    <div class="card">
      <h2>Stats & Savings</h2>
      <div class="stats">
        <div class="stat-box">
          <div class="stat-value" id="stat-actions">0</div>
          <div class="stat-label">Actions Executed</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" id="stat-tokens">0k</div>
          <div class="stat-label">Tokens Saved</div>
        </div>
      </div>
    </div>

    <div class="card" style="flex: 1">
      <h2>Config</h2>
      <div class="toggle">
        <label>Safe Mode (Blocks mutations)</label>
        <label class="switch"><input type="checkbox" id="cfg-safe" onchange="updateConfig()"><span class="slider"></span></label>
      </div>
      <div class="toggle">
        <label>Screenshots Enabled</label>
        <label class="switch"><input type="checkbox" id="cfg-screenshot" onchange="updateConfig()"><span class="slider"></span></label>
      </div>
      <div class="toggle">
        <label>weave_peek Enabled</label>
        <label class="switch"><input type="checkbox" id="cfg-peek" onchange="updateConfig()"><span class="slider"></span></label>
      </div>
      <div class="toggle">
        <label>Persistent Profile</label>
        <label class="switch"><input type="checkbox" id="cfg-persistent" onchange="updateConfig()"><span class="slider"></span></label>
      </div>
      
      <h2>Allow List</h2>
      <div class="tag-list" id="allow-list"></div>
      <div style="display: flex; gap: 0.5rem;">
        <input type="text" id="new-domain" placeholder="example.com" style="flex: 1;">
        <button onclick="addDomain()">Add</button>
      </div>
    </div>

  </div>

  <!-- Main Area -->
  <div style="display: flex; flex-direction: column; gap: 1.5rem;">
    
    <div class="card" style="height: 300px;">
      <h2>Live Log</h2>
      <div class="log-stream" id="log-stream"></div>
    </div>

    <div class="card" style="flex: 1;">
      <h2>MCP Setup Instructions</h2>
      <p style="font-size: 0.9rem; color: #94a3b8; margin-top: -0.5rem; margin-bottom: 1rem;">
        To connect WeaveTab to your IDE, copy this configuration block.
      </p>
      
      <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
        <button style="background: #1e1e2e; border: 1px solid var(--border);" onclick="showSetup('cursor')">Cursor / OpenCode</button>
        <button style="background: #1e1e2e; border: 1px solid var(--border);" onclick="showSetup('claude')">Claude Desktop</button>
      </div>

      <pre id="mcp-code">
{
  "mcpServers": {
    "weavetab": {
      "command": "npx",
      "args": ["-y", "@fy2ne/weavetab@latest"]
    }
  }
}
      </pre>
    </div>

  </div>
</div>

<script>
let ws;
let actionsCount = 0;
let currentConfig = {};

function initWS() {
  ws = new WebSocket(\`ws://\${location.host}\`);
  ws.onopen = () => {
    document.getElementById('conn-dot').style.background = 'var(--success)';
    document.getElementById('conn-text').textContent = '● Connected';
  };
  ws.onclose = () => {
    document.getElementById('conn-dot').style.background = '#64748b';
    document.getElementById('conn-text').textContent = '○ Disconnected';
    setTimeout(initWS, 2000);
  };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'log') appendLog(msg.data);
  };
}

function appendLog(entry) {
  const stream = document.getElementById('log-stream');
  const d = new Date();
  const time = \`[\${d.getHours().toString().padStart(2,'0')}:\${d.getMinutes().toString().padStart(2,'0')}:\${d.getSeconds().toString().padStart(2,'0')}]\`;
  
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML = \`<span class="log-time">\${time}</span><span class="log-tool">\${entry.tool || 'system'}</span> <span>\${entry.message || entry.target || ''}</span> <span class="\${entry.success === false ? 'log-error' : 'log-success'}">\${entry.success === false ? '✗' : '✓'}</span>\`;
  
  stream.appendChild(div);
  stream.scrollTop = stream.scrollHeight;

  if (entry.tool && entry.tool.startsWith('weave_')) {
    actionsCount++;
    document.getElementById('stat-actions').textContent = actionsCount;
    document.getElementById('stat-tokens').textContent = Math.round((actionsCount * 950) / 1000) + 'k';
  }
}

async function loadConfig() {
  const res = await fetch('/api/config');
  currentConfig = await res.json();
  
  document.getElementById('cfg-safe').checked = currentConfig.safeMode;
  document.getElementById('cfg-screenshot').checked = currentConfig.screenshot;
  document.getElementById('cfg-peek').checked = !!currentConfig.peek;
  document.getElementById('cfg-persistent').checked = !!currentConfig.persistentProfile;
  
  renderAllowList();
}

async function updateConfig() {
  currentConfig.safeMode = document.getElementById('cfg-safe').checked;
  currentConfig.screenshot = document.getElementById('cfg-screenshot').checked;
  currentConfig.peek = document.getElementById('cfg-peek').checked;
  currentConfig.persistentProfile = document.getElementById('cfg-persistent').checked;
  
  await fetch('/api/config', {
    method: 'POST',
    body: JSON.stringify(currentConfig)
  });
}

function renderAllowList() {
  const list = document.getElementById('allow-list');
  list.innerHTML = '';
  (currentConfig.allow || []).forEach((domain, idx) => {
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.innerHTML = \`<span>\${domain}</span><span class="tag-remove" onclick="removeDomain(\${idx})">×</span>\`;
    list.appendChild(tag);
  });
}

async function addDomain() {
  const input = document.getElementById('new-domain');
  const val = input.value.trim();
  if (val && !currentConfig.allow.includes(val)) {
    currentConfig.allow.push(val);
    await updateConfig();
    renderAllowList();
    input.value = '';
  }
}

async function removeDomain(idx) {
  currentConfig.allow.splice(idx, 1);
  await updateConfig();
  renderAllowList();
}

function showSetup(type) {
  const pre = document.getElementById('mcp-code');
  if (type === 'claude') {
    pre.textContent = \`{
  "mcpServers": {
    "weavetab": {
      "command": "npx",
      "args": ["-y", "@fy2ne/weavetab@latest"]
    }
  }
}\`;
  } else {
    pre.textContent = \`{
  "mcpServers": {
    "weavetab": {
      "command": "node",
      "args": ["/absolute/path/to/WeaveTab/dist/index.js"]
    }
  }
}\`;
  }
}

initWS();
loadConfig();
</script>

</body>
</html>`;

let wss: WebSocketServer;
let clients: Set<WebSocket> = new Set();

export function broadcastLog(entry: any) {
  if (!wss) return;
  const msg = JSON.stringify({ type: "log", data: entry });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

export function broadcastTelemetry(data: any) {
  if (!wss) return;
  const msg = JSON.stringify({ type: "telemetry", data });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

export async function startDashboardServer() {
  const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === "/api/config" && req.method === "GET") {
      const config = await loadConfig();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(config));
      return;
    }

    if (req.url === "/api/config" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", async () => {
        try {
          const newConfig = JSON.parse(body);
          // Very basic merge
          const current = await loadConfig();
          const merged = { ...current, ...newConfig };
          saveConfig(merged);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, config: merged }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Invalid config JSON" }));
        }
      });
      return;
    }

    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(HTML_CONTENT);
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  wss = new WebSocketServer({ server });

  wss.on("connection", (ws: WebSocket) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  server.listen(3141, "127.0.0.1", () => {
    // Dashboard running silently
  });
}
