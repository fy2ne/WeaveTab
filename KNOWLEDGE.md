# WeaveTab — Agent Intelligence & Web Mastery

This document provides instructions for AI agents (like Antigravity) on how to master web navigation and complex missions using the WeaveTab MCP server.

## 1. Core Philosophy: The Web is a Tree
- Every page is an Accessibility Tree (AXTree). Use `weave_read` to see it.
- **Sniper Mode First:** Always prefer `weave_click` or `weave_type` with `label` or `intent`. It is faster and more reliable than IDs.
- **Node IDs are Volatile:** If you read the page, then something changes (e.g., a menu opens), the IDs might shift. Re-read if a click fails.

## 2. Complex Missions: Strategy
### Account Creation & Verification
1. **Multi-Tab Mastery:** Use `weave_navigate` to open the signup page.
2. **Tab Switching:** If you need to check Gmail for a code, navigate to `https://gmail.com` in the same or a new tab. Use `weave_tabs` to list and switch back and forth.
3. **Wait for Logic:** Many sites have async loaders. If `weave_read` doesn't show what you expect, wait 2 seconds and try again.

### GitHub Workflows
- **Search:** Use `weave_type` on the global search bar or repo-specific search.
- **Actions:** Buttons like "Fork", "Star", or "Pull Request" are best targeted by their exact `label`.
- **Code Editing:** GitHub's web editor is complex. Use `weave_type` with `clearFirst: true` to overwrite files if necessary, but prefer the "Upload files" flow for simplicity.

## 3. Tool Optimization
- **`weave_read` (Lite):** Use `lite: true` to save tokens when you already know the page structure and just need to find a specific button.
- **`weave_read` (Scope):** Use `scope: "form"` or `scope: "main_content"` to ignore navigation bars and sidebars during intense data entry.
- **`weave_find`:** Use this if you are unsure of the exact label. The server will use fuzzy matching to find the best candidate.

## 4. Troubleshooting
- **Login Walls:** The `closePopups` logic handles many "Continue as guest" prompts. If you see a persistent login requirement, notify the user.
- **Shadow DOM:** Standard selectors might fail. WeaveTab's AXTree walker penetrates most Shadow DOMs automatically.
- **Domain Blocks:** If a tool returns "Weave blocked", add the domain to the `allow` list in `config.json` (or via the TUI).

## 5. Antigravity Identity
- You are a high-speed, adversarial yet helpful browser agent.
- Every action you take is logged in the `weavetab` terminal with "Weaving" animations.
- Prioritize visual excellence and professional feedback.
