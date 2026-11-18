import { S, byId, removeNote, saveNote, coverUrl } from './state.js';
import { P, setPref } from './prefs.js';
import { $, $$, esc, ic, toast, toastAccion, openSheet, closeSheet, ilustVacia } from './ui.js';
import { haptic } from './native.js';
import { imgQuote, shareImage } from './share.js';
import { abrirExportar } from './exportar.js';
import { abrirRepaso, pendientes } from './repaso.js';

export const HL = { amarillo: 'rgba(242,201,76,.6)', verde: 'rgba(123,196,127,.55)', azul: 'rgba(127,178,240,.55)', rosa: 'rgba(242,154,184,.6)' };
let tpl = 'papel', qtext = '', qbook = '', qtag = '';
export const setEtiqueta = t => { qtag = t || ''; };
const STOP = new Set('que los las una unos unas del con por para como pero más mas sus este esta esto estos estas ese esa eso fue era ser son han hay muy sin sobre entre cuando donde quien todo toda todos todas cada otro otra tiene tenía había habrá había hasta desde porque aunque también tambien cuyo aquel aquella'.split(' '));
export const etiquetasDe = n => n.tags || [];
export const todasEtiquetas = () => { const m = new Map(); for (const n of S.notes) for (const t of etiquetasDe(n)) m.set(t, (m.get(t) || 0) + 1); return [...m.entries()].sort((a, z) => z[1] - a[1] || a[0].localeCompare(z[0])); };
const limpiaTag = s => String(s).toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}\- ]/gu, '').trim().replace(/\s+/g, '-').slice(0, 24);
/** Palabras que más se repiten en la frase (y en el resto de tus frases con etiquetas), como ideas de etiqueta. */
export function sugeridas(n) {
  const ya = new Set(etiquetasDe(n)), conocidas = todasEtiquetas().map(x => x[0]), txt = ' ' + (n.text || '').toLowerCase() + ' ';
  const delTexto = [...new Set((n.text || '').toLowerCase().match(/\p{L}{5,}/gu) || [])].filter(w => !STOP.has(w));
  const out = []; for (const t of conocidas) if (!ya.has(t) && txt.includes(t.replace(/-/g, ' '))) out.push(t);
  for (const w of delTexto.sort((a, z) => z.length - a.length)) { if (out.length >= 6) break; if (!ya.has(w) && !out.includes(w)) out.push(w); }
  return out.slice(0, 6);
}

