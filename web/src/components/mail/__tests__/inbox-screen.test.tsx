import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InboxScreen } from "@/components/mail/inbox-screen";
import type { MailAccount, MailMessage, MailReply } from "@/lib/mail";

const account: MailAccount = {
  id: "a", email: "moi@gmail.com", host: "imap.gmail.com", port: 993, username: "moi@gmail.com", folder: "INBOX",
  smtp_host: "smtp.gmail.com", smtp_port: 465, smtp_checked_at: null, smtp_error: null,
  last_sync_at: null, last_error: null, created_at: "2026-10-01T10:00:00Z", messages: 1,
};
const mail: MailMessage = {
  id: "m1", account_id: "a", from_address: "rh@nimbus.io", from_name: "Nimbus", reply_to: null,
  subject: "Invitation à un entretien", received_at: "2026-10-20T10:00:00Z", snippet: "Bonjour,\n\nÊtes-vous disponible ?",
  category: "interview", confidence: 0.9, reason: "Tournure reconnue", application_id: "c1", match_reason: null,
  suggested_status: "interview", status_applied: false, reviewed: false, replies: [],
};
const bounced: MailReply = {
  id: "r1", account_id: "a", message_id: null, to_address: "rh@ancien.io", subject: "Candidature spontanée",
  body: "Bonjour", sent_at: "2026-10-21T10:00:00Z", status: "bounced", error: "550 User unknown", problem_seen: false,
};

function backend({ messages = [mail], sent = [] as MailReply[] } = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    if (url.endsWith("/seen")) return reply({ ...bounced, problem_seen: true });
    if (url.endsWith("/accounts/a/send")) return reply({ ...bounced, id: "r2", status: "sent", error: null, to_address: JSON.parse(String(init?.body)).to }, 201);
    if (init?.method === "PATCH") return reply({ ...mail, ...JSON.parse(String(init.body)) });
    if (url.includes("/mail/accounts")) return reply([account]);
    if (url.includes("/mail/messages")) return reply(messages);
    if (url.includes("/mail/sent")) return reply(sent);
    return reply([]);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("InboxScreen", () => {
  it("lists a mail on one line, without its actions, then opens it", async () => {
    backend();
    const user = userEvent.setup();
    render(<InboxScreen />);
    const list = await screen.findByRole("list", { name: "Mails" });
    expect(within(list).getByText("Nimbus")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Répondre" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Passer à/ })).not.toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: /^Nimbus/ }));
    expect(screen.getByRole("heading", { name: "Invitation à un entretien" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Répondre" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Passer à « Entretien »" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retour à la liste" }));
    expect(screen.getByRole("list", { name: "Mails" })).toBeInTheDocument();
  });

  it("moves a mail out of the pending folder once treated", async () => {
    const fetchMock = backend();
    const user = userEvent.setup();
    render(<InboxScreen />);
    await screen.findByRole("list", { name: "Mails" });
    await user.click(screen.getByRole("button", { name: /^À vérifier/ }));
    await user.click(screen.getByRole("button", { name: /Marquer comme traité/ }));
    expect(fetchMock).toHaveBeenCalledWith("/api/mail/messages/m1", expect.objectContaining({ method: "PATCH" }));
    expect(await screen.findByText("Tout est à jour")).toBeInTheDocument();
  });

  it("flags an undelivered mail in the sent folder and gives the reason", async () => {
    const fetchMock = backend({ sent: [bounced] });
    const user = userEvent.setup();
    render(<InboxScreen />);
    const alert = { name: "Un mail n'a pas été distribué" };
    expect(await screen.findByRole("img", alert)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Envoyés/ }));
    const list = screen.getByRole("list", { name: "Mails envoyés" });
    expect(within(list).getByText("Non distribué")).toBeInTheDocument();
    // Ouvrir le dossier ne suffit pas : c'est la lecture du mail qui éteint le témoin.
    expect(screen.getByRole("img", alert)).toBeInTheDocument();
    await user.click(within(list).getByRole("button"));
    expect(screen.getByText(/550 User unknown/)).toBeInTheDocument();
    expect(screen.queryByRole("img", alert)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/mail/sent/r1/seen", expect.objectContaining({ method: "POST" }));
    await user.click(screen.getByRole("button", { name: "Retour à la liste" }));
    expect(within(screen.getByRole("list", { name: "Mails envoyés" })).getByText("Non distribué")).toBeInTheDocument();
  });

  it("keeps the alert off once the undelivered mail was read earlier", async () => {
    backend({ messages: [mail], sent: [{ ...bounced, problem_seen: true }] });
    render(<InboxScreen />);
    await screen.findByRole("list", { name: "Mails" });
    expect(screen.queryByRole("img", { name: "Un mail n'a pas été distribué" })).not.toBeInTheDocument();
  });

  it("clears a confirmation by itself, but keeps a sync error until it is closed", async () => {
    let report = { accounts: 1, new: 0, linked: 0, applied: 0, bounced: 1, errors: [] as string[] };
    const fetchMock = backend();
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url.endsWith("/mail/sync") ? new Response(JSON.stringify(report)) : base(url, init),
    );
    // Seuls les délais sont simulés : l'animation de sortie garde sa vraie horloge.
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<InboxScreen />);
    await user.click(await screen.findByRole("button", { name: "Synchroniser" }));
    expect(await screen.findByText("1 mail non distribué.")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(6100));
    await waitFor(() => expect(screen.queryByText("1 mail non distribué.")).not.toBeInTheDocument());

    report = { ...report, errors: ["moi@gmail.com : serveur injoignable"] };
    await user.click(screen.getByRole("button", { name: "Synchroniser" }));
    expect(await screen.findByText(/serveur injoignable/)).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(60000));
    expect(screen.getByText(/serveur injoignable/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fermer ce message" }));
    await waitFor(() => expect(screen.queryByText(/serveur injoignable/)).not.toBeInTheDocument());
  });

  it("composes a new message, blocks a typo and files it under sent", async () => {
    const fetchMock = backend();
    const user = userEvent.setup();
    render(<InboxScreen />);
    await user.click(await screen.findByRole("button", { name: "Nouveau message" }));
    const form = screen.getByRole("form", { name: "Nouveau message" });
    const send = within(form).getByRole("button", { name: "Envoyer" });
    expect(send).toBeDisabled();
    await user.type(within(form).getByLabelText("À"), "rh@gamil.com");
    await user.type(within(form).getByLabelText("Objet"), "Candidature");
    await user.type(within(form).getByLabelText("Message"), "Bonjour");
    expect(send).toBeDisabled();
    await user.click(within(form).getByRole("button", { name: "Corriger" }));
    await user.click(send);
    const call = fetchMock.mock.calls.find(([url]) => url.endsWith("/accounts/a/send"));
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ to: "rh@gmail.com", subject: "Candidature", body: "Bonjour" });
    expect(await screen.findByText(/à destination de rh@gmail.com/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Envoyés/ }));
    expect(within(screen.getByRole("list", { name: "Mails envoyés" })).getAllByRole("button")).toHaveLength(1);
  });
});
