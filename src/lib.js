import { S, ST, cnt, byId, moveBook, moveToIndex, spineGeom, saveMeta, startManual, arrange, removePiso, reorderPisos, newId, pisoOf } from './state.js';
import { P, setPref } from './prefs.js';
import { $, $$, esc, ic, toast, reduce, openSheet, closeSheet } from './ui.js';
import { openCover, openAdd, openSync } from './sheets.js';
import { spineStyle, spineInner, spineStyleClass } from './spine.js';
import { openScene } from './scene.js';
import { drawDetail } from './detail.js';
import { openPalette } from './palette.js';
import { OBJ, PISO_H } from './objects.js';
import { coverUrl } from './state.js';

export const isWide = () => innerWidth >= 1000;
const BOOKEND = 37;
let suppressClick = false;

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
export const inCol = b => { const c = S.ui.col; return c === null || (c === '_loan' ? !!b.loan : (b.cols || []).includes(c)); };
const stateOk = b => S.ui.filter === 'todos' || b.s === S.ui.filter;
const dimmed = b => !stateOk(b) || !inCol(b);
const hit = b => (S.ui.filter !== 'todos' || S.ui.col !== null) && !dimmed(b);

function spineHTML(b, extra = '') {
  const u = S.ui;
  return `<button class="spine ${spineStyleClass(b)} ${u.pick === b.id ? 'pick' : ''} ${u.sel === b.id ? 'sel' : ''} ${dimmed(b) ? 'dim' : ''} ${hit(b) ? 'hit' : ''} ${extra}" data-id="${b.id}" style="${spineStyle(b)}" aria-label="${esc(b.t)}, ${ST[b.s].n}">${spineInner(b)}</button>`;
}
const pisoBooks = (p, first) => S.books.filter(b => b.piso === p.id || (first && !S.meta.pisos.some(x => x.id === b.piso)));

export function selectBook(id, ctx) {
  S.ui.sel = id;
  $$('#v-lib .spine, #v-lib .btile, #v-lib .lrow').forEach(e => e.classList.toggle('sel', +e.dataset.id === id));
  drawDetail(ctx);
}

