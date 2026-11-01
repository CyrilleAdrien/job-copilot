import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type APIRequestContext } from "@playwright/test";

const PROFILE_YAML = path.resolve(__dirname, "../../examples/profile.example.yaml");
const CALENDAR_PASSWORD = "e2e-calendar-password";
// Un PNG de 1 pixel : assez pour le recadrage de la photo dans le navigateur.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
  "base64",
);

const read = async (request: APIRequestContext, url: string) => {
  const response = await request.get(url);
  expect(response.ok(), `${url} : ${response.status()}`).toBeTruthy();
  return response.json();
};

const unzipList = (file: string) => execFileSync("unzip", ["-Z1", file], { encoding: "utf8" }).trim().split("\n");
const unzipAll = (file: string) => execFileSync("unzip", ["-p", file], { maxBuffer: 1 << 26 });

test("parcours complet, du profil à la suppression des données", async ({ page, request }) => {
  let applicationId = "";
  let eventTitle = "";

  await test.step("une requête venue d'un autre site est refusée", async () => {
    const response = await request.delete("/api/data", { headers: { origin: "https://evil.example" } });
    expect(response.status()).toBe(403);
    const framed = await request.get("/reglages");
    expect(framed.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
  });

  await test.step("le profil s'importe et s'affiche sur tout le site", async () => {
    await page.goto("/bienvenue");
    await page.locator('input[type="file"]').first().setInputFiles(PROFILE_YAML);
    await expect(page).toHaveURL(/\/profil$/);
    const sidebar = page.getByRole("link", { name: "Mon profil" });
    await expect(sidebar).toContainText("Alex Martin");

    await page.getByLabel("Choisir une photo de profil").setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: PIXEL,
    });
    await expect(sidebar.getByRole("img", { name: "Photo de profil" })).toBeVisible();
  });

  await test.step("les offres se collectent", async () => {
    await page.goto("/offres");
    await expect(page.getByRole("button", { name: /Déplier l'offre/ }).first()).toBeVisible();
  });

  const offers = await read(request, "/api/jobs/offers");
  const offer = offers.items[0];

  await test.step("un CV se génère pour une offre", async () => {
    await page.goto(`/offres/${offer.id}`);
    await page.getByRole("button", { name: /^Générer le CV/ }).click();
    await expect(page.getByRole("button", { name: "Postuler" })).toBeVisible();
  });

  await test.step("la candidature se crée puis passe à Envoyée", async () => {
    const popup = page.context().waitForEvent("page");
    await page.getByRole("button", { name: "Postuler" }).click();
    await (await popup).close();
    await page.getByRole("button", { name: "Marquer comme envoyée" }).click();
    await expect
      .poll(async () => (await read(request, "/api/applications/applications"))[0]?.status)
      .toBe("sent");

    const applications = await read(request, "/api/applications/applications");
    expect(applications).toHaveLength(1);
    applicationId = applications[0].id;
    // « Postuler » est proposé pendant la génération : le CV se rattache dès qu'il est prêt.
    await expect
      .poll(async () => (await read(request, `/api/applications/applications/${applicationId}`)).cv_document_id, {
        timeout: 90_000,
      })
      .toBeTruthy();

    await page.goto("/candidatures");
    await expect(page.getByRole("listitem", { name: /^Envoyée, 1/ })).toContainText(applications[0].title);
  });

  await test.step("une réponse de recruteur change le statut, et on peut y répondre", async () => {
    await page.goto("/boite-de-reception");
    await page.getByRole("radio", { name: "Démonstration" }).click();
    await page.getByRole("button", { name: "Connecter la boîte" }).click();
    const panel = page.getByRole("complementary", { name: "Boîtes connectées, envoyés et traités" });
    await expect(panel.getByRole("img", { name: "Connectée" })).toBeVisible();

    await page.getByRole("button", { name: "Synchroniser" }).click();
    await expect
      .poll(async () => (await read(request, "/api/mail/messages")).length)
      .toBeGreaterThan(0);
    await expect
      .poll(async () => (await read(request, `/api/applications/applications/${applicationId}`)).events.length)
      .toBeGreaterThan(2);

    await page.reload();
    await page.getByRole("radio", { name: "Tous" }).click();
    await page.getByRole("button", { name: "Répondre" }).first().click();
    const composer = page.getByRole("form", { name: "Répondre à ce mail" });
    await expect(composer.getByRole("button", { name: /Aide à la rédaction/ })).toBeDisabled();
    await composer.getByLabel("Message").fill("Bonjour, je suis disponible mardi à 14 h.");
    // Une faute de frappe dans le domaine bloque l'envoi tant qu'elle n'est pas tranchée.
    const recipient = composer.getByLabel("À", { exact: true });
    const original = await recipient.inputValue();
    await recipient.fill("alex@gamil.com");
    await expect(composer.getByRole("alert")).toContainText("alex@gmail.com");
    await expect(composer.getByRole("button", { name: "Envoyer" })).toBeDisabled();
    await composer.getByRole("button", { name: "Corriger" }).click();
    await expect(recipient).toHaveValue("alex@gmail.com");
    await expect(composer.getByRole("button", { name: "Envoyer" })).toBeEnabled();
    await recipient.fill(original);
    await composer.getByRole("button", { name: "Envoyer" }).click();
    await expect(composer).toHaveCount(0);
    await expect(panel.getByRole("list", { name: "Envoyés" })).toContainText("Re: ");
  });

  await test.step("un entretien s'ajoute au calendrier et au flux .ics", async () => {
    await page.goto(`/calendrier`);
    await page.getByRole("button", { name: "Nouvel événement" }).click();
    const editor = page.getByRole("dialog", { name: "Nouvel événement" });
    await editor.locator("#event-application").selectOption(applicationId);
    const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    await editor.getByLabel("Date").fill(day);
    await editor.getByLabel("Heure").fill("14:00");
    eventTitle = await editor.getByLabel("Titre").inputValue();
    expect(eventTitle).not.toBe("");
    await editor.getByRole("button", { name: "Ajouter au calendrier" }).click();
    await expect(page.locator("main")).toContainText(eventTitle);

    const feed = await (await request.get("/api/calendar/feed.ics")).text();
    expect(feed.replace(/\r\n /g, "")).toContain("BEGIN:VEVENT");
    expect((await read(request, `/api/calendar/events`))[0].application_id).toBe(applicationId);
  });

  await test.step("le tableau de bord reflète tout cela", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toContainText("Candidatures envoyées");
    await expect(page.locator("main")).toContainText(eventTitle);
    const stats = await read(request, "/api/applications/stats");
    expect(stats.sent).toBe(1);
  });

  await test.step("un mot de passe enregistré n'est jamais rendu ni exporté", async () => {
    const created = await request.post("/api/calendar/accounts", {
      data: {
        provider: "demo",
        url: "demo",
        username: "alex",
        password: CALENDAR_PASSWORD,
        calendar_url: "demo/entretiens",
        calendar_name: "Entretiens",
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    expect(await created.text()).not.toContain(CALENDAR_PASSWORD);
  });

  await test.step("l'export contient tout, sans aucun secret", async () => {
    await page.goto("/reglages");
    const started = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exporter" }).click();
    const download = await started;
    expect(download.suggestedFilename()).toMatch(/^job-copilot-\d{4}-\d{2}-\d{2}\.zip$/);
    const file = await download.path();

    const names = unzipList(file);
    for (const service of ["profile", "jobs", "documents", "applications", "mail", "calendar"]) {
      expect(names).toContain(`job-copilot/${service}.json`);
    }
    expect(names).toContain("job-copilot/profile.yaml");
    expect(names).toContain("job-copilot/manifest.json");
    expect(names.some((name) => /photo\.(jpg|png|webp)$/.test(name))).toBeTruthy();
    expect(names.some((name) => /documents\/cv-.+\.pdf$/.test(name))).toBeTruthy();

    const content = unzipAll(file).toString("latin1");
    expect(content).not.toContain(CALENDAR_PASSWORD);
    expect(content).not.toContain("password_encrypted");
    expect(content).not.toContain("gAAAA"); // préfixe de tout jeton Fernet

    const manifest = JSON.parse(
      execFileSync("unzip", ["-p", file, "job-copilot/manifest.json"], { encoding: "utf8" }),
    );
    expect(manifest.missing).toEqual([]);
    expect(manifest.services.applications.applications).toBe(1);
  });

  await test.step("la suppression demande confirmation puis efface tout", async () => {
    await page.getByRole("button", { name: "Tout supprimer" }).click();
    const dialog = page.getByRole("dialog", { name: "Tout supprimer ?" });
    await dialog.getByRole("button", { name: "Annuler" }).click();
    await expect(dialog).toHaveCount(0);
    expect(await read(request, "/api/applications/applications")).toHaveLength(1);

    await page.getByRole("button", { name: "Tout supprimer" }).click();
    await dialog.getByRole("button", { name: "Tout supprimer" }).click();
    await expect(page).toHaveURL(/\/bienvenue$/);
    await expect(page.getByRole("link", { name: "Mon profil" })).not.toContainText("Alex Martin");
    await expect(page.getByRole("link", { name: "Mon profil" }).getByRole("img")).toHaveCount(0);
    expect(await page.evaluate(() => window.localStorage.length)).toBe(0);

    expect((await request.get("/api/profile/")).status()).toBe(404);
    expect(await read(request, "/api/applications/applications")).toEqual([]);
    expect(await read(request, "/api/mail/accounts")).toEqual([]);
    expect(await read(request, "/api/mail/messages")).toEqual([]);
    expect(await read(request, "/api/calendar/accounts")).toEqual([]);
    expect(await read(request, "/api/calendar/events")).toEqual([]);
    expect((await read(request, "/api/applications/stats")).sent).toBe(0);
    expect((await request.get(`/api/documents/documents/${offer.id}`)).ok()).toBeFalsy();
  });

  await test.step("l'application repart de zéro après la suppression", async () => {
    const imported = await request.post("/api/profile/import", {
      headers: { "content-type": "application/yaml" },
      data: readFileSync(PROFILE_YAML),
    });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    const refreshed = await request.post("/api/jobs/refresh");
    expect((await refreshed.json()).stored).toBeGreaterThan(0);
    const [fresh] = (await read(request, "/api/jobs/offers")).items;

    const generation = await request.post("/api/documents/generations", { data: { offer_id: fresh.id } });
    expect(generation.ok(), await generation.text()).toBeTruthy();
    const { id } = await generation.json();
    // La candidature naît de l'événement document.generated : le groupe de lecture a survécu.
    await expect
      .poll(async () => (await read(request, `/api/documents/generations/${id}`)).status, { timeout: 90_000 })
      .toBe("done");
    await expect
      .poll(async () => (await read(request, "/api/applications/applications")).length)
      .toBe(1);
  });
});
