import { PageState, UserSettings } from "./interfaces";

interface SiteSelectorRule {
  hostnames: readonly string[];
  selectors: readonly string[];
}

const SITE_SELECTOR_RULES: readonly SiteSelectorRule[] = [
  {
    hostnames: ["youtube.com", "www.youtube.com", "m.youtube.com"],
    selectors: ["ytd-comments#comments", "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-comments-section']"],
  },
  {
    hostnames: ["reddit.com", "www.reddit.com", "old.reddit.com"],
    selectors: ["shreddit-comment-tree", "faceplate-comment-tree", "[data-testid='post-comment-list']", ".commentarea"],
  },
  {
    hostnames: ["x.com", "twitter.com", "www.x.com", "www.twitter.com"],
    selectors: [
      "section[role='region'] [aria-label='Timeline: Conversation'] [data-testid='cellInnerDiv'] article[data-testid='tweet']",
    ],
  },
  {
    hostnames: ["facebook.com", "www.facebook.com", "m.facebook.com"],
    selectors: [
      "[aria-label^='Comment by']",
      "[role='dialog'] [aria-label^='Comment by']",
      "[data-pagelet^='FeedUnit'] [aria-label='Comments']",
      "[aria-label='Leave a comment']",
    ],
  },
  {
    hostnames: ["instagram.com", "www.instagram.com"],
    selectors: ["main article ul", "main article section ul"],
  },
  {
    hostnames: ["news.ycombinator.com"],
    selectors: ["tr.athing + tr .comment-tree", "tr.comtr"],
  },
  {
    hostnames: ["tiktok.com", "www.tiktok.com"],
    selectors: ["[data-e2e='comment-list']", "[class*='DivCommentListContainer']"],
  },
];

const GENERIC_COMMENT_SELECTORS: readonly string[] = [
  "#disqus_thread",
  "[data-testid='comments-container']",
  "[data-testid='comment-list']",
  "[data-testid='comment']",
  "[id='comments']",
  "[id='commentform']",
  "[id^='comments-']",
  "[class~='comments']",
  "[class~='comment-list']",
  "[class~='commentlist']",
  "[class~='comment-thread']",
  "[class~='comments-area']",
  "[class~='comments-wrap']",
  "[class~='disqus-thread']",
  "[aria-label='Comments']",
];

const HIDDEN_FLAG = "data-nocomment-hidden";
const ORIGINAL_DISPLAY = "data-nocomment-original-display";
const ORIGINAL_VISIBILITY = "data-nocomment-original-visibility";
const DEFAULT_SETTINGS: UserSettings = {
  blockAllComments: false,
  display: "collapse",
  allowlist: [],
  blocklist: [],
};
const STORAGE_DEFAULTS = {
  blockAllComments: false,
  display: "collapse",
  allowlist: [] as string[],
  blocklist: [] as string[],
};

let currentSettings: UserSettings = { ...DEFAULT_SETTINGS };
let currentState: PageState = {
  blockableContent: false,
  commentsLength: 0,
  isBlocking: false,
};
let observer: MutationObserver | null = null;
let mutationFrame = 0;
let blockingActive = false;

const getStorage = async (): Promise<UserSettings> => {
  const stored = await chrome.storage.sync.get(STORAGE_DEFAULTS);

  return {
    blockAllComments: Boolean(stored.blockAllComments),
    display: stored.display === "hidden" ? "hidden" : "collapse",
    allowlist: Array.isArray(stored.allowlist) ? stored.allowlist.map(String) : [],
    blocklist: Array.isArray(stored.blocklist) ? stored.blocklist.map(String) : [],
  };
};

const escapeRegex = (value: string): string => value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");

const normalizePattern = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return /^[a-z*]+:\/\//i.test(trimmed) ? trimmed : `*://${trimmed}`;
};

const patternToRegex = (pattern: string): RegExp | null => {
  const normalized = normalizePattern(pattern);

  if (!normalized) {
    return null;
  }

  const escaped = escapeRegex(normalized).replace(/\*/g, ".*");

  return new RegExp(`^${escaped}/?$`, "i");
};

const getComparableUrl = (): string => `${window.location.protocol}//${window.location.host}${window.location.pathname}`;

const matchesRule = (rules: string[]): boolean => {
  const currentUrl = getComparableUrl();

  return rules.some((rule) => {
    const regex = patternToRegex(rule);
    return regex ? regex.test(currentUrl) : false;
  });
};

const hostnameMatches = (hostname: string, allowedHostnames: readonly string[]): boolean =>
  allowedHostnames.some(
    (allowedHostname) => hostname === allowedHostname || hostname.endsWith(`.${allowedHostname}`),
  );

