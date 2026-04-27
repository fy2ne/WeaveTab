import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const COLORS = {
  reset: "\x1b[0m",
  time: "\x1b[90m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  brand: "\x1b[35m",
  action: "\x1b[36m",
  thread: "\x1b[34m",
};

export function printBanner(): void {
  const banner = `
${COLORS.brand}  __      __                       ${COLORS.reset}
${COLORS.brand} \\ \\    / /__  __ ___ _____        ${COLORS.reset}
${COLORS.brand}  \\ \\/\\/ / -_) _ \` \\\\ V / -_)       ${COLORS.reset}
${COLORS.brand}   \\_/\\_/\\___\\__,_| \\_/\\___|       ${COLORS.reset}
${COLORS.info}        WeaveTab v1.3.0            ${COLORS.reset}
`;
  process.stderr.write(banner + "\n");
}

let logHook: ((level: string, thread: string, message: string) => void) | null = null;

export function setLogHook(hook: typeof logHook): void {
  logHook = hook;
}

export function logProfessional(level: "INFO" | "WARN" | "ERROR" | "ACTION", thread: string, message: string): void {
  if (logHook) {
    logHook(level, thread, message);
    return;
  }
  const now = new Date();
  const timeStr = now.toTimeString().split(" ")[0];
  
  let color = COLORS.info;
  let prefix = "";

  switch (level) {
    case "INFO": color = COLORS.info; break;
    case "WARN": color = COLORS.warn; break;
    case "ERROR": color = COLORS.error; break;
    case "ACTION": color = COLORS.action; prefix = "⟳ "; break;
  }

  const line = `${COLORS.time}[${timeStr}] ${COLORS.thread}[${thread}/${level}]: ${color}${prefix}${message}${COLORS.reset}\n`;
  process.stderr.write(line);
}

export async function logWeaving(message: string, duration: number = 500): Promise<void> {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const start = Date.now();
  
  while (Date.now() - start < duration) {
    const frame = frames[i % frames.length];
    process.stderr.write(`\r${COLORS.brand}${frame} Weaving into reality: ${message}${COLORS.reset}`);
    i++;
    await new Promise(r => setTimeout(r, 80));
  }
  process.stderr.write(`\r\x1b[K`); // Clear line
}
