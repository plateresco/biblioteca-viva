// Escena 3D de la biblioteca: sacar el libro del estante, mostrar su portada, darle la vuelta y volver a guardarlo.
import { ST, byId, coverUrl, spineGeom } from './state.js';
import { $, esc, ic, reduce } from './ui.js';
import { spineInner, spineStyle, spineStyleClass } from './spine.js';

const D = 104;                                         // fondo del libro (ancho de la portada)
const T = (dx, dy, z, deg) => `translate3d(${dx}px,${dy}px,${z}px) rotateY(${deg}deg)`;
let sc = null;                                         // estado de la escena abierta

export const sceneOpen = () => !!sc;

export function openScene(id, spineEl, ctx) {
  const b = byId(id);
  if (!b || sc) return;
  const g = spineGeom(b), app = $('#app').getBoundingClientRect(), W = app.width, H = innerHeight;
  // posición de reposo del lomo (sin el levantado del cursor)
  const prevT = spineEl.style.transition, prevTf = spineEl.style.transform;
  spineEl.style.transition = 'none'; spineEl.style.transform = 'none';
  const r = spineEl.getBoundingClientRect();
  spineEl.style.transform = prevTf; spineEl.style.transition = prevT;

  const root = document.createElement('div');
  root.id = 'scene';
  Object.assign(root.style, { left: app.left + 'px', top: '0px', width: W + 'px', height: H + 'px' });
  const u = coverUrl(b), syn = b.syn || 'Este libro aún no tiene sinopsis. Puedes escribirla desde «Ficha».';
  const rcx = r.left + r.width / 2 - app.left, rcy = r.top + r.height / 2;
  root.innerHTML = `<div class="glow3"></div><div class="cast"></div>
    <div class="bk" style="left:${r.left - app.left}px;top:${r.top}px;--w:${g.w}px;--h:${g.h}px;--d:${D}px;--c1:${b.c1 || '#555'}" aria-hidden="true">
      <div class="face f-sp"><div class="spine ${spineStyleClass(b)}" style="${spineStyle(b)}">${spineInner(b)}</div></div>
      <div class="face f-cv">${u ? `<img src="${u}" alt="">` : `<span class="ca">${esc(b.f)}</span><span class="cl">${esc(b.t)}</span><span class="ca">${esc(b.a)}</span>`}</div>
      <div class="face f-lf"><span class="ca">Sinopsis</span><p class="syn">${esc(syn)}</p><span class="ca">${b.p} páginas</span></div>
      <div class="face f-bk"></div></div>
    <div class="info"></div>`;
  document.body.appendChild(root);
  spineEl.style.visibility = 'hidden';
  const el = $('.bk', root), info = $('.info', root), cast = $('.cast', root);

  // Vecinos de la misma fila: se abren para dejar salir el libro
  const row = spineEl.parentElement;
  const sibs = [...row.querySelectorAll('.spine')], mine = sibs.indexOf(spineEl);
  sibs.forEach((s, j) => { if (j < mine) s.style.setProperty('--sx', '-18px'); else if (j > mine) s.style.setProperty('--sx', '18px'); });

  // La perspectiva ensancha lo que se acerca y lo corre del punto de fuga: se compensa para que la portada caiga donde queremos.
  const narrow = W < 620, P = 1000, ox = W * .5, oy = H * .38, z0 = -D / 2, zf = z0 + 190, k = P / (P - (zf + g.w / 2));
  const targetX = narrow ? Math.max(92, Math.min(W * .3, 120)) : 128;
  const targetCy = narrow ? H * .58 : H * .5;
  const dx = ox + (targetX - ox) / k - rcx, dy = oy + (targetCy - oy) / k - rcy;
  sc = { id, el, root, spineEl, row, sibs, pose: { dx, dy, zf, z0 }, flipped: false, busy: true, closing: false, ctx, b };
  root.style.setProperty('--gx', (targetX / W * 100) + '%');
  cast.style.left = (targetX - 70) + 'px'; cast.style.top = (targetCy + (g.h * k) / 2 - 8) + 'px';
  Object.assign(info.style, narrow
    ? { left: '22px', right: '22px', top: `calc(env(safe-area-inset-top, 0px) + 28px)` }
    : { left: (targetX + (D * k) / 2 + 44) + 'px', right: '24px', top: (H * .5 - 100) + 'px' });
  const st = ST[b.s], pct = Math.round((b.r || 0) / b.p * 100);
  info.innerHTML = `<h3>${esc(b.t)}</h3><div class="au">${esc(b.a)}</div>
    <div class="st" style="--c:${st.c}"><i></i>${st.n} · ${esc(b.f)}</div>
    <div><div class="pb"><i style="width:${pct}%"></i></div><div class="pg">${b.r || 0} de ${b.p} páginas</div></div>
    <div class="row">${b.hasFile ? `<button class="bt" data-a="read">${ic('book')}${b.progress > 0 && b.s !== 'leido' ? 'Continuar' : 'Abrir en el lector'}</button>` : `<button class="bt" data-a="sheet">Ficha y avance</button>`}
      <button class="bt g" data-a="flip">Ver contraportada</button>${b.hasFile ? '<button class="bt g" data-a="sheet">Ficha</button>' : ''}<button class="bt g" data-a="close">Cerrar</button></div>`;
  info.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'close') closeScene();
    else if (a === 'flip') flip();
    else if (a === 'read') { closeScene(true); ctx.openReader(id); }
    else if (a === 'sheet') { closeScene(true); ctx.openSheet(id); }
  });
  root.addEventListener('click', e => {
    if (e.target.closest('.info')) return;
    if (e.target.closest('.bk')) { flip(); return; }
    closeScene();
  });

  requestAnimationFrame(() => root.classList.add('on'));
  if (reduce) { el.style.transform = T(dx, dy, zf, -90); sc.busy = false; return; }
  const a = el.animate([
    { transform: T(0, 0, z0, 0), offset: 0 },
    { transform: T(0, -26, z0 + 30, 0), offset: .28, easing: 'cubic-bezier(.3,.7,.2,1)' },
    { transform: T(dx * .35, dy * .7, z0 + 110, -20), offset: .55 },
    { transform: T(dx, dy, zf, -90), offset: 1 },
  ], { duration: 1150, fill: 'forwards', easing: 'cubic-bezier(.45,.05,.2,1)' });
  a.onfinish = () => { if (sc) sc.busy = false; };
  setTimeout(() => { if (sc) sc.busy = false; }, 1300);
}

