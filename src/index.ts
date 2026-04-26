#!/usr/bin/env node
import { assertNotRoot } from "./security/guard.js";
import { loadConfig } from "./config/loader.js";
import { startServer } from "./server.js";

async function main(): Promise<void> {
  assertNotRoot();

  process.stderr.write("⟳ Weaving into Chrome...\n");

  const config = await loadConfig();
  await startServer(config);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`✗ Weave failed: ${message}\n`);
  process.exit(1);
});
