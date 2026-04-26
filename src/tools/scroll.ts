import CDP from "chrome-remote-interface";
import { checkDomain } from "../security/allowlist.js";
import { logAction } from "../audit/logger.js";
import type { Config } from "../config/loader.js";

type ScrollDirection = "up" | "down" | "top" | "bottom";

interface ScrollResult {
  success: true;
  direction: ScrollDirection;
}

export async function weaveScroll(
  session: CDP.Client,
  direction: ScrollDirection,
  amount: number,
  config: Config
): Promise<ScrollResult> {
  const { frameTree } = await session.Page.getFrameTree();
  const currentUrl = frameTree.frame.url;

  const domainCheck = checkDomain(currentUrl, config);
  if (!domainCheck.allowed) {
    throw new Error(`⊘ Weave blocked: ${domainCheck.reason}`);
  }

  process.stderr.write(`⟳ Weaving: scrolling ${direction}\n`);

  const scrollScript = buildScrollScript(direction, amount);
  await session.Runtime.evaluate({ expression: scrollScript, returnByValue: false });

  logAction("weave_scrl", direction, `${amount}px`);
  process.stderr.write(`✓ Weaved: scrolled ${direction}\n`);

  return { success: true, direction };
}

function buildScrollScript(direction: ScrollDirection, amount: number): string {
  switch (direction) {
    case "up":
      return `window.scrollBy({ top: -${amount}, behavior: 'smooth' });`;
    case "down":
      return `window.scrollBy({ top: ${amount}, behavior: 'smooth' });`;
    case "top":
      return `window.scrollTo({ top: 0, behavior: 'smooth' });`;
    case "bottom":
      return `window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });`;
  }
}
