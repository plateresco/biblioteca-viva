import { S, ST, FORMATS, cnt, byId, setStatus, moveBook, spineGeom, fd, MES, today, saveNote, removeNote } from './state.js';
import { $, $$, esc, ic, toast } from './ui.js';
import { openCover, openAdd, openEdit, openSync, miniFace, datesLine } from './sheets.js';

/* ============ BIBLIOTECA ============ */
function packRows(books, avail) {
  const rows = []; let cur = [], w = 0;
  for (const b of books) {
    const bw = spineGeom(b).w + 2;
    if (cur.length && w + bw > avail) { rows.push(cur); cur = []; w = 0; }
    cur.push(b); w += bw;
  }
  if (cur.length) rows.push(cur);
  return rows;
}
const hash = id => (id * 2654435761 >>> 0);

export function drawLib(ctx) {
  const v = $('#v-lib'), u = S.ui, f = u.filter;
  const avail = Math.max(200, Math.min(v.clientWidth, 760) - 24 - 20 - 4);
  const rows = packRows(S.books, avail);
  const shelf = r => `<div class="shelfrow"><div class="shelf ${u.reorder ? 'reorder' : ''}">${r.map(b => {
    const g = spineGeom(b), hh = hash(b.id);
    const style = ['', 'serif', 'caps'][hh % 3];
    return `<button class="spine ${style} ${u.pick === b.id ? 'pick' : ''} ${f !== 'todos' && b.s !== f ? 'dim' : ''}" data-id="${b.id}"
      style="--c1:${b.c1 || '#555'};--c2:${b.c2 || '#bbb'};--tx:${b.dark === false ? '#1b1b1b' : '#F6F0E2'};--w:${g.w}px;--h:${g.h}px;--sc:${ST[b.s].c}" aria-label="${esc(b.t)}, ${ST[b.s].n}">
      <span class="foot"></span><span class="t">${esc(b.t)}</span><span class="dot"></span></button>`;
  }).join('')}</div><div class="board"></div></div>`;
  const add = `<div class="shelfrow"><div class="shelf" style="align-items:center;height:150px"><div class="slots">
    <button class="slot" id="addBtn">${ic('plus')}Agregar libros</button></div></div><div class="board"></div></div>`;
  v.innerHTML = `<div class="glow"></div>
  <div class="apphead"><div><h2>Mi biblioteca</h2><div class="sub">${S.books.length} libros · ${cnt('leido')} leídos</div></div>
    <div class="row" style="gap:8px"><button class="iconbtn" id="syn" aria-label="Sincronizar con Google Drive">${ic('cloud')}</button>
    <button class="iconbtn" id="reo" aria-pressed="${u.reorder}" aria-label="Reordenar libros" ${S.books.length < 2 ? 'hidden' : ''}>${ic('move')}</button></div></div>
  ${S.books.length ? `<div class="chips">${['todos', 'leyendo', 'porleer', 'leido', 'abandonado'].map(k => `<button class="chip" data-f="${k}" aria-pressed="${f === k}">${k === 'todos' ? 'Todos' : ST[k].n}</button>`).join('')}</div>` : ''}
  ${u.reorder ? `<div class="hint">${u.pick ? 'Ahora toca el libro donde quieres dejarlo.' : 'Toca un libro para levantarlo.'}</div>` : ''}
  ${S.books.length ? rows.map(shelf).join('') : `<div class="welcome"><h3>Tu estantería está vacía</h3>Agrega tu primer libro en EPUB y aparecerá aquí con su propio lomo.</div>`}
  ${add}
  <div class="legend">${Object.values(ST).map(s => `<span><i style="--sc:${s.c}"></i>${s.n}</span>`).join('')}</div>`;
  $$('.chip', v).forEach(c => c.onclick = () => { u.filter = c.dataset.f; drawLib(ctx); });
  $('#reo', v).onclick = () => { u.reorder = !u.reorder; u.pick = null; drawLib(ctx); };
  $('#addBtn', v).onclick = openAdd;
  $('#syn', v).onclick = openSync;
  $$('.spine', v).forEach(s => s.onclick = async () => {
    const id = +s.dataset.id;
    if (u.reorder) {
      if (!u.pick) u.pick = id;
      else if (u.pick === id) u.pick = null;
      else { await moveBook(u.pick, id); u.pick = null; }
      drawLib(ctx);
    } else {
      s.classList.add('out');
      openCover(id, { openReader: ctx.openReader, onClose: () => s.classList.remove('out') });
    }
  });
}

