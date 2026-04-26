import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const LOG_DIR = path.join(os.homedir(), ".weavetab");
const LOG_PATH = path.join(LOG_DIR, "audit.log");

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

ensureLogDir();

export function logAction(action: string, target: string, result: string): void {
  const timestamp = new Date().toISOString();
  const paddedAction = action.padEnd(10);
  const line = `[${timestamp}]  ${paddedAction}  ${target}  →  ${result}\n`;
  fs.appendFileSync(LOG_PATH, line, "utf-8");
}
