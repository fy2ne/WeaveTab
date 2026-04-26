import CDP from "chrome-remote-interface";
import { checkDomain } from "../security/allowlist.js";
import { logAction } from "../audit/logger.js";
import { memory } from "../state/memory.js";
import type { Config } from "../config/loader.js";

interface NavigateResult {
  success: true;
  url: string;
  title: string;
}

export async function weaveNavigate(
  session: CDP.Client,
  url: string,
  config: Config
): Promise<NavigateResult> {
  // Validate URL format
  const parsed = new URL(url);

  const domainCheck = checkDomain(parsed.href, config);
  if (!domainCheck.allowed) {
    throw new Error(`⊘ Weave blocked: ${domainCheck.reason}`);
  }

  process.stderr.write(`⟳ Weaving: navigating to ${url}\n`);

  await session.Page.navigate({ url: parsed.href });
  await session.Page.loadEventFired();

  const { frameTree } = await session.Page.getFrameTree();
  const title = frameTree.frame.name ?? parsed.hostname;

  logAction("weave_nav", url, `arrived at ${title}`);
  process.stderr.write(`✓ Weaved: arrived at ${title}\n`);

  memory.recordAction({
    tool: "weave_navigate",
    targetUrl: parsed.href
  });

  return { success: true, url: parsed.href, title };
}
