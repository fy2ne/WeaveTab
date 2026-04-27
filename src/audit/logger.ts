import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { broadcastLog } from "../dashboard/server.js";

const LOG_DIR = path.join(os.homedir(), ".weavetab");
const LOG_PATH = path.join(LOG_DIR, "audit.log");

export function logAction(action: string, target: string, result: string): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    const paddedAction = action.padEnd(10);
    const line = `[${timestamp}]  ${paddedAction}  ${target}  →  ${result}\n`;
    fs.appendFileSync(LOG_PATH, line, "utf-8");
    
    // Broadcast to Dashboard UI if running
    broadcastLog({ tool: action, target, message: result, success: !result.toLowerCase().includes("failed") && !result.toLowerCase().includes("blocked") });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`⚠ Weave warning: Failed to write audit log: ${msg}\n`);
  }
}
