import { CommentDisplayMode, UserSettings } from "./interfaces";

type ListType = "allowlist" | "blocklist";

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

const state: UserSettings = { ...DEFAULT_SETTINGS };
const selectedRows: Record<ListType, number | null> = {
  allowlist: null,
  blocklist: null,
};

const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-tab-target]"));
const tabPanels = Array.from(document.querySelectorAll<HTMLElement>("[data-tab-panel]"));

const blockByDefaultInput = document.getElementById("blockByDefault") as HTMLInputElement;
const blockByListInput = document.getElementById("blockByList") as HTMLInputElement;
const visualDisplay = document.getElementById("visualDisplay") as HTMLSelectElement;

const generalNotice = document.getElementById("generalNotice");
const allowNotice = document.getElementById("allowNotice");
const blockNotice = document.getElementById("blockNotice");
const modeSummaryTitle = document.getElementById("modeSummaryTitle");
const modeSummaryBody = document.getElementById("modeSummaryBody");
const listModeHint = document.getElementById("listModeHint");
const saveHints: Record<ListType, HTMLElement | null> = {
  allowlist: document.getElementById("allowlistSaveHint"),
  blocklist: document.getElementById("blocklistSaveHint"),
};
const isListDirty: Record<ListType, boolean> = {
  allowlist: false,
  blocklist: false,
};

const tableBodies: Record<ListType, HTMLTableSectionElement> = {
  allowlist: document.querySelector("#allowlistTable tbody") as HTMLTableSectionElement,
  blocklist: document.querySelector("#blocklistTable tbody") as HTMLTableSectionElement,
};
const listInputs: Record<ListType, HTMLInputElement> = {
  allowlist: document.getElementById("allowlistInput") as HTMLInputElement,
  blocklist: document.getElementById("blocklistInput") as HTMLInputElement,
};

const normalizeEntry = (value: string): string => value.trim().replace(/\s+/g, "");

const showNotice = (element: HTMLElement | null, message: string): void => {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.hidden = false;

  window.setTimeout(() => {
    element.hidden = true;
  }, 3000);
};

const syncDirtyState = (listType: ListType): void => {
  const saveHint = saveHints[listType];

  if (saveHint) {
    saveHint.hidden = !isListDirty[listType];
  }
};

const setActiveTab = async (tabName: string): Promise<void> => {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tabTarget === tabName;
    button.dataset.active = String(isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  tabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel !== tabName;
  });

  await chrome.storage.local.set({ currentTab: tabName });
};

const renderList = (listType: ListType): void => {
  const tbody = tableBodies[listType];
  const values = state[listType];

  tbody.innerHTML = "";

  if (selectedRows[listType] !== null && selectedRows[listType]! >= values.length) {
    selectedRows[listType] = null;
  }

  values.forEach((value, index) => {
    const row = document.createElement("tr");
    row.dataset.index = String(index);
    row.dataset.selected = String(selectedRows[listType] === index);

    const valueCell = document.createElement("td");
    valueCell.textContent = value;

    const actionCell = document.createElement("td");
    actionCell.className = "rowActions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.dataset.action = "edit";
    editButton.dataset.listType = listType;
    editButton.dataset.index = String(index);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.listType = listType;
    deleteButton.dataset.index = String(index);

    actionCell.append(editButton, deleteButton);
    row.append(valueCell, actionCell);

    row.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("button")) {
        return;
      }

      selectedRows[listType] = selectedRows[listType] === index ? null : index;
      renderList(listType);
    });

    tbody.append(row);
  });

  if (values.length === 0) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 2;
    emptyCell.className = "emptyState";
    emptyCell.textContent = "No patterns saved yet.";
    emptyRow.append(emptyCell);
    tbody.append(emptyRow);
  }
};

const syncGeneralForm = (): void => {
  blockByDefaultInput.checked = state.blockAllComments;
  blockByListInput.checked = !state.blockAllComments;
  visualDisplay.value = state.display;

  if (modeSummaryTitle && modeSummaryBody && listModeHint) {
    if (state.blockAllComments) {
      modeSummaryTitle.textContent = "Block everywhere except allowed pages";
      modeSummaryBody.textContent =
        "NoComment will hide comments by default. Anything in your Allow List becomes an exception.";
      listModeHint.textContent =
        "Allow List entries are active right now because you are using block-everywhere mode.";
    } else {
      modeSummaryTitle.textContent = "Block only listed sites";
      modeSummaryBody.textContent =
        "NoComment will leave comments visible unless a page matches your Block List.";
      listModeHint.textContent =
        "Block List entries are active right now because you are using block-only mode.";
    }
  }
};

