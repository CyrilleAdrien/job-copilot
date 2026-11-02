import { describe, expect, it } from "vitest";

import { experienceDuration, isWebLink, skillGroups, totalExperience, type Experience } from "@/lib/profile";

const now = new Date(2026, 10, 2);
const job = (start: string, end: string | null = null, technologies: string[] = []) => ({ start, end, technologies }) as Experience;

describe("experienceDuration", () => {
  it("counts the first and last months", () => {
    expect(experienceDuration(job("2024-09", "2024-09"), now)).toBe("1 mois");
    expect(experienceDuration(job("2024-01", "2025-02"), now)).toBe("1 an 2 mois");
    expect(experienceDuration(job("2024-11", "2026-10"), now)).toBe("2 ans");
  });

  it("runs until today for a current job", () => {
    expect(experienceDuration(job("2026-10"), now)).toBe("2 mois");
  });
});

describe("totalExperience", () => {
  it("adds separate jobs, counts overlaps once, and keeps a gap out", () => {
    expect(totalExperience([job("2020-01", "2020-12"), job("2022-01", "2022-12")], now)).toBe("2 ans");
    expect(totalExperience([job("2022-01", "2022-12"), job("2022-07", "2023-06")], now)).toBe("1 an 6 mois");
    expect(totalExperience([job("2020-01", "2023-12"), job("2021-01", "2021-06")], now)).toBe("4 ans");
  });

  it("has nothing to say without a job", () => {
    expect(totalExperience([], now)).toBeNull();
  });
});

describe("skillGroups", () => {
  it("prefers the profile's skills", () => {
    const skills = [{ name: "Data", items: ["SQL"] }];
    expect(skillGroups({ skills, experiences: [job("2024-01", null, ["Python"])] })).toEqual(skills);
  });

  it("falls back on the technologies of the jobs, without duplicates", () => {
    expect(skillGroups({ skills: [], experiences: [job("2024-01", null, ["Python", "SQL"]), job("2023-01", null, ["SQL"])] })).toEqual([{ name: "Technologies", items: ["Python", "SQL"] }]);
    expect(skillGroups({ skills: [], experiences: [] })).toEqual([]);
  });
});

describe("isWebLink", () => {
  it("only accepts web addresses", () => {
    expect(isWebLink("https://github.com/alex")).toBe(true);
    expect(isWebLink("javascript:alert(1)")).toBe(false);
  });
});
