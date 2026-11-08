import * as db from './db.js';

export const ST = {
  leyendo: { n: 'Leyendo', c: 'var(--warn)' },
  leido: { n: 'Leído', c: 'var(--ok)' },
  porleer: { n: 'Por leer', c: 'var(--idle)' },
  abandonado: { n: 'Abandonado', c: 'var(--bad)' },
};
export const FORMATS = ['EPUB', 'Papel', 'Audio', 'Otro'];
export const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const S = { books: [], log: [], notes: [], tomb: [], meta: { pisos: [], cols: [], wish: [], mode: 'auto', upd: 0 }, ui: { tab: 'hoy', filter: 'todos', col: null, reorder: false, pick: null, sel: null, statsMode: 'mes', qi: Math.floor(Date.now() / 864e5) } };

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
  const m = await db.get('meta', 'extra'); if (m) S.meta = { pisos: [], cols: [], wish: [], mode: 'auto', upd: 0, ...m.v };
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
  const w = Math.round(Math.min(84, 16 + p * 0.05) + (j % 3) - 1);                  // sin tope práctico: un tomo de 1.200 págs. se nota
  const h = Math.round(116 + Math.min(p, 1000) / 1000 * 52 + (j % 5) - 2);
  return { w, h };
}

// Deja el libro en la posición `idx` (0 = primero) y renumera el orden.
export async function moveToIndex(id, idx) {
  const a = S.books.findIndex(b => b.id === id);
  if (a < 0) return;
  const [m] = S.books.splice(a, 1);
  S.books.splice(Math.max(0, Math.min(idx, S.books.length)), 0, m);
  for (let i = 0; i < S.books.length; i++) if (S.books[i].order !== i + 1) { S.books[i].order = i + 1; S.books[i].upd = Date.now(); await db.put('books', S.books[i]); }
  emit();
}


/* ---------- Datos extra: pisos, colecciones y deseos (se guardan juntos y se sincronizan) ---------- */
export const newId = () => Math.random().toString(36).slice(2, 9);
export async function saveMeta() { S.meta.upd = Date.now(); await db.put('meta', { key: 'extra', v: S.meta }); emit(); }
export const pisoOf = id => S.meta.pisos.find(p => p.id === id);

// Pasa de pisos automáticos a manuales: cada fila actual se convierte en un piso.
export async function startManual(rows) {
  S.meta.pisos = rows.map((r, i) => ({ id: newId(), n: 'Piso ' + (i + 1), h: 'normal', o: '' }));
  rows.forEach((r, i) => r.forEach(b => { b.piso = S.meta.pisos[i].id; }));
  S.meta.mode = 'manual';
  for (const b of S.books) await persistBook(b);
  await saveMeta();
}
// Guarda el orden de los libros y su piso a partir de lo que se ve en pantalla.
export async function arrange(plan) {        // plan = [{ pisoId, ids: [bookId...] }] en el orden visual
  const order = [];
  for (const g of plan) for (const id of g.ids) { const b = byId(id); if (b) { b.piso = g.pisoId; order.push(b); } }
  const rest = S.books.filter(b => !order.includes(b));
  S.books = order.concat(rest);
  for (let i = 0; i < S.books.length; i++) { S.books[i].order = i + 1; await persistBook(S.books[i]); }
  emit();
}
export async function reorderPisos(ids) { S.meta.pisos = ids.map(id => pisoOf(id)).filter(Boolean); await saveMeta(); }
export async function removePiso(id) {
  const i = S.meta.pisos.findIndex(p => p.id === id), dest = S.meta.pisos[i > 0 ? i - 1 : 1];
  if (!dest) return;
  for (const b of S.books) if (b.piso === id) { b.piso = dest.id; await persistBook(b); }
  S.meta.pisos.splice(i, 1); await saveMeta();
}

// Tiempo de lectura: segundos por día y por hora del día (alimenta "¿A qué hora lees?").
export async function addTime(bookId, secs) {
  if (secs <= 0) return;
  const d = today(), h = new Date().getHours();
  let e = S.log.find(l => l.bookId === bookId && l.date === d);
  if (!e) { e = { bookId, date: d, pages: 0 }; S.log.push(e); }
  e.secs = (e.secs || 0) + secs; e.hours = e.hours || {}; e.hours[h] = (e.hours[h] || 0) + secs;
  const id = await db.put('log', e); if (!e.id) e.id = id;
}
