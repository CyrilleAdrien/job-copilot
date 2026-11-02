import { afterEach, describe, expect, it, vi } from "vitest";

import { dayStrip, fetchStats, focusedCount, periodBounds, periodLabel, sentBars, shiftPeriod, swipedDay } from "@/lib/dashboard";

// Un mercredi.
const anchor = new Date(2026, 10, 4, 15, 30);

describe("periodBounds", () => {
  it("gives the local start and the excluded end of each period", () => {
    expect(periodBounds("all", anchor)).toBeNull();
    expect(periodBounds("year", anchor)).toEqual({ from: new Date(2026, 0, 1), to: new Date(2027, 0, 1) });
    expect(periodBounds("month", anchor)).toEqual({ from: new Date(2026, 10, 1), to: new Date(2026, 11, 1) });
    expect(periodBounds("week", anchor)).toEqual({ from: new Date(2026, 10, 2), to: new Date(2026, 10, 9) });
    expect(periodBounds("day", anchor)).toEqual({ from: new Date(2026, 10, 4), to: new Date(2026, 10, 5) });
  });

  it("starts the week on Monday, even from a Sunday", () => {
    expect(periodBounds("week", new Date(2026, 10, 8))?.from).toEqual(new Date(2026, 10, 2));
  });
});

describe("shiftPeriod", () => {
  it("does not skip a short month from the 31st", () => {
    expect(shiftPeriod("month", new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 1));
  });

  it("moves by a whole week or day", () => {
    expect(shiftPeriod("week", anchor, -1).getDate()).toBe(28);
    expect(shiftPeriod("day", anchor, 1).getDate()).toBe(5);
  });
});

describe("periodLabel", () => {
  it("names the period", () => {
    expect(periodLabel("year", anchor)).toBe("2026");
    expect(periodLabel("month", anchor)).toBe("novembre 2026");
    expect(periodLabel("week", anchor)).toBe("2 nov – 8 nov");
    expect(periodLabel("day", anchor)).toBe("4 novembre 2026");
  });
});

describe("sentBars", () => {
  const dates = [new Date(2026, 10, 4, 9).toISOString(), new Date(2026, 10, 4, 9, 30).toISOString(), new Date(2026, 9, 1).toISOString()];
  const values = (bars: { value: number }[]) => bars.map((bar) => bar.value);

  it("uses months, days or hours according to the period", () => {
    expect(sentBars("year", anchor, dates)).toHaveLength(12);
    expect(values(sentBars("year", anchor, dates))[10]).toBe(2);
    expect(sentBars("month", anchor, dates)).toHaveLength(4);
    expect(sentBars("week", anchor, dates)).toHaveLength(7);
    expect(values(sentBars("week", anchor, dates))[2]).toBe(2);
    expect(values(sentBars("day", anchor, dates))[9]).toBe(2);
  });

  it("splits any month into four weeks, the last one running to its end", () => {
    const november = sentBars("month", anchor, dates, anchor);
    expect(november.map((bar) => bar.label)).toEqual(["1 – 7 nov", "8 – 14 nov", "15 – 21 nov", "22 – 30 nov"]);
    expect(values(november)).toEqual([2, 0, 0, 0]);
    const lateDate = [new Date(2026, 0, 31, 12).toISOString()];
    expect(values(sentBars("month", new Date(2026, 0, 10), lateDate))).toEqual([0, 0, 0, 1]);
  });

  it("marks the slice holding the present moment only", () => {
    const hours = sentBars("day", anchor, [], anchor);
    expect(hours.filter((bar) => bar.current).map((bar) => bar.label)).toEqual(["15h"]);
    expect(sentBars("week", anchor, [], anchor).findIndex((bar) => bar.current)).toBe(2);
    expect(sentBars("year", anchor, [], anchor).findIndex((bar) => bar.current)).toBe(10);
    expect(sentBars("day", new Date(2026, 9, 1), [], anchor).some((bar) => bar.current)).toBe(false);
  });

  it("shows the last twelve weeks without a period", () => {
    const bars = sentBars("all", anchor, dates, anchor);
    expect(bars).toHaveLength(12);
    expect(bars[11].value).toBe(2);
    expect(bars[11].detail).toBe("Semaine du 2 nov");
    expect(bars.reduce((sum, bar) => sum + bar.value, 0)).toBe(3);
  });
});

describe("day navigation", () => {
  it("shows the time on today only", () => {
    expect(periodLabel("day", anchor, anchor)).toMatch(/^4 novembre 2026 · 15:30$/);
    expect(periodLabel("day", new Date(2026, 10, 3), anchor)).toBe("3 novembre 2026");
  });

  it("lists seven days around the chosen one and flags today and later days", () => {
    const strip = dayStrip(anchor, anchor);
    expect(strip).toHaveLength(7);
    expect(strip[3]).toMatchObject({ selected: true, today: true, future: false });
    expect(strip[4].future).toBe(true);
    expect(strip[0].future).toBe(false);
  });

  it("swipes to the next or previous day, never past today", () => {
    const yesterday = new Date(2026, 10, 3, 12);
    expect(swipedDay(yesterday, -80, 40, anchor)?.getDate()).toBe(4);
    expect(swipedDay(yesterday, 80, 40, anchor)?.getDate()).toBe(2);
    expect(swipedDay(yesterday, 10, 40, anchor)).toBeNull();
    expect(swipedDay(anchor, -80, 40, anchor)).toBeNull();
  });
});

describe("focusedCount", () => {
  const counts = { draft: 1, sent: 2, followed_up: 0, technical_test: 1, interview: 3, offer: 1, rejected: 0, withdrawn: 0 };

  it("adds the statuses, or keeps only the chosen one", () => {
    expect(focusedCount(counts, ["technical_test", "interview", "offer"], null)).toBe(5);
    expect(focusedCount(counts, ["technical_test", "interview", "offer"], "interview")).toBe(3);
    expect(focusedCount(counts, ["offer"], "sent")).toBe(0);
  });
});

describe("fetchStats", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends only the filters in use", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await fetchStats();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/applications/stats", expect.anything());
    await fetchStats({ from: new Date("2026-11-01T00:00:00Z"), status: "offer" });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/applications/stats?date_from=2026-11-01T00%3A00%3A00.000Z&status=offer", expect.anything());
  });
});
