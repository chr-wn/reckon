import { prefillFromPage, toggleComposer } from "./overlay-core";

// Injected by the service worker on the toolbar button / keyboard shortcut.
toggleComposer(prefillFromPage());
