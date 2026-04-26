import CDP from "chrome-remote-interface";
import { logAction } from "../audit/logger.js";

type ExtractFormat = "text" | "json" | "list";

interface ExtractResult {
  format: ExtractFormat;
  content: string;
  charCount: number;
}

// Safe extraction script — reads only visible text, never touches storage or cookies
function buildExtractScript(selector: string | undefined): string {
  const selectorLiteral = selector ? JSON.stringify(selector) : "null";
  return `
(function() {
  const sel = ${selectorLiteral};
  const root = sel ? document.querySelector(sel) : document.body;
  if (!root) return '';
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const el = node.parentElement;
        if (!el) return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  const parts = [];
  let node;
  while ((node = walker.nextNode())) {
    const t = node.textContent ? node.textContent.trim() : '';
    if (t.length > 0) parts.push(t);
  }
  return parts.join('\\n');
})()
`;
}

function formatContent(raw: string, format: ExtractFormat): string {
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  if (format === "list") {
    return JSON.stringify(lines);
  }
  if (format === "json") {
    return JSON.stringify({ lines });
  }
  return lines.join("\n");
}

export async function weaveExtract(
  session: CDP.Client,
  selector: string | undefined,
  format: ExtractFormat
): Promise<ExtractResult> {
  const { frameTree } = await session.Page.getFrameTree();
  const url = frameTree.frame.url;

  process.stderr.write(`⟳ Weaving: extracting from ${url}\n`);

  const script = buildExtractScript(selector);
  const { result, exceptionDetails } = await session.Runtime.evaluate({
    expression: script,
    returnByValue: true,
  });

  if (exceptionDetails) {
    throw new Error(`✗ Weave failed: extract script error: ${exceptionDetails.text}`);
  }

  const raw = typeof result.value === "string" ? result.value : "";
  const content = formatContent(raw, format);

  logAction("weave_extr", selector ?? "body", `${content.length} chars`);
  process.stderr.write(`✓ Weaved: extracted ${content.length} chars\n`);

  return { format, content, charCount: content.length };
}
