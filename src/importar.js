// Importar EPUB sin repetir: cada archivo tiene una huella (SHA-256); si ya está en la biblioteca, no se agrega otra vez.
import { S, addBook, removeBook } from './state.js';
import { coverColors, fallbackColors } from './color.js';

export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export async function huella(file) {
  try {
    if (crypto?.subtle) {
      const h = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* sin crypto: se usa nombre y tamaño */ }
  return null;
}

// ¿Ya existe este archivo? Se compara la huella; en libros viejos (sin huella) el nombre y tamaño, o título + autor + páginas.
function repetidoPorArchivo(fh, f) {
  return S.books.find(b => b.hasFile && ((fh && b.fh === fh) || (!b.fh && b.fn === f.name && b.fz === f.size)));
}
function repetidoPorDatos(info) {
  const t = norm(info.title), a = norm(info.author);
  return S.books.find(b => b.hasFile && norm(b.t) === t && norm(b.a) === a && b.p === info.pages);
}

/** Devuelve { estado: 'nuevo' | 'repetido', libro }. Lanza error si el archivo no es un EPUB legible. */
export async function importarArchivo(f, onProgress) {
  const fh = await huella(f);
  const ya = repetidoPorArchivo(fh, f); if (ya) return { estado: 'repetido', libro: ya };
  const { readEpub } = await import('./epubimport.js');
  const info = await readEpub(f, onProgress);
  const igual = repetidoPorDatos(info);
  if (igual) { if (fh && !igual.fh) { igual.fh = fh; igual.fn = f.name; igual.fz = f.size; } return { estado: 'repetido', libro: igual }; }
  const col = info.cover ? await coverColors(info.cover, info.title) : fallbackColors(info.title);
  const libro = await addBook({ t: info.title, a: info.author, p: info.pages, f: 'EPUB', cover: info.cover, syn: info.syn, hasFile: true, fh, fn: f.name, fz: f.size, ...col }, f);
  return { estado: 'nuevo', libro };
}

/* ---------- Limpiar los repetidos que ya están en la biblioteca ---------- */
// Grupos de libros con archivo, mismo título, autor y páginas. En cada grupo se conserva el que más avance tiene.
export function gruposRepetidos() {
  const m = new Map();
  for (const b of S.books) {
    if (!b.hasFile) continue;
    const k = b.fh || `${norm(b.t)}|${norm(b.a)}|${b.p}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(b);
    if (b.fh) { const k2 = `${norm(b.t)}|${norm(b.a)}|${b.p}`; if (!m.has(k2)) m.set(k2, []); if (!m.get(k2).includes(b)) m.get(k2).push(b); }
  }
  const vistos = new Set(), out = [];
  for (const g of m.values()) {
    const fresh = g.filter(b => !vistos.has(b.id)); if (g.length < 2 || fresh.length < 1) continue;
    g.forEach(b => vistos.add(b.id)); out.push(g);
  }
  return out;
}
const puntaje = b => (b.r || 0) * 1000 + (S.notes.filter(n => n.bookId === b.id).length + S.log.filter(l => l.bookId === b.id).length) * 100 + (b.s === 'leido' ? 50 : b.s === 'leyendo' ? 20 : 0) - (b.id || 0) / 1e6;
export const sobrantes = () => gruposRepetidos().flatMap(g => [...g].sort((a, b) => puntaje(b) - puntaje(a)).slice(1));
export async function quitarRepetidos() { const s = sobrantes(); for (const b of s) await removeBook(b.id); return s.length; }
