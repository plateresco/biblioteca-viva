import * as db from './db.js';

export const ST = {
  leyendo: { n: 'Leyendo', c: 'var(--warn)' },
  leido: { n: 'Leído', c: 'var(--ok)' },
  porleer: { n: 'Por leer', c: 'var(--idle)' },
  abandonado: { n: 'Abandonado', c: 'var(--bad)' },
};
export const FORMATS = ['EPUB', 'Papel', 'Audio', 'Otro'];
export const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const S = { books: [], log: [], notes: [], tomb: [], ui: { tab: 'lib', filter: 'todos', reorder: false, pick: null, listTab: 'leyendo', statsMode: 'mes', qi: Math.floor(Date.now() / 864e5) } };

const listeners = new Set();
export const onChange = fn => (listeners.add(fn), () => listeners.delete(fn));
export const emit = () => listeners.forEach(f => f());

export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const fd = d => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${+dd} ${MES[+m - 1]} ${y}`; };

export const newUid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

export async function load() {
  S.books = (await db.all('books')).sort((a, b) => a.order - b.order);
  S.log = await db.all('log');
  S.notes = await db.all('notes');
  S.tomb = await db.all('tomb');
  // Identificador estable para reconocer el mismo libro en otro dispositivo
  for (const b of S.books) if (!b.uid) { b.uid = newUid(); b.upd = b.upd || Date.now(); await db.put('books', b); }
  for (const n of S.notes) if (!n.uid) { n.uid = newUid(); n.bookUid = S.books.find(b => b.id === n.bookId)?.uid; await db.put('notes', n); }
}
export const byId = id => S.books.find(b => b.id === id);
export const cnt = s => S.books.filter(b => b.s === s).length;

// Portadas: una URL temporal por libro, creada una sola vez por sesión.
const coverUrls = new Map();
export function coverUrl(b) {
  if (!b.cover) return null;
  if (!coverUrls.has(b.id)) coverUrls.set(b.id, URL.createObjectURL(b.cover));
  return coverUrls.get(b.id);
}

export const persistBook = b => { b.upd = Date.now(); return db.put('books', b); };   // guarda sin avisar a las pantallas (se usa mientras lees)

export async function saveBook(b) {
  b.upd = Date.now(); if (!b.uid) b.uid = newUid();
  const id = await db.put('books', b);
  if (!b.id) { b.id = id; S.books.push(b); }
  emit();
  return b;
}
export async function addBook(data, file) {
  const order = S.books.reduce((m, b) => Math.max(m, b.order ?? 0), 0) + 1;
  const b = { s: 'porleer', f: 'EPUB', r: 0, progress: 0, order, addedAt: today(), uid: newUid(), ...data };
  await saveBook(b);
  if (file) await db.put('files', file, b.id);
  return b;
}
async function addTomb(uid, kind) { if (!uid) return; const t = { uid, kind, upd: Date.now() }; await db.put('tomb', t); S.tomb = S.tomb.filter(x => x.uid !== uid).concat(t); }
export async function removeBook(id) {
  await addTomb(byId(id)?.uid, 'book');
  await db.del('books', id); await db.del('files', id);
  for (const l of S.log.filter(l => l.bookId === id)) await db.del('log', l.id);
  for (const n of S.notes.filter(n => n.bookId === id)) await db.del('notes', n.id);
  S.books = S.books.filter(b => b.id !== id);
  S.log = S.log.filter(l => l.bookId !== id);
  S.notes = S.notes.filter(n => n.bookId !== id);
  emit();
}
export const getFile = id => db.get('files', id);

export async function setStatus(b, s) {
  b.s = s;
  if (s === 'porleer') { b.st = b.en = null; b.r = 0; b.progress = 0; b.cfi = null; }
  if (s === 'leyendo') { b.st = b.st || today(); b.en = null; }
  if (s === 'leido') { b.st = b.st || today(); b.en = today(); b.r = b.p; b.progress = 1; }
  if (s === 'abandonado') { b.st = b.st || today(); b.en = today(); }
  await saveBook(b);
}

export async function moveBook(fromId, toId) {
  const a = S.books.findIndex(b => b.id === fromId), z = S.books.findIndex(b => b.id === toId);
  if (a < 0 || z < 0) return;
  const [m] = S.books.splice(a, 1); S.books.splice(z, 0, m);
  for (let i = 0; i < S.books.length; i++) if (S.books[i].order !== i + 1) { S.books[i].order = i + 1; await db.put('books', S.books[i]); }
  emit();
}

// Páginas leídas por día (alimenta las cifras).
export async function addPages(bookId, n) {
  if (n <= 0) return;
  const d = today();
  let e = S.log.find(l => l.bookId === bookId && l.date === d);
  if (e) e.pages += n; else { e = { bookId, date: d, pages: n }; S.log.push(e); }
  const id = await db.put('log', e); if (!e.id) e.id = id;
}

export async function saveNote(n) {
  if (!n.uid) { n.uid = newUid(); n.bookUid = byId(n.bookId)?.uid; }
  const id = await db.put('notes', n); if (!n.id) { n.id = id; S.notes.push(n); } emit(); return n;
}
export async function removeNote(id) { await addTomb(S.notes.find(n => n.id === id)?.uid, 'note'); await db.del('notes', id); S.notes = S.notes.filter(n => n.id !== id); emit(); }

// Forma del lomo según el libro: más páginas = más grueso y un poco más alto.
export function spineGeom(b) {
  const p = Math.max(40, b.p || 200), j = (b.id * 2654435761 >>> 0) % 9;           // pequeña variación fija por libro
  const w = Math.round(Math.min(64, Math.max(22, 18 + p * 0.068)) + (j % 3) - 1);
  const h = Math.round(122 + Math.min(p, 800) / 800 * 40 + (j % 5) - 2);
  return { w, h };
}
