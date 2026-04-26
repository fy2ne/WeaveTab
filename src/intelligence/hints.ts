import type { ActionElement } from "../cdp/walker.js";

type GroupedElements = {
  navigation: ActionElement[];
  main_content: ActionElement[];
  sidebar: ActionElement[];
  form: ActionElement[];
  modal: ActionElement[];
  utility: ActionElement[];
};

export function generateHints(pageType: string, elements: GroupedElements): string[] {
  const hints: string[] = [];

  switch (pageType) {
    case "youtube_search_results":
      hints.push(
        "main_content contains VIDEO_RESULT and CHANNEL_RESULT elements.",
        "VIDEO_RESULT elements have href starting with /watch?v= — these are videos.",
        "CHANNEL_RESULT elements have href starting with /@ — these are channel pages.",
        "To open a video, call weave_click on a VIDEO_RESULT id."
      );
      break;

    case "github_repo":
      hints.push(
        "This is a GitHub repository page.",
        "To fork: call weave_click on the FORK_BUTTON element.",
        "After forking you will land on a github_fork_page with REPO_NAME_INPUT and REPO_DESCRIPTION_INPUT."
      );
      break;

    case "github_fork_page":
      hints.push(
        "You are on the fork creation form.",
        "Edit the repo name with weave_click then weave_type on REPO_NAME_INPUT.",
        "Edit description with weave_click then weave_type on REPO_DESCRIPTION_INPUT.",
        "Submit with weave_click on FORK_SUBMIT_BUTTON."
      );
      break;

    case "google_search_results":
      hints.push(
        "This is a Google search results page.",
        "Use SEARCH_RESULT elements in main_content to navigate to destinations."
      );
      break;

    case "gmail_inbox":
      hints.push(
        "You are in the Gmail inbox.",
        "Use COMPOSE_BUTTON to write a new email.",
        "Click on an EMAIL_ROW to read a specific email."
      );
      break;

    default:
      hints.push(
        "Generic page detected. Elements grouped by position.",
        "Use main_content for primary page actions."
      );
      break;
  }

  return hints;
}
