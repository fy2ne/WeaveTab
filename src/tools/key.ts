import CDP from "chrome-remote-interface";
import { logAction } from "../audit/logger.js";
import type { Config } from "../config/loader.js";

const ALLOWED_KEYS = new Set([
  "Enter", "Escape", "Tab", "Backspace", "Delete",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Space", "F1", "F2", "F3", "F4", "F5", "F6", "F7",
  "F8", "F9", "F10", "F11", "F12"
]);

type Modifier = "Alt" | "Ctrl" | "Meta" | "Shift";

interface KeyResult {
  success: true;
}

export async function weaveKey(
  session: CDP.Client,
  key: string,
  modifiers: Modifier[] | undefined,
  config: Config
): Promise<KeyResult> {
  if (key.length !== 1 && !ALLOWED_KEYS.has(key)) {
    throw new Error(`✗ Weave failed: Key "${key}" is not allowed.`);
  }

  let modMask = 0;
  if (modifiers) {
    if (modifiers.includes("Alt")) modMask |= 1;
    if (modifiers.includes("Ctrl")) modMask |= 2;
    if (modifiers.includes("Meta")) modMask |= 4;
    if (modifiers.includes("Shift")) modMask |= 8;
  }

  process.stderr.write(`⟳ Weaving: pressing ${key}\n`);

  await session.Input.dispatchKeyEvent({
    type: "keyDown",
    key: key,
    modifiers: modMask,
  });

  if (key === "Enter") {
    await session.Input.dispatchKeyEvent({
      type: "char",
      text: "\r",
      modifiers: modMask,
    });
  }

  await session.Input.dispatchKeyEvent({
    type: "keyUp",
    key: key,
    modifiers: modMask,
  });

  logAction("weave_key", key, "dispatched");
  process.stderr.write(`✓ Weaved: key dispatched\n`);

  return { success: true };
}
