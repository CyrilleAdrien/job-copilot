import { describe, expect, it } from "vitest";

import { brokenServices, buildSteps, dependencyStates, firstOpenStep, type SettingsData, type SystemStatus } from "@/lib/system";

const healthy = (extra: Record<string, string> = {}) => ({ status: "ok", checks: { postgres: "ok", redis: "ok", ...extra } });
const status: SystemStatus = {
  status: "ok",
  services: { profile: { service: "profile", ...healthy() }, jobs: { service: "jobs", ...healthy() }, mail: { service: "mail", ...healthy({ ollama: "ok" }) }, calendar: { service: "calendar", ...healthy() } },
};
const data = (changes: Partial<SettingsData> = {}): SettingsData => ({
  status,
  llm: { provider: "ollama", url: "http://x", model: "qwen", default_model: "qwen", reachable: true, model_installed: true, installed: [{ name: "qwen", size: 1 }] },
  profile: { name: "Alex", searches: 2 },
  profileLoaded: true,
  sources: [{ name: "adzuna", label: "Adzuna", configured: true, origin: "settings" }],
  mail: [{ email: "a@b.fr", last_error: null, smtp_error: null }],
  calendar: [],
  ...changes,
});
const step = (d: SettingsData, id: string) => buildSteps(d).find((item) => item.id === id)!;

describe("étapes des réglages", () => {
  it("keeps the order of the dependencies", () => {
    expect(buildSteps(data()).map((item) => item.id)).toEqual(["systeme", "modele", "profil", "sources", "boite-mail", "calendrier", "donnees"]);
  });

  it("marks everything ready when all is set, the calendar staying optional", () => {
    const states = buildSteps(data()).map((item) => item.state);
    expect(states).toEqual(["ready", "ready", "ready", "ready", "ready", "optional", "optional"]);
  });

  it("locks the sources until the profile exists, and says why", () => {
    const sources = step(data({ profile: null }), "sources");
    expect(sources.state).toBe("locked");
    expect(sources.summary).toMatch(/profil/);
    expect(step(data({ profile: null }), "profil").state).toBe("todo");
  });

  it("locks a step whose service is down, without blocking the others", () => {
    const down = { ...status, status: "degraded" as const, services: { ...status.services, mail: { service: "mail", status: "unreachable", error: "ConnectError" } } };
    const d = data({ status: down, mail: null });
    expect(step(d, "boite-mail").state).toBe("locked");
    expect(step(d, "systeme").state).toBe("error");
    expect(step(d, "systeme").summary).toContain("mail");
    expect(step(d, "profil").state).toBe("ready");
  });

  it("does not count a stopped Ollama as a service failure: the model step reports it", () => {
    const off = { ...status, services: { ...status.services, mail: { service: "mail", status: "degraded", checks: { postgres: "ok", redis: "ok", ollama: "error: ConnectError" } } } };
    expect(brokenServices(off)).toEqual([]);
    expect(dependencyStates(off).ollama).toBe(false);
    const d = data({ status: off, llm: { ...data().llm!, reachable: false, model_installed: false, installed: [] } });
    expect(step(d, "systeme").state).toBe("ready");
    expect(step(d, "modele").state).toBe("error");
    expect(step(d, "boite-mail").state).toBe("ready");
  });

  it("reports a model that is not installed", () => {
    const d = data({ llm: { ...data().llm!, model_installed: false } });
    expect(step(d, "modele")).toMatchObject({ state: "error", summary: "qwen n'est pas installé." });
  });

  it("asks to fix a mailbox whose sending or reading fails", () => {
    const d = data({ mail: [{ email: "a@b.fr", last_error: null, smtp_error: "Identifiants refusés." }] });
    expect(step(d, "boite-mail")).toMatchObject({ state: "error" });
    expect(step(d, "boite-mail").summary).toContain("a@b.fr");
  });

  it("opens the requested step, otherwise the first one waiting for something", () => {
    expect(firstOpenStep(buildSteps(data({ sources: [] })), "")).toBe("sources");
    expect(firstOpenStep(buildSteps(data()), "calendrier")).toBe("calendrier");
    expect(firstOpenStep(buildSteps(data()), "")).toBe("systeme");
    // Un lien vers une étape verrouillée ouvre ce qu'il faut faire avant elle.
    expect(firstOpenStep(buildSteps(data({ profile: null })), "sources")).toBe("profil");
  });
});
