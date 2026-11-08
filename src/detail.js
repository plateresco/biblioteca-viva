// Panel de ficha del libro seleccionado (se ve en pantallas anchas, a la derecha de la estantería).
import { S, ST, byId, coverUrl } from './state.js';
import { $, esc, ic } from './ui.js';
import { openScene } from './scene.js';
import { openCover, openEdit } from './sheets.js';

export const starsHTML = n => `<span class="stars" aria-label="${n} de 5">${[1, 2, 3, 4, 5].map(i => `<svg viewBox="0 0 24 24" class="${i <= n ? 'on' : ''}">${'<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/>'}</svg>`).join('')}</span>`;

export function drawDetail(ctx) {
  const d = $('#detail'); if (!d) return;
  const b = byId(S.ui.sel);
  if (!b) { d.innerHTML = `<div class="dpempty">Elige un libro de la estantería para ver aquí su ficha.</div>`; return; }
  const cu = coverUrl(b), pct = Math.round((b.r || 0) / b.p * 100), st = ST[b.s];
  const cols = (b.cols || []).map(id => S.meta.cols.find(c => c.id === id)?.n).filter(Boolean);
  d.innerHTML = `<div class="dp"><div class="dc"><div class="dcov" style="--c1:${b.c1 || '#555'};${cu ? `--art:url('${cu}')` : ''}">${cu ? '' : `<span>${esc(b.t)}</span>`}</div>
    <div><h3>${esc(b.t)}</h3><div class="au">${esc(b.a)}</div><span class="spill" style="--c:${st.c}"><i></i>${st.n} · ${b.p} págs.</span>${b.rating ? `<div style="margin-top:8px">${starsHTML(b.rating)}</div>` : ''}</div></div>
    <div class="pbar" style="margin-top:14px"><i style="width:${pct}%"></i></div><div class="small" style="margin-top:4px;color:var(--r-muted)">${b.r || 0} de ${b.p} páginas</div>
    ${b.syn ? `<p>${esc(b.syn)}</p>` : ''}
    ${cols.length || b.loan || b.series ? `<div class="small" style="color:var(--r-muted);margin-bottom:10px">${[b.series ? `Serie: ${esc(b.series)}` : '', cols.length ? `Colecciones: ${cols.map(esc).join(', ')}` : '', b.loan ? `Prestado a ${esc(b.loan.to)}` : ''].filter(Boolean).join(' · ')}</div>` : ''}
    <div class="btns">${b.hasFile ? `<button class="go" data-a="read">${b.progress > 0 && b.s !== 'leido' ? 'Continuar' : 'Abrir en el lector'}</button>` : `<button class="go" data-a="sheet">Registrar avance</button>`}
      <button class="go g" data-a="scene">Sacar del estante</button><button class="go g" data-a="sheet2">Ficha y reseña</button></div>
    <div class="kd"><kbd>Enter</kbd> abrir · <kbd>E</kbd> editar · doble clic en el lomo para sacarlo</div></div>`;
  d.onclick = e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'read') ctx.openReader(b.id);
    else if (a === 'scene') { const el = $(`#v-lib .spine[data-id="${b.id}"]`); if (el) openScene(b.id, el, ctx); else openCover(b.id, { openReader: ctx.openReader }); }
    else openCover(b.id, { openReader: ctx.openReader });
  };
}
