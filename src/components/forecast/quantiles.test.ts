import { describe, expect, it } from "vitest";
import { fmtValue } from "@/lib/format";
import { fromDateTimeLocal, parseDraft, toDateTimeLocal, toDraft } from "./quantiles";

describe("date quantiles with a time of day", () => {
  it("parses datetime-local drafts to exact times", () => {
    const { quantiles } = parseDraft("date", { low: "2026-10-03T09:00", median: "2026-10-03T14:30", high: "2026-10-04T08:15" }, "minutes", true);
    expect(quantiles).toEqual({
      low: new Date(2026, 9, 3, 9, 0).getTime(),
      median: new Date(2026, 9, 3, 14, 30).getTime(),
      high: new Date(2026, 9, 4, 8, 15).getTime(),
    });
  });

  it("reads wall-clock times in a given zone, across DST", () => {
    expect(fromDateTimeLocal("2026-10-03T14:30", "America/Los_Angeles")).toBe(Date.UTC(2026, 9, 3, 21, 30));
    expect(fromDateTimeLocal("2026-10-03T14:30", "Asia/Kolkata")).toBe(Date.UTC(2026, 9, 3, 9, 0));
    expect(fromDateTimeLocal("2026-11-01T01:30", "America/New_York")).toBe(Date.UTC(2026, 10, 1, 5, 30)); // first 1:30, still EDT
    expect(fromDateTimeLocal("2026-03-08T12:00", "America/New_York")).toBe(Date.UTC(2026, 2, 8, 16, 0)); // after spring-forward
    for (const tz of ["America/Los_Angeles", "Europe/London", "Asia/Tokyo"]) {
      const ms = Date.UTC(2026, 6, 15, 18, 45);
      expect(fromDateTimeLocal(toDateTimeLocal(ms, tz), tz)).toBe(ms);
    }
  });

  it("round-trips through a draft in a given time zone", () => {
    const ms = Date.UTC(2026, 9, 3, 21, 30); // 2:30pm in Los Angeles
    expect(toDateTimeLocal(ms, "America/Los_Angeles")).toBe("2026-10-03T14:30");
    expect(toDraft("date", { low: ms, median: ms, high: ms }, "minutes", "America/New_York", true).median).toBe("2026-10-03T17:30");
  });

  it("keeps day-only questions on local noon and day-only display", () => {
    const { quantiles } = parseDraft("date", { low: "2026-10-03", median: "2026-10-04", high: "2026-10-05" });
    expect(quantiles?.median).toBe(new Date(2026, 9, 4, 12, 0).getTime());
    expect(fmtValue({ type: "date" }, quantiles!.median, "America/Los_Angeles")).toMatch(/^Oct 4/);
    expect(fmtValue({ type: "date", unit: "datetime" }, new Date(2026, 9, 4, 14, 30).getTime(), Intl.DateTimeFormat().resolvedOptions().timeZone)).toMatch(/Oct 4.*2:30/);
  });
});