/* ============ LISTAS ============ */
export function drawList(ctx) {
  const v = $('#v-list'), L = S.ui.listTab, items = S.books.filter(b => b.s === L);
  const order = ['leyendo', 'porleer', 'leido', 'abandonado'];
  v.innerHTML = `<div class="apphead"><div><h2>Mis listas</h2><div class="sub">Cambia el estado y las fechas se anotan solas</div></div></div>
  <div class="seg" role="tablist">${order.map(k => `<button role="tab" data-l="${k}" aria-selected="${L === k}"><b>${cnt(k)}</b>${ST[k].n}</button>`).join('')}</div>
  ${items.length ? items.map(b => `<div class="item">${miniFace(b)}
    <div class="body"><div><h4>${esc(b.t)}</h4><p>${esc(b.a)}</p></div>
      <div><span class="tag">${esc(b.f)}</span> <span class="small">${b.p} págs.</span></div>
      <p>${datesLine(b)}</p>
      ${b.s === 'leyendo' || b.s === 'abandonado' ? `<div class="pbar"><i style="width:${Math.round((b.r || 0) / b.p * 100)}%"></i></div><p>${b.r || 0} de ${b.p} páginas</p>` : ''}
      <div class="row" style="align-items:center;gap:8px">
        <select data-id="${b.id}" aria-label="Estado de ${esc(b.t)}">${order.map(k => `<option value="${k}" ${k === b.s ? 'selected' : ''}>${ST[k].n}</option>`).join('')}</select>
        <button class="small" data-open="${b.id}" style="color:var(--accent);font-weight:700">Ver ficha</button></div></div></div>`).join('')
    : `<div class="empty">${S.books.length ? 'No hay libros en esta lista.' : 'Aún no tienes libros. Agrégalos desde la biblioteca.'}</div>`}`;
  $$('.seg button', v).forEach(b => b.onclick = () => { S.ui.listTab = b.dataset.l; drawList(ctx); });
  $$('select', v).forEach(s => s.onchange = async () => { await setStatus(byId(+s.dataset.id), s.value); });
  $$('[data-open]', v).forEach(b => b.onclick = () => openCover(+b.dataset.open, { openReader: ctx.openReader }));
}

/* ============ CIFRAS ============ */
function goalKey() { return 'bv-meta-' + new Date().getFullYear(); }
export function drawStats() {
  const v = $('#v-stats'), mes = S.ui.statsMode === 'mes', now = new Date(), yr = now.getFullYear();
  const byMonth = Array(12).fill(0), byYear = {};
  for (const l of S.log) {
    const [y, m] = l.date.split('-').map(Number);
    byYear[y] = (byYear[y] || 0) + l.pages;
    if (y === yr) byMonth[m - 1] += l.pages;
  }
  const years = Object.keys(byYear).map(Number).sort(); if (!years.includes(yr)) years.push(yr);
  const data = mes ? byMonth.map((n, i) => [MES[i][0].toUpperCase(), n]).slice(0, now.getMonth() + 1) : years.map(y => [String(y), byYear[y] || 0]);
  const max = Math.max(1, ...data.map(d => d[1]));
  const doneYear = S.books.filter(b => b.s === 'leido' && b.en && b.en.startsWith(String(yr))).length;
  let goal = 12; try { goal = +localStorage.getItem(goalKey()) || 12; } catch { }
  const pct = Math.min(1, doneYear / goal), R = 40, C = 2 * Math.PI * R;
  // racha: días seguidos con lectura, contando hacia atrás desde hoy (o ayer)
  const days = new Set(S.log.filter(l => l.pages > 0).map(l => l.date));
  let streak = 0; const d = new Date(); if (!days.has(today())) d.setDate(d.getDate() - 1);
  for (;;) { const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; if (!days.has(k)) break; streak++; d.setDate(d.getDate() - 1); }
  const fmt = n => n.toLocaleString('es-CL');
  const done = S.books.filter(b => b.s === 'leido');
  v.innerHTML = `<div class="apphead"><div><h2>Mis cifras</h2><div class="sub">Páginas leídas y metas</div></div></div><div class="pad">
   <div class="tiles"><div class="tile"><b>${fmt(byMonth[now.getMonth()])}</b><span>páginas en ${MES[now.getMonth()]}.</span></div><div class="tile"><b>${fmt(byYear[yr] || 0)}</b><span>páginas en ${yr}</span></div>
    <div class="tile"><b>${doneYear}</b><span>libros leídos en ${yr}</span></div><div class="tile"><b>${streak} ${streak === 1 ? 'día' : 'días'}</b><span>racha leyendo</span></div></div>
   <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3>Páginas leídas</h3>
     <div class="row" style="gap:6px"><button class="chip" data-m="mes" aria-pressed="${mes}">Por mes</button><button class="chip" data-m="anio" aria-pressed="${!mes}">Por año</button></div></div>
     <div class="sub">${mes ? `${yr}, mes a mes` : 'Año a año'}</div>
     ${S.log.length ? `<div class="bars">${data.map((d, i) => `<div class="bar ${i === data.length - 1 ? 'cur' : ''}"><em>${d[1] || ''}</em><i style="height:${Math.max(2, d[1] / max * 78)}%"></i></div>`).join('')}</div>
     <div class="xl">${data.map(d => `<span>${d[0]}</span>`).join('')}</div>` : `<div class="empty" style="padding:24px 0 8px">Cuando leas en la app o registres tu avance, aquí verás cuántas páginas llevas.</div>`}</div>
   <div class="card"><div class="ringwrap"><svg class="ring" viewBox="0 0 100 100" role="img" aria-label="${doneYear} de ${goal} libros"><circle class="tr" cx="50" cy="50" r="${R}"/><circle class="fg" cx="50" cy="50" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 50 50)"/><text x="50" y="58">${doneYear}</text></svg>
     <div><h3>Meta del año</h3><div class="sub">${doneYear} de <input class="goalin" id="goal" type="number" min="1" value="${goal}" aria-label="Meta de libros"> libros.<br>${goal - doneYear > 0 ? `Faltan ${goal - doneYear}.` : '¡Meta cumplida!'}</div></div></div></div>
   <div class="card"><h3>Cómo lees</h3><div class="sub" style="margin-bottom:10px">Libros terminados por formato</div>
     ${FORMATS.map(f => { const n = done.filter(b => b.f === f).length; return `<div style="display:grid;grid-template-columns:56px 1fr 20px;gap:10px;align-items:center;margin:6px 0;font-size:13px"><span>${f}</span><div class="pbar"><i style="width:${done.length ? n / done.length * 100 : 0}%"></i></div><b>${n}</b></div>`; }).join('')}</div>
  </div>`;
  $$('[data-m]', v).forEach(b => b.onclick = () => { S.ui.statsMode = b.dataset.m; drawStats(); });
  $('#goal', v).onchange = e => { try { localStorage.setItem(goalKey(), Math.max(1, +e.target.value || 12)); } catch { } drawStats(); };
}

