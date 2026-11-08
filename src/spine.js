import { ST, coverUrl, spineGeom } from './state.js';
import { esc } from './ui.js';

const hash = id => (id * 2654435761 >>> 0);
export const spineStyleClass = () => '';     // la tipografía ahora la decide spineInner

export function spineStyle(b) {
  const g = spineGeom(b), u = coverUrl(b);
  return `--c1:${b.c1 || '#555'};--c2:${b.c2 || '#bbb'};--w:${g.w}px;--h:${g.h}px;--sc:${ST[b.s].c};--art:${u ? `url('${u}')` : 'none'}`;
}

/* ---------- Título grabado directo en el lomo ---------- */
const FONTS = [
  { fam: 'Figtree', w: 600, track: .02, caps: false, max: 14, min: 8 },                    // sans
  { fam: "'Young Serif'", w: 400, track: 0, caps: false, max: 15, min: 8 },                 // serif
  { fam: 'Figtree', w: 700, track: .12, caps: true, max: 12, min: 7.5 },                    // mayúsculas espaciadas
  { fam: 'Newsreader', w: 500, style: 'italic', track: .01, caps: false, max: 16, min: 8.5 }, // cursiva
];
const AUTH = { fam: 'Figtree', w: 600, track: .14, caps: true };
const cv = document.createElement('canvas').getContext('2d');
const cache = new Map();
export const resetSpineCache = () => cache.clear();

function tw(text, f, size) {
  cv.font = `${f.style || 'normal'} ${f.w} ${size}px ${f.fam}, Georgia, serif`;
  const t = f.caps ? text.toUpperCase() : text;
  return cv.measureText(t).width + f.track * size * Math.max(0, t.length - 1);
}
// Elige cuántas líneas y qué tamaño de letra hacen que el título entre completo.
function fitTitle(title, L, T, f) {
  const words = title.split(/\s+/), cands = [[title]];
  for (let i = 1; i < words.length; i++) cands.push([words.slice(0, i).join(' '), words.slice(i).join(' ')]);
  if (words.length >= 4) for (let i = 1; i < words.length - 1; i++) for (let j = i + 1; j < words.length; j++) cands.push([words.slice(0, i).join(' '), words.slice(i, j).join(' '), words.slice(j).join(' ')]);
  let best = null;
  for (const lines of cands) {
    const n = lines.length, byT = T / (n * 1.12), ws = lines.map(l => tw(l, f, 10)), widest = Math.max(...ws), byL = 10 * L / widest, size = Math.min(byT, byL, f.max);
    const score = size * (.7 + .3 * (Math.min(...ws) / widest)) * (1 - .1 * (n - 1));   // pocas líneas y bien repartidas
    if (!best || score > best.score) best = { lines, size, score };
  }
  best.size = Math.max(5.5, best.size);
  return best;
}
function lum(hex) {
  const n = parseInt((hex || '#555555').slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}

export function spineInner(b) {
  const g = spineGeom(b), key = `${b.id}|${b.t}|${b.a}|${g.w}|${g.h}|${b.c1}|${!!b.cover}`;
  if (cache.has(key)) return cache.get(key);
  const f = FONTS[hash(b.id) % 4], light = lum(b.c1) >= .42, fin = light ? 'ink' : 'foil';
  const top = 17, bot = 26, L = g.h - top - bot, T = g.w - 8;
  const withAut = g.w >= 40 && g.h >= 130 && b.a && !/desconocido/i.test(b.a);
  const La = withAut ? Math.min(52, L * .3) : 0, Lt = L - (withAut ? La + 8 : 0);
  let title = b.t || 'Sin título', r = fitTitle(title, Lt, T, f);
  if (r.size < 7) {                                          // lomo muy delgado y título largo: se usa la parte principal (antes de «:», «—» o «(»); el título completo queda en la etiqueta
    const short = title.split(/\s*[:—–(]\s*/)[0].trim();
    if (short && short !== title) { const r2 = fitTitle(short, Lt, T, f); if (r2.size > r.size) { r = r2; title = short; } }
  }
  const scrimA = b.cover ? .38 : 0;                           // protección suave solo si la portada tiene dibujo
  const scrimC = light ? `rgba(255,255,255,${scrimA})` : `rgba(8,10,12,${scrimA})`;
  let aut = '';
  if (withAut) {
    const last = b.a.split(/\s+/).slice(-1)[0]; let s = Math.min(9, T * .5);
    while (s > 6.4 && tw(last, AUTH, s) > La) s -= .4;
    if (tw(last, AUTH, s) <= La) aut = `<span class="aut fin-${fin}" style="top:${top + Lt + 8}px;height:${La}px;font-size:${s.toFixed(1)}px">${esc(last)}</span>`;
  }
  const font = `font-family:${f.fam},Georgia,serif;font-weight:${f.w};font-style:${f.style || 'normal'};font-size:${r.size.toFixed(2)}px;letter-spacing:${f.track}em;${f.caps ? 'text-transform:uppercase;' : ''}`;
  const html = `<i class="hb"></i><i class="foil"></i>${scrimA ? `<i class="scrim" style="top:${top - 2}px;height:${Lt + 4}px;width:${Math.min(g.w - 2, T * .95 + 8)}px;background:${scrimC}"></i>` : ''}`
    + `<div class="ttl fin-${fin}" style="top:${top}px;height:${Lt}px;${font}">${r.lines.map(l => `<span>${esc(l)}</span>`).join('')}</div>${aut}`
    + `<i class="pub"></i><i class="tb"></i><i class="sheen"></i><b class="tip">${esc(b.t)} · ${b.p} págs.</b><i class="rib"></i>`;
  cache.set(key, html);
  return html;
}
