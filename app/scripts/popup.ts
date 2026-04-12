import { PageState } from "./interfaces";

const statusHeading = document.getElementById("statusHeading");
const statusBody = document.getElementById("statusBody");
const pageDetails = document.getElementById("pageDetails");
const optionsButton = document.getElementById("options");

const setStatus = (title: string, description: string, details = ""): void => {
  if (statusHeading) {
    statusHeading.textContent = title;
  }

  if (statusBody) {
    statusBody.textContent = description;
  }

  if (pageDetails) {
    pageDetails.textContent = details;
  }
};

const loadPopupState = async (): Promise<void> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    setStatus("No active tab", "Open a webpage to see whether NoComment is active.");
    return;
  }

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: "evaluatePage",
    })) as PageState;

    if (!response.blockableContent) {
      setStatus(
        "No comment sections found",
        "This page does not currently expose any comment containers matched by NoComment.",
      );
      return;
    }

    if (response.isBlocking) {
      setStatus(
        "Comments hidden",
        "NoComment is actively hiding comments on this page.",
        `${response.commentsLength} matched section(s) detected.`,
      );
      return;
    }

    setStatus(
      "Comments visible",
      "Comment sections were detected, but your current allow/block rules leave this page unchanged.",
      `${response.commentsLength} matched section(s) detected.`,
    );
  } catch {
    setStatus(
      "Unavailable on this page",
      "Chrome does not allow extensions to inspect this tab, or the content script is not available here.",
    );
  }
};

optionsButton?.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

void loadPopupState();
