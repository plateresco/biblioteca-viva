import { visible } from './bloqueo.js';
// Búsqueda global (Ctrl K o /): libros, frases y acciones.
import { S, byId, coverUrl } from './state.js';
import { THEMES, P, setPref } from './prefs.js';
import { $, $$, esc, ic } from './ui.js';
import { norm } from './importar.js';
const RECI = () => { try { return JSON.parse(localStorage.getItem('bv-recientes') || '[]'); } catch { return []; } };
const guardaReci = q => { q = q.trim(); if (q.length < 2) return; try { localStorage.setItem('bv-recientes', JSON.stringify([q, ...RECI().filter(x => x !== q)].slice(0, 6))); } catch { } };
let paginas = null;

let ctx = null;
export const setPaletteCtx = c => { ctx = c; };

export function openPalette() {
  if ($('#pal')) return;
  const o = document.createElement('div'); o.id = 'pal';
  o.innerHTML = `<div class="pbx" role="dialog" aria-label="Buscar"><div class="pin">${ic('search')}<input id="pq" placeholder="Buscar, o escribe # @ &gt;" autocomplete="off" aria-label="Buscar"><kbd>Esc</kbd></div><div class="pres" id="pres"></div></div>`;
  document.body.appendChild(o);
  const input = $('#pq', o); let items = [], cur = 0;
  const close = () => { o.remove(); document.removeEventListener('keydown', onKey, true); };
  const ACTIONS = [
    ['Agregar un libro', 'plus', () => ctx.add()], ['Ir a Hoy', 'home', () => ctx.go('hoy')], ['Ir a la biblioteca', 'shelf', () => ctx.go('lib')], ['Ir a mis frases', 'quote', () => ctx.go('fr')],
    ['Ir a mis cifras', 'chart', () => ctx.go('stats')], ['Ir a Más', 'more', () => ctx.go('more')],
    ['Cambiar de tema de sala', 'palette', () => { const i = THEMES.findIndex(t => t[0] === P.theme); setPref('theme', THEMES[(i + 1) % THEMES.length][0]); }],
  ];
  const fila = (icono, t, sub, fn, extra = '') => { items.push(fn); return `<button class="pi" data-n="${items.length - 1}"><span class="qi">${ic(icono)}</span><span><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span>${extra}</button>`; };
  const libroFila = b => { const cu = coverUrl(b); items.push(() => ctx.showBook(b.id)); return `<button class="pi" data-n="${items.length - 1}"><span class="pc" style="--c1:${b.c1 || '#555'};${cu ? `--art:url('${cu}')` : ''}"></span><span><b>${esc(b.t)}</b><small>${esc(b.a)}</small></span></button>`; };
  const frasesDe = lista => lista.slice(0, 4).map(n => fila('quote', `“${esc(n.text.slice(0, 70))}${n.text.length > 70 ? '…' : ''}”`, esc(n.title || ''), () => ctx.go('fr'))).join('');
  const draw = () => {
    const raw = input.value.trim(), q = raw.toLowerCase(); items = []; let html = '';
    const pref = raw[0], t = norm(raw.slice(1));
    const chips = `<div class="pchips">${[['#', 'Etiquetas'], ['@', 'Autores'], ['>', 'Páginas']].map(([k, n]) => `<button class="chip" data-pf="${k}"><b>${k}</b> ${n}</button>`).join('')}</div>`;
    if (pref === '#') {
      import('./frases.js').then(m => {
        if (input.value.trim()[0] !== '#') return; const tags = m.todasEtiquetas().filter(([k]) => norm(k).startsWith(t)); let h = chips;
        if (!tags.length) h += '<div class="pi" style="color:var(--muted)">No hay esa etiqueta.</div>';
        items = []; tags.slice(0, 4).forEach(([k, c]) => { h += `<h5>#${esc(k)} · ${c} ${c === 1 ? 'frase' : 'frases'}</h5>`; const fr = S.notes.filter(n => (n.tags || []).includes(k)); h += frasesDe(fr).replace(/data-n="(\d+)"/g, (_, i) => `data-n="${i}"`); items.push(() => { m.setEtiqueta(k); ctx.go('fr'); }); h += `<button class="pi" data-n="${items.length - 1}"><span class="qi">${ic('arrow')}</span><span><b>Ver todas con #${esc(k)}</b></span></button>`; });
        $('#pres', o).innerHTML = h; cur = 0; mark();
      }); html = chips + '<div class="pi" style="color:var(--muted)">Buscando…</div>';
    } else if (pref === '@') {
      const autores = [...new Set(S.books.filter(visible).map(b => b.a))].filter(a => norm(a).includes(t)).slice(0, 4); html = chips;
      if (!autores.length) html += '<div class="pi" style="color:var(--muted)">No hay ese autor.</div>';
      autores.forEach(a => { html += `<h5>${esc(a)}</h5>`; S.books.filter(b => visible(b) && b.a === a).slice(0, 5).forEach(b => { html += libroFila(b); }); html += frasesDe(S.notes.filter(n => byId(n.bookId)?.a === a)); });
    } else if (pref === '>') {
      if (!paginas) { import('./more.js').then(m => { paginas = m.paginasMas(); if (input.value.trim()[0] === '>') draw(); }); html = chips + '<div class="pi" style="color:var(--muted)">Cargando…</div>'; }
      else { const ps = paginas.filter(([, n]) => norm(n).includes(t)).slice(0, 8); html = chips + (ps.length ? '<h5>Páginas de Más</h5>' : '<div class="pi" style="color:var(--muted)">Ninguna página coincide.</div>'); ps.forEach(([k, n]) => { html += fila('arrow', esc(n), '', () => import('./more.js').then(m => { m.openMore(k); ctx.go('more'); })); }); }
    } else if (!raw) {
      const reci = RECI(); html = chips + (reci.length ? `<h5>Recientes</h5><div class="pchips">${reci.map(r => `<button class="chip" data-rc="${esc(r)}">${ic('clock')} ${esc(r)}</button>`).join('')}</div>` : '');
      S.books.filter(visible).slice(0, 4).forEach(b => { if (!html.includes('<h5>Libros')) html += '<h5>Libros</h5>'; html += libroFila(b); });
      html += '<h5>Acciones</h5>'; ACTIONS.slice(0, 7).forEach(a => { html += fila(a[1], a[0], '', a[2]); });
    } else {
      const bs = S.books.filter(b => visible(b) && (b.t + ' ' + b.a).toLowerCase().includes(q)).slice(0, 6);
      const qs = S.notes.filter(n => n.text.toLowerCase().includes(q)).slice(0, 3);
      const as = ACTIONS.filter(a => a[0].toLowerCase().includes(q)).slice(0, 5);
      if (bs.length) { html += '<h5>Libros</h5>'; bs.forEach(b => { html += libroFila(b); }); }
      if (qs.length) { html += '<h5>Frases</h5>'; html += frasesDe(qs); }
      if (as.length) { html += '<h5>Acciones</h5>'; as.forEach(a => { html += fila(a[1], a[0], '', a[2]); }); }
      html = chips + (html || '<div class="pi" style="color:var(--muted)">Nada coincide con tu búsqueda.</div>');
    }
    $('#pres', o).innerHTML = html; cur = 0; mark();
  };
  const mark = () => $$('.pi', o).forEach(e => e.classList.toggle('on', +e.dataset.n === cur));
  const run = n => { const f = items[n]; guardaReci(input.value); close(); f && f(); };
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); cur = Math.min(items.length - 1, cur + 1); mark(); $('.pi.on', o)?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cur = Math.max(0, cur - 1); mark(); $('.pi.on', o)?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); run(cur); }
  };
  document.addEventListener('keydown', onKey, true);
  input.addEventListener('input', draw);
  o.addEventListener('click', e => { const pf = e.target.closest('[data-pf]'); if (pf) { input.value = pf.dataset.pf; input.focus(); draw(); return; } const rc = e.target.closest('[data-rc]'); if (rc) { input.value = rc.dataset.rc; input.focus(); draw(); return; } if (e.target === o) close(); const b = e.target.closest('.pi[data-n]'); if (b) run(+b.dataset.n); });
  draw(); setTimeout(() => input.focus(), 20);
}
