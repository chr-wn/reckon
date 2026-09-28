"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** Hidden input carrying the browser's time zone, so dates render in local time. */
export function TimezoneInput() {
  const tz = useSyncExternalStore(subscribe, getTz, () => "UTC");
  return <input type="hidden" name="timezone" value={tz} />;
}
