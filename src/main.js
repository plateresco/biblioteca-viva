import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { S, load, onChange } from './state.js';
import { $, $$, ic } from './ui.js';
import { drawLib, drawList, drawStats, drawDisc } from './views.js';
import { openReader } from './reader.js';
import { openCover } from './sheets.js';
import { isEnabled, hasToken, isSyncing, connect, syncNow } from './sync.js';

registerSW({ immediate: true });

const TABS = [['lib', 'Biblioteca', 'shelf'], ['list', 'Listas', 'list'], ['stats', 'Cifras', 'chart'], ['disc', 'Descubrir', 'spark']];
const ctx = { openReader, openSheet: id => openCover(id, { openReader }) };
const DRAW = { lib: drawLib, list: drawList, stats: drawStats, disc: drawDisc };

function shell() {
  $('#app').innerHTML = `<div class="screen">${TABS.map(([k]) => `<section class="view" id="v-${k}" ${k === S.ui.tab ? '' : 'hidden'}></section>`).join('')}</div>
    <nav class="tabs" role="tablist">${TABS.map(([k, n, i]) => `<button class="tab" role="tab" data-t="${k}" aria-selected="${k === S.ui.tab}">${ic(i)}<span>${n}</span></button>`).join('')}</nav>`;
  $$('.tab').forEach(b => b.onclick = () => go(b.dataset.t));
}
function go(t) {
  S.ui.tab = t;
  $$('.view').forEach(v => v.hidden = v.id !== 'v-' + t);
  $$('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.t === t));
  DRAW[t](ctx);
}
const redraw = () => DRAW[S.ui.tab](ctx);
onChange(redraw);
let rz;
new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => { if (S.ui.tab === 'lib') redraw(); }, 150); }).observe(document.body);

// Sincronización automática: unos segundos después de cada cambio, si ya hay sesión de Google abierta.
let st;
onChange(() => { if (isSyncing() || !isEnabled() || !hasToken()) return; clearTimeout(st); st = setTimeout(() => syncNow().catch(() => { }), 8000); });
async function autoStart() {
  if (!isEnabled() || !navigator.onLine) return;
  try { await connect(false); await syncNow(); } catch { /* sin sesión: se retoma al tocar la nube */ }
}
load().then(() => { shell(); redraw(); autoStart(); });
