import { S, ST, byId, saveBook, saveMeta, newId, addBook, today, fd, coverUrl } from './state.js';
import { P, setPref, THEMES } from './prefs.js';
import { $, $$, esc, ic, toast, openSheet, closeSheet } from './ui.js';
import { openSync, openAdd } from './sheets.js';
import { syncLabel, syncState, isEnabled, lastSync } from './sync.js';
import { exportJSON, importJSON, exportCSV, readCSV, addImported } from './backup.js';
import { fmtDur, daysSince } from './metrics.js';
import { fallbackColors } from './color.js';
import { checkReminder } from './reminder.js';
import { imgShelf, shareImage } from './share.js';

let sub = null;
export const openMore = p => { sub = p; };

const MENU = [
  ['colecciones', 'Colecciones y préstamos', () => `${S.meta.cols.length} colecciones · ${S.books.filter(b => b.loan).length} prestados`, 'tag'],
  ['deseos', 'Lista de deseos', () => `${S.meta.wish.length} libros por conseguir`, 'heart'],
  ['autores', 'Autores', () => `${new Set(S.books.map(b => b.a)).size} autores`, 'users'],
  ['diario', 'Diario de lectura', () => 'Lo que leíste, día por día', 'clock'],
  ['compartir', 'Compartir mi estante', () => 'Una imagen, no un enlace', 'image'],
  ['importar', 'Importar y agregar libros', () => 'EPUB, ISBN o lista CSV', 'upload'],
  ['apariencia', 'Apariencia y texto', () => THEMES.find(t => t[0] === P.theme)?.[1] + ' · letra ' + P.textScale + ' %', 'palette'],
  ['recordatorio', 'Recordatorio', () => P.reminder.on ? `Cada día a las ${P.reminder.time}` : 'Apagado', 'bell'],
  ['sync', 'Sincronización y copia', () => syncLabel(), 'cloud'],
  ['atajos', 'Atajos y accesibilidad', () => 'Teclado, contraste, texto', 'keyboard'],
  ['ia', 'Recomendaciones con IA', () => 'Pregunta lista para copiar', 'spark'],
  ['ayuda', 'Ayuda', () => 'Primeros pasos', 'info'],
];

export function drawMore(ctx) {
  const v = $('#v-more');
  if (!sub) {
    v.innerHTML = `<div class="apphead"><div><h2>Más</h2><div class="sub">Colecciones, ajustes y herramientas</div></div></div><div class="pad"><div class="mlist">${MENU.map(([k, n, s, i]) => `<button class="ml" data-k="${k}"><span class="mi">${ic(i)}</span><span class="mt"><b>${n}</b><small>${s()}</small></span>${ic('chevron')}</button>`).join('')}</div></div>`;
    $$('.ml', v).forEach(b => b.onclick = () => { sub = b.dataset.k; drawMore(ctx); v.scrollTop = 0; });
    return;
  }
  const title = MENU.find(m => m[0] === sub)[1];
  v.innerHTML = `<div class="apphead"><div class="row" style="gap:10px;align-items:center"><button class="iconbtn" id="bk" aria-label="Volver">${ic('back')}</button><div><h2>${title}</h2></div></div></div><div class="pad" id="mb"></div>`;
  $('#bk', v).onclick = () => { sub = null; drawMore(ctx); };
  PAGES[sub]($('#mb', v), ctx, () => drawMore(ctx));
}

