// Color propio de cada libro: toma el tono de la portada y lo ajusta para que siempre se lea bien sobre el tema actual.
import { P } from './prefs.js';

const aRgb = h => { const n = parseInt(String(h).slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
function aHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s, l];
}
function deHsl(h, s, l) {
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
const luz = h => { const [r, g, b] = aRgb(h); return (r * .299 + g * .587 + b * .114) / 255; };
const temaOscuro = () => { const m = (getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#000').trim(); return /^#/.test(m) ? luz(m.length === 4 ? '#' + [...m.slice(1)].map(c => c + c).join('') : m) < .5 : true; };

/** Devuelve { c, ink }: un acento legible derivado del color de la portada, o null si no hay color utilizable. */
export function acentoDe(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return null;
  let [h, s, l] = aHsl(aRgb(hex)); if (s < .12) return null;        // portada casi gris: se deja el acento de siempre
  s = Math.min(.72, Math.max(.42, s));
  l = temaOscuro() ? Math.min(.72, Math.max(.58, l)) : Math.min(.36, Math.max(.24, l));
  const c = deHsl(h, s, l); return { c, ink: luz(c) > .55 ? '#0B1613' : '#FFFFFF' };
}
/** Pone el acento del libro en un elemento (y sus hijos). Respeta el acento elegido por la persona y el interruptor de Apariencia. */
export function acentoLibro(el, libro) {
  if (!el) return;
  const quitar = () => ['--accent', '--accent-ink', '--r-accent', '--r-accent-ink'].forEach(k => el.style.removeProperty(k));
  if (!libro || P.accent || P.colorLibro === false) return quitar();
  const a = acentoDe(libro.c1) || acentoDe(libro.c2); if (!a) return quitar();
  el.style.setProperty('--accent', a.c); el.style.setProperty('--accent-ink', a.ink); el.style.setProperty('--r-accent', a.c); el.style.setProperty('--r-accent-ink', a.ink);
}