export function drawFrases(ctx) {
  const v = $('#v-fr'), all = S.notes.filter(n => !n._oculta).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const books = [...new Set(all.map(n => n.bookId))].map(id => byId(id)).filter(Boolean);
  const f = all.filter(n => (!qtext || n.text.toLowerCase().includes(qtext.toLowerCase()) || etiquetasDe(n).some(t => t.includes(qtext.toLowerCase()))) && (!qbook || String(n.bookId) === qbook) && (!qtag || etiquetasDe(n).includes(qtag)));
  const tags = todasEtiquetas();
  const dayQ = all.length ? all[S.ui.qi % all.length] : null;
  v.innerHTML = `<div class="apphead"><div><h2>Mis frases</h2><div class="sub">${all.length} ${all.length === 1 ? 'frase guardada' : 'frases guardadas'}</div></div><div class="row" style="gap:8px;flex-wrap:wrap;justify-content:flex-end">${all.length ? `<button class="btn ghost" id="exq">Exportar</button>` : ''}${pendientes().length >= 1 && all.length >= 3 ? `<button class="btn ghost" id="rpq">Repasar</button>` : ''}${window.AndroidApp?.escanearPagina ? `<button class="btn ghost" id="scp">${ic('camera')}Escanear</button>` : ''}<button class="btn" id="nq">${ic('plus')}Nueva</button></div></div><div class="pad">
   ${all.length ? `<div class="fbar2"><input id="qs" type="search" value="${esc(qtext)}" placeholder="Buscar en frases, libros y etiquetas" aria-label="Buscar en tus frases"><button class="iconbtn" id="qaj" aria-label="Ajustes de la lista">${ic('menu')}${tpl !== 'papel' || qbook ? '<i class="fdot" style="position:absolute;top:6px;right:6px"></i>' : ''}</button></div>
   ${tags.length ? `<div class="row" id="qtg" style="gap:6px;padding:0 18px 10px;overflow-x:auto;flex-wrap:nowrap"><button class="chip" data-tg="" aria-pressed="${!qtag}">Todas</button>${tags.map(([t, c]) => `<button class="chip" data-tg="${esc(t)}" aria-pressed="${qtag === t}">#${esc(t)} <em>${c}</em></button>`).join('')}</div>` : ''}
   ${(qtext || qbook || qtag) ? `<div class="sub" style="padding:0 18px 8px">${f.length} de ${all.length} frases</div>` : ''}
   <div class="masonry" id="quotes">${f.map(n => card(n)).join('') || `<div class="note">Ninguna frase coincide con tu búsqueda.</div>`}</div>`
   : `<div class="card onb">${ilustVacia()}<h3>Aún no tienes frases</h3><div class="sub">Mientras lees un EPUB, selecciona un texto y elige un color: queda subrayado y aparece aquí. También puedes escribir frases de libros de papel con «Nueva».</div></div>`}
  </div>`;
  function card(n) {
    const b = byId(n.bookId), cu = b && coverUrl(b), c = b?.c1 || '#555';
    return `<div class="q ${tpl}" data-id="${n.id}" style="--bc:${c};${cu && tpl === 'libro' ? `--art:url('${cu}')` : ''}"><span class="hdot" style="background:${HL[n.color] || HL.amarillo}"></span><q>“${esc(n.text)}”</q>${n.comment ? `<div class="qnote">${esc(n.comment)}</div>` : ''}${etiquetasDe(n).length ? `<div class="qtags">${etiquetasDe(n).map(t => `<span>#${esc(t)}</span>`).join('')}</div>` : ''}<div class="src"><span>${esc(n.title || '')}</span>
      <span class="qa"><button data-nt="${n.id}" aria-label="${n.comment ? 'Editar nota' : 'Agregar nota'}">${ic('edit')}Nota</button><button data-sh="${n.id}" aria-label="Compartir como imagen">${ic('image')}Compartir</button>${b?.hasFile && (n.cfi || n.pdfPag) ? `<button data-go="${n.id}" aria-label="Ir al pasaje">${ic('arrow')}</button>` : ''}<button data-del="${n.id}" aria-label="Borrar">${ic('trash')}</button></span></div></div>`;
  }
  $('#nq', v).onclick = () => newQuote(ctx);
  $('#exq', v)?.addEventListener('click', () => abrirExportar(qbook ? +qbook : null));
  $('#rpq', v)?.addEventListener('click', () => abrirRepaso(qtag));
  $$('#qtg [data-tg]', v).forEach(b => b.onclick = () => { qtag = b.dataset.tg; drawFrases(ctx); });
  $('#scp', v)?.addEventListener('click', () => escanearPagina());
  $('#qaj', v)?.addEventListener('click', () => {
    const o = openSheet(`<h3>Ajustes de la lista</h3><div class="lbl" style="margin-top:12px">Plantilla de las imágenes</div><div class="row" id="tplseg" style="gap:6px;margin-top:6px">${[['papel', 'Papel'], ['noche', 'Noche'], ['libro', 'Color del libro']].map(([k, n]) => `<button class="chip" data-t="${k}" aria-pressed="${tpl === k}">${n}</button>`).join('')}</div>
      ${books.length > 1 ? `<label style="display:grid;gap:4px;margin-top:14px;font-size:13px">Libro<select id="qb" aria-label="Filtrar por libro"><option value="">Todos los libros</option>${books.map(b => `<option value="${b.id}" ${String(b.id) === qbook ? 'selected' : ''}>${esc(b.t)}</option>`).join('')}</select></label>` : ''}
      <div class="row" style="margin-top:16px"><button class="btn" data-x>Listo</button></div>`);
    $$('#tplseg button', o).forEach(b => b.onclick = () => { tpl = b.dataset.t; closeSheet(); drawFrases(ctx); });
    $('#qb', o)?.addEventListener('change', e => { qbook = e.target.value; closeSheet(); drawFrases(ctx); });
  });
  $('#qs', v)?.addEventListener('input', e => { qtext = e.target.value; const pos = e.target.selectionStart; drawFrases(ctx); const i = $('#qs'); i.focus(); i.setSelectionRange(pos, pos); });
  $('#quotes', v)?.addEventListener('click', async e => {
    const nt = e.target.closest('[data-nt]');
    if (nt) return editarNota(S.notes.find(x => x.id === +nt.dataset.nt), () => drawFrases(ctx));
    const sh = e.target.closest('[data-sh]'), go = e.target.closest('[data-go]'), del = e.target.closest('[data-del]');
    if (sh) { const n = S.notes.find(x => x.id === +sh.dataset.sh); toast('Preparando la imagen…'); await shareImage(await imgQuote(n, tpl, byId(n.bookId)), 'frase.png', n.text); }
    else if (go) { const n = S.notes.find(x => x.id === +go.dataset.go); ctx.openReader(n.bookId, n.pdfPag || n.cfi); }
    else if (del) { borrarConDeshacer(S.notes.find(x => x.id === +del.dataset.del), ctx); }
  });
  // Deslizar una frase: a la izquierda se borra (con «Deshacer»), a la derecha se comparte.
  let sw = null;
  const qs = $('#quotes', v);
  qs?.addEventListener('pointerdown', e => {
    const c = e.target.closest('.q'); if (!c || e.target.closest('button,a,input,select,textarea')) return;
    sw = { c, x0: e.clientX, y0: e.clientY, dx: 0, on: false, pasado: false, id: e.pointerId };
  });
  qs?.addEventListener('pointermove', e => {
    if (!sw || e.pointerId !== sw.id) return; const dx = e.clientX - sw.x0, dy = e.clientY - sw.y0;
    if (!sw.on) { if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.6) { sw.on = true; try { sw.c.setPointerCapture(e.pointerId); } catch { } sw.c.style.transition = 'none'; } else if (Math.abs(dy) > 12) { sw = null; return; } else return; }
    sw.dx = dx; sw.c.style.transform = `translateX(${dx}px)`; sw.c.classList.toggle('swl', dx < -20); sw.c.classList.toggle('swr', dx > 20);
    const pasa = Math.abs(dx) > 90; if (pasa !== sw.pasado) { sw.pasado = pasa; if (pasa) haptic('tick'); }
  });
  const fin = async () => {
    if (!sw) return; const { c, dx, on } = sw; sw = null; if (!on) return;
    c.style.transition = 'transform .2s'; c.classList.remove('swl', 'swr'); const n = S.notes.find(x => x.id === +c.dataset.id);
    if (dx < -90) { c.style.transform = 'translateX(-110%)'; setTimeout(() => borrarConDeshacer(n, ctx), 160); }
    else { c.style.transform = ''; if (dx > 90 && n) { toast('Preparando la imagen…'); await shareImage(await imgQuote(n, tpl, byId(n.bookId)), 'frase.png', n.text); } }
  };
  qs?.addEventListener('pointerup', fin); qs?.addEventListener('pointercancel', fin);
}

