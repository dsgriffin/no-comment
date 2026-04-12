import { PageState } from "./interfaces";

const setActionState = async (tabId: number): Promise<void> => {
  if (tabId < 0) {
    return;
  }

  try {
    const response = (await chrome.tabs.sendMessage(tabId, {
      type: "evaluatePage",
    })) as PageState;

    if (response?.isBlocking) {
      await chrome.action.setTitle({
        tabId,
        title: `NoComment is hiding ${response.commentsLength} comment section(s) on this page.`,
      });
      return;
    }

    if (response?.blockableContent) {
      await chrome.action.setTitle({
        tabId,
        title: `NoComment found ${response.commentsLength} comment section(s), but your current rules are not blocking this page.`,
      });
      return;
    }
  } catch {
    // Ignore tabs without a content-script context.
  }

  await chrome.action.setTitle({
    tabId,
    title: "NoComment is available on this page.",
  });
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setTitle({
    title: "NoComment is available on this page.",
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.action.setTitle({
    title: "NoComment is available on this page.",
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    void setActionState(tabId);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await setActionState(tabId);
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "pageStateChanged" || sender.tab?.id === undefined) {
    return false;
  }

  const tabId = sender.tab.id;
  const pageState = message.state as PageState;

  if (pageState?.isBlocking) {
    void chrome.action.setTitle({
      tabId,
      title: `NoComment is hiding ${pageState.commentsLength} comment section(s) on this page.`,
    });
  } else if (pageState?.blockableContent) {
    void chrome.action.setTitle({
      tabId,
      title: `NoComment found ${pageState.commentsLength} comment section(s), but this page is currently allowed.`,
    });
  } else {
    void chrome.action.setTitle({
      tabId,
      title: "NoComment is available on this page.",
    });
  }

  return false;
});
