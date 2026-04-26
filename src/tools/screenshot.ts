import CDP from "chrome-remote-interface";
import { logAction } from "../audit/logger.js";
import type { Config } from "../config/loader.js";

interface ScreenshotResult {
  data: string;
  format: "png";
}

export async function weaveScreenshot(
  session: CDP.Client,
  config: Config
): Promise<ScreenshotResult> {
  if (!config.screenshot) {
    throw new Error(
      '⊘ Weave blocked: screenshots disabled. Set screenshot: true in ~/.weavetab/config.json'
    );
  }

  process.stderr.write("⟳ Weaving: capturing screenshot\n");

  const response = await session.Page.captureScreenshot({ format: "png" });
  const data = response.data;
  const dimensions = "captured";

  logAction("weave_shot", "screenshot", dimensions);
  process.stderr.write(`✓ Weaved: screenshot ${dimensions}\n`);

  return { data, format: "png" };
}
