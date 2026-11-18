// Colecciones inteligentes: listas con reglas que se actualizan solas cuando cambian tus libros.
import { S, saveMeta, newId, ST } from './state.js';
import { norm } from './importar.js';
import { visible } from './bloqueo.js';
import { $, $$, esc, openSheet, closeSheet, toast } from './ui.js';

export const smart = () => (S.meta.smart = S.meta.smart || []);
const dias = f => f ? Math.floor((Date.now() - new Date(f + 'T00:00:00')) / 864e5) : 0;

export function cumple(b, r) {
  if (r.estado && r.estado !== 'todos' && b.s !== r.estado) return false;
  if (r.pmax && (b.p || 0) > r.pmax) return false;
  if (r.pmin && (b.p || 0) < r.pmin) return false;
  if (r.formato && b.f !== r.formato) return false;
  if (r.autor && !norm(b.a).includes(norm(r.autor))) return false;
  if (r.genero && !(b.gen || []).some(g => norm(g).includes(norm(r.genero)))) return false;
  if (r.estrellas && (b.rating || 0) < r.estrellas) return false;
  if (r.espera && !(b.s === 'porleer' && dias(b.addedAt) >= r.espera)) return false;
  return true;
}
export const miembros = r => S.books.filter(b => visible(b) && cumple(b, r));

export const IDEAS = [
  { n: 'Cortos de menos de 200 páginas', r: { estado: 'porleer', pmax: 200 } },
  { n: 'Llevan más de un año esperando', r: { estado: 'porleer', espera: 365 } },
  { n: 'Mis 5 estrellas', r: { estado: 'leido', estrellas: 5 } },
  { n: 'Audiolibros por escuchar', r: { estado: 'porleer', formato: 'Audio' } },
  { n: 'Lecturas largas (más de 500 páginas)', r: { estado: 'todos', pmin: 500 } },
];
const CAMPOS = (r = {}) => `
  <label>Estado<select name="estado">${[['todos', 'Cualquiera'], ...Object.entries(ST).map(([k, v]) => [k, v.n])].map(([k, n]) => `<option value="${k}" ${(r.estado || 'todos') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
  <div class="two"><label>Páginas, mínimo<input name="pmin" type="number" min="0" step="50" value="${r.pmin || ''}" inputmode="numeric"></label><label>Páginas, máximo<input name="pmax" type="number" min="0" step="50" value="${r.pmax || ''}" inputmode="numeric"></label></div>
  <div class="two"><label>Formato<select name="formato"><option value="">Cualquiera</option>${['EPUB', 'Papel', 'Audio', 'PDF', 'Cómic'].map(f => `<option ${r.formato === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label><label>Calificación mínima<select name="estrellas"><option value="0">Cualquiera</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${r.estrellas === n ? 'selected' : ''}>${n}+ estrellas</option>`).join('')}</select></label></div>
  <div class="two"><label>Autor contiene<input name="autor" value="${esc(r.autor || '')}"></label><label>Género contiene<input name="genero" value="${esc(r.genero || '')}"></label></div>
  <label>Esperando hace al menos (días, solo «Por leer»)<input name="espera" type="number" min="0" step="30" value="${r.espera || ''}" inputmode="numeric"></label>`;
const leer = f => { const d = new FormData(f), r = {}; r.estado = d.get('estado'); for (const k of ['pmin', 'pmax', 'espera', 'estrellas']) { const v = +d.get(k); if (v) r[k] = v; } for (const k of ['formato', 'autor', 'genero']) { const v = String(d.get(k) || '').trim(); if (v) r[k] = v; } return r; };

export function editarSmart(sc, alGuardar) {
  const nuevo = !sc; sc = sc || { id: newId(), n: '', r: { estado: 'porleer' } };
  const o = openSheet(`<h3>${nuevo ? 'Colección inteligente' : 'Editar colección'}</h3><div class="sub">Los libros que cumplan las reglas entran solos.</div>
    <form class="form" id="sf" style="margin-top:12px"><label>Nombre<input name="n" required maxlength="40" value="${esc(sc.n)}" placeholder="Ej.: Para este fin de semana"></label>${CAMPOS(sc.r)}
    <div class="small" id="sc" style="min-height:20px"></div><div class="row"><button class="btn" type="submit">${nuevo ? 'Crear colección' : 'Guardar'}</button>${nuevo ? '' : '<button class="btn ghost" type="button" id="sd">Borrar</button>'}</div></form>`);
  const cuenta = () => { const n = miembros(leer($('#sf', o))).length; $('#sc', o).textContent = `${n} ${n === 1 ? 'libro cumple' : 'libros cumplen'} las reglas ahora`; };
  $('#sf', o).addEventListener('input', cuenta); cuenta();
  $('#sf', o).onsubmit = async e => {
    e.preventDefault(); sc.n = new FormData(e.target).get('n').trim(); sc.r = leer(e.target);
    if (nuevo) smart().push(sc); await saveMeta(); closeSheet(); toast('Colección guardada'); alGuardar && alGuardar();
  };
  $('#sd', o)?.addEventListener('click', async () => { S.meta.smart = smart().filter(x => x.id !== sc.id); if (S.ui.col === 's:' + sc.id) S.ui.col = null; await saveMeta(); closeSheet(); alGuardar && alGuardar(); });
}
