// Búsqueda global (Ctrl K o /): libros, frases y acciones.
import { S, byId, coverUrl } from './state.js';
import { THEMES, P, setPref } from './prefs.js';
import { $, $$, esc, ic } from './ui.js';

let ctx = null;
export const setPaletteCtx = c => { ctx = c; };

export function openPalette() {
  if ($('#pal')) return;
  const o = document.createElement('div'); o.id = 'pal';
  o.innerHTML = `<div class="pbx" role="dialog" aria-label="Buscar"><div class="pin">${ic('search')}<input id="pq" placeholder="Buscar libros, frases o acciones" autocomplete="off" aria-label="Buscar"><kbd>Esc</kbd></div><div class="pres" id="pres"></div></div>`;
  document.body.appendChild(o);
  const input = $('#pq', o); let items = [], cur = 0;
  const close = () => { o.remove(); document.removeEventListener('keydown', onKey, true); };
  const ACTIONS = [
    ['Agregar un libro', 'plus', () => ctx.add()], ['Ir a Hoy', 'home', () => ctx.go('hoy')], ['Ir a la biblioteca', 'shelf', () => ctx.go('lib')], ['Ir a mis frases', 'quote', () => ctx.go('fr')],
    ['Ir a mis cifras', 'chart', () => ctx.go('stats')], ['Ir a Más', 'more', () => ctx.go('more')],
    ['Cambiar de tema de sala', 'palette', () => { const i = THEMES.findIndex(t => t[0] === P.theme); setPref('theme', THEMES[(i + 1) % THEMES.length][0]); }],
  ];
  const draw = () => {
    const q = input.value.trim().toLowerCase(); items = [];
    const bs = S.books.filter(b => !q || (b.t + ' ' + b.a).toLowerCase().includes(q)).slice(0, q ? 6 : 4);
    const qs = S.notes.filter(n => q && n.text.toLowerCase().includes(q)).slice(0, 3);
    const as = ACTIONS.filter(a => !q || a[0].toLowerCase().includes(q)).slice(0, q ? 5 : 7);
    let html = '';
    if (bs.length) { html += '<h5>Libros</h5>'; bs.forEach(b => { const cu = coverUrl(b); items.push(() => ctx.showBook(b.id)); html += `<button class="pi" data-n="${items.length - 1}"><span class="pc" style="--c1:${b.c1 || '#555'};${cu ? `--art:url('${cu}')` : ''}"></span><span><b>${esc(b.t)}</b><small>${esc(b.a)} · ${b.p} págs.</small></span></button>`; }); }
    if (qs.length) { html += '<h5>Frases</h5>'; qs.forEach(n => { items.push(() => ctx.go('fr')); html += `<button class="pi" data-n="${items.length - 1}"><span class="qi">${ic('quote')}</span><span><b>“${esc(n.text.slice(0, 70))}${n.text.length > 70 ? '…' : ''}”</b><small>${esc(n.title)}</small></span></button>`; }); }
    if (as.length) { html += '<h5>Acciones</h5>'; as.forEach(a => { items.push(a[2]); html += `<button class="pi" data-n="${items.length - 1}"><span class="qi">${ic(a[1])}</span><span><b>${a[0]}</b></span></button>`; }); }
    $('#pres', o).innerHTML = html || '<div class="pi" style="color:var(--muted)">Nada coincide con tu búsqueda.</div>';
    cur = 0; mark();
  };
  const mark = () => $$('.pi', o).forEach(e => e.classList.toggle('on', +e.dataset.n === cur));
  const run = n => { const f = items[n]; close(); f && f(); };
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); cur = Math.min(items.length - 1, cur + 1); mark(); $('.pi.on', o)?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cur = Math.max(0, cur - 1); mark(); $('.pi.on', o)?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); run(cur); }
  };
  document.addEventListener('keydown', onKey, true);
  input.addEventListener('input', draw);
  o.addEventListener('click', e => { if (e.target === o) close(); const b = e.target.closest('.pi[data-n]'); if (b) run(+b.dataset.n); });
  draw(); setTimeout(() => input.focus(), 20);
}
