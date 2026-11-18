import { S, ST, byId, saveBook, saveMeta, newId, addBook, today, fd, coverUrl } from './state.js';
import { P, setPref, THEMES, ACENTOS, MADERAS, LOMOS, FUENTES } from './prefs.js';
import { $, $$, esc, ic, toast, openSheet, closeSheet } from './ui.js';
import { openSync, openAdd } from './sheets.js';
import { syncLabel, syncState, isEnabled, lastSync, lastBackup } from './sync.js';
import { porDispositivo, hace, nombreDispositivo, cambiarNombre } from './dispositivo.js';
import { verPapelera, recuperar, borrarDePapelera, DIAS_PAPELERA } from './state.js';
import { exportJSON, importJSON, exportCSV, readCSV, addImported, exportCifrado } from './backup.js';
import { abrirImportClippings } from './clippings.js';
import { abrirCatalogo, disponible as hayCatalogo } from './catalogo.js';
import { smart, miembros, IDEAS, editarSmart } from './smart.js';
import { planes, calculo, fijarPlan, calendario } from './plan.js';
import { inventario, mb, sePuedeQuitar, quitarLocal, bajar, sinAbrir } from './espacio.js';
import { construirPagina, guardarPagina } from './webshelf.js';
import { abrirFoco, sesiones as sesionesFoco } from './foco.js';
import { elegirLibro as elegirPersonajes } from './personajes.js';
import { pendientes as sinIndice, indexar, buscarTexto } from './indice.js';
import { lista as listaPerfiles, perfilActivo, nombreActivo, crear as crearPerfil, cambiar as cambiarPerfil, borrar as borrarPerfil } from './perfiles.js';
import { RETOS, retosActivos, cfgReto, fijarReto, fijarCfg, LOGROS } from './retos.js';
import { palabras, repasarGlosario, quitarPalabra, pendientes as glPend } from './glosario.js';
import { hayPin, fijarPin, quitarPin, verificarPin, pedirPin, minutosAuto, fijarAuto as fijarAutoPin, bioActiva, fijarBio, verOcultos } from './bloqueo.js';
import { fmtDur, daysSince } from './metrics.js';
import { fallbackColors } from './color.js';
import { checkReminder, syncNativeReminder } from './reminder.js';
import { esApp } from './native.js';
import { buscarActualizacion, ofrecerInstalar, versionActual, autoActivo, fijarAuto } from './actualizar.js';
import { imgShelf, shareImage } from './share.js';
import { sobrantes, quitarRepetidos } from './importar.js';
import { MENU5, PAGES5 } from './tanda5.js';
import { MENU7, PAGES7 } from './tanda7.js';
import { MENU9, PAGES9 } from './tanda9.js';

import { HOY_CARDS } from './hoy.js';
let sub = null;
export const openMore = p => { sub = p; };
export const paginasMas = () => MENU.filter(m => m[0] !== 'cifras').map(m => [m[0], m[1]]);

const MENU = [
  MENU5[0],
  ['cifras', 'Cifras', () => 'Tu lectura en números y el año en libros', 'chart'],
  ['colecciones', 'Colecciones y préstamos', () => `${S.meta.cols.length} colecciones · ${S.books.filter(b => b.loan).length} prestados`, 'tag'],
  ['deseos', 'Lista de deseos', () => `${S.meta.wish.length} libros por conseguir`, 'heart'],
  ['autores', 'Autores', () => `${new Set(S.books.map(b => b.a)).size} autores`, 'users'],
  ['diario', 'Diario de lectura', () => 'Lo que leíste, día por día', 'clock'],
  ['compartir', 'Compartir mi estante', () => 'Una imagen, no un enlace', 'image'],
  ...(hayCatalogo() ? [['catalogo', 'Clásicos gratis', () => 'Libros de dominio público en un toque', 'book']] : []),
  ['buscar', 'Buscar en mis libros', () => 'Texto completo, frases, notas y glosario', 'search'],
  ['smart', 'Colecciones inteligentes', () => `${smart().length} con reglas que se actualizan solas`, 'tag'],
  ['plan', 'Plan de lectura', () => { const n = planes().length; return n ? `${n} con fecha` : 'Terminar un libro para una fecha'; }, 'clock'],
  ['foco', 'Sesiones de foco', () => `${sesionesFoco().length} sesiones hechas`, 'clock'],
  ['espacio', 'Almacenamiento', () => 'Espacio, libros en Drive y para viaje', 'download'],
  ['personajes', 'Personajes', () => 'Cuaderno de personajes de cada libro', 'users'],
  ['webshelf', 'Mi estantería como página web', () => 'Un archivo para compartir', 'image'],
  ['perfiles', 'Perfiles', () => `Ahora: ${nombreActivo()}`, 'users'],
  ['retos', 'Retos y logros', () => { const g = Object.keys(S.meta.logros || {}).length; return `${retosActivos().length} retos activos · ${g} de ${LOGROS.length} logros`; }, 'star'],
  ['glosario', 'Glosario', () => `${palabras().length} palabras guardadas`, 'info'],
  ['privacidad', 'Privacidad y bloqueo', () => hayPin() ? 'Bloqueo con PIN activado' : 'PIN, libros ocultos y copia cifrada', 'keyboard'],
  ['papelera', 'Papelera', () => 'Libros quitados, 30 días para recuperarlos', 'trash'],
  ['portadas', 'Completar portadas', () => { try { const n = S.books.filter(b => !b.cover).length; return n ? `${n} libros sin portada` : 'Todos tienen portada'; } catch { return ''; } }, 'image'],
  ['repetidos', 'Libros repetidos', () => { const n = sobrantes().length; return n ? `${n} repetidos por quitar` : 'No hay repetidos'; }, 'tag'],
  ['importar', 'Importar y agregar libros', () => 'EPUB, ISBN o lista CSV', 'upload'],
  ['apariencia', 'Apariencia y texto', () => THEMES.find(t => t[0] === P.theme)?.[1] + ' · letra ' + P.textScale + ' %', 'palette'],
  ['recordatorio', 'Recordatorio', () => P.reminder.on ? `Cada día a las ${P.reminder.time}` : 'Apagado', 'bell'],
  ['sync', 'Sincronización y copia', () => syncLabel(), 'cloud'],
  ['atajos', 'Atajos y accesibilidad', () => 'Teclado, contraste, texto', 'keyboard'],
  ['ia', 'Recomendaciones con IA', () => 'Pregunta lista para copiar', 'spark'],
  ['ayuda', 'Ayuda', () => 'Primeros pasos', 'info'],
  ...(esApp ? [['vozneuronal', 'Voz neuronal', () => 'Voces sin conexión, más naturales', 'phones']] : []),
  ...MENU5.slice(1),
  ...MENU7,
  ...MENU9,
  ['diagnostico', 'Diagnóstico', () => { try { const n = JSON.parse(localStorage.getItem('bv-errs') || '[]').length; return n ? `${n} errores registrados` : 'Sin errores registrados'; } catch { return ''; } }, 'info'],
  ...(esApp ? [['version', 'Actualizaciones', () => 'Versión ' + (versionActual()?.name || ''), 'download']] : []),
];

