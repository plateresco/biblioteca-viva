import ePub from 'epubjs';
import { S, byId, getFile, setStatus, persistBook, addPages, addTime, saveNote, removeNote, emit } from './state.js';
import { $, $$, esc, ic, toast } from './ui.js';
import { ensureEpub } from './sync.js';

const TH = { paper: ['#F1ECE0', '#26221B'], sepia: ['#E6D8B8', '#3B2E17'], night: ['#12181B', '#D7DBD6'], warm: ['#1D1610', '#E9D3B0'] };
const FONTS = { libro: ['Original del libro', null], serif: ['Serif (Georgia)', "Georgia,'Times New Roman',serif"], sans: ['Sans', "system-ui,'Segoe UI',Roboto,sans-serif"], mono: ['Monoespaciada', "ui-monospace,Consolas,monospace"], legible: ['Fácil de leer', 'Verdana,Tahoma,sans-serif'] };
const RATES = [0.8, 1, 1.2, 1.5, 1.8], SLEEPS = [['Apagado', 0], ['15 min', 15], ['30 min', 30], ['60 min', 60], ['Fin del capítulo', -1]];
const prefs = (() => { try { return JSON.parse(localStorage.getItem('bv-rprefs')) || {}; } catch { return {}; } })();
const setPref = (k, v) => { prefs[k] = v; try { localStorage.setItem('bv-rprefs', JSON.stringify(prefs)); } catch { } };

let cur = null;
export function closeReader() { if (cur) cur.close(); }

