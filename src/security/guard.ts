import CDP from "chrome-remote-interface";

export function assertNotRoot(): void {
  // process.getuid is Unix-only; on Windows it doesn't exist which is fine
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    process.stderr.write(
      "✗ Weave failed: Running as root is not allowed. Start WeaveTab as a normal user.\n"
    );
    process.exit(1);
  }
}

const STORAGE_BLOCK_SCRIPT = `
(function() {
  function blocked(name) {
    return new Proxy({}, {
      get(_, prop) {
        if (prop === 'getItem' || prop === 'setItem' || prop === 'removeItem' || prop === 'clear') {
          return function() { return null; };
        }
        if (prop === 'length') return 0;
        return undefined;
      }
    });
  }
  Object.defineProperty(document, 'cookie', {
    get: function() { return ''; },
    set: function() {},
    configurable: false
  });
  Object.defineProperty(window, 'localStorage', {
    get: function() { return blocked('localStorage'); },
    configurable: false
  });
  Object.defineProperty(window, 'sessionStorage', {
    get: function() { return blocked('sessionStorage'); },
    configurable: false
  });
})();
`;

export async function blockStorageAccess(session: CDP.Client): Promise<void> {
  await session.Page.addScriptToEvaluateOnNewDocument({
    source: STORAGE_BLOCK_SCRIPT,
  });

  // Also apply immediately to the current page context
  await session.Runtime.evaluate({
    expression: STORAGE_BLOCK_SCRIPT,
    returnByValue: false,
  });
}
