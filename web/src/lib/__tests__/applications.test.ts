import { describe, expect, it } from "vitest";

import {
  byStatus,
  draftReadiness,
  emptyFilters,
  filterApplications,
  isFiltering,
  latestDocumentIds,
  mailtoUrl,
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
    expect(draftReadiness(base, now)).toEqual({ cv: false, letter: false, missing: true, late: true });
    const ready = { ...base, cv_document_id: "c", letter_document_id: "l", created_at: "2026-10-09T12:00:00Z" };
    expect(draftReadiness(ready, now)).toEqual({ cv: true, letter: true, missing: false, late: false });
  });
});
