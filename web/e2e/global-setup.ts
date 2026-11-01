import type { FullConfig } from "@playwright/test";

async function read(base: string, path: string) {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error(`${path} : ${response.status}`);
  return response.json();
}

/** Le parcours finit par tout supprimer : il refuse toute stack qui n'est pas vide et en démonstration. */
export default async function globalSetup(config: FullConfig) {
  const base = config.projects[0].use.baseURL as string;
  const problems: string[] = [];

  const [mailProviders, calendarProviders, mailboxes, calendars, applications, profile] = await Promise.all([
    read(base, "/api/mail/providers"),
    read(base, "/api/calendar/providers"),
    read(base, "/api/mail/accounts"),
    read(base, "/api/calendar/accounts"),
    read(base, "/api/applications/applications"),
    fetch(`${base}/api/profile/`),
  ]);
  if (!mailProviders.some((provider: { id: string }) => provider.id === "demo")) problems.push("MAIL_DEMO inactif");
  if (!calendarProviders.some((provider: { id: string }) => provider.id === "demo")) problems.push("CALENDAR_DEMO inactif");
  if (mailboxes.length > 0) problems.push(`${mailboxes.length} boîte(s) mail connectée(s)`);
  if (calendars.length > 0) problems.push(`${calendars.length} calendrier(s) connecté(s)`);
  if (applications.length > 0) problems.push(`${applications.length} candidature(s) enregistrée(s)`);
  if (profile.status !== 404) problems.push("un profil existe déjà");

  if (problems.length > 0) {
    throw new Error(`ARRÊT, rien n'a été modifié : ${base} n'est pas une stack jetable.\n- ${problems.join("\n- ")}`);
  }
}
