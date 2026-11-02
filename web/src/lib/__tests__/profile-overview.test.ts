import { describe, expect, it } from "vitest";

import { cleanBullet, joinBullets, paragraphs, previewGroups, experienceDuration, isWebLink, skillGroups, totalExperience, type Experience } from "@/lib/profile";

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

describe("cleanBullet", () => {
  it("removes a bullet kept from a pasted CV, and nothing else", () => {
    expect(cleanBullet("• Centralized flows")).toBe("Centralized flows");
    expect(cleanBullet("- Built - and shipped")).toBe("Built - and shipped");
    expect(cleanBullet("Reduced costs by 10%")).toBe("Reduced costs by 10%");
  });
});

describe("previewGroups", () => {
  const groups = [{ title: "A", bullets: ["1", "2"] }, { title: "B", bullets: ["3", "4"] }, { title: "C", bullets: ["5"] }];

  it("keeps the first bullets, across groups, and counts the rest", () => {
    expect(previewGroups(groups)).toEqual({ groups: [{ title: "A", bullets: ["1", "2"] }, { title: "B", bullets: ["3"] }], hidden: 2 });
  });

  it("hides nothing when everything fits", () => {
    expect(previewGroups(groups, 5).hidden).toBe(0);
    expect(previewGroups([]).groups).toEqual([]);
  });
});

describe("joinBullets", () => {
  it("joins lines wrapped by a PDF under their bullet", () => {
    expect(joinBullets(["• Centralized flows with pipelines that", "extract data from Oracle.", "•Displayed 10,000 flows", "in under 1 s."])).toEqual([
      "Centralized flows with pipelines that extract data from Oracle.",
      "Displayed 10,000 flows in under 1 s.",
    ]);
  });

  it("keeps a word split on its hyphen whole", () => {
    expect(joinBullets(["- Server pagination (Oracle LIMIT-", "OFFSET)"])).toEqual(["Server pagination (Oracle LIMIT-OFFSET)"]);
  });

  it("keeps one achievement per line when no bullet is present", () => {
    expect(joinBullets(["Reduced costs", "Shipped the API", "", "Led the team"])).toEqual(["Reduced costs", "Shipped the API", "Led the team"]);
  });

  it("joins a lowercase line that follows an unfinished sentence, even without bullets", () => {
    expect(joinBullets(["Built pipelines that", "extract data.", "shipped later"])).toEqual(["Built pipelines that extract data.", "shipped later"]);
  });

  it("does not join across a blank line", () => {
    expect(joinBullets(["• First", "", "second"])).toEqual(["First", "second"]);
  });
});

describe("paragraphs", () => {
  it("keeps one paragraph per finished sentence on its own line", () => {
    expect(paragraphs("Ingénieur diplômé.\nPassionné par la production.")).toEqual(["Ingénieur diplômé.", "Passionné par la production."]);
  });

  it("rejoins a line cut in the middle of a sentence", () => {
    expect(paragraphs("Plateforme critique et\nmigration des flux.")).toEqual(["Plateforme critique et migration des flux."]);
  });

  it("treats a blank line as a break and leaves a single block alone", () => {
    expect(paragraphs("Un bloc sans point\n\nUn autre.")).toEqual(["Un bloc sans point", "Un autre."]);
    expect(paragraphs("Un seul paragraphe. Deux phrases.")).toEqual(["Un seul paragraphe. Deux phrases."]);
  });
});
