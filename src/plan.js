// Plan de lectura con fecha: páginas por día para terminar a tiempo, calendario y fechas de devolución de préstamos.
import { S, byId, saveBook, today } from './state.js';
import { pace, iso } from './metrics.js';

const dia = f => new Date(f + 'T00:00:00');
export const diasHasta = f => Math.max(0, Math.ceil((dia(f) - dia(today())) / 864e5));
export const planes = () => S.books.filter(b => b.plan && b.plan.fin && b.s !== 'leido' && b.s !== 'abandonado');
export function calculo(b) {
  const quedan = Math.max(0, (b.p || 0) - (b.r || 0)), d = Math.max(1, diasHasta(b.plan.fin) + 1), ppd = Math.ceil(quedan / d);
  const minutos = Math.round(ppd / Math.max(5, pace()) * 60);
  const hoy = S.log.filter(l => l.bookId === b.id && l.date === today()).reduce((a, l) => a + (l.pages || 0), 0);
  return { quedan, dias: d, ppd, minutos, hoy, tarde: diasHasta(b.plan.fin) < 0 };
}
export async function fijarPlan(b, fin) { if (fin) b.plan = { fin }; else delete b.plan; await saveBook(b); }

/** Los próximos 28 días, desde el lunes de esta semana: planes que terminan y préstamos que se devuelven. */
export function calendario() {
  const hoy = dia(today()), wd = (hoy.getDay() + 6) % 7, ini = new Date(hoy); ini.setDate(hoy.getDate() - wd);
  const celdas = [];
  for (let i = 0; i < 28; i++) {
    const d = new Date(ini); d.setDate(ini.getDate() + i); const k = iso(d);
    const fin = S.books.filter(b => b.plan && b.plan.fin === k && b.s !== 'leido'), dev = S.books.filter(b => b.loan && b.loan.due === k);
    celdas.push({ d, k, hoy: k === today(), pasado: d < hoy, fin, dev, leido: S.log.some(l => l.date === k && (l.pages > 0 || l.secs > 0)) });
  }
  return celdas;
}
