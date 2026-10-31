import { describe, expect, it } from "vitest";

import { byStatus, latestDocumentIds, mailtoUrl, type ApplicationSummary } from "@/lib/applications";

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
