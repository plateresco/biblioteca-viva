// Tanda 5: datos automáticos y línea de tiempo, qué hay de nuevo, primeros pasos, escanear estantería, traducir, notas de voz,
// fondos con frases, códigos QR, asistente opcional (Gemini) y catálogos OPDS.
import qrcode from 'qrcode-generator';
import * as db from './db.js';
import { S, byId, saveBook, saveMeta, addBook, saveNote, removeNote, newId, today } from './state.js';
import { $, $$, esc, toast, openSheet, closeSheet } from './ui.js';
import { A, blobToB64, esApp } from './native.js';
import { norm } from './importar.js';
import { visible } from './bloqueo.js';
import { shareImage } from './share.js';
import { coverColors, fallbackColors, shrinkImage } from './color.js';
import { fijarPlan } from './plan.js';
import { http as httpApp } from './catalogo.js';
import { isEnabled } from './sync.js';

const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { } return null; };
const wait = ms => new Promise(r => setTimeout(r, ms));
async function fetchJ(u, opts = {}, ms = 12000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(u, { ...opts, signal: c.signal }); if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return await r.json(); } finally { clearTimeout(t); }
}
const boton = (b, txt, dis) => { b.textContent = txt; b.disabled = !!dis; };

/* ================================================================== Open Library: datos de un libro */
const GENEROS = [[/science fiction/, 'Ciencia ficción'], [/fantasy/, 'Fantasía'], [/magic(al)? realism/, 'Realismo mágico'], [/detective|crime|mystery/, 'Policial'], [/horror|ghost stories|vampire/, 'Terror'], [/romance fiction|love stories/, 'Romance'], [/poetry|poems/, 'Poesía'], [/essays/, 'Ensayo'], [/philosophy/, 'Filosofía'], [/biograph/, 'Biografía'], [/history/, 'Historia'], [/short stories/, 'Cuentos'], [/drama|plays/, 'Teatro'], [/psychology/, 'Psicología'], [/economics/, 'Economía'], [/science/, 'Ciencia'], [/religion/, 'Religión'], [/self-help/, 'Autoayuda'], [/comic|graphic novel/, 'Cómic'], [/juvenile|children/, 'Infantil'], [/classic/, 'Clásico'], [/novels?/, 'Novela'], [/fiction/, 'Ficción']];
export function generoDe(subjects = []) {
  const s = subjects.map(x => String(x).toLowerCase());
  const cuenta = GENEROS.map(([re, n], i) => [n, s.filter(x => re.test(x)).length, i]).filter(x => x[1] > 0).sort((a, z) => z[1] - a[1] || a[2] - z[2]).map(x => x[0]);
  const out = cuenta.slice(0, 2); if (out.includes('Novela') && out.includes('Ficción')) out.splice(out.indexOf('Ficción'), 1);
  return out;
}
export async function buscarOL(titulo, autor) {
  const p = new URLSearchParams({ limit: '8', fields: 'title,author_name,first_publish_year,subject,number_of_pages_median,cover_i' });
  if (autor) { p.set('title', titulo); p.set('author', autor); } else p.set('q', titulo);
  const j = await fetchJ('https://openlibrary.org/search.json?' + p);
  return j.docs || [];
}
const autorOk = (z, x) => { const u = norm(x.a || '').split(' ').filter(w => w.length > 2).pop(); return !u || /desconocid/.test(u) || norm((z.author_name || []).join(' ')).includes(u); };
const coincide = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };

export const ERAS = [[-9999, 500, 'Antigüedad'], [500, 1500, 'Edad Media'], [1500, 1800, 'Siglos XVI al XVIII'], [1800, 1900, 'Siglo XIX'], [1900, 2000, 'Siglo XX'], [2000, 9999, 'Siglo XXI']];
export const epocaDe = y => (ERAS.find(e => y >= e[0] && y < e[1]) || ERAS[5])[2];

/* ================================================================== Qué hay de nuevo */
export const BUILD = 23;
export const CAMBIOS = [
  { v: 23, t: 'Pulido', l: [['ARREGLO', 'En Biblioteca el estado se elige en un solo botón y ya no queda cortado; los libros destacados al filtrar ya no se estiran.'], ['MEJOR', 'Frases con búsqueda y ajustes; desliza una frase a la izquierda para borrarla (con Deshacer) o a la derecha para compartirla.'], ['NUEVO', 'Gestos en el lector: doble toque marca la página y pellizcar cambia la letra.'], ['MEJOR', 'Botones que responden al presionar, pantallas que entran en cascada y cifras que suben hasta su valor.'], ['MEJOR', 'Más contraste en el tema Papel y zonas táctiles más grandes.'], ['MEJOR', 'Estantería y listas largas más ágiles; el Diagnóstico mide cuánto tarda cada pantalla.']] },
  { v: 22, t: 'Leer mejor', l: [['NUEVO', 'Letra estilo Kindle (Literata) en el lector, ahora por defecto.'], ['NUEVO', 'Regla de línea, párrafo activo y ráfaga de palabras para concentrarte.'], ['NUEVO', '¿Qué leo hoy?: dos preguntas y te propongo un libro.'], ['NUEVO', 'Racha amable: días de gracia, meta por semana y pausa de vacaciones.'], ['NUEVO', 'Tu ritmo: calendario de calor del año y tu hora dorada.'], ['NUEVO', 'Etiquetas en tus frases, nube de temas y repaso por tema.'], ['NUEVO', 'Bingo de lectura del año.'], ['NUEVO', 'Exportar a Obsidian y frases en CSV; importar también desde StoryGraph.']] },
  { v: 21, t: 'Diseño nuevo', l: [['NUEVO', 'Biblioteca con una sola fila de filtros y un botón «Filtros».'], ['NUEVO', 'Más ordenado en grupos, con buscador y favoritos.'], ['NUEVO', 'Hoy con anillo de meta, semana en puntos y sesión integrada.'], ['NUEVO', 'Barra inferior con píldora activa y botón «＋» para agregar.'], ['NUEVO', 'El color de cada libro tiñe Hoy y el lector.'], ['NUEVO', 'Temas Negro OLED, Papel y por horario; esquinas rectas y menos movimiento en Apariencia.'], ['MEJOR', 'Las hojas se cierran arrastrando desde el asa y su botón queda fijo abajo.']] },
  { v: 20, t: 'Esta versión', l: [['NUEVO', 'Escanear una estantería con la cámara y agregar los libros que reconoce.'], ['NUEVO', 'Completar género, año y páginas desde Open Library, y una línea de tiempo por época.'], ['NUEVO', 'Traducir un párrafo o una palabra, con descarga del idioma para usar sin conexión.'], ['NUEVO', 'Notas de voz por libro, dictado a texto y cómo te sentiste en cada sesión de foco.'], ['NUEVO', 'Tus frases como fondo de pantalla, también diario.'], ['NUEVO', 'Compartir listas, planes de club y la app con códigos QR.'], ['NUEVO', 'Asistente opcional para explicar, resumir y hacer preguntas (con tu clave gratuita de Gemini).'], ['NUEVO', 'Catálogos OPDS propios, como Calibre en tu casa.'], ['NUEVO', 'Primeros pasos y esta hoja de novedades.']] },
  { v: 19, t: 'Antes', l: [['NUEVO', 'Buscar en el texto de todos tus libros, sesiones de foco, plan de lectura y perfiles.'], ['NUEVO', 'Voz neuronal sin conexión y lectura asistida.'], ['MEJOR', 'La estantería dibuja más rápido con cientos de libros.']] },
];
export function avisarNovedades() {
  const vista = LS('bv-novedades');
  if (vista === null) { LS('bv-novedades', String(BUILD)); return; }       // instalación nueva: no hay nada que contar
  if (+vista >= BUILD) return;
  LS('bv-novedades', String(BUILD)); verNovedades(+vista);
}
export function verNovedades(desde = 0) {
  const lista = desde ? CAMBIOS.filter(c => c.v > desde) : CAMBIOS;
  openSheet(`<h3>Qué hay de nuevo</h3>${lista.map(c => `<div class="sub" style="margin-top:12px"><b>${esc(c.t)}</b></div><div class="nov5">${c.l.map(([k, x]) => `<div><i>${k}</i><span>${esc(x)}</span></div>`).join('')}</div>`).join('')}<div class="row" style="margin-top:16px"><button class="btn" data-x>Entendido</button></div>`);
}

