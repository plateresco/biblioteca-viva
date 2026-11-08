// Imágenes para compartir (frases, resumen del año y estante). Se dibujan en el dispositivo; nada se sube a ningún servidor.
import { S, spineGeom } from './state.js';
import { toast } from './ui.js';

const SERIF = "Newsreader, Georgia, serif", DISPLAY = "'Young Serif', Georgia, serif", SANS = "Figtree, system-ui, sans-serif";
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const blob = c => new Promise(r => c.toBlob(r, 'image/png'));
function wrap(ctx, text, maxW) {
  const words = text.split(/\s+/), lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}
const shade = (hex, k) => { const n = parseInt((hex || '#555555').slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

export async function imgQuote(n, tpl, book) {
  await document.fonts?.ready;
  const W = 1080, H = 1350, [c, x] = mk(W, H);
  let bg, fg, mut, acc;
  if (tpl === 'noche') { const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#16262A'); g.addColorStop(1, '#0C171A'); bg = g; fg = '#F3ECDB'; mut = '#A9B7B3'; acc = '#E4B861'; }
  else if (tpl === 'libro') { const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, shade(book?.c1, 1.1)); g.addColorStop(1, shade(book?.c1, .45)); bg = g; fg = '#fff'; mut = 'rgba(255,255,255,.8)'; acc = book?.c2 || '#E4B861'; }
  else { bg = '#F1ECE0'; fg = '#26221B'; mut = '#6B5E42'; acc = '#1E5F5A'; }
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  x.fillStyle = acc; x.font = `400 220px ${DISPLAY}`; x.fillText('“', 90, 300);
  x.fillStyle = fg;
  let size = 72, lines; const text = n.text.trim();
  for (; size >= 40; size -= 4) { x.font = `italic 400 ${size}px ${SERIF}`; lines = wrap(x, text, W - 200); if (lines.length * size * 1.35 < 760) break; }
  const lh = size * 1.35; let y = 400; for (const l of lines) { x.fillText(l, 100, y); y += lh; }
  x.fillStyle = acc; x.fillRect(100, H - 250, 90, 6);
  x.fillStyle = fg; x.font = `600 38px ${SANS}`; x.fillText((n.title || '').slice(0, 44), 100, H - 190);
  x.fillStyle = mut; x.font = `400 30px ${SANS}`; x.fillText('Mi Biblioteca Viva', 100, H - 130);
  return blob(c);
}

export async function imgYear(st, year) {
  await document.fonts?.ready;
  const W = 1080, H = 1350, [c, x] = mk(W, H), g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#16262A'); g.addColorStop(.6, '#23395B'); g.addColorStop(1, '#3A2D4F'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = '#E4B861'; x.font = `700 32px ${SANS}`; x.fillText(`TU ${year} EN LIBROS`, 90, 150);
  x.fillStyle = '#F6EFDD'; x.font = `400 84px ${DISPLAY}`; x.fillText(`${st.books} ${st.books === 1 ? 'libro' : 'libros'}`, 90, 330);
  x.font = `400 56px ${DISPLAY}`; x.fillText(`${st.pages.toLocaleString('es-CL')} páginas`, 90, 430);
  if (st.hours) x.fillText(`${st.hours} horas de lectura`, 90, 510);
  x.fillStyle = '#C9D3CF'; x.font = `400 34px ${SANS}`;
  st.list.slice(0, 8).forEach((b, i) => x.fillText('· ' + b.t.slice(0, 40), 90, 650 + i * 56));
  x.fillStyle = '#A9B7B3'; x.font = `400 30px ${SANS}`; x.fillText('Mi Biblioteca Viva', 90, H - 90);
  return blob(c);
}

export async function imgShelf(books, title, sub) {
  await document.fonts?.ready;
  const W = 1080, H = 1350, [c, x] = mk(W, H), g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#16262A'); g.addColorStop(1, '#0C171A'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const rad = x.createRadialGradient(W / 2, 0, 20, W / 2, 0, 700); rad.addColorStop(0, 'rgba(255,206,120,.22)'); rad.addColorStop(1, 'rgba(255,206,120,0)'); x.fillStyle = rad; x.fillRect(0, 0, W, 700);
  x.fillStyle = '#F3ECDB'; x.font = `400 84px ${DISPLAY}`; x.fillText(title, 90, 170);
  x.fillStyle = '#A9B7B3'; x.font = `400 34px ${SANS}`; x.fillText(sub, 90, 230);
  const k = 2.2, rows = []; let cur = [], wsum = 0;
  for (const b of books) { const gm = spineGeom(b), w = gm.w * k + 5; if (cur.length && wsum + w > W - 180) { rows.push(cur); cur = []; wsum = 0; } cur.push(b); wsum += w; }
  if (cur.length) rows.push(cur);
  rows.slice(0, 3).forEach((r, ri) => {
    const base = 640 + ri * 330; let px = 90;
    for (const b of r) {
      const gm = spineGeom(b), w = gm.w * k, h = gm.h * k * .95, y = base - h;
      const gr = x.createLinearGradient(px, 0, px + w, 0); gr.addColorStop(0, shade(b.c1, .6)); gr.addColorStop(.2, shade(b.c1, 1.15)); gr.addColorStop(.7, shade(b.c1, .95)); gr.addColorStop(1, shade(b.c1, .55));
      x.fillStyle = gr; x.fillRect(px, y, w, h);
      x.fillStyle = '#E3C071'; x.fillRect(px, y + 14, w, 4); x.fillRect(px, y + 26, w, 3);
      x.fillStyle = 'rgba(247,241,226,.94)'; const pw = Math.min(w - 16, 40); x.fillRect(px + (w - pw) / 2, y + 48, pw, h - 110);
      px += w + 5;
    }
    const bg = x.createLinearGradient(0, base, 0, base + 28); bg.addColorStop(0, '#7A5230'); bg.addColorStop(1, '#5A3B21'); x.fillStyle = bg; x.fillRect(70, base, W - 140, 28);
  });
  x.fillStyle = '#A9B7B3'; x.font = `400 30px ${SANS}`; x.fillText('Mi Biblioteca Viva', 90, H - 80);
  return blob(c);
}

export async function shareImage(b, name, text) {
  if (!b) { toast('No se pudo crear la imagen'); return; }
  const file = new File([b], name, { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); toast('Imagen copiada al portapapeles'); return; } catch { }
  const u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  toast('Imagen guardada en tus descargas');
}
