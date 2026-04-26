import CDP from "chrome-remote-interface";
import { buildActionMap } from "../cdp/walker.js";
import { logAction } from "../audit/logger.js";

export async function weaveRead(session: CDP.Client): Promise<string> {
  const map = await buildActionMap(session);

  process.stderr.write(`⟳ Weaving: reading page ${map.url}\n`);
  logAction("weave_read", map.url, `${map.elements.length} elements`);
  process.stderr.write(`✓ Weaved: ${map.elements.length} elements found\n`);

  return JSON.stringify(map, null, 2);
}
