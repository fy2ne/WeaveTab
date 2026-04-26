import CDP from "chrome-remote-interface";
import { logAction } from "../audit/logger.js";
import { connectToTab } from "../cdp/connector.js";

interface TabInfo {
  id: string;
  title: string;
  url: string;
}

interface ListResult {
  tabs: TabInfo[];
}

interface SwitchResult {
  success: true;
  title: string;
}

export async function weaveTabs(
  action: "list",
  _tabId: undefined
): Promise<ListResult>;
export async function weaveTabs(
  action: "switch",
  tabId: string
): Promise<SwitchResult>;
export async function weaveTabs(
  action: "list" | "switch",
  tabId: string | undefined
): Promise<ListResult | SwitchResult> {
  if (action === "list") {
    process.stderr.write("⟳ Weaving: listing tabs\n");

    const targets = await CDP.List({ host: "127.0.0.1", port: 9222 });
    const tabs: TabInfo[] = targets
      .filter((t) => t.type === "page")
      .map((t) => ({ id: t.id, title: t.title, url: t.url }));

    logAction("weave_tabs", "list", `${tabs.length} tabs`);
    process.stderr.write(`✓ Weaved: ${tabs.length} tabs\n`);

    return { tabs };
  }

  if (!tabId) {
    throw new Error("✗ Weave failed: tabId is required for switch action");
  }

  process.stderr.write(`⟳ Weaving: switching to ${tabId}\n`);

  const session = await connectToTab(tabId);
  await session.Target.activateTarget({ targetId: tabId });

  const { frameTree } = await session.Page.getFrameTree();
  const title = frameTree.frame.name ?? tabId;

  await session.close();

  logAction("weave_tabs", `switch:${tabId}`, title);
  process.stderr.write(`✓ Weaved: switched to ${title}\n`);

  return { success: true, title };
}
