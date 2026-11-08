import { S, ST, FORMATS, byId, coverUrl, addBook, saveBook, removeBook, setStatus, addPages, today, fd, emit } from './state.js';
import { $, $$, esc, ic, openSheet, closeSheet, toast } from './ui.js';
import { coverColors, fallbackColors } from './color.js';
import { lookupISBN, canScan, startScan } from './isbn.js';
import { shrinkImage } from './color.js';
import { getClientId, setClientId, isEnabled, lastSync, hasToken, connect, syncNow, disable as disableSync } from './sync.js';

export function coverFace(b, cls = 'cover') {
  const u = coverUrl(b);
  const style = `--c1:${b.c1 || '#555'};--tx:${b.dark === false ? '#1b1b1b' : '#F6F0E2'}`;
  if (u) return `<div class="${cls} img" style="${style}"><img src="${u}" alt="Portada de ${esc(b.t)}"></div>`;
  return `<div class="${cls}" style="${style}"><small>${esc(b.f)}</small><b>${esc(b.t)}</b><small>${esc(b.a)}</small></div>`;
}
export function miniFace(b) {
  const u = coverUrl(b);
  return `<div class="mini" style="--c1:${b.c1 || '#555'};--tx:${b.dark === false ? '#1b1b1b' : '#F6F0E2'}">${u ? `<img src="${u}" alt="">` : esc((b.t || '?')[0])}</div>`;
}
export function datesLine(b) {
  if (b.s === 'porleer') return 'Aún sin empezar';
  if (b.s === 'leyendo') return `Empezó el ${fd(b.st)}`;
  if (b.s === 'leido') return `${fd(b.st)} → ${fd(b.en)}`;
  return `Empezó el ${fd(b.st)} · lo dejó el ${fd(b.en)}`;
}