export async function openReader(id, cfiTarget) {
  closeReader();
  const b = byId(id);
  let file = b && await getFile(id);
  if (b && !file && b.hasFile) { // libro agregado desde otro dispositivo: se baja de Drive la primera vez
    try { toast('Descargando el libro desde Google Drive…'); file = await ensureEpub(b); } catch (e) { toast(e.message || 'No se pudo descargar el libro'); return; }
  }
  if (!file) { toast('Este libro no tiene archivo EPUB'); return; }

  const root = document.createElement('div');
  root.id = 'reader'; root.dataset.theme = prefs.theme || 'paper';
  root.innerHTML = `
    <div class="rbar">
      <button class="iconbtn" id="rBack" aria-label="Volver a la biblioteca">${ic('back')}</button>
      <div class="ti"><b>${esc(b.t)}</b><span id="rLoc">Abriendo…</span></div>
      <button class="iconbtn" id="rToc" aria-label="Capítulos">${ic('menu')}</button>
      <button class="iconbtn" id="rSearch" aria-label="Buscar en el libro">${ic('search')}</button>
      <button class="iconbtn" id="rNotes" aria-label="Subrayados">${ic('quote')}</button>
      <button class="iconbtn" id="rOpt" aria-label="Letra y voz">${ic('aa')}</button>
    </div>
    <div class="vwrap"><div id="viewer"></div><div class="fband" id="fband" hidden></div><div class="brstrip" id="brstrip" aria-hidden="true"></div><div class="brtip" id="brtip" hidden></div><div id="panel" class="panel" hidden></div></div>
    <div class="veil" id="veil"></div>
    <div class="listen" id="listen" hidden><div class="lrow1"><button class="iconbtn" id="lPrev" aria-label="Frase anterior">${ic('left')}</button><button class="play" id="lPlay" aria-label="Pausar">${ic('pause')}</button><button class="iconbtn" id="lNext" aria-label="Frase siguiente">${ic('right')}</button>
      <div style="flex:1;min-width:0"><b style="font-size:14px">Leyendo en voz alta</b><div class="small" id="lInfo">&nbsp;</div></div>
      <button class="iconbtn" id="lStop" aria-label="Detener">${ic('x')}</button></div>
      <div class="lrow2"><button class="lchip" id="lRate">Velocidad <b>1x</b></button><button class="lchip" id="lSleep">Dormir <b>Apagado</b></button></div></div>
    <div class="rfoot"><div class="nav">
      <button class="iconbtn" id="rPrev" aria-label="Página anterior">${ic('left')}</button>
      <input type="range" id="rSlide" min="0" max="1000" value="0" aria-label="Posición en el libro" disabled>
      <button class="iconbtn" id="rNext" aria-label="Página siguiente">${ic('right')}</button>
      <button class="iconbtn" id="rListen" aria-label="Escuchar en voz alta">${ic('phones')}</button></div>
      <div class="small" id="rPage"></div></div>`;
  document.body.appendChild(root);

  const book = ePub(await file.arrayBuffer());
  await book.ready;
  const rendition = book.renderTo($('#viewer', root), { width: '100%', height: '100%', flow: 'paginated', spread: 'auto', minSpreadWidth: 900, allowScriptedContent: false });
  // Estilos del texto: se vuelven a registrar cada vez que cambia algo (fuente, interlineado, márgenes, justificado).
  function registrarTemas() {
    const lh = (prefs.lh || 16) / 10, fam = FONTS[prefs.font || 'libro']?.[1];
    for (const [k, [bg, fg]] of Object.entries(TH)) {
      rendition.themes.register(k, {
        body: { background: `${bg} !important`, color: `${fg} !important`, 'line-height': `${lh} !important`, ...(prefs.font === 'legible' ? { 'letter-spacing': '0.03em !important', 'word-spacing': '0.12em !important' } : {}) },
        '*': { color: `${fg} !important`, 'background-color': 'transparent !important', ...(fam ? { 'font-family': `${fam} !important` } : {}) },
        ...(prefs.just ? { 'p, li': { 'text-align': 'justify !important', hyphens: 'auto' } } : {}),
        'a, a *': { color: 'inherit !important', 'text-decoration': 'underline' },
        img: { 'max-width': '100% !important', 'background-color': 'transparent !important' },
      });
    }
  }
  registrarTemas();
  const applyTheme = t => { root.dataset.theme = t; rendition.themes.select(t); setPref('theme', t); };
  // Los márgenes se aplican al visor entero (así funcionan también con dos páginas) y se vuelve a paginar.
  const aplicarMargen = () => { const m = prefs.mar ?? 8; const v = $('#viewer', root); v.style.left = v.style.right = m + 'px'; try { rendition.resize(); } catch { } };
  const reestilo = () => { registrarTemas(); rendition.themes.select(root.dataset.theme); };
  // «Noche cálida» automática: de noche, el lector pasa solo al fondo cálido (si no elegiste otro a mano esta vez).
  const horaNoche = () => { const h = new Date().getHours(); return h >= 22 || h < 6; };
  if (prefs.autoNoche && horaNoche() && root.dataset.theme !== 'night') root.dataset.theme = 'warm';
  let fsz = prefs.fsz || 110;
  const applySize = () => rendition.themes.fontSize(fsz + '%');
  applyTheme(root.dataset.theme); applySize();

  /* ----- estado de lectura ----- */
  if (b.s !== 'leyendo' && b.s !== 'leido') { const prev = b.s; await setStatus(b, 'leyendo'); if (prev === 'porleer') toast('Empezaste este libro: quedó en “Leyendo”'); }
  let ready = false, finishedAsked = b.s === 'leido', saveT;
  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => persistBook(b), 600); };

  async function onProgress(loc) {
    b.cfi = loc.start.cfi;
    const hasLocs = book.locations.length() > 0;
    const pr = hasLocs ? book.locations.percentageFromCfi(loc.start.cfi) : (loc.start.index / Math.max(1, book.spine.length));
    const read = Math.round(pr * b.p), delta = read - (b.r || 0);
    if (hasLocs && delta > 0) { if (delta <= 30) await addPages(b.id, delta); b.r = read; b.progress = pr; }
    $('#rLoc', root).textContent = hasLocs ? `Página ~${Math.max(1, read)} de ~${b.p}  ·  ${Math.round(pr * 100)} %` : 'Calculando páginas…';
    const d = loc.start.displayed, falta = d ? Math.max(0, d.total - d.page) : 0;
    $('#rPage', root).textContent = d ? `Capítulo: página ${d.page} de ${d.total}${falta ? ` · unos ${Math.max(1, Math.ceil(falta * 1.1))} min para terminar el capítulo` : ' · última página del capítulo'}` : '';
    if (hasLocs) $('#rSlide', root).value = Math.round(pr * 1000);
    if (hasLocs && pr >= 0.985 && !finishedAsked) { finishedAsked = true; await setStatus(b, 'leido'); toast('¡Terminaste el libro! Quedó en “Leídos”.'); }
    persist();
  }
  rendition.on('relocated', onProgress);

  if (prefs.mar != null) aplicarMargen();
  await rendition.display(cfiTarget || b.cfi || undefined);

  // Posiciones del libro (para el porcentaje y las páginas). Se calculan una vez y se guardan.
  (async () => {
    try {
      if (b.locs) book.locations.load(b.locs);
      else { await book.ready; await book.locations.generate(1100); b.locs = book.locations.save(); await persistBook(b); }
      ready = true; $('#rSlide', root).disabled = false;
      const loc = rendition.currentLocation(); if (loc && loc.start) onProgress(loc);
    } catch (e) { console.warn('locations', e); }
  })();
  if (b.locs) { ready = true; $('#rSlide', root).disabled = false; }

  /* ----- navegación ----- */
  let ocupado = false;
  const animar = () => prefs.anim !== false && !matchMedia('(prefers-reduced-motion:reduce)').matches;
  const go = async dir => {
    if (ocupado) return; ocupado = true; stopTTS(); hideSave();
    const v = $('#viewer', root), a = animar();
    try {
      if (a) await v.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: .05, transform: `translateX(${-dir * 26}px)` }], { duration: 90, fill: 'forwards' }).finished;
      await (dir > 0 ? rendition.next() : rendition.prev());
      if (a) { const i = v.animate([{ opacity: .05, transform: `translateX(${dir * 26}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 130, easing: 'ease-out' }); v.getAnimations().forEach(x => { if (x !== i) x.cancel(); }); await i.finished; }
    } catch { }
    v.getAnimations().forEach(x => x.cancel()); ocupado = false;
  };
  $('#rPrev', root).onclick = () => go(-1);
  $('#rNext', root).onclick = () => go(1);
  const onKey = e => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return; if (e.key === 'h' || e.key === 'H') { if (selCfi && bar) saveHL(lastColor); } if (e.key === '/') { e.preventDefault?.(); $('#rSearch', root).click(); } if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1); if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1); if (e.key === 'Escape') { if (!$('#panel', root).hidden) hidePanel(); else close(); } };
  rendition.on('keyup', onKey); document.addEventListener('keyup', onKey);
  let tx = 0, ty = 0;
  rendition.on('touchstart', e => { tx = e.changedTouches[0].screenX; ty = e.changedTouches[0].screenY; });
  rendition.on('touchend', e => { const dx = e.changedTouches[0].screenX - tx, dy = e.changedTouches[0].screenY - ty; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1); });
  rendition.on('click', e => { // toque en los costados = pasar de página; en el centro, mueve el enfoque o salta a esa frase
    const w = e.view?.innerWidth || 0; if (!w || (e.view.getSelection && String(e.view.getSelection()))) return;
    const x = e.clientX % w; if (x < w * .22) go(-1); else if (x > w * .78) go(1);
    else { if (prefs.focus) moverBanda(e.clientY); if (tts.on) saltarA(e); }
  });
  // Modo enfoque: una banda clara que se mueve donde tocas; el resto de la página se atenúa.
  const banda = $('#fband', root);
  function moverBanda(y) { banda.style.setProperty('--y', Math.round(y) + 'px'); }
  function aplicarEnfoque() { banda.hidden = !prefs.focus; if (prefs.focus && !banda.style.getPropertyValue('--y')) moverBanda($('.vwrap', root).clientHeight * .4); }
  aplicarEnfoque();
  // Brillo con un gesto: arrastrar hacia arriba o abajo en el borde izquierdo (un toque ahí pasa a la página anterior).
  const veil = $('#veil', root), tip = $('#brtip', root); let tipT;
  const aplicarBrillo = () => { veil.style.opacity = String(Math.min(.75, Math.max(0, prefs.dim || 0))); };
  aplicarBrillo();
  const strip = $('#brstrip', root);
  strip.addEventListener('pointerdown', e => {
    const y0 = e.clientY, d0 = prefs.dim || 0, h = $('.vwrap', root).clientHeight || 600; let movio = false; strip.setPointerCapture(e.pointerId);
    const mv = ev => { const dy = ev.clientY - y0; if (Math.abs(dy) > 8) movio = true; if (!movio) return; prefs.dim = Math.min(.75, Math.max(0, d0 + dy / h)); aplicarBrillo(); tip.hidden = false; tip.textContent = `Brillo ${Math.round((1 - (prefs.dim || 0) / .75 * .8) * 100)} %`; clearTimeout(tipT); };
    const up = () => { strip.removeEventListener('pointermove', mv); strip.removeEventListener('pointerup', up); strip.removeEventListener('pointercancel', up); if (movio) { setPref('dim', prefs.dim || 0); tipT = setTimeout(() => { tip.hidden = true; }, 700); } else go(-1); };
    strip.addEventListener('pointermove', mv); strip.addEventListener('pointerup', up); strip.addEventListener('pointercancel', up);
  });
  $('#rSlide', root).oninput = e => { if (!ready) return; stopTTS(); const c = book.locations.cfiFromPercentage(e.target.value / 1000); if (c) rendition.display(c); };

  /* ----- paneles ----- */
  const panel = $('#panel', root);
  const dock = () => { root.classList.toggle('pan', !panel.hidden); if (innerWidth >= 1000) setTimeout(() => { try { rendition.resize(); } catch { } }, 90); };
  const showPanel = html => { panel.innerHTML = html; panel.hidden = false; dock(); };
  const hidePanel = () => { panel.hidden = true; panel.innerHTML = ''; dock(); };
  const togglePanel = (name, html, after) => { if (!panel.hidden && panel.dataset.k === name) return hidePanel(); panel.dataset.k = name; showPanel(html); after && after(); };

  $('#rToc', root).onclick = () => togglePanel('toc', `<h3>Capítulos</h3><div class="toc" id="tocl">Cargando…</div>`, async () => {
    const nav = await book.loaded.navigation, flat = [];
    const walk = (a, d) => a.forEach(t => { flat.push([t.label.trim(), t.href, d]); t.subitems && walk(t.subitems, d + 1); }); walk(nav.toc, 0);
    $('#tocl', root).innerHTML = flat.length ? flat.map(([l, h, d], i) => `<a data-i="${i}" style="padding-left:${d * 16}px">${esc(l)}</a>`).join('') : 'Este libro no trae índice.';
    $$('#tocl a', root).forEach(a => a.onclick = () => { stopTTS(); rendition.display(flat[+a.dataset.i][1]); hidePanel(); });
  });

  let lastHL = null;
  $('#rSearch', root).onclick = () => togglePanel('search', `<h3>Buscar en el libro</h3><input type="search" id="q" placeholder="Palabra o frase" aria-label="Buscar en el libro"><div class="small" id="qc" style="margin:8px 0"></div><div id="qr"></div>`, () => {
    const q = $('#q', root); q.focus(); let run = 0;
    q.onkeydown = async e => {
      if (e.key !== 'Enter' || !q.value.trim()) return;
      const my = ++run, term = q.value.trim(), out = $('#qr', root); out.innerHTML = ''; let n = 0;
      const re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      for (const item of book.spine.spineItems) {
        if (my !== run) return;
        $('#qc', root).textContent = n ? `${n} resultados… buscando` : 'Buscando…';
        try {
          await item.load(book.load.bind(book));
          for (const h of item.find(term)) {
            n++; const a = document.createElement('button'); a.className = 'hit'; a.innerHTML = esc(h.excerpt).replace(re, '<mark>$1</mark>');
            a.onclick = async () => { stopTTS(); await rendition.display(h.cfi); if (lastHL) rendition.annotations.remove(lastHL, 'highlight'); lastHL = h.cfi; rendition.annotations.highlight(h.cfi, {}, () => { }, 'hl-search', { fill: '#F2C94C', 'fill-opacity': '.55' }); hidePanel(); };
            out.appendChild(a); if (n >= 300) break;
          }
          item.unload();
        } catch { }
        if (n >= 300) break;
      }
      if (my === run) $('#qc', root).textContent = n ? `${n} resultado${n > 1 ? 's' : ''}${n >= 300 ? ' (se muestran los primeros 300)' : ''}` : 'Sin resultados';
    };
  });

  // Voz: en la app de Android se usa la voz nativa (Google); en el navegador, la del propio navegador.
  const AN = window.AndroidApp, nativa = !!(AN && AN.ttsDisponible && AN.ttsDisponible());
  const hayVoz = () => nativa || ('speechSynthesis' in window);
  const voices = () => {
    try {
      if (nativa) return JSON.parse(AN.ttsVoces() || '[]').sort((a, b) => (b.net - a.net) || (b.q - a.q) || a.name.localeCompare(b.name));
      return (speechSynthesis.getVoices() || []).filter(v => v.lang.toLowerCase().startsWith('es')).map(v => ({ name: v.name, lang: v.lang, net: false }));
    } catch { return []; }
  };
  let mgT = 0;
  const seg = (name, items, cur) => `<div class="seg">${items.map(([k, n]) => `<button data-${name}="${k}" aria-selected="${cur === k}">${n}</button>`).join('')}</div>`;
  $('#rOpt', root).onclick = () => togglePanel('opt', `<h3>Letra y voz</h3><div class="opts">
    <div><div class="small" style="margin-bottom:6px">Fondo</div>${seg('th', [['paper', 'Papel'], ['sepia', 'Sepia'], ['night', 'Noche'], ['warm', 'Noche cálida']], root.dataset.theme)}
      <label class="chk"><input type="checkbox" id="autoN" ${prefs.autoNoche ? 'checked' : ''}> Noche cálida automática (22:00 a 6:00)</label></div>
    <label>Tipografía<select id="fsel">${Object.entries(FONTS).map(([k, [n]]) => `<option value="${k}" ${(prefs.font || 'libro') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <div><div class="small" style="margin-bottom:6px">Tamaño de letra</div><div class="row"><button class="btn ghost" id="fm" style="color:inherit">A −</button><button class="btn ghost" id="fp" style="color:inherit">A +</button><span class="small" id="fv" style="align-self:center">${fsz} %</span></div></div>
    <label>Interlineado <span class="small" id="lhv">${((prefs.lh || 16) / 10).toString().replace('.', ',')}</span><input type="range" id="lh" min="12" max="24" value="${prefs.lh || 16}"></label>
    <label>Márgenes <span class="small" id="mgv">${prefs.mar ?? 8} px</span><input type="range" id="mg" min="0" max="60" value="${prefs.mar ?? 8}"></label>
    <div class="row"><label class="chk"><input type="checkbox" id="just" ${prefs.just ? 'checked' : ''}> Justificado</label><label class="chk"><input type="checkbox" id="focus" ${prefs.focus ? 'checked' : ''}> Modo enfoque</label><label class="chk"><input type="checkbox" id="anim" ${prefs.anim !== false ? 'checked' : ''}> Animar páginas</label></div>
    <label>Brillo de la pantalla <span class="small" id="brv"></span><input type="range" id="br" min="0" max="75" value="${Math.round((prefs.dim || 0) * 100)}"></label>
    <label>Voz para leer en voz alta<select id="vsel">${voices().map(v => `<option value="${esc(v.name)}" ${v.name === prefs.voice ? 'selected' : ''}>${esc(nativa ? v.name.replace(/-/g, ' ') : v.name)} (${esc(v.lang)})${v.net ? ' · alta calidad' : ''}</option>`).join('') || '<option value="">Voz predeterminada del dispositivo</option>'}</select></label>
    <label>Velocidad<select id="rate">${RATES.map(r => `<option value="${r}" ${(prefs.rate || 1) === r ? 'selected' : ''}>${String(r).replace('.', ',')}x</option>`).join('')}</select></label></div>`, () => {
    $$('[data-th]', root).forEach(b2 => b2.onclick = () => { applyTheme(b2.dataset.th); $$('[data-th]', root).forEach(x => x.setAttribute('aria-selected', x === b2)); });
    $('#autoN', root).onchange = e => { setPref('autoNoche', e.target.checked); prefs.autoNoche = e.target.checked; };
    $('#fsel', root).onchange = e => { setPref('font', e.target.value); reestilo(); };
    $('#fm', root).onclick = () => { fsz = Math.max(70, fsz - 10); setPref('fsz', fsz); applySize(); $('#fv', root).textContent = fsz + ' %'; };
    $('#fp', root).onclick = () => { fsz = Math.min(220, fsz + 10); setPref('fsz', fsz); applySize(); $('#fv', root).textContent = fsz + ' %'; };
    $('#lh', root).oninput = e => { setPref('lh', +e.target.value); $('#lhv', root).textContent = (e.target.value / 10).toString().replace('.', ','); reestilo(); };
    $('#mg', root).oninput = e => { setPref('mar', +e.target.value); $('#mgv', root).textContent = e.target.value + ' px'; clearTimeout(mgT); mgT = setTimeout(aplicarMargen, 120); };
    $('#just', root).onchange = e => { setPref('just', e.target.checked); reestilo(); };
    $('#focus', root).onchange = e => { setPref('focus', e.target.checked); aplicarEnfoque(); };
    $('#anim', root).onchange = e => setPref('anim', e.target.checked);
    const brt = () => { $('#brv', root).textContent = Math.round((1 - (prefs.dim || 0) / .75 * .8) * 100) + ' %'; }; brt();
    $('#br', root).oninput = e => { setPref('dim', e.target.value / 100); aplicarBrillo(); brt(); };
    $('#vsel', root).onchange = e => setPref('voice', e.target.value);
    $('#rate', root).onchange = e => { setPref('rate', +e.target.value); prefs.rate = +e.target.value; actualizarChips(); };
  });

  /* ----- subrayados de colores (cada uno queda también como frase guardada) ----- */
  const COL = { amarillo: '#F2C94C', verde: '#7BC47F', azul: '#7FB2F0', rosa: '#F29AB8' };
  let lastColor = prefs.hl || 'amarillo', bar = null, barT, selText = '', selCfi = '', selWin = null;
  const hideSave = () => { bar && bar.remove(); bar = null; clearTimeout(barT); };
  const paint = (cfi, color) => { try { rendition.annotations.highlight(cfi, {}, () => { }, 'hl-' + color, { fill: COL[color] || COL.amarillo, 'fill-opacity': '.45', 'mix-blend-mode': 'multiply' }); } catch { } };
  async function saveHL(color) {
    if (!selCfi) return;
    setPref('hl', color); lastColor = color;
    await saveNote({ bookId: b.id, title: `${b.t} · ${b.a}`, text: selText.slice(0, 600), cfi: selCfi, color, createdAt: Date.now() });
    paint(selCfi, color); try { selWin?.getSelection().removeAllRanges(); } catch { }
    selCfi = ''; hideSave(); toast('Subrayado guardado en tus frases'); if (panel.dataset.k === 'notes' && !panel.hidden) $('#rNotes', root).click(), $('#rNotes', root).click();
  }
  rendition.on('selected', (cfiRange, contents) => {
    const text = (contents.window.getSelection().toString() || '').replace(/\s+/g, ' ').trim();
    if (text.length < 3) return;
    selText = text; selCfi = cfiRange; selWin = contents.window; hideSave();
    bar = document.createElement('div'); bar.className = 'savebar';
    bar.innerHTML = `<span>Subrayar</span>${Object.keys(COL).map(c => `<button class="hdotb" data-c="${c}" style="background:${COL[c]}" aria-label="Subrayar en ${c}"></button>`).join('')}<button class="defbtn" data-def>Definir</button>`;
    $('.vwrap', root).appendChild(bar);
    bar.onclick = e => {
      if (e.target.closest('[data-def]')) { const w = selText.split(' ')[0].replace(/[^\p{L}-]/gu, '').toLowerCase(), u = 'https://es.wiktionary.org/wiki/' + encodeURIComponent(w); if (window.AndroidApp?.abrirExterno) window.AndroidApp.abrirExterno(u); else window.open(u, '_blank'); return; }
      const c = e.target.closest('[data-c]'); if (c) saveHL(c.dataset.c);
    };
    barT = setTimeout(hideSave, 10000);
  });
  rendition.hooks.content.register(() => { // vuelve a marcar los subrayados de este libro, cada uno con su color
    S.notes.filter(n => n.bookId === b.id && n.cfi).forEach(n => paint(n.cfi, n.color || 'amarillo'));
  });
  $('#rNotes', root).onclick = () => togglePanel('notes', `<h3>Subrayados</h3><div id="nl"></div>`, () => {
    const mine = S.notes.filter(n => n.bookId === b.id).sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0));
    $('#nl', root).innerHTML = mine.length ? mine.map(n => `<div class="hit nt"><button data-g="${n.id}" style="text-align:left;flex:1"><i class="ndot" style="background:${COL[n.color] || COL.amarillo}"></i>${esc(n.text.slice(0, 140))}${n.text.length > 140 ? '…' : ''}</button><button data-x="${n.id}" aria-label="Quitar">×</button></div>`).join('') : '<div class="small">Aún no hay subrayados. Selecciona un texto y elige un color.</div>';
    $$('[data-g]', root).forEach(x => x.onclick = () => { const n = S.notes.find(z => z.id === +x.dataset.g); if (n?.cfi) { stopTTS(); rendition.display(n.cfi); if (innerWidth < 1000) hidePanel(); } });
    $$('[data-x]', root).forEach(x => x.onclick = async () => { const n = S.notes.find(z => z.id === +x.dataset.x); if (n?.cfi) { try { rendition.annotations.remove(n.cfi, 'highlight'); } catch { } } await removeNote(+x.dataset.x); x.closest('.nt').remove(); });
  });

  /* ----- leer en voz alta (voz del dispositivo): frase resaltada, saltos, velocidad y temporizador ----- */
  const tts = { on: false, token: 0, pausa: false, cortada: false, jump: null, sleepAt: 0, sleepFin: false, fr: [], i: 0, marca: null };
  const dormir = () => { stopTTS(); toast('Lectura detenida: ya era hora de dormir'); };
  // Texto de la página actual con el lugar exacto de cada frase dentro del documento (para poder resaltarla).
  function frasesDePagina() {
    const loc = rendition.currentLocation(), c = rendition.getContents()[0]; if (!c) return [];
    const doc = c.document; let r = null;
    try { const s0 = new ePub.CFI(loc.start.cfi).toRange(doc), e0 = new ePub.CFI(loc.end.cfi).toRange(doc); r = doc.createRange(); r.setStart(s0.startContainer, s0.startOffset); r.setEnd(e0.endContainer, e0.endOffset); } catch { r = null; }
    const nodes = [], w = doc.createTreeWalker(r ? (r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer) : doc.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      if (r && !r.intersectsNode(n)) continue;
      let a0 = 0, b0 = n.nodeValue.length; if (r && n === r.startContainer) a0 = r.startOffset; if (r && n === r.endContainer) b0 = r.endOffset;
      if (b0 > a0) nodes.push({ n, a: a0, b: b0 });
    }
    let raw = ''; const map = [];
    for (const x of nodes) { const sl = x.n.nodeValue.slice(x.a, x.b), sep = /\s$/.test(sl) ? '' : ' '; map.push({ ...x, off: raw.length, len: sl.length }); raw += sl + sep; }
    const pos = o => { for (const m of map) if (o >= m.off && o < m.off + m.len) return [m.n, m.a + (o - m.off)]; const l = map[map.length - 1]; return l ? [l.n, l.b] : null; };
    const out = [], re = /[^.!?…;:]+[.!?…;:]*\s*/g; let m;
    while ((m = re.exec(raw))) {
      const text = m[0].replace(/\s+/g, ' ').trim(); if (text.length < 2) continue;
      try { const p0 = pos(m.index), p1 = pos(Math.min(raw.length - 1, m.index + m[0].trimEnd().length - 1)); if (!p0 || !p1) throw 0; const rg = doc.createRange(); rg.setStart(p0[0], p0[1]); rg.setEnd(p1[0], Math.min(p1[0].nodeValue.length, p1[1] + 1)); out.push({ text, range: rg }); }
      catch { out.push({ text, range: null }); }
    }
    return out;
  }
  function marcar(f) {
    quitarMarca(); if (!f || !f.range) return;
    try {
      const c = rendition.getContents()[0], cfi = c.cfiFromRange(f.range), col = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#62B7AB';
      rendition.annotations.highlight(cfi, {}, () => { }, 'tts-hl', { fill: col, 'fill-opacity': '.38', 'mix-blend-mode': 'multiply' }); tts.marca = cfi;
    } catch { }
  }
  function quitarMarca() { if (tts.marca) { try { rendition.annotations.remove(tts.marca, 'highlight'); } catch { } tts.marca = null; } }
  const cancelarVoz = () => { try { nativa ? AN.ttsParar() : speechSynthesis.cancel(); } catch { } };
  function saltarA(e) { // tocar una frase mientras se lee: sigue desde ahí
    try {
      const d = e.view.document, cr = d.caretRangeFromPoint ? d.caretRangeFromPoint(e.clientX, e.clientY) : null; if (!cr) return;
      const k = tts.fr.findIndex(f => f.range && f.range.comparePoint(cr.startContainer, cr.startOffset) === 0);
      if (k >= 0) { tts.jump = k; cancelarVoz(); }
    } catch { }
  }
  const actualizarChips = () => { $('#lRate b', root).textContent = String(prefs.rate || 1).replace('.', ',') + 'x'; };
  let sIdx = 0;
  $('#lRate', root).onclick = () => { const i = (RATES.indexOf(prefs.rate || 1) + 1) % RATES.length; setPref('rate', RATES[i]); prefs.rate = RATES[i]; actualizarChips(); if (tts.on) { tts.jump = tts.i; cancelarVoz(); } };
  $('#lSleep', root).onclick = () => {
    sIdx = (sIdx + 1) % SLEEPS.length; const [n, min] = SLEEPS[sIdx];
    tts.sleepAt = min > 0 ? Date.now() + min * 60000 : 0; tts.sleepFin = min < 0; $('#lSleep b', root).textContent = n;
  };
  $('#lPrev', root).onclick = () => { if (tts.on) { tts.jump = Math.max(0, tts.i - 1); cancelarVoz(); } };
  $('#lNext', root).onclick = () => { if (tts.on) { tts.jump = Math.min(tts.fr.length, tts.i + 1); cancelarVoz(); } };
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  async function listenLoop() {
    const token = ++tts.token; tts.on = true; tts.pausa = false; tts.jump = null; $('#listen', root).hidden = false;
    $('#lPlay', root).innerHTML = ic('pause'); actualizarChips(); estadoNativo();
    let desde = 0;
    while (tts.on && token === tts.token) {
      tts.fr = frasesDePagina(); const idx0 = rendition.currentLocation()?.start?.index;
      for (let i = desde; i < tts.fr.length; i++) {
        desde = 0;
        if (!tts.on || token !== tts.token) return;
        if (tts.sleepAt && Date.now() >= tts.sleepAt) return dormir();
        tts.i = i; marcar(tts.fr[i]); $('#lInfo', root).textContent = tts.fr[i].text.slice(0, 70); estadoNativo();
        if (!(await speak(tts.fr[i].text, token))) return;
        if (tts.jump !== null) { tts.cortada = false; i = tts.jump - 1; tts.jump = null; continue; }
        if (nativa && tts.cortada) {                      // pausa en la voz nativa: se espera y se repite la frase
          tts.cortada = false;
          while (tts.pausa && tts.on && token === tts.token) await esperar(150);
          if (!tts.on || token !== tts.token) return;
          i--; continue;
        }
      }
      quitarMarca();
      if (!tts.on || token !== tts.token) return;
      const before = rendition.currentLocation()?.start?.cfi;
      await rendition.next();
      await esperar(350);
      if (rendition.currentLocation()?.start?.cfi === before) { stopTTS(); toast('Llegaste al final'); return; }
      if (tts.sleepFin && rendition.currentLocation()?.start?.index !== idx0) return dormir();
    }
  }
  function stopTTS() { tts.on = false; tts.token++; tts.pausa = false; tts.jump = null; tts.sleepAt = 0; tts.sleepFin = false; sIdx = 0; $('#lSleep b', root).textContent = 'Apagado'; cancelarVoz(); quitarMarca(); $('#listen', root).hidden = true; estadoNativo(); }
  // Aviso a Android: notificación con controles aunque la pantalla esté apagada.
  function estadoNativo() { try { AN?.lecturaEstado && AN.lecturaEstado(tts.on, tts.pausa, b.t, tts.fr[tts.i]?.text?.slice(0, 80) || ''); } catch { } }
  window.__lecturaAccion = a => {
    if (!tts.on) return;
    if (a === 'pausa') $('#lPlay', root).click(); else if (a === 'prev') $('#lPrev', root).click(); else if (a === 'next') $('#lNext', root).click(); else if (a === 'stop') stopTTS();
  };
  $('#rListen', root).onclick = () => { if (!hayVoz()) return toast('Este dispositivo no tiene lectura en voz alta'); tts.on ? stopTTS() : listenLoop(); };
  $('#lStop', root).onclick = stopTTS;
  $('#lPlay', root).onclick = () => {
    if (nativa) {
      if (tts.pausa) { tts.pausa = false; $('#lPlay', root).innerHTML = ic('pause'); } else { tts.pausa = true; AN.ttsParar(); $('#lPlay', root).innerHTML = ic('play'); }
      estadoNativo(); return;
    }
    if (speechSynthesis.paused) { speechSynthesis.resume(); tts.pausa = false; $('#lPlay', root).innerHTML = ic('pause'); }
    else { speechSynthesis.pause(); tts.pausa = true; $('#lPlay', root).innerHTML = ic('play'); }
    estadoNativo();
  };
  try { if (!nativa && 'speechSynthesis' in window) speechSynthesis.getVoices(); } catch { }

  let acc = 0, flushed = 0;
  const timeT = setInterval(() => { if (document.visibilityState === 'visible' && document.hasFocus()) { acc += 5; if (acc - flushed >= 20) { addTime(b.id, acc - flushed); flushed = acc; } } }, 5000);
  function close() {
    clearInterval(timeT); if (acc > flushed) addTime(b.id, acc - flushed);
    stopTTS(); hideSave(); clearTimeout(saveT); persistBook(b); delete window.__lecturaAccion;
    document.removeEventListener('keyup', onKey);
    try { book.destroy(); } catch { }
    root.remove(); cur = null; emit();
  }
  $('#rBack', root).onclick = close;
  cur = { close };
}
