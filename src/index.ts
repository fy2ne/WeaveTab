#!/usr/bin/env node
import { assertNotRoot } from "./security/guard.js";
import { loadConfig } from "./config/loader.js";
import { startServer } from "./server.js";

async function main(): Promise<void> {
  assertNotRoot();

  // MCP Mode (Pipe)
  const config = await loadConfig();
  await startServer(config);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[WeaveTab] Error: ${message}\n`);
  if (process.stdout.isTTY) {
    process.exit(1);
  }
});

process.on("SIGINT", () => {
  process.stderr.write("\nWeaveTab shutting down safely...\n");
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.stderr.write("\nWeaveTab terminating...\n");
  process.exit(0);
});
