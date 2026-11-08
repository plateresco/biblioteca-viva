// Datos para los widgets de la pantalla de inicio de Android (libro actual, racha y meta de hoy).
import { A } from './native.js';
import { S, onChange } from './state.js';
import { P } from './prefs.js';
import { pagesToday, streak, weekDots } from './metrics.js';

let t = 0;
export function empujarWidgets() {
  if (!A || !A.widgets) return;
  clearTimeout(t);
  t = setTimeout(() => {
    try {
      const cur = S.books.filter(b => b.s === 'leyendo').sort((a, b) => (b.upd || 0) - (a.upd || 0))[0];
      A.widgets(JSON.stringify({
        id: cur ? cur.id : 0, t: cur ? cur.t : '', a: cur ? cur.a : '', p: cur ? cur.p : 0, r: cur ? (cur.r || 0) : 0,
        pct: cur ? Math.round((cur.r || 0) / Math.max(1, cur.p) * 100) : 0,
        racha: streak(), hoy: pagesToday(), meta: P.goalDay || 20, semana: weekDots().map(d => (d.on ? 1 : 0)),
      }));
    } catch { /* los widgets son un extra */ }
  }, 800);
}
export function iniciarWidgets() { if (A && A.widgets) { onChange(empujarWidgets); empujarWidgets(); } }
