// Lancer depuis la racine : WEB_URL=http://localhost:3000 API_URL=http://localhost:8000 node scripts/relations/relations-etape9.js
const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:8000';
// Étape 9 : boîte de démonstration -> statuts, Kanban, tableau de bord, fiche. Remet les données en état à la fin.
const { chromium } = require('playwright');
const out = (process.env.SHOTS_DIR ?? 'relations-shots') + '/';
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const call = (base) => (p, o) => fetch(base + p, o).then(r => r.status === 204 ? null : r.json());
const apps = call(API + '/api/applications'), mail = call(API + '/api/mail');
const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
(async () => {
  for (const a of await mail('/accounts')) await mail('/accounts/' + a.id, { method: 'DELETE' });
  const before = Object.fromEntries((await apps('/applications')).map(a => [a.id, a.status]));
  const s0 = await apps('/stats');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  const main = () => p.locator('main').textContent();
  try {
    await p.goto(WEB + '/boite-de-reception'); await p.waitForTimeout(2500);
    ok((await main()).includes('Connecter une boîte mail'), 'sans boîte : formulaire de connexion');
    await p.screenshot({ path: out + 'e9-connexion.png', fullPage: true });
    await p.getByRole('radio', { name: 'Démonstration' }).click();
    await p.getByRole('button', { name: 'Connecter la boîte' }).click(); await p.waitForTimeout(2000);
    ok((await main()).includes('Boîtes connectées'), 'boîte de démonstration connectée');
    await p.getByRole('button', { name: 'Synchroniser' }).click(); await p.waitForTimeout(3000);
    const notice = await p.getByRole('status').first().textContent();
    ok(/nouveaux? mails?/.test(notice), `résumé de la lecture : « ${notice.trim()} »`);
    const messages = await mail('/messages');
    ok(messages.length >= 4 && !messages.some(m => /lettre|newsletter/i.test(m.subject)), `${messages.length} mails gardés, la lettre d'information est ignorée`);
    const applied = messages.filter(m => m.status_applied);
    ok(applied.length >= 2, `${applied.length} statuts appliqués automatiquement`);
    for (const m of applied) {
      const a = await apps('/applications/' + m.application_id);
      const last = a.events[a.events.length - 1];
      ok(a.status === m.suggested_status && last.source === 'mail', `« ${a.title} » passe à ${a.status}, source mail`);
    }
    const s1 = await apps('/stats');
    ok(s1.responded > s0.responded, `tableau de bord recalculé (${s0.responded} puis ${s1.responded} réponses)`);
    await p.screenshot({ path: out + 'e9-boite.png', fullPage: true });

    // Mail non rattaché : on le rattache, il apparaît dans les échanges de la fiche.
    const loose = messages.find(m => !m.application_id);
    ok(Boolean(loose), 'un mail de recrutement reste à rattacher');
    const target = Object.keys(before).find(id => before[id] === 'sent' && !messages.some(m => m.application_id === id));
    const t = await apps('/applications/' + target);
    const row = p.locator('li', { hasText: loose.subject }).first();
    await row.getByRole('button', { name: 'Rattacher à une candidature' }).click();
    await p.getByRole('menuitem', { name: `${t.title}${t.company ? ' · ' + t.company : ''}` }).first().click(); await p.waitForTimeout(1200);
    ok((await mail('/messages?application_id=' + target)).length === 1, 'mail rattaché à la candidature choisie');
    // Correction de catégorie puis application du statut à la main.
    await row.getByRole('button', { name: 'Corriger la catégorie' }).click();
    await p.getByRole('menuitem', { name: 'Entretien' }).click(); await p.waitForTimeout(1000);
    await row.getByRole('button', { name: 'Passer à « Entretien »' }).click(); await p.waitForTimeout(1500);
    ok((await apps('/applications/' + target)).status === 'interview', 'statut appliqué depuis la boîte de réception');
    ok((await apps('/stats')).by_status.interview === s1.by_status.interview + 1, 'compteur Entretien du dashboard à jour');

    await p.goto(WEB + '/candidatures'); await p.waitForTimeout(2500);
    const col = p.locator('section[role="listitem"]', { hasText: 'Entretien' });
    ok((await col.textContent()).includes(t.title), 'la carte est dans la colonne Entretien du Kanban');
    await p.goto(WEB + '/candidatures?id=' + target); await p.waitForTimeout(2500);
    const sheet = p.getByRole('dialog', { name: 'Fiche de candidature' });
    const text = await sheet.textContent();
    ok(text.includes('Échanges') && text.includes(loose.subject), 'section Échanges sur la fiche');
    await p.goto(WEB + '/candidatures?id=' + applied[0].application_id); await p.waitForTimeout(2500);
    ok((await sheet.textContent()).includes("d'après un mail"), 'historique de la fiche : « d\'après un mail »');
    await sheet.screenshot({ path: out + 'e9-fiche.png' });

    await p.goto(WEB + '/'); await p.waitForTimeout(2500);
    const s2 = await apps('/stats');
    ok((await main()).includes(`${s2.responded} réponses sur ${s2.sent}`), 'écran du tableau de bord à jour');

    // Relecture : pas de doublon.
    const again = await mail('/sync', { method: 'POST' });
    ok(again.new === 0, 'une seconde lecture ne crée pas de doublon');

    await p.goto(WEB + '/boite-de-reception'); await p.waitForTimeout(2500);
    await p.getByRole('radio', { name: 'Tous' }).click(); await p.waitForTimeout(500);
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.evaluate(() => { try { localStorage.setItem('jobcopilot.theme', 'dark'); } catch {} });
    await p.reload(); await p.waitForTimeout(2500);
    await p.getByRole('radio', { name: 'Tous' }).click(); await p.waitForTimeout(500);
    await p.screenshot({ path: out + 'e9-boite-sombre.png', fullPage: true });
    await p.evaluate(() => { try { localStorage.removeItem('jobcopilot.theme'); } catch {} });

    // Déconnexion : les mails disparaissent, la fiche n'a plus d'échanges.
    await p.getByRole('button', { name: /^Déconnecter/ }).click(); await p.waitForTimeout(1500);
    ok((await mail('/messages')).length === 0 && (await main()).includes('Connecter une boîte mail'), 'déconnexion : mails supprimés');
  } finally {
    for (const a of await mail('/accounts')) await mail('/accounts/' + a.id, { method: 'DELETE' });
    for (const [id, status] of Object.entries(before)) {
      const a = await apps('/applications/' + id);
      if (a.status !== status) await apps('/applications/' + id, json('PATCH', { status }));
    }
    await b.close();
  }
})();