const favoritos = () => { try { return JSON.parse(localStorage.getItem('bv-fav') || '[]'); } catch { return []; } };
const GRUPOS = [
  ['Leer', '#62B7AB', ['quehoy', 'foco', 'plan', 'racha', 'avisos', 'retos', 'bingo', 'glosario', 'personajes', 'buscar', 'traducir', 'notasvoz', 'asistente', 'vozneuronal', 'recordatorio']],
  ['Mi biblioteca', '#E4B861', ['colecciones', 'smart', 'deseos', 'autores', 'diario', 'importar', 'estanteria', 'catalogo', 'opds', 'datos', 'linea', 'portadas', 'repetidos', 'espacio', 'viaje', 'papelera']],
  ['Datos y compartir', '#C9809A', ['cifras', 'ritmo', 'temas', 'compartir', 'webshelf', 'qr', 'fondos', 'respaldo2']],
  ['Cuenta y copias', '#8FA8F0', ['sync', 'privacidad', 'perfiles']],
  ['La app', '#B48AE0', ['primeros', 'novedades', 'apariencia', 'atajos', 'ia', 'ayuda', 'diagnostico', 'version']],
];
export function drawMore(ctx) {
  const v = $('#v-more');
  if (!sub) {
    const norma = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let q = '';
    const pinta = () => {
      const favs = favoritos(), fila = ([k, n, sf, i]) => `<div class="mlw"><button class="ml" data-k="${k}"><span class="mi">${ic(i)}</span><span class="mt"><b>${n}</b><small>${sf()}</small></span></button><button class="mstar" data-s="${k}" aria-pressed="${favs.includes(k)}" aria-label="${favs.includes(k) ? 'Quitar de favoritos' : 'Fijar en favoritos'}">${ic('star')}</button></div>`;
      const ok = m => !q || norma(m[1] + ' ' + m[2]()).includes(norma(q));
      let h = '';
      if (!q && favs.length) h += `<div class="grp5">Favoritos</div><div class="mlist">${favs.map(k => MENU.find(m => m[0] === k)).filter(Boolean).map(fila).join('')}</div>`;
      for (const [gn, color, claves] of GRUPOS) {
        const items = claves.map(k => MENU.find(m => m[0] === k)).filter(m => m && ok(m));
        if (items.length) h += `<div class="grp5" style="--g:${color}">${gn}</div><div class="mlist" style="--g:${color}">${items.map(fila).join('')}</div>`;
      }
      const sueltos = MENU.filter(m => !GRUPOS.some(g => g[2].includes(m[0])) && ok(m));
      if (sueltos.length) h += `<div class="grp5">Otros</div><div class="mlist">${sueltos.map(fila).join('')}</div>`;
      $('#mgl', v).innerHTML = h || '<div class="sub" style="text-align:center;padding:24px 0">No encontré esa página.</div>';
      $$('.ml', v).forEach(b => b.onclick = () => { if (b.dataset.k === 'cifras') return ctx.go('stats'); sub = b.dataset.k; drawMore(ctx); v.scrollTop = 0; });
      $$('.mstar', v).forEach(b => b.onclick = () => { const f = favoritos(), k = b.dataset.s, i = f.indexOf(k); if (i >= 0) f.splice(i, 1); else f.unshift(k); try { localStorage.setItem('bv-fav', JSON.stringify(f.slice(0, 5))); } catch { } pinta(); });
    };
    v.innerHTML = `<div class="apphead"><div><h2>Más</h2><div class="sub">Colecciones, ajustes y herramientas</div></div></div><div class="pad"><label class="msearch">${ic('search')}<input id="mq" type="search" placeholder="Buscar una página…" aria-label="Buscar una página de Más" autocomplete="off"></label><div id="mgl"></div></div>`;
    $('#mq', v).oninput = e => { q = e.target.value.trim(); pinta(); };
    pinta();
    return;
  }
  const title = MENU.find(m => m[0] === sub)[1];
  v.innerHTML = `<div class="apphead"><div class="row" style="gap:10px;align-items:center"><button class="iconbtn" id="bk" aria-label="Volver">${ic('back')}</button><div><h2>${title}</h2></div></div></div><div class="pad" id="mb"></div>`;
  $('#bk', v).onclick = () => { sub = null; drawMore(ctx); };
  PAGES[sub]($('#mb', v), ctx, () => drawMore(ctx), k => { sub = k; drawMore(ctx); v.scrollTop = 0; });
}

