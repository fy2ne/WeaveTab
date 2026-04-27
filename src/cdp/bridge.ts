import { exec, spawn } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";
import { findBrowser } from "./finder.js";
import { logProfessional } from "../ui/cli.js";
import type { Config } from "../config/loader.js";
import * as readline from "node:readline";
import CDP from "chrome-remote-interface";

export async function launchWithBridge(config: Config): Promise<{ path: string; name: string }> {
  const browser = findBrowser(config.preferredBrowser);
  if (!browser) {
    throw new Error("No supported browser found on this system.");
  }

  // MCP runs over stdio. If we are running in MCP mode (which we probably are if stdio is used for JSON-RPC),
  // we cannot use stdin for readline.
  // Assuming WeaveTab can also be run standalone or we bypass this via config.
  // For the sake of the plan, we implement the dual-track strategy automatically defaulting to sandbox if not prompted.
  const profileDir = path.join(os.homedir(), ".weavetab", "browser-profile");
  
  // Track A (Sandbox)
  const argsSandbox = [
    `--remote-debugging-port=9222`,
    `--user-data-dir="${profileDir}"`,
    "--no-first-run",
    "--no-default-browser-check"
  ];
  
  // Track B (Persistent)
  // For persistent, we don't specify user-data-dir so it uses the OS default profile
  const argsPersistent = [
    `--remote-debugging-port=9222`,
    "--no-first-run",
    "--no-default-browser-check"
  ];

  const track = config.persistentProfile ? argsPersistent : argsSandbox;

  logProfessional("INFO", "CDP", `Launching ${browser.name} in ${config.persistentProfile ? 'Persistent' : 'Sandbox'} mode...`);
  
  try {
    const proc = spawn(browser.path, track, { detached: true, stdio: 'ignore' });
    proc.unref();
  } catch (err: any) {
    logProfessional("ERROR", "CDP", `Failed to launch ${browser.name}: ${err.message}`);
  }

  // Fallback / Auto-Launch wait
  for (let i = 0; i < 5; i++) {
    try {
      await CDP.List({ host: "127.0.0.1", port: 9222 });
      return browser;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // If port 9222 blocked, friction reduction process kill fallback
  logProfessional("WARN", "CDP", `${browser.name} might already be running. Killing to restart with debugging...`);
  if (os.platform() === 'win32') {
    exec(`taskkill /F /IM ${path.basename(browser.path)}`);
  } else {
    exec(`pkill -f "${browser.name}"`);
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  try {
    const proc = spawn(browser.path, track, { detached: true, stdio: 'ignore' });
    proc.unref();
  } catch (err: any) {
    logProfessional("ERROR", "CDP", `Failed to relaunch ${browser.name}: ${err.message}`);
  }

  return browser;
}