// Dar vuelta: la portada pasa a la contraportada, que muestra la sinopsis.
function flip() {
  if (!sc || sc.busy || sc.closing) return;
  const { el, pose: p } = sc, from = sc.flipped ? -270 : -90, to = sc.flipped ? -90 : -270;
  sc.busy = true; sc.flipped = !sc.flipped;
  const btn = $('[data-a="flip"]', sc.root); if (btn) btn.textContent = sc.flipped ? 'Ver portada' : 'Ver contraportada';
  if (reduce) { el.style.transform = T(p.dx, p.dy, p.zf, to); sc.busy = false; return; }
  const a = el.animate([{ transform: T(p.dx, p.dy, p.zf, from) }, { transform: T(p.dx, p.dy, p.zf + 36, (from + to) / 2), offset: .5 }, { transform: T(p.dx, p.dy, p.zf, to) }],
    { duration: 800, fill: 'forwards', easing: 'cubic-bezier(.45,.05,.2,1)' });
  const s = sc; a.onfinish = () => { s.busy = false; };
  setTimeout(() => { s.busy = false; }, 950);
}

// Guardar: gira de vuelta hacia su hueco, se desliza hacia adentro y se asienta; los vecinos se cierran recién cuando ya está dentro.
// Se puede guardar en cualquier momento, incluso a mitad de otra animación.
export function closeScene(instant = false) {
  if (!sc || sc.closing) return;
  const s = sc; s.closing = true;
  const { el, pose: p, root, spineEl, sibs } = s;
  const deg0 = s.flipped ? -270 : -90, end = s.flipped ? -360 : 0, rot = f => deg0 + (end - deg0) * f;
  const from = getComputedStyle(el).transform;
  el.getAnimations().forEach(x => x.cancel());
  root.classList.remove('on');
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    el.getAnimations().forEach(x => x.cancel());
    spineEl.style.visibility = ''; root.remove(); sc = null;
  };
  const closeSibs = () => sibs.forEach(x => x.style.setProperty('--sx', '0px'));
  if (reduce || instant) { closeSibs(); finish(); return; }
  setTimeout(closeSibs, 820);
  setTimeout(finish, 1300);
  const a = el.animate([
    { transform: from, offset: 0, easing: 'cubic-bezier(.3,.6,.3,1)' },
    { transform: T(p.dx * .4, p.dy * .5, p.z0 + 95, rot(.7)), offset: .36, easing: 'cubic-bezier(.4,0,.2,1)' },
    { transform: T(0, -24, p.z0 + 36, end), offset: .66, easing: 'cubic-bezier(.5,0,.3,1)' },
    { transform: T(0, -7, p.z0 + 4, end), offset: .86, easing: 'ease-out' },
    { transform: T(0, -2.5, p.z0, end), offset: .93, easing: 'ease-in' },
    { transform: T(0, 0, p.z0, end), offset: 1 },
  ], { duration: 1050, fill: 'forwards', easing: 'linear' });
  a.onfinish = finish;
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeScene(); });
