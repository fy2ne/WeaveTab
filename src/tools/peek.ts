import CDP from "chrome-remote-interface";
import type { Config } from "../config/loader.js";

export interface PeekOptions {
  x: number;
  y: number;
  width?: number; // default 300
  height?: number; // default 300
  element_id?: string;
}

export async function weave_peek(session: CDP.Client, options: PeekOptions, config: Config): Promise<any> {
  if (!config.peek) {
    throw new Error("weave_peek is disabled. Add peek: true to ~/.weavetab/config.json");
  }

  const { x, y, width = 300, height = 300, element_id } = options;

  let clipX = x;
  let clipY = y;
  let clipW = width;
  let clipH = height;

  if (element_id) {
    // If an element_id is provided, you'd look it up from the action map to get its coordinates.
    // For this simulation, we assume it's roughly centered around the provided x,y.
    clipX = Math.max(0, x - clipW / 2);
    clipY = Math.max(0, y - clipH / 2);
  }

  const res = await session.Page.captureScreenshot({
    format: "webp",
    quality: 60,
    clip: {
      x: clipX,
      y: clipY,
      width: clipW,
      height: clipH,
      scale: 1
    }
  });

  return {
    image: `data:image/webp;base64,${res.data}`,
    estimated_token_cost: Math.ceil((clipW * clipH) / 1000), // very rough token heuristic
    element_id: element_id
  };
}