/* ================================================================== Primeros pasos */
export function pasosPrimeros() {
  return [
    { k: 'libro', t: 'Agregar tu primer libro', hecho: S.books.length > 0, ir: 'importar' },
    { k: 'leer', t: 'Empezar a leer un libro', hecho: S.books.some(b => b.s === 'leyendo' || b.s === 'leido') || S.log.length > 0, ir: null },
    { k: 'frase', t: 'Guardar una frase', hecho: S.notes.length > 0, ir: null },
    { k: 'sync', t: 'Probar la sincronización con Drive', hecho: !!isEnabled(), ir: 'sync' },
    { k: 'col', t: 'Crear una colección', hecho: (S.meta.cols || []).length > 0, ir: 'colecciones' },
  ];
}
const resumenPasos = () => { const p = pasosPrimeros(), n = p.filter(x => x.hecho).length; return n === p.length ? 'Todo listo' : `${n} de ${p.length} hechos`; };

/* ================================================================== Traducir */
const IDIOMAS = [['en', 'Inglés'], ['fr', 'Francés'], ['pt', 'Portugués'], ['it', 'Italiano'], ['de', 'Alemán']];
const trCb = {}; let trN = 0;
window.__trad = (id, ok, txt) => { const f = trCb[id]; if (f) { delete trCb[id]; f(!!ok, txt); } };
function trozos(t, max = 450) {
  const fr = String(t).replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s+/), out = []; let cur = '';
  for (const f of fr) { if ((cur + ' ' + f).length > max && cur) { out.push(cur); cur = f; } else cur = cur ? cur + ' ' + f : f; }
  if (cur) out.push(cur); return out.flatMap(x => x.length > max ? x.match(new RegExp('.{1,' + max + '}', 'g')) : [x]);
}
export function traducirTexto(texto, de) {
  if (A?.traducir) return new Promise((res, rej) => {
    const id = 't' + (++trN); trCb[id] = (ok, t) => ok ? res(t) : rej(new Error(t || 'No pude traducir.'));
    A.traducir(id, String(texto).slice(0, 3000), de);
    setTimeout(() => { if (trCb[id]) { delete trCb[id]; rej(new Error('Tardó demasiado. Revisa tu conexión (el idioma se baja la primera vez).')); } }, 180000);
  });
  return (async () => {          // en el navegador: servicio gratuito MyMemory (necesita internet)
    const partes = []; for (const c of trozos(texto)) {
      const j = await fetchJ(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(c)}&langpair=${de}|es`).catch(() => { throw new Error('No pude traducir. ¿Hay conexión a internet?'); });
      partes.push(j.responseData?.translatedText || '');
    }
    return partes.join(' ');
  })();
}
export function abrirTraductor(texto = '', libro = null) {
  const de0 = LS('bv-trad-de') || (libro?.idioma && IDIOMAS.some(i => i[0] === libro.idioma) ? libro.idioma : 'en');
  const o = openSheet(`<h3>Traducir al español</h3><div class="sub">${A?.traducir ? 'Se baja el idioma una vez (unos 30 MB) y después traduce sin conexión.' : 'En el navegador se usa un servicio gratuito y necesita internet.'}</div>
    <label style="display:grid;gap:4px;margin-top:10px;font-size:13px">Idioma del texto<select id="trd">${IDIOMAS.map(([k, n]) => `<option value="${k}" ${k === de0 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <textarea id="trt" rows="4" placeholder="Pega o escribe el texto" style="width:100%;margin-top:10px;border-radius:12px;padding:10px;background:var(--surface2);color:var(--ink);border:1px solid var(--line);font:15px/1.5 var(--f-read)">${esc(texto)}</textarea>
    <div class="row" style="margin-top:10px"><button class="btn" id="trg">Traducir</button></div>
    <div id="tro" style="margin-top:12px"></div><div id="trw" class="gdef" style="margin-top:10px;display:none"></div>`);
  const out = $('#tro', o), pal = $('#trw', o);
  const go = async () => {
    const t = $('#trt', o).value.trim(); if (!t) return toast('Escribe o pega un texto');
    const de = $('#trd', o).value; LS('bv-trad-de', de); boton($('#trg', o), 'Traduciendo…', true); out.innerHTML = '<div class="small">Traduciendo… la primera vez baja el idioma.</div>'; pal.style.display = 'none';
    try {
      const r = await traducirTexto(t, de);
      out.innerHTML = `<div class="rquote" style="font-style:normal">${esc(r)}</div><div class="small" style="margin-top:10px">Toca una palabra del original para ver su significado:</div><div id="trs" style="margin-top:6px;line-height:1.9;font:15px/1.9 var(--f-read)">${t.split(/(\s+)/).map(w => /\S/.test(w) && /\p{L}/u.test(w) ? `<span class="wd5" data-w="${esc(w)}">${esc(w)}</span>` : esc(w)).join('')}</div>`;
      $$('.wd5', o).forEach(s => s.onclick = async () => {
        const w = s.dataset.w.replace(/[^\p{L}'-]/gu, ''); if (!w) return; pal.style.display = 'block'; pal.textContent = 'Buscando ' + w + '…';
        try {
          const tr = await traducirTexto(w, de);
          pal.innerHTML = `<b>${esc(w)}</b> → ${esc(tr)}<div class="row" style="margin-top:8px"><button class="btn" id="trgs">Guardar en el glosario</button></div>`;
          $('#trgs', pal).onclick = async () => {
            const gl = (S.meta.gloss = S.meta.gloss || []); const lw = w.toLowerCase();
            if (!gl.some(x => x.w === lw)) gl.push({ id: newId(), w: lw, def: `Traducción: ${tr}`, ctx: t.slice(0, 200), bookUid: libro?.uid || '', at: Date.now() });
            await saveMeta(); toast('Guardada en el glosario'); $('#trgs', pal).disabled = true;
          };
        } catch (e) { pal.textContent = e.message; }
      });
    } catch (e) { out.innerHTML = `<div class="small" style="color:var(--bad)">${esc(e.message)}</div>`; }
    boton($('#trg', o), 'Traducir', false);
  };
  $('#trg', o).onclick = go; if (texto) go();
}

/* ================================================================== Asistente con Gemini (opcional) */
export const clave = () => LS('bv-gemini') || '';
export const hayAsistente = () => !!clave();
async function gemini(prompt) {
  const k = clave(); if (!k) throw new Error('Falta tu clave de Gemini. Se agrega en Más → Asistente.');
  let ult;
  for (const m of ['gemini-flash-latest', 'gemini-2.5-flash']) {
    try {
      const j = await fetchJ(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: .4, maxOutputTokens: 1000 } }) }, 40000);
      const t = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim(); if (t) return t; throw new Error('Sin respuesta.');
    } catch (e) { ult = e; if (e.status === 400 || e.status === 403) throw new Error('Tu clave no fue aceptada. Revísala en Más → Asistente.'); if (e.status === 429) throw new Error('Llegaste al límite gratuito por ahora. Prueba en unos minutos.'); if (e.status !== 404) break; }
  }
  throw new Error(ult?.name === 'AbortError' ? 'Tardó demasiado en responder.' : 'No pude consultar el asistente. ¿Hay conexión?');
}
export function abrirAsistente(texto, seccion, libro) {
  const base = `Eres un ayudante de lectura. Responde en español claro y sencillo, sin tecnicismos.${libro ? ` El libro es «${libro.t}» de ${libro.a}.` : ''}`;
  const PROMPT = {
    exp: ['Explicación', () => `${base} Explica con palabras simples qué quiere decir este pasaje y su contexto. Máximo 120 palabras.\n\nPasaje: «${texto}»`],
    res: ['Resumen del capítulo', () => `${base} Resume en 5 o 6 líneas lo que ocurre en este fragmento del libro.\n\nTexto:\n${(seccion || texto).slice(0, 12000)}`],
    pre: ['Preguntas para pensar', () => `${base} Escribe 3 preguntas para pensar o conversar en un club de lectura sobre este pasaje.\n\nPasaje: «${(texto.length > 200 ? texto : (seccion || texto)).slice(0, 6000)}»`],
  };
  const o = openSheet(`<h3>Asistente de lectura</h3><div class="quote5">${esc(texto.slice(0, 280))}${texto.length > 280 ? '…' : ''}</div>
    <div class="row" id="asc" style="gap:6px;margin:12px 0">${[['exp', 'Explicar'], ['res', 'Resumir capítulo'], ['pre', 'Preguntas']].map(([k, n]) => `<button class="chip" data-a="${k}" aria-pressed="false">${n}</button>`).join('')}</div>
    <div id="aso" class="gdef" style="min-height:70px;white-space:pre-wrap">Elige qué quieres.</div><div class="small" style="margin-top:8px">Solo se envía este texto a Google. Tu clave se guarda en este dispositivo.</div>`);
  const ir = async k => {
    $$('#asc .chip', o).forEach(c => c.setAttribute('aria-pressed', c.dataset.a === k)); const a = $('#aso', o); a.textContent = 'Pensando…';
    try { a.textContent = await gemini(PROMPT[k][1]()); } catch (e) { a.textContent = e.message; }
  };
  $$('#asc .chip', o).forEach(c => c.onclick = () => ir(c.dataset.a)); ir('exp');
}

/* ================================================================== Notas de voz */
const clavesVoz = n => n.voz;
export async function grabarNota(libro, donde = '') {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return toast('Este dispositivo no puede grabar audio.');
  const o = openSheet(`<h3>Nota de voz</h3><div class="sub">${esc(libro.t)}${donde ? ' · ' + esc(donde) : ''}</div>
    <div style="display:grid;justify-items:center;gap:10px;margin:16px 0"><button class="rec5" id="vrb" aria-label="Grabar">Grabar</button><div class="sub" id="vrs">Toca para empezar a grabar.</div><audio id="vra" controls style="width:100%;display:none"></audio></div>
    <div class="row" id="vrf" style="display:none"><button class="btn" id="vrg">Guardar nota</button><button class="btn ghost" id="vrr">Grabar de nuevo</button></div>
    ${(A?.dictar || window.webkitSpeechRecognition) ? '<div class="row" style="margin-top:10px"><button class="btn ghost" id="vrd">Mejor dictar como texto</button></div>' : ''}`);
  let rec = null, stream = null, chunks = [], blob = null, t0 = 0, tm = null;
  const parar = () => { clearInterval(tm); tm = null; try { if (rec && rec.state !== 'inactive') rec.stop(); } catch { } try { stream?.getTracks().forEach(t => t.stop()); } catch { } stream = null; };
  const vivo = () => document.body.contains(o);
  const ini = async () => {
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { $('#vrs', o).textContent = 'No tengo permiso para el micrófono. Actívalo en los ajustes del teléfono.'; return; }
    chunks = []; blob = null; $('#vra', o).style.display = 'none'; $('#vrf', o).style.display = 'none';
    rec = new MediaRecorder(stream); rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = () => { blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); if (!vivo()) return; const a = $('#vra', o); a.src = URL.createObjectURL(blob); a.style.display = 'block'; $('#vrf', o).style.display = 'flex'; $('#vrb', o).textContent = 'Grabar'; $('#vrb', o).classList.remove('on'); $('#vrs', o).textContent = 'Escúchala y guárdala.'; };
    rec.start(); t0 = Date.now(); $('#vrb', o).classList.add('on'); $('#vrb', o).textContent = 'Parar';
    tm = setInterval(() => { if (!vivo()) return parar(); const s = Math.floor((Date.now() - t0) / 1000); $('#vrs', o).textContent = `Grabando… ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (s >= 300) parar(); }, 250);
  };
  $('#vrb', o).onclick = () => { if (rec && rec.state === 'recording') parar(); else ini(); };
  $('#vrr', o).onclick = ini;
  $('#vrg', o).onclick = async () => {
    if (!blob) return; const seg = Math.max(1, Math.round((Date.now() - t0) / 1000)), key = 'vn-' + newId();
    await db.put('files', blob, key);
    await saveNote({ bookId: libro.id, title: `${libro.t} · ${libro.a}${donde ? ' · ' + donde : ''}`, text: `Nota de voz de ${seg} s${donde ? ' · ' + donde : ''}`, voz: key, seg, color: 'amarillo', createdAt: Date.now() });
    closeSheet(); toast('Nota de voz guardada');
  };
  $('#vrd', o)?.addEventListener('click', () => { parar(); closeSheet(); dictarNota(libro, donde); });
}
export function dictarNota(libro, donde = '') {
  const fin = async t => { t = (t || '').trim(); if (!t) return toast('No escuché nada. Prueba otra vez.'); await saveNote({ bookId: libro.id, title: `${libro.t} · ${libro.a}${donde ? ' · ' + donde : ''}`, text: t, color: 'amarillo', createdAt: Date.now() }); toast('Nota guardada como texto'); };
  if (A?.dictar) { window.__dictado = fin; A.dictar(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return toast('Tu navegador no tiene dictado.');
  const r = new SR(); r.lang = 'es-ES'; r.onresult = e => fin(e.results[0][0].transcript); r.onerror = () => toast('No pude dictar.'); r.start();
}
export const MOODS = ['Tranquila', 'Absorbente', 'Cansada', 'Difícil'];

/* ================================================================== Fondos con frases */
const wrap = (x, t, maxW) => { const out = []; let l = ''; for (const w of t.split(/\s+/)) { const k = l ? l + ' ' + w : w; if (x.measureText(k).width > maxW && l) { out.push(l); l = w; } else l = k; } if (l) out.push(l); return out; };
const ESTILOS = [['noche', 'Noche'], ['papel', 'Papel'], ['oro', 'Oro'], ['mar', 'Mar'], ['libro', 'Color del libro']];
export async function imgFondo(n, estilo = 'noche') {
  await document.fonts?.ready;
  const W = 1080, H = 2340, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const libro = byId(n.bookId), g = x.createLinearGradient(0, 0, W * .6, H);
  let fg = '#F3ECDB', acc = '#E4B861', mut = 'rgba(243,236,219,.7)';
  if (estilo === 'papel') { g.addColorStop(0, '#F1ECE0'); g.addColorStop(1, '#E3DAC3'); fg = '#26221B'; acc = '#1E5F5A'; mut = 'rgba(38,34,27,.6)'; }
  else if (estilo === 'oro') { g.addColorStop(0, '#3a2b10'); g.addColorStop(1, '#14100a'); fg = '#F3DFA6'; acc = '#E4B861'; }
  else if (estilo === 'mar') { g.addColorStop(0, '#1E6F66'); g.addColorStop(1, '#0f3b3a'); fg = '#F0FAF7'; acc = '#BFE9DE'; }
  else if (estilo === 'libro' && libro?.c1) { g.addColorStop(0, libro.c1); g.addColorStop(1, '#0c1214'); fg = '#fff'; acc = libro.c2 || '#E4B861'; }
  else { g.addColorStop(0, '#16262A'); g.addColorStop(1, '#0b1114'); }
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = acc; x.font = "400 260px 'Young Serif', Georgia, serif"; x.fillText('“', 90, 900);
  let size = 78, lines; const t = n.text.trim().slice(0, 420);
  for (; size >= 42; size -= 4) { x.font = `italic 400 ${size}px Newsreader, Georgia, serif`; lines = wrap(x, t, W - 200); if (lines.length * size * 1.4 < 900) break; }
  x.fillStyle = fg; let y = 1010; for (const l of lines) { x.fillText(l, 100, y); y += size * 1.4; }
  x.fillStyle = acc; x.fillRect(100, y + 30, 90, 6);
  x.fillStyle = fg; x.font = '600 38px Figtree, system-ui, sans-serif'; x.fillText((n.title || '').slice(0, 46), 100, y + 100);
  x.fillStyle = mut; x.font = '400 30px Figtree, system-ui, sans-serif'; x.fillText('Mi Biblioteca Viva', 100, H - 260);
  return new Promise(r => c.toBlob(r, 'image/png'));
}
const frasesBuenas = () => S.notes.filter(n => !n.voz && n.text && n.text.length >= 20 && n.text.length <= 420 && (!byId(n.bookId) || visible(byId(n.bookId))));
const cfgFondo = () => { try { return JSON.parse(LS('bv-fondo') || '{}'); } catch { return {}; } };
const guardaFondo = c => LS('bv-fondo', JSON.stringify(c));
export async function aplicarFondoDiario() {
  if (!A?.ponerFondo) return; const c = cfgFondo(); if (!c.on || c.ult === today()) return;
  const fr = frasesBuenas(); if (!fr.length) return;
  const n = fr[Math.floor(Math.random() * fr.length)];
  try { const b = await imgFondo(n, c.estilo || 'noche'); window.__fondoOk = () => { c.ult = today(); guardaFondo(c); }; A.ponerFondo(await blobToB64(b), c.donde || 'ambos'); } catch { }
}

/* ================================================================== QR */
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
function qrCanvas(texto, px = 640) {
  const q = qrcode(0, 'L'); q.addData(texto, 'Byte'); q.make(); const n = q.getModuleCount(), m = 4, cell = Math.floor(px / (n + m * 2)), tam = cell * (n + m * 2);
  const c = document.createElement('canvas'); c.width = c.height = tam; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, tam, tam); x.fillStyle = '#0b1114';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect((k + m) * cell, (r + m) * cell, cell, cell);
  return c;
}
const b64u = s => btoa(unescape(encodeURIComponent(s))), ub64 = s => decodeURIComponent(escape(atob(s)));
export function cargaListaQr() {
  let items = S.meta.wish.map(w => [w.t, w.a || '']), txt;
  const arma = () => 'bv1:' + b64u(JSON.stringify({ k: 'w', w: items }));
  txt = arma(); while (txt.length > 1100 && items.length > 1) { items = items.slice(0, -1); txt = arma(); }
  return { texto: txt, n: items.length, total: S.meta.wish.length };
}
export function textoApp() { return 'https://github.com/plateresco/biblioteca-viva/releases/latest'; }
export async function importarQr(texto) {
  if (!texto) return;
  if (!texto.startsWith('bv1:')) {
    if (/^https?:\/\//i.test(texto)) { const o = openSheet(`<h3>Enlace escaneado</h3><p class="small" style="word-break:break-all">${esc(texto)}</p><div class="row" style="margin-top:12px"><button class="btn" id="qab">Abrir</button><button class="btn ghost" data-x>Cerrar</button></div>`); $('#qab', o).onclick = () => { if (A?.abrirExterno) A.abrirExterno(texto); else window.open(texto, '_blank', 'noopener'); }; return; }
    return toast('Ese código no es de Mi Biblioteca Viva.');
  }
  let d; try { d = JSON.parse(ub64(texto.slice(4))); } catch { return toast('No pude leer ese código.'); }
  if (d.k === 'w') {
    const nuevos = d.w.filter(([t]) => t && !S.meta.wish.some(w => norm(w.t) === norm(t)) && !S.books.some(b => norm(b.t) === norm(t)));
    const o = openSheet(`<h3>Lista recibida</h3><div class="sub">${d.w.length} libros · ${nuevos.length} nuevos para ti</div><div style="display:grid;gap:6px;margin-top:10px;max-height:40vh;overflow:auto">${nuevos.map(([t, a]) => `<div class="small"><b>${esc(t)}</b>${a ? ' · ' + esc(a) : ''}</div>`).join('') || '<div class="small">Ya tienes todo en tu biblioteca o en tu lista.</div>'}</div>
      <div class="row" style="margin-top:14px">${nuevos.length ? '<button class="btn" id="qli">Agregar a mi lista de deseos</button>' : ''}<button class="btn ghost" data-x>Cerrar</button></div>`);
    $('#qli', o)?.addEventListener('click', async () => { nuevos.forEach(([t, a]) => S.meta.wish.push({ id: newId(), t, a })); await saveMeta(); closeSheet(); toast(`${nuevos.length} libros agregados a tu lista de deseos`); });
  } else if (d.k === 'c') {
    const mine = S.books.find(b => norm(b.t) === norm(d.t));
    const o = openSheet(`<h3>Plan de club de lectura</h3><div class="sub"><b>${esc(d.t)}</b>${d.a ? ' · ' + esc(d.a) : ''}</div><p style="margin-top:10px">Terminarlo antes del <b>${esc(d.fin)}</b>${d.ini ? `, empezando el ${esc(d.ini)}` : ''}.</p>
      <div class="row" style="margin-top:14px"><button class="btn" id="qcl">${mine ? 'Poner esta fecha en mi plan' : 'Guardarlo en mi lista de deseos'}</button><button class="btn ghost" data-x>Cerrar</button></div>`);
    $('#qcl', o).onclick = async () => { if (mine) await fijarPlan(mine, d.fin); else { S.meta.wish.push({ id: newId(), t: d.t, a: d.a || '', note: 'Club hasta ' + d.fin }); await saveMeta(); } closeSheet(); toast('Listo'); };
  } else toast('Ese código es de una versión más nueva de la app.');
}
export function escanearQr() {
  if (A?.escanearQr) { window.__qrEscaneado = importarQr; A.escanearQr(); return; }
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) return toast('Tu navegador no puede leer códigos QR.');
  const o = openSheet('<h3>Escanear código QR</h3><video id="qrv" playsinline muted style="width:100%;border-radius:14px;background:#000;margin-top:10px"></video><div class="row" style="margin-top:10px"><button class="btn ghost" data-x>Cancelar</button></div>');
  import('./isbn.js').then(async m => {
    try { await m.startScan($('#qrv', o), t => { closeSheet(); importarQr(t); }, () => document.body.contains(o), ['qr_code']); } catch { toast('No pude abrir la cámara.'); }
  });
}

/* ================================================================== Catálogos OPDS */
const getCats = () => { try { return JSON.parse(LS('bv-opds') || '[]'); } catch { return []; } };
const setCats = l => LS('bv-opds', JSON.stringify(l));
async function traerFeed(u) {
  const txt = A?.httpGet ? await httpApp(u) : await (await fetch(u)).text();
  const d = new DOMParser().parseFromString(txt, 'text/xml'); if (d.querySelector('parsererror')) throw new Error('Esa dirección no devolvió un catálogo OPDS.');
  const L = (e, ...rels) => [...e.children].filter(k => k.localName === 'link');
  const abs = h => { try { return new URL(h, u).href; } catch { return ''; } };
  const entries = [...d.querySelectorAll('entry')].map(e => {
    const links = L(e), adq = links.find(l => /opds-spec\.org\/acquisition/.test(l.getAttribute('rel') || '') && /epub/i.test(l.getAttribute('type') || '')), nav = links.find(l => /atom\+xml|opds/i.test(l.getAttribute('type') || '') && !/acquisition/.test(l.getAttribute('rel') || ''));
    return { t: e.querySelector('title')?.textContent.trim() || '(sin título)', a: e.querySelector('author > name')?.textContent.trim() || e.querySelector('content')?.textContent.trim().slice(0, 90) || '', epub: adq ? abs(adq.getAttribute('href')) : '', nav: !adq && nav ? abs(nav.getAttribute('href')) : '' };
  });
  const next = L(d.documentElement).find(l => l.getAttribute('rel') === 'next');
  return { titulo: d.querySelector('feed > title')?.textContent.trim() || '', entries, next: next ? abs(next.getAttribute('href')) : '' };
}

/* ================================================================== Páginas de «Más» */
const bloque = (t, sub, cuerpo) => `<div class="card"><h3>${t}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}${cuerpo || ''}</div>`;

export const MENU5 = [
  ['primeros', 'Primeros pasos', resumenPasos, 'star'],
  ['novedades', 'Qué hay de nuevo', () => 'Lo último que se agregó', 'spark'],
  ['linea', 'Línea de tiempo', () => { const n = S.books.filter(b => b.anio).length; return n ? `${n} libros por época` : 'Tus libros por año de publicación'; }, 'clock'],
  ['datos', 'Completar datos', () => { const n = S.books.filter(b => !b.anio || !(b.gen || []).length).length; return n ? `${n} libros con datos por completar` : 'Género, año y páginas al día'; }, 'search'],
  ...(esApp ? [['estanteria', 'Escanear estantería', () => 'Una foto de tus lomos agrega los libros', 'camera']] : []),
  ['traducir', 'Traducir', () => 'Un párrafo o una palabra, sin conexión', 'book'],
  ['notasvoz', 'Notas de voz y ánimo', () => `${S.notes.filter(clavesVoz).length} notas de voz`, 'phones'],
  ['fondos', 'Frases como fondo', () => cfgFondo().on ? 'Cambia sola cada día' : 'Tus frases en la pantalla del teléfono', 'image'],
  ['qr', 'Compartir con código QR', () => 'Listas, planes de club y la app', 'image'],
  ['asistente', 'Asistente de lectura', () => hayAsistente() ? 'Activo con tu clave de Gemini' : 'Opcional, con tu clave gratuita', 'spark'],
  ['opds', 'Catálogos propios (OPDS)', () => { const n = getCats().length; return n ? `${n} catálogos` : 'Calibre en casa u otros catálogos'; }, 'download'],
];

export const PAGES5 = {
  /* ---- Primeros pasos ---- */
  primeros(b, ctx, redraw, ir) {
    const p = pasosPrimeros(), n = p.filter(x => x.hecho).length;
    b.innerHTML = bloque('Primeros pasos', `${n} de ${p.length} hechos. Se marcan solos mientras usas la app.`, `<div class="prog5"><i style="width:${n / p.length * 100}%"></i></div>
      <div class="chk5">${p.map(x => `<div class="${x.hecho ? 'ok' : ''}"><span class="tick5">${x.hecho ? '✓' : ''}</span><span style="flex:1">${esc(x.t)}</span>${!x.hecho && x.ir ? `<button class="btn ghost" data-i="${x.ir}">Ir</button>` : ''}</div>`).join('')}</div>`);
    $$('[data-i]', b).forEach(x => x.onclick = () => ir(x.dataset.i));
  },
  novedades(b) {
    b.innerHTML = CAMBIOS.map(c => bloque(c.t, '', `<div class="nov5">${c.l.map(([k, x]) => `<div><i>${k}</i><span>${esc(x)}</span></div>`).join('')}</div>`)).join('');
  },

  /* ---- Datos automáticos ---- */
  datos(b, ctx, redraw) {
    const falta = S.books.filter(x => visible(x) && (!x.anio || !(x.gen || []).length));
    b.innerHTML = bloque('Completar datos', 'Busca en Open Library (gratis) el año de la primera edición, el género y las páginas que falten. Antes de guardar ves los cambios y eliges cuáles aceptar.',
      `<div class="small" style="margin:10px 0">${falta.length ? `${falta.length} libros con algo por completar.` : 'Todos tus libros tienen año y género.'}</div>${falta.length ? '<button class="btn" id="dgo">Buscar datos</button>' : ''}`);
    $('#dgo', b)?.addEventListener('click', async () => {
      const o = openSheet('<h3>Buscando datos…</h3><div class="sub" id="dps">Preparando</div><div class="prog5"><i id="dpb" style="width:0%"></i></div><div class="row" style="margin-top:12px"><button class="btn ghost" id="dcn">Cancelar</button></div>');
      let corta = false; $('#dcn', o).onclick = () => { corta = true; };
      const props = [];
      for (let i = 0; i < falta.length && !corta; i++) {
        const x = falta[i]; $('#dps', o) && ($('#dps', o).textContent = `${i + 1} de ${falta.length}: ${x.t}`); $('#dpb', o) && ($('#dpb', o).style.width = (i / falta.length * 100) + '%');
        try {
          const todos = (await buscarOL(x.t, x.a && !/desconocid/i.test(x.a) ? x.a : '')).filter(z => autorOk(z, x)), exactos = todos.filter(z => norm(z.title) === norm(x.t)), ds = exactos.length ? exactos : todos.filter(z => coincide(z.title, x.t)).slice(0, 1), d = ds[0] && { ...ds[0], first_publish_year: Math.min(...ds.map(z => z.first_publish_year || 9999)) === 9999 ? undefined : Math.min(...ds.map(z => z.first_publish_year || 9999)), subject: ds.flatMap(z => z.subject || []) };
          if (d) { const nu = {}; if (!x.anio && d.first_publish_year) nu.anio = d.first_publish_year; const g = generoDe(d.subject); if (!(x.gen || []).length && g.length) nu.gen = g; if (!x.p && d.number_of_pages_median) nu.p = d.number_of_pages_median; if (Object.keys(nu).length) props.push({ x, nu, on: true }); }
        } catch (e) { if (!navigator.onLine) { toast('Sin conexión a internet'); break; } }
        await wait(300);
      }
      if (!document.body.contains(o)) return;
      if (!props.length) { $('#dps', o).textContent = 'No encontré datos nuevos.'; $('#dcn', o).textContent = 'Cerrar'; $('#dcn', o).onclick = closeSheet; return; }
      const o2 = openSheet(`<h3>Cambios propuestos</h3><div class="sub">Desmarca los que no quieras.</div><div id="dpl" style="display:grid;gap:6px;margin:12px 0;max-height:46vh;overflow:auto">${props.map((p, k) => `<label class="chk2" style="align-items:flex-start"><input type="checkbox" data-k="${k}" checked><span><b>${esc(p.x.t)}</b><br><span class="small">${[p.nu.anio, (p.nu.gen || []).join(', '), p.nu.p ? p.nu.p + ' págs.' : ''].filter(Boolean).join(' · ')}</span></span></label>`).join('')}</div><div class="row"><button class="btn" id="dok">Aplicar</button><button class="btn ghost" data-x>Cancelar</button></div>`);
      $$('#dpl input', o2).forEach(c => c.onchange = () => { props[+c.dataset.k].on = c.checked; });
      $('#dok', o2).onclick = async () => { let n = 0; for (const p of props) if (p.on) { Object.assign(p.x, p.nu); await saveBook(p.x); n++; } closeSheet(); toast(`${n} libros actualizados`); redraw(); };
    });
  },
  linea(b, ctx, redraw, ir) {
    const con = S.books.filter(x => visible(x) && x.anio).sort((a, z) => a.anio - z.anio);
    if (!con.length) { b.innerHTML = bloque('Línea de tiempo', 'Aún no hay libros con año de publicación.', '<div class="row" style="margin-top:12px"><button class="btn" id="lgo">Completar datos</button></div>'); $('#lgo', b).onclick = () => ir('datos'); return; }
    const min = con[0].anio, max = con[con.length - 1].anio;
    b.innerHTML = bloque('Mis libros por época', `${con.length} libros con año conocido.`, `<div id="lbr" style="margin-top:12px"></div><label class="small" style="display:grid;gap:4px;margin-top:12px">Hasta el año <b id="lyr">${max}</b><input id="lsl" type="range" min="${min}" max="${max}" value="${max}" aria-label="Hasta el año"></label>`) + '<div id="llt"></div>';
    const pinta = hasta => {
      const vis = con.filter(x => x.anio <= hasta), mx = Math.max(1, ...ERAS.map(e => vis.filter(x => x.anio >= e[0] && x.anio < e[1]).length));
      $('#lbr', b).innerHTML = ERAS.map(e => { const n = vis.filter(x => x.anio >= e[0] && x.anio < e[1]).length; return `<div class="era5"><span>${e[2]}</span><i style="width:${n / mx * 100}%"></i><b>${n}</b></div>`; }).join('');
      $('#llt', b).innerHTML = ERAS.map(e => { const l = vis.filter(x => x.anio >= e[0] && x.anio < e[1]); return l.length ? bloque(e[2], '', l.map(x => `<div class="lrow5"><span class="sp5" style="background:${esc(x.c1 || '#888')}"></span><span style="flex:1;min-width:0"><b>${esc(x.t)}</b><span class="small" style="display:block">${esc(x.a || '')}</span></span><span class="small">${x.anio}</span></div>`).join('')) : ''; }).join('');
    };
    $('#lsl', b).oninput = e => { $('#lyr', b).textContent = e.target.value; pinta(+e.target.value); }; pinta(max);
  },

  /* ---- Escanear estantería ---- */
  estanteria(b) {
    b.innerHTML = bloque('Escanear estantería', 'Toma una foto de los lomos (derecha, con buena luz). El teléfono lee los títulos, los busca en Open Library y tú eliges cuáles agregar. Si la foto sale torcida, prueba con el teléfono de lado.', '<div class="row" style="margin-top:12px"><button class="btn" id="egf">Tomar foto</button></div>');
    $('#egf', b).onclick = () => {
      if (!A?.escanearPagina) return toast('Esto funciona en la app de Android.');
      window.__ocrTexto = texto => revisarLomos(texto);
      window.__ocrError = m => toast(m || 'No pude leer la foto.');
      A.escanearPagina();
    };
  },

  /* ---- Traducir, voz, fondos ---- */
  traducir(b) {
    b.innerHTML = bloque('Traducir', 'También aparece al seleccionar un texto mientras lees. Traduce al español.', '<div class="row" style="margin-top:12px"><button class="btn" id="tgo">Abrir el traductor</button></div>');
    $('#tgo', b).onclick = () => abrirTraductor('');
  },
  async notasvoz(b, ctx, redraw) {
    const vs = S.notes.filter(clavesVoz).sort((a, z) => z.createdAt - a.createdAt), ses = (S.meta.sesiones || []).filter(s => s.mood);
    const porMood = MOODS.map(m => { const l = ses.filter(s => s.mood === m); return [m, l.length, l.length ? Math.round(l.reduce((a, s) => a + s.min, 0) / l.length) : 0]; }), mx = Math.max(1, ...porMood.map(x => x[1]));
    b.innerHTML = bloque('Notas de voz', 'Se graban desde el panel de subrayados del lector. Quedan en este dispositivo.',
      `<div style="display:grid;gap:8px;margin-top:10px">${vs.map(n => `<div class="vn5" data-id="${n.id}"><span style="flex:1;min-width:0"><b>${esc((n.title || '').slice(0, 60))}</b><span class="small" style="display:block">${new Date(n.createdAt).toLocaleDateString('es-CL')} · ${n.seg || '?'} s</span></span><button class="btn ghost" data-p="${n.id}">Escuchar</button><button class="btn ghost" data-d="${n.id}" aria-label="Borrar nota de voz">Borrar</button></div>`).join('') || '<div class="small">Aún no grabas ninguna.</div>'}</div><audio id="vpl" controls style="width:100%;margin-top:10px;display:none"></audio>`)
      + bloque('Cómo te sentiste', ses.length ? `${ses.length} sesiones de foco con etiqueta.` : 'Al terminar una sesión de foco puedes marcar cómo fue.', ses.length ? `<div style="margin-top:10px">${porMood.map(([m, n, min]) => `<div class="era5"><span>${m}</span><i style="width:${n / mx * 100}%"></i><b>${n}</b></div>${n ? `<div class="small" style="margin:-4px 0 6px">promedio ${min} min</div>` : ''}`).join('')}</div>` : '');
    const au = $('#vpl', b);
    $$('[data-p]', b).forEach(x => x.onclick = async () => { const n = S.notes.find(k => k.id === +x.dataset.p), f = await db.get('files', n.voz); if (!f) return toast('El audio no está en este dispositivo.'); au.style.display = 'block'; au.src = URL.createObjectURL(f); au.play(); });
    $$('[data-d]', b).forEach(x => x.onclick = async () => { const n = S.notes.find(k => k.id === +x.dataset.d); if (!n) return; await db.del('files', n.voz); await removeNote(n.id); toast('Nota de voz borrada'); redraw(); });
  },
  async fondos(b, ctx, redraw) {
    const c = cfgFondo(), fr = frasesBuenas();
    if (!fr.length) { b.innerHTML = bloque('Frases como fondo', 'Necesitas al menos una frase guardada (de 20 a 420 letras).'); return; }
    let estilo = c.estilo || 'noche', n = fr[Math.floor(Math.random() * fr.length)], url = '';
    b.innerHTML = bloque('Frases como fondo', 'Se dibuja en el teléfono con una de tus frases.', `<div class="row" id="fes" style="gap:6px;margin:12px 0">${ESTILOS.map(([k, t]) => `<button class="chip" data-e="${k}" aria-pressed="${k === estilo}">${t}</button>`).join('')}</div>
      <img id="fim" alt="Vista previa del fondo" style="display:block;width:min(100%,200px);margin:0 auto;border-radius:18px;box-shadow:0 12px 30px -12px rgba(0,0,0,.6)">
      <div class="row" style="margin-top:14px;justify-content:center"><button class="btn ghost" id="fot">Otra frase</button><button class="btn ghost" id="fsh">Compartir</button></div>
      ${A?.ponerFondo ? `<label style="display:grid;gap:4px;margin-top:14px;font-size:13px">Dónde ponerlo<select id="fdo">${[['ambos', 'Inicio y bloqueo'], ['inicio', 'Pantalla de inicio'], ['bloqueo', 'Pantalla de bloqueo']].map(([k, t]) => `<option value="${k}" ${(c.donde || 'ambos') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <div class="row" style="margin-top:12px"><button class="btn" id="fpo">Poner como fondo</button></div>
        <label class="chk2" style="margin-top:12px"><input type="checkbox" id="fdi" ${c.on ? 'checked' : ''}> Cambiar sola cada día (al abrir la app)</label>` : '<div class="small" style="margin-top:12px">Poner el fondo directo funciona en la app de Android. Aquí puedes guardar la imagen.</div>'}`);
    const pinta = async () => { const bl = await imgFondo(n, estilo); if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(bl); $('#fim', b).src = url; return bl; };
    await pinta();
    $$('#fes [data-e]', b).forEach(x => x.onclick = async () => { estilo = x.dataset.e; $$('#fes [data-e]', b).forEach(k => k.setAttribute('aria-pressed', k === x)); const cf = cfgFondo(); cf.estilo = estilo; guardaFondo(cf); await pinta(); });
    $('#fot', b).onclick = async () => { n = fr[Math.floor(Math.random() * fr.length)]; await pinta(); };
    $('#fsh', b).onclick = async () => shareImage(await imgFondo(n, estilo), 'fondo-biblioteca.png', '');
    $('#fpo', b)?.addEventListener('click', async () => {
      const bt = $('#fpo', b); boton(bt, 'Poniendo…', true);
      window.__fondoOk = () => { boton(bt, 'Poner como fondo', false); toast('Fondo cambiado'); }; window.__fondoError = () => { boton(bt, 'Poner como fondo', false); toast('No pude cambiar el fondo'); };
      const cf = cfgFondo(); cf.donde = $('#fdo', b).value; guardaFondo(cf); A.ponerFondo(await blobToB64(await imgFondo(n, estilo)), cf.donde);
    });
    $('#fdi', b)?.addEventListener('change', e => { const cf = cfgFondo(); cf.on = e.target.checked; cf.estilo = estilo; cf.donde = $('#fdo', b).value; cf.ult = ''; guardaFondo(cf); toast(cf.on ? 'Mañana tendrás una frase nueva' : 'Apagado'); });
  },

  /* ---- QR ---- */
  qr(b) {
    let modo = 'lista', cv = null;
    b.innerHTML = bloque('Compartir con código QR', 'Se dibuja en el teléfono, sin cuentas ni servidores. Quien lo escanea con esta app recibe el contenido.', `<div class="row" id="qm" style="gap:6px;margin:12px 0">${[['lista', 'Lista de deseos'], ['club', 'Plan de club'], ['app', 'La app']].map(([k, t]) => `<button class="chip" data-m="${k}" aria-pressed="${k === 'lista'}">${t}</button>`).join('')}</div>
      <div id="qx"></div><div style="background:#fff;border-radius:14px;padding:6px;width:min(100%,260px);margin:14px auto"><div id="qc" style="display:block;line-height:0"></div></div><div class="small" id="qn" style="text-align:center"></div>
      <div class="row" style="margin-top:14px;justify-content:center"><button class="btn" id="qsh">Compartir imagen</button><button class="btn ghost" id="qsc">Escanear uno</button></div>`);
    const pinta = () => {
      let texto = '', nota = '', extra = '';
      if (modo === 'lista') { const l = cargaListaQr(); texto = l.texto; nota = l.total ? `${l.n} de ${l.total} libros caben en el código.` : 'Tu lista de deseos está vacía.'; if (!l.total) texto = ''; $('#qx', b).innerHTML = ''; }
      else if (modo === 'app') { texto = textoApp(); nota = 'Enlace para instalar la app.'; $('#qx', b).innerHTML = ''; }
      else {
        const libros = S.books.filter(x => x.s !== 'leido'), hoy = new Date(), f = new Date(hoy.getTime() + 28 * 864e5).toISOString().slice(0, 10);
        if (!$('#qcl', b)) $('#qx', b).innerHTML = `<label class="small" style="display:grid;gap:4px">Libro<select id="qcl">${libros.map(x => `<option value="${x.id}">${esc(x.t)}</option>`).join('')}</select></label><label class="small" style="display:grid;gap:4px;margin-top:8px">Terminarlo antes del<input id="qcf" type="date" value="${f}"></label>`;
        const x = byId(+$('#qcl', b)?.value); if (x) { texto = 'bv1:' + b64u(JSON.stringify({ k: 'c', t: x.t, a: x.a || '', ini: today(), fin: $('#qcf', b).value })); nota = 'Cada persona lo guarda en su plan.'; $('#qcl', b).onchange = $('#qcf', b).onchange = pinta; } else nota = 'No tienes libros por leer.';
      }
      $('#qc', b).innerHTML = ''; cv = null; if (texto) { cv = qrCanvas(texto); cv.style.cssText = 'width:100%;height:auto;display:block'; $('#qc', b).appendChild(cv); }
      $('#qn', b).textContent = nota; $('#qsh', b).disabled = !cv;
    };
    $$('#qm [data-m]', b).forEach(x => x.onclick = () => { modo = x.dataset.m; $$('#qm [data-m]', b).forEach(k => k.setAttribute('aria-pressed', k === x)); if (modo !== 'club') $('#qx', b).innerHTML = ''; pinta(); });
    $('#qsh', b).onclick = async () => {
      if (!cv) return; const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      x.fillStyle = '#16262A'; x.fillRect(0, 0, W, H); x.drawImage(cv, 140, 260, 800, 800); x.fillStyle = '#F3ECDB'; x.font = "400 64px 'Young Serif', Georgia, serif"; x.fillText({ lista: 'Mi lista de lectura', club: 'Club de lectura', app: 'Mi Biblioteca Viva' }[modo], 140, 170);
      x.fillStyle = '#A9B7B3'; x.font = '400 32px Figtree, system-ui, sans-serif'; x.fillText('Escanéalo con Mi Biblioteca Viva', 140, 1150);
      shareImage(await new Promise(r => c.toBlob(r, 'image/png')), 'qr-biblioteca.png', '');
    };
    $('#qsc', b).onclick = escanearQr; pinta();
  },

  /* ---- Asistente ---- */
  asistente(b, ctx, redraw) {
    b.innerHTML = bloque('Asistente de lectura', 'Opcional. Explica un pasaje, resume un capítulo y hace preguntas usando Gemini, de Google. Es gratis con tu propia clave.', `<ol class="help" style="margin-top:10px"><li>Entra a <b>aistudio.google.com/apikey</b> e inicia sesión con tu cuenta de Google.</li><li>Crea una clave (sin tarjeta, sin pago) y cópiala.</li><li>Pégala aquí.</li></ol>
      <label style="display:grid;gap:4px;margin-top:10px;font-size:13px">Tu clave<input id="gk" type="password" autocomplete="off" value="${esc(clave())}" placeholder="AIza…"></label>
      <div class="row" style="margin-top:12px"><button class="btn" id="gsv">Guardar</button>${clave() ? '<button class="btn ghost" id="gqt">Quitar clave</button>' : ''}<button class="btn ghost" id="gab">Abrir la página de claves</button></div>
      <div class="small" style="margin-top:10px">Al usarlo, solo se envía a Google el texto que seleccionas. La clave queda en este dispositivo y no se sincroniza. ${clave() ? 'Mientras lees, selecciona un texto y toca «Explicar».' : ''}</div>`);
    $('#gsv', b).onclick = () => { LS('bv-gemini', $('#gk', b).value.trim() || null); toast('Guardado'); redraw(); };
    $('#gqt', b)?.addEventListener('click', () => { LS('bv-gemini', null); toast('Clave quitada'); redraw(); });
    $('#gab', b).onclick = () => { const u = 'https://aistudio.google.com/apikey'; if (A?.abrirExterno) A.abrirExterno(u); else window.open(u, '_blank', 'noopener'); };
  },

  /* ---- OPDS ---- */
  opds(b, ctx, redraw) {
    const cats = getCats();
    b.innerHTML = bloque('Catálogos propios (OPDS)', 'Conecta tu biblioteca de Calibre (con «Content server» o Calibre-Web) u otro catálogo OPDS. En la app se aceptan direcciones de tu red de casa (http://192.168…) y catálogos de Gutenberg, Standard Ebooks y Feedbooks.',
      `<div style="display:grid;gap:8px;margin-top:12px">${cats.map((c, i) => `<div class="vn5"><span style="flex:1;min-width:0"><b>${esc(c.n)}</b><span class="small" style="display:block;word-break:break-all">${esc(c.u)}</span></span><button class="btn" data-o="${i}">Abrir</button><button class="btn ghost" data-q="${i}" aria-label="Quitar">Quitar</button></div>`).join('') || '<div class="small">Aún no agregas ninguno.</div>'}</div>
      <form class="inl wrapf" id="ofm" style="margin-top:14px"><input name="n" placeholder="Nombre (ej. Mi Calibre)" aria-label="Nombre" maxlength="30"><input name="u" type="url" placeholder="http://192.168.1.20:8083/opds" aria-label="Dirección" required><button class="btn" type="submit">Agregar</button></form>`);
    $('#ofm', b).onsubmit = e => { e.preventDefault(); const d = new FormData(e.target), u = d.get('u').trim(); setCats(cats.concat({ n: d.get('n').trim() || new URL(u).host, u })); redraw(); };
    $$('[data-q]', b).forEach(x => x.onclick = () => { cats.splice(+x.dataset.q, 1); setCats(cats); redraw(); });
    $$('[data-o]', b).forEach(x => x.onclick = () => navegarOpds(cats[+x.dataset.o]));
  },
};

/* ---------- navegador de un catálogo OPDS ---------- */
function navegarOpds(cat) {
  const pila = [];
  const o = openSheet(`<h3>${esc(cat.n)}</h3><div class="row" style="gap:8px;margin:10px 0"><button class="btn ghost" id="ok1" hidden>Atrás</button></div><div id="ol" style="display:grid;gap:8px;max-height:56vh;overflow:auto"></div>`);
  const carga = async (u, anexa = false) => {
    const l = $('#ol', o); if (!anexa) l.innerHTML = '<div class="skel"><i></i><i></i><i></i></div>';
    try {
      const f = await traerFeed(u); if (!anexa) l.innerHTML = ''; else $('#omas', l)?.remove();
      f.entries.forEach(e => {
        const d = document.createElement('div'); d.className = 'cat2'; d.innerHTML = `<div style="min-width:0;flex:1"><b>${esc(e.t)}</b><div class="small">${esc(e.a)}</div></div>${e.epub ? '<button class="btn">Agregar</button>' : e.nav ? '<button class="btn ghost">Abrir</button>' : ''}`; l.appendChild(d);
        const bt = d.querySelector('button'); if (!bt) return;
        if (e.nav) bt.onclick = () => { pila.push(u); $('#ok1', o).hidden = false; carga(e.nav); };
        else bt.onclick = () => {
          if (!A?.descargarEpub) { window.open(e.epub, '_blank', 'noopener'); return; }
          boton(bt, 'Bajando…', true); window.__descargaOk = () => { bt.textContent = 'En tu estante'; bt.classList.add('ghost'); }; window.__descargaError = m => { boton(bt, 'Agregar', false); toast(m || 'No se pudo bajar'); };
          A.descargarEpub(e.epub, (e.t || 'libro').slice(0, 40) + '.epub');
        };
      });
      if (!f.entries.length) l.innerHTML = '<div class="small">No hay nada aquí.</div>';
      if (f.next) { const m = document.createElement('button'); m.className = 'btn ghost'; m.id = 'omas'; m.textContent = 'Ver más'; m.onclick = () => carga(f.next, true); l.appendChild(m); }
    } catch (e) { l.innerHTML = `<div class="small" style="color:var(--bad)">${esc(e.message || 'No pude conectar con el catálogo.')}</div>`; }
  };
  $('#ok1', o).onclick = () => { const u = pila.pop(); if (!pila.length) $('#ok1', o).hidden = true; carga(u); };
  carga(cat.u);
}

/* ---------- revisar los lomos leídos con la cámara ---------- */
function revisarLomos(texto) {
  const lineas = [...new Set(String(texto).split(/\n+/).map(s => s.trim()).filter(s => s.length >= 4 && s.length <= 70 && (s.match(/\p{L}/gu) || []).length >= 4))].slice(0, 40);
  const o = openSheet(`<h3>Títulos leídos</h3><div class="sub">Corrige o borra líneas: una por libro. Se buscan en Open Library.</div>
    <textarea id="lst" rows="8" style="width:100%;margin-top:10px;border-radius:12px;padding:10px;background:var(--surface2);color:var(--ink);border:1px solid var(--line);font:15px/1.5 var(--f-body)">${esc(lineas.join('\n'))}</textarea>
    <div class="row" style="margin-top:12px"><button class="btn" id="lbs">Buscar</button><button class="btn ghost" id="lot">Otra foto</button></div><div id="lre" style="margin-top:12px"></div>`);
  $('#lot', o).onclick = () => { closeSheet(); setTimeout(() => A.escanearPagina(), 150); };
  $('#lbs', o).onclick = async () => {
    const qs = $('#lst', o).value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 40), res = $('#lre', o); boton($('#lbs', o), 'Buscando…', true);
    const items = [];
    for (let i = 0; i < qs.length; i++) {
      res.textContent = `Buscando ${i + 1} de ${qs.length}…`;
      try { const d = (await buscarOL(qs[i]))[0]; if (d && d.title) { const rep = S.books.some(x => norm(x.t) === norm(d.title)); items.push({ q: qs[i], t: d.title, a: (d.author_name || [])[0] || 'Autor desconocido', p: d.number_of_pages_median || 0, cov: d.cover_i, anio: d.first_publish_year, gen: generoDe(d.subject), rep, on: !rep }); } else items.push({ q: qs[i], t: qs[i], a: 'Autor desconocido', p: 0, rep: false, on: false, sin: true }); } catch { items.push({ q: qs[i], t: qs[i], a: 'Autor desconocido', p: 0, on: false, sin: true }); }
      await wait(250);
    }
    boton($('#lbs', o), 'Buscar', false);
    const pinta = () => {
      res.innerHTML = `<div style="display:grid;gap:6px;max-height:34vh;overflow:auto">${items.map((it, k) => `<label class="chk2" style="align-items:flex-start"><input type="checkbox" data-k="${k}" ${it.on ? 'checked' : ''}><span><b>${esc(it.t)}</b><br><span class="small">${esc(it.a)}${it.rep ? ' · ya lo tienes' : it.sin ? ' · sin coincidencia, se agrega como lo leí' : ''}</span></span></label>`).join('')}</div><div class="row" style="margin-top:12px"><button class="btn" id="lad">Agregar ${items.filter(i => i.on).length} libros</button></div>`;
      $$('input', res).forEach(c => c.onchange = () => { items[+c.dataset.k].on = c.checked; pinta(); });
      $('#lad', res).onclick = async () => {
        const bt = $('#lad', res); boton(bt, 'Agregando…', true); let n = 0;
        for (const it of items.filter(i => i.on)) {
          let cover = null; if (it.cov) { try { const r = await fetch(`https://covers.openlibrary.org/b/id/${it.cov}-M.jpg?default=false`); if (r.ok) { const bl = await r.blob(); if (bl.size > 1500) cover = await shrinkImage(bl); } } catch { } }
          const col = cover ? await coverColors(cover, it.t) : fallbackColors(it.t);
          await addBook({ t: it.t, a: it.a, p: it.p || 250, f: 'Papel', hasFile: false, cover, ...(it.anio ? { anio: it.anio } : {}), ...((it.gen || []).length ? { gen: it.gen } : {}), ...col }); n++;
        }
        closeSheet(); toast(`${n} libros agregados a «Por leer»`);
      };
    };
    pinta();
  };
}

/* ---------- botón central «＋» de la barra inferior ---------- */
export function escanearEstanteria() {
  if (!A?.escanearPagina) return toast('Esto funciona en la app de Android.');
  window.__ocrTexto = texto => revisarLomos(texto); window.__ocrError = m => toast(m || 'No pude leer la foto.'); A.escanearPagina();
}
export function menuMas(ctx) {
  const op = [['libro', 'Agregar un libro', 'EPUB, PDF, audio o a mano'], ['isbn', 'Escanear un ISBN', 'Un libro de papel con su código de barras'], ...(A?.escanearPagina ? [['estante', 'Fotografiar una estantería', 'Agrega varios libros de una vez'], ['pagina', 'Fotografiar una página', 'Guárdala como frase']] : []), ['importar', 'Importar una lista o archivos', 'CSV, Kindle y más']];
  const o = openSheet(`<h3>Agregar</h3><div class="mlist" style="margin-top:12px">${op.map(([k, n, d]) => `<button class="ml" data-q="${k}"><span class="mt"><b>${n}</b><small>${d}</small></span></button>`).join('')}</div>`);
  $$('[data-q]', o).forEach(b => b.onclick = () => {
    const k = b.dataset.q; closeSheet();
    if (k === 'libro') ctx.add(); else if (k === 'isbn') ctx.add('isbn'); else if (k === 'estante') escanearEstanteria();
    else if (k === 'pagina') import('./frases.js').then(m => m.escanearPagina()); else import('./more.js').then(m => { m.openMore('importar'); ctx.go('more'); });
  });
}
