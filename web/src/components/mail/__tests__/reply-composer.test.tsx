import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReplyComposer, ReplyList } from "@/components/mail/reply-composer";
import type { MailMessage } from "@/lib/mail";

const message: MailMessage = {
  id: "m1",
  account_id: "a",
  from_address: "rh@nimbus.io",
  from_name: "Nimbus",
  subject: "Invitation à un entretien",
  received_at: "2026-10-20T10:00:00Z",
  snippet: "",
  category: "interview",
  confidence: 0.9,
  reason: "",
  application_id: "c1",
  match_reason: null,
  suggested_status: null,
  status_applied: false,
  reviewed: false,
  replies: [],
};

const setup = () => {
  const onSent = vi.fn();
  const onCancel = vi.fn();
  render(<ReplyComposer message={message} onSent={onSent} onCancel={onCancel} />);
  return { onSent, onCancel, user: userEvent.setup(), send: screen.getByRole("button", { name: "Envoyer" }) };
};

afterEach(() => vi.unstubAllGlobals());

describe("ReplyComposer", () => {
  it("prefills the sender and the subject, and waits for a message", () => {
    const { send } = setup();
    expect(screen.getByLabelText("À")).toHaveValue("rh@nimbus.io");
    expect(screen.getByLabelText("Objet")).toHaveValue("Re: Invitation à un entretien");
    expect(send).toBeDisabled();
  });

  it("sends the text written by hand as it is", async () => {
    const updated = { ...message, reviewed: true };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(updated), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const { user, send, onSent } = setup();
    await user.type(screen.getByLabelText("Message"), "Bonjour,{enter}Mardi 14 h.");
    await user.click(send);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/mail/messages/m1/reply");
    expect(JSON.parse(init.body)).toEqual({
      to: "rh@nimbus.io",
      subject: "Re: Invitation à un entretien",
      body: "Bonjour,\nMardi 14 h.",
    });
    expect(onSent).toHaveBeenCalledWith(updated);
  });

  it("refuses a wrong address or a blank message", async () => {
    const { user, send } = setup();
    await user.type(screen.getByLabelText("Message"), "   ");
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText("Message"), "Bonjour");
    expect(send).toBeEnabled();
    await user.clear(screen.getByLabelText("À"));
    await user.type(screen.getByLabelText("À"), "pas-une-adresse");
    expect(send).toBeDisabled();
  });

  it("keeps the text and shows the reason when the send fails", async () => {
    const failure = new Response(JSON.stringify({ detail: "Serveur d'envoi injoignable." }), { status: 502 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(failure));
    const { user, send, onSent } = setup();
    await user.type(screen.getByLabelText("Message"), "Bonjour");
    await user.click(send);
    expect(await screen.findByText(/injoignable/)).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("Bonjour");
    expect(onSent).not.toHaveBeenCalled();
  });

  it("offers the writing help as a button that does nothing yet", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { user } = setup();
    const help = screen.getByRole("button", { name: /Aide à la rédaction/ });
    expect(help).toBeDisabled();
    await user.click(help);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("cancels without sending", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { user, onCancel } = setup();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onCancel).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("ReplyList", () => {
  it("shows nothing without a reply, then each reply with its recipient", () => {
    const { rerender, container } = render(<ReplyList replies={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ReplyList replies={[{ id: "r", to_address: "rh@nimbus.io", subject: "Re: x", body: "Mardi", sent_at: "2026-10-21T10:00:00Z" }]} />);
    expect(screen.getByText(/Réponse à rh@nimbus.io/)).toBeInTheDocument();
    expect(screen.getByText("Mardi")).toBeInTheDocument();
  });
});
