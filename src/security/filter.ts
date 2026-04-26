import type { ActionElement } from "../cdp/walker.js";

const MAX_LABEL_LENGTH = 500;

// Zero-width and invisible Unicode characters used in prompt injection attacks
const INVISIBLE_CHAR_REGEX = /[\u200B-\u200D\uFEFF\u00AD\u2060\u180E\u00A0]/;

function isLikelySuspicious(label: string): boolean {
  if (label.length > MAX_LABEL_LENGTH) return true;
  if (INVISIBLE_CHAR_REGEX.test(label)) return true;
  // Excessive whitespace: more than 5 consecutive spaces/tabs not at start/end
  if (/[ \t]{6,}/.test(label.trim())) return true;
  return false;
}

export function filterHidden(elements: ActionElement[]): ActionElement[] {
  return elements.filter((el) => !isLikelySuspicious(el.label));
}
