import { RECKON_URL } from "./config";
import type { ApiResponse, BackgroundRequest } from "./messages";

const shortcut = document.getElementById("shortcut")!;
void chrome.commands.getAll().then((commands) => {
  const key = commands.find((c) => c.name === "open-composer")?.shortcut;
  shortcut.textContent = key || "not set";
});
document.getElementById("change")!.addEventListener("click", () => void chrome.tabs.create({ url: "chrome://extensions/shortcuts" }));

const account = document.getElementById("account")!;
void chrome.runtime
  .sendMessage<BackgroundRequest, ApiResponse<{ user?: { displayName: string } }>>({ type: "reckon:api", method: "GET", path: "/api/me" })
  .then(({ status, data }) => {
    if (status === 200 && data.user) {
      account.textContent = `Signed in to Reckon as ${data.user.displayName}. You're all set.`;
      return;
    }
    account.textContent = "Sign in to Reckon in this browser so the extension can post for you: ";
    const link = document.createElement("a");
    link.href = `${RECKON_URL}/login`;
    link.textContent = "sign in";
    link.className = "font-medium text-accent-ink underline underline-offset-2";
    account.append(link);
  });
