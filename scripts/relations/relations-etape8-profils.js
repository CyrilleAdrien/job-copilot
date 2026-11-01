// Lancer depuis la racine : WEB_URL=http://localhost:3000 API_URL=http://localhost:8000 node scripts/relations/relations-etape8-profils.js
const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:8000';
const { chromium } = require('playwright');
const out = (process.env.SHOTS_DIR ?? 'relations-shots') + '/';
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const api = (p, o) => fetch(API + '/api/applications' + p, o).then(r => r.status === 204 ? null : r.json());
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto(WEB + '/'); await p.waitForTimeout(3000);
  const card = p.locator('div.rounded-card', { hasText: 'Profil qui fonctionne le mieux' });
  const text = await card.textContent();
  ok(text.includes('DevOps obtient le plus de retours positifs : 50 %'), 'synthèse : DevOps en tête, nom de la recherche lu dans le profil');
  ok(text.includes('Meilleur retour') && text.includes('Data Engineer'), 'badge et comparaison avec Data Engineer');
  await card.scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
  await card.screenshot({ path: out + 'e8b-profils.png' });
  // Un test technique enregistré depuis Candidatures remonte dans l'analyse.
  const s0 = await api('/stats'); const data0 = s0.by_search.find(o => o.search_id === 'data-engineer');
  let target;

  for (const a of await api('/applications?status=sent')) { if (a.search_id !== 'data-engineer') continue; const d = await api('/applications/' + a.id); if (!d.events.some(e => ['technical_test','interview','offer','rejected'].includes(e.to_status))) { target = a; break; } }
  await p.goto(WEB + '/candidatures'); await p.waitForTimeout(2500);
  const col = p.locator('section[role="listitem"]', { hasText: 'Test technique' });
  ok(await col.count() === 1, 'colonne Test technique dans le Kanban');
  const sentCol = p.locator('section[role="listitem"]').filter({ has: p.getByRole('heading', { name: 'Envoyée', exact: true }) });
  const art = sentCol.locator('article').filter({ hasText: target.title }).filter({ hasText: target.company ?? '' });
  const n = await art.count();
  // Si plusieurs cartes identiques, on prend la plus récemment modifiée (ordre du Kanban) : on vise donc la candidature correspondante.
  const all = (await api('/applications?status=sent')).filter(a => a.title === target.title && a.company === target.company);
  target = all[0];
  await art.first().getByRole('button', { name: /Changer le statut/ }).click();
  await p.getByRole('menuitem', { name: 'Passer à « Test technique »' }).click();
  await p.waitForTimeout(1500);
  const moved = await api('/applications/' + target.id);
  ok(moved.status === 'technical_test', 'statut Test technique enregistré depuis le Kanban');
  const data1 = (await api('/stats')).by_search.find(o => o.search_id === 'data-engineer');
  ok(data1.technical_tests === data0.technical_tests + 1 && data1.responded === data0.responded + 1, 'l\'analyse par profil compte le nouveau test technique');
  await p.locator('main').screenshot({ path: out + 'e8b-kanban-test.png' });
  await api('/applications/' + target.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'sent' }) });
  await p.goto(WEB + '/candidatures?id=' + target.id); await p.waitForTimeout(2000);
  ok((await p.locator('[role="dialog"], aside').last().textContent()).includes('Test technique'), 'historique de la fiche montre le test technique');
  await b.close();
})();