const PAGES = {
  /* ---- Colecciones y préstamos ---- */
  colecciones(b, ctx, redraw) {
    const loans = S.books.filter(x => x.loan);
    b.innerHTML = `<div class="card"><h3>Colecciones</h3><div class="sub">Agrupan por tema o motivo, aparte de los pisos. Asigna libros desde su ficha.</div>
      ${S.meta.cols.map(c => `<div class="crow" data-id="${c.id}"><input value="${esc(c.n)}" data-n="${c.id}" aria-label="Nombre de la colección" maxlength="30"><span class="small">${S.books.filter(x => (x.cols || []).includes(c.id)).length} libros</span><button class="mbtn2" data-d="${c.id}" aria-label="Borrar colección">${ic('trash')}</button></div>`).join('') || '<div class="sub" style="margin-top:10px">Aún no tienes colecciones. Prueba con «Clásicos» o «Para regalar».</div>'}
      <form class="inl" id="nc"><input name="n" placeholder="Nueva colección" maxlength="30" aria-label="Nueva colección"><button class="btn" type="submit">Agregar</button></form></div>
     <div class="card"><h3>Prestados</h3>${loans.map(x => `<div class="loan"><div class="av">${esc((x.loan.to[0] || '?').toUpperCase())}</div><div style="min-width:0"><b>${esc(x.t)}</b><span class="small" style="display:block">Prestado a ${esc(x.loan.to)} · hace ${daysSince(x.loan.since) ?? 0} días</span></div><div class="acts"><button data-r="${x.id}">Recordar</button><button data-b="${x.id}">Ya volvió</button></div></div>`).join('') || '<div class="sub" style="margin-top:8px">Ningún libro prestado.</div>'}
      <form class="inl" id="nl" style="margin-top:12px"><select name="b" aria-label="Libro">${S.books.filter(x => !x.loan).map(x => `<option value="${x.id}">${esc(x.t)}</option>`).join('')}</select><input name="to" placeholder="¿A quién?" required maxlength="30" aria-label="Persona"><button class="btn" type="submit">Prestar</button></form></div>`;
    $('#nc', b).onsubmit = async e => { e.preventDefault(); const n = new FormData(e.target).get('n').trim(); if (!n) return; S.meta.cols.push({ id: newId(), n }); await saveMeta(); };
    $$('[data-n]', b).forEach(i => i.onchange = async () => { const c = S.meta.cols.find(x => x.id === i.dataset.n); c.n = i.value.trim() || c.n; await saveMeta(); });
    $$('[data-d]', b).forEach(x => x.onclick = async () => { const id = x.dataset.d; S.meta.cols = S.meta.cols.filter(c => c.id !== id); for (const k of S.books) if ((k.cols || []).includes(id)) { k.cols = k.cols.filter(c => c !== id); await saveBook(k); } if (S.ui.col === id) S.ui.col = null; await saveMeta(); });
    $('#nl', b)?.addEventListener('submit', async e => { e.preventDefault(); const d = new FormData(e.target), x = byId(+d.get('b')); if (!x) return; x.loan = { to: d.get('to').trim(), since: today() }; await saveBook(x); toast('Anotado'); });
    $$('[data-b]', b).forEach(x => x.onclick = async () => { const k = byId(+x.dataset.b); k.loan = null; await saveBook(k); toast('Qué bueno que volvió'); });
    $$('[data-r]', b).forEach(x => x.onclick = async () => { const k = byId(+x.dataset.r), msg = `Hola ${k.loan.to}, ¿cómo vas con «${k.t}»? Cuando lo termines me avisas para recuperarlo. ¡Gracias!`; try { await navigator.clipboard.writeText(msg); toast('Mensaje copiado, listo para enviar'); } catch { toast(msg); } });
  },
  /* ---- Lista de deseos ---- */
  deseos(b) {
    b.innerHTML = `<div class="card"><h3>Libros por conseguir</h3><div class="sub">Separados de tu estantería. Cuando llegan, pasan a «Por leer».</div>
      ${S.meta.wish.map(w => `<div class="wish" data-id="${w.id}"><div><b>${esc(w.t)}</b><span>${esc(w.a || '')}${w.note ? ' · ' + esc(w.note) : ''}</span></div><button data-p="${w.id}">Ya lo tengo</button><button class="x" data-d="${w.id}" aria-label="Quitar">${ic('x')}</button></div>`).join('') || '<div class="sub" style="margin-top:10px">Tu lista está vacía.</div>'}
      <form class="inl wrapf" id="nw"><input name="t" placeholder="Título" required aria-label="Título"><input name="a" placeholder="Autor" aria-label="Autor"><input name="n" placeholder="Nota o precio (opcional)" aria-label="Nota"><button class="btn" type="submit">Agregar</button></form></div>`;
    $('#nw', b).onsubmit = async e => { e.preventDefault(); const d = new FormData(e.target); S.meta.wish.push({ id: newId(), t: d.get('t').trim(), a: d.get('a').trim(), note: d.get('n').trim() }); await saveMeta(); };
    $$('[data-d]', b).forEach(x => x.onclick = async () => { S.meta.wish = S.meta.wish.filter(w => w.id !== x.dataset.d); await saveMeta(); });
    $$('[data-p]', b).forEach(x => x.onclick = async () => {
      const w = S.meta.wish.find(z => z.id === x.dataset.p); if (!w) return;
      await addBook({ t: w.t, a: w.a || 'Autor desconocido', p: 250, f: 'Papel', hasFile: false, ...fallbackColors(w.t) });
      S.meta.wish = S.meta.wish.filter(z => z.id !== w.id); await saveMeta(); toast('Agregado a «Por leer». Ajusta las páginas desde su ficha.');
    });
  },
  /* ---- Autores ---- */
  autores(b, ctx) {
    const m = new Map(); for (const k of S.books) { if (!m.has(k.a)) m.set(k.a, []); m.get(k.a).push(k); }
    const list = [...m.entries()].sort((x, y) => y[1].length - x[1].length || x[0].localeCompare(y[0]));
    b.innerHTML = list.length ? `<div class="alist">${list.map(([a, bs]) => `<div class="auth2"><button class="ah" data-a="${esc(a)}"><i style="background:${bs[0].c1 || '#555'}">${esc(a[0] || '?')}</i><span><b>${esc(a)}</b><small>${bs.length} ${bs.length === 1 ? 'libro' : 'libros'} · ${bs.filter(x => x.s === 'leido').length} leídos</small></span>${ic('chevron')}</button>
      <div class="ab" hidden>${bs.map(x => `<button class="arow" data-id="${x.id}"><span>${esc(x.t)}</span><span class="spill" style="--c:${ST[x.s].c}"><i></i>${ST[x.s].n}</span></button>`).join('')}</div></div>`).join('')}</div>` : '<div class="card"><div class="sub">Cuando agregues libros, verás aquí a sus autores.</div></div>';
    $$('.ah', b).forEach(x => x.onclick = () => { const p = x.nextElementSibling; p.hidden = !p.hidden; x.classList.toggle('open', !p.hidden); });
    $$('.arow', b).forEach(x => x.onclick = () => ctx.showBook(+x.dataset.id));
  },
  /* ---- Diario de lectura ---- */
  diario(b) {
    const days = new Map();
    for (const l of S.log) { if (!(l.pages > 0 || l.secs > 0)) continue; if (!days.has(l.date)) days.set(l.date, []); days.get(l.date).push(l); }
    for (const k of S.books) if (k.s === 'leido' && k.en) { if (!days.has(k.en)) days.set(k.en, []); days.get(k.en).push({ done: k }); }
    const keys = [...days.keys()].sort().reverse().slice(0, 60);
    b.innerHTML = keys.length ? `<div class="tl">${keys.map(d => `<div><b>${fd(d)}</b>${days.get(d).map(e => e.done ? `<small>Terminaste «${esc(e.done.t)}»</small>` : `<small>${esc(byId(e.bookId)?.t || 'Libro')} · ${e.pages ? e.pages + ' págs.' : ''}${e.pages && e.secs ? ' · ' : ''}${e.secs ? fmtDur(e.secs / 60) : ''}</small>`).join('')}</div>`).join('')}</div>` : '<div class="card"><div class="sub">Aquí aparecerá lo que leas, día por día.</div></div>';
  },
  /* ---- Compartir estante ---- */
  compartir(b) {
    b.innerHTML = `<div class="card"><h3>Tu estante como imagen</h3><div class="sub">Se dibuja en tu dispositivo con tus lomos reales. Nadie ve el resto de tu biblioteca.</div>
      <div class="seg2" id="cs" style="margin:12px 0">${[['leido', 'Libros leídos'], ['leyendo', 'Leyendo'], ['todos', 'Todos']].map(([k, n], i) => `<button data-k="${k}" aria-pressed="${i === 0}">${n}</button>`).join('')}</div>
      <button class="btn" id="cg">${ic('image')}Crear imagen</button></div>`;
    let k = 'leido';
    $$('#cs button', b).forEach(x => x.onclick = () => { k = x.dataset.k; $$('#cs button', b).forEach(y => y.setAttribute('aria-pressed', y === x)); });
    $('#cg', b).onclick = async () => {
      const list = S.books.filter(x => k === 'todos' || x.s === k).slice(0, 40);
      if (!list.length) return toast('No hay libros para mostrar');
      toast('Preparando la imagen…');
      await shareImage(await imgShelf(list, 'Mi estante ' + new Date().getFullYear(), `${list.length} libros`), 'mi-estante.png', 'Mi estante');
    };
  },
  /* ---- Importar ---- */
  importar(b) {
    b.innerHTML = `<div class="grid2"><div class="card"><h3>Archivo EPUB</h3><div class="sub">La app toma el título, el autor, la portada y la sinopsis, y lo puedes leer aquí.</div><button class="btn" id="i1" style="margin-top:12px">Elegir EPUB</button></div>
      <div class="card"><h3>Libro de papel (ISBN)</h3><div class="sub">Escanea el código de barras con la cámara o escribe el número. Los datos vienen de Open Library, gratis.</div><button class="btn" id="i2" style="margin-top:12px">${ic('camera')}Escanear ISBN</button></div>
      <div class="card"><h3>Lista de otra app (CSV)</h3><div class="sub">Por ejemplo, la exportación de Goodreads. Se omiten los libros que ya tienes.</div><button class="btn" id="i3" style="margin-top:12px">Elegir archivo CSV</button><input id="csvf" type="file" accept=".csv,text/csv" hidden></div>
      <div class="card"><h3>Agregar a mano</h3><div class="sub">Para audiolibros u otros formatos sin archivo.</div><button class="btn ghost" id="i4" style="margin-top:12px">Libro nuevo</button></div></div>`;
    $('#i1', b).onclick = () => openAdd(); $('#i2', b).onclick = () => openAdd('isbn'); $('#i4', b).onclick = () => openAdd('manual');
    $('#i3', b).onclick = () => $('#csvf', b).click();
    $('#csvf', b).onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const { items, dup } = await readCSV(f);
        const o = openSheet(`<h3>Importar lista</h3><div class="sub">${esc(f.name)}</div><div class="card" style="margin:12px 0"><b>${items.length} libros nuevos</b><div class="sub">${dup.length} ya estaban en tu biblioteca y se omiten.</div>
          <div class="sub" style="margin-top:8px">${items.slice(0, 5).map(i => esc(i.t)).join(' · ')}${items.length > 5 ? '…' : ''}</div></div><div class="row"><button class="btn" id="ok" ${items.length ? '' : 'disabled'}>Agregar ${items.length}</button><button class="btn ghost" data-x>Cancelar</button></div>`);
        $('#ok', o).onclick = async () => { $('#ok', o).textContent = 'Agregando…'; await addImported(items); closeSheet(); toast(`${items.length} libros agregados`); };
      } catch (err) { toast(err.message || 'No se pudo leer el archivo'); }
    };
  },
  /* ---- Apariencia ---- */
  apariencia(b, ctx, redraw) {
    b.innerHTML = `<div class="swatches">${THEMES.map(([k, n, s, c]) => `<button data-t="${k}" aria-pressed="${P.theme === k}"><i style="background:${c}"></i>${n}<small>${s}</small></button>`).join('')}</div>
      <div class="card"><h3>Tamaño del texto</h3><div class="sub">Afecta a toda la app, no solo al lector.</div><div class="ctl2"><span>A</span><input id="ts" type="range" min="85" max="135" step="5" value="${P.textScale}" aria-label="Tamaño del texto"><span style="font-size:1.4em">A</span><output id="tso">${P.textScale} %</output></div>
      <p class="prev">Así se ve un texto de ejemplo: «En un lugar de la Mancha, de cuyo nombre no quiero acordarme».</p></div>`;
    $$('.swatches button', b).forEach(x => x.onclick = () => { setPref('theme', x.dataset.t); redraw(); });
    $('#ts', b).oninput = e => { setPref('textScale', +e.target.value); $('#tso').textContent = e.target.value + ' %'; };
  },
  /* ---- Recordatorio ---- */
  recordatorio(b, ctx, redraw) {
    const r = P.reminder;
    b.innerHTML = `<div class="card"><div class="tg"><button class="sw" id="rsw" role="switch" aria-checked="${r.on}" aria-label="Recordatorio diario"></button><div><b>Recordatorio diario</b><div class="sub">Solo si ese día aún no leíste.</div></div></div>
      <label class="tl2">Hora<input type="time" id="rt" value="${r.time}"></label>
      <div class="note">Sin servidor, el aviso aparece mientras la app está abierta y, si ya pasó la hora, como un recordatorio en «Hoy». Para recibir notificaciones del sistema, acepta el permiso cuando el navegador lo pida.</div></div>`;
    $('#rsw', b).onclick = async () => {
      const on = !P.reminder.on; setPref('reminder', { ...P.reminder, on });
      if (on && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch { } }
      checkReminder(ctx); redraw();
    };
    $('#rt', b).onchange = e => { setPref('reminder', { ...P.reminder, time: e.target.value || '21:30' }); checkReminder(ctx); };
  },
  /* ---- Sincronización y copia ---- */
  sync(b, ctx, redraw) {
    const s = syncState(), cls = !isEnabled() ? 'inf' : !navigator.onLine ? 'warnn' : s === 'auth' || s === 'error' ? 'bad' : s === 'syncing' ? 'inf' : 'okk';
    b.innerHTML = `<div class="sc ${cls}"><div class="ico">${ic('cloud')}</div><div><b>${syncLabel()}</b><span>${isEnabled() ? (lastSync() ? `Última sincronización: ${new Date(lastSync()).toLocaleString('es-CL')}` : 'Aún no se ha sincronizado.') : 'Conecta tu cuenta de Google para ver tu biblioteca en el PC y en el teléfono.'}</span>${s === 'syncing' ? '<div class="mp"><i></i></div>' : ''}</div></div>
      <div class="row" style="margin:12px 0 18px"><button class="btn" id="sy">${isEnabled() ? 'Sincronizar ahora' : 'Conectar con Google'}</button></div>
      <div class="card"><h3>Copia de seguridad</h3><div class="sub">Libros, fechas, páginas, frases, pisos y colecciones. Los EPUB se quedan en tu Drive.</div>
      <div class="row" style="margin-top:12px"><button class="btn ghost" id="ej">${ic('download')}Exportar copia (.json)</button><button class="btn ghost" id="ij">${ic('upload')}Importar copia</button><button class="btn ghost" id="ec">${ic('download')}Exportar lista (.csv)</button><input id="jf" type="file" accept=".json,application/json" hidden></div></div>`;
    $('#sy', b).onclick = openSync; $('#ej', b).onclick = exportJSON; $('#ec', b).onclick = exportCSV; $('#ij', b).onclick = () => $('#jf', b).click();
    $('#jf', b).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const r = await importJSON(f); toast(`Copia importada: ${r.books} libros y ${r.notes} frases nuevas`); } catch (err) { toast(err.message || 'No se pudo importar'); } };
  },
  /* ---- Atajos y accesibilidad ---- */
  atajos(b) {
    const K = [['/', 'o Ctrl K', 'Buscar libros, frases y acciones'], ['G', 'luego H, B, F, C o M', 'Ir a Hoy, Biblioteca, Frases, Cifras o Más'], ['N', '', 'Agregar un libro'], ['T', '', 'Cambiar de tema de sala'], ['Enter', '', 'Abrir el libro seleccionado'], ['E', '', 'Editar la ficha del libro seleccionado'], ['← →', '', 'Pasar de página en el lector'], ['H', '', 'Subrayar lo seleccionado en el lector'], ['Esc', '', 'Cerrar o guardar el libro']];
    b.innerHTML = `<div class="keys">${K.map(([k, a, t]) => `<div><kbd>${k}</kbd><span>${a ? `<small>${a}</small><br>` : ''}${t}</span></div>`).join('')}</div>
     <div class="grid3b"><div class="card"><h3>Texto ajustable</h3><div class="sub">En «Apariencia y texto» puedes agrandar toda la letra de la app.</div></div><div class="card"><h3>Contraste y foco</h3><div class="sub">El tema «Alto contraste» y un borde de foco visible al navegar con teclado.</div></div><div class="card"><h3>Menos movimiento</h3><div class="sub">Si tu dispositivo pide reducir el movimiento, las animaciones se vuelven instantáneas.</div></div></div>`;
  },
  /* ---- Recomendaciones con IA ---- */
  ia(b) {
    const done = S.books.filter(x => x.s === 'leido').map(x => `${x.t} (${x.a})`), ing = S.books.filter(x => x.s === 'leyendo').map(x => `${x.t} (${x.a})`), drop = S.books.filter(x => x.s === 'abandonado').map(x => `${x.t} (${x.a})`);
    const txt = `Recomiéndame 5 libros para leer a continuación, en español neutro, con una frase que explique por qué me gustaría cada uno.\n\nLibros que he leído: ${done.join('; ') || 'ninguno aún'}.\nLibros que estoy leyendo: ${ing.join('; ') || 'ninguno'}.\nLibros que abandoné (evita algo parecido): ${drop.join('; ') || 'ninguno'}.\nNo repitas los que ya tengo.`;
    b.innerHTML = `<div class="card"><h3>Para tu próxima lectura</h3><div class="sub">La app arma la pregunta con lo que marcaste como leído, en lectura y abandonado. Cópiala y pégala en la IA que prefieras.</div><textarea class="ask" id="ask" readonly aria-label="Pregunta para la IA">${esc(txt)}</textarea>
      <div class="row" style="margin-top:10px"><button class="btn" id="cp">${ic('copy')}Copiar pregunta</button><a class="btn ghost" href="https://www.perplexity.ai/" target="_blank" rel="noopener">Abrir Perplexity</a></div></div>`;
    $('#cp', b).onclick = async () => { try { await navigator.clipboard.writeText(txt); toast('Pregunta copiada'); } catch { $('#ask', b).select(); toast('Selecciónala y cópiala'); } };
  },
  ayuda(b) {
    b.innerHTML = `<div class="card"><h3>Primeros pasos</h3><ol class="help"><li>Agrega un libro desde <b>Biblioteca</b>: un EPUB, el ISBN de uno de papel, o una lista CSV.</li><li>Toca un lomo para sacarlo del estante. Mantén presionado para arrastrarlo a otro lugar o piso.</li><li>Abre un EPUB y selecciona un texto: elige un color para subrayarlo y guardar la frase.</li><li>En <b>Hoy</b> verás tu meta, tu racha y el libro que sigues.</li><li>En <b>Más → Sincronización</b> conecta Google para ver todo igual en el PC y en el teléfono.</li></ol></div>`;
  },
};
