import { describe, expect, it } from "vitest";

import {
  byStatus,
  draftReadiness,
  emptyFilters,
  filterApplications,
  isFiltering,
  latestDocumentIds,
  mailtoUrl,
  pendingFavorites,
  isToFinalize,
  activeFilterCount,
  showsFavorites,
  type ApplicationSummary,
} from "@/lib/applications";

const base: ApplicationSummary = {
  id: "a",
  offer_id: 1,
  search_id: null,
  title: "Ingénieur DevOps",
  company: "Nimbus",
  location: null,
  url: null,
  source: "adzuna",
  contact_email: "rh@nimbus.fr",
  status: "draft",
  applied_at: null,
  cv_document_id: null,
  letter_document_id: null,
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
};

describe("byStatus", () => {
  it("range chaque candidature dans sa colonne, la plus récente en haut", () => {
    const groups = byStatus([
      base,
      { ...base, id: "b", status: "sent" },
      { ...base, id: "c", updated_at: "2026-10-02T10:00:00Z" },
    ]);
    expect(groups.draft.map((item) => item.id)).toEqual(["c", "a"]);
    expect(groups.sent.map((item) => item.id)).toEqual(["b"]);
    expect(groups.offer).toEqual([]);
  });
});

describe("latestDocumentIds", () => {
  it("garde la dernière version du CV et de la lettre", () => {
    expect(
      latestDocumentIds([
        { id: "cv1", kind: "cv", version: 1 },
        { id: "cv2", kind: "cv", version: 2 },
        { id: "l1", kind: "letter", version: 1 },
      ]),
    ).toEqual({ cv_document_id: "cv2", letter_document_id: "l1" });
    expect(latestDocumentIds([])).toEqual({});
  });
});

describe("mailtoUrl", () => {
  it("prépare l'objet et le corps du mail, espaces encodés", () => {
    const url = mailtoUrl(base, "Alex Martin");
    expect(url.startsWith("mailto:rh@nimbus.fr?subject=Candidature%20%3A%20Ing")).toBe(true);
    expect(decodeURIComponent(url)).toContain("Alex Martin");
    expect(url).not.toContain("+");
  });
});

describe("filterApplications", () => {
  const now = new Date("2026-10-31T12:00:00Z");
  const items: ApplicationSummary[] = [
    { ...base, id: "a", search_id: "devops", cv_document_id: "c", letter_document_id: "l", applied_at: "2026-10-30T10:00:00Z" },
    { ...base, id: "b", title: "Data Engineer", company: "Brume Énergie", search_id: "data", status: "sent" },
    { ...base, id: "c", title: "Ingénieur Cloud", source: "manuel", search_id: null, status: "rejected" },
  ];
  const ids = (filters: Partial<typeof emptyFilters>) =>
    filterApplications(items, { ...emptyFilters, ...filters }, now).map((item) => item.id);

  it("sans filtre, garde tout", () => {
    expect(ids({})).toEqual(["a", "b", "c"]);
    expect(isFiltering(emptyFilters)).toBe(false);
  });
  it("filtre par texte sans tenir compte des accents", () => {
    expect(ids({ query: "brume energie" })).toEqual(["b"]);
    expect(ids({ query: "ingenieur" })).toEqual(["a", "c"]);
  });
  it("filtre par statut, recherche d'origine, période et documents", () => {
    expect(ids({ statuses: ["sent", "rejected"] })).toEqual(["b", "c"]);
    expect(ids({ search: "data" })).toEqual(["b"]);
    expect(ids({ search: "manual" })).toEqual(["c"]);
    expect(ids({ period: "7" })).toEqual(["a"]);
    expect(ids({ missingDocuments: true })).toEqual(["b", "c"]);
    expect(isFiltering({ ...emptyFilters, period: "30" })).toBe(true);
  });
});

describe("draftReadiness", () => {
  it("dit ce qu'il manque et signale une attente de plus de 3 jours", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    expect(draftReadiness(base, now)).toEqual({ cv: false, letter: false, manual: false, missing: true, late: true });
    const ready = { ...base, cv_document_id: "c", letter_document_id: "l", created_at: "2026-10-09T12:00:00Z" };
    expect(draftReadiness(ready, now)).toEqual({ cv: true, letter: true, manual: false, missing: false, late: false });
  });
});

