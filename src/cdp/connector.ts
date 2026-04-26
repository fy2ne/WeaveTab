import CDP from "chrome-remote-interface";
import type { Config } from "../config/loader.js";

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

export async function connectToChrome(_config: Config): Promise<ChromeClient> {
  await detectNonLocalhostBinding();

  let targets: CDP.Target[];

  try {
    targets = await CDP.List({ host: "127.0.0.1", port: 9222 });
  } catch {
    process.stderr.write(
      "✗ Weave failed: Chrome not found on port 9222. Launch Chrome with --remote-debugging-port=9222\n"
    );
    process.exit(1);
  }

  const pageTarget = targets.find((t) => t.type === "page" && t.url !== "about:blank");

  if (!pageTarget) {
    process.stderr.write(
      "✗ Weave failed: No active page tab found. Open a page in Chrome first.\n"
    );
    process.exit(1);
  }

  const session = await CDP({ host: "127.0.0.1", port: 9222, target: pageTarget.id });

  await session.Accessibility.enable();
  await session.DOM.enable();
  await session.Page.enable();
  await session.Runtime.enable();

  process.stderr.write("✓ Weaved. Ready.\n");

  return {
    session,
    targetId: pageTarget.id,
    url: pageTarget.url,
    title: pageTarget.title,
  };
}

export async function getTabList(): Promise<CDP.Target[]> {
  try {
    const targets = await CDP.List({ host: "127.0.0.1", port: 9222 });
    return targets.filter((t) => t.type === "page");
  } catch {
    process.stderr.write("✗ Weave failed: Cannot reach Chrome on port 9222.\n");
    process.exit(1);
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
