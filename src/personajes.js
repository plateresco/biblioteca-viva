// Cuaderno de personajes de cada libro: ficha, relaciones, frases ligadas y un mapa. Sin spoilers: solo se ven los que ya aparecieron.
import { S, byId, saveMeta, newId } from './state.js';
import { $, $$, esc, openSheet, closeSheet, toast } from './ui.js';

const mapa = () => (S.meta.pjs = S.meta.pjs || {});
export const delLibro = b => (mapa()[b.uid] = mapa()[b.uid] || []);
const COLS = ['#8E2F2A', '#2F6F8A', '#4E7D55', '#C9A24A', '#7A3042', '#33505C', '#6B4A8A', '#B5654A', '#3F7F7A'];
const color = i => COLS[i % COLS.length];

function grafo(lista) {
  if (lista.length < 2) return '';
  const R = 52, cx = 130, cy = 70, pos = lista.map((p, i) => { const a = i / lista.length * Math.PI * 2 - Math.PI / 2; return { x: cx + R * 1.5 * Math.cos(a), y: cy + R * Math.sin(a) }; });
  let l = ''; lista.forEach((p, i) => (p.rel || []).forEach(id => { const j = lista.findIndex(q => q.id === id); if (j > i) l += `<line x1="${pos[i].x}" y1="${pos[i].y}" x2="${pos[j].x}" y2="${pos[j].y}"/>`; }));
  const nodos = lista.map((p, i) => `<g><circle cx="${pos[i].x}" cy="${pos[i].y}" r="11" fill="${color(i)}"/><text x="${pos[i].x}" y="${pos[i].y + 24}" text-anchor="middle">${esc(p.n.split(' ')[0])}</text></g>`).join('');
  return `<svg class="pgraph" viewBox="0 0 260 150" role="img" aria-label="Relaciones entre personajes">${l}${nodos}</svg>`;
}

export function abrirPersonajes(b, todos = false) {
  const pct = Math.round((b.progress || 0) * 100), todosP = delLibro(b), visibles = todosP.filter(p => todos || (p.pct ?? 0) <= pct + 1), ocultos = todosP.length - visibles.length;
  const o = openSheet(`<h3>Personajes</h3><div class="sub">${esc(b.t)}${ocultos ? ` · ${ocultos} oculto${ocultos > 1 ? 's' : ''} para no adelantarte` : ''}</div>
    ${grafo(visibles)}
    <div style="display:grid;gap:8px;margin:12px 0;max-height:38vh;overflow:auto">${visibles.map((p, i) => `<button class="pjrow" data-id="${p.id}"><i style="background:${color(todosP.indexOf(p))}">${esc(p.n[0] || '?')}</i><span><b>${esc(p.n)}</b><small>${esc((p.d || '').slice(0, 70))}${(p.rel || []).length ? ` · ${(p.rel || []).length} relaciones` : ''}</small></span></button>`).join('') || '<div class="small">Aún no hay personajes en este libro.</div>'}</div>
    <div class="row"><button class="btn" id="pna">Agregar personaje</button>${ocultos || todos ? `<button class="btn ghost" id="pnt">${todos ? 'Ocultar los que no aparecieron' : 'Mostrar todos'}</button>` : ''}</div>`);
  $$('.pjrow', o).forEach(x => x.onclick = () => editar(b, todosP.find(p => p.id === x.dataset.id), todos));
  $('#pna', o).onclick = () => editar(b, null, todos);
  $('#pnt', o)?.addEventListener('click', () => { closeSheet(); abrirPersonajes(b, !todos); });
}

function editar(b, p, todos) {
  const nuevo = !p, lista = delLibro(b); p = p || { id: newId(), n: '', d: '', pct: Math.round((b.progress || 0) * 100), rel: [], notas: [] };
  const notas = S.notes.filter(n => n.bookId === b.id).slice(-30).reverse();
  const o = openSheet(`<h3>${nuevo ? 'Nuevo personaje' : esc(p.n)}</h3><form class="form" id="pf">
    <label>Nombre<input name="n" required maxlength="40" value="${esc(p.n)}"></label>
    <label>Quién es (descripción corta)<textarea name="d" rows="3" maxlength="300">${esc(p.d || '')}</textarea></label>
    <label>Apareció en el avance del libro (%)<input name="pct" type="number" min="0" max="100" value="${p.pct ?? 0}" inputmode="numeric"></label>
    ${lista.filter(q => q.id !== p.id).length ? `<div class="small" style="margin-top:6px">Relaciones</div><div style="display:grid;gap:4px">${lista.filter(q => q.id !== p.id).map(q => `<label class="chk2"><input type="checkbox" name="rel" value="${q.id}" ${(p.rel || []).includes(q.id) ? 'checked' : ''}> ${esc(q.n)}</label>`).join('')}</div>` : ''}
    ${notas.length ? `<div class="small" style="margin-top:8px">Frases donde aparece</div><div style="display:grid;gap:4px;max-height:22vh;overflow:auto">${notas.map(n => `<label class="chk2"><input type="checkbox" name="nt" value="${esc(n.uid)}" ${(p.notas || []).includes(n.uid) ? 'checked' : ''}> ${esc(n.text.slice(0, 80))}</label>`).join('')}</div>` : ''}
    <div class="row" style="margin-top:12px"><button class="btn" type="submit">Guardar</button>${nuevo ? '' : '<button class="btn ghost" type="button" id="pdl">Borrar</button>'}</div></form>`);
  $('#pf', o).onsubmit = async e => {
    e.preventDefault(); const d = new FormData(e.target);
    p.n = d.get('n').trim(); p.d = (d.get('d') || '').trim(); p.pct = Math.max(0, Math.min(100, +d.get('pct') || 0)); p.rel = d.getAll('rel'); p.notas = d.getAll('nt');
    // las relaciones van en los dos sentidos
    for (const q of lista) { q.rel = (q.rel || []).filter(id => id !== p.id); if (p.rel.includes(q.id)) q.rel.push(p.id); }
    if (nuevo) lista.push(p); await saveMeta(); closeSheet(); toast('Personaje guardado'); abrirPersonajes(b, todos);
  };
  $('#pdl', o)?.addEventListener('click', async () => { S.meta.pjs[b.uid] = lista.filter(q => q.id !== p.id); lista.forEach(q => { q.rel = (q.rel || []).filter(id => id !== p.id); }); await saveMeta(); closeSheet(); abrirPersonajes(b, todos); });
}

// Desde Más: se elige el libro.
export function elegirLibro(ctxCierre) {
  const l = S.books.filter(x => !x.oculto).sort((a, z) => (z.upd || 0) - (a.upd || 0)).slice(0, 60);
  const o = openSheet(`<h3>Personajes</h3><div class="sub">Elige un libro.</div><div style="display:grid;gap:6px;margin-top:10px;max-height:55vh;overflow:auto">${l.map(b => `<button class="pjrow" data-id="${b.id}"><span><b>${esc(b.t)}</b><small>${esc(b.a)} · ${delLibro(b).length} personajes</small></span></button>`).join('')}</div>`);
  $$('.pjrow', o).forEach(x => x.onclick = () => { closeSheet(); abrirPersonajes(byId(+x.dataset.id)); });
}
