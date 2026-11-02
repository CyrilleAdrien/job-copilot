import { describe, expect, it } from "vitest";

import { activeMailFilters, applyMailFilters, applySentFilters, emptyMailFilters, type MailFilters, addressTypo, canApply, canSendReply, replyRecipient, countByCategory, filterMessages, listDate, replySubject, senderInitial, syncSummary, type MailMessage, type MailReply } from "@/lib/mail";

const message = (overrides: Partial<MailMessage>): MailMessage => ({
  id: "m",
  account_id: "a",
  from_address: "rh@nimbus.io",
  from_name: null, reply_to: null,
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
  replies: [],
  ...overrides,
});

describe("dossiers", () => {
  const mails = [
    message({ id: "1", reviewed: true, received_at: "2026-10-18T10:00:00Z" }),
    message({ id: "2", received_at: "2026-10-20T10:00:00Z" }),
    message({ id: "3", reviewed: true, received_at: "2026-10-22T10:00:00Z" }),
  ];

  it("sorts each folder, the most recent first", () => {
    expect(filterMessages(mails, "inbox", "all").map((m) => m.id)).toEqual(["3", "2", "1"]);
    expect(filterMessages(mails, "pending", "all").map((m) => m.id)).toEqual(["2"]);
    expect(filterMessages(mails, "treated", "all").map((m) => m.id)).toEqual(["3", "1"]);
  });
});

describe("liste", () => {
  const now = new Date(2026, 10, 1, 18, 0);

  it("shortens the date like a mailbox", () => {
    expect(listDate(new Date(2026, 10, 1, 9, 5).toISOString(), now)).toBe("09:05");
    expect(listDate(new Date(2026, 9, 20, 9, 5).toISOString(), now)).toMatch(/^20 oct/);
    expect(listDate(new Date(2025, 9, 20, 9, 5).toISOString(), now)).toBe("20/10/2025");
  });

  it("uses the sender's first letter", () => {
    expect(senderInitial({ from_name: "élise", from_address: "e@x.fr" })).toBe("É");
    expect(senderInitial({ from_name: null, from_address: "rh@x.fr" })).toBe("R");
  });
});

describe("réponse à un mail", () => {
  it("adds Re: only once", () => {
    expect(replySubject("Entretien")).toBe("Re: Entretien");
    expect(replySubject("RE : Entretien")).toBe("RE : Entretien");
    expect(replySubject("Ré: Entretien")).toBe("Ré: Entretien");
    expect(replySubject("  ")).toBe("Re: votre message");
    expect(replySubject("x".repeat(500))).toHaveLength(500);
  });

  it("needs one address, a subject and a message", () => {
    const draft = { to: "rh@nimbus.io", subject: "Re: x", body: "Bonjour" };
    expect(canSendReply(draft)).toBe(true);
    expect(canSendReply({ ...draft, body: "  \n" })).toBe(false);
    expect(canSendReply({ ...draft, subject: " " })).toBe(false);
    expect(canSendReply({ ...draft, to: "rh" })).toBe(false);
    expect(canSendReply({ ...draft, to: "a@b.fr, c@d.fr" })).toBe(false);
  });
});

describe("boîte de réception", () => {
  const messages = [
    message({ id: "1", category: "rejection", reviewed: true, received_at: "2026-10-18T10:00:00Z" }),
    message({ id: "2", category: "interview", received_at: "2026-10-21T10:00:00Z" }),
    message({ id: "3", category: "interview", reviewed: true, received_at: "2026-10-22T10:00:00Z" }),
  ];

  it("filtre les mails à vérifier, puis par catégorie, les plus récents d'abord", () => {
    expect(filterMessages(messages, "pending", "all").map((m) => m.id)).toEqual(["2"]);
    expect(filterMessages(messages, "inbox", "interview").map((m) => m.id)).toEqual(["3", "2"]);
    expect(filterMessages(messages, "inbox", "offer")).toEqual([]);
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
    expect(syncSummary({ accounts: 0, new: 0, linked: 0, applied: 0, bounced: 0, errors: [] })).toBe("Aucune boîte connectée.");
    expect(syncSummary({ accounts: 1, new: 0, linked: 0, applied: 0, bounced: 0, errors: [] })).toBe(
      "Aucun nouveau mail lié à tes candidatures.",
    );
    expect(syncSummary({ accounts: 1, new: 3, linked: 2, applied: 1, bounced: 0, errors: [] })).toBe("3 nouveaux mails, 1 statut mis à jour.");
    expect(syncSummary({ accounts: 1, new: 0, linked: 0, applied: 0, bounced: 2, errors: [] })).toBe("2 mails non distribués.");
  });
});

