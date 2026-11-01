// Lancer depuis la racine : WEB_URL=http://localhost:3000 API_URL=http://localhost:8000 node scripts/relations/kanban-glisser.js
const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:8000';
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const api = (p, o) => fetch(API + '/api/applications' + p, o).then(r => r.status === 204 ? null : r.json());
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(WEB + '/candidatures'); await p.waitForTimeout(2500);
  const result = await p.evaluate(async () => {
    const images = [];
    const orig = DataTransfer.prototype.setDragImage;
    DataTransfer.prototype.setDragImage = function (el, x, y) { images.push({ articles: el.querySelectorAll('article').length, tag: el.tagName, h: el.getBoundingClientRect().height, text: el.textContent.slice(0, 40) }); return orig.call(this, el, x, y); };
    const scroller = document.querySelector('[role="list"][aria-label="Candidatures par statut"]');
    const sent = [...scroller.querySelectorAll('section[role="listitem"]')].find(s => s.querySelector('h2').textContent === 'Envoyée');
    const handle = sent.querySelector('article [draggable="true"]');
    const title = handle.querySelector('button').textContent;
    const dt = new DataTransfer();
    const r = scroller.getBoundingClientRect();
    handle.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt, clientX: r.left + 100, clientY: r.top + 100 }));
    const start = scroller.scrollLeft;
    for (let i = 0; i < 60; i++) {
      scroller.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.right - 5, clientY: r.top + 200 }));
      await new Promise(res => requestAnimationFrame(res));
    }
    const scrolled = scroller.scrollLeft - start;
    const last = [...scroller.querySelectorAll('section[role="listitem"]')].pop();
    last.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.right - 50, clientY: r.top + 200 }));
    handle.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    const after = scroller.scrollLeft; await new Promise(res => setTimeout(res, 200));
    return { images, scrolled, stopped: scroller.scrollLeft === after, max: scroller.scrollWidth - scroller.clientWidth, title, lastLabel: last.querySelector('h2').textContent };
  });
  ok(result.images.length === 1 && result.images[0].tag === 'ARTICLE' && result.images[0].articles === 0 && result.images[0].h < 200, `image de glissement = la seule carte (${JSON.stringify(result.images[0])})`);
  ok(result.scrolled > 0 && result.scrolled >= Math.min(result.max, 200), `défilement automatique vers la droite (${result.scrolled}px sur ${result.max})`);
  ok(result.stopped, 'le défilement s\'arrête au dépôt');
  await p.waitForTimeout(1500);
  const moved = (await api('/applications?status=withdrawn')).find(a => a.title === result.title);
  ok(result.lastLabel === 'Abandonnée' && !!moved, `carte « ${result.title} » déposée dans la dernière colonne (${result.lastLabel})`);
  if (moved) await api('/applications/' + moved.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'sent' }) });
  await b.close();
})();
