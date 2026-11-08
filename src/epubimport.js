import ePub from 'epubjs';

const CHARS_PER_PAGE = 1800; // una página de libro impreso, aproximadamente

// Lee el EPUB: título, autor, portada y cuántas páginas tendría impreso.
export async function readEpub(file, onProgress = () => {}) {
  const book = ePub(await file.arrayBuffer());
  try {
    await book.ready;
    const meta = await book.loaded.metadata;
    let cover = null;
    try {
      const url = await book.coverUrl();
      if (url) cover = await (await fetch(url)).blob();
    } catch { /* sin portada */ }
    let chars = 0;
    const items = book.spine.spineItems;
    for (let i = 0; i < items.length; i++) {
      try {
        const root = await items[i].load(book.load.bind(book));
        chars += (root.textContent || '').length;
        items[i].unload();
      } catch { /* capítulo ilegible: se omite */ }
      onProgress((i + 1) / items.length);
    }
    return {
      title: (meta.title || file.name.replace(/\.epub$/i, '')).trim(),
      author: (meta.creator || 'Autor desconocido').trim(),
      cover,
      pages: Math.max(1, Math.round(chars / CHARS_PER_PAGE)),
      chapters: items.length,
    };
  } finally { book.destroy(); }
}
