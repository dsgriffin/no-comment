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
      await chrome.action.enable(tabId);
      await chrome.action.setTitle({
        tabId,
        title: `NoComment is hiding ${response.commentsLength} comment section(s) on this page.`,
      });
      return;
    }
  } catch {
    // Ignore tabs without a content-script context.
  }

  await chrome.action.disable(tabId);
  await chrome.action.setTitle({
    tabId,
    title: "NoComment is idle on this page.",
  });
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.disable();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.action.disable();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    chrome.action.disable(tabId);
    return;
  }

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
    void chrome.action.enable(tabId);
    void chrome.action.setTitle({
      tabId,
      title: `NoComment is hiding ${pageState.commentsLength} comment section(s) on this page.`,
    });
  } else {
    void chrome.action.disable(tabId);
    void chrome.action.setTitle({
      tabId,
      title: "NoComment is idle on this page.",
    });
  }

  return false;
});
