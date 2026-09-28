import "server-only";
import { cache } from "react";

/** One consistent "now" per request, shared by every component on the page. */
export const requestNow = cache(() => Date.now());
