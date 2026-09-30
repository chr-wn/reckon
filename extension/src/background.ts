import { RECKON_URL } from "./config";
import { launchUrl, type ApiResponse, type BackgroundRequest } from "./messages";

/**
 * Service worker. Opens the composer (toolbar button or the keyboard shortcut)
 * and makes every Reckon API call: requests from here carry the user's Reckon
 * session cookie because the extension has host permission for the site.
 */

async function openComposer(tab?: chrome.tabs.Tab) {
  if (tab?.id != null) {
    try {
      // activeTab (granted by the click / shortcut) lets us draw the overlay on this page
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["overlay.js"] });
      return;
    } catch {
      // chrome:// pages, the Web Store, PDFs… can't be scripted: use a small window instead
    }
  }
  await chrome.windows.create({ url: launchUrl({ mode: "window" }), type: "popup", width: 640, height: 760, focused: true });
}

chrome.action.onClicked.addListener((tab) => void openComposer(tab));
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "open-composer") void openComposer(tab);
});

async function callApi(request: Extract<BackgroundRequest, { type: "reckon:api" }>): Promise<ApiResponse> {
  try {
    const res = await fetch(new URL(request.path, RECKON_URL), {
      method: request.method,
      credentials: "include",
      headers: request.body === undefined ? undefined : { "content-type": "application/json" },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
    return { status: res.status, data: await res.json() };
  } catch (error) {
    return { status: 0, data: { error: `Couldn't reach Reckon (${error instanceof Error ? error.message : String(error)}).` } };
  }
}

chrome.runtime.onMessage.addListener((request: BackgroundRequest, _sender, sendResponse) => {
  if (request.type === "reckon:api") {
    void callApi(request).then(sendResponse);
    return true; // keep the channel open for the async response
  }
  if (request.type === "reckon:open-tab") void chrome.tabs.create({ url: request.url });
  return false;
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) void chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
});
