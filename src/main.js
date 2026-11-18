import './style.css';
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
import '@fontsource/figtree/latin-700.css';
import '@fontsource/young-serif/latin-400.css';
import '@fontsource/newsreader/latin-400.css';
import '@fontsource/newsreader/latin-500.css';
import '@fontsource/newsreader/latin-400-italic.css';
import '@fontsource/newsreader/latin-500-italic.css';
import './style2.css';
import { registerSW } from 'virtual:pwa-register';
import { S, load, onChange, byId } from './state.js';
import { P, setPref, THEMES } from './prefs.js';
import { $, $$, ic, reduce } from './ui.js';
import { drawLib, selectBook, isWide } from './lib.js';
import { drawHoy } from './hoy.js';
import { openCover, openAdd } from './sheets.js';
import { openScene, sceneOpen } from './scene.js';
import { openPalette, setPaletteCtx } from './palette.js';
import { isEnabled, hasToken, isSyncing, connect, syncNow, syncLabel, onSyncStatus } from './sync.js';
import { checkReminder } from './reminder.js';
import { resetSpineCache } from './spine.js';
import { shrinkImage } from './color.js';
import { importarEpubs } from './sheets.js';
import { iniciarBloqueo } from './bloqueo.js';
import { currentBook } from './hoy.js';
import { avisarSiHay } from './actualizar.js';
import { closeSheet } from './ui.js';
import { closeScene } from './scene.js';
import { persistBook } from './state.js';

if (!window.AndroidApp) registerSW({ immediate: true });   // dentro de la app los archivos ya están guardados en el teléfono

