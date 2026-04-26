import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface Config {
  allow: string[];
  block: string[];
  safeMode: boolean;
  screenshot: boolean;
  maxActionsPerMinute: number;
}

const CONFIG_DIR = path.join(os.homedir(), ".weavetab");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

const DEFAULTS: Config = {
  allow: [],
  block: [],
  safeMode: true,
  screenshot: false,
  maxActionsPerMinute: 20,
};

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readRawConfig(): Partial<Config> {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {};
  }
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as Partial<Config>;
}

function writeDefaultConfig(): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2), "utf-8");
}

export async function loadConfig(): Promise<Config> {
  ensureConfigDir();

  if (!fs.existsSync(CONFIG_PATH)) {
    writeDefaultConfig();
    return { ...DEFAULTS };
  }

  const raw = readRawConfig();
  return {
    allow: Array.isArray(raw.allow) ? raw.allow : DEFAULTS.allow,
    block: Array.isArray(raw.block) ? raw.block : DEFAULTS.block,
    safeMode: typeof raw.safeMode === "boolean" ? raw.safeMode : DEFAULTS.safeMode,
    screenshot: typeof raw.screenshot === "boolean" ? raw.screenshot : DEFAULTS.screenshot,
    maxActionsPerMinute:
      typeof raw.maxActionsPerMinute === "number"
        ? raw.maxActionsPerMinute
        : DEFAULTS.maxActionsPerMinute,
  };
}
