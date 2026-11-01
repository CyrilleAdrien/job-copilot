import { describe, expect, it } from "vitest";

import { addressTypo, canApply, canSendReply, replyRecipient, countByCategory, filterMessages, replySubject, sentReplies, syncSummary, treatedMessages, type MailMessage } from "@/lib/mail";

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

describe("panneau de droite", () => {
  const reply = (id: string, sent_at: string) => ({ id, to_address: "rh@nimbus.io", subject: "Re: x", body: "Bonjour", sent_at, status: "sent" as const, error: null });

  it("lists every reply, the most recent first, with its mail", () => {
    const sent = sentReplies([
      message({ id: "1", replies: [reply("a", "2026-10-20T10:00:00Z"), reply("c", "2026-10-22T10:00:00Z")] }),
      message({ id: "2", replies: [reply("b", "2026-10-21T10:00:00Z")] }),
      message({ id: "3" }),
    ]);
    expect(sent.map((item) => item.id)).toEqual(["c", "b", "a"]);
    expect(sent[1].message.id).toBe("2");
  });

  it("lists only the treated mails, the most recent first", () => {
    const treated = treatedMessages([
      message({ id: "1", reviewed: true, received_at: "2026-10-18T10:00:00Z" }),
      message({ id: "2" }),
      message({ id: "3", reviewed: true, received_at: "2026-10-22T10:00:00Z" }),
    ]);
    expect(treated.map((item) => item.id)).toEqual(["3", "1"]);
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
