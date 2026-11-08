import { ST, coverUrl, spineGeom } from './state.js';
import { esc } from './ui.js';

const hash = id => (id * 2654435761 >>> 0);

/* ---------- Título grabado directo en el lomo ---------- */
const FONTS = [
  { fam: 'Figtree', w: 600, track: .02, caps: false, max: 14, min: 8 },                    // sans
  { fam: "'Young Serif'", w: 400, track: 0, caps: false, max: 15, min: 8 },                 // serif
  { fam: 'Figtree', w: 700, track: .12, caps: true, max: 12, min: 7.5 },                    // mayúsculas espaciadas
  { fam: 'Newsreader', w: 500, style: 'italic', track: .01, caps: false, max: 16, min: 8.5 }, // cursiva
];
const AUTH = { fam: 'Figtree', w: 600, track: .14, caps: true };
const cv = document.createElement('canvas').getContext('2d');
const cache = new Map(), wcache = new Map();
export const resetSpineCache = () => { cache.clear(); wcache.clear(); };

// El ancho del texto es proporcional al tamaño de la letra: se mide cada palabra una sola vez (a 10 px) y el resto son sumas.
function w10(word, f) {
  const k = f.fam + f.w + (f.style || '') + (f.caps ? 'C' : '') + '|' + word;
  let v = wcache.get(k);
  if (v === undefined) { cv.font = `${f.style || 'normal'} ${f.w} 10px ${f.fam}, Georgia, serif`; v = cv.measureText(f.caps ? word.toUpperCase() : word).width; wcache.set(k, v); }
  return v;
}
function lineW(words, f) {                       // ancho a 10 px de una línea formada por estas palabras
  let w = 0, chars = 0;
  for (const x of words) { w += w10(x, f); chars += x.length; }
  const gaps = words.length - 1; w += gaps * w10(' ', f); chars += gaps;
  return w + f.track * 10 * Math.max(0, chars - 1);
}
function fitWords(words, L, T, f) {
  const cands = [[words]];
  for (let i = 1; i < words.length; i++) cands.push([words.slice(0, i), words.slice(i)]);
  if (words.length >= 4) for (let i = 1; i < words.length - 1; i++) for (let j = i + 1; j < words.length; j++) cands.push([words.slice(0, i), words.slice(i, j), words.slice(j)]);
  let best = null;
  for (const lines of cands) {
    const n = lines.length, byT = T / (n * 1.12), ws = lines.map(l => lineW(l, f)), widest = Math.max(...ws), byL = 10 * L / widest, size = Math.min(byT, byL, f.max);
    const score = size * (.7 + .3 * (Math.min(...ws) / widest)) * (1 - .1 * (n - 1));   // pocas líneas y bien repartidas
    if (!best || score > best.score) best = { lines: lines.map(l => l.join(' ')), size, score };
  }
  best.size = Math.max(5.5, best.size);
  return best;
}
function lum(hex) {
  const n = parseInt((hex || '#555555').slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}

// Todo lo que depende del libro se calcula una sola vez y se guarda.
function layout(b) {
  const g = spineGeom(b), key = `${b.id}|${b.t}|${b.a}|${g.w}|${g.h}|${b.c1}|${!!b.cover}`;
  let c = cache.get(key); if (c) return c;
  const f = FONTS[hash(b.id) % 4], light = lum(b.c1) >= .42, fin = light ? 'ink' : 'foil';
  const top = 17, bot = 26, L = g.h - top - bot, T = g.w - 8;
  const withAut = g.w >= 40 && g.h >= 130 && b.a && !/desconocido/i.test(b.a);
  const La = withAut ? Math.min(52, L * .3) : 0, Lt = L - (withAut ? La + 8 : 0);
  let title = (b.t || 'Sin título').trim(), r = fitWords(title.split(/\s+/), Lt, T, f);
  if (r.size < 7) {                                          // lomo muy delgado y título largo: se usa la parte principal (antes de «:», «—» o «(»)
    const short = title.split(/\s*[:—–(]\s*/)[0].trim();
    if (short && short !== title) { const r2 = fitWords(short.split(/\s+/), Lt, T, f); if (r2.size > r.size) { r = r2; title = short; } }
  }
  let aut = '';
  if (withAut) {
    const last = b.a.split(/\s+/).slice(-1)[0]; let s = Math.min(9, T * .5);
    while (s > 6.4 && w10(last, AUTH) * s / 10 + AUTH.track * s * Math.max(0, last.length - 1) > La) s -= .4;
    if (w10(last, AUTH) * s / 10 + AUTH.track * s * Math.max(0, last.length - 1) <= La) aut = `<span class="aut" style="top:${top + Lt + 8}px;height:${La}px;font-size:${s.toFixed(1)}px">${esc(last)}</span>`;
  }
  const font = `font-family:${f.fam},Georgia,serif;font-weight:${f.w};font-style:${f.style || 'normal'};font-size:${r.size.toFixed(2)}px;letter-spacing:${f.track}em;${f.caps ? 'text-transform:uppercase;' : ''}`;
  c = { cls: fin + (b.cover ? ' scr' : ''), th: Lt, tt: top, html: `<div class="ttl" style="top:${top}px;height:${Lt}px;${font}">${r.lines.map(esc).join('<br>')}</div>${aut}` };
  cache.set(key, c);
  return c;
}

export const spineStyleClass = b => layout(b).cls;
export function spineStyle(b) {
  const g = spineGeom(b), u = coverUrl(b), l = layout(b);
  return `--c1:${b.c1 || '#555'};--c2:${b.c2 || '#bbb'};--w:${g.w}px;--h:${g.h}px;--sc:${ST[b.s].c};--art:${u ? `url('${u}')` : 'none'};--tt:${l.tt}px;--th:${l.th}px`;
}
export const spineInner = b => layout(b).html;
