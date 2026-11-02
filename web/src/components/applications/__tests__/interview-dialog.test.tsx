import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InterviewDialog } from "@/components/applications/interview-dialog";
import type { ApplicationSummary } from "@/lib/applications";

const application = { id: "c1", title: "Data Engineer", company: "Nimbus", status: "sent" } as ApplicationSummary;

function backend(eventStatus = 201) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/calendar/events")) return new Response(JSON.stringify(eventStatus === 201 ? { id: "e1" } : { detail: "Calendrier injoignable." }), { status: eventStatus });
    return new Response(JSON.stringify({ ...application, ...JSON.parse(String(init?.body)) }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const calls = (fetchMock: ReturnType<typeof backend>, part: string) => fetchMock.mock.calls.filter(([url]) => url.includes(part));

function setup() {
  const onClose = vi.fn();
  const onChanged = vi.fn();
  render(<InterviewDialog application={application} onClose={onClose} onChanged={onChanged} />);
  return { onClose, onChanged, user: userEvent.setup() };
}

afterEach(() => vi.unstubAllGlobals());

describe("InterviewDialog", () => {
  it("moves the application and books the chosen slot", async () => {
    const fetchMock = backend();
    const { user, onClose, onChanged } = setup();
    expect(screen.getByRole("button", { name: "Planifier" })).toBeDisabled();
    await user.type(screen.getByLabelText("Date de l'entretien"), "2026-11-20");
    await user.selectOptions(screen.getByLabelText("Durée"), "90");
    await user.click(screen.getByRole("button", { name: "Planifier" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(JSON.parse(String(calls(fetchMock, "/applications/c1")[0][1]?.body))).toEqual({ status: "interview" });
    const event = JSON.parse(String(calls(fetchMock, "/calendar/events")[0][1]?.body));
    expect(event).toMatchObject({ kind: "interview", application_id: "c1", advance_status: false });
    expect(new Date(event.starts_at).getHours()).toBe(10);
    expect(new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()).toBe(90 * 60000);
    expect(onChanged).toHaveBeenCalled();
  });

  it("can move the application without a date", async () => {
    const fetchMock = backend();
    const { user, onClose } = setup();
    await user.click(screen.getByRole("button", { name: "Sans date pour l'instant" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calls(fetchMock, "/applications/c1")).toHaveLength(1);
    expect(calls(fetchMock, "/calendar/events")).toHaveLength(0);
  });

  it("changes nothing when cancelled", async () => {
    const fetchMock = backend();
    const { user, onClose } = setup();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onClose).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says what happened when the calendar fails, and retries only the event", async () => {
    const fetchMock = backend(502);
    const { user, onClose } = setup();
    await user.type(screen.getByLabelText("Date de l'entretien"), "2026-11-20");
    await user.click(screen.getByRole("button", { name: "Planifier" }));
    expect(await screen.findByText(/passée en Entretien, mais le rendez-vous n'a pas été créé/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Planifier" }));
    await waitFor(() => expect(calls(fetchMock, "/calendar/events")).toHaveLength(2));
    expect(calls(fetchMock, "/applications/c1")).toHaveLength(1);
  });
});
