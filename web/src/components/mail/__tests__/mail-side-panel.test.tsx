import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MailSidePanel } from "@/components/mail/mail-side-panel";
import type { MailAccount, MailMessage } from "@/lib/mail";

const account: MailAccount = {
  id: "a",
  email: "moi@exemple.fr",
  host: "imap.exemple.fr",
  port: 993,
  username: "moi@exemple.fr",
  folder: "INBOX", smtp_host: null, smtp_port: null, smtp_checked_at: null, smtp_error: null,
  last_sync_at: null,
  last_error: null,
  created_at: "2026-10-20T10:00:00Z",
  messages: 0,
};

const message: MailMessage = {
  id: "m1",
  account_id: "a",
  from_address: "rh@nimbus.io",
  from_name: null, reply_to: null,
  subject: "Invitation à un entretien",
  received_at: "2026-10-20T10:00:00Z",
  snippet: "",
  category: "interview",
  confidence: 0.9,
  reason: "",
  application_id: null,
  match_reason: null,
  suggested_status: null,
  status_applied: false,
  reviewed: false,
  replies: [],
};

const panel = (props: Partial<Parameters<typeof MailSidePanel>[0]> = {}) =>
  render(<MailSidePanel accounts={[account]} messages={[]} byId={new Map()} onReopen={vi.fn()} {...props} />);

describe("MailSidePanel", () => {
  it("shows the green light with the address of a working mailbox", () => {
    panel();
    expect(screen.getByRole("img", { name: "Connectée" })).toBeInTheDocument();
    expect(screen.getByText("moi@exemple.fr")).toBeInTheDocument();
  });

  it("does not show green when the last read failed", () => {
    panel({ accounts: [{ ...account, last_error: "Identifiants refusés." }] });
    expect(screen.queryByRole("img", { name: "Connectée" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Erreur de lecture" })).toBeInTheDocument();
    expect(screen.getByText("Identifiants refusés.")).toBeInTheDocument();
  });

  it("says when nothing was sent or treated", () => {
    panel({ messages: [message] });
    expect(screen.getByText("Aucune réponse envoyée pour l'instant.")).toBeInTheDocument();
    expect(screen.getByText("Aucun mail traité pour l'instant.")).toBeInTheDocument();
  });

  it("lists the sent replies with their text", () => {
    const reply = { id: "r", to_address: "rh@nimbus.io", subject: "Re: Invitation", body: "Mardi 14 h", sent_at: "2026-10-21T10:00:00Z", status: "sent" as const, error: null };
    panel({ messages: [{ ...message, replies: [reply] }] });
    const sent = within(screen.getByRole("list", { name: "Envoyés" }));
    expect(sent.getByText("rh@nimbus.io")).toBeInTheDocument();
    expect(sent.getByText("Re: Invitation")).toBeInTheDocument();
    expect(sent.getByText("Mardi 14 h")).toBeInTheDocument();
  });

  it("lists the treated mails and can send one back to review", async () => {
    const onReopen = vi.fn();
    panel({ messages: [{ ...message, reviewed: true }, { ...message, id: "m2", subject: "Pas traité" }], onReopen });
    const treated = within(screen.getByRole("list", { name: "Traités" }));
    expect(treated.getByText("Invitation à un entretien")).toBeInTheDocument();
    expect(treated.queryByText("Pas traité")).not.toBeInTheDocument();
    await userEvent.click(treated.getByRole("button", { name: /Remettre à vérifier/ }));
    expect(onReopen).toHaveBeenCalledWith("m1");
  });
});
