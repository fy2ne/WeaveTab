import CDP from "chrome-remote-interface";
import type { Config } from "../config/loader.js";
import { blockStorageAccess } from "../security/guard.js";
import { launchWithBridge } from "./bridge.js";
import { attachOverlayListener } from "../overlay/injector.js";

export interface BrowserClient {
  session: CDP.Client;
  targetId: string;
  url: string;
  title: string;
}

let activeClient: BrowserClient | null = null;

async function launchBrowser(config: Config): Promise<void> {
  await launchWithBridge(config);
}

export async function getOrConnect(config: Config): Promise<BrowserClient> {
  // If we already have a connection, verify it is still alive
  if (activeClient) {
    try {
      await activeClient.session.Browser.getVersion();
      return activeClient;
    } catch {
      console.error(`[WeaveTab CDP] ${"Connection lost. Reconnecting..."}`);
      activeClient = null;
    }
  }

  let targets: CDP.Target[];
  try {
    targets = await CDP.List({ host: "127.0.0.1", port: 9222 });
  } catch {
    console.error(`[WeaveTab CDP] ${"Browser not found. Attempting to launch..."}`);
    await launchBrowser(config);
    targets = await CDP.List({ host: "127.0.0.1", port: 9222 });
  }

  let pageTarget = targets.find((t) => t.type === "page" && t.url !== "about:blank");

  if (!pageTarget) {
    // Open a new tab if none found
    await CDP.New({ host: "127.0.0.1", port: 9222, url: "https://google.com" });
    targets = await CDP.List({ host: "127.0.0.1", port: 9222 });
    pageTarget = targets.find((t) => t.type === "page");
  }

  if (!pageTarget) {
    throw new Error("No active page tab found even after launching.");
  }

  const session = await CDP({ host: "127.0.0.1", port: 9222, target: pageTarget.id });

  await session.Accessibility.enable();
  await session.DOM.enable();
  await session.Page.enable();
  await session.Runtime.enable();

  await blockStorageAccess(session);
  await attachOverlayListener(session);

  console.error(`[WeaveTab CDP] ${"✓ Weaved. Ready."}`);

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
    throw new Error("✗ Weave failed: Cannot reach Browser on port 9222.");
  }
}

export async function connectToTab(targetId: string): Promise<CDP.Client> {
  const session = await CDP({ host: "127.0.0.1", port: 9222, target: targetId });
  await session.Accessibility.enable();
  await session.DOM.enable();
  await session.Page.enable();
  await session.Runtime.enable();
  await attachOverlayListener(session);
  return session;
}
