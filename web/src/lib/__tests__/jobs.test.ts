import { describe, expect, it } from "vitest";

import { isFresh, pageItems, timeAgo } from "@/lib/jobs";

const now = new Date("2026-10-26T12:00:00Z");

describe("timeAgo", () => {
  it.each([
    ["2026-10-26T11:59:40Z", "à l'instant"],
    ["2026-10-26T11:35:00Z", "il y a 25 min"],
    ["2026-10-26T09:00:00Z", "il y a 3 h"],
    ["2026-10-25T08:00:00Z", "hier"],
    ["2026-10-22T08:00:00Z", "il y a 4 j"],
  ])("%s donne « %s »", (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected);
  });
});

describe("isFresh", () => {
  it("signale les offres de moins de 24 h", () => {
    expect(isFresh("2026-10-26T01:00:00Z", now)).toBe(true);
    expect(isFresh("2026-10-25T11:00:00Z", now)).toBe(false);
  });
});

describe("pageItems", () => {
  it("montre la première, la dernière et les voisines de la page courante", () => {
    expect(pageItems(0, 3)).toEqual([0, 1, 2]);
    expect(pageItems(5, 10)).toEqual([0, "gap", 4, 5, 6, "gap", 9]);
    expect(pageItems(0, 10)).toEqual([0, 1, "gap", 9]);
  });
});
