import { describe, expect, it } from "vitest";
import { parseCalendarEvent, predictionForEvent } from "./calendar-event";

// Time lines as Google Calendar renders them (formats collected by Clockify's integration, plus ours).
const ref = new Date(2026, 8, 29, 9, 0);
const tz = "America/Los_Angeles";
const at = (line: string) => parseCalendarEvent("War & Conflict in Literature - Block 6", [line], ref)!;

describe("parseCalendarEvent", () => {
  it("reads a same-day timed block", () => {
    const e = at("Tuesday, September 29⋅10:15 – 11:30am");
    expect(e.allDay).toBe(false);
    expect(e.start).toEqual(new Date(2026, 8, 29, 10, 15));
    expect(e.end).toEqual(new Date(2026, 8, 29, 11, 30));
  });

  it("carries am/pm from the end time back to the start", () => {
    expect(at("Wednesday, April 26⋅2:00 – 3:00pm").start.getHours()).toBe(14);
    expect(at("Monday, January 1, 2024⋅5:00 – 6:00pm").end).toEqual(new Date(2024, 0, 1, 18, 0));
  });

  it("handles blocks that cross noon or midnight", () => {
    const noon = at("Wednesday, April 26⋅11:30am – 12:45pm");
    expect([noon.start.getHours(), noon.end!.getHours()]).toEqual([11, 12]);
    const late = at("April 25, 2023, 11:15pm – April 26, 2023, 6:45am");
    expect(late.end).toEqual(new Date(2023, 3, 26, 6, 45));
  });

  it("marks all-day events", () => {
    expect(at("Sunday, December 10").allDay).toBe(true);
    expect(at("Sunday, January 21, 2024").start.getFullYear()).toBe(2024);
  });

  it("skips lines that aren't a time (recurrence comes after)", () => {
    const e = parseCalendarEvent("Standup", ["Weekly on weekdays", "Tuesday, September 29⋅9:30 – 9:45am"], ref);
    expect(e?.when).toBe("Tuesday, September 29⋅9:30 – 9:45am");
    expect(parseCalendarEvent("Standup", ["Room 247"], ref)).toBeNull();
    expect(parseCalendarEvent("", ["Tuesday, September 29⋅9:30 – 9:45am"], ref)).toBeNull();
  });
});

describe("predictionForEvent", () => {
  it("asks whether the task fits the block and resolves when it ends", () => {
    const p = predictionForEvent(at("Tuesday, September 29⋅10:15 – 11:30am"), tz);
    expect(p.title).toBe("Will I finish War & Conflict in Literature - Block 6 within 1h 15m?");
    expect(p.closesAt).toBe(new Date(2026, 8, 29, 11, 30).getTime());
    expect(p.details).toBe("From Google Calendar: Tuesday, September 29⋅10:15 – 11:30am");
    expect(p.focus).toBe("forecast");
  });

  it("uses the day for all-day events, due at the end of it", () => {
    const p = predictionForEvent(at("Sunday, December 10"), tz);
    expect(p.title).toBe("Will I finish War & Conflict in Literature - Block 6 by Thu, Dec 10?");
    expect(p.closesAt).toBe(new Date(2026, 11, 10, 23, 59).getTime());
  });
});
