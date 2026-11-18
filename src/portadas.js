// Completar portadas faltantes con Open Library (gratis): por ISBN si lo hay; si no, por título y autor.
import { S, saveBook, coverUrl } from './state.js';
import { shrinkImage, coverColors } from './color.js';

const bajaImagen = async url => {
  try { const r = await fetch(url); if (!r.ok) return null; const b = await r.blob(); return b.size > 1500 ? await shrinkImage(b) : null; } catch { return null; }
};

async function portadaDe(b) {
  if (b.isbn) { const c = await bajaImagen(`https://covers.openlibrary.org/b/isbn/${b.isbn}-L.jpg?default=false`); if (c) return c; }
  const q = new URLSearchParams({ title: b.t, limit: '3', fields: 'cover_i,title,author_name' });
  if (b.a && !/desconocido/i.test(b.a)) q.set('author', b.a.split(',')[0]);
  try {
    const j = await (await fetch('https://openlibrary.org/search.json?' + q)).json();
    const d = (j.docs || []).find(x => x.cover_i); if (d) return await bajaImagen(`https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg?default=false`);
  } catch { /* sin conexión */ }
  return null;
}

export const sinPortada = () => S.books.filter(b => !b.cover);

/** Recorre los libros sin portada. aviso(hechos, total, libro) se llama en cada paso; devuelve cuántas portadas se encontraron. */
export async function completarPortadas(aviso = () => { }, cancelado = () => false) {
  const lista = sinPortada(); let ok = 0;
  for (let i = 0; i < lista.length; i++) {
    if (cancelado()) break;
    const b = lista[i]; aviso(i, lista.length, b);
    const c = await portadaDe(b);
    if (c) { b.cover = c; Object.assign(b, await coverColors(c, b.t)); await saveBook(b); ok++; }
    await new Promise(r => setTimeout(r, 250));      // sin saturar el servicio gratuito
  }
  aviso(lista.length, lista.length, null);
  return ok;
}
