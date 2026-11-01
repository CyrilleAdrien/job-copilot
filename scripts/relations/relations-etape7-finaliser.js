// Lancer depuis la racine : WEB_URL=http://localhost:3000 API_URL=http://localhost:8000 node scripts/relations/relations-etape7-finaliser.js
const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:8000';
const { chromium } = require('playwright');
const out = (process.env.SHOTS_DIR ?? 'relations-shots') + '/';
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const api = (p, o) => fetch(API + '/api/applications' + p, o).then(r => r.status === 204 ? null : r.json());
(async () => {
  const gen = await fetch(API + '/api/documents/generations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offer_id: 22, search: 'devops' }) });
  ok(gen.status < 300, 'génération lancée pour l\'offre 22 (sans candidature)');
  let app22;
  for (let i = 0; i < 40 && !app22; i++) { await new Promise(r => setTimeout(r, 1000)); app22 = (await api('/applications')).find(a => a.offer_id === 22); }
  ok(app22 && app22.status === 'draft' && app22.cv_document_id, 'la génération crée la candidature « À envoyer » avec le CV');
  ok(app22 && app22.search_id === 'devops', 'recherche d\'origine reprise');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto(WEB + '/candidatures'); await p.waitForTimeout(2500);
  await p.getByRole('button', { name: 'Ajouter une candidature' }).first().click();
  await p.getByLabel('Poste').fill('Ingénieur Plateforme'); await p.getByLabel('Entreprise').fill('Studio Nord');
  await p.getByRole('button', { name: 'Ajouter', exact: true }).click(); await p.waitForTimeout(1200);
  const panel = p.locator('section[aria-label="Candidatures à finaliser"]');
  await panel.locator('> button').click(); await p.waitForTimeout(600);
  const text = await panel.textContent();
  ok(text.includes(app22.title), 'candidature générée présente dans À finaliser');
  ok(/Ingénieur Plateforme[\s\S]*Ajoutée à la main/.test(text) || text.includes('Ajoutée à la main'), 'ajout manuel dans À finaliser, sans exigence CV/lettre');
  const manualRow = panel.locator('li', { hasText: 'Ingénieur Plateforme' });
  ok(await manualRow.getByText('Générer').count() === 0, 'pas de bouton Générer pour un ajout manuel');
  const noDocs = (await api('/applications')).filter(a => a.status === 'draft' && a.source !== 'manuel' && !a.cv_document_id && !a.letter_document_id);
  ok(noDocs.every(a => !text.includes(a.title + a.company)), 'les brouillons sans document restent hors de À finaliser');
  await p.screenshot({ path: out + 'e7f-a-finaliser.png' });
  await p.goto(WEB + '/offres'); await p.waitForTimeout(2000);
  await p.getByText('Favoris', { exact: true }).first().click(); await p.waitForTimeout(1500);
  ok(/À envoyer/.test(await p.locator('article', { hasText: app22.title }).first().textContent()), 'badge À envoyer sur l\'offre 22 dans Offres');
  const m = (await api('/applications')).find(a => a.title === 'Ingénieur Plateforme');
  await api('/applications/' + m.id, { method: 'DELETE' });
  await b.close();
})();
