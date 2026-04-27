import * as readline from "node:readline";
import * as http from "node:http";
import { execSync } from "node:child_process";
import { logProfessional, setLogHook } from "./cli.js";
import { loadConfig, saveConfig, type Config } from "../config/loader.js";

const COLORS = {
  reset: "\x1b[0m",
  time: "\x1b[90m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  brand: "\x1b[35m",
  action: "\x1b[36m",
  thread: "\x1b[34m",
  bg: "\x1b[44m",
  white: "\x1b[37;1m",
  dim: "\x1b[2m",
  selected: "\x1b[1;37;45m",
};

type View = "HOME" | "LOGS" | "CONFIG" | "ALLOWS" | "SETUP" | "EXIT";
const VIEWS: View[] = ["HOME", "LOGS", "CONFIG", "ALLOWS", "SETUP", "EXIT"];
const LABELS: Record<View, string> = {
  HOME: "[ HOME ]",
  LOGS: "[ LOGS ]",
  CONFIG: "[ CONFIG ]",
  ALLOWS: "[ ALLOWS ]",
  SETUP: "[ SETUP ]",
  EXIT: "[ EXIT ]",
};
const DESCRIPTIONS: Record<View, string> = {
  HOME: "Main dashboard and project overview.",
  LOGS: "Real-time weaving console and agent events.",
  CONFIG: "Adjust security, browser path, and behavior.",
  ALLOWS: "Manage allowed domains for autonomous navigation.",
  SETUP: "One-click MCP configuration for your IDE.",
  EXIT: "Safely shutdown and close WeaveTab.",
};

let selectedIndex = 0;
let configSelectedIndex = 0;
let allowSelectedIndex = 0;
let currentView: View = "HOME";
let logBuffer: string[] = [];
let browserStatus: "CONNECTED" | "DISCONNECTED" | "CHECKING" = "CHECKING";
let activeConfig: Config | null = null;
let lastCopyTime = 0;
let isRendering = false;
let isInputMode = false;
let inputBuffer = "";
let inputPrompt = "";
let inputCallback: ((val: string) => void) | null = null;

const MAX_LOGS = 14;

export function startDashboard(): void {
  process.stdout.write("\x1b[?1049h\x1b[2J\x1b[3J\x1b[H\x1b[?25l");
  
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    readline.emitKeypressEvents(process.stdin);
  }

  render();
  setInterval(checkBrowserStatus, 5000);
  checkBrowserStatus();
  
  loadConfig().then(c => {
    activeConfig = c;
    render();
  });

  process.stdout.on("resize", () => {
    process.stdout.write("\x1b[2J\x1b[H");
    render();
  });

  process.stdin.on("keypress", (str, key) => {
    if (key.ctrl && key.name === "c") exitDashboard();

    if (isInputMode) {
      if (key.name === "return") {
        const val = inputBuffer;
        isInputMode = false;
        inputBuffer = "";
        if (inputCallback) inputCallback(val);
        render();
      } else if (key.name === "backspace") {
        inputBuffer = inputBuffer.slice(0, -1);
        render();
      } else if (str && str.length === 1) {
        inputBuffer += str;
        render();
      }
      return;
    }

    if (key.name === "left") {
      selectedIndex = (selectedIndex - 1 + VIEWS.length) % VIEWS.length;
      render();
    } else if (key.name === "right") {
      selectedIndex = (selectedIndex + 1) % VIEWS.length;
      render();
    } else if (key.name === "up") {
      if (currentView === "CONFIG") configSelectedIndex = (configSelectedIndex - 1 + 4) % 4;
      else if (currentView === "ALLOWS" && activeConfig) allowSelectedIndex = (allowSelectedIndex - 1 + activeConfig.allow.length) % Math.max(1, activeConfig.allow.length);
      render();
    } else if (key.name === "down") {
      if (currentView === "CONFIG") configSelectedIndex = (configSelectedIndex + 1) % 4;
      else if (currentView === "ALLOWS" && activeConfig) allowSelectedIndex = (allowSelectedIndex + 1) % Math.max(1, activeConfig.allow.length);
      render();
    } else if (key.name === "return") {
      if (VIEWS[selectedIndex] === "EXIT") exitDashboard();
      
      if (currentView !== VIEWS[selectedIndex]) {
        currentView = VIEWS[selectedIndex];
      } else if (currentView === "CONFIG" && activeConfig) {
        handleConfigAction();
      }
      render();
    } else if (key.name === "c" && currentView === "SETUP") {
      copyMCPConfig();
      render();
    } else if (key.name === "a" && currentView === "ALLOWS") {
      promptInput("Add Domain (e.g. google.com or *.google.com): ", (val) => {
        if (val && activeConfig) {
          activeConfig.allow.push(val);
          saveConfig(activeConfig);
        }
      });
    } else if (key.name === "delete" && currentView === "ALLOWS") {
      if (activeConfig && activeConfig.allow.length > 0) {
        activeConfig.allow.splice(allowSelectedIndex, 1);
        allowSelectedIndex = Math.max(0, allowSelectedIndex - 1);
        saveConfig(activeConfig);
        render();
      }
    }
  });

  setLogHook((level, thread, message) => {
    addToLogs(level, thread, message);
    if (currentView === "LOGS") render();
  });
}

