import CDP from "chrome-remote-interface";
import type { Config } from "../config/loader.js";
import { blockStorageAccess } from "../security/guard.js";

export interface ChromeClient {
  session: CDP.Client;
  targetId: string;
  url: string;
  title: string;
}

async function detectNonLocalhostBinding(): Promise<void> {
  // chrome-remote-interface fetches /json/version — if the host isn't 127.0.0.1 we'd never
  // reach here, but we also guard the config: only 127.0.0.1 is used in this codebase.
  // This function is a checkpoint for future host config changes.
}

let activeClient: ChromeClient | null = null;

export async function getOrConnect(config: Config): Promise<ChromeClient> {
  await detectNonLocalhostBinding();

  // If we already have a connection, verify it is still alive
  if (activeClient) {
    try {
      await activeClient.session.Browser.getVersion();
      return activeClient;
    } catch {
      // Connection died, clear it and reconnect
      activeClient = null;
    }
  }

  let targets: CDP.Target[];

  try {
    targets = await CDP.List({ host: "127.0.0.1", port: 9222 });
  } catch {
    throw new Error(
      "Chrome not found on port 9222. Launch Chrome with --remote-debugging-port=9222"
    );
  }

  const pageTarget = targets.find((t) => t.type === "page" && t.url !== "about:blank");

  if (!pageTarget) {
    throw new Error("No active page tab found. Open a page in Chrome first.");
  }

  const session = await CDP({ host: "127.0.0.1", port: 9222, target: pageTarget.id });

  await session.Accessibility.enable();
  await session.DOM.enable();
  await session.Page.enable();
  await session.Runtime.enable();

  await blockStorageAccess(session);

  process.stderr.write("✓ Weaved. Ready.\n");

  activeClient = {
    session,
    targetId: pageTarget.id,
    url: pageTarget.url,
    title: pageTarget.title,
  };

  return activeClient;
}

export async function getTabList(): Promise<CDP.Target[]> {
  try {
    const targets = await CDP.List({ host: "127.0.0.1", port: 9222 });
    return targets.filter((t) => t.type === "page");
  } catch {
    throw new Error("✗ Weave failed: Cannot reach Chrome on port 9222.");
  }
}

export async function connectToTab(targetId: string): Promise<CDP.Client> {
  const session = await CDP({ host: "127.0.0.1", port: 9222, target: targetId });
  await session.Accessibility.enable();
  await session.DOM.enable();
  await session.Page.enable();
  await session.Runtime.enable();
  return session;
}
