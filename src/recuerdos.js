// Recuerdos: «Un año atrás» (qué leías por estas fechas) y «Antes de seguir» (un recordatorio hecho con tus propios subrayados).
import { S, today } from './state.js';
import { lastReadOf, daysSince } from './metrics.js';
import { $, esc, openSheet, closeSheet } from './ui.js';

/** Libros que terminaste (o empezaste) hace un año, en una ventana de ±10 días. */
export function unAnioAtras() {
  const hoy = new Date(); hoy.setFullYear(hoy.getFullYear() - 1); const t0 = hoy.getTime(), cerca = f => f && Math.abs(new Date(f + 'T00:00:00').getTime() - t0) <= 10 * 864e5;
  const fin = S.books.find(b => b.s === 'leido' && !b.oculto && cerca(b.en));
  if (fin) return { b: fin, tipo: 'fin', notas: S.notes.filter(n => n.bookId === fin.id).length };
  const ini = S.books.find(b => !b.oculto && cerca(b.st));
  return ini ? { b: ini, tipo: 'ini', notas: S.notes.filter(n => n.bookId === ini.id).length } : null;
}

/** Si vuelves a un libro tras varios días, muestra lo último que subrayaste y escribiste. */
export function antesDeSeguir(b) {
  const dias = daysSince(lastReadOf(b.id)) ?? (b.dev ? Math.floor((Date.now() - b.dev.t) / 864e5) : null);
  if (dias == null || dias < 7 || !b.progress || b.progress >= .98) return;
  if (b.antesT && Date.now() - b.antesT < 864e5) return;
  const ns = S.notes.filter(n => n.bookId === b.id).sort((a, z) => (z.createdAt || 0) - (a.createdAt || 0)).slice(0, 3);
  if (!ns.length) return;
  b.antesT = Date.now();
  const o = openSheet(`<h3>Antes de seguir</h3><div class="sub">Lo dejaste hace ${dias} días, en el ${Math.round(b.progress * 100)} % del libro. Esto es lo último que guardaste:</div>
    <div style="display:grid;gap:10px;margin:14px 0">${ns.map(n => `<div class="recap2">«${esc(n.text.slice(0, 200))}${n.text.length > 200 ? '…' : ''}»${n.comment ? `<div class="small" style="margin-top:6px"><b>Tu nota:</b> ${esc(n.comment)}</div>` : ''}</div>`).join('')}</div>
    <div class="row"><button class="btn" id="asg">Continuar leyendo</button></div>`);
  $('#asg', o).onclick = closeSheet;
}
