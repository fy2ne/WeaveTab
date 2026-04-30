import CDP from "chrome-remote-interface";
import { Protocol } from "devtools-protocol";
import { weaveFind } from "../tools/find.js"; // Assuming find tool is available

export type WaitCondition = "navigation" | "element" | "network_idle" | "dom_stable" | "duration";

export interface WaitOptions {
  condition: WaitCondition;
  selector?: string;
  intent?: string;
  timeoutMs?: number;
  durationMs?: number;
}

export async function weave_wait(session: CDP.Client, options: WaitOptions): Promise<any> {
  const { Page, DOM, Network } = session;
  const timeout = options.timeoutMs ?? 10000;
  const start = Date.now();

  const race = <T>(description: string, promise: Promise<T>): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout waiting for ${description}`)), timeout)
      ),
    ]);
  };

  switch (options.condition) {
    case "duration":
      await new Promise(r => setTimeout(r, options.durationMs ?? 1000));
      return { condition_met: true, waited_ms: Date.now() - start, trigger: "duration" };

    case "navigation":
      await race("navigation", Page.loadEventFired());
      return { condition_met: true, waited_ms: Date.now() - start, trigger: "loadEventFired" };

    case "network_idle":
      // This is a simplified version. A robust implementation would track requests.
      await race("network idle", new Promise<void>(async resolve => {
          let idleTimeout: NodeJS.Timeout;
          const onRequest = () => {
              clearTimeout(idleTimeout);
              idleTimeout = setTimeout(resolve, 500); // 500ms of no new requests
          };
          Network.on('requestWillBeSent', onRequest);
          await Network.enable();
          idleTimeout = setTimeout(resolve, 500);
      }));
      await Network.disable();
      return { condition_met: true, waited_ms: Date.now() - start, trigger: "network_idle" };


    case "dom_stable":
        await race("DOM stability", new Promise<void>(async (resolve) => {
            let stabilityTimeout: NodeJS.Timeout;
            let mutationCount = 0;
            const resetTimeout = () => {
                clearTimeout(stabilityTimeout);
                stabilityTimeout = setTimeout(() => {
                    // If we get here, no mutations have occurred for 300ms
                    resolve();
                }, 300); // 300ms of no mutations
            };
    
            const mutationObserver = (p: any) => {
                mutationCount++;
                resetTimeout();
            };
    
            await DOM.enable();
            DOM.on('childNodeCountUpdated', mutationObserver);
            DOM.on('attributeModified', mutationObserver);
    
            await DOM.getDocument({ depth: -1, pierce: true });
            resetTimeout(); // Start the first timeout
        }));
        // Listeners are automatically removed when the agent is disabled
        await DOM.disable();
        return { condition_met: true, waited_ms: Date.now() - start, trigger: "dom_stable" };

    case "element":
        if (!options.selector && !options.intent) {
            throw new Error("Wait for 'element' requires either 'selector' or 'intent'");
        }
        await race(`element "${options.selector || options.intent}"`, new Promise<void>(async (resolve, reject) => {
            const interval = 250;
            const maxAttempts = timeout / interval;
            let attempts = 0;
            while (attempts < maxAttempts) {
                try {
                    const found = options.intent 
                        ? await weaveFind(session, { intent: options.intent })
                        : await DOM.querySelector({ selector: options.selector!, nodeId: (await DOM.getDocument()).root.nodeId });
                    
                    if (found && ('nodeId' in found || 'backendNodeId' in found || (found.found && (found.element?.backendNodeId || found.element?.id)))) {
                        return resolve();
                    }
                } catch (err) {
                    // Ignore errors from querySelector if element not found yet
                }
                attempts++;
                await new Promise(r => setTimeout(r, interval));
            }
            reject(new Error(`Element not found`));
        }));
        return { condition_met: true, waited_ms: Date.now() - start, trigger: `element: ${options.selector || options.intent}` };

    default:
      throw new Error(`Unsupported wait condition: ${options.condition}`);
  }
}
