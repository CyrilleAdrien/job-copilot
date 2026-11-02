import { describe, expect, it } from "vitest";

import { heroScene } from "@/lib/hero";

describe("heroScene", () => {
  it("picks the scene of each page, its sub-pages included", () => {
    expect(heroScene("/")).toBe("dashboard");
    expect(heroScene("/offres")).toBe("offers");
    expect(heroScene("/offres/12")).toBe("offers");
    expect(heroScene("/reglages")).toBe("settings");
  });

  it("does not confuse a page with another that starts alike, and has a default", () => {
    expect(heroScene("/offres-archivees")).toBe("send");
    expect(heroScene("/design")).toBe("send");
  });
});
