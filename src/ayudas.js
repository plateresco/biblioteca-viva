// Ayudas de concentración dentro del lector: regla de línea, párrafo activo y ráfaga de palabras.
import { $, $$, esc } from './ui.js';

const BLOQUES = 'p, li, blockquote, dd';

export function instalarAyudas({ root, rendition, ePub, b, guardar, tam }) {
  let modo = b.ayuda || '';
  const wrap = $('.vwrap', root);

  /* ---------- regla de línea: dos sombras y una franja que se mueve con el asa ---------- */
  const regla = document.createElement('div');
  regla.className = 'regla'; regla.hidden = true;
  regla.innerHTML = '<div class="rdim rtop"></div><div class="rdim rbot"></div><button class="rhandle" aria-label="Mover la regla de lectura">⇕</button>';
  wrap.appendChild(regla);
  let y = null;
  const altoFranja = () => Math.round(16 * (tam() / 100) * 1.6 * 1.7);
  const pinta = () => {
    const H = wrap.clientHeight, h = altoFranja(); if (y === null) y = Math.round(H * .4);
    y = Math.max(0, Math.min(H - h, y));
    $('.rtop', regla).style.height = y + 'px'; $('.rbot', regla).style.top = (y + h) + 'px';
    $('.rhandle', regla).style.top = (y + h / 2 - 22) + 'px';
  };
  const asa = $('.rhandle', regla); let dy = null;
  asa.addEventListener('pointerdown', e => { dy = e.clientY - y; asa.setPointerCapture(e.pointerId); });
  asa.addEventListener('pointermove', e => { if (dy === null) return; y = e.clientY - dy - wrap.getBoundingClientRect().top; pinta(); });
  ['pointerup', 'pointercancel'].forEach(t => asa.addEventListener(t, () => { dy = null; }));
  asa.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { y += 20; pinta(); e.preventDefault(); } else if (e.key === 'ArrowUp') { y -= 20; pinta(); e.preventDefault(); } });
  addEventListener('resize', () => { if (!regla.hidden) pinta(); });

  /* ---------- párrafo activo: solo uno queda nítido ---------- */
  const nav = document.createElement('div');
  nav.className = 'pnav'; nav.hidden = true;
  nav.innerHTML = '<button id="pUp" aria-label="Párrafo anterior">▲</button><button id="pDn" aria-label="Párrafo siguiente">▼</button>';
  wrap.appendChild(nav);
  const bloques = d => [...d.querySelectorAll(BLOQUES)].filter(x => x.textContent.trim().length > 1);
  const activo = d => d.querySelector('.bvact');
  const marca = (d, el) => { d.querySelectorAll('.bvact').forEach(x => x.classList.remove('bvact')); if (el) el.classList.add('bvact'); };
  const visible = (c, el) => { const r = el.getBoundingClientRect(), W = c.window.innerWidth, H = c.window.innerHeight; return r.right > 0 && r.left < W && r.bottom > 0 && r.top < H; };
  const primeroVisible = c => { const d = c.document; marca(d, bloques(d).find(el => visible(c, el)) || null); };
  async function mover(dir) {
    const c = rendition.getContents()[0]; if (!c) return; const d = c.document, l = bloques(d), a = activo(d), i = a ? l.indexOf(a) : -1, sig = l[i + dir];
    if (!sig) { await (dir > 0 ? rendition.next() : rendition.prev()); return; }
    marca(d, sig);
    if (!visible(c, sig)) { await (dir > 0 ? rendition.next() : rendition.prev()); }
  }
  $('#pUp', nav).onclick = () => mover(-1); $('#pDn', nav).onclick = () => mover(1);

  rendition.hooks.content.register(c => {
    try {
      const d = c.document, st = d.createElement('style');
      st.textContent = 'body.bvp p,body.bvp li,body.bvp blockquote,body.bvp dd{opacity:.22;transition:opacity .2s}body.bvp .bvact{opacity:1!important}';
      d.head.appendChild(st); d.body.classList.toggle('bvp', modo === 'parrafo');
      d.addEventListener('click', e => { if (modo !== 'parrafo') return; const el = e.target.closest && e.target.closest(BLOQUES); if (el) marca(d, el); });
    } catch { }
  });
  rendition.on('relocated', () => { if (modo !== 'parrafo') return; setTimeout(() => { const c = rendition.getContents()[0]; if (c && !(activo(c.document) && visible(c, activo(c.document)))) primeroVisible(c); }, 120); });

  function poner(m) {
    modo = m || ''; b.ayuda = modo; guardar();
    regla.hidden = modo !== 'linea'; nav.hidden = modo !== 'parrafo';
    if (modo === 'linea') pinta();
    rendition.getContents().forEach(c => { try { c.document.body.classList.toggle('bvp', modo === 'parrafo'); if (modo === 'parrafo') primeroVisible(c); else marca(c.document, null); } catch { } });
  }
  if (modo) setTimeout(() => poner(modo), 600);

  /* ---------- ráfaga de palabras (RSVP) ---------- */
  function rafaga(ppm0, guardaPpm) {
    const c = rendition.getContents()[0], loc = rendition.currentLocation(); if (!c || !loc?.start) return false;
    let words = [];
    try {
      const d = c.document, s0 = new ePub.CFI(loc.start.cfi).toRange(d), r = d.createRange(); r.setStart(s0.startContainer, s0.startOffset); r.setEnd(d.body, d.body.childNodes.length);
      words = r.toString().split(/\s+/).filter(Boolean);
    } catch { }
    if (words.length < 5) return false;
    const o = document.createElement('div'); o.className = 'rsvpw';
    o.innerHTML = `<button class="rsx" aria-label="Cerrar la ráfaga">✕</button><div class="rsw" id="rsw" aria-live="off"></div><div class="rsp"><i id="rsb"></i></div>
      <div class="rsc"><button id="rsb10" aria-label="Retroceder 20 palabras">⏪</button><button id="rspl" class="rsmain" aria-label="Pausar">❚❚</button><label class="small">Velocidad <b id="rsv"></b><input id="rss" type="range" min="150" max="700" step="50"></label></div>`;
    root.appendChild(o);
    let i = 0, play = true, tm = null, ppm = ppm0;
    $('#rss', o).value = ppm; $('#rsv', o).textContent = ppm + ' ppm';
    const mostrar = () => {
      const w = words[i], limpio = w.replace(/[^\p{L}\p{N}]/gu, ''), k = Math.max(0, Math.ceil(limpio.length * .35) - 1);
      const ini = w.search(/[\p{L}\p{N}]/u); const p = ini < 0 ? 0 : ini + k;
      $('#rsw', o).innerHTML = `<span class="rl">${esc(w.slice(0, p))}</span><span class="rc">${esc(w.slice(p, p + 1))}</span><span class="rr">${esc(w.slice(p + 1))}</span>`;
      $('#rsb', o).style.width = (i / words.length * 100) + '%';
    };
    const paso = () => {
      clearTimeout(tm); if (!play) return; mostrar();
      const w = words[i], base = 60000 / ppm, extra = /[.!?…]$/.test(w) ? 1.9 : /[,;:]$/.test(w) ? 1.35 : w.length > 9 ? 1.25 : 1;
      i++; if (i >= words.length) { play = false; $('#rspl', o).textContent = '▶'; return; }
      tm = setTimeout(paso, base * extra);
    };
    const cierra = () => { clearTimeout(tm); play = false; o.remove(); };
    $('.rsx', o).onclick = cierra;
    $('#rspl', o).onclick = () => { play = !play; $('#rspl', o).textContent = play ? '❚❚' : '▶'; if (play) { if (i >= words.length) i = 0; paso(); } else clearTimeout(tm); };
    $('#rsb10', o).onclick = () => { i = Math.max(0, i - 20); if (!play) mostrar(); };
    $('#rss', o).oninput = e => { ppm = +e.target.value; $('#rsv', o).textContent = ppm + ' ppm'; guardaPpm(ppm); };
    paso(); return true;
  }

  return {
    modo: () => modo, poner, rafaga,
    html: () => `<label>Ayuda de concentración<select id="ayu"><option value="" ${!modo ? 'selected' : ''}>Ninguna</option><option value="linea" ${modo === 'linea' ? 'selected' : ''}>Regla de línea (sombrea lo demás)</option><option value="parrafo" ${modo === 'parrafo' ? 'selected' : ''}>Párrafo activo (solo uno nítido)</option></select></label>
      <div class="row"><button class="btn ghost" id="raf" style="color:inherit">Ráfaga de palabras desde aquí</button></div>`,
  };
}
