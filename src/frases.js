import { S, byId, removeNote, saveNote, coverUrl } from './state.js';
import { P, setPref } from './prefs.js';
import { $, $$, esc, ic, toast, openSheet, closeSheet } from './ui.js';
import { imgQuote, shareImage } from './share.js';

export const HL = { amarillo: 'rgba(242,201,76,.6)', verde: 'rgba(123,196,127,.55)', azul: 'rgba(127,178,240,.55)', rosa: 'rgba(242,154,184,.6)' };
let tpl = 'papel', qtext = '', qbook = '';

export function drawFrases(ctx) {
  const v = $('#v-fr'), all = S.notes.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const books = [...new Set(all.map(n => n.bookId))].map(id => byId(id)).filter(Boolean);
  const f = all.filter(n => (!qtext || n.text.toLowerCase().includes(qtext.toLowerCase())) && (!qbook || String(n.bookId) === qbook));
  const dayQ = all.length ? all[S.ui.qi % all.length] : null;
  v.innerHTML = `<div class="apphead"><div><h2>Mis frases</h2><div class="sub">${all.length} ${all.length === 1 ? 'frase guardada' : 'frases guardadas'}</div></div><div class="row" style="gap:8px">${window.AndroidApp?.escanearPagina ? `<button class="btn ghost" id="scp">${ic('camera')}Escanear</button>` : ''}<button class="btn" id="nq">${ic('plus')}Nueva</button></div></div><div class="pad">
   ${all.length ? `<div class="fbar2"><div class="seg2" id="tplseg">${[['papel', 'Papel'], ['noche', 'Noche'], ['libro', 'Color del libro']].map(([k, n]) => `<button data-t="${k}" aria-pressed="${tpl === k}">${n}</button>`).join('')}</div>
     <input id="qs" type="search" value="${esc(qtext)}" placeholder="Buscar en tus frases" aria-label="Buscar en tus frases">
     ${books.length > 1 ? `<select id="qb" aria-label="Filtrar por libro"><option value="">Todos los libros</option>${books.map(b => `<option value="${b.id}" ${String(b.id) === qbook ? 'selected' : ''}>${esc(b.t)}</option>`).join('')}</select>` : ''}</div>
   <div class="masonry" id="quotes">${f.map(n => card(n)).join('') || `<div class="note">Ninguna frase coincide con tu búsqueda.</div>`}</div>`
   : `<div class="card onb"><h3>Aún no tienes frases</h3><div class="sub">Mientras lees un EPUB, selecciona un texto y elige un color: queda subrayado y aparece aquí. También puedes escribir frases de libros de papel con «Nueva».</div></div>`}
  </div>`;
  function card(n) {
    const b = byId(n.bookId), cu = b && coverUrl(b), c = b?.c1 || '#555';
    return `<div class="q ${tpl}" data-id="${n.id}" style="--bc:${c};${cu && tpl === 'libro' ? `--art:url('${cu}')` : ''}"><span class="hdot" style="background:${HL[n.color] || HL.amarillo}"></span><q>“${esc(n.text)}”</q><div class="src"><span>${esc(n.title || '')}</span>
      <span class="qa"><button data-sh="${n.id}" aria-label="Compartir como imagen">${ic('image')}Compartir</button>${b?.hasFile && n.cfi ? `<button data-go="${n.id}" aria-label="Ir al pasaje">${ic('arrow')}</button>` : ''}<button data-del="${n.id}" aria-label="Borrar">${ic('trash')}</button></span></div></div>`;
  }
  $('#nq', v).onclick = () => newQuote(ctx);
  $('#scp', v)?.addEventListener('click', () => escanearPagina());
  $$('#tplseg button', v).forEach(b => b.onclick = () => { tpl = b.dataset.t; drawFrases(ctx); });
  $('#qs', v)?.addEventListener('input', e => { qtext = e.target.value; const pos = e.target.selectionStart; drawFrases(ctx); const i = $('#qs'); i.focus(); i.setSelectionRange(pos, pos); });
  $('#qb', v)?.addEventListener('change', e => { qbook = e.target.value; drawFrases(ctx); });
  $('#quotes', v)?.addEventListener('click', async e => {
    const sh = e.target.closest('[data-sh]'), go = e.target.closest('[data-go]'), del = e.target.closest('[data-del]');
    if (sh) { const n = S.notes.find(x => x.id === +sh.dataset.sh); toast('Preparando la imagen…'); await shareImage(await imgQuote(n, tpl, byId(n.bookId)), 'frase.png', n.text); }
    else if (go) { const n = S.notes.find(x => x.id === +go.dataset.go); ctx.openReader(n.bookId, n.cfi); }
    else if (del) { await removeNote(+del.dataset.del); }
  });
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
