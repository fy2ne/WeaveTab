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

  await session.DOM.getDocument({});
  const { nodeIds } = await session.DOM.pushNodesByBackendIdsToFrontend({ backendNodeIds: [element.backendNodeId] });
  if (!nodeIds || nodeIds.length === 0) {
     throw new Error(`✗ Weave failed: Could not resolve DOM node for "${elementId}"`);
  }
  const nodeId = nodeIds[0]!;

  let boxModel;
  try {
    boxModel = (await session.DOM.getBoxModel({ nodeId })).model;
  } catch {
    const { object } = await session.DOM.resolveNode({ nodeId });
    await session.Runtime.callFunctionOn({
      functionDeclaration: `function() { this.scrollIntoView({behavior: 'instant', block: 'center'}); }`,
      objectId: object.objectId,
      silent: true,
    });
    boxModel = (await session.DOM.getBoxModel({ nodeId })).model;
  }

  const quad = boxModel.content;
  const x = quad[0]! + (quad[2]! - quad[0]!) / 2;
  const y = quad[1]! + (quad[5]! - quad[1]!) / 2;

  await session.Input.dispatchMouseEvent({ type: "mouseMoved", x, y, button: "none" });
  await session.Input.dispatchMouseEvent({ type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await session.Input.dispatchMouseEvent({ type: "mouseReleased", x, y, button: "left", clickCount: 1 });

  logAction("weave_click", elementId, element.label);
  process.stderr.write(`✓ Weaved: clicked ${element.label}\n`);

  return { success: true, clicked: element.label };
}
