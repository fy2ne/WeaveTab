import CDP from "chrome-remote-interface";
import { buildActionMap, ActionElement } from "../cdp/walker.js";
import { logAction } from "../audit/logger.js";
import { getLastAction } from "../intelligence/trail.js";
import { getProfile } from "../intelligence/profiles.js";
import { generateHints } from "../intelligence/hints.js";

type GroupedElements = {
  navigation: ActionElement[];
  main_content: ActionElement[];
  sidebar: ActionElement[];
  form: ActionElement[];
  modal: ActionElement[];
  utility: ActionElement[];
};

export async function weaveRead(session: CDP.Client): Promise<string> {
  const map = await buildActionMap(session);

  process.stderr.write(`⟳ Weaving: reading page ${map.url}\n`);
  logAction("weave_read", map.url, `${map.elements.length} elements`);
  process.stderr.write(`✓ Weaved: ${map.elements.length} elements found\n`);

  let site = "generic";
  let pageType = "generic_webpage";
  try {
    const hostname = new URL(map.url).hostname;
    const profile = getProfile(hostname);
    site = profile.name;
    pageType = profile.getPageType(map.url);
  } catch {}

  // Group elements
  const groupedElements: GroupedElements = {
    navigation: [],
    main_content: [],
    sidebar: [],
    form: [],
    modal: [],
    utility: [],
  };

  for (const e of map.elements) {
    const group = e.group || "utility";
    if (!groupedElements[group]) groupedElements[group] = [];
    groupedElements[group].push(e);
  }

  // Filter empty groups except required ones if needed
  if (groupedElements.modal.length === 0) {
    delete (groupedElements as any).modal;
  }

  const hints = generateHints(pageType, groupedElements as GroupedElements);

  // Build the rich context response
  const richContext = {
    page: {
      url: map.url,
      title: map.title,
      type: pageType,
      site,
    },
    elements: groupedElements,
    last_action: getLastAction(),
    hints
  };

  return JSON.stringify(richContext, null, 2);
}
