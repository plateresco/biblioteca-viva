// Perfiles: una biblioteca aparte (con sus libros, frases y avance) para otra persona, en el mismo dispositivo.
const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { } return null; };

export const perfilActivo = () => LS('bv-perfil') || '';
export const lista = () => { try { return JSON.parse(LS('bv-perfiles') || '[]'); } catch { return []; } };
const guarda = l => LS('bv-perfiles', JSON.stringify(l));
export const nombreActivo = () => perfilActivo() ? (lista().find(p => p.id === perfilActivo())?.n || 'Perfil') : 'Principal';

export function crear(nombre) {
  const id = Math.random().toString(36).slice(2, 8), l = lista(); l.push({ id, n: nombre.trim().slice(0, 24) || 'Perfil' }); guarda(l); return id;
}
export function cambiar(id) { LS('bv-perfil', id || null); location.reload(); }
export function borrar(id) {
  guarda(lista().filter(p => p.id !== id));
  try { indexedDB.deleteDatabase('biblioteca-viva-' + id); } catch { }
  if (perfilActivo() === id) cambiar('');
}
