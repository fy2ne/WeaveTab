import CDP from "chrome-remote-interface";
import { recordAction } from "../intelligence/trail.js";
import { watchMutations, MutationSummary } from "../sensors/mutations.js";
import type { Config } from "../config/loader.js";

const ALLOWED_KEYS = new Set([
  "Enter", "Escape", "Tab", "Backspace", "Delete",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7",
  "F8", "F9", "F10", "F11", "F12"
]);

type Modifier = "Alt" | "Ctrl" | "Meta" | "Shift";

interface KeyResult {
  success: true;
  mutations: MutationSummary;
}

export async function weaveKey(
  session: CDP.Client,
  args: { key: string; modifiers?: Modifier[] },
  config: Config
): Promise<KeyResult> {
  const { key, modifiers } = args;
  const { Input } = session;

  // Allow single characters (a, b, 1, 2, etc.) or specific control keys
  if (key.length > 1 && !ALLOWED_KEYS.has(key)) {
    throw new Error(`✗ Weave failed: Key "${key}" is not a valid control key.`);
  }

  let modMask = 0;
  if (modifiers) {
    if (modifiers.includes("Alt")) modMask |= 1;
    if (modifiers.includes("Ctrl")) modMask |= 2;
    if (modifiers.includes("Meta")) modMask |= 4; // Command/Windows key
    if (modifiers.includes("Shift")) modMask |= 8;
  }
  
  const modifierText = modifiers ? modifiers.join('+') + '+' : '';
  console.error(`[WeaveTab ${"Weaver".replace(/['"]/g,"")}] ${`pressing ${modifierText}${key}`}`);

  // V2: Watch for mutations during the key press
  const [_, mutations] = await Promise.all([
    (async () => {
      await Input.dispatchKeyEvent({ type: "keyDown", key: key, modifiers: modMask });
      // Some keys like 'Enter' also generate a 'char' event
      if (key === 'Enter') {
        await Input.dispatchKeyEvent({ type: 'char', text: '\r', modifiers: modMask });
      }
      await Input.dispatchKeyEvent({ type: "keyUp", key: key, modifiers: modMask });
    })(),
    watchMutations(session, 800) // Watch for 800ms
  ]);

  recordAction({
    timestamp: new Date().toISOString(),
    tool: "weave_key",
    input: { key, modifiers },
    result: {
      success: true,
      mutations, // V2: Include mutation summary
    }
  });
  
  console.error(`[WeaveTab ${"Weaver".replace(/['"]/g,"")}] ${`✓ Weaved: key dispatched, significant change: ${mutations.significantChange}`}`);

  return { success: true, mutations };
}
