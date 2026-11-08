import { shrinkImage } from './color.js';
// Búsqueda por ISBN en Open Library (gratis) y lectura del código de barras con la cámara del dispositivo.
export async function lookupISBN(raw) {
  const code = String(raw).replace(/[^0-9Xx]/g, '');
  if (code.length !== 10 && code.length !== 13) throw new Error('El ISBN debe tener 10 o 13 dígitos.');
  let j;
  try { j = await (await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${code}&format=json&jscmd=data`)).json(); }
  catch { throw new Error('No pude consultar Open Library. ¿Hay conexión a internet?'); }
  const d = j[`ISBN:${code}`];
  if (!d) throw new Error('No encontré ese ISBN en Open Library. Puedes agregar el libro a mano.');
  let cover = null;
  try {
    const u = d.cover?.large || d.cover?.medium || `https://covers.openlibrary.org/b/isbn/${code}-L.jpg?default=false`;
    const r = await fetch(u); if (r.ok) { const b = await r.blob(); if (b.size > 1500) cover = await shrinkImage(b); }
  } catch { /* sin portada */ }
  const syn = typeof d.notes === 'string' ? d.notes : (d.notes?.value || d.excerpts?.[0]?.text || '');
  return { title: d.title + (d.subtitle ? ': ' + d.subtitle : ''), author: (d.authors || []).map(a => a.name).join(', ') || 'Autor desconocido', pages: d.number_of_pages || 0, cover, syn: String(syn).slice(0, 600), isbn: code };
}

export const canScan = () => !!window.AndroidApp?.escanearIsbn || ('BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia);

// Enciende la cámara trasera y avisa cuando detecta un código de barras. Devuelve una función para apagarla.
export async function startScan(video, onCode, alive = () => true) {
  const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  video.srcObject = stream; video.setAttribute('playsinline', ''); await video.play();
  let stop = false;
  const off = () => { stop = true; stream.getTracks().forEach(t => t.stop()); video.srcObject = null; };
  const loop = async () => {
    if (stop) return;
    if (!alive()) { off(); return; }
    try { const r = await det.detect(video); if (r.length) { stop = true; onCode(r[0].rawValue); return; } } catch { }
    setTimeout(() => requestAnimationFrame(loop), 120);
  };
  loop();
  return off;
}
