import { loadConfig } from './dist/config/loader.js';
import { connectToChrome } from './dist/cdp/connector.js';
import { weaveNavigate } from './dist/tools/navigate.js';
import { weaveRead } from './dist/tools/read.js';

async function run() {
  const config = await loadConfig();
  const { session } = await connectToChrome(config);
  
  console.log("Navigating...");
  await weaveNavigate(session, 'https://www.youtube.com', config);
  
  // Wait a bit for page load and hydration
  await new Promise(r => setTimeout(r, 3000));
  
  console.log("Reading...");
  const { weaveRead } = await import('./dist/tools/read.js');
  const { weaveType } = await import('./dist/tools/type.js');
  const { weaveClick } = await import('./dist/tools/click.js');
  
  const mapStr = await weaveRead(session);
  const map = JSON.parse(mapStr);
  const searchBox = map.elements.find(e => e.role === 'combobox' || e.role === 'searchbox');
  const searchBtn = map.elements.find(e => e.role === 'button' && e.label === 'Search');
  
  if (searchBox && searchBtn) {
    console.log("Typing MrBeast into", searchBox.id);
    await weaveType(session, searchBox.id, 'MrBeast', false, config);
    
    console.log("Pressing Enter...");
    await session.Input.dispatchKeyEvent({ type: "keyDown", key: "Enter", text: "\r" });
    await session.Input.dispatchKeyEvent({ type: "keyUp", key: "Enter" });
    
    console.log("Waiting for results to load...");
    await new Promise(r => setTimeout(r, 6000));
    
    console.log("Reading search results...");
    const map2Str = await weaveRead(session);
    const map2 = JSON.parse(map2Str);
    
    const videos = map2.elements.filter(e => e.role === 'link' && e.label.length > 5 && !e.label.includes('subscribers'));
    console.log("Found", videos.length, "video links");
    if (videos.length > 0) {
      const firstVideo = videos[0];
      console.log("Clicking first video:", firstVideo.label);
      await weaveClick(session, firstVideo.id, config);
      await new Promise(r => setTimeout(r, 4000));
      console.log("Video playing!");
    }
  } else {
    console.log("Could not find searchbox or search btn.");
  }
  
  process.exit(0);
}

run().catch(console.error);