const TABS = [['hoy', 'Hoy', 'home'], ['lib', 'Biblioteca', 'shelf'], ['fr', 'Frases', 'quote'], ['stats', 'Cifras', 'chart'], ['more', 'Más', 'more']];
// Las pantallas menos usadas y el lector (que trae la librería de EPUB) se descargan recién cuando se necesitan.
// Cada pantalla pesada se carga cuando se abre. Las rutas deben ser literales: así Vite las empaqueta como archivos propios.
const DRAW = { hoy: drawHoy, lib: drawLib, fr: c => import('./frases.js').then(x => x.drawFrases(c)), stats: c => import('./cifras.js').then(x => x.drawStats(c)), more: c => import('./more.js').then(x => x.drawMore(c)) };
// Cada tipo de libro se abre con su lector: EPUB, PDF, cómic (CBZ) o audiolibro.
const openReader = (id, ...a) => {
  const b = byId(id);
  if (b?.f === 'PDF') return import('./pdfreader.js').then(m => m.openPdf(id, ...a));
  if (b?.f === 'Cómic') return import('./comicreader.js').then(m => m.openComic(id, ...a));
  if (b?.audio) return import('./audioplayer.js').then(m => m.openAudio(id));
  return import('./reader.js').then(m => m.openReader(id, ...a));
};
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
    ${TABS.map(([k, n, i]) => `<button class="tab" role="tab" data-t="${k}" aria-selected="${k === S.ui.tab}">${ic(i)}<span>${n}</span></button>${k === 'lib' ? `<button class="tabplus" id="tplus" aria-label="Agregar">${ic('plus')}</button>` : ''}`).join('')}
    <div class="grow"></div><button class="syncchip" id="schip">${ic('cloud')}<span id="slab">${syncLabel()}</span></button></nav>
    <div class="screen">${TABS.map(([k]) => `<section class="view" id="v-${k}" ${k === S.ui.tab ? '' : 'hidden'}></section>`).join('')}</div>
    <aside id="detail" aria-label="Ficha del libro"></aside>`;
  $$('.tab').forEach(b => b.onclick = () => go(b.dataset.t));
  $('#tplus').onclick = () => import('./tanda5.js').then(m => m.menuMas(ctx));
  $('#schip').onclick = () => go('more');
}
onSyncStatus(() => { const l = $('#slab'); if (l) l.textContent = syncLabel(); });

export function go(t) {
  if (!reduce && S.ui.tab !== t && document.startViewTransition && document.querySelector('.view:not([hidden])')) { try { let hecho = false; const corre = () => { if (!hecho) { hecho = true; go0(t); } }; const vt = document.startViewTransition(corre); [vt.ready, vt.finished].forEach(x => x && x.catch(() => { })); setTimeout(corre, 350); return; } catch { } }
  go0(t);
}
function go0(t) {
  S.ui.tab = t;
  $$('.view').forEach(v => v.hidden = v.id !== 'v-' + t);
  $$('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.t === t));
  $('#app').classList.toggle('withdetail', t === 'lib');
  DRAW[t](ctx);
  $('#v-' + t).scrollTop = 0;
  if (window.AndroidApp) setTimeout(() => import('./native.js').then(n => n.pintarBarras()), 150);   // las barras del sistema siguen al color de cada pantalla
}
let redrawQ = 0;
const redraw = () => { if (sceneOpen()) return; DRAW[S.ui.tab](ctx); };
onChange(() => { if (redrawQ) return; redrawQ = requestAnimationFrame(() => { redrawQ = 0; redraw(); }); });   // varios cambios seguidos = un solo dibujo
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
load().then(() => {
  if (!S.books.length) S.ui.tab = 'lib'; shell(); go(S.ui.tab); autoStart(); checkReminder(ctx);
  // Los títulos de los lomos se miden con la tipografía real: al terminar de cargar las fuentes se vuelven a calcular.
  Promise.all(['600 12px Figtree', '700 12px Figtree', '400 12px "Young Serif"', 'italic 500 12px Newsreader'].map(f => document.fonts.load(f).catch(() => { })))
    .then(() => { resetSpineCache(); if (!sceneOpen()) redraw(); });
  // En segundo plano: las portadas grandes de antes se reducen (menos memoria la próxima vez que abras la app).
  const idle = window.requestIdleCallback || (f => setTimeout(f, 800));
  const slim = async () => {
    const big = S.books.filter(b => b.cover && b.cover.size > 110000 && !b.slim).slice(0, 4);
    for (const b of big) { const small = await shrinkImage(b.cover); b.slim = true; if (small !== b.cover) b.cover = small; await persistBook(b); }
    if (S.books.some(b => b.cover && b.cover.size > 110000 && !b.slim)) idle(slim);
  };
  idle(slim);
});

// ---- Registro de errores (para el Diagnóstico de Más): se guardan los últimos 40 ----
(function () {
  const guardar = (tipo, msg, donde) => {
    try {
      const l = JSON.parse(localStorage.getItem('bv-errs') || '[]');
      l.push({ t: Date.now(), tipo, msg: String(msg).slice(0, 300), donde: String(donde || '').slice(0, 120) });
      localStorage.setItem('bv-errs', JSON.stringify(l.slice(-40)));
    } catch { }
  };
  addEventListener('error', e => guardar('error', e.message, (e.filename || '').split('/').pop() + ':' + e.lineno));
  addEventListener('unhandledrejection', e => guardar('promesa', e.reason && (e.reason.message || e.reason), e.reason && e.reason.stack && e.reason.stack.split('\n')[1]));
})();
// En la app no hay menú de «copiar imagen / abrir enlace» al mantener pulsado (estorba al arrastrar libros).
if (window.AndroidApp) addEventListener('contextmenu', e => { if (!e.target.closest('input,textarea,[contenteditable]')) e.preventDefault(); });

// ---- Dentro de la app de Android ----
// Botón Atrás: cierra primero lo que esté abierto (búsqueda, hoja, escena, lector); después vuelve a Hoy; si ya está en Hoy, la app pasa a segundo plano.
window.__atras = () => {
  if ($('#pal')) { $('#pal').remove(); return true; }
  if ($('#reader')) { $('#rBack')?.click(); return true; }
  if (sceneOpen()) { closeScene(); return true; }
  if ($('#sheet')) { closeSheet(); return true; }
  if (S.ui.tab === 'lib' && S.ui.sel && innerWidth >= 1000) { S.ui.sel = null; go('lib'); return true; }
  if (S.ui.tab === 'more' && window.__moreVolver && window.__moreVolver()) return true;
  if (S.ui.tab !== 'hoy') { go('hoy'); return true; }
  return false;
};
// Un EPUB abierto desde otra app (administrador de archivos, WhatsApp, navegador…)
window.__abrirArchivo = async (url, nombre) => {
  try {
    const blob = await (await fetch(url)).blob();
    await importarEpubs([new File([blob], nombre || 'libro.epub', { type: 'application/epub+zip' })], b => ctx.showBook(b.id));
  } catch { console.error('abrirArchivo'); }
};
if (window.AndroidApp) setTimeout(avisarSiHay, 4000);
setTimeout(() => import('./tanda5.js').then(m => m.avisarNovedades()), 2500);
if (window.AndroidApp) setTimeout(() => import('./tanda5.js').then(m => m.aplicarFondoDiario()), 6000);
if (window.AndroidApp) import('./widgets.js').then(w => w.iniciarWidgets());
// Atajos al mantener pulsado el ícono, y botones de los widgets
window.__compartirTexto = t => import('./frases.js').then(m => m.guardarTextoCompartido(t));
window.__atajo = a => {
  if (a === 'continuar') { const c = currentBook(); if (c?.hasFile) ctx.openReader(c.id); else if (c) ctx.openSheet(c.id); else go('lib'); }
  else if (a === 'agregar') { go('lib'); import('./sheets.js').then(m => m.openAdd()); }
  else if (a === 'escanear') { go('lib'); import('./sheets.js').then(m => m.openAdd('isbn')); }
  else if (a === 'pagina') { go('fr'); setTimeout(() => import('./frases.js').then(m => m.escanearPagina && m.escanearPagina()), 300); }
};

// Bloqueo con PIN (si lo activaste) y revisión de logros nuevos
iniciarBloqueo();
{ let lg = 0; const rv = () => import('./retos.js').then(m => m.revisarLogros()); onChange(() => { clearTimeout(lg); lg = setTimeout(rv, 4000); }); setTimeout(rv, 3500); }

// Arrastrar y soltar: un EPUB, PDF, cómic, audiolibro o el archivo de subrayados de Kindle sobre la ventana
addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
addEventListener('drop', async e => {
  const fs = [...(e.dataTransfer?.files || [])]; if (!fs.length) return; e.preventDefault();
  const { tipoDe, importarDocumento, importarAudio } = await import('./documentos.js');
  const audio = fs.filter(f => tipoDe(f) === 'audio'), otros = fs.filter(f => tipoDe(f) && tipoDe(f) !== 'audio' && tipoDe(f) !== 'txt'), txt = fs.filter(f => tipoDe(f) === 'txt');
  const { toast } = await import('./ui.js');
  for (const f of txt) { const { leerClippings, abrirImportClippings } = await import('./clippings.js'); if (/clipping|subrayado|notas/i.test(f.name) || leerClippings(await f.text()).size) { abrirImportClippings(); break; } }
  for (const f of otros) { try { const r = await importarDocumento(f); toast(r.estado === 'nuevo' ? `Agregado: ${r.libro.t}` : `Ya lo tenías: ${r.libro.t}`); } catch (err) { console.error(err); toast(`No pude leer «${f.name}»`); } }
  if (audio.length) { try { const r = await importarAudio(audio); toast(r.estado === 'nuevo' ? `Audiolibro agregado: ${r.libro.t}` : 'Ya tenías ese audiolibro'); } catch (err) { console.error(err); toast('No pude leer los audios'); } }
});
