import { describe, expect, it } from "vitest";

import { canApply, countByCategory, filterMessages, syncSummary, type MailMessage } from "@/lib/mail";

const message = (overrides: Partial<MailMessage>): MailMessage => ({
  id: "m",
  account_id: "a",
  from_address: "rh@nimbus.io",
  from_name: null,
  subject: "Votre candidature",
  received_at: "2026-10-20T10:00:00Z",
  snippet: "",
  category: "other",
  confidence: 0.9,
  reason: "",
  application_id: null,
  match_reason: null,
  suggested_status: null,
  status_applied: false,
  reviewed: false,
  ...overrides,
});

describe("boîte de réception", () => {
  const messages = [
    message({ id: "1", category: "rejection", reviewed: true, received_at: "2026-10-18T10:00:00Z" }),
    message({ id: "2", category: "interview", received_at: "2026-10-21T10:00:00Z" }),
    message({ id: "3", category: "interview", reviewed: true, received_at: "2026-10-22T10:00:00Z" }),
  ];

  it("filtre les mails à vérifier, puis par catégorie, les plus récents d'abord", () => {
    expect(filterMessages(messages, "pending", "all").map((m) => m.id)).toEqual(["2"]);
    expect(filterMessages(messages, "all", "interview").map((m) => m.id)).toEqual(["3", "2"]);
    expect(filterMessages(messages, "all", "offer")).toEqual([]);
  });

  it("compte les mails par catégorie", () => {
    const counts = countByCategory(messages);
    expect(counts.interview).toBe(2);
    expect(counts.rejection).toBe(1);
    expect(counts.offer).toBe(0);
  });

  it("ne propose d'appliquer un statut que s'il y a une candidature et un statut non appliqué", () => {
    expect(canApply(message({ application_id: "x", suggested_status: "interview" }))).toBe(true);
    expect(canApply(message({ application_id: "x", suggested_status: "interview", status_applied: true }))).toBe(false);
    expect(canApply(message({ suggested_status: "interview" }))).toBe(false);
    expect(canApply(message({ application_id: "x" }))).toBe(false);
  });

  it("résume une synchronisation en une phrase", () => {
    expect(syncSummary({ accounts: 0, new: 0, linked: 0, applied: 0, errors: [] })).toBe("Aucune boîte connectée.");
    expect(syncSummary({ accounts: 1, new: 0, linked: 0, applied: 0, errors: [] })).toBe(
      "Aucun nouveau mail lié à tes candidatures.",
    );
    expect(syncSummary({ accounts: 1, new: 3, linked: 2, applied: 1, errors: [] })).toBe("3 nouveaux mails, 1 statut mis à jour.");
  });
});
