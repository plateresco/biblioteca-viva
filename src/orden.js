// Formas de ordenar la estantería (por color, por serie, por autor) y detección de series.
import { S } from './state.js';

const num = h => parseInt(h, 16);
// Tono del lomo (0 a 360) y qué tan «de color» es; los grises y negros van al final, de claro a oscuro.
export function claveColor(b) {
  const h = String(b.c1 || '#555555'), r = num(h.slice(1, 3)) / 255, g = num(h.slice(3, 5)) / 255, bl = num(h.slice(5, 7)) / 255;
  const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), d = mx - mn, l = (mx + mn) / 2;
  if (d < .08) return 1000 + (1 - l) * 100;
  let t = mx === r ? ((g - bl) / d) % 6 : mx === g ? (bl - r) / d + 2 : (r - g) / d + 4;
  t *= 60; return t < 0 ? t + 360 : t;
}

const PATRON = /^(.+?)[\s:,\-–]+(?:libro|tomo|vol\.?|volumen|parte|book)?\s*(\d{1,2})$/i;
const bajo = s => String(s || '').trim().toLowerCase();
// Series conocidas: las que el usuario escribió y las que se deducen de títulos como «Dune 2».
export function series() {
  const m = new Map();                                    // título completo -> { serie, tomo }
  const nombres = new Set();
  for (const b of S.books) {
    if (b.serie) { m.set(b.id, { serie: b.serie, tomo: +b.tomo || 0 }); nombres.add(bajo(b.serie)); continue; }
    if (b.serie === '') continue;
    const x = String(b.t || '').match(PATRON);
    if (x) { m.set(b.id, { serie: x[1].trim(), tomo: +x[2] }); nombres.add(bajo(x[1])); }
  }
  for (const b of S.books) if (!m.has(b.id) && b.serie !== '' && nombres.has(bajo(b.t))) m.set(b.id, { serie: b.t.trim(), tomo: 1 });   // el primer tomo no lleva número
  return m;
}
export function serieDe(b, mapa) { return (mapa || series()).get(b.id) || null; }

export function ordenar(lista, modo) {
  const l = lista.slice();
  if (!modo || modo === 'orden') return l;
  if (modo === 'color') return l.sort((a, b) => claveColor(a) - claveColor(b));
  if (modo === 'autor') return l.sort((a, b) => bajo(a.a).localeCompare(bajo(b.a), 'es') || bajo(a.t).localeCompare(bajo(b.t), 'es'));
  if (modo === 'serie') {
    const m = series();
    const k = b => { const s = m.get(b.id); return s ? bajo(s.serie) : '~' + bajo(b.t); };
    return l.sort((a, b) => k(a).localeCompare(k(b), 'es') || ((m.get(a.id)?.tomo || 0) - (m.get(b.id)?.tomo || 0)));
  }
  return l;
}
