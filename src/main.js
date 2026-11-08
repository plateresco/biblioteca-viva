import './style.css';
import './style2.css';
import { registerSW } from 'virtual:pwa-register';
import { S, load, onChange, byId } from './state.js';
import { P, setPref, THEMES } from './prefs.js';
import { $, $$, ic } from './ui.js';
import { drawLib, selectBook, isWide } from './lib.js';
import { drawHoy } from './hoy.js';
import { drawFrases } from './frases.js';
import { drawStats } from './cifras.js';
import { drawMore } from './more.js';
import { openReader } from './reader.js';
import { openCover, openAdd } from './sheets.js';
import { openScene, sceneOpen } from './scene.js';
import { openPalette, setPaletteCtx } from './palette.js';
import { isEnabled, hasToken, isSyncing, connect, syncNow, syncLabel, onSyncStatus } from './sync.js';
import { checkReminder } from './reminder.js';

registerSW({ immediate: true });

const TABS = [['hoy', 'Hoy', 'home'], ['lib', 'Biblioteca', 'shelf'], ['fr', 'Frases', 'quote'], ['stats', 'Cifras', 'chart'], ['more', 'Más', 'more']];
const DRAW = { hoy: drawHoy, lib: drawLib, fr: drawFrases, stats: drawStats, more: drawMore };
const ctx = {
  openReader, openSheet: id => openCover(id, { openReader }), add: openAdd,
  go: t => go(t),
  showBook(id) {
    const b = byId(id); if (!b) return;
    S.ui.filter = 'todos'; S.ui.col = null; S.ui.sel = id; go('lib');
    requestAnimationFrame(() => {
      const el = $(`#v-lib .spine[data-id="${id}"], #v-lib .btile[data-id="${id}"], #v-lib .lrow[data-id="${id}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (!isWide() && el?.classList.contains('spine')) setTimeout(() => openScene(id, el, ctx), 350);
    });
  },
};
setPaletteCtx(ctx);

function shell() {
  $('#app').innerHTML = `<nav class="tabs" role="tablist" aria-label="Secciones"><div class="logo">BV<b>Biblioteca</b></div>
    ${TABS.map(([k, n, i]) => `<button class="tab" role="tab" data-t="${k}" aria-selected="${k === S.ui.tab}">${ic(i)}<span>${n}</span></button>`).join('')}
    <div class="grow"></div><button class="syncchip" id="schip">${ic('cloud')}<span id="slab">${syncLabel()}</span></button></nav>
    <div class="screen">${TABS.map(([k]) => `<section class="view" id="v-${k}" ${k === S.ui.tab ? '' : 'hidden'}></section>`).join('')}</div>
    <aside id="detail" aria-label="Ficha del libro"></aside>`;
  $$('.tab').forEach(b => b.onclick = () => go(b.dataset.t));
  $('#schip').onclick = () => go('more');
}
onSyncStatus(() => { const l = $('#slab'); if (l) l.textContent = syncLabel(); });

export function go(t) {
  S.ui.tab = t;
  $$('.view').forEach(v => v.hidden = v.id !== 'v-' + t);
  $$('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.t === t));
  $('#app').classList.toggle('withdetail', t === 'lib');
  DRAW[t](ctx);
  $('#v-' + t).scrollTop = 0;
}
const redraw = () => { if (sceneOpen()) return; DRAW[S.ui.tab](ctx); };
onChange(redraw);
let rz, lastWide = innerWidth >= 1000;
new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => { const w = innerWidth >= 1000; if (S.ui.tab === 'lib' || w !== lastWide) { lastWide = w; redraw(); } }, 150); }).observe(document.body);

// Atajos de teclado (en el PC)
let gPending = false, gT;
addEventListener('keydown', e => {
  const t = e.target, typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
  if (typing || e.ctrlKey || e.metaKey || e.altKey || $('#reader') || $('#pal') || $('#sheet') || sceneOpen()) return;
  const k = e.key.toLowerCase();
  if (gPending) { gPending = false; clearTimeout(gT); const m = { h: 'hoy', b: 'lib', f: 'fr', c: 'stats', m: 'more' }[k]; if (m) { e.preventDefault(); go(m); } return; }
  if (k === '/') { e.preventDefault(); openPalette(); }
  else if (k === 'g') { gPending = true; gT = setTimeout(() => { gPending = false; }, 1200); }
  else if (k === 't') { const i = THEMES.findIndex(x => x[0] === P.theme); setPref('theme', THEMES[(i + 1) % THEMES.length][0]); }
  else if (k === 'n') { e.preventDefault(); openAdd(); }
  else if (k === 'enter' && S.ui.tab === 'lib' && S.ui.sel) { const b = byId(S.ui.sel); if (b?.hasFile) openReader(b.id); }
  else if (k === 'e' && S.ui.tab === 'lib' && S.ui.sel) { openCover(S.ui.sel, { openReader }); }
});

// Sincronización automática: unos segundos después de cada cambio, si ya hay sesión de Google abierta.
let st;
onChange(() => { if (isSyncing() || !isEnabled() || !hasToken()) return; clearTimeout(st); st = setTimeout(() => syncNow().catch(() => { }), 8000); });
async function autoStart() {
  if (!isEnabled() || !navigator.onLine) return;
  try { await connect(false); await syncNow(); } catch { /* sin sesión: se retoma al tocar la nube */ }
}
load().then(() => { if (!S.books.length) S.ui.tab = 'lib'; shell(); go(S.ui.tab); autoStart(); checkReminder(ctx); });
