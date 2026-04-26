import CDP from "chrome-remote-interface";
import { buildActionMap } from "../cdp/walker.js";
import { checkDomain } from "../security/allowlist.js";
import { logAction } from "../audit/logger.js";
import type { Config } from "../config/loader.js";

interface TypeResult {
  success: true;
}

export async function weaveType(
  session: CDP.Client,
  elementId: string,
  text: string,
  clearFirst: boolean,
  config: Config
): Promise<TypeResult> {
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

  if (!element.backendNodeId) {
    throw new Error(`✗ Weave failed: Element "${elementId}" has no backend node ID`);
  }

  process.stderr.write(`⟳ Weaving: typing into ${element.label}\n`);

  const { object } = await session.DOM.resolveNode({ backendNodeId: element.backendNodeId });
  await session.Runtime.callFunctionOn({
    functionDeclaration: `function() { this.focus(); }`,
    objectId: object.objectId,
    silent: true,
  });

  if (clearFirst) {
    await session.Input.dispatchKeyEvent({ type: "keyDown", key: "a", modifiers: 2 });
    await session.Input.dispatchKeyEvent({ type: "keyUp", key: "a", modifiers: 2 });
    await session.Input.dispatchKeyEvent({ type: "keyDown", key: "Delete" });
    await session.Input.dispatchKeyEvent({ type: "keyUp", key: "Delete" });
  }

  for (const char of text) {
    await session.Input.dispatchKeyEvent({ type: "char", text: char });
  }

  // Audit log ALWAYS writes [REDACTED] — never the actual text
  logAction("weave_type", elementId, "[REDACTED]");
  process.stderr.write(`✓ Weaved: typed into ${element.label}\n`);

  return { success: true };
}
