#!/usr/bin/env node
import { assertNotRoot } from "./security/guard.js";
import { loadConfig } from "./config/loader.js";
import { startServer } from "./server.js";

import { printBanner, logProfessional } from "./ui/cli.js";
import { startDashboard } from "./ui/dashboard.js";

async function main(): Promise<void> {
  assertNotRoot();

  const isInteractive = process.stdout.isTTY;

  if (isInteractive) {
    startDashboard();
    logProfessional("INFO", "Main", "WeaveTab Interactive Mode Started.");
  } else {
    // MCP Mode (Pipe)
    const config = await loadConfig();
    await startServer(config);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`✗ Weave failed: ${message}\n`);
  // If running in MCP mode via stdio, we don't want to abruptly close the stream.
  // The MCP SDK will handle the error. But if we crashed this hard before server start,
  // we have no choice but to exit.
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
