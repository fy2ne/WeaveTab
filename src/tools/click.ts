import CDP from "chrome-remote-interface";
import { buildActionMap } from "../cdp/walker.js";
import { checkDomain } from "../security/allowlist.js";
import { logAction } from "../audit/logger.js";
import { recordAction } from "../intelligence/trail.js";
import { getProfile } from "../intelligence/profiles.js";
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
  const { frameTree: beforeTree } = await session.Page.getFrameTree();
  const urlBefore = beforeTree.frame.url;
  const pageTypeBefore = getPageType(urlBefore);

  const domainCheck = checkDomain(urlBefore, config);
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

  await session.Runtime.evaluate({
    expression: `
      (() => {
        let cursor = document.getElementById('weave-cursor');
        if (!cursor) {
          cursor = document.createElement('div');
          cursor.id = 'weave-cursor';
          cursor.style.position = 'fixed';
          cursor.style.width = '20px';
          cursor.style.height = '20px';
          cursor.style.borderRadius = '50%';
          cursor.style.backgroundColor = 'rgba(255, 0, 0, 0.4)';
          cursor.style.border = '2px solid red';
          cursor.style.pointerEvents = 'none';
          cursor.style.zIndex = '2147483647';
          cursor.style.transition = 'all 0.3s ease-out';
          cursor.style.transform = 'translate(-50%, -50%)';
          document.body.appendChild(cursor);
        }
        cursor.style.left = '${x}px';
        cursor.style.top = '${y}px';
      })();
    `
  });

  await new Promise(r => setTimeout(r, 300));
  await session.Input.dispatchMouseEvent({ type: "mouseMoved", x, y, button: "none" });
  await session.Input.dispatchMouseEvent({ type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await session.Input.dispatchMouseEvent({ type: "mouseReleased", x, y, button: "left", clickCount: 1 });

  await new Promise(r => setTimeout(r, 800));
  
  const { frameTree: afterTree } = await session.Page.getFrameTree();
  const urlAfter = afterTree.frame.url;
  const pageTypeAfter = getPageType(urlAfter);

  recordAction({
    timestamp: new Date().toISOString(),
    tool: "weave_click",
    input: { elementId },
    result: {
      success: true,
      pageChanged: urlBefore !== urlAfter,
      urlBefore,
      urlAfter,
      pageTypeBefore,
      pageTypeAfter,
      elementClicked: {
        id: element.id,
        type: element.type || "unknown",
        label: element.label,
        href: element.href
      }
    }
  });

  logAction("weave_click", elementId, element.label);
  process.stderr.write(`✓ Weaved: clicked ${element.label}\n`);

  return { success: true, clicked: element.label };
}

function getPageType(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const profile = getProfile(hostname);
    return profile.getPageType(url);
  } catch {
    return "unknown";
  }
}