export function drawLib(ctx) {
  const v = $('#v-lib'), u = S.ui, f = u.filter, view = P.view, manual = S.meta.mode === 'manual' && view === 'shelf';
  const FL = [['todos', 'Todos'], ['leyendo', 'Leyendo'], ['porleer', 'Por leer'], ['leido', 'Leído'], ['abandonado', 'Abandonado']];
  const count = k => k === 'todos' ? S.books.length : cnt(k);
  const avail = Math.max(200, v.clientWidth - 24 - 20 - 4 - BOOKEND);

  let body = '';
  if (!S.books.length) body = `<div class="welcome"><h3>Tu estantería está vacía</h3>Agrega tu primer libro en EPUB, con el ISBN de un libro de papel o desde un archivo CSV.</div>`;
  else if (view === 'shelf' && !manual) {
    body = packRows(S.books, avail).map(r => `<div class="shelfrow"><div class="shelf ${u.reorder ? 'reorder' : ''}">${r.map(b => spineHTML(b)).join('')}<i class="bookend"></i></div><div class="board"></div></div>`).join('');
  } else if (view === 'shelf') {
    body = S.meta.pisos.map((p, i) => {
      const bs = pisoBooks(p, i === 0), tall = bs.filter(b => spineGeom(b).h > (PISO_H[p.h] || 196) - 14).length;
      return `<section class="piso" data-piso="${p.id}"><div class="plq"><button class="plate" data-pe="${p.id}" aria-label="Editar piso ${esc(p.n)}">${esc(p.n)}</button><em>${bs.length} ${bs.length === 1 ? 'libro' : 'libros'}${tall ? ` · ${tall} más alto${tall > 1 ? 's' : ''} que el piso` : ''}</em><span class="grow"></span><button class="mbtn" data-pe="${p.id}" aria-label="Opciones del piso">${ic('more')}</button></div>
        <div class="shelf h-${p.h || 'normal'} ${u.reorder ? 'reorder' : ''}" data-p="${p.id}">${bs.map(b => spineHTML(b, spineGeom(b).h > (PISO_H[p.h] || 196) - 14 ? 'big' : '')).join('') || '<div class="empty">Piso vacío. Mantén presionado un libro y arrástralo hasta aquí.</div>'}${p.o ? OBJ[p.o] : ''}<i class="bookend"></i></div><div class="board"></div></section>`;
    }).join('') + `<button class="addp" id="addp">${ic('plus')} Agregar piso</button>`;
  } else if (view === 'grid') {
    body = `<div class="cgrid">${S.books.map(b => { const cu = coverUrl(b); return `<button class="btile ${u.sel === b.id ? 'sel' : ''} ${dimmed(b) ? 'dim' : ''}" data-id="${b.id}"><span class="cv" style="--c1:${b.c1 || '#555'};${cu ? `--art:url('${cu}')` : ''}">${cu ? '' : `<span>${esc(b.t)}</span>`}</span><b>${esc(b.t)}</b><small>${esc(b.a)}</small><i class="tp" style="--w:${Math.round((b.r || 0) / b.p * 100)}%;--sc:${ST[b.s].c}"></i></button>`; }).join('')}</div>`;
  } else {
    body = `<div class="lrows">${S.books.map(b => { const cu = coverUrl(b); return `<button class="lrow ${u.sel === b.id ? 'sel' : ''} ${dimmed(b) ? 'dim' : ''}" data-id="${b.id}"><span class="lc" style="--c1:${b.c1 || '#555'};${cu ? `--art:url('${cu}')` : ''}"></span><span class="lt"><b>${esc(b.t)}</b><small>${esc(b.a)}</small></span><span class="spill" style="--c:${ST[b.s].c}"><i></i>${ST[b.s].n}</span><span class="lp">${b.p} págs.</span><span class="lb2"><i style="width:${Math.round((b.r || 0) / b.p * 100)}%"></i></span></button>`; }).join('')}</div>`;
  }
  const cols = S.meta.cols;
  v.innerHTML = `<div class="glow"></div>
  <div class="apphead"><div><h2>Mi biblioteca</h2><div class="sub">${S.books.length} libros · ${cnt('leido')} leídos</div></div>
    <div class="row" style="gap:8px"><button class="iconbtn" id="srch" aria-label="Buscar">${ic('search')}</button><button class="iconbtn" id="syn" aria-label="Sincronizar con Google Drive">${ic('cloud')}</button>
    <button class="iconbtn" id="reo" aria-pressed="${u.reorder}" aria-label="Reordenar libros" ${S.books.length < 2 ? 'hidden' : ''}>${ic('move')}</button></div></div>
  ${S.books.length ? `<div class="tb"><div class="fbar"><div class="chips" id="chips"><span class="ind" id="ind"></span>${FL.map(([k, n]) => `<button class="chip" data-f="${k}" aria-pressed="${f === k}">${n} <em>${count(k)}</em></button>`).join('')}</div></div>
    <div class="vw" role="group" aria-label="Vista">${[['shelf', 'shelf', 'Estantería'], ['grid', 'grid', 'Portadas'], ['list', 'list', 'Lista']].map(([k, i, n]) => `<button data-v="${k}" aria-pressed="${view === k}" aria-label="${n}" title="${n}">${ic(i)}</button>`).join('')}</div></div>
   <div class="tb2">${view === 'shelf' ? `<span class="lbl">Pisos</span><span class="mini-seg"><button data-pm="auto" aria-pressed="${S.meta.mode !== 'manual'}">Automático</button><button data-pm="manual" aria-pressed="${S.meta.mode === 'manual'}">Manual</button></span>` : ''}
     ${cols.length || S.books.some(b => b.loan) ? `<span class="lbl" style="margin-left:6px">Colección</span><button class="cchip" data-c="" aria-pressed="${u.col === null}">Todas</button>${cols.map(c => `<button class="cchip" data-c="${c.id}" aria-pressed="${u.col === c.id}">${esc(c.n)}</button>`).join('')}${S.books.some(b => b.loan) ? `<button class="cchip" data-c="_loan" aria-pressed="${u.col === '_loan'}">Prestados</button>` : ''}` : ''}</div>` : ''}
  ${u.reorder ? `<div class="hint" style="margin:4px 20px 8px">${u.pick ? 'Ahora toca el libro donde quieres dejarlo.' : 'Toca un libro para levantarlo, o mantenlo presionado para arrastrarlo.'}</div>` : ''}
  ${body}
  ${view === 'shelf' ? `<div class="shelfrow"><div class="shelf" style="align-items:center;height:150px"><div class="slots"><button class="slot" id="addBtn">${ic('plus')}Agregar libros</button></div></div><div class="board"></div></div>` : `<div style="padding:8px 18px 20px"><button class="slot" id="addBtn" style="height:90px;width:100%">${ic('plus')}Agregar libros</button></div>`}
  <div class="legend">${Object.values(ST).map(s => `<span><i style="--sc:${s.c}"></i>${s.n}</span>`).join('')}</div>`;

  // filtros: la píldora dorada se desliza
  const chips = $('#chips', v), ind = $('#ind', v);
  if (chips) {
    const moveInd = () => { const on = $('.chip[aria-pressed="true"]', chips); if (on) { ind.style.width = on.offsetWidth + 'px'; ind.style.transform = `translateX(${on.offsetLeft}px)`; } };
    const edges = () => { const m = chips.scrollWidth - chips.clientWidth; chips.style.setProperty('--fl', chips.scrollLeft > 4 ? '28px' : '0px'); chips.style.setProperty('--fr', chips.scrollLeft < m - 4 ? '34px' : '0px'); };
    chips.addEventListener('scroll', edges); edges();
    requestAnimationFrame(() => { moveInd(); requestAnimationFrame(() => ind.classList.add('go')); });
    $$('.chip', chips).forEach(c => c.onclick = () => {
      u.filter = c.dataset.f; $$('.chip', chips).forEach(x => x.setAttribute('aria-pressed', x === c)); moveInd();
      c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      applyDim(v);
    });
  }
  $$('.cchip', v).forEach(c => c.onclick = () => { u.col = c.dataset.c === '' ? null : c.dataset.c; $$('.cchip', v).forEach(x => x.setAttribute('aria-pressed', x === c)); applyDim(v); });
  $$('.vw button', v).forEach(b => b.onclick = () => { setPref('view', b.dataset.v); drawLib(ctx); });
  $$('[data-pm]', v).forEach(b => b.onclick = async () => {
    if (b.dataset.pm === 'manual' && S.meta.mode !== 'manual') { await startManual(packRows(S.books, avail)); toast('Ahora decides tú qué va en cada piso'); }
    else if (b.dataset.pm === 'auto' && S.meta.mode !== 'auto') { S.meta.mode = 'auto'; await saveMeta(); toast('Los pisos se llenan solos'); }
  });
  $('#reo', v).onclick = () => { u.reorder = !u.reorder; u.pick = null; drawLib(ctx); };
  $$('#addBtn', v).forEach(b => b.onclick = openAdd);
  $('#syn', v).onclick = openSync;
  $('#srch', v).onclick = openPalette;
  $('#addp', v)?.addEventListener('click', async () => { S.meta.pisos.push({ id: newId(), n: 'Piso ' + (S.meta.pisos.length + 1), h: 'normal', o: '' }); await saveMeta(); setTimeout(() => { const m = $('#v-lib'); m.scrollTop = m.scrollHeight; }, 50); });
  $$('[data-pe]', v).forEach(b => b.onclick = () => openPisoSheet(b.dataset.pe));
  const open = (id, el) => {
    if (suppressClick) return;
    if (u.reorder) {
      (async () => {
        if (!u.pick) u.pick = id; else if (u.pick === id) u.pick = null; else { await moveBook(u.pick, id); u.pick = null; }
        drawLib(ctx);
      })(); return;
    }
    if (isWide()) selectBook(id, ctx);
    else if (el.classList.contains('spine')) openScene(id, el, ctx);
    else openCover(id, { openReader: ctx.openReader });
  };
  $$('.spine, .btile, .lrow', v).forEach(e => { e.onclick = () => open(+e.dataset.id, e); e.ondblclick = () => { if (isWide() && e.classList.contains('spine')) openScene(+e.dataset.id, e, ctx); }; });
  if (!v._drag) { v._drag = true; setupDrag(v, ctx); setupTip(v); }
  drawDetail(ctx);
}

