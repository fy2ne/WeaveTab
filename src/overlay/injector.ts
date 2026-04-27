import CDP from "chrome-remote-interface";

const OVERLAY_CSS = `
  #weavetab-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 2147483647;
    isolation: isolate;
  }
  #weavetab-cursor {
    position: absolute;
    width: 24px;
    height: 24px;
    transform: translate(-50%, -50%);
    transition: left 0.4s cubic-bezier(0.25, 1, 0.5, 1), top 0.4s cubic-bezier(0.25, 1, 0.5, 1);
  }
  .weavetab-cursor-idle {
    filter: drop-shadow(0 0 6px #7C3AED);
    animation: weavetab-pulse 2s infinite ease-in-out;
  }
  .weavetab-cursor-clicking {
    filter: drop-shadow(0 0 12px #7C3AED);
    animation: weavetab-burst 0.15s ease-out forwards;
  }
  #weavetab-badge {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 8px;
    background: #1a1a2e;
    border: 1px solid #7C3AED;
    color: white;
    font-family: system-ui, sans-serif;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 9999px;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .weavetab-badge-visible {
    opacity: 1 !important;
  }
  @keyframes weavetab-pulse {
    0% { transform: translate(-50%, -50%) scale(1); }
    50% { transform: translate(-50%, -50%) scale(1.05); }
    100% { transform: translate(-50%, -50%) scale(1); }
  }
  @keyframes weavetab-burst {
    0% { transform: translate(-50%, -50%) scale(1); }
    50% { transform: translate(-50%, -50%) scale(1.4); }
    100% { transform: translate(-50%, -50%) scale(1); }
  }
  .weavetab-glow-ring {
    position: absolute;
    border: 2px solid #7C3AED;
    border-radius: 4px;
    box-shadow: 0 0 10px #7C3AED, inset 0 0 10px #7C3AED;
    pointer-events: none;
    z-index: 2147483646;
    transition: all 0.2s;
  }
  .weavetab-scan-line {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 2px;
    background: linear-gradient(90deg, transparent, #7C3AED, transparent);
    box-shadow: 0 0 8px #7C3AED;
    z-index: 2147483647;
    pointer-events: none;
    animation: weavetab-scan 0.6s ease-out forwards;
  }
  @keyframes weavetab-scan {
    0% { top: 0; opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { top: 100vh; opacity: 0; }
  }
`;

const SVG_CURSOR = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M5.5 3.5L18.5 10.5L12 12.5L10 19L5.5 3.5Z" fill="#7C3AED" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;

const OVERLAY_JS = `
  if (!document.getElementById('weavetab-overlay-style')) {
    const style = document.createElement('style');
    style.id = 'weavetab-overlay-style';
    style.textContent = \`${OVERLAY_CSS}\`;
    document.head.appendChild(style);
  }
  
  if (!document.getElementById('weavetab-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'weavetab-overlay';
    
    const cursor = document.createElement('div');
    cursor.id = 'weavetab-cursor';
    cursor.className = 'weavetab-cursor-idle';
    cursor.innerHTML = \`${SVG_CURSOR}\`;
    cursor.style.left = '50%';
    cursor.style.top = '50%';
    
    const badge = document.createElement('div');
    badge.id = 'weavetab-badge';
    badge.textContent = 'WeaveTab Ready';
    cursor.appendChild(badge);
    
    overlay.appendChild(cursor);
    document.body.appendChild(overlay);
    
    window.__weavetab = {
      moveCursor: (x, y, label) => {
        const c = document.getElementById('weavetab-cursor');
        const b = document.getElementById('weavetab-badge');
        if (c) {
          c.style.left = x + 'px';
          c.style.top = y + 'px';
        }
        if (b && label) {
          b.textContent = label;
          b.classList.add('weavetab-badge-visible');
        }
      },
      clickCursor: () => {
        const c = document.getElementById('weavetab-cursor');
        if (c) {
          c.classList.remove('weavetab-cursor-idle');
          c.classList.add('weavetab-cursor-clicking');
          setTimeout(() => {
            c.classList.remove('weavetab-cursor-clicking');
            c.classList.add('weavetab-cursor-idle');
          }, 150);
        }
      },
      hideBadge: () => {
        const b = document.getElementById('weavetab-badge');
        if (b) b.classList.remove('weavetab-badge-visible');
      },
      showScan: () => {
        const scan = document.createElement('div');
        scan.className = 'weavetab-scan-line';
        document.body.appendChild(scan);
        setTimeout(() => scan.remove(), 600);
      },
      showGlow: (x, y, w, h) => {
        let glow = document.getElementById('weavetab-glow');
        if (!glow) {
          glow = document.createElement('div');
          glow.id = 'weavetab-glow';
          glow.className = 'weavetab-glow-ring';
          document.body.appendChild(glow);
        }
        glow.style.left = x + 'px';
        glow.style.top = y + 'px';
        glow.style.width = w + 'px';
        glow.style.height = h + 'px';
        glow.style.opacity = '1';
      },
      hideGlow: () => {
        const glow = document.getElementById('weavetab-glow');
        if (glow) glow.style.opacity = '0';
      },
      setTypingText: (text) => {
        const b = document.getElementById('weavetab-badge');
        if (b) {
          b.textContent = text;
          b.classList.add('weavetab-badge-visible');
        }
      }
    };
  }
`;

export async function injectOverlay(session: CDP.Client): Promise<void> {
  try {
    await session.Runtime.evaluate({ expression: OVERLAY_JS });
  } catch (e) {
    // Ignore, page might be refreshing
  }
}

export async function attachOverlayListener(session: CDP.Client): Promise<void> {
  await injectOverlay(session);
  session.Page.on('frameNavigated', async (params: any) => {
    if (!params.frame.parentId) {
      setTimeout(() => injectOverlay(session), 500); // Small delay to let DOM reset
    }
  });
}
