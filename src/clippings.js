// Importar los subrayados de Kindle («My Clippings.txt»): se asignan a tus libros y se agregan como frases, sin duplicar.
import { S, addBook, saveNote, setStatus } from './state.js';
import { fallbackColors } from './color.js';
import { norm } from './importar.js';
import { $, $$, esc, openSheet, closeSheet, toast } from './ui.js';

const MESES = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11, january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };

function fecha(s) {
  const m = String(s).toLowerCase();
  let x = m.match(/(\d{1,2}) de ([a-záéíóú]+) de (\d{4})/);                    // 4 de marzo de 2022
  if (x && MESES[x[2]] != null) return new Date(+x[3], MESES[x[2]], +x[1]).getTime();
  x = m.match(/([a-z]+) (\d{1,2}), (\d{4})/);                                   // March 4, 2022
  if (x && MESES[x[1]] != null) return new Date(+x[3], MESES[x[1]], +x[2]).getTime();
  return Date.now();
}
function autor(a) { const t = String(a || '').trim(); const p = t.split(',').map(x => x.trim()); return p.length === 2 && p[1] ? `${p[1]} ${p[0]}` : t; }

/** Convierte el texto del archivo en { libros: Map(clave -> {t, a, items}) }. */
export function leerClippings(texto) {
  const bloques = String(texto).replace(/\r/g, '').replace(/^﻿/, '').split(/={5,}\n?/);
  const libros = new Map();
  for (const bl of bloques) {
    const ls = bl.split('\n').map(l => l.trim()); while (ls.length && !ls[0]) ls.shift();
    if (ls.length < 2) continue;
    const m = ls[0].match(/^(.*?)\s*\(([^()]*)\)\s*$/), t = (m ? m[1] : ls[0]).trim(), a = m ? autor(m[2]) : '';
    const meta = ls[1] || '', cuerpo = ls.slice(2).join(' ').replace(/\s+/g, ' ').trim();
    if (!t || !cuerpo) continue;
    const tipo = /marcador|bookmark/i.test(meta) ? 'marca' : /\bnota\b|\bnote\b/i.test(meta) ? 'nota' : 'sub';
    if (tipo === 'marca') continue;
    const pag = (meta.match(/(?:p[áa]gina|page)\s+(\d+)/i) || [])[1] || '', pos = (meta.match(/(?:posici[óo]n|location)\s+([\d-]+)/i) || [])[1] || '';
    const k = norm(t); if (!libros.has(k)) libros.set(k, { t, a, items: [] });
    libros.get(k).items.push({ tipo, texto: cuerpo, pag, pos, at: fecha(meta) });
  }
  // las notas se pegan al subrayado que tienen justo antes (misma posición cercana)
  for (const l of libros.values()) {
    const out = [];
    for (const it of l.items) {
      if (it.tipo === 'nota') {
        const prev = [...out].reverse().find(x => x.tipo === 'sub' && x.pos && it.pos && Math.abs(parseInt(x.pos.split('-').pop()) - parseInt(it.pos)) <= 3);
        if (prev) { prev.comment = it.texto; continue; }
      }
      out.push(it);
    }
    l.items = out;
  }
  return libros;
}

const yaEsta = (bookId, texto) => { const k = norm(texto).slice(0, 120); return S.notes.some(n => n.bookId === bookId && norm(n.text).slice(0, 120) === k); };
const buscar = (t) => { const k = norm(t); return S.books.find(b => norm(b.t) === k) || S.books.find(b => { const x = norm(b.t); return x.length > 6 && (x.startsWith(k) || k.startsWith(x)); }); };

export function abrirImportClippings() {
  const o = openSheet(`<h3>Subrayados de Kindle</h3><div class="sub">Elige el archivo «My Clippings.txt» de tu Kindle (está en la carpeta «documents»). Se leen subrayados y notas.</div>
    <div class="row" style="margin-top:14px"><button class="btn" id="kcf">Elegir archivo</button></div><input id="kcfi" type="file" accept=".txt,text/plain" hidden><div id="kcl" style="margin-top:12px"></div>`);
  $('#kcf', o).onclick = () => $('#kcfi', o).click();
  $('#kcfi', o).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const libros = leerClippings(await f.text()), lista = [...libros.values()];
    if (!lista.length) { $('#kcl', o).innerHTML = '<div class="note">No encontré subrayados en ese archivo.</div>'; return; }
    const filas = lista.map((l, i) => { const b = buscar(l.t), nuevos = l.items.filter(it => !b || !yaEsta(b.id, it.texto)); return { l, b, nuevos, i }; });
    $('#kcl', o).innerHTML = `<div style="display:grid;gap:8px;max-height:46vh;overflow:auto">${filas.map(({ l, b, nuevos, i }) => `<label class="kcrow"><input type="checkbox" data-i="${i}" ${nuevos.length ? 'checked' : 'disabled'}><span><b>${esc(l.t)}</b><small>${esc(l.a)} · ${nuevos.length} nuevos de ${l.items.length} · ${b ? 'está en tu estantería' : 'se creará como libro nuevo'}</small></span></label>`).join('')}</div>
      <div class="small" id="kcn" style="margin:10px 0"></div><div class="row"><button class="btn" id="kcgo">Importar</button><button class="btn ghost" data-x>Cancelar</button></div>`;
    const cuenta = () => { const n = $$('#kcl input:checked', o).reduce((a, c) => a + filas[+c.dataset.i].nuevos.length, 0); $('#kcn', o).textContent = `${n} subrayados listos para importar`; $('#kcgo', o).disabled = !n; };
    $$('#kcl input', o).forEach(c => c.onchange = cuenta); cuenta();
    $('#kcgo', o).onclick = async () => {
      $('#kcgo', o).disabled = true; $('#kcgo', o).textContent = 'Importando…'; let n = 0, nb = 0;
      for (const c of $$('#kcl input:checked', o)) {
        const { l, nuevos } = filas[+c.dataset.i]; let b = filas[+c.dataset.i].b;
        if (!b) { b = await addBook({ t: l.t, a: l.a || 'Autor desconocido', p: 250, f: 'Otro', hasFile: false, ...fallbackColors(l.t) }); nb++; }
        for (const it of nuevos) { await saveNote({ bookId: b.id, title: `${b.t} · ${b.a}${it.pag ? ' · pág. ' + it.pag : ''}`, text: it.texto.slice(0, 800), color: 'amarillo', createdAt: it.at, ...(it.comment ? { comment: it.comment } : {}), origen: 'kindle' }); n++; }
      }
      closeSheet(); toast(`${n} subrayados importados${nb ? ` y ${nb} libros nuevos` : ''}`);
    };
  };
}
