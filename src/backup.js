// Copia de seguridad (JSON), exportar lista (CSV) e importar desde Goodreads (CSV). Todo ocurre en el dispositivo.
import * as db from './db.js';
import { S, ST, addBook, byId, load, emit, saveMeta, saveBook, saveNote, today } from './state.js';
import { fallbackColors } from './color.js';

import { A, blobToB64 } from './native.js';

function download(name, text, type) {
  if (A?.guardarArchivo) { blobToB64(new Blob([text], { type })).then(b => A.guardarArchivo(name, type, b)); return; }
  const u = URL.createObjectURL(new Blob([text], { type })), a = document.createElement('a');
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
}

export function construirCopia() {
  return {
    app: 'biblioteca-viva', v: 1, savedAt: new Date().toISOString(),
    books: S.books.map(({ cover, locs, id, ...r }) => r),
    notes: S.notes.map(({ id, ...r }) => r),
    log: S.log.map(l => ({ bookUid: byId(l.bookId)?.uid, date: l.date, pages: l.pages, secs: l.secs, hours: l.hours })).filter(l => l.bookUid),
    meta: S.meta, tomb: S.tomb,
  };
}
export function exportJSON() { download(`biblioteca-viva-${today()}.json`, JSON.stringify(construirCopia()), 'application/json'); }

// Copia protegida con contraseña (AES-GCM; la clave sale de la contraseña con PBKDF2). Sin la contraseña no se puede abrir.
const b64 = u => btoa(String.fromCharCode(...new Uint8Array(u))), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function claveDe(pass, sal) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: 150000, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
export async function exportCifrado(pass) {
  const sal = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await claveDe(pass, sal), new TextEncoder().encode(JSON.stringify(construirCopia())));
  download(`biblioteca-viva-${today()}.cifrada.json`, JSON.stringify({ app: 'biblioteca-viva-cifrada', v: 1, sal: b64(sal), iv: b64(iv), datos: b64(ct) }), 'application/json');
}

// Une una copia con lo que ya hay: agrega lo que falta y deja intacto lo demás.
export async function importJSON(file, pass) {
  let d = JSON.parse(await file.text());
  if (d.app === 'biblioteca-viva-cifrada') {
    if (!pass) throw new Error('NECESITA_CLAVE');
    try { d = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(d.iv) }, await claveDe(pass, unb64(d.sal)), unb64(d.datos)))); }
    catch { throw new Error('Contraseña incorrecta o archivo dañado.'); }
  }
  if (d.app !== 'biblioteca-viva') throw new Error('Este archivo no es una copia de Mi Biblioteca Viva.');
  const have = new Set(S.books.map(b => b.uid)); let nb = 0, nn = 0;
  for (const b of d.books || []) { if (have.has(b.uid)) continue; const col = b.c1 ? {} : fallbackColors(b.t); await addBook({ ...b, ...col, cover: null, hasFile: false }); nb++; }
  await load();
  const bu = new Map(S.books.map(b => [b.uid, b])), notes = new Set(S.notes.map(n => n.uid));
  for (const n of d.notes || []) { if (notes.has(n.uid)) continue; const b = bu.get(n.bookUid); if (!b) continue; await saveNote({ ...n, id: undefined, bookId: b.id }); nn++; }
  for (const l of d.log || []) { const b = bu.get(l.bookUid); if (!b || S.log.some(x => x.bookId === b.id && x.date === l.date)) continue; await db.put('log', { bookId: b.id, date: l.date, pages: l.pages, secs: l.secs, hours: l.hours }); }
  if (d.meta && (d.meta.upd || 0) > (S.meta.upd || 0)) { S.meta = { pisos: [], cols: [], wish: [], mode: 'auto', ...d.meta }; await saveMeta(); }
  await load(); emit();
  return { books: nb, notes: nn };
}

export function exportCSV() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Título', 'Autor', 'Estado', 'Formato', 'Páginas', 'Páginas leídas', 'Empezó', 'Terminó', 'Calificación', 'Colecciones']];
  const cols = id => (byId(id)?.cols || []).map(c => S.meta.cols.find(x => x.id === c)?.n).filter(Boolean).join('; ');
  for (const b of S.books) rows.push([b.t, b.a, ST[b.s].n, b.f, b.p, b.r || 0, b.st || '', b.en || '', b.rating || '', cols(b.id)]);
  download(`mi-biblioteca-${today()}.csv`, '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n'), 'text/csv');
}

/* ---------- CSV (Goodreads y similares) ---------- */
function parseCSV(text) {
  const rows = []; let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some(x => x !== '')) rows.push(row);
  return rows;
}
const key = (t, a) => (t + '|' + a).toLowerCase().replace(/\s+/g, ' ').trim();
export async function readCSV(file) {
  const rows = parseCSV((await file.text()).replace(/^﻿/, ''));
  if (rows.length < 2) throw new Error('El archivo no tiene filas.');
  const h = rows[0].map(x => x.trim().toLowerCase()), col = (...n) => h.findIndex(x => n.includes(x));
  const iT = col('title', 'título', 'titulo'), iA = col('author', 'authors', 'autor'), iP = col('number of pages', 'páginas', 'paginas', 'pages'), iS = col('exclusive shelf', 'read status', 'estado', 'shelf'),
    iD = col('date read', 'last date read', 'terminó', 'termino'), iR = col('my rating', 'star rating', 'calificación', 'calificacion'), iF = col('binding', 'format', 'formato'), iY = col('original publication year', 'year published');
  if (iT < 0) throw new Error('No encontré la columna del título (Title).');
  const have = new Set(S.books.map(b => key(b.t, b.a)));
  const items = [], dup = [];
  for (const r of rows.slice(1)) {
    const t = (r[iT] || '').trim(); if (!t) continue; const a = (r[iA] || '').trim() || 'Autor desconocido';
    if (have.has(key(t, a))) { dup.push(t); continue; }
    have.add(key(t, a));
    const sh = (r[iS] || '').toLowerCase(); const s = /did-not-finish|abandon/.test(sh) ? 'abandonado' : /read/.test(sh) && !/to-read|por leer/.test(sh) && !/currently|leyendo/.test(sh) || /leído|leido|terminado/.test(sh) ? 'leido' : /currently|leyendo/.test(sh) ? 'leyendo' : 'porleer';
    const p = parseInt(r[iP]) || 250, rating = Math.min(5, Math.round(parseFloat(r[iR]) || 0)), anio = parseInt(r[iY]) || 0, dr = (r[iD] || '').replace(/\//g, '-').match(/\d{4}-\d{2}-\d{2}/)?.[0] || null;
    items.push({ t, a, p, s, rating, anio, en: s === 'leido' ? (dr || today()) : null, f: /kindle|ebook|epub/i.test(r[iF] || '') ? 'EPUB' : 'Papel' });
  }
  return { items, dup };
}
export async function addImported(items) {
  for (const it of items) {
    const b = await addBook({ t: it.t, a: it.a, p: it.p, f: it.f, hasFile: false, ...fallbackColors(it.t) });
    if (it.s !== 'porleer') { b.s = it.s; b.st = it.en || today(); b.en = it.s === 'leido' ? it.en : null; b.r = it.s === 'leido' ? it.p : 0; b.progress = it.s === 'leido' ? 1 : 0; }
    if (it.rating) b.rating = it.rating;
    if (it.anio) b.anio = it.anio;
    await saveBook(b);
  }
}