describe("addressTypo", () => {
  it.each([
    ["cyrillef07@gamil.com", "cyrillef07@gmail.com"],
    ["a@gmial.com", "a@gmail.com"],
    ["a@gmai.com", "a@gmail.com"],
    ["a@gmaill.com", "a@gmail.com"],
    ["a@gmail.con", "a@gmail.com"],
    ["a@gmail.fr", "a@gmail.com"],
    ["a@outlok.com", "a@outlook.com"],
    ["a@hotnail.fr", "a@hotmail.fr"],
    [" A@Gamil.com ", "a@gmail.com"],
  ])("suggests a fix for %s", (address, fixed) => {
    expect(addressTypo(address)).toBe(fixed);
  });

  it.each(["a@gmail.com", "rh@nimbus.io", "rh@ma-societe.fr", "a@yahoo.fr", "pas-une-adresse", "a@b@gmail.com", ""])(
    "leaves %s alone",
    (address) => {
      expect(addressTypo(address)).toBeNull();
    },
  );
});

describe("replyRecipient", () => {
  it("prefers the address requested by the mail", () => {
    expect(replyRecipient({ reply_to: "jobs@ats.io", from_address: "no-reply@a.fr" })).toBe("jobs@ats.io");
    expect(replyRecipient({ reply_to: null, from_address: "rh@a.fr" })).toBe("rh@a.fr");
  });
});

describe("filtres de la boîte", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  const base = { from_name: null, from_address: "rh@nimbus.io", subject: "", snippet: "", account_id: "a", application_id: null } as unknown as MailMessage;
  const mails = [
    { ...base, id: "recent", category: "interview", received_at: "2026-11-01T12:00:00Z", subject: "Reçu pour l'entretien", application_id: "c1" },
    { ...base, id: "old", category: "offer", received_at: "2026-09-01T12:00:00Z", from_name: "Brume", account_id: "b" },
  ] as MailMessage[];
  const statusOf = (mail: MailMessage) => (mail.application_id ? ("interview" as const) : undefined);
  const ids = (changes: Partial<MailFilters>) => applyMailFilters(mails, { ...emptyMailFilters, ...changes }, statusOf, now).map((mail) => mail.id);

  it("keeps everything without a filter", () => {
    expect(ids({})).toEqual(["recent", "old"]);
  });

  it("filters by period, text without accents, status, link and mailbox", () => {
    expect(ids({ period: "7" })).toEqual(["recent"]);
    expect(ids({ categories: ["offer"] })).toEqual(["old"]);
    expect(ids({ categories: ["offer", "interview"] })).toEqual(["recent", "old"]);
    expect(ids({ text: "RECU entretien" })).toEqual(["recent"]);
    expect(ids({ text: "brume" })).toEqual(["old"]);
    expect(ids({ statuses: ["interview"] })).toEqual(["recent"]);
    expect(ids({ statuses: ["rejected"] })).toEqual([]);
    expect(ids({ linked: "unlinked" })).toEqual(["old"]);
    expect(ids({ account: "b" })).toEqual(["old"]);
  });

  it("filters sent mails by delivery, and counts only what applies to the folder", () => {
    const replies = [
      { id: "ok", status: "sent", to_address: "a@b.fr", subject: "", body: "", sent_at: "2026-11-01T12:00:00Z", account_id: "a" },
      { id: "ko", status: "bounced", to_address: "c@d.fr", subject: "", body: "", sent_at: "2026-11-01T12:00:00Z", account_id: "a" },
    ] as MailReply[];
    expect(applySentFilters(replies, { ...emptyMailFilters, delivery: "bounced" }, now).map((reply) => reply.id)).toEqual(["ko"]);
    expect(applySentFilters(replies, { ...emptyMailFilters, text: "a@b" }, now).map((reply) => reply.id)).toEqual(["ok"]);
    const filters = { ...emptyMailFilters, delivery: "bounced", statuses: ["interview"] } as MailFilters;
    expect(activeMailFilters(filters, true)).toBe(1);
    expect(activeMailFilters(filters, false)).toBe(1);
    expect(activeMailFilters(emptyMailFilters, false)).toBe(0);
  });
});