/* ---------- Ficha del libro ---------- */
const RTAGS = ['Lo recomendaría', 'Para releer', 'Me cambió la forma de pensar', 'Largo pero valió la pena'];
export function openCover(id, { onClose, openReader } = {}) {
  const b = byId(id); if (!b) return;
  const pct = Math.round((b.r || 0) / b.p * 100), canRead = b.hasFile;
  const stars = n => [1, 2, 3, 4, 5].map(i => `<button type="button" class="${i <= n ? 'on' : ''}" data-s="${i}" aria-label="${i} ${i === 1 ? 'estrella' : 'estrellas'}">★</button>`).join('');
  const o = openSheet(`
    <div class="stagebook">${coverFace(b)}
      <div style="min-width:0;padding-bottom:4px"><h3>${esc(b.t)}</h3><div class="sub">${esc(b.a)}</div>
      <div style="margin-top:10px"><select id="est" aria-label="Estado">${Object.entries(ST).map(([k, v]) => `<option value="${k}" ${k === b.s ? 'selected' : ''}>${v.n}</option>`).join('')}</select></div></div></div>
    <dl class="kv"><dt>Formato</dt><dd>${esc(b.f)}</dd><dt>Páginas</dt><dd>${b.r || 0} de ${b.p}${b.hasFile ? ' (estimadas)' : ''}</dd>
      ${b.st ? `<dt>Empezó</dt><dd>${fd(b.st)}</dd>` : ''}${b.en && b.s === 'leido' ? `<dt>Terminó</dt><dd>${fd(b.en)}</dd>` : ''}${b.en && b.s === 'abandonado' ? `<dt>Lo dejó</dt><dd>${fd(b.en)}</dd>` : ''}${b.loan ? `<dt>Prestado a</dt><dd>${esc(b.loan.to)}</dd>` : ''}</dl>
    <div class="pbar" style="margin:12px 0 16px"><i style="width:${pct}%"></i></div>
    ${canRead ? '' : `<div class="form" style="margin:0 0 14px"><label>¿Hasta qué página llegaste?<div class="row" style="flex-wrap:nowrap"><input id="pg" type="number" min="0" max="${b.p}" value="${b.r || 0}" inputmode="numeric"><button class="btn" id="savepg" style="flex:none">Guardar</button></div></label></div>`}
    <div class="row" style="margin-bottom:16px">${canRead ? `<button class="btn" id="op">${ic('book')}${b.progress > 0 && b.s !== 'leido' ? 'Continuar leyendo' : 'Abrir en el lector'}</button>` : ''}<button class="btn ghost" id="ed">${ic('edit')}Editar</button></div>
    <div class="rvbox"><h4>Tu reseña <span class="small">(solo para ti)</span></h4><div class="starsb" id="stb">${stars(b.rating || 0)}</div>
      <div class="rchips" id="rch">${RTAGS.map(t => `<button type="button" aria-pressed="${(b.rtags || []).includes(t)}">${t}</button>`).join('')}</div>
      <textarea id="rv" rows="3" maxlength="800" placeholder="Lo que me dejó este libro…" aria-label="Reseña">${esc(b.rev || '')}</textarea></div>
    <div class="rvbox"><h4>Colecciones y serie</h4>
      ${S.meta.cols.length ? `<div class="rchips" id="cch">${S.meta.cols.map(c => `<button type="button" data-c="${c.id}" aria-pressed="${(b.cols || []).includes(c.id)}">${esc(c.n)}</button>`).join('')}</div>` : '<div class="small">Crea colecciones en Más → Colecciones y préstamos.</div>'}
      <label class="inl2">Serie o saga<input id="ser" value="${esc(b.series || '')}" placeholder="Ej. Saga Dune" maxlength="40"></label>
      ${S.meta.mode === 'manual' && S.meta.pisos.length ? `<label class="inl2">Piso<select id="pis">${S.meta.pisos.map(p => `<option value="${p.id}" ${b.piso === p.id ? 'selected' : ''}>${esc(p.n)}</option>`).join('')}</select></label>` : ''}</div>`, { onClose });
  $('#op', o)?.addEventListener('click', () => { closeSheet(); openReader(b.id); });
  $('#ed', o).addEventListener('click', () => { closeSheet(); openEdit(b.id); });
  $('#est', o).addEventListener('change', async e => { await setStatus(b, e.target.value); toast('Estado actualizado'); });
  $('#stb', o).addEventListener('click', async e => { const s = e.target.closest('[data-s]'); if (!s) return; const n = +s.dataset.s; b.rating = b.rating === n ? 0 : n; $('#stb', o).innerHTML = stars(b.rating); await saveBook(b); });
  $('#rch', o).addEventListener('click', async e => { const t = e.target.closest('button'); if (!t) return; const on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', on); const k = t.textContent; b.rtags = (b.rtags || []).filter(x => x !== k); if (on) b.rtags.push(k); await saveBook(b); });
  $('#rv', o).addEventListener('change', async e => { b.rev = e.target.value.trim(); await saveBook(b); });
  $('#cch', o)?.addEventListener('click', async e => { const t = e.target.closest('[data-c]'); if (!t) return; const on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', on); const id = t.dataset.c; b.cols = (b.cols || []).filter(x => x !== id); if (on) b.cols.push(id); await saveBook(b); });
  $('#ser', o).addEventListener('change', async e => { b.series = e.target.value.trim(); await saveBook(b); });
  $('#pis', o)?.addEventListener('change', async e => { b.piso = e.target.value; await saveBook(b); toast('Cambiaste de piso'); });
  $('#savepg', o)?.addEventListener('click', async () => {
    const v = Math.min(b.p, Math.max(0, +$('#pg', o).value || 0));
    if (v > (b.r || 0)) await addPages(b.id, v - (b.r || 0));
    b.r = v; b.progress = v / b.p;
    if (v > 0 && b.s === 'porleer') { b.s = 'leyendo'; b.st = today(); }
    if (v >= b.p && b.s !== 'leido') { await setStatus(b, 'leido'); toast('¡Terminado! Quedó en leídos.'); } else { await saveBook(b); toast('Avance guardado'); }
    closeSheet(); onClose && onClose();
  });
}

/* ---------- Agregar libros: EPUB, ISBN o a mano ---------- */
export function openAdd(mode) {
  const o = openSheet(`<h3>Agregar libros</h3><div class="sub">Con un EPUB la app toma sola el título, el autor, la portada y la sinopsis, y lo puedes leer aquí mismo.</div>
    <div class="imp" id="drop">${ic('file')}<div style="margin:6px 0 12px">Arrastra tus archivos .epub aquí<br>o elígelos desde tu dispositivo</div>
      <button class="btn" id="pickf">Elegir EPUB</button><input id="fi" type="file" accept=".epub,application/epub+zip" multiple hidden></div>
    <div id="log"></div>
    <div class="rvbox" id="isbnc"><h4>Libro de papel · ISBN</h4><div class="sub">El ISBN está en la contraportada, junto al código de barras. Los datos vienen de Open Library, gratis.</div>
      <div class="isbnrow"><input id="isbn" inputmode="numeric" placeholder="Escribe o pega el ISBN" aria-label="ISBN" autocomplete="off"><button class="btn" id="isbnGo">Buscar</button></div>
      ${canScan() ? `<button class="btn ghost" id="scanBtn" style="width:100%;margin-top:8px">${ic('camera')}Escanear con la cámara</button>` : '<div class="small" style="margin-top:6px">Este navegador no lee códigos de barras: escribe el número.</div>'}
      <div class="cam" id="cam" hidden><video id="vid" muted playsinline></video><div class="frame"><i></i><i></i><i></i><i></i></div><div class="scan"></div><div class="msg" id="camMsg">Apunta al código de barras</div><button class="shut" id="camStop">Cancelar</button></div>
      <div id="isbnRes"></div></div>
    <button class="btn ghost" id="manual" style="width:100%">Agregar sin archivo (audiolibro u otro)</button>`);
  const fi = $('#fi', o), drop = $('#drop', o), log = $('#log', o);
  $('#pickf', o).onclick = () => fi.click();
  $('#manual', o).onclick = () => { closeSheet(); openEdit(null); };
  fi.onchange = () => run([...fi.files]);
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => run([...e.dataTransfer.files].filter(f => /\.epub$/i.test(f.name))));
  async function run(files) {
    for (const f of files) {
      const row = document.createElement('div'); row.className = 'found';
      row.innerHTML = `<span class="spin"></span><div style="min-width:0"><b>${esc(f.name)}</b><div class="small" data-s>Leyendo el libro…</div></div>`;
      log.prepend(row);
      try {
        const { readEpub } = await import('./epubimport.js'); const info = await readEpub(f, p => { row.querySelector('[data-s]').textContent = `Contando páginas… ${Math.round(p * 100)} %`; });
        const col = info.cover ? await coverColors(info.cover, info.title) : fallbackColors(info.title);
        const b = await addBook({ t: info.title, a: info.author, p: info.pages, f: 'EPUB', cover: info.cover, syn: info.syn, hasFile: true, ...col }, f);
        row.innerHTML = `${miniFace(b)}<div style="min-width:0"><b>${esc(b.t)}</b><div class="small">${esc(b.a)} · ${b.p} págs. estimadas</div></div>`;
      } catch (err) {
        console.error(err);
        row.innerHTML = `<div><b>${esc(f.name)}</b><div class="small" style="color:var(--bad)">No se pudo leer este archivo. ¿Es un EPUB válido?</div></div>`;
      }
    }
  }
  // ISBN: búsqueda por número o con la cámara
  const res = $('#isbnRes', o); let stopCam = null;
  const stop = () => { stopCam && stopCam(); stopCam = null; $('#cam', o).hidden = true; $('#cam', o).classList.remove('scanning'); };
  async function find(code) {
    stop(); res.innerHTML = `<div class="found"><span class="spin"></span><div class="small">Buscando ${esc(code)}…</div></div>`;
    try {
      const d = await lookupISBN(code), col = d.cover ? await coverColors(d.cover, d.title) : fallbackColors(d.title), cu = d.cover ? URL.createObjectURL(d.cover) : null;
      res.innerHTML = `<div class="found"><div class="cover ${cu ? 'img' : ''}" style="--c1:${col.c1};--tx:#F6F0E2">${cu ? `<img src="${cu}" alt="">` : `<b>${esc(d.title)}</b>`}</div><div style="min-width:0;flex:1"><b>${esc(d.title)}</b><div class="small">${esc(d.author)}</div>
        <label class="inl2" style="margin-top:8px">Páginas<input id="ipg" type="number" min="1" value="${d.pages || 250}" inputmode="numeric"></label>${d.pages ? '' : '<div class="small">Open Library no trae las páginas; ajústalas si lo sabes.</div>'}
        <button class="btn" id="isbnAdd" style="margin-top:10px">Agregar a «Por leer»</button></div></div>`;
      $('#isbnAdd', o).onclick = async () => {
        const nb = await addBook({ t: d.title, a: d.author, p: Math.max(1, +$('#ipg', o).value || 250), f: 'Papel', cover: d.cover, syn: d.syn, isbn: d.isbn, hasFile: false, ...col });
        res.innerHTML = `<div class="found">${miniFace(nb)}<div><b>${esc(nb.t)}</b><div class="small">Agregado a tu estantería</div></div></div>`; $('#isbn', o).value = ''; toast('Libro agregado');
      };
    } catch (e) { res.innerHTML = `<div class="small" style="color:var(--bad);margin-top:8px">${esc(e.message)}</div>`; }
  }
  $('#isbnGo', o).onclick = () => find($('#isbn', o).value);
  $('#isbn', o).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); find($('#isbn', o).value); } });
  $('#scanBtn', o)?.addEventListener('click', async () => {
    if (window.AndroidApp?.escanearIsbn) {            // dentro de la app: escáner de Google
      window.__isbnEscaneado = code => find(code);
      window.__isbnError = () => { res.innerHTML = `<div class="small" style="color:var(--bad);margin-top:8px">No pude abrir el escáner. Escribe el número.</div>`; };
      window.AndroidApp.escanearIsbn(); return;
    }
    const cam = $('#cam', o); cam.hidden = false; cam.classList.add('scanning'); $('#camMsg', o).textContent = 'Apunta al código de barras';
    try { stopCam = await startScan($('#vid', o), code => { $('#camMsg', o).textContent = 'Código detectado'; try { navigator.vibrate && navigator.vibrate(12); } catch { } find(code); }, () => document.body.contains(o)); }
    catch (e) { stop(); res.innerHTML = `<div class="small" style="color:var(--bad);margin-top:8px">No pude abrir la cámara. Revisa el permiso o escribe el número.</div>`; }
  });
  $('#camStop', o)?.addEventListener('click', stop);
  if (mode === 'isbn') { setTimeout(() => { $('#isbnc', o).scrollIntoView({ block: 'center' }); $('#scanBtn', o) ? $('#scanBtn', o).click() : $('#isbn', o).focus(); }, 250); }
  if (mode === 'manual') { closeSheet(); openEdit(null); }
}