function promptInput(prompt: string, cb: (val: string) => void): void {
  isInputMode = true;
  inputPrompt = prompt;
  inputBuffer = "";
  inputCallback = cb;
  render();
}

function exitDashboard(): void {
  process.stdout.write("\x1b[?1049l\x1b[?25h");
  process.exit(0);
}

function addToLogs(level: string, thread: string, message: string): void {
  const now = new Date();
  const timeStr = now.toTimeString().split(" ")[0];
  const color = level === "INFO" ? COLORS.info : level === "WARN" ? COLORS.warn : level === "ERROR" ? COLORS.error : COLORS.action;
  const line = `${COLORS.time}[${timeStr}] ${COLORS.thread}[${thread}/${level}]: ${color}${message}${COLORS.reset}`;
  logBuffer.push(line);
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();
}

function render(): void {
  if (isRendering) return;
  isRendering = true;

  try {
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
    
    let output = ""; 
    
    const statusColor = browserStatus === "CONNECTED" ? COLORS.info : browserStatus === "DISCONNECTED" ? COLORS.error : COLORS.warn;
    const statusIcon = browserStatus === "CONNECTED" ? "*" : "o";
    
    output += `${COLORS.brand}================================================================================${COLORS.reset}\r\n`;
    output += `${COLORS.brand}  __      __                       ${COLORS.reset}   Browser: ${statusColor}${statusIcon} ${browserStatus}${COLORS.reset}\r\n`;
    output += `${COLORS.brand} \\ \\    / /__  __ ___ _____        ${COLORS.reset}   Status:  ${COLORS.info}ACTIVE${COLORS.reset}\r\n`;
    output += `${COLORS.brand}  \\ \\/\\/ / -_) _ \` \\\\ V / -_)       ${COLORS.reset}   Agent:   ${COLORS.white}WeaveTab v1.4.0${COLORS.reset}\r\n`;
    output += `${COLORS.brand}   \\_/\\_/\\___\\__,_| \\_/\\___|       ${COLORS.reset}\r\n`;
    output += `${COLORS.brand}================================================================================${COLORS.reset}\r\n\r\n`;

    output += `  `;
    for (let i = 0; i < VIEWS.length; i++) {
      const isSelected = i === selectedIndex;
      const isActive = VIEWS[i] === currentView;
      const style = isSelected ? COLORS.selected : isActive ? COLORS.white : COLORS.dim;
      output += `${style} ${LABELS[VIEWS[i]]} ${COLORS.reset}   `;
    }
    output += `\r\n\r\n`;

    output += `  ${COLORS.dim}i ${DESCRIPTIONS[VIEWS[selectedIndex]]}${COLORS.reset}\r\n`;
    output += `${COLORS.brand}--------------------------------------------------------------------------------${COLORS.reset}\r\n\r\n`;

    if (isInputMode) {
      output += `  ${COLORS.brand}${inputPrompt}${COLORS.white}${inputBuffer}${COLORS.reset}_ \r\n`;
    } else {
      if (currentView === "HOME") output += renderHome();
      else if (currentView === "LOGS") output += renderLogs();
      else if (currentView === "CONFIG") output += renderConfig();
      else if (currentView === "ALLOWS") output += renderAllows();
      else if (currentView === "SETUP") output += renderMCP();
    }

    const helpText = isInputMode ? " [ENTER] Confirm   [ESC/CTRL+C] Cancel " :
                     currentView === "CONFIG" ? " [↑/↓] Navigate   [ENTER] Edit/Toggle   [←/→] Tabs " : 
                     currentView === "ALLOWS" ? " [↑/↓] Navigate   [A] Add   [DEL] Delete   [←/→] Tabs " :
                     " [←/→] Choose   [ENTER] Select   [CTRL+C] Quit ";
    
    output += `\r\n${COLORS.dim}${helpText}${COLORS.reset}`;
    process.stdout.write(output);
    readline.cursorTo(process.stdout, 0, process.stdout.rows - 1);
  } finally {
    isRendering = false;
  }
}

function handleConfigAction(): void {
  if (!activeConfig) return;
  if (configSelectedIndex === 0) activeConfig.safeMode = !activeConfig.safeMode;
  else if (configSelectedIndex === 1) activeConfig.screenshot = !activeConfig.screenshot;
  else if (configSelectedIndex === 2) {
    activeConfig.maxActionsPerMinute = activeConfig.maxActionsPerMinute === 20 ? 60 : activeConfig.maxActionsPerMinute === 60 ? 10 : 20;
  }
  else if (configSelectedIndex === 3) {
    promptInput("Enter Full Browser Executable Path: ", (val) => {
      if (val && activeConfig) {
        activeConfig.browserExecutablePath = val;
        saveConfig(activeConfig);
      }
    });
  }
  saveConfig(activeConfig);
}

