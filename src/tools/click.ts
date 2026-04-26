import CDP from "chrome-remote-interface";
import { buildActionMap } from "../cdp/walker.js";
import { checkDomain } from "../security/allowlist.js";
import { logAction } from "../audit/logger.js";
import type { Config } from "../config/loader.js";

interface ClickResult {
  success: true;
  clicked: string;
}

export async function weaveClick(
  session: CDP.Client,
  elementId: string,
  config: Config
): Promise<ClickResult> {
  const { frameTree } = await session.Page.getFrameTree();
  const currentUrl = frameTree.frame.url;

  const domainCheck = checkDomain(currentUrl, config);
  if (!domainCheck.allowed) {
    throw new Error(`⊘ Weave blocked: ${domainCheck.reason}`);
  }

  const map = await buildActionMap(session);
  const element = map.elements.find((el) => el.id === elementId);

  if (!element) {
    throw new Error(`⊘ Weave blocked: Element ID "${elementId}" not found in current action map`);
  }

  process.stderr.write(`⟳ Weaving: clicking ${element.label}\n`);

  if (!element.backendNodeId) {
    throw new Error(`✗ Weave failed: Element "${elementId}" has no backend node ID`);
  }

  const { object } = await session.DOM.resolveNode({ backendNodeId: element.backendNodeId });
  await session.Runtime.callFunctionOn({
    functionDeclaration: `function() { this.scrollIntoView({block:'center'}); this.click(); }`,
    objectId: object.objectId,
    silent: true,
  });

  logAction("weave_click", elementId, element.label);
  process.stderr.write(`✓ Weaved: clicked ${element.label}\n`);

  return { success: true, clicked: element.label };
}
