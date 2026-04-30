import CDP from "chrome-remote-interface";
import { buildActionMap } from "../cdp/walker.js";
import { checkDomain } from "../security/allowlist.js";
import { logAction } from "../audit/logger.js";
import { recordAction } from "../intelligence/trail.js";
import { getProfile } from "../intelligence/profiles.js";
import type { Config } from "../config/loader.js";
import { watchMutations, MutationSummary } from "../sensors/mutations.js";

interface ClickResult {
  success: true;
  clicked: string;
  mutations: MutationSummary;
}

export async function weaveClick(
  session: CDP.Client,
  args: { id?: string; label?: string; intent?: string; backendNodeId?: number },
  config: Config
): Promise<ClickResult> {
  const { id, label, intent, backendNodeId } = args;
  const { Page, DOM, Input, Runtime } = session;
  const { frameTree: beforeTree } = await Page.getFrameTree();
  const urlBefore = beforeTree.frame.url;
  const pageTypeBefore = getPageType(urlBefore);

  const domainCheck = checkDomain(urlBefore, config);
  if (!domainCheck.allowed) {
    throw new Error(`⊘ Weave blocked: ${domainCheck.reason}`);
  }

  let element: any;
  const map = await buildActionMap(session);

  if (backendNodeId) {
    element = map.elements.find((el) => el.backendNodeId === backendNodeId) || { backendNodeId, label: `node-${backendNodeId}`, id: `node-${backendNodeId}` };
  } else if (id) {
    element = map.elements.find((el) => el.id === id);
    if (!element) throw new Error(`⊘ Weave blocked: ID "${id}" not found`);
  } else if (label || intent) {
    const target = label || intent!;
    element = map.elements.find(el => el.label.toLowerCase() === target.toLowerCase()) 
              || map.elements.find(el => el.type === target)
              || map.elements.find(el => el.label.toLowerCase().includes(target.toLowerCase()));
    
    if (!element) throw new Error(`⊘ Weave blocked: Could not find clickable element matching "${target}"`);
  } else {
    throw new Error("✗ Weave failed: Must provide elementId, label, intent, or backendNodeId");
  }

  console.error(`[WeaveTab ${"Weaver".replace(/['"]/g,"")}] ${`clicking ${element.label}`}`);
  
  if (!element.backendNodeId) {
    throw new Error(`✗ Weave failed: Element "${element.id}" has no backend node ID`);
  }

  await DOM.getDocument({});
  const { nodeIds } = await DOM.pushNodesByBackendIdsToFrontend({ backendNodeIds: [element.backendNodeId] });
  if (!nodeIds || nodeIds.length === 0) {
     throw new Error(`✗ Weave failed: Could not resolve DOM node for "${element.id}"`);
  }
  const nodeId = nodeIds[0]!;

  let boxModel;
  try {
    boxModel = (await DOM.getBoxModel({ nodeId })).model;
  } catch {
    const { object } = await DOM.resolveNode({ nodeId });
    await Runtime.callFunctionOn({
      functionDeclaration: `function() { this.scrollIntoView({behavior: 'instant', block: 'center'}); }`,
      objectId: object.objectId,
      silent: true,
    });
    boxModel = (await DOM.getBoxModel({ nodeId })).model;
  }

  const quad = boxModel.content;
  const x = quad[0]! + (quad[2]! - quad[0]!) / 2;
  const y = quad[1]! + (quad[5]! - quad[1]!) / 2;

  await Runtime.evaluate({
    expression: `if(window.__weavetab) window.__weavetab.moveCursor(${x}, ${y}, 'Clicking ${element.label.replace(/'/g, "\\'")}');`
  });

  await new Promise(r => setTimeout(r, 300));
  await Input.dispatchMouseEvent({ type: "mouseMoved", x, y, button: "none" });
    
  await Runtime.evaluate({
    expression: `if(window.__weavetab) window.__weavetab.clickCursor();`
  });
  
  // V2: Watch for mutations after the click
  const [_, mutations] = await Promise.all([
    Input.dispatchMouseEvent({ type: "mousePressed", x, y, button: "left", clickCount: 1 }).then(() => 
    Input.dispatchMouseEvent({ type: "mouseReleased", x, y, button: "left", clickCount: 1 })),
    watchMutations(session, 800) // Watch for 800ms post-click
  ]);
  
  await Runtime.evaluate({
    expression: `if(window.__weavetab) window.__weavetab.hideBadge();`
  });
  
  const { frameTree: afterTree } = await Page.getFrameTree();
  const urlAfter = afterTree.frame.url;
  const pageTypeAfter = getPageType(urlAfter);

  recordAction({
    timestamp: new Date().toISOString(),
    tool: "weave_click",
    input: { elementId: element.id, label: element.label, intent: element.type },
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
      },
      mutations, // V2: Include mutation summary in the trail
    }
  });

  console.error(`[WeaveTab ${"Weaver".replace(/['"]/g,"")}] ${`✓ Weaved: clicked ${element.label}, significant change: ${mutations.significantChange}`}`);

  return { success: true, clicked: element.label, mutations };
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
