// Sincronización con Google Drive, en la carpeta oculta de la app ("appDataFolder").
// Esa carpeta solo la ve esta app: no aparece en tu Drive ni toca tus otros archivos.
import * as db from './db.js';
import { S, load, emit, byId } from './state.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3';
const LS = k => { try { return localStorage.getItem(k); } catch { return null; } };
const setLS = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { } };

export const getClientId = () => LS('bv-gcid') || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const setClientId = v => setLS('bv-gcid', v.trim() || null);
export const isEnabled = () => LS('bv-sync-on') === '1';
export const lastSync = () => +LS('bv-last-sync') || 0;
export const disable = () => { setLS('bv-sync-on', null); token = null; };

let token = null, exp = 0, syncing = false;
export const hasToken = () => !!token && Date.now() < exp - 30000;
export const isSyncing = () => syncing;

function loadGsi() {
  return new Promise((res, rej) => {
    if (window.google?.accounts?.oauth2) return res();
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar el inicio de sesión de Google. ¿Hay conexión a internet?'));
    document.head.appendChild(s);
  });
}
export async function connect(interactive = true) {
  const cid = getClientId();
  if (!cid) throw new Error('Falta el ID de cliente de Google (ver la guía).');
  await loadGsi();
  return new Promise((res, rej) => {
    const c = google.accounts.oauth2.initTokenClient({
      client_id: cid, scope: SCOPE,
      callback: r => { if (r.error) return rej(new Error(r.error_description || r.error)); token = r.access_token; exp = Date.now() + (+r.expires_in || 3600) * 1000; setLS('bv-sync-on', '1'); res(token); },
      error_callback: e => rej(new Error(e?.type === 'popup_closed' ? 'Cerraste la ventana de Google antes de terminar.' : (e?.type || 'No se pudo conectar'))),
    });
    c.requestAccessToken({ prompt: interactive ? '' : 'none' });
  });
}

async function api(path, opts = {}, base = API) {
  const r = await fetch(base + path, { ...opts, headers: { Authorization: 'Bearer ' + token, ...(opts.headers || {}) } });
  if (!r.ok) { if (r.status === 401) token = null; throw new Error(`Google Drive respondió ${r.status}. ${(await r.text()).slice(0, 140)}`); }
  return r;
}
async function listFiles() {
  const out = []; let pt = '';
  do {
    const r = await (await api(`/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name)${pt ? '&pageToken=' + encodeURIComponent(pt) : ''}`)).json();
    out.push(...r.files); pt = r.nextPageToken;
  } while (pt);
  return out;
}
async function upload(name, blob, existingId) {
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(existingId ? { name } : { name, parents: ['appDataFolder'] })], { type: 'application/json' }));
  form.append('file', blob);
  const r = await api(existingId ? `/files/${existingId}?uploadType=multipart&fields=id` : '/files?uploadType=multipart&fields=id', { method: existingId ? 'PATCH' : 'POST', body: form }, UP);
  return (await r.json()).id;
}
const download = async id => (await api(`/files/${id}?alt=media`)).blob();
const remove = id => api(`/files/${id}`, { method: 'DELETE' }).catch(() => { });

