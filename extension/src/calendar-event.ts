import { casual } from "chrono-node";
import type { ComposerInitial } from "@/components/composer/composer-form";
import { fmtDate, fmtDuration } from "@/lib/format";

/**
 * Google Calendar's DOM is obfuscated, but a few hooks have been stable for
 * years and are what maintained extensions (Clockify, calendarNotes, pangu.js…)
 * rely on: the event-details bubble `#xDetDlg`, its title `#rAECCd`, and the
 * time line inside `#xDetDlgWhen`, e.g. "Tuesday, September 29⋅10:15 – 11:30am".
 */

export interface CalendarEvent {
  title: string;
  /** the time line as Calendar shows it */
  when: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
}

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** The event whose details bubble is open, if any. */
export function readOpenEvent(doc: Document, ref = new Date()): CalendarEvent | null {
  const dialog = doc.querySelector<HTMLElement>("#xDetDlg");
  if (!dialog || dialog.getClientRects().length === 0) return null;
  const title = clean(dialog.querySelector("#rAECCd, [id^='rAECCd'], [role='heading']")?.textContent);
  const whenRoot = dialog.querySelector<HTMLElement>("#xDetDlgWhen") ?? dialog;
  const lines = whenRoot.innerText.split("\n").map(clean).filter((line) => line && line !== title);
  return parseCalendarEvent(title, lines, ref);
}

/** First line that reads as a date or time range becomes the event's timing. */
export function parseCalendarEvent(title: string, whenLines: string[], ref: Date): CalendarEvent | null {
  if (!title) return null;
  for (const line of whenLines) {
    const [result] = casual.parse(line.replace(/[⋅·]/g, " "), ref);
    if (!result) continue;
    return {
      title,
      when: line,
      start: result.start.date(),
      end: result.end?.date() ?? null,
      allDay: !result.start.isCertain("hour"),
    };
  }
  return null;
}

/** "Will I finish <event> within <its length>?", resolving when the block ends. */
export function predictionForEvent(event: CalendarEvent, tz: string): ComposerInitial {
  const details = `From Google Calendar: ${event.when}`;
  if (event.allDay) {
    const day = event.end ?? event.start;
    return {
      title: `Will I finish ${event.title} by ${fmtDate(day, tz, "day")}?`,
      closesAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59).getTime(),
      details,
      focus: "forecast",
    };
  }
  if (!event.end || event.end.getTime() <= event.start.getTime()) {
    // a task or reminder: one time, no length
    return { title: `Will I finish ${event.title} by ${fmtDate(event.start, tz, "dateTime")}?`, closesAt: event.start.getTime(), details, focus: "forecast" };
  }
  const minutes = (event.end.getTime() - event.start.getTime()) / 60000;
  return { title: `Will I finish ${event.title} within ${fmtDuration(minutes)}?`, closesAt: event.end.getTime(), details, focus: "forecast" };
}