/* ---------- Sincronización ---------- */
export function openSync() {
  const draw = (msg = '') => {
    const cid = getClientId(), on = isEnabled(), ls = lastSync();
    const o = openSync._o && document.body.contains(openSync._o) ? openSync._o : (openSync._o = openSheet('<div id="sy"></div>'));
    $('#sy', o).innerHTML = `<h3>Sincronizar con Google Drive</h3>
      <div class="sub">Tu biblioteca, tus fechas, tus frases y tus EPUB quedan guardados en una carpeta oculta de tu Drive, para verlos igual en el PC y en el teléfono. Solo esta app puede leerla.</div>
      ${cid ? '' : `<form class="form" id="cidf"><label>ID de cliente de Google<input id="cid" required placeholder="123456-abc.apps.googleusercontent.com" autocomplete="off"></label><button class="btn" type="submit">Guardar</button><div class="small">Se crea una sola vez; los pasos están en el archivo GUIA_SINCRONIZACION.md.</div></form>`}
      ${cid ? `<div class="note" style="margin:14px 0">${on ? (ls ? `Última sincronización: ${new Date(ls).toLocaleString('es-CL')}` : 'Conectado. Aún no se ha sincronizado.') : 'Sin conectar.'}</div>
        <div id="sst" class="small" style="min-height:20px;margin-bottom:10px">${esc(msg)}</div>
        <div class="row"><button class="btn" id="go">${on ? 'Sincronizar ahora' : 'Conectar con Google'}</button>
          ${on ? '<button class="btn ghost" id="off">Desconectar</button>' : ''}<button class="btn ghost" id="chg">Cambiar ID</button></div>` : ''}`;
    $('#cidf', o)?.addEventListener('submit', e => { e.preventDefault(); setClientId($('#cid', o).value); draw(); });
    $('#chg', o)?.addEventListener('click', () => { setClientId(''); draw(); });
    $('#off', o)?.addEventListener('click', () => { disableSync(); draw('Desconectado. Lo que ya está en Drive se conserva.'); });
    $('#go', o)?.addEventListener('click', async () => {
      const st = t => { const el = $('#sst', o); if (el) el.textContent = t; };
      try { if (!hasToken()) { st('Abriendo Google…'); await connect(true); } await syncNow(st); toast('Biblioteca sincronizada'); draw('Listo.'); }
      catch (err) { console.error(err); st(err.message || 'No se pudo sincronizar'); }
    });
  };
  draw();
}

