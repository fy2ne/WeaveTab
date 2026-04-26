import { getOrConnect } from "./src/cdp/connector.js";
import { weaveNavigate } from "./src/tools/navigate.js";
import { weaveRead } from "./src/tools/read.js";
import { weaveType } from "./src/tools/type.js";
import { weaveKey } from "./src/tools/key.js";
import { weaveClick } from "./src/tools/click.js";
import { setTimeout } from "timers/promises";

const config = {
  allow: ["*"],
  block: [],
  safeMode: false,
  rateLimitWindowMs: 60000,
  rateLimitMaxRequests: 100,
  screenshot: false
};

async function runTest() {
  console.log("1. Connecting to Chrome...");
  const { session } = await getOrConnect(config);

  console.log("2. Navigating to YouTube...");
  await weaveNavigate(session, "https://www.youtube.com", config);
  await setTimeout(3000);

  console.log("3. Reading page to find search box...");
  let actionMapStr, actionMap, searchBox, allNavElements: any[] = [];
  for (let i = 0; i < 5; i++) {
    actionMapStr = await weaveRead(session);
    actionMap = JSON.parse(actionMapStr);
    
    allNavElements = [...actionMap.elements.navigation, ...actionMap.elements.main_content, ...actionMap.elements.other];
    searchBox = allNavElements.find((e: any) => e.type === "SEARCH_BAR" && e.id.startsWith("inp"));
    if (i === 4) console.log(JSON.stringify(actionMap, null, 2));
    if (searchBox) break;
    console.log("Not found, waiting 1s...");
    await setTimeout(1000);
  }
  if (!searchBox) throw new Error("Search box not found");
  
  console.log(`4. Typing 'mrbeast' into ${searchBox.id} (${searchBox.label})...`);
  await weaveClick(session, searchBox.id, config);
  await setTimeout(500);
  await weaveType(session, searchBox.id, "mrbeast", true, config);
  await setTimeout(500);

  console.log("5. Clicking Search button instead of Enter...");
  let searchBtn = allNavElements.find((e: any) => e.type === "SEARCH_BAR" && e.label === "Search" && e.role === "button");
  if (searchBtn) {
    await weaveClick(session, searchBtn.id, config);
  } else {
    await weaveKey(session, "Enter", undefined, config);
  }
  await setTimeout(5000); // Wait longer for results

  console.log("6. Reading results page...");
  for (let i = 0; i < 5; i++) {
    actionMapStr = await weaveRead(session);
    actionMap = JSON.parse(actionMapStr);
    
    let allElements = [
      ...actionMap.elements.main_content, 
      ...actionMap.elements.other, 
      ...actionMap.elements.navigation
    ];
    
    if (allElements.length > 80) {
      break;
    }
    console.log("Waiting for results to load...");
    await setTimeout(2000);
  }
  
  // Wait, let's log main_content briefly
  console.log("Context summary:", {
    pageType: actionMap.page.type,
    lastAction: actionMap.last_action,
    mainElements: actionMap.elements.main_content.length
  });

  let allElements = [
    ...actionMap.elements.main_content, 
    ...actionMap.elements.other, 
    ...actionMap.elements.navigation
  ];

  let videoLink = allElements.find((e: any) => e.type === "VIDEO_RESULT" && e.label.toLowerCase().includes("mrbeast"));
  if (!videoLink) {
    videoLink = allElements.find((e: any) => e.type === "VIDEO_RESULT");
  }
  
  if (!videoLink) {
    console.log(allElements.map((e: any) => `${e.id}: [${e.type}] ${e.label}`).slice(0, 100));
    throw new Error("Video link not found");
  }

  console.log(`7. Clicking video: ${videoLink.id} (${videoLink.label}) (Type: ${videoLink.type})...`);
  await weaveClick(session, videoLink.id, config);
  
  console.log("8. Waiting for video to load and scrolling to comments...");
  await setTimeout(8000); // Video page is heavy
  await session.Runtime.evaluate({ expression: "window.scrollBy(0, 1000)" });
  await setTimeout(4000);

  console.log("9. Finding comment box...");
  actionMapStr = await weaveRead(session);
  actionMap = JSON.parse(actionMapStr);

  let commentElements = [
    ...actionMap.elements.main_content, 
    ...actionMap.elements.other, 
    ...actionMap.elements.navigation
  ];

  let commentBox = commentElements.find((e: any) => 
    e.id.startsWith("inp") || e.label.toLowerCase().includes("comment")
  );

  if (!commentBox) {
    console.log("Comment box not found, scrolling more...");
    await session.Runtime.evaluate({ expression: "window.scrollBy(0, 1000)" });
    await setTimeout(3000);
    actionMapStr = await weaveRead(session);
    actionMap = JSON.parse(actionMapStr);
    
    commentElements = [
      ...actionMap.elements.main_content, 
      ...actionMap.elements.other, 
      ...actionMap.elements.navigation
    ];

    commentBox = commentElements.find((e: any) => 
      e.id.startsWith("inp") || e.label.toLowerCase().includes("comment")
    );
  }

  if (!commentBox) throw new Error("Comment box not found");

  console.log(`10. Typing comment: Wow weavetab is actually good...`);
  await weaveClick(session, commentBox.id, config);
  await setTimeout(1000);
  await weaveType(session, commentBox.id, "Wow weavetab is actually good", false, config);
  await setTimeout(2000);

  console.log("✓ Live test passed successfully! Context Engine and Mouse movement works.");
  process.exit(0);
}

runTest().catch(e => {
  console.error(e);
  process.exit(1);
});
