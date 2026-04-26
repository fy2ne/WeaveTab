import CDP from "chrome-remote-interface";
import { filterHidden } from "../security/filter.js";
import { getProfile, classifyElement, extractMeta } from "../intelligence/profiles.js";

export type HrefType = "video" | "channel" | "profile" | "repo" | "fork" | "external" | "anchor" | "email" | "search" | "unknown";

export interface ActionElement {
  id: string;
  role: string;
  label: string;
  value?: string;
  nodeId?: number;
  backendNodeId?: number;
  container?: string;
  group: "navigation" | "main_content" | "sidebar" | "form" | "modal" | "utility";
  type?: string;
  href?: string;
  hrefType?: HrefType;
  meta?: Record<string, string>;
}

export interface ActionMap {
  url: string;
  title: string;
  elements: ActionElement[];
}

type AXNode = {
  nodeId: string;
  ignored?: boolean;
  role?: { value: string };
  name?: { value: string };
  description?: { value: string };
  value?: { value: string };
  backendDOMNodeId?: number;
  children?: AXNode[];
};

const INTERACTIVE_ROLES = new Set([
  "button", "link", "textbox", "searchbox", "combobox",
  "checkbox", "radio", "listbox", "menuitem", "menuitemcheckbox",
  "menuitemradio", "option", "slider", "spinbutton", "switch",
  "tab", "treeitem",
]);

const CONTAINER_ROLES = new Set([
  "main", "navigation", "banner", "complementary", "contentinfo", "search", "dialog"
]);

const ROLE_PREFIX: Record<string, string> = {
  button: "btn", link: "lnk", textbox: "inp", searchbox: "inp",
  combobox: "inp", checkbox: "chk", radio: "rad", listbox: "lst",
  menuitem: "mnu", slider: "sld", tab: "tab",
};

function prefixFor(role: string): string {
  return ROLE_PREFIX[role] ?? "el";
}

function determineGroup(container: string): ActionElement["group"] {
  switch (container) {
    case "navigation":
    case "banner":
      return "navigation";
    case "complementary":
      return "sidebar";
    case "search":
    case "form":
      return "form";
    case "dialog":
      return "modal";
    case "main":
      return "main_content";
    default:
      return "utility";
  }
}

function determineHrefType(href: string, pageUrl: string): HrefType {
  if (!href) return "unknown";
  if (href.includes("/watch?v=")) return "video";
  if (href.includes("/@") || href.includes("/channel/") || href.includes("/user/")) return "channel";
  if (href.includes("/results?")) return "search";
  if (href.includes("/fork") || href.includes("fork")) return "fork";
  
  // simplistic check for repo
  if (href.includes("github.com/")) {
    try {
      const u = new URL(href, pageUrl);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length === 2) return "repo";
    } catch {}
  } else if (pageUrl.includes("github.com")) {
    const parts = href.split("/").filter(Boolean);
    if (parts.length === 2 && !href.startsWith("http")) return "repo";
  }

  if (href.startsWith("mailto:")) return "email";
  if (href.startsWith("#")) return "anchor";
  
  try {
    const u = new URL(href, pageUrl);
    const base = new URL(pageUrl);
    if (u.hostname !== base.hostname) return "external";
  } catch {}

  return "unknown";
}

function collectNodes(
  nodes: AXNode[], 
  out: Partial<ActionElement>[], 
  counter: { n: number }, 
  currentContainer: string
): void {
  for (const node of nodes) {
    if (node.ignored) continue;

    const role = node.role?.value ?? "";
    const name = node.name?.value ?? "";
    const description = node.description?.value ?? "";
    const value = node.value?.value;

    let nextContainer = currentContainer;
    if (CONTAINER_ROLES.has(role)) {
      nextContainer = role;
    }

    const alwaysInclude = ["searchbox", "combobox", "textbox", "textarea", "button", "link"];
    const hasLabel = name.trim().length > 0;

    if (INTERACTIVE_ROLES.has(role) && (hasLabel || alwaysInclude.includes(role))) {
      const finalLabel = name.trim() ? name : (description.trim() ? description : (value?.trim() ? value : `[${role}]`));
      
      counter.n += 1;
      const id = `${prefixFor(role)}-${counter.n}`;
      const element: Partial<ActionElement> = {
        id,
        role,
        label: finalLabel,
        backendNodeId: node.backendDOMNodeId,
        container: nextContainer,
        group: determineGroup(nextContainer),
      };
      if (value !== undefined) element.value = value;
      out.push(element);
    }

    if (node.children) {
      collectNodes(node.children, out, counter, nextContainer);
    }
  }
}

export async function buildActionMap(session: CDP.Client): Promise<ActionMap> {
  const [axResponse, { frameTree }] = await Promise.all([
    session.Accessibility.getFullAXTree({}),
    session.Page.getFrameTree(),
  ]);

  const url = frameTree.frame.url;
  const title = frameTree.frame.name ?? "";

  const axNodes = (axResponse as unknown as { nodes?: AXNode[]; root?: AXNode[] }).nodes
    ?? (axResponse as unknown as { nodes?: AXNode[]; root?: AXNode[] }).root
    ?? [];

  const rawElements: Partial<ActionElement>[] = [];
  const counter = { n: 0 };
  collectNodes(axNodes, rawElements, counter, "other");

  const elements = filterHidden(rawElements as ActionElement[]);

  // Href-first resolution via CDP
  const validElements = elements.filter(e => e.backendNodeId !== undefined);
  const backendIds = validElements.map(e => e.backendNodeId!);

  if (backendIds.length > 0) {
    try {
      await session.DOM.getDocument({});
      const { nodeIds } = await session.DOM.pushNodesByBackendIdsToFrontend({ backendNodeIds: backendIds });

      const attrPromises = nodeIds.map(async (nodeId, i) => {
        if (!nodeId) return;
        try {
          const { attributes } = await session.DOM.getAttributes({ nodeId });
          const attrMap: Record<string, string> = {};
          for (let j = 0; j < attributes.length; j += 2) {
            attrMap[attributes[j]] = attributes[j + 1];
          }
          
          const el = validElements[i];
          if (attrMap.href) {
            el.href = attrMap.href;
            el.hrefType = determineHrefType(el.href, url);
          }
          if (attrMap.type) {
            // we override HTML type for some logic
            (el as any).htmlType = attrMap.type;
          }
          if (attrMap.action) {
            if (attrMap.action.includes("fork")) {
              el.hrefType = "fork";
            }
          }
        } catch (e) {}
      });

      await Promise.all(attrPromises);
    } catch (err) {
      // ignore
    }
  }

  // Site intelligence profile classification
  try {
    const hostname = new URL(url).hostname;
    const profile = getProfile(hostname);
    
    for (const el of elements) {
      el.type = classifyElement(el, profile, url);
      el.meta = extractMeta(el, el.type, profile);
    }
  } catch (err) {
    for (const el of elements) {
      if (!el.type) el.type = "GENERIC_ELEMENT";
    }
  }

  return { url, title, elements: elements as ActionElement[] };
}