function renderHome(): string {
  let out = `  ${COLORS.white}WeaveTab Dashboard v1.4.0${COLORS.reset}\r\n\r\n`;
  out += `  Navigate with Arrow Keys. Select with Enter.\r\n\r\n`;
  out += `  Local CDP attachment to any Chromium Browser.\r\n`;
  out += `  Automated launching and security controls.\r\n\r\n`;
  out += `  ${COLORS.dim}Multi-browser support: Edge, Chrome, Brave, Chromium.${COLORS.reset}\r\n`;
  return out;
}

function renderLogs(): string {
  let out = `${COLORS.bg}${COLORS.white}  LIVE CONSOLE                                                                 ${COLORS.reset}\r\n`;
  for (let i = 0; i < MAX_LOGS; i++) {
    out += (logBuffer[i] || "") + "\r\n";
  }
  return out;
}

function renderConfig(): string {
  let out = `  ${COLORS.white}Server Configuration${COLORS.reset}\r\n\r\n`;
  if (!activeConfig) return `  Loading...\r\n`;

  const items = [
    { label: "Safe Mode", value: activeConfig.safeMode ? "ENABLED" : "DISABLED", color: activeConfig.safeMode ? COLORS.info : COLORS.error },
    { label: "Screenshots", value: activeConfig.screenshot ? "ENABLED" : "DISABLED", color: activeConfig.screenshot ? COLORS.info : COLORS.error },
    { label: "Action Rate", value: `${activeConfig.maxActionsPerMinute} / min`, color: COLORS.info },
    { label: "Browser Path", value: activeConfig.browserExecutablePath || "(Auto-detect)", color: COLORS.brand }
  ];

  for (let i = 0; i < items.length; i++) {
    const prefix = i === configSelectedIndex ? `${COLORS.brand}> ${COLORS.reset}` : "  ";
    out += `${prefix}${items[i].label.padEnd(20)} ${items[i].color}${items[i].value}${COLORS.reset}\r\n`;
  }
  return out;
}

function renderAllows(): string {
  let out = `  ${COLORS.white}Allowed Domains (Allowlist)${COLORS.reset}\r\n\r\n`;
  if (!activeConfig) return `  Loading...\r\n`;

  if (activeConfig.allow.length === 0) {
    out += `  ${COLORS.warn}Allowlist is empty. Mutating tools disabled in Safe Mode.${COLORS.reset}\r\n`;
    out += `  Press [A] to add your first domain (e.g. google.com).\r\n`;
    return out;
  }

  for (let i = 0; i < activeConfig.allow.length; i++) {
    const prefix = i === allowSelectedIndex ? `${COLORS.brand}> ${COLORS.reset}` : "  ";
    out += `${prefix}${activeConfig.allow[i]}\r\n`;
  }
  return out;
}

function renderMCP(): string {
  let out = `  ${COLORS.white}MCP Connection Card${COLORS.reset}\r\n\r\n`;
  out += `  ┌─ SETUP JSON ──────────────────────────────────────────────────────────────┐\r\n`;
  out += `  │  ${COLORS.white}{${COLORS.reset}\r\n`;
  out += `  │    ${COLORS.brand}"mcpServers"${COLORS.reset}: ${COLORS.white}{${COLORS.reset}\r\n`;
  out += `  │      ${COLORS.brand}"weavetab"${COLORS.reset}: ${COLORS.white}{${COLORS.reset}\r\n`;
  out += `  │        ${COLORS.brand}"command"${COLORS.reset}: ${COLORS.action}"node"${COLORS.reset},\r\n`;
  out += `  │        ${COLORS.brand}"args"${COLORS.reset}: [${COLORS.action}"c:/Users/fy2ne/Pictures/WeaveTab/dist/index.js"${COLORS.reset}]\r\n`;
  out += `  │      ${COLORS.white}}${COLORS.reset}\r\n`;
  out += `  │    ${COLORS.white}}${COLORS.reset}\r\n`;
  out += `  │  ${COLORS.white}}${COLORS.reset}\r\n`;
  out += `  └───────────────────────────────────────────────────────────────────────────┘\r\n\r\n`;
  
  const copyStatus = (Date.now() - lastCopyTime < 2000) ? `${COLORS.info}✓ COPIED TO CLIPBOARD${COLORS.reset}` : `${COLORS.brand}[C] COPY CONFIG${COLORS.reset}`;
  out += `  ${copyStatus}\r\n`;
  return out;
}

function checkBrowserStatus(): void {
  http.get("http://127.0.0.1:9222/json/version", (res) => {
    browserStatus = "CONNECTED";
    render();
    res.resume();
  }).on("error", () => {
    browserStatus = "DISCONNECTED";
    render();
  });
}

function copyMCPConfig(): void {
  const workspacePath = "c:/Users/fy2ne/Pictures/WeaveTab";
  const configJson = JSON.stringify({
    mcpServers: { weavetab: { command: "node", args: [`${workspacePath}/dist/index.js`] } }
  }, null, 2);
  try {
    execSync("clip", { input: configJson, encoding: "utf8" });
    lastCopyTime = Date.now();
  } catch {}
}
