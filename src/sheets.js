import { S, ST, FORMATS, byId, coverUrl, addBook, saveBook, removeBook, setStatus, addPages, today, fd, emit } from './state.js';
import { $, $$, esc, ic, openSheet, closeSheet, toast } from './ui.js';
import { readEpub } from './epubimport.js';
import { coverColors, fallbackColors } from './color.js';
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

/* ---------- Portada del libro (el efecto de "sacarlo" del estante) ---------- */
export function openCover(id, { onClose, openReader } = {}) {
  const b = byId(id); if (!b) return;
  const pct = Math.round((b.r || 0) / b.p * 100);
  const canRead = b.hasFile;
  const o = openSheet(`
    <div class="stagebook">${coverFace(b)}
      <div style="min-width:0;padding-bottom:4px"><h3>${esc(b.t)}</h3><div class="sub">${esc(b.a)}</div>
      <div style="margin-top:10px"><span class="chip" style="padding:3px 10px"><span style="width:8px;height:8px;border-radius:50%;background:${ST[b.s].c}"></span>${ST[b.s].n}</span></div></div></div>
    <dl class="kv"><dt>Formato</dt><dd>${esc(b.f)}</dd><dt>Páginas</dt><dd>${b.r || 0} de ${b.p}${b.hasFile ? ' (estimadas)' : ''}</dd>
      ${b.st ? `<dt>Empezó</dt><dd>${fd(b.st)}</dd>` : ''}${b.en && b.s === 'leido' ? `<dt>Terminó</dt><dd>${fd(b.en)}</dd>` : ''}${b.en && b.s === 'abandonado' ? `<dt>Lo dejó</dt><dd>${fd(b.en)}</dd>` : ''}</dl>
    <div class="pbar" style="margin:12px 0 16px"><i style="width:${pct}%"></i></div>
    ${canRead ? '' : `<div class="form" style="margin:0 0 14px"><label>¿Hasta qué página llegaste?<div class="row" style="flex-wrap:nowrap"><input id="pg" type="number" min="0" max="${b.p}" value="${b.r || 0}" inputmode="numeric"><button class="btn" id="savepg" style="flex:none">Guardar</button></div></label></div>`}
    <div class="row">${canRead ? `<button class="btn" id="op">${ic('book')}${b.progress > 0 && b.s !== 'leido' ? 'Continuar leyendo' : 'Abrir en el lector'}</button>` : ''}
      <button class="btn ghost" id="ed">${ic('edit')}Editar</button></div>`, { onClose });
  $('#op', o)?.addEventListener('click', () => { closeSheet(); openReader(b.id); });
  $('#ed', o).addEventListener('click', () => { closeSheet(); openEdit(b.id); });
  $('#savepg', o)?.addEventListener('click', async () => {
    const v = Math.min(b.p, Math.max(0, +$('#pg', o).value || 0));
    if (v > (b.r || 0)) await addPages(b.id, v - (b.r || 0));
    b.r = v; b.progress = v / b.p;
    if (v > 0 && b.s === 'porleer') { b.s = 'leyendo'; b.st = today(); }
    if (v >= b.p && b.s !== 'leido') { await setStatus(b, 'leido'); toast('¡Terminado! Quedó en leídos.'); } else { await saveBook(b); toast('Avance guardado'); }
    closeSheet(); onClose && onClose();
  });
}

/* ---------- Agregar libros ---------- */
export function openAdd() {
  const o = openSheet(`<h3>Agregar libros</h3><div class="sub">Con un EPUB la app toma sola el título, el autor y la portada, y lo puedes leer aquí mismo.</div>
    <div class="imp" id="drop">${ic('file')}<div style="margin:6px 0 12px">Arrastra tus archivos .epub aquí<br>o elígelos desde tu dispositivo</div>
      <button class="btn" id="pickf">Elegir EPUB</button><input id="fi" type="file" accept=".epub,application/epub+zip" multiple hidden></div>
    <div id="log"></div>
    <button class="btn ghost" id="manual" style="width:100%">Agregar sin archivo (papel, audiolibro, otro)</button>`);
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
        const info = await readEpub(f, p => { row.querySelector('[data-s]').textContent = `Contando páginas… ${Math.round(p * 100)} %`; });
        const col = info.cover ? await coverColors(info.cover, info.title) : fallbackColors(info.title);
        const b = await addBook({ t: info.title, a: info.author, p: info.pages, f: 'EPUB', cover: info.cover, syn: info.syn, hasFile: true, ...col }, f);
        row.innerHTML = `${miniFace(b)}<div style="min-width:0"><b>${esc(b.t)}</b><div class="small">${esc(b.a)} · ${b.p} págs. estimadas</div></div>`;
      } catch (err) {
        console.error(err);
        row.innerHTML = `<div><b>${esc(f.name)}</b><div class="small" style="color:var(--bad)">No se pudo leer este archivo. ¿Es un EPUB válido?</div></div>`;
      }
    }
  }
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
    if (file && file.size) { b.cover = file; Object.assign(b, await coverColors(file, b.t)); }
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
