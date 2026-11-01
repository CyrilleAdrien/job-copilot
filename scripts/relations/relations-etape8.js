// Lancer depuis la racine : WEB_URL=http://localhost:3000 API_URL=http://localhost:8000 node scripts/relations/relations-etape8.js
const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:8000';
const { chromium } = require('playwright');
const out = (process.env.SHOTS_DIR ?? 'relations-shots') + '/';
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const api = (p, o) => fetch(API + '/api/applications' + p, o).then(r => r.status === 204 ? null : r.json());
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
  const s0 = await api('/stats');
  await p.goto(WEB + '/'); await p.waitForTimeout(3000);
  const main = () => p.locator('main').textContent();
  ok((await main()).includes(`${Math.round(s0.response_rate * 100)} %`), 'taux de réponse identique à l\'API');
  ok((await main()).includes(`${s0.responded} réponses sur ${s0.sent}`), 'détail des réponses identique');
  await p.screenshot({ path: out + 'e8-dashboard.png', fullPage: true });
  await p.locator('svg[aria-label="Candidatures envoyées par semaine"] rect[role="button"]').last().hover();
  await p.waitForTimeout(300);
  ok(/Semaine du/.test(await p.getByRole('status').first().textContent()), 'info-bulle au survol d\'une semaine');
  await p.screenshot({ path: out + 'e8-survol.png', clip: { x: 300, y: 250, width: 1140, height: 420 } });
  const first = s0.follow_ups[0];
  const row = p.locator('li', { hasText: first.title }).filter({ has: p.getByRole('button', { name: 'Relancée' }) }).first();
  const badge = () => p.locator('section, div').filter({ hasText: 'Relances à faire' }).locator('span.rounded-full').last().textContent();
  const before = Number(await badge());
  await row.getByRole('button', { name: 'Relancée' }).click(); await p.waitForTimeout(1500);
  ok(Number(await badge()) === before - 1, `« Relancée » retire la ligne des relances (${before} puis ${await badge()})`);
  ok((await api('/applications/' + first.id)).status === 'followed_up', 'statut Relancée enregistré');
  const s1 = await api('/stats');
  ok(s1.by_status.followed_up === s0.by_status.followed_up + (first.status === 'sent' ? 1 : 0), 'compteur Relancée du dashboard recalculé');
  await p.goto(WEB + '/candidatures'); await p.waitForTimeout(2500);
  const col = p.locator('section[role="listitem"]', { hasText: 'Relancée' });
  ok((await col.textContent()).includes(first.title), 'la carte est dans la colonne Relancée du Kanban');
  let target;
  for (const a of await api('/applications?status=sent')) { const d = await api('/applications/' + a.id); if (!d.events.some(e => ['technical_test','interview','offer','rejected'].includes(e.to_status))) { target = a; break; } }
  await api('/applications/' + target.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'interview' }) });
  const s2 = await api('/stats');
  ok(s2.by_status.interview === s1.by_status.interview + 1 && s2.responded === s1.responded + 1, 'un entretien depuis Candidatures met à jour le dashboard (cache vidé)');
  await p.goto(WEB + '/'); await p.waitForTimeout(2500);
  ok((await main()).includes(`${s2.responded} réponses sur ${s2.sent}`), 'écran du dashboard à jour');
  await api('/applications/' + target.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'sent' }) });
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.evaluate(() => { try { localStorage.setItem('jobcopilot.theme', 'dark'); } catch {} });
  await p.reload(); await p.waitForTimeout(2500);
  await p.screenshot({ path: out + 'e8-dashboard-sombre.png' });
  await p.setViewportSize({ width: 390, height: 900 }); await p.waitForTimeout(800);
  
  await b.close();
})();
