import type { ComposerInitial } from "@/components/composer/composer-form";

/** composer page / content scripts → service worker */
export type BackgroundRequest =
  | { type: "reckon:api"; method: "GET" | "POST"; path: string; body?: unknown }
  | { type: "reckon:open-tab"; url: string };

export interface ApiResponse<T = unknown> {
  /** HTTP status, or 0 when Reckon couldn't be reached */
  status: number;
  data: T;
}

/** composer iframe → the page that embeds it (overlay mode) */
export type ComposerMessage = { reckon: "close" } | { reckon: "posted"; title: string; url: string; copied: boolean };

/** How the composer page was opened; lives in its URL hash. */
export interface Launch {
  mode: "overlay" | "window";
  prefill?: ComposerInitial;
}

export const launchUrl = (launch: Launch) => `${chrome.runtime.getURL("composer.html")}#${encodeURIComponent(JSON.stringify(launch))}`;

export function readLaunch(hash: string): Launch {
  return JSON.parse(decodeURIComponent(hash.replace(/^#/, ""))) as Launch;
}
