// Almacenamiento: qué ocupa cada libro con archivo, quitar el archivo de este teléfono (queda en Drive) y descargar para viaje.
import * as db from './db.js';
import { S } from './state.js';
import { isEnabled, lastSync, ensureEpub, hasToken } from './sync.js';
import { lastReadOf } from './metrics.js';

export async function tamano(b) {
  try { const f = await db.get('files', b.id); if (!f) return null; if (f instanceof Blob) return f.size; if (f.pistas) return f.pistas.reduce((a, p) => a + (p.blob?.size || 0), 0); } catch { }
  return null;
}
export const esAudio = b => !!b.audio;
export const mb = n => n >= 1e9 ? (n / 1e9).toFixed(1).replace('.', ',') + ' GB' : n >= 1e6 ? Math.round(n / 1e6) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB';

export async function inventario() {
  const out = [];
  for (const b of S.books.filter(x => x.hasFile)) { const t = await tamano(b); out.push({ b, t, local: t != null }); }
  return out.sort((a, z) => (z.t || 0) - (a.t || 0));
}
// Solo se puede quitar si el archivo está en Drive (la sincronización lo sube) y no es un audiolibro.
export const sePuedeQuitar = b => isEnabled() && !!lastSync() && !esAudio(b);
export async function quitarLocal(b) { if (!sePuedeQuitar(b)) throw new Error('Para quitarlo, conecta Google Drive y sincroniza antes.'); await db.del('files', b.id); }
export async function bajar(b) { if (!hasToken()) throw new Error('Conecta Google Drive para descargarlo.'); return ensureEpub(b); }

const ult = b => lastReadOf(b.id) || (b.dev && new Date(b.dev.t).toISOString().slice(0, 10)) || b.st || b.addedAt || '';
export const sinAbrir = (inv, dias = 180) => inv.filter(x => x.local && sePuedeQuitar(x.b) && ult(x.b) && (Date.now() - new Date(ult(x.b) + 'T00:00:00')) / 864e5 > dias);