/* ---------- Crear / editar ---------- */
export function openEdit(id) {
  const b = id ? byId(id) : { t: '', a: '', p: 250, f: 'Papel', s: 'porleer', r: 0, st: null, en: null };
  const o = openSheet(`<h3>${id ? 'Editar libro' : 'Libro nuevo'}</h3>
    <form class="form" id="f">
      <label>Título<input name="t" required value="${esc(b.t)}"></label>
      <label>Autor<input name="a" value="${esc(b.a)}"></label>
      <div class="two"><label>Páginas<input name="p" type="number" min="1" required value="${b.p}" inputmode="numeric"></label>
        <label>Formato<select name="f">${FORMATS.map(x => `<option ${x === b.f ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
      <label>Estado<select name="s">${Object.entries(ST).map(([k, v]) => `<option value="${k}" ${k === b.s ? 'selected' : ''}>${v.n}</option>`).join('')}</select></label>
      <div class="two"><label>Empezó<input name="st" type="date" value="${b.st || ''}"></label><label>Terminó o lo dejó<input name="en" type="date" value="${b.en || ''}"></label></div>
      <label>Sinopsis (opcional, se ve en la contraportada)<textarea name="syn" rows="3" maxlength="600">${esc(b.syn || '')}</textarea></label>
      <label>Portada (opcional)<input name="cov" type="file" accept="image/*"></label>
      <div class="row"><button class="btn" type="submit">${id ? 'Guardar cambios' : 'Agregar a la estantería'}</button>
        ${id ? `<button class="btn danger" type="button" id="del">${ic('trash')}Quitar</button>` : ''}</div>
    </form>`);
  $('#f', o).addEventListener('submit', async e => {
    e.preventDefault();
    const d = new FormData(e.target);
    const prevS = b.s;
    b.t = d.get('t').trim(); b.a = (d.get('a') || '').trim() || 'Autor desconocido';
    b.p = Math.max(1, +d.get('p') || 1); b.f = d.get('f'); b.syn = (d.get('syn') || '').trim();
    b.st = d.get('st') || null; b.en = d.get('en') || null;
    const ns = d.get('s');
    const file = d.get('cov');
    if (file && file.size) { b.cover = await shrinkImage(file); Object.assign(b, await coverColors(b.cover, b.t)); }
    else if (!b.c1) Object.assign(b, fallbackColors(b.t));
    if (b.id) {
      b.s = ns;
      if (ns !== prevS) { const keepSt = b.st, keepEn = b.en; await setStatus(b, ns); if (keepSt) b.st = keepSt; if (keepEn && ns !== 'leyendo' && ns !== 'porleer') b.en = keepEn; }
      b.r = Math.min(b.r || 0, b.p);
      await saveBook(b);
    } else {
      b.s = 'porleer'; const nb = await addBook({ ...b, hasFile: false });
      if (ns !== 'porleer') { const keepSt = b.st, keepEn = b.en; await setStatus(nb, ns); if (keepSt) nb.st = keepSt; if (keepEn) nb.en = keepEn; await saveBook(nb); }
    }
    closeSheet(); toast('Guardado');
  });
  let armed = false;
  $('#del', o)?.addEventListener('click', async ev => {
    if (!armed) { armed = true; ev.currentTarget.textContent = 'Toca otra vez para quitarlo'; return; }
    await removeBook(b.id); closeSheet(); toast('Libro quitado');
  });
}

// EPUB recibidos desde otras apps (Abrir con… o Compartir): se agregan sin abrir la hoja de agregar.
export async function importarEpubs(files, onDone) {
  for (const f of files) {
    try {
      toast(`Leyendo «${f.name}»…`);
      const { readEpub } = await import('./epubimport.js'), info = await readEpub(f);
      const col = info.cover ? await coverColors(info.cover, info.title) : fallbackColors(info.title);
      const b = await addBook({ t: info.title, a: info.author, p: info.pages, f: 'EPUB', cover: info.cover, syn: info.syn, hasFile: true, ...col }, f);
      toast(`Agregado: ${b.t}`); onDone && onDone(b);
    } catch (e) { console.error(e); toast('No pude leer ese archivo. ¿Es un EPUB válido?'); }
  }
}