/* ============ DESCUBRIR ============ */
function promptText() {
  const done = S.books.filter(b => b.s === 'leido').map(b => `${b.t} (${b.a})`);
  const ing = S.books.filter(b => b.s === 'leyendo').map(b => `${b.t} (${b.a})`);
  const drop = S.books.filter(b => b.s === 'abandonado').map(b => `${b.t} (${b.a})`);
  return `Recomiéndame 5 libros para leer a continuación, en español neutro, con una frase que explique por qué me gustaría cada uno.\n\nLibros que he leído: ${done.join('; ') || 'ninguno aún'}.\nLibros que estoy leyendo: ${ing.join('; ') || 'ninguno'}.\nLibros que abandoné (evita algo parecido): ${drop.join('; ') || 'ninguno'}.\nNo repitas los que ya tengo.`;
}
export function drawDisc(ctx) {
  const v = $('#v-disc'), notes = S.notes;
  const q = notes.length ? notes[S.ui.qi % notes.length] : null;
  v.innerHTML = `<div class="apphead"><div><h2>Descubrir</h2><div class="sub">Tus frases y lecturas nuevas</div></div></div><div class="pad">
   <div class="sech"><h3>Frase para hoy</h3><span class="badge">de tus libros</span></div>
   ${q ? `<div class="quote"><q>“${esc(q.text)}”</q><div class="src"><span>${esc(q.title)}</span>${byId(q.bookId)?.hasFile ? `<button id="goq">Ir al pasaje ${ic('arrow')}</button>` : ''}</div></div>
     <div class="dots">${notes.map((_, i) => `<button data-q="${i}" aria-label="Frase ${i + 1}" aria-current="${i === S.ui.qi % notes.length}"></button>`).join('')}</div>`
     : `<div class="note">Aún no guardaste ninguna frase. Mientras lees, selecciona un texto y toca “Guardar frase”: aparecerá aquí y rotará cada día.</div>`}
   ${notes.length ? `<div class="sech"><h3>Todas tus frases</h3><span class="badge">${notes.length}</span></div>${notes.map(n => `<div class="noteitem"><div style="flex:1;min-width:0"><q>“${esc(n.text)}”</q><div class="small">${esc(n.title)}</div></div><button class="iconbtn" data-del="${n.id}" aria-label="Borrar frase">${ic('trash')}</button></div>`).join('')}` : ''}
   <div class="sech" style="margin-top:22px"><h3>Para tu próxima lectura</h3><span class="badge">con IA</span></div>
   <textarea class="ask" id="ask" readonly aria-label="Pregunta para la IA">${esc(promptText())}</textarea>
   <div class="row" style="margin-top:10px"><button class="btn" id="cp">${ic('copy')}Copiar pregunta</button><a class="btn ghost" href="https://www.perplexity.ai/" target="_blank" rel="noopener">Abrir Perplexity</a></div>
   <div class="note">Arma la pregunta con lo que marcaste como leído, en lectura y abandonado. Más adelante se puede conectar la respuesta directo a la app.</div>
  </div>`;
  $$('.dots button', v).forEach(b => b.onclick = () => { S.ui.qi = +b.dataset.q; drawDisc(ctx); });
  $('#goq', v)?.addEventListener('click', () => ctx.openReader(q.bookId, q.cfi));
  $$('[data-del]', v).forEach(b => b.onclick = async () => { await removeNote(+b.dataset.del); });
  $('#cp', v).onclick = async () => {
    try { await navigator.clipboard.writeText($('#ask', v).value); toast('Pregunta copiada'); }
    catch { $('#ask', v).select(); toast('Selecciónala y cópiala'); }
  };
}