/* ---------- Sincronización completa ---------- */
export async function syncNow(onStatus = () => { }) {
  if (syncing) return;
  if (!hasToken()) throw new Error('Primero conecta con Google.');
  syncing = true;
  try {
    onStatus('Revisando Google Drive…');
    await load();
    const files = await listFiles(), byName = new Map(files.map(f => [f.name, f]));
    let remote = { books: [], notes: [], log: [], tomb: [] };
    const lib = byName.get('library.json');
    if (lib) { try { remote = { ...remote, ...JSON.parse(await (await download(lib.id)).text()) }; } catch { throw new Error('El archivo de la nube está dañado; no se tocó nada.'); } }

    // 1) Borrados
    const tomb = new Map();
    for (const t of [...(remote.tomb || []), ...S.tomb]) { const o = tomb.get(t.uid); if (!o || t.upd > o.upd) tomb.set(t.uid, t); }
    for (const t of tomb.values()) await db.put('tomb', t);
    for (const b of S.books) { const t = tomb.get(b.uid); if (t && t.upd >= (b.upd || 0)) { await db.del('books', b.id); await db.del('files', b.id); } }
    await load();

    // 2) Libros: gana el cambio más reciente
    onStatus('Uniendo tu biblioteca…');
    const local = new Map(S.books.map(b => [b.uid, b]));
    for (const rb of remote.books || []) {
      if (tomb.has(rb.uid)) continue;
      const lb = local.get(rb.uid);
      if (!lb) { const nb = { ...rb, cover: null }; delete nb.id; await db.put('books', nb); }
      else if ((rb.upd || 0) > (lb.upd || 0)) { Object.assign(lb, rb, { id: lb.id, cover: lb.cover, locs: lb.locs }); await db.put('books', lb); }
    }
    await load();

    // 3) Frases y páginas leídas
    const byUid = new Map(S.books.map(b => [b.uid, b]));
    for (const rn of remote.notes || []) {
      if (tomb.has(rn.uid) || S.notes.some(n => n.uid === rn.uid)) continue;
      const b = byUid.get(rn.bookUid); if (!b) continue;
      const n = { ...rn, bookId: b.id }; delete n.id; await db.put('notes', n);
    }
    for (const rl of remote.log || []) {
      const b = byUid.get(rl.bookUid); if (!b) continue;
      const l = S.log.find(x => x.bookId === b.id && x.date === rl.date);
      if (!l) await db.put('log', { bookId: b.id, date: rl.date, pages: rl.pages });
      else if (rl.pages > l.pages) { l.pages = rl.pages; await db.put('log', l); }
    }
    await load();

    // 4) Subir el resultado
    onStatus('Guardando en la nube…');
    const out = {
      v: 1, savedAt: Date.now(),
      books: S.books.map(({ cover, locs, id, ...r }) => r),
      notes: S.notes.map(({ id, ...r }) => r),
      log: S.log.map(l => ({ bookUid: byId(l.bookId)?.uid, date: l.date, pages: l.pages })).filter(l => l.bookUid),
      tomb: [...tomb.values()],
    };
    await upload('library.json', new Blob([JSON.stringify(out)], { type: 'application/json' }), lib?.id);

    // 5) Archivos: portadas (todas) y EPUB (se suben; se bajan al abrir el libro)
    for (const b of S.books) {
      const cn = 'cover-' + b.uid, en = 'epub-' + b.uid;
      if (b.cover && !byName.has(cn)) await upload(cn, b.cover);
      if (!b.cover && byName.has(cn)) { b.cover = await download(byName.get(cn).id); await db.put('books', b); }
      if (b.hasFile && !byName.has(en)) {
        const f = await db.get('files', b.id);
        if (f) { onStatus(`Subiendo “${b.t}”…`); await upload(en, f); }
      }
    }
    // Libros borrados: limpia sus archivos en la nube
    for (const t of tomb.values()) for (const n of ['epub-', 'cover-']) { const f = byName.get(n + t.uid); if (f) await remove(f.id); }

    await load();
    setLS('bv-last-sync', String(Date.now()));
  } finally { syncing = false; }
  emit();
}

// Baja el EPUB de un libro que se agregó desde otro dispositivo.
export async function ensureEpub(b) {
  if (!hasToken()) await connect(true);
  const q = encodeURIComponent(`name='epub-${b.uid}'`);
  const r = await (await api(`/files?spaces=appDataFolder&q=${q}&fields=files(id)`)).json();
  if (!r.files.length) throw new Error('Este libro aún no se ha subido desde el otro dispositivo.');
  const blob = await download(r.files[0].id);
  await db.put('files', blob, b.id);
  return blob;
}
