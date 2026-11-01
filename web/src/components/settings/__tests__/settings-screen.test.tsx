import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsScreen } from "@/components/settings/settings-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/components/profile/profile-identity", () => ({ useProfileIdentity: () => ({ refresh: vi.fn() }) }));

const ok = { status: "ok", checks: { postgres: "ok", redis: "ok" } };
const llm = { provider: "ollama", url: "http://host:11434", model: "qwen2.5:7b", default_model: "qwen2.5:7b", reachable: true, model_installed: true, installed: [{ name: "qwen2.5:7b", size: 1 }, { name: "gemma:4b", size: 1 }] };

function backend(changes: Record<string, unknown> = {}, failing: Record<string, number> = {}) {
  const routes: Record<string, unknown> = {
    "/api/system/status": { status: "ok", services: Object.fromEntries(["profile", "jobs", "documents", "applications", "mail", "calendar"].map((name) => [name, { service: name, ...ok }])) },
    "/api/system/llm": llm,
    "/api/jobs/sources": [{ name: "adzuna", label: "Adzuna", configured: false, origin: null }],
    "/api/jobs/search-settings": { refresh_minutes: 15, encryption: true },
    "/api/mail/accounts": [{ id: "a", email: "a@b.fr", last_error: null, smtp_error: null, messages: 0, last_sync_at: null, smtp_host: "smtp.b.fr", smtp_port: 587, smtp_checked_at: null }],
    "/api/calendar/accounts": [],
    "/api/profile/": { identity: { full_name: "Alex" }, searches: [{}] },
    ...changes,
  };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.split("?")[0];
    if (path in failing) return new Response("{}", { status: failing[path] });
    if (init?.method === "PUT" && path === "/api/system/llm") return new Response(JSON.stringify({ ...llm, model: "gemma:4b" }));
    if (init?.method === "POST" && path === "/api/system/llm/test") return new Response(JSON.stringify({ model: "qwen2.5:7b", seconds: 2.34 }));
    if (init?.method === "PUT" && path === "/api/jobs/sources/adzuna") {
      return JSON.parse(String(init.body)).secret === "bon"
        ? new Response(JSON.stringify({ name: "adzuna", label: "Adzuna", configured: true, origin: "settings" }))
        : new Response(JSON.stringify({ detail: "Identifiants Adzuna refusés." }), { status: 400 });
    }
    if (!(path in routes)) return new Response(JSON.stringify({ detail: "?" }), { status: 404 });
    return new Response(JSON.stringify(routes[path]));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = "";
});

describe("SettingsScreen", () => {
  it("shows each step with its state and opens the first one to do", async () => {
    backend();
    render(<SettingsScreen />);
    expect(await screen.findByRole("button", { name: /1\. Système.*Prêt/s })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /4\. Sources d'offres.*À faire/s })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Pas de clé.")).toBeInTheDocument();
  });

  it("locks the sources without a profile, and never opens them", async () => {
    backend({}, { "/api/profile/": 404 });
    render(<SettingsScreen />);
    expect(await screen.findByRole("button", { name: /4\. Sources d'offres.*Verrouillé/s })).toBeDisabled();
    expect(await screen.findByRole("link", { name: /Remplir mon profil/ })).toHaveAttribute("href", "/bienvenue");
  });

  it("stays usable when a service does not answer", async () => {
    backend({}, { "/api/calendar/accounts": 502 });
    render(<SettingsScreen />);
    expect(await screen.findByRole("button", { name: /6\. Calendrier.*À corriger/s })).toBeEnabled();
    expect(screen.getByRole("button", { name: /5\. Boîte mail.*Prêt/s })).toBeEnabled();
  });

  it("changes and tests the model", async () => {
    const fetchMock = backend();
    const user = userEvent.setup();
    window.location.hash = "#modele";
    render(<SettingsScreen />);
    await user.selectOptions(await screen.findByLabelText("Modèle utilisé"), "gemma:4b");
    expect(fetchMock).toHaveBeenCalledWith("/api/system/llm", expect.objectContaining({ method: "PUT", body: JSON.stringify({ model: "gemma:4b" }) }));
    await user.click(screen.getByRole("button", { name: "Tester le modèle" }));
    expect(await screen.findByText("qwen2.5:7b a répondu en 2.3 s.")).toBeInTheDocument();
  });

  it("keeps refused source keys out and explains why, then accepts good ones", async () => {
    const fetchMock = backend();
    const user = userEvent.setup();
    render(<SettingsScreen />);
    await user.click(await screen.findByRole("button", { name: "Ajouter les clés" }));
    await user.type(screen.getByLabelText("Application ID"), "id");
    await user.type(screen.getByLabelText("Application key"), "mauvais");
    await user.click(screen.getByRole("button", { name: "Tester et enregistrer" }));
    expect(await screen.findByText("Identifiants Adzuna refusés.")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Application key"));
    await user.type(screen.getByLabelText("Application key"), "bon");
    await user.click(screen.getByRole("button", { name: "Tester et enregistrer" }));
    expect(await screen.findByText(/Clés acceptées/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Application key")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/jobs/sources").length).toBeGreaterThan(1);
  });

  it("asks before erasing everything", async () => {
    const fetchMock = backend();
    const user = userEvent.setup();
    window.location.hash = "#donnees";
    render(<SettingsScreen />);
    await user.click(await screen.findByRole("button", { name: "Tout supprimer" }));
    expect(screen.getByRole("dialog", { name: "Tout supprimer ?" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });
});
