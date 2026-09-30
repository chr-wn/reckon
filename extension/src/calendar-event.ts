import { casual } from "chrono-node";
import type { ComposerInitial } from "@/components/composer/composer-form";
import { fmtDate, fmtDuration, naturalDurationUnit } from "@/lib/format";

/**
 * Google Calendar's DOM is obfuscated, but a few hooks have been stable for
 * years and are what maintained extensions (Clockify, calendarNotes, pangu.js…)
 * rely on. Checked against live Calendar (2026-09-30): both the event and the
 * task details bubbles are a `[role=dialog]` holding the title `#rAECCd`, with
 * the time right under it as separate pieces: "Sunday, September 27", "⋅",
 * "10:30 – 10:45am". Events also have `#xDetDlg` / `#xDetDlgWhen`; tasks don't.
 */

export interface CalendarEvent {
  title: string;
  /** the time as Calendar shows it */
  when: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
}

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** The details bubble (event or task) that's open, if any. */
export function openDetailsDialog(doc: Document): HTMLElement | null {
  const heading = doc.querySelector<HTMLElement>("#rAECCd");
  const dialog = heading?.closest<HTMLElement>("[role='dialog']") ?? doc.querySelector<HTMLElement>("#xDetDlg");
  return dialog && dialog.getClientRects().length > 0 ? dialog : null;
}

/** The event or task whose details bubble is open, if any. */
export function readOpenEvent(doc: Document, ref = new Date()): CalendarEvent | null {
  const dialog = openDetailsDialog(doc);
  if (!dialog) return null;
  const title = clean(dialog.querySelector("#rAECCd")?.textContent);
  const lines = dialog.innerText.split("\n").map(clean).filter(Boolean);
  const titleLine = lines.indexOf(title);
  // the time sits right under the title (possibly split over a few lines); later lines are "Completed: …", location…
  return parseCalendarEvent(title, lines.slice(titleLine + 1, titleLine + 4), ref);
}

/** The first date/time found reading the lines under the title, joined (Calendar may split them) or one at a time. */
export function parseCalendarEvent(title: string, whenLines: string[], ref: Date): CalendarEvent | null {
  if (!title) return null;
  for (const candidate of [whenLines.join(" "), ...whenLines]) {
    const [result] = casual.parse(candidate.replace(/[\u22c5\u00b7]/g, " "), ref);
    if (!result) continue;
    return {
      title,
      when: clean(result.text),
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

/** "How long will <event> take?", with the block's length as the best guess and its end as the plan. */
export function howLongForEvent(event: CalendarEvent): ComposerInitial {
  const details = `From Google Calendar: ${event.when}`;
  const minutes = event.end && !event.allDay ? (event.end.getTime() - event.start.getTime()) / 60000 : null;
  const planned = !event.allDay && event.end ? event.end : null;
  return {
    type: "duration",
    title: `How long will ${event.title} take?`,
    details,
    closesAt: planned?.getTime() ?? null,
    ...(minutes && minutes > 0 ? { guess: minutes, durationUnit: naturalDurationUnit(minutes) } : {}),
    focus: "guess",
  };
}