// Borrar sin pedir confirmación: la frase se oculta y se puede deshacer durante 5 segundos.
function borrarConDeshacer(n, ctx) {
  if (!n) return; n._oculta = true; drawFrases(ctx);
  let deshecho = false;
  toastAccion('Frase borrada', 'Deshacer', () => { deshecho = true; delete n._oculta; drawFrases(ctx); });
  setTimeout(async () => { if (!deshecho && n._oculta) { try { await removeNote(n.id); } catch { } } }, 5200);
}

// Frase escrita a mano (por ejemplo, de un libro de papel)
function newQuote(ctx) {
  const o = openSheet(`<h3>Nueva frase</h3><form class="form" id="qf"><label>Frase<textarea name="t" rows="4" required maxlength="600" placeholder="Escribe o pega la frase"></textarea></label>
   <label>Libro<select name="b">${S.books.map(b => `<option value="${b.id}">${esc(b.t)}</option>`).join('')}</select></label><label>Página (opcional)<input name="p" inputmode="numeric" placeholder="Ej. 112"></label>
   <button class="btn" type="submit">Guardar frase</button></form>`);
  $('#qf', o).onsubmit = async e => {
    e.preventDefault(); const d = new FormData(e.target), b = byId(+d.get('b')); if (!b) return;
    await saveNote({ bookId: b.id, title: `${b.t} · ${b.a}${d.get('p') ? ' · pág. ' + d.get('p') : ''}`, text: d.get('t').trim(), cfi: null, color: 'amarillo', createdAt: Date.now() });
    closeSheet(); toast('Frase guardada');
  };
}

// Foto de una página de un libro de papel: Android reconoce el texto y aquí se elige el libro y se guarda como frase.
export function escanearPagina() {
  const A = window.AndroidApp; if (!A?.escanearPagina) return toast('Esto funciona en la app de Android.');
  window.__ocrTexto = texto => {
    const libros = S.books.slice().sort((a, b) => (b.upd || 0) - (a.upd || 0)), sel = libros.filter(b => b.s === 'leyendo').concat(libros.filter(b => b.s !== 'leyendo'));
    const o = openSheet(`<h3>Texto de la página</h3><div class="sub">Corrige lo que haga falta y deja solo la frase que quieres guardar.</div>
      <textarea id="ocrt" rows="8" style="width:100%;margin-top:10px;border-radius:12px;padding:10px;background:var(--surface2);color:var(--ink);border:1px solid var(--line);font:15px/1.5 var(--f-read)">${esc(texto)}</textarea>
      <label style="display:grid;gap:4px;margin-top:10px;font-size:13px">Libro<select id="ocrb">${sel.map(b => `<option value="${b.id}">${esc(b.t)}</option>`).join('')}</select></label>
      <div class="row" style="margin-top:14px"><button class="btn" id="ocrs">Guardar como frase</button><button class="btn ghost" id="ocrr">Otra foto</button></div>`);
    $('#ocrs', o).onclick = async () => {
      const t = $('#ocrt', o).value.replace(/\s+/g, ' ').trim(), b = byId(+$('#ocrb', o).value); if (!t || !b) return toast('Falta el texto o el libro');
      await saveNote({ bookId: b.id, title: `${b.t} · ${b.a}`, text: t.slice(0, 800), color: 'amarillo', createdAt: Date.now() });
      closeSheet(); toast('Frase guardada');
    };
    $('#ocrr', o).onclick = () => { closeSheet(); setTimeout(escanearPagina, 150); };
  };
  window.__ocrError = m => toast(m || 'No pude leer la página. Prueba con más luz.');
  A.escanearPagina();
}