const promptForEntry = (currentValue = ""): string | null => {
  const nextValue = window.prompt("Update the selected URL or pattern:", currentValue);

  if (nextValue === null) {
    return null;
  }

  const normalized = normalizeEntry(nextValue);
  return normalized || null;
};

const addListItem = (listType: ListType): void => {
  const nextValue = normalizeEntry(listInputs[listType].value);

  if (!nextValue) {
    return;
  }

  state[listType] = Array.from(new Set([...state[listType], nextValue]));
  listInputs[listType].value = "";
  isListDirty[listType] = true;
  syncDirtyState(listType);
  renderList(listType);
};

const editListItem = (listType: ListType, index: number): void => {
  const existingValue = state[listType][index];

  if (!existingValue) {
    return;
  }

  const nextValue = promptForEntry(existingValue);

  if (!nextValue) {
    return;
  }

  state[listType][index] = nextValue;
  state[listType] = Array.from(new Set(state[listType]));
  selectedRows[listType] = null;
  isListDirty[listType] = true;
  syncDirtyState(listType);
  renderList(listType);
};

const deleteListItem = (listType: ListType, index: number): void => {
  state[listType] = state[listType].filter((_, currentIndex) => currentIndex !== index);
  selectedRows[listType] = null;
  isListDirty[listType] = true;
  syncDirtyState(listType);
  renderList(listType);
};

const clearList = (listType: ListType): void => {
  if (state[listType].length === 0) {
    return;
  }

  const confirmed = window.confirm(`Remove every entry in the ${listType === "allowlist" ? "Allow List" : "Block List"}?`);

  if (!confirmed) {
    return;
  }

  state[listType] = [];
  selectedRows[listType] = null;
  isListDirty[listType] = true;
  syncDirtyState(listType);
  renderList(listType);
};

const saveList = async (listType: ListType): Promise<void> => {
  await chrome.storage.sync.set({ [listType]: state[listType] });
  isListDirty[listType] = false;
  syncDirtyState(listType);
  showNotice(listType === "allowlist" ? allowNotice : blockNotice, "Saved.");
};

const saveGeneralSettings = async (): Promise<void> => {
  state.blockAllComments = blockByDefaultInput.checked;
  state.display = visualDisplay.value as CommentDisplayMode;

  await chrome.storage.sync.set({
    blockAllComments: state.blockAllComments,
    display: state.display,
  });

  showNotice(generalNotice, "Saved.");
};

const loadSettings = async (): Promise<void> => {
  const stored = await chrome.storage.sync.get(STORAGE_DEFAULTS);

  state.blockAllComments = Boolean(stored.blockAllComments);
  state.display = stored.display === "hidden" ? "hidden" : "collapse";
  state.allowlist = Array.isArray(stored.allowlist) ? stored.allowlist.map(String) : [];
  state.blocklist = Array.isArray(stored.blocklist) ? stored.blocklist.map(String) : [];

  syncGeneralForm();
  renderList("allowlist");
  renderList("blocklist");
  syncDirtyState("allowlist");
  syncDirtyState("blocklist");

  const { currentTab = "general" } = await chrome.storage.local.get({ currentTab: "general" });
  await setActiveTab(String(currentTab));
};

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>("button[data-action]");

  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const listType = button.dataset.listType as ListType | undefined;
  const index = Number(button.dataset.index);

  if (action === "tab" && button.dataset.tabTarget) {
    void setActiveTab(button.dataset.tabTarget);
    return;
  }

  if (!listType) {
    return;
  }

  if (action === "add") {
    addListItem(listType);
  } else if (action === "edit") {
    editListItem(listType, Number.isNaN(index) ? selectedRows[listType] ?? -1 : index);
  } else if (action === "delete") {
    deleteListItem(listType, index);
  } else if (action === "clear") {
    clearList(listType);
  } else if (action === "save-list") {
    void saveList(listType);
  }
});

document.getElementById("saveSettings")?.addEventListener("click", () => {
  void saveGeneralSettings();
});

[blockByDefaultInput, blockByListInput].forEach((input) => {
  input.addEventListener("change", () => {
    state.blockAllComments = blockByDefaultInput.checked;
    syncGeneralForm();
  });
});

Object.entries(listInputs).forEach(([listType, input]) => {
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    addListItem(listType as ListType);
  });
});

window.addEventListener("beforeunload", (event) => {
  if (!isListDirty.allowlist && !isListDirty.blocklist) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});

void loadSettings();
