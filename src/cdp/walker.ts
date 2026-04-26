import CDP from "chrome-remote-interface";
import { filterHidden } from "../security/filter.js";

export interface ActionElement {
  id: string;
  role: string;
  label: string;
  value?: string;
  nodeId?: number;
  backendNodeId?: number;
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
  value?: { value: string };
  backendDOMNodeId?: number;
  children?: AXNode[];
};

const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "searchbox",
  "combobox",
  "checkbox",
  "radio",
  "listbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "treeitem",
]);

const ROLE_PREFIX: Record<string, string> = {
  button: "btn",
  link: "lnk",
  textbox: "inp",
  searchbox: "inp",
  combobox: "inp",
  checkbox: "chk",
  radio: "rad",
  listbox: "lst",
  menuitem: "mnu",
  slider: "sld",
  tab: "tab",
};

function prefixFor(role: string): string {
  return ROLE_PREFIX[role] ?? "el";
}

function collectNodes(nodes: AXNode[], out: ActionElement[], counter: { n: number }): void {
  for (const node of nodes) {
    if (node.ignored) continue;

    const role = node.role?.value ?? "";
    const label = node.name?.value ?? "";
    const value = node.value?.value;

    if (INTERACTIVE_ROLES.has(role) && label.trim().length > 0) {
      counter.n += 1;
      const id = `${prefixFor(role)}-${counter.n}`;
      const element: ActionElement = {
        id,
        role,
        label,
        backendNodeId: node.backendDOMNodeId,
      };
      if (value !== undefined) element.value = value;
      out.push(element);
    }

    if (node.children) {
      collectNodes(node.children, out, counter);
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

  // The CDP types declare 'nodes' (flat array); we receive a tree in practice.
  // Cast to extract whatever the runtime returns.
  const axNodes = (axResponse as unknown as { nodes?: AXNode[]; root?: AXNode[] }).nodes
    ?? (axResponse as unknown as { nodes?: AXNode[]; root?: AXNode[] }).root
    ?? [];

  const rawElements: ActionElement[] = [];
  const counter = { n: 0 };
  collectNodes(axNodes, rawElements, counter);

  const elements = filterHidden(rawElements);

  return { url, title, elements };
}
