import CDP from "chrome-remote-interface";
import { buildActionMap } from "../cdp/walker.js";
import { checkDomain } from "../security/allowlist.js";
import { logAction } from "../audit/logger.js";
import { memory } from "../state/memory.js";
import type { Config } from "../config/loader.js";
import { logProfessional } from "../ui/cli.js";
import { TelemetryCapture, TelemetryReport } from "../sensors/network.js";
import { watchMutations, MutationSummary } from "../sensors/mutations.js";

interface TypeResult {
  success: true;
  typed_into: string;
  telemetry: TelemetryReport;
  mutations: MutationSummary;
}

export async function weaveType(
  session: CDP.Client,
  args: { id?: string; label?: string; intent?: string; backendNodeId?: number; text: string; clearFirst?: boolean },
  config: Config
): Promise<TypeResult> {
  const { id, label, intent, backendNodeId, text, clearFirst } = args;
  const { frameTree } = await session.Page.getFrameTree();
  const currentUrl = frameTree.frame.url;

  const domainCheck = checkDomain(currentUrl, config);
  if (!domainCheck.allowed) {
    throw new Error(`⊘ Weave blocked: ${domainCheck.reason}`);
  }

  let element: any;
  if (backendNodeId) {
    element = { backendNodeId, label: `node-${backendNodeId}`, id: `node-${backendNodeId}` };
  } else if (id) {
    const map = await buildActionMap(session);
    element = map.elements.find((el) => el.id === id);
    if (!element) throw new Error(`⊘ Weave blocked: ID "${id}" not found`);
  } else if (label || intent) {
    const map = await buildActionMap(session);
    const target = label || intent!;
    element = map.elements.find(el => el.label.toLowerCase() === target.toLowerCase())
              || map.elements.find(el => el.type === target)
              || map.elements.find(el => el.label.toLowerCase().includes(target.toLowerCase()));
    
    if (!element) throw new Error(`⊘ Weave blocked: Could not find input matching "${target}"`);
  } else {
    throw new Error("✗ Weave failed: Must provide elementId, label, intent, or backendNodeId");
  }

  logProfessional("ACTION", "Weaver", `typing into ${element.label}`);

  const telemetry = new TelemetryCapture(session);
  await telemetry.start();

  if (!element.backendNodeId) {
    throw new Error(`✗ Weave failed: Element "${element.id}" has no backend node ID`);
  }

  const { object } = await session.DOM.resolveNode({ backendNodeId: element.backendNodeId });
  await session.Runtime.callFunctionOn({
    functionDeclaration: `function() { this.focus(); }`,
    objectId: object.objectId,
    silent: true,
  });

  const { nodeIds } = await session.DOM.pushNodesByBackendIdsToFrontend({ backendNodeIds: [element.backendNodeId] });
  let x = 0, y = 0, w = 0, h = 0;
  if (nodeIds && nodeIds.length > 0) {
    try {
      const boxModel = (await session.DOM.getBoxModel({ nodeId: nodeIds[0]! })).model;
      const quad = boxModel.content;
      w = quad[2]! - quad[0]!;
      h = quad[5]! - quad[1]!;
      x = quad[0]! + w / 2;
      y = quad[1]! + h / 2;
    } catch {}
  }

  await session.Runtime.evaluate({
    expression: `
      if(window.__weavetab) {
        window.__weavetab.moveCursor(${x}, ${y}, 'Typing...');
        window.__weavetab.showGlow(${x - 2}, ${y - 2}, ${w + 4}, ${h + 4});
      }
    `
  });

  if (clearFirst) {
    await session.Input.dispatchKeyEvent({ type: "keyDown", key: "a", modifiers: 2 });
    await session.Input.dispatchKeyEvent({ type: "keyUp", key: "a", modifiers: 2 });
    await session.Input.dispatchKeyEvent({ type: "keyDown", key: "Delete" });
    await session.Input.dispatchKeyEvent({ type: "keyUp", key: "Delete" });
  }

  await (await import("../ui/cli.js")).logWeaving(`Typing into ${element.label}...`, 300);
  for (const char of text) {
    await session.Input.dispatchKeyEvent({ type: "char", text: char });
    // Simulate natural typing rhythm
    await new Promise(r => setTimeout(r, Math.random() * 50 + 20));
  }

  const mutations = await watchMutations(session, 1000);
  const telemetryReport = await telemetry.stop();

  await session.Runtime.evaluate({
    expression: `
      if(window.__weavetab) {
        window.__weavetab.hideGlow();
        window.__weavetab.hideBadge();
      }
    `
  });

  // Audit log ALWAYS writes [REDACTED] — never the actual text
  logAction("weave_type", element.id, "[REDACTED]");
  logProfessional("INFO", "Weaver", `✓ Weaved: typed into ${element.label}`);

  memory.recordAction({
    tool: "weave_type",
    targetId: element.id,
    targetLabel: element.label,
    targetUrl: currentUrl,
    textTyped: "[REDACTED]"
  });

  return { success: true, typed_into: element.label, telemetry: telemetryReport, mutations };
}
