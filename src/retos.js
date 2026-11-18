// Retos de lectura (metas con forma) y logros suaves (reconocimientos sin competir con nadie).
import { S, saveMeta } from './state.js';
import { P } from './prefs.js';
import { streak, bestStreak, pagesOn, iso } from './metrics.js';
import { toast } from './ui.js';

const hoyIso = () => iso(new Date());
const finMes = () => { const n = new Date(); return S.books.filter(b => b.s === 'leido' && (b.en || '').startsWith(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`)); };

/* ---------- Retos ---------- */
export const RETOS = [
  { id: 'libros', n: 'Libros del año', d: () => `Terminar ${P.goalYear || 12} libros este año`, calc: () => { const y = String(new Date().getFullYear()), a = S.books.filter(b => b.s === 'leido' && (b.en || '').startsWith(y)).length, t = P.goalYear || 12; return { a, t, txt: `${a} de ${t} libros` }; } },
  { id: 'mes', n: 'Un libro por mes', d: () => 'Terminar al menos un libro cada mes del año', calc: () => { const y = new Date().getFullYear(), ms = new Set(S.books.filter(b => b.s === 'leido' && (b.en || '').startsWith(String(y))).map(b => +b.en.slice(5, 7))); const t = new Date().getMonth() + 1, a = [...ms].filter(m => m <= t).length; return { a, t, txt: `${a} de ${t} meses` }; } },
  { id: 'minutos', n: 'Minutos diarios', cfg: 'min', def: 30, d: c => `Leer ${c} minutos cada día`, calc: c => { const n = new Date(), t = n.getDate(); let a = 0; for (let d = 1; d <= t; d++) { const k = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; const s = S.log.filter(l => l.date === k).reduce((x, l) => x + (l.secs || 0), 0); if (s >= c * 60) a++; } return { a, t, txt: `${a} de ${t} días este mes` }; } },
  { id: 'semana', n: 'Páginas por semana', cfg: 'pags', def: 100, d: c => `Leer ${c} páginas cada semana`, calc: c => { const n = new Date(), wd = (n.getDay() + 6) % 7; let a = 0; for (let i = 0; i <= wd; i++) { const d = new Date(n); d.setDate(n.getDate() - wd + i); a += pagesOn(iso(d)); } return { a: Math.min(a, c), t: c, txt: `${a} de ${c} páginas` }; } },
];
export const retosActivos = () => (S.meta.retos && S.meta.retos.activos) || ['libros'];
export const cfgReto = id => ((S.meta.retos && S.meta.retos.cfg) || {})[id];
export async function fijarReto(id, on) {
  const r = S.meta.retos = S.meta.retos || { activos: ['libros'], cfg: {} }; const s = new Set(r.activos || []); on ? s.add(id) : s.delete(id); r.activos = [...s]; await saveMeta();
}
export async function fijarCfg(id, v) { const r = S.meta.retos = S.meta.retos || { activos: ['libros'], cfg: {} }; r.cfg = r.cfg || {}; r.cfg[id] = v; await saveMeta(); }

/* ---------- Logros ---------- */
const horas = () => S.log.reduce((a, l) => a + (l.secs || 0), 0) / 3600;
const leidos = () => S.books.filter(b => b.s === 'leido');
export const LOGROS = [
  { id: 'primer', s: '1', n: 'Primer libro', d: 'Terminaste tu primer libro', ok: () => leidos().length >= 1 },
  { id: 'frase', s: '“', n: 'Primera frase', d: 'Guardaste tu primera frase', ok: () => S.notes.length >= 1 },
  { id: 'sem', s: '7', n: 'Una semana', d: 'Siete días seguidos leyendo', ok: () => bestStreak() >= 7 },
  { id: 'mes', s: '30', n: 'Un mes', d: 'Treinta días seguidos leyendo', ok: () => bestStreak() >= 30 },
  { id: 'mil', s: 'M', n: 'Mil páginas', d: 'Terminaste un libro de más de mil páginas', ok: () => leidos().some(b => (b.p || 0) >= 1000) },
  { id: 'diez', s: '10', n: 'Diez libros', d: 'Diez libros terminados', ok: () => leidos().length >= 10 },
  { id: 'cincuenta', s: '50', n: 'Cincuenta libros', d: 'Cincuenta libros terminados', ok: () => leidos().length >= 50 },
  { id: 'cien', s: 'C', n: 'Cien libros', d: 'Cien libros terminados', ok: () => leidos().length >= 100 },
  { id: 'horas', s: 'H', n: 'Cien horas', d: 'Cien horas de lectura registradas', ok: () => horas() >= 100 },
  { id: 'frases', s: '100', n: 'Cien frases', d: 'Cien frases guardadas', ok: () => S.notes.length >= 100 },
  { id: 'nocturno', s: 'N', n: 'Lector nocturno', d: 'Leíste pasada la medianoche', ok: () => S.log.some(l => Object.keys(l.hours || {}).some(h => +h < 4 && l.hours[h] > 600)) },
  { id: 'mesgrande', s: 'P', n: 'Mes de mil', d: 'Mil páginas en un solo mes', ok: () => { const m = {}; for (const l of S.log) { const k = (l.date || '').slice(0, 7); m[k] = (m[k] || 0) + (l.pages || 0); } return Object.values(m).some(v => v >= 1000); } },
];
// Revisa si hay logros nuevos. La primera vez se guardan en silencio (no se anuncian los que ya tenías).
let revisando = false;
export async function revisarLogros(avisar = true) {
  if (revisando || !S.books.length) return;
  revisando = true;
  try {
    const primera = !S.meta.logros; const got = S.meta.logros = S.meta.logros || {}; const nuevos = [];
    for (const l of LOGROS) if (!got[l.id] && l.ok()) { got[l.id] = Date.now(); nuevos.push(l); }
    if (nuevos.length) { await saveMeta(); if (avisar && !primera) toast(nuevos.length === 1 ? `Nuevo logro: ${nuevos[0].n}` : `${nuevos.length} logros nuevos`); }
    else if (primera) await saveMeta();
  } finally { revisando = false; }
}
