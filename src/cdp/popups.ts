import CDP from "chrome-remote-interface";
import { logProfessional } from "../ui/cli.js";

/**
 * Automatically attempts to close common overlays, popups, and cookie banners.
 */
export async function closePopups(session: CDP.Client): Promise<void> {
  const popupCommonLabels = [
    "Close", "Dismiss", "Accept All", "Accept all", "I accept", "Got it", 
    "Maybe later", "Not now", "Skip", "Continue as guest", "Stay on current site",
    "Stay on this page", "Close dialog", "Hide"
  ];

  const script = `
    (() => {
      const labels = ${JSON.stringify(popupCommonLabels)};
      const buttons = Array.from(document.querySelectorAll('button, a, [role=\"button\"]'));
      
      for (const btn of buttons) {
        const text = btn.innerText || btn.getAttribute('aria-label') || '';
        if (labels.some(l => text.toLowerCase() === l.toLowerCase())) {
          btn.click();
          return true;
        }
      }
      return false;
    })()
  `;

  const { result } = await session.Runtime.evaluate({
    expression: script,
    returnByValue: true
  });

  if (result.value) {
    logProfessional("INFO", "Weaver", "✓ Weaved: Closed a popup/overlay.");
    await new Promise(r => setTimeout(r, 500)); // Wait for animation
  }
}