// Una sola etiqueta compartida (en vez de una por libro): aparece al pasar el cursor por un lomo.
function setupTip(v) {
  if (!matchMedia('(hover:hover)').matches) return;
  let tip = $('#sptip'); if (!tip) { tip = document.createElement('div'); tip.id = 'sptip'; document.body.appendChild(tip); }
  v.addEventListener('pointerover', e => {
    const s = e.target.closest('.spine'); if (!s || s.classList.contains('drag')) return;
    const b = byId(+s.dataset.id); if (!b) return;
    tip.textContent = `${b.t} · ${b.p} págs.`;
    const r = s.getBoundingClientRect(), w = tip.offsetWidth;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px'; tip.style.top = Math.max(8, r.top - 44) + 'px';
    tip.classList.add('on');
  });
  v.addEventListener('pointerout', e => { if (e.target.closest('.spine')) tip.classList.remove('on'); });
  v.addEventListener('pointerdown', () => tip.classList.remove('on'));
}

function applyDim(v) {
  $$('.spine, .btile, .lrow', v).forEach(s => { const b = byId(+s.dataset.id); if (!b) return; s.classList.toggle('dim', dimmed(b)); s.classList.toggle('hit', hit(b)); });
}

/* ---- Hoja de un piso: nombre, alto, objeto, orden y borrar ---- */
function openPisoSheet(id) {
  const p = pisoOf(id); if (!p) return;
  const i = S.meta.pisos.findIndex(x => x.id === id), n = S.meta.pisos.length;
  const o = openSheet(`<h3>Piso</h3><form class="form" id="pf">
    <label>Nombre<input name="n" maxlength="24" value="${esc(p.n)}"></label>
    <div><div class="small" style="margin-bottom:6px">Alto del piso</div><div class="seg" style="margin:0" id="ph">${[['bajo', 'Bajo'], ['normal', 'Normal'], ['alto', 'Alto']].map(([k, t]) => `<button type="button" data-h="${k}" aria-selected="${p.h === k}">${t}</button>`).join('')}</div></div>
    <div><div class="small" style="margin-bottom:6px">Objeto decorativo</div><div class="seg" style="margin:0;grid-template-columns:repeat(4,1fr)" id="po">${[['', 'Ninguno'], ['planta', 'Planta'], ['reloj', 'Reloj'], ['trofeo', 'Trofeo']].map(([k, t]) => `<button type="button" data-o="${k}" aria-selected="${(p.o || '') === k}">${t}</button>`).join('')}</div></div>
    <div class="row"><button class="btn" type="submit">Guardar</button><button class="btn ghost" type="button" id="up" ${i === 0 ? 'disabled' : ''}>Subir</button><button class="btn ghost" type="button" id="dn" ${i === n - 1 ? 'disabled' : ''}>Bajar</button>
      <button class="btn danger" type="button" id="del" ${n === 1 ? 'disabled' : ''}>Quitar piso</button></div></form>`);
  let h = p.h || 'normal', ob = p.o || '';
  $$('#ph button', o).forEach(b => b.onclick = () => { h = b.dataset.h; $$('#ph button', o).forEach(x => x.setAttribute('aria-selected', x === b)); });
  $$('#po button', o).forEach(b => b.onclick = () => { ob = b.dataset.o; $$('#po button', o).forEach(x => x.setAttribute('aria-selected', x === b)); });
  $('#pf', o).onsubmit = async e => { e.preventDefault(); p.n = (new FormData(e.target).get('n') || '').trim() || p.n; p.h = h; p.o = ob; await saveMeta(); closeSheet(); };
  const move = async d => { const ids = S.meta.pisos.map(x => x.id); const j = ids.indexOf(id); [ids[j], ids[j + d]] = [ids[j + d], ids[j]]; await reorderPisos(ids); closeSheet(); };
  $('#up', o).onclick = () => move(-1); $('#dn', o).onclick = () => move(1);
  let armed = false;
  $('#del', o).onclick = async ev => { if (!armed) { armed = true; ev.currentTarget.textContent = 'Toca otra vez: sus libros pasan al piso vecino'; return; } await removePiso(id); closeSheet(); };
}

