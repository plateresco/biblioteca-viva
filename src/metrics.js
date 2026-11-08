// Cálculos compartidos a partir del registro de lectura (páginas y tiempo por día).
import { S, today, MES } from './state.js';

export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const pagesOn = date => S.log.filter(l => l.date === date).reduce((a, l) => a + (l.pages || 0), 0);
export const pagesToday = () => pagesOn(today());
export const readDays = () => new Set(S.log.filter(l => l.pages > 0 || l.secs > 0).map(l => l.date));

export function streak() {
  const days = readDays(); let n = 0; const d = new Date();
  if (!days.has(today())) d.setDate(d.getDate() - 1);
  while (days.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function bestStreak() {
  const days = [...readDays()].sort(); let best = 0, cur = 0, prev = null;
  for (const s of days) { const d = new Date(s + 'T00:00:00'); if (prev && (d - prev) / 864e5 === 1) cur++; else cur = 1; best = Math.max(best, cur); prev = d; }
  return best;
}
// Últimos 7 días, de lunes a domingo de la semana actual.
export function weekDots() {
  const now = new Date(), wd = (now.getDay() + 6) % 7, days = readDays(), out = [];
  for (let i = 0; i < 7; i++) { const d = new Date(now); d.setDate(now.getDate() - wd + i); out.push({ on: days.has(iso(d)), today: i === wd, future: i > wd, l: 'LMMJVSD'[i] }); }
  return out;
}
// Ritmo: páginas por hora, medido en las sesiones con tiempo registrado (o 30 si aún no hay datos).
export function pace() {
  let p = 0, s = 0;
  for (const l of S.log) if (l.secs > 60 && l.pages > 0) { p += l.pages; s += l.secs; }
  return s > 600 ? Math.max(5, Math.round(p / (s / 3600))) : 30;
}
export const minutesToday = () => Math.round(S.log.filter(l => l.date === today()).reduce((a, l) => a + (l.secs || 0), 0) / 60);
export function fmtDur(min) { if (min < 60) return `${Math.max(1, Math.round(min))} min`; const h = Math.floor(min / 60), m = Math.round(min % 60); return m ? `${h} h ${m} min` : `${h} h`; }
export function leftText(b) {
  const left = Math.max(0, b.p - (b.r || 0)); if (!left) return 'Ya lo terminaste';
  const min = left / pace() * 60, d30 = new Date(); d30.setDate(d30.getDate() - 30);
  const recent = S.log.filter(l => l.date >= iso(d30)).reduce((a, l) => a + l.pages, 0), perDay = recent / 30;
  const days = perDay >= 1 ? Math.ceil(left / perDay) : null;
  return `Te quedan ${fmtDur(min)} a tu ritmo${days ? `, unos ${days} días` : ''}.`;
}
export function lastReadOf(bookId) { const ds = S.log.filter(l => l.bookId === bookId && l.pages > 0).map(l => l.date).sort(); return ds.length ? ds[ds.length - 1] : null; }
export function daysSince(date) { return date ? Math.floor((Date.now() - new Date(date + 'T00:00:00')) / 864e5) : null; }
export function hourHistogram() {
  const h = Array(24).fill(0);
  for (const l of S.log) for (const [k, v] of Object.entries(l.hours || {})) h[+k] += v;
  return h;
}
export function yearStats(y = new Date().getFullYear()) {
  const pages = S.log.filter(l => l.date.startsWith(String(y))).reduce((a, l) => a + (l.pages || 0), 0);
  const secs = S.log.filter(l => l.date.startsWith(String(y))).reduce((a, l) => a + (l.secs || 0), 0);
  const books = S.books.filter(b => b.s === 'leido' && b.en && b.en.startsWith(String(y)));
  return { pages, hours: Math.round(secs / 3600), books: books.length, list: books };
}
export const dayLabel = d => `${d.getDate()} ${MES[d.getMonth()]}`;