describe("pendingFavorites", () => {
  it("drops favorites that already have an application and duplicates across searches", () => {
    const favorites = [
      { search: "a", offer: { id: 1 } },
      { search: "a", offer: { id: 2 } },
      { search: "b", offer: { id: 2 } },
      { search: "b", offer: { id: 3 } },
    ];
    expect(pendingFavorites(favorites, [{ offer_id: 1 }, { offer_id: null }]).map((f) => f.offer.id)).toEqual([2, 3]);
  });
});

describe("activeFilterCount and showsFavorites", () => {
  it("counts filters other than text and hides favorites when a filter would exclude them", () => {
    expect(activeFilterCount(emptyFilters)).toBe(0);
    expect(activeFilterCount({ ...emptyFilters, statuses: ["sent", "draft"], missingDocuments: true })).toBe(3);
    expect(showsFavorites(emptyFilters)).toBe(true);
    expect(showsFavorites({ ...emptyFilters, statuses: ["draft"] })).toBe(true);
    expect(showsFavorites({ ...emptyFilters, statuses: ["sent"] })).toBe(false);
    expect(showsFavorites({ ...emptyFilters, query: "sre" })).toBe(false);
  });
});

describe("isToFinalize", () => {
  it("keeps drafts with a generated document or added by hand", () => {
    const draft = { status: "draft", source: "adzuna", cv_document_id: null, letter_document_id: null } as ApplicationSummary;
    expect(isToFinalize(draft)).toBe(false);
    expect(isToFinalize({ ...draft, letter_document_id: "l" })).toBe(true);
    expect(isToFinalize({ ...draft, source: "manuel" })).toBe(true);
    expect(isToFinalize({ ...draft, source: "manuel", status: "sent" })).toBe(false);
    expect(draftReadiness({ ...draft, source: "manuel", created_at: new Date().toISOString() }).missing).toBe(false);
  });
});

describe("dashboard helpers", () => {
  it("rounds axis ticks and formats weeks", async () => {
    const { percent, ticks, weekLabel } = await import("@/lib/dashboard");
    expect(ticks(0)).toEqual([0, 1]);
    expect(ticks(3)).toEqual([0, 1, 2, 3]);
    expect(ticks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(ticks(37)).toEqual([0, 10, 20, 30, 40]);
    expect(weekLabel("2026-10-26")).toBe("26 oct");
    expect(percent(0.5)).toBe(50);
    expect(percent(null)).toBeNull();
  });
});

describe("bestSearchSummary", () => {
  it("names the best search and compares it with the next one", async () => {
    const { bestSearchSummary } = await import("@/lib/dashboard");
    const row = (search_id: string | null, sent: number, progress_rate: number | null) => ({
      search_id, sent, progress_rate, responded: 0, technical_tests: 0, interviews: 0, offers: 0, rejected: 0, response_rate: 0,
    });
    const names = { devops: "DevOps", data: "Data Engineer" };
    expect(
      bestSearchSummary({ by_search: [row("devops", 5, 0.4), row(null, 4, 0.5), row("data", 4, 0.1)], best_search: "devops", min_sample: 3 }, names),
    ).toBe("DevOps obtient le plus de retours positifs : 40 % de tests techniques ou d'entretiens, contre 10 % pour Data Engineer.");
    expect(bestSearchSummary({ by_search: [row("devops", 2, 0.5)], best_search: null, min_sample: 3 }, names)).toBe(
      "Il faut au moins 3 candidatures envoyées par recherche pour comparer.",
    );
    expect(bestSearchSummary({ by_search: [row("data", 3, 0)], best_search: null, min_sample: 3 }, names)).toBe(
      "Aucune recherche n'a encore mené à un test technique ou un entretien.",
    );
  });
});

describe("edgeSpeed", () => {
  it("scrolls faster as the card nears an edge, not at all in the middle", async () => {
    const { edgeSpeed } = await import("@/components/applications/kanban");
    expect(edgeSpeed(500, 0, 1000)).toBe(0);
    expect(edgeSpeed(0, 0, 1000)).toBe(-22);
    expect(edgeSpeed(1000, 0, 1000)).toBe(22);
    expect(edgeSpeed(950, 0, 1000)).toBeGreaterThan(0);
    expect(edgeSpeed(950, 0, 1000)).toBeLessThan(22);
  });
});
