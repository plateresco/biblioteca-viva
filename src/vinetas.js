// Modo viñeta: detecta los recuadros de una página de cómic (cortando por los canales vacíos entre ellos) y devuelve cada uno
// como fracciones de la imagen, en orden de lectura. Todo se calcula en el dispositivo.

/** Devuelve [{ x0, y0, x1, y1 }] (valores de 0 a 1) o [] si no se distinguen viñetas. */
export function detectarVinetas(img, { manga = false } = {}) {
  const W = 320, k = W / (img.naturalWidth || img.width), H = Math.max(40, Math.round((img.naturalHeight || img.height) * k));
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data, g = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000;
  // color de fondo: el más frecuente en el borde de la página
  const h = new Array(32).fill(0); const toma = (px, py) => { h[g[py * W + px] >> 3]++; };
  for (let i = 0; i < W; i++) { toma(i, 1); toma(i, H - 2); } for (let j = 0; j < H; j++) { toma(1, j); toma(W - 2, j); }
  const bg = h.indexOf(Math.max(...h)) * 8 + 4, es = v => Math.abs(v - bg) < 28;
  const out = [];
  // corte recursivo: se alterna entre cortes horizontales y verticales hasta que no quedan canales
  function corta(x0, y0, x1, y1, eje, intentos) {
    const w = x1 - x0, hh = y1 - y0; if (w < 12 || hh < 12) return;
    const n = eje === 'h' ? hh : w, tot = eje === 'h' ? w : hh, vacio = new Array(n);
    for (let i = 0; i < n; i++) {
      let bgc = 0;
      for (let j = 0; j < tot; j++) { const v = eje === 'h' ? g[(y0 + i) * W + x0 + j] : g[(y0 + j) * W + x0 + i]; if (es(v)) bgc++; }
      vacio[i] = bgc / tot >= .985;
    }
    // canales: tramos vacíos de al menos 1,2 % del tamaño, sin contar los bordes
    const minimo = Math.max(2, Math.round(n * .012)), cortes = []; let i = 0;
    while (i < n) { if (vacio[i]) { let j = i; while (j < n && vacio[j]) j++; if (i > 0 && j < n && j - i >= minimo) cortes.push([i, j]); i = j; } else i++; }
    if (!cortes.length) { if (intentos < 1) return corta(x0, y0, x1, y1, eje === 'h' ? 'v' : 'h', intentos + 1); return hojas(x0, y0, x1, y1); }
    const segs = []; let a0 = 0; for (const [i0, j0] of cortes) { segs.push([a0, i0]); a0 = j0; } segs.push([a0, n]);
    let orden = segs.filter(s => s[1] - s[0] > 6);
    if (eje === 'v' && manga) orden = orden.reverse();
    for (const [s0, s1] of orden) { if (eje === 'h') corta(x0, y0 + s0, x1, y0 + s1, 'v', 0); else corta(x0 + s0, y0, x0 + s1, y1, 'h', 0); }
  }
  function hojas(x0, y0, x1, y1) {
    // se recorta el margen vacío de cada hoja
    let ax = x1, bx = x0, ay = y1, by = y0;
    for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) if (!es(g[j * W + i])) { if (i < ax) ax = i; if (i > bx) bx = i; if (j < ay) ay = j; if (j > by) by = j; }
    if (bx - ax < W * .12 || by - ay < H * .08) return;
    out.push({ x0: ax / W, y0: ay / H, x1: (bx + 1) / W, y1: (by + 1) / H });
  }
  corta(0, 0, W, H, 'h', 0);
  return out.length >= 2 ? out : [];
}
