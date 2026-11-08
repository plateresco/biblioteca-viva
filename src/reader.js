import ePub from 'epubjs';
import { S, byId, getFile, setStatus, persistBook, addPages, saveNote, emit } from './state.js';
import { $, $$, esc, ic, toast } from './ui.js';
import { ensureEpub } from './sync.js';

const TH = { paper: ['#F1ECE0', '#26221B'], sepia: ['#E6D8B8', '#3B2E17'], night: ['#12181B', '#D7DBD6'] };
const prefs = (() => { try { return JSON.parse(localStorage.getItem('bv-prefs')) || {}; } catch { return {}; } })();
const setPref = (k, v) => { prefs[k] = v; try { localStorage.setItem('bv-prefs', JSON.stringify(prefs)); } catch { } };

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
      <button class="iconbtn" id="rOpt" aria-label="Letra y voz">${ic('aa')}</button>
    </div>
    <div class="vwrap"><div id="viewer"></div><div id="panel" class="panel" hidden></div></div>
    <div class="listen" id="listen" hidden><button class="play" id="lPlay" aria-label="Pausar">${ic('pause')}</button>
      <div style="flex:1;min-width:0"><b style="font-size:14px">Leyendo en voz alta</b><div class="small" id="lInfo">&nbsp;</div></div>
      <button class="iconbtn" id="lStop" aria-label="Detener">${ic('x')}</button></div>
    <div class="rfoot"><div class="nav">
      <button class="iconbtn" id="rPrev" aria-label="Página anterior">${ic('left')}</button>
      <input type="range" id="rSlide" min="0" max="1000" value="0" aria-label="Posición en el libro" disabled>
      <button class="iconbtn" id="rNext" aria-label="Página siguiente">${ic('right')}</button>
      <button class="iconbtn" id="rListen" aria-label="Escuchar en voz alta">${ic('phones')}</button></div>
      <div class="small" id="rPage"></div></div>`;
  document.body.appendChild(root);

  const book = ePub(await file.arrayBuffer());
  await book.ready;
  const rendition = book.renderTo($('#viewer', root), { width: '100%', height: '100%', flow: 'paginated', spread: 'none', allowScriptedContent: false });
  for (const [k, [bg, fg]] of Object.entries(TH)) {
    rendition.themes.register(k, {
      body: { background: `${bg} !important`, color: `${fg} !important`, 'line-height': '1.6 !important' },
      '*': { color: `${fg} !important`, 'background-color': 'transparent !important' },
      'a, a *': { color: 'inherit !important', 'text-decoration': 'underline' },
      img: { 'max-width': '100% !important', 'background-color': 'transparent !important' },
    });
  }
  const applyTheme = t => { root.dataset.theme = t; rendition.themes.select(t); setPref('theme', t); };
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
    $('#rPage', root).textContent = loc.start.displayed ? `Capítulo: página ${loc.start.displayed.page} de ${loc.start.displayed.total}` : '';
    if (hasLocs) $('#rSlide', root).value = Math.round(pr * 1000);
    if (hasLocs && pr >= 0.985 && !finishedAsked) { finishedAsked = true; await setStatus(b, 'leido'); toast('¡Terminaste el libro! Quedó en “Leídos”.'); }
    persist();
  }
  rendition.on('relocated', onProgress);

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
  const go = dir => { stopTTS(); dir > 0 ? rendition.next() : rendition.prev(); hideSave(); };
  $('#rPrev', root).onclick = () => go(-1);
  $('#rNext', root).onclick = () => go(1);
  const onKey = e => { if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1); if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1); if (e.key === 'Escape') { if (!$('#panel', root).hidden) hidePanel(); else close(); } };
  rendition.on('keyup', onKey); document.addEventListener('keyup', onKey);
  let tx = 0, ty = 0;
  rendition.on('touchstart', e => { tx = e.changedTouches[0].screenX; ty = e.changedTouches[0].screenY; });
  rendition.on('touchend', e => { const dx = e.changedTouches[0].screenX - tx, dy = e.changedTouches[0].screenY - ty; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1); });
  rendition.on('click', e => { // toque en los costados = pasar de página
    const w = e.view?.innerWidth || 0; if (!w || (e.view.getSelection && String(e.view.getSelection()))) return;
    const x = e.clientX % w; if (x < w * .22) go(-1); else if (x > w * .78) go(1);
  });
  $('#rSlide', root).oninput = e => { if (!ready) return; stopTTS(); const c = book.locations.cfiFromPercentage(e.target.value / 1000); if (c) rendition.display(c); };

  /* ----- paneles ----- */
  const panel = $('#panel', root);
  const showPanel = html => { panel.innerHTML = html; panel.hidden = false; };
  const hidePanel = () => { panel.hidden = true; panel.innerHTML = ''; };
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

  const voices = () => (speechSynthesis.getVoices() || []).filter(v => v.lang.toLowerCase().startsWith('es'));
  $('#rOpt', root).onclick = () => togglePanel('opt', `<h3>Letra y voz</h3><div class="opts">
    <div><div class="small" style="margin-bottom:6px">Fondo</div><div class="seg">${[['paper', 'Papel'], ['sepia', 'Sepia'], ['night', 'Noche']].map(([k, n]) => `<button data-th="${k}" aria-selected="${root.dataset.theme === k}">${n}</button>`).join('')}</div></div>
    <div><div class="small" style="margin-bottom:6px">Tamaño de letra</div><div class="row"><button class="btn ghost" id="fm" style="color:inherit">A −</button><button class="btn ghost" id="fp" style="color:inherit">A +</button><span class="small" id="fv" style="align-self:center">${fsz} %</span></div></div>
    <label>Voz para leer en voz alta<select id="vsel">${voices().map(v => `<option value="${esc(v.name)}" ${v.name === prefs.voice ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('') || '<option value="">Voz predeterminada del dispositivo</option>'}</select></label>
    <label>Velocidad<select id="rate">${[0.8, 1, 1.2, 1.5, 1.8].map(r => `<option value="${r}" ${(prefs.rate || 1) === r ? 'selected' : ''}>${r}x</option>`).join('')}</select></label></div>`, () => {
    $$('[data-th]', root).forEach(b2 => b2.onclick = () => { applyTheme(b2.dataset.th); $$('[data-th]', root).forEach(x => x.setAttribute('aria-selected', x === b2)); });
    $('#fm', root).onclick = () => { fsz = Math.max(70, fsz - 10); setPref('fsz', fsz); applySize(); $('#fv', root).textContent = fsz + ' %'; };
    $('#fp', root).onclick = () => { fsz = Math.min(220, fsz + 10); setPref('fsz', fsz); applySize(); $('#fv', root).textContent = fsz + ' %'; };
    $('#vsel', root).onchange = e => setPref('voice', e.target.value);
    $('#rate', root).onchange = e => setPref('rate', +e.target.value);
  });

  /* ----- guardar frases ----- */
  let bar = null, barT;
  const hideSave = () => { bar && bar.remove(); bar = null; clearTimeout(barT); };
  rendition.on('selected', (cfiRange, contents) => {
    const text = (contents.window.getSelection().toString() || '').replace(/\s+/g, ' ').trim();
    if (text.length < 8) return;
    hideSave();
    bar = document.createElement('button'); bar.className = 'savebar'; bar.innerHTML = `${ic('quote')}Guardar frase`;
    $('.vwrap', root).appendChild(bar);
    bar.onclick = async () => {
      await saveNote({ bookId: b.id, title: `${b.t} · ${b.a}`, text: text.slice(0, 600), cfi: cfiRange, createdAt: Date.now() });
      rendition.annotations.highlight(cfiRange, {}, () => { }, 'hl-note', { fill: '#F2C94C', 'fill-opacity': '.4' });
      contents.window.getSelection().removeAllRanges(); hideSave(); toast('Frase guardada');
    };
    barT = setTimeout(hideSave, 9000);
  });
  rendition.hooks.content.register(() => { // vuelve a marcar las frases guardadas de este libro
    S.notes.filter(n => n.bookId === b.id && n.cfi).forEach(n => { try { rendition.annotations.highlight(n.cfi, {}, () => { }, 'hl-note', { fill: '#F2C94C', 'fill-opacity': '.4' }); } catch { } });
  });

  /* ----- leer en voz alta (voz del propio dispositivo, gratis y sin conexión) ----- */
  const tts = { on: false, token: 0 };
  async function pageText() {
    const loc = rendition.currentLocation(), c = rendition.getContents()[0];
    try {
      const doc = c.document, s = new ePub.CFI(loc.start.cfi).toRange(doc), e = new ePub.CFI(loc.end.cfi).toRange(doc), r = doc.createRange();
      r.setStart(s.startContainer, s.startOffset); r.setEnd(e.endContainer, e.endOffset);
      return r.toString();
    } catch { return c.document.body.innerText || ''; }
  }
  function speak(text, token) {
    return new Promise(res => {
      const u = new SpeechSynthesisUtterance(text);
      const v = voices(); const pick = v.find(x => x.name === prefs.voice) || v[0];
      if (pick) { u.voice = pick; u.lang = pick.lang; } else u.lang = 'es-ES';
      u.rate = prefs.rate || 1;
      u.onend = u.onerror = () => res(token === tts.token);
      speechSynthesis.speak(u);
    });
  }
  async function listenLoop() {
    const token = ++tts.token; tts.on = true; $('#listen', root).hidden = false;
    $('#lPlay', root).innerHTML = ic('pause');
    while (tts.on && token === tts.token) {
      const text = (await pageText()).replace(/\s+/g, ' ').trim();
      const parts = text.match(/[^.!?…;:]+[.!?…;:]*\s*/g) || [];
      for (let i = 0; i < parts.length; i++) {
        if (!tts.on || token !== tts.token) return;
        $('#lInfo', root).textContent = parts[i].trim().slice(0, 70);
        if (!(await speak(parts[i], token))) return;
      }
      if (!tts.on || token !== tts.token) return;
      const before = rendition.currentLocation()?.start?.cfi;
      await rendition.next();
      await new Promise(r => setTimeout(r, 350));
      if (rendition.currentLocation()?.start?.cfi === before) { stopTTS(); toast('Llegaste al final'); return; }
    }
  }
  function stopTTS() { tts.on = false; tts.token++; speechSynthesis.cancel(); $('#listen', root).hidden = true; }
  $('#rListen', root).onclick = () => { if (!('speechSynthesis' in window)) return toast('Este navegador no tiene lectura en voz alta'); tts.on ? stopTTS() : listenLoop(); };
  $('#lStop', root).onclick = stopTTS;
  $('#lPlay', root).onclick = () => {
    if (speechSynthesis.paused) { speechSynthesis.resume(); $('#lPlay', root).innerHTML = ic('pause'); }
    else { speechSynthesis.pause(); $('#lPlay', root).innerHTML = ic('play'); }
  };
  speechSynthesis?.getVoices();

  function close() {
    stopTTS(); hideSave(); clearTimeout(saveT); persistBook(b);
    document.removeEventListener('keyup', onKey);
    try { book.destroy(); } catch { }
    root.remove(); cur = null; emit();
  }
  $('#rBack', root).onclick = close;
  cur = { close };
}
