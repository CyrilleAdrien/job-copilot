import { afterEach, describe, expect, it, vi } from "vitest";

import { lockFor, needsAssistant, pullModel, setupSteps, type SetupData } from "@/lib/setup";
import type { SystemStatus } from "@/lib/system";

const healthy = { status: "ok", checks: { postgres: "ok", redis: "ok" } };
const status: SystemStatus = {
  status: "ok",
  services: Object.fromEntries(["profile", "jobs", "documents", "applications", "mail", "calendar"].map((name) => [name, { service: name, ...healthy }])),
};
const mailbox = { email: "a@b.fr", last_error: null, smtp_error: null } as NonNullable<SetupData["mail"]>[number];

const data = (changes: Partial<SetupData> = {}): SetupData => ({
  status,
  llm: { provider: "ollama", url: "http://x", model: "qwen", default_model: "qwen", reachable: true, model_installed: true, installed: [{ name: "qwen", size: 1 }] },
  profile: { name: "Alex", searches: 1 },
  profileLoaded: true,
  sources: [{ name: "adzuna", label: "Adzuna", configured: true, origin: "settings" }],
  mail: [mailbox],
  calendar: [],
  mode: { mode: "real", forced_demo: false },
  ...changes,
});

describe("assistant de premier lancement", () => {
  it("opens on a fresh install, before any mode and without a profile", () => {
    expect(needsAssistant(data({ mode: { mode: null, forced_demo: false }, profile: null }))).toBe(true);
  });

  it("stays closed once a mode is chosen, in a forced demo, or when the gateway cannot say", () => {
    expect(needsAssistant(data({ profile: null }))).toBe(false);
    expect(needsAssistant(data({ mode: { mode: "demo", forced_demo: false }, profile: null }))).toBe(false);
    expect(needsAssistant(data({ mode: { mode: null, forced_demo: true }, profile: null }))).toBe(false);
    expect(needsAssistant(data({ mode: null, profile: null }))).toBe(false);
  });

  it("does not send back an install from before the assistant, which already has a profile", () => {
    expect(needsAssistant(data({ mode: { mode: null, forced_demo: false } }))).toBe(false);
  });

  it("leaves out the data step, which configures nothing", () => {
    expect(setupSteps(data()).map((step) => step.id)).toEqual(["systeme", "modele", "profil", "sources", "boite-mail", "calendrier"]);
  });
});

describe("écrans verrouillés", () => {
  it("opens everything once configured", () => {
    for (const path of ["/", "/offres", "/candidatures", "/calendrier", "/boite-de-reception"]) {
      expect(lockFor(path, data())).toBeNull();
    }
  });

  it("asks for the profile first", () => {
    const lock = lockFor("/candidatures", data({ profile: null }));
    expect(lock?.step).toBe("profil");
    expect(lockFor("/offres/12", data({ profile: null }))?.step).toBe("profil");
  });

  it("asks for a source before the offers, and a mailbox before the inbox", () => {
    const noSource = data({ sources: [{ name: "adzuna", label: "Adzuna", configured: false, origin: null }] });
    expect(lockFor("/offres", noSource)?.step).toBe("sources");
    expect(lockFor("/candidatures", noSource)).toBeNull();
    expect(lockFor("/boite-de-reception", data({ mail: [] }))?.step).toBe("boite-mail");
  });

  it("locks nothing in demo", () => {
    const demo = data({ mode: { mode: "demo", forced_demo: false }, profile: null, mail: [], sources: [] });
    expect(lockFor("/offres", demo)).toBeNull();
    expect(lockFor("/boite-de-reception", demo)).toBeNull();
  });
});

describe("téléchargement du modèle", () => {
  afterEach(() => vi.unstubAllGlobals());

  const stream = (chunks: string[]) =>
    new Response(
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
          controller.close();
        },
      }),
      { status: 200 },
    );

  it("reports progress line by line, even split across chunks", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => stream(['{"status":"pulling"}\n{"status":"down', 'loading","total":10,"completed":4}\n', '{"status":"success"}\n'])));
    const seen: string[] = [];
    await pullModel("qwen2.5:7b", (progress) => seen.push(`${progress.status}:${progress.completed ?? ""}`));
    expect(seen).toEqual(["pulling:", "downloading:4", "success:"]);
  });

  it("fails on an Ollama error line, or when the stream ends before success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => stream(['{"error":"pull model manifest: file does not exist"}\n'])));
    await expect(pullModel("absent", () => undefined)).rejects.toThrow(/file does not exist/);

    vi.stubGlobal("fetch", vi.fn(async () => stream(['{"status":"downloading"}\n'])));
    await expect(pullModel("qwen", () => undefined)).rejects.toThrow(/reprend/);
  });
});
