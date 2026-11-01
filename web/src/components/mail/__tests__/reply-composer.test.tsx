import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReplyComposer, ReplyList } from "@/components/mail/reply-composer";
import type { MailMessage } from "@/lib/mail";

const message: MailMessage = {
  id: "m1",
  account_id: "a",
  from_address: "rh@nimbus.io",
  from_name: "Nimbus", reply_to: null,
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
      client_key: expect.any(String),
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

describe("ReplyComposer, adresse et renvoi", () => {
  afterEach(() => vi.unstubAllGlobals());

  const open = (changes: Partial<MailMessage> = {}) => {
    render(<ReplyComposer message={{ ...message, ...changes }} onSent={vi.fn()} onCancel={vi.fn()} />);
    return { user: userEvent.setup(), send: screen.getByRole("button", { name: "Envoyer" }), to: screen.getByLabelText("À") };
  };

  it("answers the address requested by the mail and says so", () => {
    const { to } = open({ from_address: "no-reply@ats.io", reply_to: "jobs@ats.io" });
    expect(to).toHaveValue("jobs@ats.io");
    expect(screen.getByText(/envoyé par no-reply@ats.io/)).toBeInTheDocument();
  });

  it("warns when the recipient is changed", async () => {
    const { user, to } = open();
    await user.clear(to);
    await user.type(to, "moi@exemple.fr");
    expect(screen.getByText(/la réponse n'ira pas à rh@nimbus.io/)).toBeInTheDocument();
  });

  it("blocks a typo in the domain until it is fixed", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { user, send, to } = open();
    await user.type(screen.getByLabelText("Message"), "Bonjour");
    await user.clear(to);
    await user.type(to, "cyrillef07@gamil.com");
    expect(screen.getByRole("alert")).toHaveTextContent("cyrillef07@gmail.com");
    expect(send).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Corriger" }));
    expect(to).toHaveValue("cyrillef07@gmail.com");
    expect(send).toBeEnabled();
  });

  it("lets a real address be kept despite the warning", async () => {
    const { user, send, to } = open();
    await user.type(screen.getByLabelText("Message"), "Bonjour");
    await user.clear(to);
    await user.type(to, "rh@gamil.com");
    await user.click(screen.getByRole("button", { name: "Garder mon adresse" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(send).toBeEnabled();
  });

  it("keeps the same key when a failed send is tried again", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Serveur injoignable." }), { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(message), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const { user, send } = open();
    await user.type(screen.getByLabelText("Message"), "Bonjour");
    await user.click(send);
    expect(await screen.findByText("Serveur injoignable.")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("Bonjour");
    await user.click(send);
    const keys = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).client_key);
    expect(keys[0]).toBe(keys[1]);
  });
});

describe("ReplyList", () => {
  it("shows nothing without a reply, then each reply with its recipient", () => {
    const { rerender, container } = render(<ReplyList replies={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ReplyList replies={[{ id: "r", to_address: "rh@nimbus.io", subject: "Re: x", body: "Mardi", sent_at: "2026-10-21T10:00:00Z", status: "sent" as const, error: null }]} />);
    expect(screen.getByText(/Réponse à rh@nimbus.io/)).toBeInTheDocument();
    expect(screen.getByText("Mardi")).toBeInTheDocument();
  });

  it("says when a reply may not have left", () => {
    render(<ReplyList replies={[{ id: "r", to_address: "rh@nimbus.io", subject: "Re: x", body: "Mardi", sent_at: "2026-10-21T10:00:00Z", status: "uncertain", error: null }]} />);
    expect(screen.getByText(/vérifie ton dossier Envoyés/)).toBeInTheDocument();
  });
});
