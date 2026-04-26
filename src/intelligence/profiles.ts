import type { ActionElement } from "../cdp/walker.js";

export type SemanticType = string;

export interface SiteProfile {
  name: string;
  getPageType: (url: string) => string;
  classify: (element: Partial<ActionElement>, url: string) => SemanticType | null;
  extractMeta: (element: Partial<ActionElement>, type: SemanticType) => Record<string, string>;
}

const youtubeProfile: SiteProfile = {
  name: "youtube",
  getPageType: (url) => {
    const u = new URL(url);
    if (u.pathname === "/results") return "youtube_search_results";
    if (u.pathname === "/watch") return "youtube_video_page";
    if (u.pathname.startsWith("/@") || u.pathname.startsWith("/channel/")) return "youtube_channel_page";
    return "youtube_home";
  },
  classify: (element) => {
    const { href, role, label } = element;
    const lbl = (label || "").toLowerCase();
    
    if (role === "link" && href?.includes("/watch?v=")) return "VIDEO_RESULT";
    if (role === "link" && (href?.includes("/@") || href?.includes("/channel/"))) return "CHANNEL_RESULT";
    if (role === "searchbox" || element.id?.includes("search") || lbl.includes("search")) return "SEARCH_BAR";
    if (role === "link" && href?.includes("/shorts/")) return "SHORT_RESULT";
    if (role === "button" && lbl.includes("subscribe")) return "SUBSCRIBE_BUTTON";
    if (role === "button" && lbl.includes("like")) return "LIKE_BUTTON";
    // YouTube-specific: settings and quality controls
    if (role === "button" && lbl.includes("settings")) return "SETTINGS_BUTTON";
    if (role === "button" && (lbl.includes("144p") || lbl.includes("quality"))) return "QUALITY_144P_BUTTON";
    
    return null;
  },
  extractMeta: (element, type) => {
    if (type === "VIDEO_RESULT" && element.label) {
      // "I Spent 7 Days Buried Alive by MrBeast 21 million views 3 weeks ago 21 minutes"
      const parts = element.label.split(" by ");
      if (parts.length >= 2) {
        const title = parts[0];
        const rest = parts.slice(1).join(" by ");
        const words = rest.split(" ");
        const channel = words[0];
        return { title, channel, raw: element.label } as Record<string, string>;
      }
  }
  return {} as Record<string, string>;
  }
};

const githubProfile: SiteProfile = {
  name: "github",
  getPageType: (url) => {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (u.pathname === "/search") return "github_search";
    if (parts.length === 2) return "github_repo";
    if (parts.length > 2) {
      if (parts[2] === "fork") return "github_fork_page";
      if (parts[2] === "blob") return "github_file_view";
      if (parts[2] === "pulls") return "github_pull_requests";
      if (parts[2] === "issues") return "github_issues";
    }
    return "github_home";
  },
  classify: (element) => {
    const { href, role, label, type: elemType } = element; // elemType is HTML type if any
    const lbl = (label || "").toLowerCase();
    
    if (role === "button" && (lbl.includes("fork") || href?.includes("/fork"))) return "FORK_BUTTON";
    if (role === "button" && lbl.includes("star")) return "STAR_BUTTON";
    if (role === "button" && lbl.includes("watch")) return "WATCH_BUTTON";
    
    // Check for repo title heading somehow? We rely on hints or basic attributes here
    if (role === "heading" && lbl) return "REPO_TITLE"; 
    
    if (role === "link" && href?.includes("/blob/")) return "FILE_LINK";
    if (role === "link" && href?.includes("/tree/")) return "FOLDER_LINK";
    
    // We might extract `name` attribute in walker and pass it in meta or something, 
    // but for now we rely on id/label heuristics if name isn't there
    if (element.id?.includes("repository_name") || lbl.includes("repository name")) return "REPO_NAME_INPUT";
    if (element.id?.includes("repository_description") || lbl.includes("description")) return "REPO_DESCRIPTION_INPUT";
    
    if (role === "button" && lbl.includes("fork")) return "FORK_SUBMIT_BUTTON";
    
    return null;
  },
  extractMeta: () => ({})
};

const googleProfile: SiteProfile = {
  name: "google",
  getPageType: (url) => {
    const u = new URL(url);
    if (u.pathname === "/search") return "google_search_results";
    return "google_home";
  },
  classify: (element) => {
    if (element.role === "searchbox") return "SEARCH_BAR";
    if (element.role === "link" && element.href?.startsWith("http")) return "SEARCH_RESULT";
    return null;
  },
  extractMeta: (element, type) => {
    if (type === "SEARCH_RESULT") {
      return { title: element.label || "", destination: element.href || "" } as Record<string, string>;
    }
    return {} as Record<string, string>;
  }
};

const gmailProfile: SiteProfile = {
  name: "gmail",
  getPageType: (url) => {
    const u = new URL(url);
    if (u.hash.includes("inbox") || u.pathname.includes("/inbox")) return "gmail_inbox";
    if (u.hash.includes("sent")) return "gmail_sent";
    if (u.hash.includes("compose") || u.pathname.includes("/compose")) return "gmail_compose";
    return "gmail_home";
  },
  classify: (element) => {
    const { role, label } = element;
    const lbl = (label || "").toLowerCase();
    
    if (role === "button" && lbl.includes("compose")) return "COMPOSE_BUTTON";
    if (role === "row") return "EMAIL_ROW";
    if (role === "textbox" && lbl.includes("subject")) return "SUBJECT_INPUT";
    if (role === "textbox" && lbl.includes("to")) return "TO_INPUT";
    if (role === "textbox" && lbl.includes("body")) return "EMAIL_BODY";
    if (role === "button" && lbl.includes("send")) return "SEND_BUTTON";
    
    return null;
  },
  extractMeta: () => ({})
};

const genericProfile: SiteProfile = {
  name: "generic",
  getPageType: () => "generic_webpage",
  classify: (element) => {
    const { role, label, type } = element;
    const lbl = (label || "").toLowerCase();
    
    if (role === "searchbox" || type === "search" || lbl.includes("search")) return "SEARCH_BAR";
    if (role === "link" && element.group === "navigation") return "NAV_ITEM";
    if (role === "button" && (type === "submit" || lbl.includes("submit"))) return "SUBMIT_BUTTON";
    
    return "GENERIC_ELEMENT";
  },
  extractMeta: () => ({})
};

export function getProfile(hostname: string): SiteProfile {
  if (hostname.includes("youtube.com")) return youtubeProfile;
  if (hostname.includes("github.com")) return githubProfile;
  if (hostname.includes("google.com") && !hostname.includes("mail.")) return googleProfile;
  if (hostname.includes("mail.google.com")) return gmailProfile;
  return genericProfile;
}

export function classifyElement(element: Partial<ActionElement>, profile: SiteProfile, url: string): SemanticType {
  const type = profile.classify(element, url);
  if (type) return type;
  
  const fallback = genericProfile.classify(element, url);
  return fallback || "GENERIC_ELEMENT";
}

export function extractMeta(element: Partial<ActionElement>, type: SemanticType, profile: SiteProfile): Record<string, string> {
  return profile.extractMeta(element, type);
}