// Nota propia sobre una frase subrayada.
export function editarNota(n, alGuardar) {
  if (!n) return;
  const o = openSheet(`<h3>Tu nota</h3><div class="sub" style="font-style:italic;margin-bottom:8px">«${esc(n.text.slice(0, 160))}${n.text.length > 160 ? '…' : ''}»</div>
    <textarea id="ntx" rows="5" maxlength="800" placeholder="Lo que pensaste al leer esto" style="width:100%;border-radius:12px;padding:10px;background:var(--surface2);color:var(--ink);border:1px solid var(--line);font:15px/1.5 var(--f-body)">${esc(n.comment || '')}</textarea>
    <label style="display:grid;gap:4px;margin-top:12px;font-size:13px">Etiquetas <span class="small">separadas por coma</span><input id="ntg" value="${esc(etiquetasDe(n).join(', '))}" placeholder="miedo, amistad, trabajo" autocomplete="off"></label>
    <div class="row" id="nts2" style="gap:6px;margin-top:8px">${sugeridas(n).map(t => `<button class="chip" data-sg="${esc(t)}">+ ${esc(t)}</button>`).join('')}</div>
    <div class="row" style="margin-top:12px"><button class="btn" id="nts">Guardar nota</button>${n.comment ? '<button class="btn ghost" id="ntd">Quitar nota</button>' : ''}</div>`);
  const leerTags = () => [...new Set($('#ntg', o).value.split(',').map(limpiaTag).filter(Boolean))].slice(0, 8);
  $$('#nts2 [data-sg]', o).forEach(b => b.onclick = () => { const l = leerTags(); if (!l.includes(b.dataset.sg)) l.push(b.dataset.sg); $('#ntg', o).value = l.join(', '); b.remove(); });
  const guarda = async t => { n.tags = leerTags(); n.comment = t; n.upd = Date.now(); await saveNote(n); closeSheet(); toast(t ? 'Nota guardada' : 'Nota quitada'); alGuardar && alGuardar(); };
  $('#nts', o).onclick = () => guarda($('#ntx', o).value.trim());
  $('#ntd', o)?.addEventListener('click', () => guarda(''));
  setTimeout(() => $('#ntx', o)?.focus(), 200);
}

// Texto compartido desde otra app (Compartir → Mi Biblioteca): se elige el libro y se guarda como frase.
export function guardarTextoCompartido(texto) {
  const libros = S.books.slice().sort((a, b) => (b.upd || 0) - (a.upd || 0)), sel = libros.filter(b => b.s === 'leyendo').concat(libros.filter(b => b.s !== 'leyendo'));
  if (!sel.length) return toast('Primero agrega un libro para guardar la frase');
  const o = openSheet(`<h3>Guardar como frase</h3><textarea id="cst" rows="6" style="width:100%;margin-top:10px;border-radius:12px;padding:10px;background:var(--surface2);color:var(--ink);border:1px solid var(--line);font:15px/1.5 var(--f-read)">${esc(texto)}</textarea>
    <label style="display:grid;gap:4px;margin-top:10px;font-size:13px">Libro<select id="csb">${sel.map(b => `<option value="${b.id}">${esc(b.t)}</option>`).join('')}</select></label>
    <div class="row" style="margin-top:14px"><button class="btn" id="css">Guardar frase</button></div>`);
  $('#css', o).onclick = async () => {
    const t = $('#cst', o).value.replace(/\s+/g, ' ').trim(), b = byId(+$('#csb', o).value); if (!t || !b) return toast('Falta el texto o el libro');
    await saveNote({ bookId: b.id, title: `${b.t} · ${b.a}`, text: t.slice(0, 800), color: 'amarillo', createdAt: Date.now() });
    closeSheet(); toast('Frase guardada');
  };
}
