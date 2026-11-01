// Lancer depuis la racine : WEB_URL=http://localhost:3000 API_URL=http://localhost:8000 node scripts/relations/relations-etape10.js
const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:8000';
// Étape 10 : calendrier -> candidature, fiche, tableau de bord, Kanban, CalDAV (Radicale local), flux .ics.
// Prérequis : stack locale (up.sh) et Radicale sur 127.0.0.1:5232 (cyrille / secret-app, calendrier entretiens).
const { chromium } = require('playwright');
const out = (process.env.SHOTS_DIR ?? 'relations-shots') + '/';
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const call = (base) => (p, o) => fetch(base + p, o).then(r => r.status === 204 ? null : r.json());
const apps = call(API + '/api/applications'), cal = call(API + '/api/calendar');
const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const dav = async () => {
  const r = await fetch('http://127.0.0.1:5232/cyrille/entretiens/', { method: 'PROPFIND', headers: { Depth: '1', Authorization: 'Basic ' + Buffer.from('cyrille:secret-app').toString('base64') } });
  const hrefs = [...(await r.text()).matchAll(/<href>([^<]+\.ics)<\/href>/g)].map(m => m[1]);
  return Promise.all(hrefs.map(h => fetch('http://127.0.0.1:5232' + h, { headers: { Authorization: 'Basic ' + Buffer.from('cyrille:secret-app').toString('base64') } }).then(x => x.text())));
};
(async () => {
  for (const a of await cal('/accounts')) await cal('/accounts/' + a.id, { method: 'DELETE' });
  for (const e of await cal('/events')) await cal('/events/' + e.id, { method: 'DELETE' });
  const target = (await apps('/applications?status=sent'))[0];
  const s0 = await apps('/stats');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const main = () => p.locator('main').textContent();
  try {
    await p.goto(WEB + '/calendrier'); await p.waitForTimeout(2500);
    ok((await main()).includes('Rien de prévu'), 'calendrier vide');
    // Connexion CalDAV depuis l'écran, sur un vrai serveur (Radicale).
    await p.getByRole('radio', { name: 'Autre' }).click();
    await p.getByLabel('Adresse CalDAV').fill('http://localhost:5232');
    await p.getByLabel('Identifiant', { exact: true }).fill('cyrille');
    await p.getByLabel("Mot de passe d'application").fill('secret-app');
    await p.getByRole('button', { name: 'Chercher mes calendriers' }).click(); await p.waitForTimeout(2000);
    ok(await p.getByRole('radio', { name: /entretiens/ }).count() === 1, 'calendriers du serveur listés');
    await p.getByRole('button', { name: 'Connecter ce calendrier' }).click(); await p.waitForTimeout(2000);
    ok((await main()).includes('Calendrier connecté') && (await cal('/accounts')).length === 1, 'calendrier CalDAV connecté');

    // Planifier depuis la fiche de candidature.
    await p.goto(WEB + '/candidatures?id=' + target.id); await p.waitForTimeout(2500);
    const sheet = p.getByRole('dialog', { name: 'Fiche de candidature' });
    ok((await sheet.textContent()).includes('Aucun rendez-vous prévu'), 'fiche : aucun rendez-vous');
    await sheet.getByRole('link', { name: 'Planifier' }).click(); await p.waitForTimeout(2500);
    const editor = p.getByRole('dialog', { name: 'Nouvel événement' });
    ok(await editor.locator('#event-application').inputValue() === target.id, 'candidature présélectionnée');
    ok((await editor.getByLabel('Titre').inputValue()).startsWith('Entretien'), `titre proposé : ${await editor.getByLabel('Titre').inputValue()}`);
    ok((await editor.textContent()).includes('Passer la candidature à « Entretien »'), 'proposition de passer à Entretien');
    const day = new Date(Date.now() + 3 * 86400000); const key = day.toISOString().slice(0, 10);
    await editor.getByLabel('Date').fill(key);
    await editor.getByLabel('Heure').fill('14:00');
    await editor.getByLabel('Lieu').fill('Paris');
    await editor.getByLabel('Lien de visio').fill('https://meet.example/abc');
    await editor.getByRole('button', { name: 'Ajouter au calendrier' }).click(); await p.waitForTimeout(2500);
    ok((await p.getByRole('status').first().textContent()).includes('passée à « Entretien »'), 'message : candidature passée à Entretien');
    const a1 = await apps('/applications/' + target.id);
    ok(a1.status === 'interview' && a1.events.at(-1).source === 'manual', 'statut Entretien enregistré');
    const [ev] = await cal('/events');
    ok(ev.synced_at && !ev.sync_error, 'événement recopié (synced_at)');
    let remote = await dav();
    ok(remote.length === 1 && remote[0].includes(`UID:${ev.id}@job-copilot`) && remote[0].includes('LOCATION:Paris'), 'événement présent sur le serveur CalDAV');
    ok((await main()).includes(ev.title) && (await main()).includes('dans 3 j'), 'visible dans « À venir »');
    ok(await p.locator('[role="gridcell"] button', { hasText: ev.title }).count() === 1, 'visible dans la grille du mois');
    await p.screenshot({ path: out + 'e10-calendrier.png', fullPage: true });
    const google = await p.getByRole('link', { name: 'Google Agenda' }).first().getAttribute('href');
    ok(google.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'), 'lien Google Agenda prérempli');

    // Modification -> recopiée.
    await p.locator('[role="gridcell"] button', { hasText: ev.title }).click(); await p.waitForTimeout(800);
    const edit = p.getByRole('dialog', { name: "Modifier l'événement" });
    await edit.getByLabel('Lieu').fill('Lyon');
    await edit.screenshot({ path: out + 'e10-modifier.png' });
    await edit.getByRole('button', { name: 'Enregistrer' }).click(); await p.waitForTimeout(2000);
    remote = await dav();
    ok(remote[0].includes('LOCATION:Lyon') && /SEQUENCE:[1-9]/.test(remote[0]), 'modification recopiée (lieu, SEQUENCE incrémenté)');
    const feed = await (await fetch(WEB + '/api/calendar/feed.ics')).text();
    ok(feed.includes('LOCATION:Lyon') && feed.includes('BEGIN:VALARM'), 'flux .ics à jour avec rappel');

    // Relations : fiche, tableau de bord, Kanban.
    await p.goto(WEB + '/candidatures?id=' + target.id); await p.waitForTimeout(2500);
    ok((await sheet.textContent()).includes(ev.title), 'fiche : section Entretiens');
    await sheet.screenshot({ path: out + 'e10-fiche.png' });
    await p.goto(WEB + '/candidatures'); await p.waitForTimeout(2500);
    ok((await p.locator('section[role="listitem"]', { hasText: 'Entretien' }).textContent()).includes(target.title), 'Kanban : colonne Entretien');
    await p.goto(WEB + '/'); await p.waitForTimeout(2500);
    ok((await main()).includes('Prochains rendez-vous') && (await main()).includes(ev.title), 'tableau de bord : prochains rendez-vous');
    ok((await apps('/stats')).by_status.interview === s0.by_status.interview + 1, 'statistiques recalculées');
    await p.locator('main').getByRole('link', { name: ev.title }).click(); await p.waitForTimeout(2500);
    ok(await p.getByRole('dialog', { name: "Modifier l'événement" }).count() === 1, 'lien du tableau de bord : ouvre l\'événement');

    // Suppression -> retirée du serveur ; mode sombre ; déconnexion.
    await p.getByRole('dialog', { name: "Modifier l'événement" }).getByRole('button', { name: 'Supprimer' }).click();
    await p.getByRole('alertdialog').getByRole('button', { name: 'Supprimer' }).click(); await p.waitForTimeout(2000);
    ok((await cal('/events')).length === 0 && (await dav()).length === 0, 'suppression : retirée de l\'app et du serveur CalDAV');
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.reload(); await p.waitForTimeout(2000);
    await p.screenshot({ path: out + 'e10-sombre.png' });
    await p.getByRole('button', { name: /^Déconnecter/ }).click(); await p.waitForTimeout(1500);
    ok((await cal('/accounts')).length === 0 && (await main()).includes('Chercher mes calendriers'), 'déconnexion');
  } finally {
    for (const a of await cal('/accounts')) await cal('/accounts/' + a.id, { method: 'DELETE' });
    for (const e of await cal('/events')) await cal('/events/' + e.id, { method: 'DELETE' });
    if ((await apps('/applications/' + target.id)).status !== 'sent') await apps('/applications/' + target.id, json('PATCH', { status: 'sent' }));
    await b.close();
  }
})();
