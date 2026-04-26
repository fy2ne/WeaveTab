import { z } from "zod";
import CDP from "chrome-remote-interface";
import { weaveRead } from "./read.js";
import { ActionElement } from "../cdp/walker.js";

export async function weaveFind(
  session: CDP.Client,
  intent: string,
  group?: string
) {
  const readResultStr = await weaveRead(session);
  const data = JSON.parse(readResultStr);
  const elements: ActionElement[] = Object.values(data.elements).flat() as ActionElement[];

  let bestElement: ActionElement | undefined;
  let maxScore = 0;

  for (const el of elements) {
    let score = 0;
    const intentLower = intent.toLowerCase();
    
    // Exact SemanticType name match
    if (el.type?.toLowerCase() === intentLower.replace(/\s+/g, "_")) score += 100;
    
    // Label/Href keyword matches
    const words = intentLower.split(/\s+/);
    for (const word of words) {
      if (el.label.toLowerCase().includes(word)) score += 10;
      if (el.href?.toLowerCase().includes(word)) score += 15;
    }
    
    // Group match
    if (group && el.group === group) score += 20;
    
    if (score > maxScore) {
      maxScore = score;
      bestElement = el;
    }
  }

  if (maxScore === 0) {
    return { found: false, message: "No element matched intent. Call weave_read to see available elements." };
  }

  return {
    found: true,
    element: bestElement,
    confidence: maxScore > 50 ? "high" : (maxScore > 20 ? "medium" : "low"),
    suggestion: maxScore > 20 ? undefined : `Did you mean ${bestElement?.type} ${bestElement?.id}?`
  };
}
