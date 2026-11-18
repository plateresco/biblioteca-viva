// Datos para los widgets de la pantalla de inicio de Android (libro actual, racha y meta de hoy).
import { A } from './native.js';
import { S, onChange } from './state.js';
import { P } from './prefs.js';
import { pagesToday, streak, weekDots } from './metrics.js';
import { planes, calculo, diasHasta } from './plan.js';

let t = 0;
/** Lo que el aviso diario puede decir además de la meta: préstamo por vencer y plan de lectura atrasado. */
export function contextoAvisos() {
  const out = {};
  try {
    const pr = S.books.filter(b => b.loan && b.loan.due).map(b => ({ b, d: diasHasta(b.loan.due) })).filter(x => x.d <= 2).sort((a, z) => a.d - z.d)[0];
    if (pr) out.prestamo = { txt: `«${pr.b.t}» ${pr.d <= 0 ? 'ya se debería devolver' : pr.d === 1 ? 'vence mañana' : 'vence en ' + pr.d + ' días'}: devolver a ${pr.b.loan.to}` };
    const d30 = new Date(); d30.setDate(d30.getDate() - 30); const ini = d30.toISOString().slice(0, 10);
    const prom = S.log.filter(l => l.date >= ini).reduce((a, l) => a + (l.pages || 0), 0) / 30;
    const pl = planes().map(b => ({ b, c: calculo(b) })).filter(x => x.c.tarde || (x.c.ppd > Math.max(8, prom * 1.5))).sort((a, z) => z.c.ppd - a.c.ppd)[0];
    if (pl) out.plan = { txt: pl.c.tarde ? `Pasó la fecha de «${pl.b.t}»: aún te quedan ${pl.c.quedan} páginas` : `Vas con retraso con «${pl.b.t}»: necesitas ${pl.c.ppd} páginas por día` };
  } catch { }
  return out;
}
export function empujarWidgets() {
  if (!A || !A.widgets) return;
  clearTimeout(t);
  t = setTimeout(() => {
    try {
      const cur = S.books.filter(b => b.s === 'leyendo' && !b.oculto).sort((a, b) => (b.upd || 0) - (a.upd || 0))[0];
      const nq = S.notes.length ? S.notes[S.ui.qi % S.notes.length] : null;
      try { const av = { prestamos: true, meta: true, plan: true, desde: '22:00', hasta: '08:00', ...(P.avisos || {}) }, cx = contextoAvisos(); A.avisos && A.avisos(JSON.stringify({ ...cx, on: { prestamos: av.prestamos, meta: av.meta, plan: av.plan }, silencio: { d: av.desde, h: av.hasta } })); } catch { }
      A.widgets(JSON.stringify({
        frase: nq ? String(nq.text).replace(/\s+/g, ' ').slice(0, 220) : '', fraseLibro: nq ? String(nq.title || '') : '',
        id: cur ? cur.id : 0, t: cur ? cur.t : '', a: cur ? cur.a : '', p: cur ? cur.p : 0, r: cur ? (cur.r || 0) : 0,
        pct: cur ? Math.round((cur.r || 0) / Math.max(1, cur.p) * 100) : 0,
        racha: streak(), hoy: pagesToday(), meta: P.goalDay || 20, semana: weekDots().map(d => (d.on ? 1 : 0)),
      }));
    } catch { /* los widgets son un extra */ }
  }, 800);
}
export function iniciarWidgets() { if (A && A.widgets) { onChange(empujarWidgets); empujarWidgets(); } }