/* ---- Arrastrar para reordenar: mantén presionado un libro, llévalo (incluso a otro piso) y suéltalo en el hueco ---- */
function setupDrag(v, ctx) {
  let drag = null;
  v.addEventListener('pointerdown', e => {
    const el = e.target.closest('.spine');
    if (!el || drag || e.button > 0) return;
    const sx = e.clientX, sy = e.clientY;
    const timer = setTimeout(() => { cleanup(); begin(el, sx, sy); }, reduce ? 0 : 230);
    const cleanup = () => { clearTimeout(timer); removeEventListener('pointerup', cleanup); removeEventListener('pointercancel', cleanup); removeEventListener('pointermove', mv); };
    const mv = ev => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 9) cleanup(); };
    addEventListener('pointerup', cleanup); addEventListener('pointercancel', cleanup); addEventListener('pointermove', mv);
  });
  function begin(el, sx, sy) {
    const r = el.getBoundingClientRect(), ph = document.createElement('div');
    ph.className = 'ph'; ph.style.width = r.width + 'px'; ph.style.height = r.height + 'px'; ph.innerHTML = '<span class="pos"></span>';
    el.parentElement.insertBefore(ph, el); el.classList.add('drag');
    Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    const offX = sx - r.left, offY = sy - r.top;
    drag = { el, ph }; suppressClick = true; document.body.style.userSelect = 'none';
    try { navigator.vibrate && navigator.vibrate(8); } catch { }
    const spines = () => $$('.spine', v).filter(s => s !== el);
    const label = () => { const all = $$('.spine, .ph', v).filter(c => c !== el); ph.firstChild.textContent = (all.indexOf(ph) + 1) + '.º'; };
    label();
    let lastY = sy;
    const nextOf = () => { let n = ph.nextElementSibling; if (n === el) n = n.nextElementSibling; return n; };
    const place = (cx, cy) => {
      const rows = $$('.shelf', v).filter(s => s.querySelector('.bookend'));
      let row = rows[0], best = 1e9;
      for (const s of rows) { const b = s.getBoundingClientRect(), d = cy < b.top ? b.top - cy : cy > b.bottom ? cy - b.bottom : 0; if (d < best) { best = d; row = s; } }
      row.querySelector('.empty')?.style.setProperty('display', 'none');
      let before = null;
      for (const s of $$('.spine', row).filter(x => x !== el)) { const b = s.getBoundingClientRect(); if (cx < b.left + b.width / 2) { before = s; break; } }
      const tgt = before || row.querySelector('.bookend');
      if (row === ph.parentElement && nextOf() === tgt) return;
      const first = new Map(spines().map(s => [s, s.getBoundingClientRect()]));
      row.insertBefore(ph, tgt); label();
      if (!reduce) spines().forEach(s => {
        const a = first.get(s), b = s.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
        if (dx || dy) { s.style.transition = 'none'; s.style.translate = `${dx}px ${dy}px`; s.getBoundingClientRect(); s.style.transition = 'translate .2s cubic-bezier(.2,.8,.3,1)'; s.style.translate = ''; setTimeout(() => { s.style.transition = ''; }, 230); }
      });
    };
    // el libro sigue al dedo en cada evento, pero el cálculo de dónde cae se hace una vez por cuadro
    let pend = null;
    const move = ev => {
      lastY = ev.clientY; el.style.left = (ev.clientX - offX) + 'px'; el.style.top = (ev.clientY - offY) + 'px';
      if (pend) { pend.x = ev.clientX; pend.y = ev.clientY; return; }
      pend = { x: ev.clientX, y: ev.clientY };
      requestAnimationFrame(() => { const p = pend; pend = null; if (p && drag) place(p.x - offX + r.width / 2, p.y); });
    };
    let raf = 0;
    const scroll = () => { const vb = v.getBoundingClientRect(); if (lastY < vb.top + 90) v.scrollTop -= 9; else if (lastY > vb.bottom - 90) v.scrollTop += 9; raf = requestAnimationFrame(scroll); };
    raf = requestAnimationFrame(scroll);
    const prevent = ev => ev.preventDefault();
    addEventListener('touchmove', prevent, { passive: false });
    const up = async () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); removeEventListener('touchmove', prevent);
      cancelAnimationFrame(raf);
      const all = $$('.spine, .ph', v).filter(c => c !== el), idx = all.indexOf(ph), pr = ph.getBoundingClientRect();
      const fin = async () => {
        document.body.style.userSelect = ''; drag = null; setTimeout(() => { suppressClick = false; }, 350);
        if (S.meta.mode === 'manual' && P.view === 'shelf') {
          const id = +el.dataset.id, plan = $$('.piso', v).map(sec => ({ pisoId: sec.dataset.piso, ids: [...$('.shelf', sec).children].map(c => c === ph ? id : (c.classList.contains('spine') && c !== el ? +c.dataset.id : null)).filter(x => x !== null) }));
          await arrange(plan);
        } else await moveToIndex(+el.dataset.id, idx);
      };
      if (reduce) return fin();
      const cur = el.getBoundingClientRect();
      const a = el.animate([{ left: cur.left + 'px', top: cur.top + 'px', transform: 'translateY(-14px) rotate(3deg)' }, { left: pr.left + 'px', top: pr.top + 'px', transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
      a.onfinish = fin;
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
}
