import * as os from "node:os";
import * as fs from "node:fs";

export function findBrowser(preferred?: string): { name: string; path: string } | null {
  const isWin = os.platform() === "win32";
  const isMac = os.platform() === "darwin";
  const isLinux = os.platform() === "linux";

  const browsers = [
    {
      name: "msedge",
      win: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      mac: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      linux: "/usr/bin/microsoft-edge"
    },
    {
      name: "google-chrome",
      win: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      mac: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      linux: "/usr/bin/google-chrome"
    },
    {
      name: "brave-browser",
      win: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
      mac: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      linux: "/usr/bin/brave-browser"
    },
    {
      name: "chromium",
      win: "",
      mac: "/Applications/Chromium.app/Contents/MacOS/Chromium",
      linux: "/usr/bin/chromium-browser"
    }
  ];

  if (preferred) {
    const found = browsers.find(b => b.name === preferred || b.name.includes(preferred.toLowerCase()));
    if (found) {
      const p = isWin ? found.win : isMac ? found.mac : found.linux;
      if (p && fs.existsSync(p)) return { name: found.name, path: p };
    }
  }

  for (const b of browsers) {
    const p = isWin ? b.win : isMac ? b.mac : b.linux;
    if (p && fs.existsSync(p)) {
      return { name: b.name, path: p };
    }
  }

  return null;
}
