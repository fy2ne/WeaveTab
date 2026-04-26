import CDP from "chrome-remote-interface";
import { weaveNavigate } from "./navigate.js";
import { weaveFind } from "./find.js";
import { weaveClick } from "./click.js";
import { weaveRead } from "./read.js";
import { Config } from "../config/loader.js";

// A small end-to-end demonstration: YouTube MrBeast search, first video, set 144p quality if possible
export async function youtubeDemo(session: CDP.Client, config: Config) {
  // 1) Navigate to MrBeast search results on YouTube
  await weaveNavigate(session, "https://www.youtube.com/results?search_query=MrBeast", config);

  // 2) Pick the first video result
  const firstVideo = await weaveFind(session, "video result");
  if (!firstVideo.found || !firstVideo.element) {
    throw new Error("Could not locate first video result on YouTube search results");
  }
  await weaveClick(session, firstVideo.element.id, config);

  // 3) Ensure we are on the video page
  await weaveRead(session);

  // 4) Try to open quality settings (Settings button)
  const settings = await weaveFind(session, "settings button");
  if (settings.found && settings.element) {
    await weaveClick(session, settings.element.id, config);
  }

  // 5) Try to select 144p quality if available
  const quality144 = await weaveFind(session, "144p");
  if (quality144.found && quality144.element) {
    await weaveClick(session, quality144.element.id, config);
  }

  return { ok: true };
}
