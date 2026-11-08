// Almacenamiento local en el dispositivo (IndexedDB). No hay servidor.
const NAME = 'biblioteca-viva';
let _db;
function open() {
  if (_db) return _db;
  _db = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, 2);
    r.onupgradeneeded = () => {
      const d = r.result, has = n => d.objectStoreNames.contains(n);
      if (!has('books')) d.createObjectStore('books', { keyPath: 'id', autoIncrement: true });
      if (!has('files')) d.createObjectStore('files');                       // el archivo .epub de cada libro
      if (!has('log')) d.createObjectStore('log', { keyPath: 'id', autoIncrement: true });   // páginas leídas por día
      if (!has('notes')) d.createObjectStore('notes', { keyPath: 'id', autoIncrement: true }); // frases guardadas
      if (!has('tomb')) d.createObjectStore('tomb', { keyPath: 'uid' });     // libros/frases borrados (para que el borrado también se sincronice)
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return _db;
}
async function tx(store, mode, fn) {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out && out.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
export const all = s => tx(s, 'readonly', o => o.getAll());
export const get = (s, k) => tx(s, 'readonly', o => o.get(k));
export const put = (s, v, k) => tx(s, 'readwrite', o => o.put(v, k));
export const del = (s, k) => tx(s, 'readwrite', o => o.delete(k));
