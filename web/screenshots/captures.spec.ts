import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Captures du README, prises sur la stack jetable (`make screenshots`) avec le profil d'exemple
 * et les données de démonstration : aucune donnée personnelle n'apparaît.
 */

const PROFILE_YAML = path.resolve(__dirname, "../../examples/profile.example.yaml");
const OUTPUT = path.resolve(__dirname, "../../docs/images");

const read = async (request: APIRequestContext, url: string) => {
  const response = await request.get(url);
  expect(response.ok(), `${url} : ${response.status()}`).toBeTruthy();
  return response.json();
};

const send = async (request: APIRequestContext, method: "post" | "patch", url: string, data: object) => {
  const response = await request[method](url, { data });
  expect(response.ok(), `${url} : ${await response.text()}`).toBeTruthy();
  return response.json();
};

const at = (days: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

async function capture(page: Page, name: string) {
  // Laisse finir les compteurs et transitions d'arrivée.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUTPUT, `${name}.png`) });
}

test("captures du README", async ({ page, request }) => {
  let offerId = 0;

  await test.step("données de démonstration", async () => {
    const imported = await request.post("/api/profile/import", {
      headers: { "content-type": "application/yaml" },
      data: readFileSync(PROFILE_YAML),
    });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    await send(request, "post", "/api/jobs/refresh?force=true", {});
    const offers = (await read(request, "/api/jobs/offers?sort=relevance")).items;
    expect(offers.length).toBeGreaterThan(5);
    offerId = offers[0].id;

    // Le CV de la première offre ; la candidature naît de l'événement document.generated.
    const { id } = await send(request, "post", "/api/documents/generations", { offer_id: offerId, letter: true });
    await expect
      .poll(async () => (await read(request, `/api/documents/generations/${id}`)).status, { timeout: 120_000 })
      .toBe("done");
    await expect.poll(async () => (await read(request, "/api/applications/applications")).length).toBe(1);

    const statuses = ["sent", "sent", "sent", "followed_up", "followed_up", "interview", "technical_test", "draft"];
    const created = [];
    for (const [index, status] of statuses.entries()) {
      const offer = offers[index + 1];
      if (!offer) break;
      const application = await send(request, "post", "/api/applications/applications", { offer_id: offer.id });
      if (status !== "draft") {
        await send(request, "patch", `/api/applications/applications/${application.id}`, { status: "sent" });
      }
      if (!["draft", "sent"].includes(status)) {
        await send(request, "patch", `/api/applications/applications/${application.id}`, { status });
      }
      created.push(application);
    }

    await send(request, "post", "/api/mail/accounts", {
      email: "alex.martin@exemple.fr",
      host: "demo",
      password: "demo",
    });
    await send(request, "post", "/api/mail/sync", {});

    const interview = created[3] ?? created[0];
    await send(request, "post", "/api/calendar/events", {
      title: `Entretien ${interview.company ?? ""}`.trim(),
      starts_at: at(2, 10),
      ends_at: at(2, 11),
      video_url: "https://meet.exemple.fr/entretien",
      application_id: interview.id,
    });
    await send(request, "post", "/api/calendar/events", {
      kind: "technical_test",
      title: `Test technique ${created[4]?.company ?? ""}`.trim(),
      starts_at: at(4, 14),
      ends_at: at(4, 16),
      application_id: created[4]?.id ?? null,
    });
  });

  await test.step("écrans", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toContainText("Candidatures envoyées");
    await capture(page, "tableau-de-bord");

    await page.goto("/offres");
    await expect(page.getByRole("button", { name: /Déplier l'offre/ }).first()).toBeVisible();
    await capture(page, "offres");

    await page.goto(`/offres/${offerId}`);
    await expect(page.getByRole("button", { name: "Modifier", exact: true })).toBeVisible();
    await capture(page, "cv-genere");

    await page.goto("/candidatures");
    await expect(page.getByRole("listitem", { name: /^Envoyée/ })).toBeVisible();
    await capture(page, "candidatures");

    await page.goto("/boite-de-reception");
    await page.getByRole("list", { name: "Mails" }).getByRole("button").first().click();
    await capture(page, "boite-de-reception");

    await page.goto("/calendrier");
    await capture(page, "calendrier");

    await page.goto("/aide");
    await expect(page.getByRole("heading", { name: "5. Boîte mail" })).toBeVisible();
    await capture(page, "aide");

    await page.goto("/profil");
    await expect(page.getByRole("link", { name: "Mon profil" })).toContainText("Alex Martin");
    await capture(page, "profil");
  });
});