const getActiveSelectors = (): readonly string[] => {
  const hostname = window.location.hostname.toLowerCase();
  const matchedRules = SITE_SELECTOR_RULES.filter((rule) => hostnameMatches(hostname, rule.hostnames));

  if (matchedRules.length > 0) {
    return matchedRules.flatMap((rule) => rule.selectors);
  }

  return GENERIC_COMMENT_SELECTORS;
};

const isVisibleNode = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
};

const dedupeNestedElements = (elements: HTMLElement[]): HTMLElement[] =>
  elements.filter((element) => !elements.some((candidate) => candidate !== element && candidate.contains(element)));

const filterSiteSpecificMatches = (elements: HTMLElement[]): HTMLElement[] => {
  const hostname = window.location.hostname.toLowerCase();
  const path = window.location.pathname;

  if (
    (hostname === "x.com" || hostname === "www.x.com" || hostname === "twitter.com" || hostname === "www.twitter.com") &&
    /\/status\//.test(path)
  ) {
    const tweetArticles = elements.filter((element) => element.matches("article[data-testid='tweet']"));

    if (tweetArticles.length > 0) {
      const rootTweet = tweetArticles[0];
      return elements.filter((element) => element !== rootTweet);
    }
  }

  return elements;
};

const getCommentElements = (includeHidden = false): HTMLElement[] => {
  const selectors = getActiveSelectors();
  const matches = selectors.flatMap((selector) =>
    Array.from(document.querySelectorAll(selector)).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    ),
  );

  const uniqueMatches = Array.from(new Set(matches));
  const dedupedMatches = filterSiteSpecificMatches(dedupeNestedElements(uniqueMatches));

  return includeHidden ? dedupedMatches : dedupedMatches.filter(isVisibleNode);
};

const hideElement = (element: HTMLElement): void => {
  if (!element.hasAttribute(HIDDEN_FLAG)) {
    element.setAttribute(HIDDEN_FLAG, "true");
    element.setAttribute(ORIGINAL_DISPLAY, element.style.display);
    element.setAttribute(ORIGINAL_VISIBILITY, element.style.visibility);
  }

  element.setAttribute("aria-hidden", "true");

  if (currentSettings.display === "hidden") {
    element.style.visibility = "hidden";
  } else {
    element.style.display = "none";
  }
};

const restoreHiddenElements = (): void => {
  const elements = document.querySelectorAll<HTMLElement>(`[${HIDDEN_FLAG}="true"]`);

  elements.forEach((element) => {
    element.style.display = element.getAttribute(ORIGINAL_DISPLAY) ?? "";
    element.style.visibility = element.getAttribute(ORIGINAL_VISIBILITY) ?? "";
    element.removeAttribute(HIDDEN_FLAG);
    element.removeAttribute(ORIGINAL_DISPLAY);
    element.removeAttribute(ORIGINAL_VISIBILITY);
    element.removeAttribute("aria-hidden");
  });
};

const updateObserver = (shouldObserve: boolean): void => {
  if (shouldObserve && !observer) {
    observer = new MutationObserver(() => {
      if (!blockingActive || mutationFrame !== 0) {
        return;
      }

      mutationFrame = window.requestAnimationFrame(() => {
        mutationFrame = 0;
        void applySettings();
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "id"],
      childList: true,
      subtree: true,
    });
  }

  if (!shouldObserve && observer) {
    observer.disconnect();
    observer = null;
  }
};

const notifyPageState = (): void => {
  void chrome.runtime.sendMessage({
    type: "pageStateChanged",
    state: currentState,
  });
};

const applySettings = async (resetExisting = false): Promise<PageState> => {
  if (resetExisting) {
    restoreHiddenElements();
  }

  const comments = getCommentElements();
  const allMatchedComments = getCommentElements(true);
  const shouldBlock = currentSettings.blockAllComments
    ? !matchesRule(currentSettings.allowlist)
    : matchesRule(currentSettings.blocklist);
  blockingActive = shouldBlock;

  if (shouldBlock) {
    comments.forEach(hideElement);
  }

  currentState = {
    blockableContent: allMatchedComments.length > 0,
    commentsLength: allMatchedComments.length,
    isBlocking: shouldBlock && allMatchedComments.length > 0,
  };

  updateObserver(shouldBlock);
  notifyPageState();

  return currentState;
};

const refreshSettings = async (): Promise<PageState> => {
  currentSettings = await getStorage();
  return applySettings(true);
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "evaluatePage") {
    return false;
  }

  void refreshSettings().then(sendResponse);
  return true;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  if (
    changes.blockAllComments ||
    changes.display ||
    changes.allowlist ||
    changes.blocklist
  ) {
    void refreshSettings();
  }
});

void refreshSettings();
