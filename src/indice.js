// Buscar en el texto de todos tus libros: se arma un índice en el dispositivo (EPUB y PDF) y se consulta sin conexión.
import * as db from './db.js';
import { S, byId, getFile } from './state.js';

export const norma = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cacheN = new Map();

const indexable = b => b.hasFile && (b.f === 'EPUB' || b.f === 'PDF');
export async function pendientes() {
  let ya = new Set(); try { ya = new Set(await db.keys('idx')); } catch { }
  return S.books.filter(b => indexable(b) && !ya.has(b.id));
}

export async function indexar(b, onProgreso = () => { }) {
  const file = await getFile(b.id); if (!(file instanceof Blob)) return false;
  const items = [];
  if (b.f === 'PDF') {
    const { cargarPdfJs } = await import('./pdflib.js'), lib = await cargarPdfJs();
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    for (let i = 1; i <= doc.numPages; i++) {
      try { const pg = await doc.getPage(i), tc = await pg.getTextContent(), x = tc.items.map(t => t.str).join(' ').replace(/\s+/g, ' ').trim(); if (x.length > 20) items.push({ p: i, x }); } catch { }
      if (i % 5 === 0) onProgreso(i / doc.numPages);
    }
    try { doc.destroy(); } catch { }
  } else {
    const ePub = (await import('epubjs')).default, book = ePub(await file.arrayBuffer());
    try {
      await book.ready; const its = book.spine.spineItems;
      for (let i = 0; i < its.length; i++) {
        try { const root = await its[i].load(book.load.bind(book)), x = (root.textContent || '').replace(/\s+/g, ' ').trim(); if (x.length > 40) items.push({ h: its[i].href, x }); its[i].unload(); } catch { }
        if (i % 3 === 0) onProgreso(i / its.length);
      }
    } finally { try { book.destroy(); } catch { } }
  }
  await db.put('idx', { id: b.id, uid: b.uid, tipo: b.f, items, at: Date.now() });
  return true;
}

/** Hasta `max` coincidencias en el texto de los libros (sin acentos ni mayúsculas). */
export async function buscarTexto(q, { libroId = null, max = 80 } = {}) {
  const nq = norma(q.trim()); if (nq.length < 2) return [];
  const out = [];
  for (const e of await db.all('idx')) {
    if (libroId && e.id !== libroId) continue;
    const b = byId(e.id); if (!b || (b.oculto && !S.ui.verOcultos)) continue;
    for (let i = 0; i < e.items.length; i++) {
      const it = e.items[i], k = e.id + ':' + i; let n = cacheN.get(k);
      if (n === undefined) { n = norma(it.x); if (cacheN.size > 500) cacheN.clear(); cacheN.set(k, n); }
      let pos = 0, c = 0;
      while ((pos = n.indexOf(nq, pos)) >= 0 && c < 3) {
        const a = Math.max(0, pos - 70), z = Math.min(it.x.length, pos + nq.length + 90);
        out.push({ b, it, ant: (a > 0 ? '…' : '') + it.x.slice(a, pos), hit: it.x.slice(pos, pos + nq.length), des: it.x.slice(pos + nq.length, z) + (z < it.x.length ? '…' : '') });
        pos += nq.length; c++; if (out.length >= max) return out;
      }
    }
  }
  return out;
}
