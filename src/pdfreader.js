// Lector de PDF: una o dos páginas, recorte de márgenes, modo noche, subrayados que se guardan como frases y capítulos del índice.
import { S, byId, getFile, setStatus, persistBook, addPages, addTime, saveNote, emit } from './state.js';
import { $, $$, esc, ic, toast } from './ui.js';
import { cargarPdfJs } from './pdflib.js';
import { ensureEpub } from './sync.js';
import { dockear } from './dock.js';

const COL = { amarillo: '#F2C94C', verde: '#7BC47F', azul: '#7FB2F0', rosa: '#F29AB8' };
const prefs = (() => { try { return JSON.parse(localStorage.getItem('bv-pdfprefs')) || {}; } catch { return {}; } })();
const setPref = (k, v) => { prefs[k] = v; try { localStorage.setItem('bv-pdfprefs', JSON.stringify(prefs)); } catch { } };
let cur = null;
export const cerrarPdf = () => { if (cur) cur.cerrar(); };

export async function openPdf(id) {
  cerrarPdf(); document.querySelector('.docr')?.remove();
  const b = byId(id); let file = b && await getFile(id);
  if (b && !file && b.hasFile) { try { toast('Descargando el PDF desde Google Drive…'); file = await ensureEpub(b); } catch (e) { toast(e.message || 'No se pudo descargar'); return; } }
  if (!file) { toast('Este libro no tiene archivo PDF'); return; }

  const root = document.createElement('div'); root.className = 'docr pdfr'; if (prefs.noche) root.classList.add('noche');
  root.innerHTML = `<div class="dbar"><button class="iconbtn" id="pBack" aria-label="Volver">${ic('back')}</button><div class="ti"><b>${esc(b.t)}</b><span id="pLoc">Abriendo…</span></div>
    <button class="iconbtn" id="pToc" aria-label="Índice">${ic('menu')}</button><button class="iconbtn" id="pMark" aria-label="Marcar página" aria-pressed="false">${ic('bookmark')}</button><button class="iconbtn" id="pOpt" aria-label="Ajustes">${ic('aa')}</button></div>
    <div class="darea" id="pArea"><div class="dpages" id="pPages"></div><div class="dskel" id="pSkel"><div class="skel" style="width:70%"></div><div class="skel" style="width:90%"></div><div class="skel" style="width:60%"></div></div></div>
    <div class="dpanel" id="pPanel" hidden></div>
    <div class="dfoot"><button class="iconbtn" id="pPrev" aria-label="Página anterior">${ic('left')}</button><input type="range" id="pSlide" min="1" max="1" value="1" aria-label="Página"><button class="iconbtn" id="pNext" aria-label="Página siguiente">${ic('right')}</button></div>`;
  document.body.appendChild(root); dockear(true);

  const lib = await cargarPdfJs();
  let doc; try { doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; } catch (e) { console.error(e); toast('No pude abrir este PDF'); root.remove(); dockear(false); return; }
  const n = doc.numPages; let pag = Math.min(n, Math.max(1, b.pg || 1)), zoom = prefs.zoom || 1, genId = 0, cajas = new Map();
  $('#pSlide', root).max = n;
  if (b.s !== 'leyendo' && b.s !== 'leido') await setStatus(b, 'leyendo');

  // Zona con contenido de una página (para recortar márgenes): se mide en una versión pequeña y se guarda.
  async function caja(num) {
    if (cajas.has(num)) return cajas.get(num);
    const pg = await doc.getPage(num), v0 = pg.getViewport({ scale: 1 }), k = 220 / v0.width, v = pg.getViewport({ scale: k }), c = document.createElement('canvas');
    c.width = Math.ceil(v.width); c.height = Math.ceil(v.height); const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: x, viewport: v }).promise;
    const d = x.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, x1 = 0, y0 = c.height, y1 = 0;
    for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) { const i = (yy * c.width + xx) * 4; if (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; } }
    const m = 6, r = x1 > x0 && y1 > y0 ? { x0: Math.max(0, x0 - m) / c.width, x1: Math.min(c.width, x1 + m) / c.width, y0: Math.max(0, y0 - m) / c.height, y1: Math.min(c.height, y1 + m) / c.height } : { x0: 0, x1: 1, y0: 0, y1: 1 };
    cajas.set(num, r); return r;
  }
  // Se usa la caja más amplia de las páginas cercanas para que el texto no «salte» al pasar de página.
  async function cajaUnida(num) { const rs = await Promise.all([num, Math.min(n, num + 1), Math.max(1, num - 1)].map(caja)); return { x0: Math.min(...rs.map(r => r.x0)), x1: Math.max(...rs.map(r => r.x1)), y0: Math.min(...rs.map(r => r.y0)), y1: Math.max(...rs.map(r => r.y1)) }; }

  async function dibujaUna(num, ancho) {
    const pg = await doc.getPage(num), v0 = pg.getViewport({ scale: 1 }), r = prefs.recorte ? await cajaUnida(num) : { x0: 0, x1: 1, y0: 0, y1: 1 };
    const wPdf = v0.width * (r.x1 - r.x0), k = ancho / wPdf, dpr = Math.min(2, devicePixelRatio || 1);
    const v = pg.getViewport({ scale: k * dpr, offsetX: -r.x0 * v0.width * k * dpr, offsetY: -r.y0 * v0.height * k * dpr }), vc = pg.getViewport({ scale: k, offsetX: -r.x0 * v0.width * k, offsetY: -r.y0 * v0.height * k });
    const wrap = document.createElement('div'), c = document.createElement('canvas'), tl = document.createElement('div');
    wrap.className = 'dpg'; c.width = Math.round(ancho * dpr); c.height = Math.round(v0.height * (r.y1 - r.y0) * k * dpr);
    wrap.style.width = ancho + 'px'; wrap.style.height = Math.round(v0.height * (r.y1 - r.y0) * k) + 'px'; c.style.width = '100%'; c.style.height = '100%';
    tl.className = 'textLayer'; wrap.append(c, tl);
    await pg.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
    try { await new lib.TextLayer({ textContentSource: pg.streamTextContent(), container: tl, viewport: vc }).render(); } catch { }
    wrap.dataset.pg = num; return wrap;
  }

  let dibujando = Promise.resolve();
  function dibuja() {
    const mi = ++genId; dibujando = dibujando.then(async () => {
      if (mi !== genId) return;
      const area = $('#pArea', root), aw = area.clientWidth || innerWidth || 360, dos = !!prefs.dos && aw >= 820 && pag < n, disp = aw - 24;
      const ancho = Math.max(200, Math.round((dos ? (disp - 12) / 2 : disp) * zoom));
      const cont = document.createDocumentFragment(); const nums = dos ? [pag, pag + 1] : [pag];
      for (const x of nums) cont.append(await dibujaUna(x, ancho));
      if (mi !== genId) return;
      const pp = $('#pPages', root); pp.replaceChildren(cont); area.scrollTop = 0; $('#pSkel', root)?.remove();
      $('#pLoc', root).textContent = `Página ${pag}${dos ? '–' + (pag + 1) : ''} de ${n} · ${Math.round(pag / n * 100)} %`; $('#pSlide', root).value = pag; pintaMark();
    }).catch(e => console.warn('pdf', e));
  }

  /* progreso y tiempo */
  let guarda = 0, finished = b.s === 'leido', acc = 0, flushed = 0;
  async function avanza() {
    const pr = pag / n, leidas = Math.round(pr * b.p), d = leidas - (b.r || 0);
    if (d > 0 && d <= 30) await addPages(b.id, d); if (d > 0) b.r = leidas;
    b.progress = pr; b.pg = pag; clearTimeout(guarda); guarda = setTimeout(() => persistBook(b), 600);
    if (pr >= .985 && !finished) { finished = true; await setStatus(b, 'leido'); toast('¡Terminaste el libro! Quedó en «Leídos».'); }
  }
  const ir = num => { pag = Math.min(n, Math.max(1, num)); dibuja(); avanza(); };
  const paso = () => (prefs.dos && $('#pArea', root).clientWidth >= 820 ? 2 : 1);
  $('#pNext', root).onclick = () => ir(pag + paso()); $('#pPrev', root).onclick = () => ir(pag - paso());
  $('#pSlide', root).oninput = e => ir(+e.target.value);
  const tecla = e => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return; if (e.key === 'ArrowRight' || e.key === 'PageDown') ir(pag + paso()); else if (e.key === 'ArrowLeft' || e.key === 'PageUp') ir(pag - paso()); else if (e.key === 'Escape') cerrar(); else if (e.key === 'b') $('#pMark', root).click(); };
  document.addEventListener('keyup', tecla);
  let tx = 0, ty = 0, tt = 0;
  const area = $('#pArea', root);
  area.addEventListener('touchstart', e => { tx = e.changedTouches[0].screenX; ty = e.changedTouches[0].screenY; tt = Date.now(); }, { passive: true });
  area.addEventListener('touchend', e => { const dx = e.changedTouches[0].screenX - tx, dy = e.changedTouches[0].screenY - ty; if (zoom <= 1.05 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) ir(pag + (dx < 0 ? paso() : -paso())); }, { passive: true });

  /* marcadores */
  const marks = () => (b.marks = b.marks || []);
  const pintaMark = () => $('#pMark', root).setAttribute('aria-pressed', String(marks().some(m => m.pg === pag)));
  $('#pMark', root).onclick = async () => { if (marks().some(m => m.pg === pag)) { b.marks = marks().filter(m => m.pg !== pag); toast('Marcador quitado'); } else { marks().push({ pg: pag, pct: Math.round(pag / n * 100), t: Date.now() }); toast('Página marcada'); } await persistBook(b); pintaMark(); };

  /* panel: índice y marcadores */
  const panel = $('#pPanel', root), cierraPanel = () => { panel.hidden = true; panel.innerHTML = ''; };
  $('#pToc', root).onclick = async () => {
    if (!panel.hidden) return cierraPanel();
    panel.hidden = false; panel.innerHTML = '<h3>Índice</h3><div class="small">Cargando…</div>';
    let items = []; try { const ol = await doc.getOutline(); const walk = (a, d) => (a || []).forEach(t => { items.push({ t: t.title, d, dest: t.dest }); walk(t.items, d + 1); }); walk(ol, 0); } catch { }
    const mk = marks().slice().sort((x, y) => x.pg - y.pg);
    panel.innerHTML = `<h3>Marcadores</h3>${mk.length ? mk.map(m => `<a data-pg="${m.pg}">Página ${m.pg}</a>`).join('') : '<div class="small">Aún no hay marcadores.</div>'}<h3 style="margin-top:14px">Índice</h3>${items.length ? items.map((t, i) => `<a data-i="${i}" style="padding-left:${t.d * 16}px">${esc(t.t)}</a>`).join('') : '<div class="small">Este PDF no trae índice.</div>'}`;
    $$('[data-pg]', panel).forEach(a => a.onclick = () => { ir(+a.dataset.pg); cierraPanel(); });
    $$('[data-i]', panel).forEach(a => a.onclick = async () => { try { let d = items[+a.dataset.i].dest; if (typeof d === 'string') d = await doc.getDestination(d); const idx = await doc.getPageIndex(d[0]); ir(idx + 1); cierraPanel(); } catch { toast('No pude ir a ese capítulo'); } });
  };
  $('#pOpt', root).onclick = () => {
    if (!panel.hidden && panel.dataset.k === 'opt') return cierraPanel(); panel.dataset.k = 'opt'; panel.hidden = false;
    panel.innerHTML = `<h3>Ajustes</h3><div class="opts"><label class="chk"><input type="checkbox" id="o-rec" ${prefs.recorte ? 'checked' : ''}> Recortar márgenes</label><label class="chk"><input type="checkbox" id="o-dos" ${prefs.dos ? 'checked' : ''}> Dos páginas (pantalla ancha)</label><label class="chk"><input type="checkbox" id="o-noc" ${prefs.noche ? 'checked' : ''}> Modo noche</label><label>Zoom <span class="small" id="o-zv">${Math.round(zoom * 100)} %</span><input type="range" id="o-z" min="80" max="300" value="${Math.round(zoom * 100)}"></label></div>`;
    $('#o-rec', panel).onchange = e => { setPref('recorte', e.target.checked); dibuja(); };
    $('#o-dos', panel).onchange = e => { setPref('dos', e.target.checked); dibuja(); };
    $('#o-noc', panel).onchange = e => { setPref('noche', e.target.checked); root.classList.toggle('noche', e.target.checked); };
    $('#o-z', panel).onchange = e => { zoom = +e.target.value / 100; setPref('zoom', zoom); $('#o-zv', panel).textContent = Math.round(zoom * 100) + ' %'; dibuja(); };
  };

  /* subrayar lo seleccionado */
  let barra = null;
  const quitaBarra = () => { barra?.remove(); barra = null; };
  const sel = () => { const s = getSelection(); return s && !s.isCollapsed && root.contains(s.anchorNode) ? s : null; };
  const muestraBarra = () => {
    const s = sel(); if (!s) return quitaBarra();
    const txt = s.toString().replace(/\s+/g, ' ').trim(); if (txt.length < 3) return quitaBarra();
    quitaBarra(); barra = document.createElement('div'); barra.className = 'savebar';
    barra.innerHTML = `<span>Subrayar</span>${Object.keys(COL).map(c => `<button class="hdotb" data-c="${c}" style="background:${COL[c]}" aria-label="Subrayar en ${c}"></button>`).join('')}<button class="defbtn" data-def>Definir</button>`;
    root.appendChild(barra);
    barra.onclick = async e => {
      if (e.target.closest('[data-def]')) { import('./glosario.js').then(m => m.definir(txt.split(/\s+/)[0], txt, b)); quitaBarra(); return; }
      const c = e.target.closest('[data-c]'); if (!c) return;
      await saveNote({ bookId: b.id, title: `${b.t} · ${b.a} · pág. ${pag}`, text: txt.slice(0, 600), cfi: null, pdfPag: pag, color: c.dataset.c, createdAt: Date.now() });
      toast('Subrayado guardado en tus frases'); getSelection().removeAllRanges(); quitaBarra();
    };
  };
  let selT = 0; document.addEventListener('selectionchange', () => { clearTimeout(selT); selT = setTimeout(muestraBarra, 350); });

  const timeT = setInterval(() => { if (document.visibilityState === 'visible' && document.hasFocus()) { acc += 5; if (acc - flushed >= 20) { addTime(b.id, acc - flushed); flushed = acc; } } }, 5000);
  function cerrar() {
    clearInterval(timeT); if (acc > flushed) addTime(b.id, acc - flushed); clearTimeout(guarda); persistBook(b);
    document.removeEventListener('keyup', tecla); quitaBarra(); try { doc.destroy(); } catch { }
    root.remove(); dockear(false); cur = null; emit();
  }
  $('#pBack', root).onclick = cerrar; cur = { cerrar };
  dibuja();
}
