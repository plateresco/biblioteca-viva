// Saca de la portada los dos colores que mejor la representan, para pintar el lomo.
function hash(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); }
function hsl2hex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
const toHex = ([r, g, b]) => '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
export function lum(hex) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}
export function fallbackColors(title) {
  const h = hash(title) % 360;
  const c1 = hsl2hex(h, 42, 32), c2 = hsl2hex((h + 35) % 360, 55, 62);
  return { c1, c2, dark: lum(c1) < .35 };
}
export async function coverColors(blob, title) {
  try {
    const bmp = await createImageBitmap(blob);
    const W = 28, H = 40, cv = new OffscreenCanvas(W, H), cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(bmp, 0, 0, W, H);
    const d = cx.getImageData(0, 0, W, H).data, bins = new Map();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
      const key = (r >> 5) << 6 | (g >> 5) << 3 | (b >> 5), e = bins.get(key) || { n: 0, r: 0, g: 0, b: 0, w: 0 };
      const w = 0.35 + sat * 1.4 - (mx > 235 || mx < 25 ? 0.25 : 0);   // prefiere colores con carácter, no blanco/negro puros
      e.n++; e.r += r; e.g += g; e.b += b; e.w += Math.max(.05, w); bins.set(key, e);
    }
    const list = [...bins.values()].map(e => ({ rgb: [e.r / e.n, e.g / e.n, e.b / e.n], w: e.w })).sort((a, b) => b.w - a.w);
    if (!list.length) return fallbackColors(title);
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const p = list[0].rgb;
    const q = (list.slice(1, 12).sort((a, b) => dist(b.rgb, p) * b.w - dist(a.rgb, p) * a.w)[0] || list[0]).rgb;
    // oscurece un poco el principal para que el lomo no brille más que el resto del estante
    const base = p.map(v => v * .86);
    const c1 = toHex(base), c2 = toHex(q);
    return { c1, c2, dark: lum(c1) < .38 };
  } catch { return fallbackColors(title); }
}
