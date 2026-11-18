// Importar PDF, cómics (CBZ) y audiolibros. Cada uno se agrega a la estantería con su portada y sus datos.
import * as db from './db.js';
import { S, addBook, saveBook } from './state.js';
import { coverColors, fallbackColors, shrinkImage } from './color.js';
import { huella, norm } from './importar.js';

export const tipoDe = f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? 'pdf' : /\.(cbz|zip)$/i.test(f.name) ? 'cbz' : /\.(m4b|mp3|m4a|ogg|opus|aac|wav)$/i.test(f.name) || /^audio\//.test(f.type) ? 'audio' : /\.epub$/i.test(f.name) ? 'epub' : /\.txt$/i.test(f.name) ? 'txt' : null;
const sinExt = n => n.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_]+/g, ' ').trim();
const natural = (a, b) => a.localeCompare(b, 'es', { numeric: true });
const blobDe = canvas => new Promise(r => canvas.toBlob(r, 'image/jpeg', .85));

const yaEsta = (fh, f) => S.books.find(b => (fh && b.fh === fh) || (b.fn === f.name && b.fz === f.size));

/* ---------- PDF ---------- */
export async function importarPdf(f) {
  const fh = await huella(f), ya = yaEsta(fh, f); if (ya) return { estado: 'repetido', libro: ya };
  const { cargarPdfJs } = await import('./pdflib.js'), lib = await cargarPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
  let titulo = sinExt(f.name), autor = 'Autor desconocido', cover = null;
  try { const m = await doc.getMetadata(); if (m.info?.Title && m.info.Title.trim().length > 2) titulo = m.info.Title.trim(); if (m.info?.Author) autor = m.info.Author.trim(); } catch { }
  try {
    const pg = await doc.getPage(1), v0 = pg.getViewport({ scale: 1 }), v = pg.getViewport({ scale: 420 / v0.width }), c = document.createElement('canvas');
    c.width = v.width; c.height = v.height; await pg.render({ canvasContext: c.getContext('2d'), viewport: v }).promise; cover = await shrinkImage(await blobDe(c));
  } catch { }
  const n = doc.numPages; try { doc.destroy(); } catch { }
  const col = cover ? await coverColors(cover, titulo) : fallbackColors(titulo);
  const libro = await addBook({ t: titulo, a: autor, p: n, f: 'PDF', cover, hasFile: true, fh, fn: f.name, fz: f.size, ...col }, f);
  return { estado: 'nuevo', libro };
}

/* ---------- Cómic (CBZ) ---------- */
export async function leerCbz(f) {
  const { default: JSZip } = await import('jszip'), zip = await JSZip.loadAsync(f);
  const nombres = Object.keys(zip.files).filter(n => !zip.files[n].dir && /\.(jpe?g|png|webp|gif|avif)$/i.test(n) && !/__MACOSX/.test(n)).sort(natural);
  return { zip, nombres };
}
export async function importarCbz(f) {
  const fh = await huella(f), ya = yaEsta(fh, f); if (ya) return { estado: 'repetido', libro: ya };
  const { zip, nombres } = await leerCbz(f); if (!nombres.length) throw new Error('El archivo no tiene imágenes.');
  const primera = await zip.files[nombres[0]].async('blob'), cover = await shrinkImage(primera), titulo = sinExt(f.name);
  const libro = await addBook({ t: titulo, a: 'Autor desconocido', p: nombres.length, f: 'Cómic', cover, hasFile: true, fh, fn: f.name, fz: f.size, ...(await coverColors(cover, titulo)) }, f);
  return { estado: 'nuevo', libro };
}

/* ---------- Audiolibro ---------- */
const duracion = blob => new Promise(res => { const a = new Audio(), u = URL.createObjectURL(blob); a.preload = 'metadata'; a.onloadedmetadata = () => { res(isFinite(a.duration) ? a.duration : 0); URL.revokeObjectURL(u); }; a.onerror = () => { res(0); URL.revokeObjectURL(u); }; a.src = u; });

// Capítulos de un M4B (átomo «chpl» de Nero); si no hay, devuelve [].
export async function capitulosM4b(file) {
  try {
    const leer = async (ini, n) => new DataView(await file.slice(ini, ini + n).arrayBuffer());
    let pos = 0; const fin = file.size;
    while (pos + 8 <= fin) {
      const h = await leer(pos, 16); let tam = h.getUint32(0); const tipo = String.fromCharCode(h.getUint8(4), h.getUint8(5), h.getUint8(6), h.getUint8(7)); let cab = 8;
      if (tam === 1) { tam = Number(h.getBigUint64(8)); cab = 16; } else if (tam === 0) tam = fin - pos;
      if (tam < 8) break;
      if (tipo === 'moov') {
        const buf = new Uint8Array(await file.slice(pos, pos + Math.min(tam, 8e6)).arrayBuffer());
        for (let i = 0; i + 8 < buf.length; i++) {
          if (buf[i] === 0x63 && buf[i + 1] === 0x68 && buf[i + 2] === 0x70 && buf[i + 3] === 0x6c) {            // 'chpl'
            const dv = new DataView(buf.buffer, buf.byteOffset + i + 4); let p = 4 + 4; const n = dv.getUint8(p); p += 1; const out = [];
            for (let k = 0; k < n && p + 9 <= dv.byteLength; k++) { const t = Number(dv.getBigUint64(p)) / 1e7; p += 8; const l = dv.getUint8(p); p += 1; out.push({ t, n: new TextDecoder().decode(new Uint8Array(buf.buffer, buf.byteOffset + i + 4 + p, l)) }); p += l; }
            return out;
          }
        }
        return [];
      }
      pos += tam;
    }
  } catch { }
  return [];
}

export async function importarAudio(files) {
  const lista = [...files].sort((a, b) => natural(a.name, b.name)), f0 = lista[0], clave = lista.map(f => f.name + f.size).join('|');
  const ya = S.books.find(b => b.fn === clave); if (ya) return { estado: 'repetido', libro: ya };
  const pistas = []; let total = 0;
  for (const f of lista) { const dur = await duracion(f); pistas.push({ n: sinExt(f.name), blob: f, dur }); total += dur; }
  let caps = []; if (lista.length === 1) caps = await capitulosM4b(f0);
  const titulo = lista.length > 1 ? sinExt(f0.name).replace(/[\s._-]*(cap(itulo)?|track|pista|parte)?[\s._-]*\d+.*$/i, '').trim() || sinExt(f0.name) : sinExt(f0.name);
  const minutos = Math.max(1, Math.round(total / 60));
  const libro = await addBook({ t: titulo, a: 'Autor desconocido', p: minutos, f: 'Audio', hasFile: true, audio: { dur: Math.round(total), n: pistas.length, caps }, fn: clave, ...fallbackColors(titulo) }, { audio: true, pistas });
  return { estado: 'nuevo', libro };
}

/** Un solo punto de entrada: elige el importador según el archivo. */
export async function importarDocumento(f, onProgress) {
  const t = tipoDe(f);
  if (t === 'pdf') return importarPdf(f);
  if (t === 'cbz') return importarCbz(f);
  if (t === 'audio') return importarAudio([f]);
  const { importarArchivo } = await import('./importar.js');
  return importarArchivo(f, onProgress);
}
