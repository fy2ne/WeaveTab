import CDP from "chrome-remote-interface";
import { buildActionMap } from "../cdp/walker.js";
import { checkDomain } from "../security/allowlist.js";
import { logAction } from "../audit/logger.js";
import { recordAction } from "../intelligence/trail.js";
import type { Config } from "../config/loader.js";
import { watchMutations, MutationSummary } from "../sensors/mutations.js";

interface TypeResult {
  success: true;
  mutations: MutationSummary;
}

export async function weaveType(
  session: CDP.Client,
  args: { id?: string; label?: string; intent?: string; backendNodeId?: number; text: string; clearFirst?: boolean },
  config: Config
): Promise<TypeResult> {
  const { id, label, intent, backendNodeId, text, clearFirst } = args;
  const { Page, DOM, Input, Runtime } = session;
  const { frameTree } = await Page.getFrameTree();
  const currentUrl = frameTree.frame.url;

  const domainCheck = checkDomain(currentUrl, config);
  if (!domainCheck.allowed) {
    throw new Error(`⊘ Weave blocked: ${domainCheck.reason}`);
  }

  let element: any;
  const map = await buildActionMap(session);
  if (backendNodeId) {
    element = map.elements.find(el => el.backendNodeId === backendNodeId) || { backendNodeId, label: `node-${backendNodeId}`, id: `node-${backendNodeId}` };
  } else if (id) {
    element = map.elements.find((el) => el.id === id);
    if (!element) throw new Error(`⊘ Weave blocked: ID "${id}" not found`);
  } else if (label || intent) {
    const target = label || intent!;
    element = map.elements.find(el => el.label.toLowerCase() === target.toLowerCase())
              || map.elements.find(el => el.type === target)
              || map.elements.find(el => el.label.toLowerCase().includes(target.toLowerCase()));
    
    if (!element) throw new Error(`⊘ Weave blocked: Could not find input matching "${target}"`);
  } else {
    throw new Error("✗ Weave failed: Must provide elementId, label, intent, or backendNodeId");
  }

  console.error(`[WeaveTab ${"Weaver".replace(/['"]/g,"")}] ${`typing into ${element.label}`}`);

  if (!element.backendNodeId) {
    throw new Error(`✗ Weave failed: Element "${element.id}" has no backend node ID`);
  }

  const { object } = await DOM.resolveNode({ backendNodeId: element.backendNodeId });
  await Runtime.callFunctionOn({
    functionDeclaration: `function() { this.focus(); }`,
    objectId: object.objectId,
    silent: true,
  });

  if (clearFirst) {
    // A more robust way to clear would be to select all and delete
    await Runtime.callFunctionOn({
        functionDeclaration: `function() { this.select(); }`,
        objectId: object.objectId,
        silent: true,
    });
    await Input.dispatchKeyEvent({ type: "keyDown", key: "Delete", nativeVirtualKeyCode: 46, windowsVirtualKeyCode: 46 });
    await Input.dispatchKeyEvent({ type: "keyUp", key: "Delete", nativeVirtualKeyCode: 46, windowsVirtualKeyCode: 46 });
  }

  
  // V2: Watch mutations while typing
  const [_, mutations] = await Promise.all([
    (async () => {
        for (const char of text) {
            await Input.dispatchKeyEvent({ type: "char", text: char });
            await new Promise(r => setTimeout(r, Math.random() * 50 + 20));
        }
    })(),
    watchMutations(session, text.length * 60 + 500) // Estimate duration
  ]);

  recordAction({
    timestamp: new Date().toISOString(),
    tool: "weave_type",
    input: { elementId: element.id, label: element.label, intent: element.type, text: "[REDACTED]" },
    result: {
      success: true,
      mutations, // V2: Include mutation summary
    }
  });

  console.error(`[WeaveTab ${"Weaver".replace(/['"]/g,"")}] ${`✓ Weaved: typed into ${element.label}, significant change: ${mutations.significantChange}`}`);

  return { success: true, mutations };
}
