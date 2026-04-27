import CDP from "chrome-remote-interface";

export type MutationSummary = {
  newElements: { tag: string; text: string; role?: string }[];
  removedElements: { tag: string; text: string }[];
  attributeChanges: { element: string; attribute: string; oldValue: string; newValue: string }[];
  significantChange: boolean;
};

export async function watchMutations(session: CDP.Client, durationMs: number): Promise<MutationSummary> {
  const summary: MutationSummary = {
    newElements: [],
    removedElements: [],
    attributeChanges: [],
    significantChange: false,
  };

  let mutationCount = 0;
  
  const insertListener = (params: any) => {
    mutationCount++;
    const nodeName = params.node?.nodeName?.toLowerCase();
    if (nodeName && !['#text', '#comment', 'script', 'style'].includes(nodeName)) {
      summary.newElements.push({
        tag: nodeName,
        text: params.node?.nodeValue || '',
      });
    }
  };

  const removeListener = (params: any) => {
    mutationCount++;
    summary.removedElements.push({
      tag: "unknown",
      text: "Node removed" // Hard to get full details of removed node without caching DOM
    });
  };

  const attrListener = (params: any) => {
    mutationCount++;
    summary.attributeChanges.push({
      element: `nodeId:${params.nodeId}`,
      attribute: params.name,
      oldValue: "", // Can't easily get old value without caching
      newValue: params.value
    });
  };

  session.DOM.on('childNodeInserted', insertListener);
  session.DOM.on('childNodeRemoved', removeListener);
  session.DOM.on('attributeModified', attrListener);

  await new Promise(r => setTimeout(r, durationMs));

  (session.DOM as any).removeListener('childNodeInserted', insertListener);
  (session.DOM as any).removeListener('childNodeRemoved', removeListener);
  (session.DOM as any).removeListener('attributeModified', attrListener);

  summary.significantChange = mutationCount > 3;

  // Truncate to avoid blowing up tokens
  if (summary.newElements.length > 10) summary.newElements = summary.newElements.slice(0, 10);
  if (summary.removedElements.length > 5) summary.removedElements = summary.removedElements.slice(0, 5);
  if (summary.attributeChanges.length > 5) summary.attributeChanges = summary.attributeChanges.slice(0, 5);

  return summary;
}