const PAGES = {
  ...PAGES5,
  ...PAGES7,
  ...PAGES9,
  /* ---- Colecciones y préstamos ---- */
  colecciones(b, ctx, redraw) {
    const loans = S.books.filter(x => x.loan);
    b.innerHTML = `<div class="card"><h3>Colecciones</h3><div class="sub">Agrupan por tema o motivo, aparte de los pisos. Asigna libros desde su ficha.</div>
      ${S.meta.cols.map(c => `<div class="crow" data-id="${c.id}"><input value="${esc(c.n)}" data-n="${c.id}" aria-label="Nombre de la colección" maxlength="30"><span class="small">${S.books.filter(x => (x.cols || []).includes(c.id)).length} libros</span><button class="mbtn2" data-d="${c.id}" aria-label="Borrar colección">${ic('trash')}</button></div>`).join('') || '<div class="sub" style="margin-top:10px">Aún no tienes colecciones. Prueba con «Clásicos» o «Para regalar».</div>'}
      <form class="inl" id="nc"><input name="n" placeholder="Nueva colección" maxlength="30" aria-label="Nueva colección"><button class="btn" type="submit">Agregar</button></form></div>
     <div class="card"><h3>Prestados</h3>${loans.map(x => `<div class="loan"><div class="av">${esc((x.loan.to[0] || '?').toUpperCase())}</div><div style="min-width:0"><b>${esc(x.t)}</b><span class="small" style="display:block">Prestado a ${esc(x.loan.to)} · hace ${daysSince(x.loan.since) ?? 0} días${x.loan.due ? ` · devolver el ${new Date(x.loan.due + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}` : ''}</span></div><div class="acts"><button data-r="${x.id}">Recordar</button><button data-b="${x.id}">Ya volvió</button></div></div>`).join('') || '<div class="sub" style="margin-top:8px">Ningún libro prestado.</div>'}
      <form class="inl" id="nl" style="margin-top:12px"><select name="b" aria-label="Libro">${S.books.filter(x => !x.loan).map(x => `<option value="${x.id}">${esc(x.t)}</option>`).join('')}</select><input name="to" placeholder="¿A quién?" required maxlength="30" aria-label="Persona"><input name="due" type="date" aria-label="Devolver el" title="Devolver el (opcional)"><button class="btn" type="submit">Prestar</button></form></div>`;
    $('#nc', b).onsubmit = async e => { e.preventDefault(); const n = new FormData(e.target).get('n').trim(); if (!n) return; S.meta.cols.push({ id: newId(), n }); await saveMeta(); };
    $$('[data-n]', b).forEach(i => i.onchange = async () => { const c = S.meta.cols.find(x => x.id === i.dataset.n); c.n = i.value.trim() || c.n; await saveMeta(); });
    $$('[data-d]', b).forEach(x => x.onclick = async () => { const id = x.dataset.d; S.meta.cols = S.meta.cols.filter(c => c.id !== id); for (const k of S.books) if ((k.cols || []).includes(id)) { k.cols = k.cols.filter(c => c !== id); await saveBook(k); } if (S.ui.col === id) S.ui.col = null; await saveMeta(); });
    $('#nl', b)?.addEventListener('submit', async e => { e.preventDefault(); const d = new FormData(e.target), x = byId(+d.get('b')); if (!x) return; x.loan = { to: d.get('to').trim(), since: today(), ...(d.get('due') ? { due: d.get('due') } : {}) }; await saveBook(x); toast('Anotado'); });
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
      <div class="card"><h3>Subrayados de Kindle</h3><div class="sub">El archivo «My Clippings.txt» de tu Kindle: se asignan a tus libros y se agregan como frases.</div><button class="btn" id="i5" style="margin-top:12px">Elegir archivo</button></div>
      <div class="card"><h3>Agregar a mano</h3><div class="sub">Para audiolibros u otros formatos sin archivo.</div><button class="btn ghost" id="i4" style="margin-top:12px">Libro nuevo</button></div></div>`;
    $('#i1', b).onclick = () => openAdd(); $('#i2', b).onclick = () => openAdd('isbn'); $('#i4', b).onclick = () => openAdd('manual');
    $('#i3', b).onclick = () => $('#csvf', b).click();
    $('#i5', b).onclick = () => abrirImportClippings();
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
      <p class="prev">Así se ve un texto de ejemplo: «En un lugar de la Mancha, de cuyo nombre no quiero acordarme».</p></div>
      <div class="card"><h3>Color de acento</h3><div class="sub">Botones, pestañas y detalles.</div><div class="dotrow" id="d-acc">${ACENTOS.map(([c, n]) => c ? `<button data-c="${c}" style="background:${c}" aria-label="${n}" aria-pressed="${P.accent === c}"></button>` : `<button class="t" data-c="" aria-pressed="${!P.accent}">${n}</button>`).join('')}</div></div>
      <div class="card"><h3>Madera de la estantería</h3><div class="dotrow" id="d-wood">${MADERAS.map(([k, n, c]) => `<button class="t" data-w="${k || ''}" aria-pressed="${(P.wood || null) === k}">${c ? `<i style="display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;background:${c[0]};vertical-align:-1px"></i>` : ''}${n}</button>`).join('')}</div></div>
      <div class="card"><h3>Estilo de los lomos</h3><div class="dotrow" id="d-spine">${LOMOS.map(([k, n]) => `<button class="t" data-s="${k}" aria-pressed="${P.spine === k}">${n}</button>`).join('')}</div></div>
      <div class="card"><h3>Letra de los títulos</h3><div class="dotrow" id="d-font">${FUENTES.map(([k, n, f]) => `<button class="t" data-f="${k}" style="font-family:${f}" aria-pressed="${P.titleFont === k}">${n}</button>`).join('')}</div></div>
      <div class="card"><h3>Lámpara de la sala</h3><div class="sub">Una luz cálida sobre la estantería. En automático se enciende de noche.</div><div class="dotrow" id="d-lamp"><button class="t" data-l="auto" aria-pressed="${(P.lampara || 'auto') === 'auto'}">Automática</button><button class="t" data-l="si" aria-pressed="${P.lampara === 'si'}">Encendida</button><button class="t" data-l="no" aria-pressed="${P.lampara === 'no'}">Apagada</button></div></div>
      <div class="card"><h3>Densidad</h3><div class="dotrow" id="d-dens"><button class="t" data-d="comoda" aria-pressed="${P.dens !== 'compacta'}">Cómoda</button><button class="t" data-d="compacta" aria-pressed="${P.dens === 'compacta'}">Compacta</button></div></div>
      <div class="card"><h3>Detalles de diseño</h3>
        <label class="chk2" style="margin-top:10px"><input type="checkbox" id="ap-col" ${P.colorLibro !== false ? 'checked' : ''}> El color del libro tiñe la pantalla Hoy y el lector</label>
        <label class="chk2"><input type="checkbox" id="ap-rec" ${P.rectas ? 'checked' : ''}> Esquinas más rectas</label>
        <label class="chk2"><input type="checkbox" id="ap-cal" ${P.calma ? 'checked' : ''}> Reducir el movimiento y las animaciones</label></div>
      <div class="card"><h3>Pantalla Hoy</h3><div class="sub">Cambia el orden de las tarjetas o escóndelas.</div><div class="hoyord" id="d-hoy"></div></div>`;
    $('#ap-col', b).onchange = e => { setPref('colorLibro', e.target.checked); redraw(); };
    $('#ap-rec', b).onchange = e => { setPref('rectas', e.target.checked); redraw(); };
    $('#ap-cal', b).onchange = e => { setPref('calma', e.target.checked); redraw(); };
    const grp = (id, fn) => $(id, b).addEventListener('click', e => { const x = e.target.closest('button'); if (!x) return; fn(x); redraw(); });
    grp('#d-acc', x => setPref('accent', x.dataset.c || null));
    grp('#d-wood', x => setPref('wood', x.dataset.w || null));
    grp('#d-spine', x => setPref('spine', x.dataset.s));
    grp('#d-font', x => setPref('titleFont', x.dataset.f));
    grp('#d-lamp', x => setPref('lampara', x.dataset.l));
    grp('#d-dens', x => setPref('dens', x.dataset.d));
    const ord = () => { const o = [...(P.hoyOrder || [])]; HOY_CARDS.forEach(([k]) => { if (!o.includes(k)) o.push(k); }); return o.filter(k => HOY_CARDS.some(c => c[0] === k)); };
    const dibujaHoy = () => {
      const o = ord(), hide = P.hoyHide || [];
      $('#d-hoy', b).innerHTML = o.map((k, i) => `<div class="it ${hide.includes(k) ? 'off' : ''}"><b>${HOY_CARDS.find(c => c[0] === k)[1]}</b><button data-u="${i}" aria-label="Subir">↑</button><button data-dn="${i}" aria-label="Bajar">↓</button><button data-h="${k}" aria-label="${hide.includes(k) ? 'Mostrar' : 'Esconder'}">${hide.includes(k) ? '◌' : '●'}</button></div>`).join('');
    };
    dibujaHoy();
    $('#d-hoy', b).addEventListener('click', e => {
      const x = e.target.closest('button'); if (!x) return; const o = ord();
      if (x.dataset.u != null && +x.dataset.u > 0) { const i = +x.dataset.u; [o[i - 1], o[i]] = [o[i], o[i - 1]]; setPref('hoyOrder', o); }
      else if (x.dataset.dn != null && +x.dataset.dn < o.length - 1) { const i = +x.dataset.dn; [o[i + 1], o[i]] = [o[i], o[i + 1]]; setPref('hoyOrder', o); }
      else if (x.dataset.h) { const h = new Set(P.hoyHide || []); h.has(x.dataset.h) ? h.delete(x.dataset.h) : h.add(x.dataset.h); setPref('hoyHide', [...h]); }
      dibujaHoy();
    });
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
      checkReminder(ctx); syncNativeReminder(); redraw();
    };
    $('#rt', b).onchange = e => { setPref('reminder', { ...P.reminder, time: e.target.value || '21:30' }); checkReminder(ctx); syncNativeReminder(); };
  },
  /* ---- Sincronización y copia ---- */
  sync(b, ctx, redraw) {
    const s = syncState(), cls = !isEnabled() ? 'inf' : !navigator.onLine ? 'warnn' : s === 'auth' || s === 'error' ? 'bad' : s === 'syncing' ? 'inf' : 'okk';
    b.innerHTML = `<div class="sc ${cls}"><div class="ico">${ic('cloud')}</div><div><b>${syncLabel()}</b><span>${isEnabled() ? (lastSync() ? `Última sincronización: ${new Date(lastSync()).toLocaleString('es-CL')}` : 'Aún no se ha sincronizado.') : 'Conecta tu cuenta de Google para ver tu biblioteca en el PC y en el teléfono.'}</span>${s === 'syncing' ? '<div class="mp"><i></i></div>' : ''}</div></div>
      <div class="row" style="margin:12px 0 18px"><button class="btn" id="sy">${isEnabled() ? 'Sincronizar ahora' : 'Conectar con Google'}</button></div>
      ${isEnabled() ? `<div class="card"><h3>Estado</h3><div class="syn2"><div><i class="pt"></i><b>${s === 'ok' || s === 'idle' ? 'Al día' : syncLabel()}</b>${lastSync() ? ` · ${hace(lastSync())}` : ''}</div>
        <div class="mut"><i class="pt"></i>${S.books.length} libros · ${S.notes.length} frases</div>
        ${porDispositivo().slice(0, 3).map(d => `<div class="mut"><i class="pt w"></i>${esc(d.n)}: leyendo «${esc(d.libro.slice(0, 28))}» ${hace(d.t)}</div>`).join('')}
        <div class="mut"><i class="pt"></i>Copia automática: ${lastBackup() ? new Date(lastBackup()).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' }) : 'se hace con la próxima sincronización'}</div></div>
        <label style="display:grid;gap:4px;margin-top:12px;font-size:13px">Nombre de este dispositivo<input id="dvn" value="${esc(nombreDispositivo())}" maxlength="20"></label></div>` : ''}
      <div class="card"><h3>Copia de seguridad</h3><div class="sub">Libros, fechas, páginas, frases, pisos y colecciones. Los EPUB se quedan en tu Drive.</div>
      <div class="row" style="margin-top:12px"><button class="btn ghost" id="ej">${ic('download')}Exportar copia (.json)</button><button class="btn ghost" id="ij">${ic('upload')}Importar copia</button><button class="btn ghost" id="ec">${ic('download')}Exportar lista (.csv)</button><button class="btn ghost" id="ecf">${ic('download')}Copia con contraseña</button><input id="jf" type="file" accept=".json,application/json" hidden></div></div>`;
    $('#dvn', b)?.addEventListener('change', e => { cambiarNombre(e.target.value); toast('Nombre guardado'); });
    $('#sy', b).onclick = openSync; $('#ej', b).onclick = exportJSON; $('#ec', b).onclick = exportCSV; $('#ij', b).onclick = () => $('#jf', b).click();
    $('#ecf', b).onclick = () => {
      const o = openSheet(`<h3>Copia con contraseña</h3><div class="sub">Se guarda un archivo que solo se abre con esta contraseña. Si la olvidas, no hay forma de recuperarlo.</div><form class="form" id="cf" style="margin-top:12px"><label>Contraseña<input name="p" type="password" required minlength="6" autocomplete="new-password"></label><label>Repítela<input name="q" type="password" required minlength="6" autocomplete="new-password"></label><button class="btn" type="submit">Guardar copia</button></form>`);
      $('#cf', o).onsubmit = async e => { e.preventDefault(); const d = new FormData(e.target); if (d.get('p') !== d.get('q')) return toast('Las contraseñas no coinciden'); await exportCifrado(d.get('p')); closeSheet(); toast('Copia con contraseña lista'); };
    };
    const importa = async (f, pass) => {
      try { const r = await importJSON(f, pass); toast(`Copia importada: ${r.books} libros y ${r.notes} frases nuevas`); }
      catch (err) {
        if (err.message === 'NECESITA_CLAVE') { const o = openSheet(`<h3>Copia con contraseña</h3><form class="form" id="cp2"><label>Contraseña<input name="p" type="password" required autocomplete="current-password"></label><button class="btn" type="submit">Abrir copia</button></form>`); $('#cp2', o).onsubmit = ev => { ev.preventDefault(); const p = new FormData(ev.target).get('p'); closeSheet(); importa(f, p); }; }
        else toast(err.message || 'No se pudo importar');
      }
    };
    $('#jf', b).onchange = async e => { const f = e.target.files[0]; if (!f) return; importa(f); };
  },
  /* ---- Atajos y accesibilidad ---- */
  atajos(b) {
    const K = [['/', 'o Ctrl K', 'Buscar libros, frases y acciones'], ['G', 'luego H, B, F, C o M', 'Ir a Hoy, Biblioteca, Frases, Cifras o Más'], ['N', '', 'Agregar un libro'], ['T', '', 'Cambiar de tema de sala'], ['Enter', '', 'Abrir el libro seleccionado'], ['E', '', 'Editar la ficha del libro seleccionado'], ['← →', '', 'Pasar de página en el lector'], ['H', '', 'Subrayar lo seleccionado en el lector'], ['B', '', 'Marcar la página en el lector'], ['D', '', 'Definir la palabra seleccionada'], ['+  −', '', 'Cambiar el tamaño de letra en el lector'], ['Esc', '', 'Cerrar o guardar el libro']];
    b.innerHTML = `<div class="keys">${K.map(([k, a, t]) => `<div><kbd>${k}</kbd><span>${a ? `<small>${a}</small><br>` : ''}${t}</span></div>`).join('')}</div>
     <div class="grid3b"><div class="card"><h3>Texto ajustable</h3><div class="sub">En «Apariencia y texto» puedes agrandar toda la letra de la app.</div></div><div class="card"><h3>Contraste y foco</h3><div class="sub">El tema «Alto contraste» y un borde de foco visible al navegar con teclado.</div></div><div class="card"><h3>Menos movimiento</h3><div class="sub">Si tu dispositivo pide reducir el movimiento, las animaciones se vuelven instantáneas.</div></div></div>`;
  },
  /* ---- Recomendaciones con IA ---- */
  ia(b) {
    const done = S.books.filter(x => x.s === 'leido').map(x => `${x.t} (${x.a})`), ing = S.books.filter(x => x.s === 'leyendo').map(x => `${x.t} (${x.a})`), drop = S.books.filter(x => x.s === 'abandonado').map(x => `${x.t} (${x.a})`);
    const fav = S.books.filter(x => x.s === 'leido' && (x.rating || 0) >= 4).map(x => `${x.t} (${x.a})`);
    const txt = `Recomiéndame 5 libros para leer a continuación, en español neutro, con una frase que explique por qué me gustaría cada uno.\n\n${fav.length ? `Los que más me gustaron (4 o 5 estrellas): ${fav.join('; ')}.\n` : ''}Libros que he leído: ${done.join('; ') || 'ninguno aún'}.\nLibros que estoy leyendo: ${ing.join('; ') || 'ninguno'}.\nLibros que abandoné (evita algo parecido): ${drop.join('; ') || 'ninguno'}.\nNo repitas los que ya tengo.`;
    b.innerHTML = `<div class="card"><h3>Para tu próxima lectura</h3><div class="sub">La app arma la pregunta con lo que marcaste como leído, en lectura y abandonado. Cópiala y pégala en la IA que prefieras.</div><textarea class="ask" id="ask" readonly aria-label="Pregunta para la IA">${esc(txt)}</textarea>
      <div class="row" style="margin-top:10px"><button class="btn" id="cp">${ic('copy')}Copiar pregunta</button><a class="btn ghost" href="https://www.perplexity.ai/" target="_blank" rel="noopener">Abrir Perplexity</a></div></div>`;
    $('#cp', b).onclick = async () => { try { await navigator.clipboard.writeText(txt); toast('Pregunta copiada'); } catch { $('#ask', b).select(); toast('Selecciónala y cópiala'); } };
  },
  catalogo(b) { b.innerHTML = '<div class="card"><h3>Clásicos gratis</h3><div class="sub">Libros de dominio público de Project Gutenberg, en español y otros idiomas.</div><div class="row" style="margin-top:12px"><button class="btn" id="ab">Abrir el catálogo</button></div></div>'; $('#ab', b).onclick = abrirCatalogo; },
  buscar(b) {
    let libro = '', fuentes = { texto: true, frases: true, glosario: true };
    const draw = async () => {
      const pend = await sinIndice(), libros = S.books.filter(x => !x.oculto && (x.f === 'EPUB' || x.f === 'PDF') && x.hasFile);
      b.innerHTML = `<div class="card"><input id="bq" type="search" placeholder="Buscar en todos mis libros" aria-label="Buscar" style="width:100%" autocomplete="off">
        <div class="row" style="gap:6px;margin-top:10px">${[['texto', 'Texto de los libros'], ['frases', 'Mis frases y notas'], ['glosario', 'Glosario']].map(([k, n]) => `<button class="chip" data-f="${k}" aria-pressed="${fuentes[k]}">${n}</button>`).join('')}</div>
        <label style="display:grid;gap:4px;margin-top:10px;font-size:13px">Libro<select id="bl"><option value="">Todos</option>${libros.map(x => `<option value="${x.id}" ${String(x.id) === libro ? 'selected' : ''}>${esc(x.t)}</option>`).join('')}</select></label></div>
        ${pend.length ? `<div class="card" style="margin-top:12px"><b>${pend.length} ${pend.length === 1 ? 'libro sin indexar' : 'libros sin indexar'}</b><div class="sub">Para buscar dentro del texto, la app lee cada libro una vez y guarda un índice en este dispositivo.</div><div class="pbar" style="margin-top:8px"><i id="ip" style="width:0%"></i></div><div class="row" style="margin-top:10px"><button class="btn" id="ib">Indexar ahora</button></div><div class="small" id="im" style="margin-top:6px"></div></div>` : ''}
        <div class="small" id="bn" style="margin:12px 2px"></div><div id="br" style="display:grid;gap:10px"></div>`;
      const busca = async () => {
        const q = $('#bq', b).value.trim(), r = $('#br', b); if (q.length < 2) { $('#bn', b).textContent = ''; r.innerHTML = ''; return; }
        const nq = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), n = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const sec = [];
        const lt = S.books.filter(x => !x.oculto && n(x.t + ' ' + x.a).includes(nq)).slice(0, 6);
        if (lt.length && !libro) sec.push(['Libros', lt.map(x => `<button class="hitr" data-open="${x.id}"><b>${esc(x.t)}</b><small>${esc(x.a)}</small></button>`)]);
        if (fuentes.frases) { const fr = S.notes.filter(x => (!libro || String(x.bookId) === libro) && n(x.text + ' ' + (x.comment || '')).includes(nq)).slice(0, 12); if (fr.length) sec.push(['Frases y notas', fr.map(x => `<button class="hitr" data-open="${x.bookId}" data-t="${esc(x.pdfPag || x.cfi || '')}"><span>${esc(x.text.slice(0, 160))}</span>${x.comment ? `<small>Nota: ${esc(x.comment.slice(0, 80))}</small>` : ''}<small>${esc(x.title || '')}</small></button>`)]); }
        if (fuentes.glosario && !libro) { const g = (S.meta.gloss || []).filter(x => n(x.w + ' ' + x.def).includes(nq)).slice(0, 8); if (g.length) sec.push(['Glosario', g.map(x => `<div class="hitr"><b>${esc(x.w)}</b><small>${esc((x.def || '').split('\n')[0].slice(0, 120))}</small></div>`)]); }
        if (fuentes.texto) { const tx = await buscarTexto(q, { libroId: libro ? +libro : null }); if (tx.length) sec.push([`Texto de los libros (${tx.length}${tx.length >= 80 ? '+' : ''})`, tx.map(h => `<button class="hitr" data-open="${h.b.id}" data-t="${esc(h.it.h || h.it.p)}"><span>${esc(h.ant)}<mark>${esc(h.hit)}</mark>${esc(h.des)}</span><small>${esc(h.b.t)}${h.it.p ? ' · pág. ' + h.it.p : ''}</small></button>`)]); }
        const total = sec.reduce((a, x) => a + x[1].length, 0);
        $('#bn', b).textContent = total ? `${total} resultados` : 'No encontré nada.';
        r.innerHTML = sec.map(([t, l]) => `<div><div class="tag2">${t}</div><div style="display:grid;gap:8px">${l.join('')}</div></div>`).join('');
        $$('[data-open]', r).forEach(x => x.onclick = () => { const id = +x.dataset.open, t = x.dataset.t; ctx.openReader(id, /^\d+$/.test(t) ? +t : (t || undefined)); });
      };
      let tm = 0; $('#bq', b).addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(busca, 300); });
      $('#bl', b).onchange = e => { libro = e.target.value; busca(); };
      $$('[data-f]', b).forEach(x => x.onclick = () => { fuentes[x.dataset.f] = !fuentes[x.dataset.f]; x.setAttribute('aria-pressed', fuentes[x.dataset.f]); busca(); });
      $('#ib', b)?.addEventListener('click', async e => {
        e.target.disabled = true; let i = 0;
        for (const x of pend) { i++; $('#im', b).textContent = `Leyendo «${x.t}» (${i} de ${pend.length})…`; try { await indexar(x, p => { $('#ip', b).style.width = ((i - 1 + p) / pend.length * 100) + '%'; }); } catch (err) { console.warn('indexar', err); } await new Promise(r => setTimeout(r, 20)); }
        toast('Índice listo'); draw();
      });
    };
    draw();
  },
  smart(b) {
    const draw = () => {
      const l = smart();
      b.innerHTML = `<div class="card"><h3>Colecciones inteligentes</h3><div class="sub">Listas con reglas: los libros entran y salen solos. Aparecen como filtros en la estantería, con un ✦.</div>
        ${l.map(x => `<div class="trit"><div style="min-width:0;flex:1"><b>${esc(x.n)}</b><div class="small">${miembros(x.r).length} libros</div></div><button class="btn ghost" data-e="${x.id}">Editar</button></div>`).join('') || '<div class="sub" style="margin-top:10px">Aún no tienes ninguna.</div>'}
        <div class="row" style="margin-top:12px"><button class="btn" id="sn">Nueva colección</button></div></div>
        <div class="card"><h3>Ideas para empezar</h3>${IDEAS.map((x, i) => `<div class="trit"><div style="min-width:0;flex:1"><b>${esc(x.n)}</b><div class="small">${miembros(x.r).length} libros ahora</div></div><button class="btn ghost" data-i="${i}">Agregar</button></div>`).join('')}</div>`;
      $('#sn', b).onclick = () => editarSmart(null, draw);
      $$('[data-e]', b).forEach(x => x.onclick = () => editarSmart(l.find(z => z.id === x.dataset.e), draw));
      $$('[data-i]', b).forEach(x => x.onclick = async () => { const i = IDEAS[+x.dataset.i]; smart().push({ id: newId(), n: i.n, r: { ...i.r } }); await saveMeta(); toast('Colección creada'); draw(); });
    };
    draw();
  },
  plan(b) {
    const draw = () => {
      const ps = planes(), cand = S.books.filter(x => (x.s === 'leyendo' || x.s === 'porleer') && !x.plan && !x.oculto), cal = calendario();
      b.innerHTML = `<div class="card"><h3>Plan de lectura</h3><div class="sub">Elige hasta cuándo quieres terminar un libro y la app calcula cuántas páginas por día. Si te atrasas, el resto se reparte solo.</div>
        ${ps.map(x => { const c = calculo(x); return `<div class="reto"><div class="rh"><div style="min-width:0"><b>${esc(x.t)}</b><div class="sub">${c.tarde ? 'Pasó la fecha' : `${c.ppd} págs. por día · unos ${c.minutos} min`} · quedan ${c.quedan} págs.</div></div><button class="btn ghost" data-q="${x.id}" aria-label="Quitar el plan">${ic('x')}</button></div><label class="small" style="display:block;margin-top:6px">Terminar el <input type="date" data-d="${x.id}" value="${x.plan.fin}"></label></div>`; }).join('') || ''}
        ${cand.length ? `<form class="inl" id="pf" style="margin-top:12px"><select name="b" aria-label="Libro">${cand.map(x => `<option value="${x.id}">${esc(x.t)}</option>`).join('')}</select><input name="f" type="date" required min="${today()}" aria-label="Fecha"><button class="btn" type="submit">Crear plan</button></form>` : '<div class="sub" style="margin-top:10px">No hay libros disponibles para planificar.</div>'}</div>
        <div class="card"><h3>Calendario</h3><div class="sub">★ termina un plan · ! se devuelve un préstamo · punto: día con lectura</div>
        <div class="calg"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>${cal.map(c => `<i class="${c.hoy ? 'hoy' : ''} ${c.pasado ? 'pas' : ''} ${c.fin.length ? 'fin' : ''} ${c.dev.length ? 'dev' : ''}" title="${esc([...c.fin.map(x => 'Termina ' + x.t), ...c.dev.map(x => 'Devolver ' + x.t)].join(' · '))}">${c.d.getDate()}${c.fin.length ? '★' : c.dev.length ? '!' : c.leido ? '·' : ''}</i>`).join('')}</div></div>`;
      $('#pf', b)?.addEventListener('submit', async e => { e.preventDefault(); const d = new FormData(e.target), x = byId(+d.get('b')); await fijarPlan(x, d.get('f')); toast('Plan creado'); draw(); });
      $$('[data-d]', b).forEach(i => i.onchange = async () => { await fijarPlan(byId(+i.dataset.d), i.value); draw(); });
      $$('[data-q]', b).forEach(x => x.onclick = async () => { await fijarPlan(byId(+x.dataset.q), null); draw(); });
    };
    draw();
  },
  foco(b) {
    const l = sesionesFoco().slice().reverse(), tot = l.reduce((a, x) => a + x.min, 0), hoyN = l.filter(x => x.d === today());
    const porHora = Array(24).fill(0); l.forEach(x => { porHora[new Date(x.t).getHours()] += x.min; }); const mx = Math.max(...porHora), mejor = mx ? porHora.indexOf(mx) : -1;
    b.innerHTML = `<div class="card"><h3>Sesiones de foco</h3><div class="sub">Un tiempo fijo para leer sin distracciones, con avisos para descansar la vista.</div><div class="row" style="margin-top:12px"><button class="btn" id="fg">Empezar una sesión</button></div></div>
      <div class="card"><div class="rpair"><div><b>${l.length}</b><span>sesiones</span></div><div><b>${tot}</b><span>minutos</span></div><div><b>${hoyN.length}</b><span>hoy</span></div></div>${mejor >= 0 ? `<div class="sub" style="margin-top:10px">Rindes más a las ${String(mejor).padStart(2, '0')}:00.</div>` : ''}</div>
      ${l.length ? `<div class="card"><h3>Historial</h3>${l.slice(0, 20).map(x => `<div class="trit"><div style="flex:1;min-width:0"><b>${x.min} min</b><div class="small">${new Date(x.t).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}${x.pag ? ` · ${x.pag} págs.` : ''}${x.libro ? ' · ' + esc((S.books.find(k => k.uid === x.libro) || {}).t || '') : ''}</div></div></div>`).join('')}</div>` : ''}`;
    $('#fg', b).onclick = abrirFoco;
  },
  espacio(b) {
    const draw = async () => {
      b.innerHTML = '<div class="card"><div class="skel" style="width:60%"></div><div class="skel" style="width:90%;margin-top:10px"></div></div>';
      const inv = await inventario(), tot = inv.reduce((a, x) => a + (x.t || 0), 0), libre = sinAbrir(inv), mbL = libre.reduce((a, x) => a + x.t, 0);
      b.innerHTML = `<div class="card"><h3>Almacenamiento</h3><div class="sub">Los libros con archivo ocupan espacio. Puedes quitar el archivo de este dispositivo y dejarlo en Google Drive: la ficha, tus frases y tu avance se quedan, y se baja de nuevo al abrirlo.</div>
        <div class="metaN" style="margin-top:12px">${mb(tot)}<small> en este dispositivo</small></div>
        ${!isEnabled() ? '<div class="note" style="margin-top:8px">Conecta Google Drive en «Sincronización y copia» para poder quitar archivos sin perderlos.</div>' : ''}
        ${libre.length ? `<div class="row" style="margin-top:12px"><button class="btn" id="eq">Liberar ${mb(mbL)} (${libre.length} sin abrir hace meses)</button></div>` : ''}</div>
        <div class="card"><h3>Libros</h3>${inv.map(({ b: x, t, local }) => `<div class="trit"><div style="min-width:0;flex:1"><b>${esc(x.t)}</b><div class="small">${local ? mb(t) + ' · en este dispositivo' : 'Solo en Drive'}${x.audio ? ' · audiolibro' : ''}</div></div>${local ? `<button class="btn ghost" data-q="${x.id}" ${sePuedeQuitar(x) ? '' : 'disabled title="Conecta Drive y sincroniza antes"'}>Quitar</button>` : `<button class="btn" data-b="${x.id}">Descargar</button>`}<label class="chk2" title="Tener sin conexión" style="margin:0"><input type="checkbox" data-v="${x.id}" ${x.offline ? 'checked' : ''}>Viaje</label></div>`).join('') || '<div class="sub">Aún no hay libros con archivo.</div>'}
        ${inv.some(x => x.b.offline && !x.local) ? '<div class="row" style="margin-top:12px"><button class="btn" id="ev">Descargar los marcados para viaje</button></div>' : ''}</div>`;
      $('#eq', b)?.addEventListener('click', async () => { for (const x of libre) { try { await quitarLocal(x.b); } catch { } } toast('Espacio liberado'); draw(); });
      $$('[data-q]', b).forEach(x => x.onclick = async () => { try { await quitarLocal(byId(+x.dataset.q)); toast('Quitado de este dispositivo'); draw(); } catch (e) { toast(e.message); } });
      $$('[data-b]', b).forEach(x => x.onclick = async () => { x.disabled = true; x.textContent = 'Bajando…'; try { await bajar(byId(+x.dataset.b)); toast('Descargado'); } catch (e) { toast(e.message || 'No se pudo descargar'); } draw(); });
      $$('[data-v]', b).forEach(x => x.onchange = async () => { const k = byId(+x.dataset.v); k.offline = x.checked; await saveBook(k); });
      $('#ev', b)?.addEventListener('click', async e => { e.target.disabled = true; for (const x of inv.filter(y => y.b.offline && !y.local)) { try { await bajar(x.b); } catch { } } toast('Libros listos para el viaje'); draw(); });
    };
    draw();
  },
  personajes(b) { b.innerHTML = '<div class="card"><h3>Personajes</h3><div class="sub">Un cuaderno por libro: ficha, relaciones, frases ligadas y un mapa. Solo se ven los personajes que ya aparecieron, para no adelantarte. También se abre desde el panel de subrayados del lector.</div><div class="row" style="margin-top:12px"><button class="btn" id="pe">Elegir un libro</button></div></div>'; $('#pe', b).onclick = elegirPersonajes; },
  webshelf(b) {
    b.innerHTML = `<div class="card"><h3>Mi estantería como página web</h3><div class="sub">Se genera un archivo único con tus libros, portadas y calificaciones. Súbelo a cualquier sitio gratuito (por ejemplo, GitHub Pages) y comparte el enlace. Los libros ocultos nunca se incluyen.</div>
      <div class="row" style="gap:6px;margin:12px 0" id="ws">${Object.entries(ST).map(([k, v]) => `<button class="chip" data-s="${k}" aria-pressed="${k === 'leido' || k === 'leyendo'}">${v.n}</button>`).join('')}</div>
      <label class="chk2"><input type="checkbox" id="wr"> Incluir mis reseñas</label>
      <label style="display:grid;gap:4px;margin:10px 0;font-size:13px">Título<input id="wt" value="Mi biblioteca" maxlength="60"></label>
      <div class="row"><button class="btn" id="wg">Crear la página</button></div><div class="small" id="wm" style="margin-top:8px"></div></div>`;
    $$('#ws .chip', b).forEach(c => c.onclick = () => c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') !== 'true'));
    $('#wg', b).onclick = async e => {
      const estados = $$('#ws .chip[aria-pressed="true"]', b).map(c => c.dataset.s); if (!estados.length) return toast('Elige al menos un estado');
      e.target.disabled = true; $('#wm', b).textContent = 'Preparando la página…';
      try { const html = await construirPagina({ estados, resenas: $('#wr', b).checked, titulo: $('#wt', b).value.trim() || 'Mi biblioteca' }); await guardarPagina(html); $('#wm', b).textContent = `Listo (${mb(html.length)}). Guardada como mi-estanteria.html.`; }
      catch (err) { console.error(err); $('#wm', b).textContent = 'No pude crear la página.'; }
      e.target.disabled = false;
    };
  },
  perfiles(b) {
    const draw = () => {
      const l = listaPerfiles(), act = perfilActivo();
      b.innerHTML = `<div class="card"><h3>Perfiles</h3><div class="sub">Una biblioteca aparte para otra persona de la casa, en este mismo dispositivo: sus libros, frases y avance no se mezclan con los tuyos. Los perfiles adicionales se guardan solo aquí (no se sincronizan con Drive).</div>
        <div class="trit" style="margin-top:12px"><div style="flex:1"><b>Principal</b><div class="small">${act ? '' : 'En uso'}</div></div>${act ? '<button class="btn" data-c="">Cambiar</button>' : ''}</div>
        ${l.map(p => `<div class="trit"><div style="flex:1"><b>${esc(p.n)}</b><div class="small">${act === p.id ? 'En uso' : ''}</div></div>${act === p.id ? '' : `<button class="btn" data-c="${p.id}">Cambiar</button>`}<button class="btn ghost" data-d="${p.id}" aria-label="Borrar perfil">${ic('trash')}</button></div>`).join('')}
        <form class="inl" id="pn" style="margin-top:12px"><input name="n" placeholder="Nombre del perfil" maxlength="24" required><button class="btn" type="submit">Crear perfil</button></form></div>`;
      $('#pn', b).onsubmit = e => { e.preventDefault(); crearPerfil(new FormData(e.target).get('n')); draw(); };
      $$('[data-c]', b).forEach(x => x.onclick = () => cambiarPerfil(x.dataset.c));
      $$('[data-d]', b).forEach(x => x.onclick = () => { if (x.dataset.armed) borrarPerfil(x.dataset.d); else { x.dataset.armed = '1'; x.textContent = 'Toca otra vez'; } });
    };
    draw();
  },
  retos(b) {
    const draw = () => {
      const ac = retosActivos(), got = S.meta.logros || {};
      b.innerHTML = `<div class="card"><h3>Retos</h3><div class="sub">Metas con forma. Activa las que quieras y mira tu avance; las activas también aparecen en Hoy.</div>
        ${RETOS.map(r => { const c = r.cfg ? (cfgReto(r.id) ?? r.def) : null, x = r.calc(c), on = ac.includes(r.id); return `<div class="reto"><div class="rh"><div style="min-width:0"><b>${r.n}</b><div class="sub">${esc(r.d(c))}</div></div><button class="sw3" data-r="${r.id}" aria-pressed="${on}" aria-label="Activar ${esc(r.n)}"></button></div>${on ? `<div class="pbar" style="margin-top:8px"><i style="width:${Math.min(100, Math.round(x.a / Math.max(1, x.t) * 100))}%"></i></div><div class="sub" style="margin-top:4px">${x.txt}</div>` : ''}${on && r.cfg ? `<label class="small" style="display:block;margin-top:8px">Meta <input class="goalin" type="number" min="1" data-c="${r.id}" value="${c}"></label>` : ''}</div>`; }).join('')}</div>
        <div class="card"><h3>Logros</h3><div class="sub">Reconocimientos suaves, sin competir con nadie.</div><div class="badges2">${LOGROS.map(l => { const t = got[l.id]; return `<div class="bdg2 ${t ? '' : 'off'}"><i>${l.s}</i><b>${l.n}</b><small>${t ? new Date(t).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : esc(l.d)}</small></div>`; }).join('')}</div></div>`;
      $$('[data-r]', b).forEach(x => x.onclick = async () => { await fijarReto(x.dataset.r, x.getAttribute('aria-pressed') !== 'true'); draw(); });
      $$('[data-c]', b).forEach(x => x.onchange = async () => { await fijarCfg(x.dataset.c, Math.max(1, +x.value || 1)); draw(); });
    };
    draw();
  },
  glosario(b) {
    const draw = () => {
      const l = palabras().slice().sort((a, z) => z.at - a.at), pend = glPend().length;
      b.innerHTML = `<div class="card"><h3>Glosario</h3><div class="sub">Las palabras que guardas al leer: toca una palabra en el lector, elige «Definir» y guárdala.</div>
        <div class="row" style="margin-top:12px"><button class="btn" id="gr" ${pend ? '' : 'disabled'}>Repasar${pend ? ` (${pend})` : ''}</button></div>
        ${l.length ? `<div style="margin-top:14px;display:grid;gap:10px">${l.map(w => `<div class="trit"><div style="min-width:0;flex:1"><b>${esc(w.w)}</b><div class="small">${esc((w.def || '').split('\n')[0].slice(0, 110))}</div></div><button class="btn ghost" data-d="${w.id}" aria-label="Quitar">${ic('trash')}</button></div>`).join('')}</div>` : '<p style="margin-top:12px" class="sub">Aún no hay palabras guardadas.</p>'}</div>`;
      $('#gr', b)?.addEventListener('click', repasarGlosario);
      $$('[data-d]', b).forEach(x => x.onclick = async () => { await quitarPalabra(x.dataset.d); draw(); });
    };
    draw();
  },
  privacidad(b) {
    const draw = () => {
      const ocultos = S.books.filter(x => x.oculto).length, bio = !!window.AndroidApp?.biometriaDisponible?.();
      b.innerHTML = `<div class="card"><h3>Bloqueo con PIN</h3><div class="sub">${hayPin() ? 'La app pide el PIN al abrirla y al volver tras unos minutos.' : 'Protege la app con un PIN de 4 a 6 dígitos. Se guarda solo en este dispositivo.'}</div>
        <div class="row" style="margin-top:12px">${hayPin() ? '<button class="btn" id="pc">Cambiar PIN</button><button class="btn ghost" id="pq">Quitar PIN</button>' : '<button class="btn" id="pn">Crear PIN</button>'}</div>
        ${hayPin() ? `<label style="display:grid;gap:4px;margin-top:14px;font-size:13px">Pedir el PIN al volver después de<select id="pa">${[[0, 'Siempre'], [1, '1 minuto'], [5, '5 minutos'], [15, '15 minutos']].map(([m, n]) => `<option value="${m}" ${minutosAuto() === m ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        ${bio ? `<label class="chk2" style="margin-top:12px"><input type="checkbox" id="pb" ${bioActiva() ? 'checked' : ''}> Desbloquear con la huella</label>` : ''}` : ''}</div>
        <div class="card"><h3>Libros ocultos</h3><div class="sub">${ocultos} ${ocultos === 1 ? 'libro oculto' : 'libros ocultos'}. Se ocultan desde la ficha de cada libro («Editar») y no aparecen en la estantería, en Hoy ni en las sugerencias.</div>
        <div class="row" style="margin-top:12px"><button class="btn ${S.ui.verOcultos ? '' : 'ghost'}" id="po">${S.ui.verOcultos ? 'Volver a ocultarlos' : 'Mostrarlos ahora'}</button></div></div>`;
      const crea = (cambia) => {
        const o = openSheet(`<h3>${cambia ? 'Nuevo PIN' : 'Crear PIN'}</h3><form class="form" id="pf" style="margin-top:12px"><label>PIN (4 a 6 dígitos)<input name="p" type="password" inputmode="numeric" pattern="[0-9]{4,6}" required autocomplete="off"></label><label>Repítelo<input name="q" type="password" inputmode="numeric" pattern="[0-9]{4,6}" required autocomplete="off"></label><button class="btn" type="submit">Guardar PIN</button></form>`);
        $('#pf', o).onsubmit = async e => { e.preventDefault(); const d = new FormData(e.target); if (d.get('p') !== d.get('q')) return toast('Los PIN no coinciden'); await fijarPin(d.get('p')); closeSheet(); toast('PIN guardado'); draw(); };
      };
      $('#pn', b)?.addEventListener('click', () => crea(false));
      $('#pc', b)?.addEventListener('click', async () => { if (await pedirPin(true)) crea(true); });
      $('#pq', b)?.addEventListener('click', async () => { if (await pedirPin(true)) { quitarPin(); toast('PIN quitado'); draw(); } });
      $('#pa', b)?.addEventListener('change', e => fijarAutoPin(+e.target.value));
      $('#pb', b)?.addEventListener('change', e => fijarBio(e.target.checked));
      $('#po', b)?.addEventListener('click', async () => { const ok = await verOcultos(!S.ui.verOcultos); if (ok) { draw(); toast(S.ui.verOcultos ? 'Libros ocultos visibles' : 'Libros ocultos de nuevo'); import('./state.js').then(m => m.emit()); } });
    };
    draw();
  },
  papelera(b) {
    const draw = async () => {
      const t = await verPapelera();
      b.innerHTML = `<div class="card"><h3>Papelera</h3><div class="sub">Un libro quitado se guarda aquí ${DIAS_PAPELERA} días, con su archivo, sus frases y su diario.</div>
        ${t.length ? `<div class="trash" style="margin-top:12px;display:grid;gap:10px">${t.map(x => { const dias = Math.max(0, DIAS_PAPELERA - Math.floor((Date.now() - x.at) / 864e5)); return `<div class="trit"><div style="min-width:0;flex:1"><b>${esc(x.book.t)}</b><div class="small">${esc(x.book.a)} · quedan ${dias} ${dias === 1 ? 'día' : 'días'}</div></div><button class="btn" data-r="${x.tid}">Recuperar</button><button class="btn ghost" data-d="${x.tid}" aria-label="Eliminar para siempre">${ic('trash')}</button></div>`; }).join('')}</div>` : '<p style="margin-top:12px">La papelera está vacía.</p>'}</div>`;
      $$('[data-r]', b).forEach(x => x.onclick = async () => { const r = await recuperar(x.dataset.r); toast(r ? `«${r.t}» recuperado` : 'No se pudo recuperar'); draw(); });
      $$('[data-d]', b).forEach(x => x.onclick = async () => { if (x.dataset.armed) { await borrarDePapelera(x.dataset.d); draw(); } else { x.dataset.armed = '1'; x.textContent = 'Toca otra vez'; } });
    };
    draw();
  },
  portadas(b) {
    const n = () => S.books.filter(x => !x.cover).length; let cancel = false, corre = false;
    const draw = () => {
      b.innerHTML = `<div class="card"><h3>Completar portadas</h3><div class="sub">Busca en Open Library (gratis) la portada de los libros que no tienen imagen, por su ISBN o por su título y autor.</div>
        <p style="margin:12px 0" id="pm">${n() ? `${n()} libros sin portada.` : 'Todos tus libros tienen portada.'}</p>
        <div class="bar2"><i id="pp" style="width:0%"></i></div>
        <div class="row" style="margin-top:12px">${n() ? `<button class="btn" id="pg">${corre ? 'Detener' : 'Buscar portadas'}</button>` : ''}</div></div>`;
      $('#pg', b)?.addEventListener('click', async () => {
        if (corre) { cancel = true; return; }
        corre = true; cancel = false; draw();
        const { completarPortadas } = await import('./portadas.js');
        const r = await completarPortadas((i, t, x) => { const m = $('#pm', b); if (m) m.textContent = x ? `Buscando ${i + 1} de ${t}: ${x.t}` : 'Listo'; const p = $('#pp', b); if (p) p.style.width = (t ? i / t * 100 : 100) + '%'; }, () => cancel);
        corre = false; toast(r ? `${r} portadas encontradas` : 'No encontré portadas nuevas'); draw();
      });
    };
    draw();
  },
  repetidos(b) {
    const draw = () => {
      const sob = sobrantes();
      b.innerHTML = `<div class="card"><h3>Libros repetidos</h3><div class="sub">Se buscan libros con el mismo archivo, o con el mismo título, autor y páginas. De cada grupo se conserva el que tiene más avance, frases y diario.</div>
        ${sob.length ? `<div style="margin:12px 0;display:grid;gap:6px">${sob.slice(0, 40).map(x => `<div class="small">• <b>${esc(x.t)}</b> · ${esc(x.a)}</div>`).join('')}${sob.length > 40 ? `<div class="small">…y ${sob.length - 40} más</div>` : ''}</div>
        <div class="row"><button class="btn" id="qr">Quitar ${sob.length} repetidos</button></div>` : '<p style="margin-top:12px">Tu biblioteca no tiene libros repetidos.</p>'}</div>`;
      $('#qr', b)?.addEventListener('click', async e => { e.target.disabled = true; e.target.textContent = 'Quitando…'; const n = await quitarRepetidos(); toast(`${n} repetidos quitados`); draw(); });
    };
    draw();
  },
  diagnostico(b) {
    const errs = (() => { try { return JSON.parse(localStorage.getItem('bv-errs') || '[]'); } catch { return []; } })();
    const perf = (() => { try { return JSON.parse(localStorage.getItem('bv-perf') || '{}'); } catch { return {}; } })();
    const v = versionActual(), info = [`App: ${v ? v.name + ' (Android)' : 'web'}`, `Pantalla: ${innerWidth}x${innerHeight} · ${devicePixelRatio}x`, `Tema: ${P.theme}`, `Libros: ${S.books.length}`, `Tiempo de dibujo (ms): Hoy ${perf.hoy ?? '–'}, Biblioteca ${perf.lib ?? '–'}, Frases ${perf.fr ?? '–'}, Cifras ${perf.stats ?? '–'}, Más ${perf.more ?? '–'}`, `Navegador: ${navigator.userAgent}`].join('\n');
    const txt = info + '\n\nErrores:\n' + (errs.map(e => `${new Date(e.t).toLocaleString('es')} · ${e.tipo} · ${e.msg} ${e.donde}`).join('\n') || '(ninguno)');
    b.innerHTML = `<div class="card"><h3>Diagnóstico</h3><div class="sub">Si algo falla, copia esto y pégamelo: me dice exactamente qué pasó.</div>
      <textarea id="dg" aria-label="Datos del diagnóstico" readonly rows="12" style="width:100%;margin-top:10px;font:12px/1.4 monospace;border-radius:10px;padding:10px;background:var(--surface2);color:var(--ink);border:1px solid var(--line)">${esc(txt)}</textarea>
      <div class="row" style="margin-top:10px"><button class="btn" id="dc">Copiar</button><button class="btn ghost" id="dl">Borrar registro</button></div></div>`;
    $('#dc', b).onclick = async () => { try { await navigator.clipboard.writeText(txt); toast('Copiado'); } catch { $('#dg', b).select(); toast('Selecciona y copia'); } };
    $('#dl', b).onclick = () => { try { localStorage.removeItem('bv-errs'); } catch { } toast('Registro borrado'); };
  },
  vozneuronal(b) {
    b.innerHTML = `<div class="card"><h3>Voz neuronal</h3><div class="sub">Se usa al leer en voz alta dentro del lector. Elige una voz para descargarla y activarla.</div><div id="vneu" style="margin-top:12px"></div></div>`;
    Promise.all([import('./voz.js'), import('./reader.js')]).then(([v, r]) => v.dibujarVozNeuronal($('#vneu', b), r.rprefs, r.setRPref));
  },
  version(b) {
    const v = versionActual();
    b.innerHTML = `<div class="card"><h3>Mi Biblioteca ${esc(v?.name || '')}</h3><div class="sub">Las versiones nuevas se publican en GitHub y se instalan desde aquí.</div><div class="row" style="margin-top:12px"><button class="btn" id="bu">Buscar actualización</button></div><div class="small" id="bm" style="margin-top:10px"></div></div>`;
    b.querySelector('.card').insertAdjacentHTML('beforeend', `<label class="row" style="margin-top:14px;gap:10px;align-items:center"><input type="checkbox" id="au" ${autoActivo() ? 'checked' : ''}> <span>Actualizar sola al abrir la app</span></label>`);
    $('#au', b).onchange = e => fijarAuto(e.target.checked);
    $('#bu', b).onclick = async () => {
      $('#bm', b).textContent = 'Buscando…';
      try { const u = await buscarActualizacion(); if (u.nueva) { $('#bm', b).textContent = 'Hay una versión nueva.'; ofrecerInstalar(u); } else $('#bm', b).textContent = 'Ya tienes la última versión.'; }
      catch (e) { $('#bm', b).textContent = e.message || 'No pude consultar. ¿Hay conexión?'; }
    };
  },
  ayuda(b) {
    b.innerHTML = `<div class="card"><h3>Primeros pasos</h3><ol class="help"><li>Agrega un libro desde <b>Biblioteca</b>: un EPUB, el ISBN de uno de papel, o una lista CSV.</li><li>Toca un lomo para sacarlo del estante. Mantén presionado para arrastrarlo a otro lugar o piso.</li><li>Abre un EPUB y selecciona un texto: elige un color para subrayarlo y guardar la frase.</li><li>En <b>Hoy</b> verás tu meta, tu racha y el libro que sigues.</li><li>En <b>Más → Sincronización</b> conecta Google para ver todo igual en el PC y en el teléfono.</li></ol></div>`;
  },
};
