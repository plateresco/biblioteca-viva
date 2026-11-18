// Tanda 7: ¿Qué leo hoy?, racha amable, calendario de calor y hora dorada, nube de temas, bingo de lectura y exportar a Obsidian.
import { S, ST, byId, saveMeta, today } from './state.js';
import { P, setPref } from './prefs.js';
import { $, $$, esc, toast, openSheet, closeSheet } from './ui.js';
import { A, blobToB64 } from './native.js';
import { norm } from './importar.js';
import { visible } from './bloqueo.js';
import { iso, pace, streak, bestStreak, graciasQuedan, GRACIAS_MES, graciasUsadas, enPausa } from './metrics.js';
import { shareImage } from './share.js';
import { todasEtiquetas, setEtiqueta } from './frases.js';
import { syncNativeReminder } from './reminder.js';
import { exportCSV } from './backup.js';

const bloque = (t, sub, cuerpo) => `<div class="card"><h3>${t}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}${cuerpo || ''}</div>`;
const gen = b => (b.gen || []).map(norm).join(' | ');
const tiene = (b, ...ks) => ks.some(k => gen(b).includes(k));

/* ================================================================== ¿Qué leo hoy? */
const ANIMOS = [['liviano', 'Liviano', ['infantil', 'comic', 'humor', 'cuento', 'romance', 'juvenil']], ['profundo', 'Profundo', ['filosofia', 'ensayo', 'novela', 'clasico', 'realismo', 'poesia', 'teatro']], ['aventura', 'Aventura', ['ciencia ficcion', 'fantasia', 'policial', 'terror', 'misterio', 'aventura']], ['aprender', 'Aprender', ['ciencia', 'historia', 'psicologia', 'economia', 'biografia', 'autoayuda', 'ensayo']]];
const TIEMPOS = [[15, '15 min'], [30, '30 min'], [60, '1 hora o más']];
const aprendido = () => (S.meta.qlh = S.meta.qlh || { si: {}, no: {} });
function puntaje(b, min, animo) {
  const largo = b.p || 250, pgs = min / 60 * pace(), paginasFaltan = Math.max(1, largo - (b.r || 0));
  let s = 0, motivo = [];
  const corto = largo <= 260, medio = largo <= 480;
  if (min <= 15) { if (corto) { s += 3; motivo.push('es corto'); } else if (medio) s += 1; }
  else if (min <= 30) { if (medio) { s += 3; motivo.push('cabe en un rato de media hora'); } else if (corto) s += 2; }
  else { if (!corto) { s += 3; motivo.push('tienes tiempo para meterte de lleno'); } else s += 1; }
  if (b.s === 'leyendo') { s += 2; motivo.push('ya lo empezaste'); }
  if (b.r && paginasFaltan <= pgs * 2) { s += 2; motivo.push('lo terminarías pronto'); }
  const am = ANIMOS.find(x => x[0] === animo);
  if (am && am[2].some(k => gen(b).includes(k))) { s += 3; motivo.push(`es de tipo ${am[1].toLowerCase()}`); } else if (!(b.gen || []).length) s += 1;
  const a = aprendido(); s += (a.si[b.uid] || 0) * .5 - (a.no[b.uid] || 0) * .7;
  return { s, motivo };
}
export function queLeoHoy(ctx) {
  const libros = S.books.filter(b => (b.s === 'porleer' || b.s === 'leyendo') && visible(b));
  if (libros.length < 2) return toast('Agrega al menos dos libros por leer para que pueda elegir');
  let min = 30, animo = 'liviano', salto = 0;
  const o = openSheet(`<h3>¿Qué leo hoy?</h3><div class="sub">¿Cuánto tiempo tienes?</div><div class="row" id="qt" style="gap:6px;margin:8px 0 12px"></div><div class="sub">¿Qué te pide el cuerpo?</div><div class="row" id="qa" style="gap:6px;margin:8px 0 12px;flex-wrap:wrap"></div><div id="qr"></div>`);
  const pinta = () => {
    $('#qt', o).innerHTML = TIEMPOS.map(([m, n]) => `<button class="chip" data-t="${m}" aria-pressed="${min === m}">${n}</button>`).join('');
    $('#qa', o).innerHTML = ANIMOS.map(([k, n]) => `<button class="chip" data-a="${k}" aria-pressed="${animo === k}">${n}</button>`).join('');
    const orden = libros.map(b => ({ b, ...puntaje(b, min, animo) })).sort((a, z) => z.s - a.s || (a.b.order || 0) - (z.b.order || 0)), x = orden[salto % orden.length];
    const motivo = x.motivo.length ? x.motivo.slice(0, 2).join(' y ') : 'es una buena opción para hoy';
    $('#qr', o).innerHTML = `<div class="card" style="margin:0"><div class="resume"><span class="rcov" style="--c1:${x.b.c1 || '#555'}"></span><div style="min-width:0;flex:1"><b>${esc(x.b.t)}</b><span>${esc(x.b.a)} · ${x.b.p} págs.</span><em class="why">Te lo propongo porque ${esc(motivo)}.</em></div></div>
      <div class="row" style="margin-top:12px"><button class="btn" id="qgo">${x.b.hasFile ? '▶ Empezar' : 'Ver ficha'}</button><button class="btn ghost" id="qot">Otra opción</button></div></div>`;
    $('#qgo', o).onclick = () => { const a = aprendido(); a.si[x.b.uid] = (a.si[x.b.uid] || 0) + 1; saveMeta(); closeSheet(); x.b.hasFile ? ctx.openReader(x.b.id) : ctx.openSheet(x.b.id); };
    $('#qot', o).onclick = () => { const a = aprendido(); a.no[x.b.uid] = (a.no[x.b.uid] || 0) + 1; saveMeta(); salto++; pinta(); };
  };
  $('#qt', o).addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { min = +b.dataset.t; salto = 0; pinta(); } });
  $('#qa', o).addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) { animo = b.dataset.a; salto = 0; pinta(); } });
  pinta();
}

/* ================================================================== Bingo de lectura */
const POOL = [
  ['mas600', 'Más de 600 páginas', b => (b.p || 0) > 600], ['corto', 'Menos de 200 páginas', b => (b.p || 0) > 0 && b.p < 200], ['antes1900', 'Publicado antes de 1900', b => b.anio && b.anio < 1900],
  ['comic', 'Un cómic', b => b.f === 'Cómic'], ['audio', 'Un audiolibro', b => b.f === 'Audio'], ['papel', 'Un libro de papel', b => b.f === 'Papel'], ['epub', 'Un EPUB', b => b.f === 'EPUB'],
  ['scifi', 'Ciencia ficción', b => tiene(b, 'ciencia ficcion')], ['fantasia', 'Fantasía', b => tiene(b, 'fantasia')], ['policial', 'Policial o misterio', b => tiene(b, 'policial', 'misterio')], ['terror', 'Terror', b => tiene(b, 'terror')],
  ['poesia', 'Poesía', b => tiene(b, 'poesia')], ['bio', 'Una biografía', b => tiene(b, 'biograf')], ['ensayo', 'Un ensayo', b => tiene(b, 'ensayo')], ['historia', 'Historia', b => tiene(b, 'historia')], ['clasico', 'Un clásico', b => tiene(b, 'clasico') || (b.anio && b.anio < 1950)],
  ['serie', 'Parte de una serie', b => !!b.serie], ['cinco', 'Uno de 5 estrellas', b => (b.rating || 0) >= 5], ['cuentos', 'Cuentos', b => tiene(b, 'cuento')], ['infantil', 'Un libro infantil', b => tiene(b, 'infantil', 'juvenil')],
  ['m_autora', 'De una autora (tú lo marcas)', null], ['m_idioma', 'En otro idioma (tú lo marcas)', null], ['m_latam', 'De autor latinoamericano (tú lo marcas)', null], ['m_reco', 'Recomendado por alguien (tú lo marcas)', null],
  ['m_azar', 'Elegido al azar (tú lo marcas)', null], ['m_regalo', 'Un regalo (tú lo marcas)', null],
];
const anioBingo = () => new Date().getFullYear();
function tablero() {
  const y = anioBingo(), g = (S.meta.bingo = S.meta.bingo && S.meta.bingo.y === y ? S.meta.bingo : { y, ids: [], man: {} });
  if (g.ids.length !== 16) {
    let seed = y * 7919; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, p = POOL.map(x => x[0]);
    for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    g.ids = p.slice(0, 16);
  }
  return g;
}
const delAnio = () => S.books.filter(b => b.s === 'leido' && String(b.en || '').startsWith(String(anioBingo())));
function estadoBingo() {
  const g = tablero(), fin = delAnio();
  return g.ids.map(id => { const r = POOL.find(x => x[0] === id), por = r[2] ? fin.find(r[2]) : null, hecho = r[2] ? !!por : !!g.man[id];
    const candidatos = r[2] ? S.books.filter(b => (b.s === 'porleer' || b.s === 'leyendo') && visible(b) && r[2](b)) : []; return { id, t: r[1], auto: !!r[2], hecho, por, candidatos }; });
}
const lineas = e => { let n = 0; for (let i = 0; i < 4; i++) { if ([0, 1, 2, 3].every(k => e[i * 4 + k].hecho)) n++; if ([0, 1, 2, 3].every(k => e[k * 4 + i].hecho)) n++; } if ([0, 5, 10, 15].every(k => e[k].hecho)) n++; if ([3, 6, 9, 12].every(k => e[k].hecho)) n++; return n; };

/* ================================================================== Exportar a Obsidian */
const seguro = s => String(s || 'sin titulo').replace(/[\\/:*?"<>|#^\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
const yamlS = s => '"' + String(s ?? '').replace(/"/g, '\\"') + '"';
async function descargarBlob(nombre, blob, mime) {
  if (A?.guardarArchivo) { A.guardarArchivo(nombre, mime, await blobToB64(blob)); return; }
  const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
}
export async function exportarObsidian() {
  const JSZip = (await import('jszip')).default, z = new JSZip(), usados = new Set(), indice = [];
  for (const b of S.books.filter(visible)) {
    let n = seguro(b.t); while (usados.has(n.toLowerCase())) n += ' (2)'; usados.add(n.toLowerCase());
    const notas = S.notes.filter(x => x.bookId === b.id && !x.voz).sort((a, c) => (a.createdAt || 0) - (c.createdAt || 0));
    const tags = [...new Set(notas.flatMap(x => x.tags || []))];
    const md = ['---', `titulo: ${yamlS(b.t)}`, `autor: ${yamlS(b.a)}`, `estado: ${yamlS(ST[b.s]?.n || b.s)}`, `paginas: ${b.p || 0}`, ...(b.rating ? [`calificacion: ${b.rating}`] : []), ...(b.anio ? [`anio: ${b.anio}`] : []), ...(b.st ? [`empezado: ${b.st}`] : []), ...(b.en ? [`terminado: ${b.en}`] : []),
      ...((b.gen || []).length ? [`generos: [${b.gen.map(yamlS).join(', ')}]`] : []), ...(tags.length ? [`tags: [${tags.join(', ')}]`] : []), '---', '', `# ${b.t}`, `_${b.a}_`, '', b.syn ? b.syn + '\n' : '', `Autor: [[${seguro(b.a)}]]`, ''];
    if (notas.length) { md.push('## Frases', ''); for (const x of notas) { md.push(`> ${String(x.text).replace(/\n+/g, '\n> ')}`, `> — ${x.pdfPag ? 'pág. ' + x.pdfPag : (x.title || '').split('·').slice(-1)[0].trim() || b.t}${(x.tags || []).length ? ' · ' + x.tags.map(t => '#' + t).join(' ') : ''}`, ''); if (x.comment) md.push(`- ${x.comment.replace(/\n+/g, ' ')}`, ''); } }
    z.file(`Libros/${n}.md`, md.join('\n')); indice.push(`- [[${n}]] — ${b.a} (${ST[b.s]?.n || ''})`);
  }
  z.file('Mi biblioteca.md', ['# Mi biblioteca', '', ...indice].join('\n'));
  await descargarBlob(`mi-biblioteca-obsidian-${today()}.zip`, await z.generateAsync({ type: 'blob' }), 'application/zip');
}
export async function exportarFrasesCSV() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`, filas = [['Frase', 'Libro', 'Autor', 'Etiquetas', 'Nota', 'Fecha']];
  for (const n of S.notes.filter(x => !x.voz)) { const b = byId(n.bookId); filas.push([n.text, b?.t || '', b?.a || '', (n.tags || []).join('; '), n.comment || '', n.createdAt ? new Date(n.createdAt).toISOString().slice(0, 10) : '']); }
  await descargarBlob(`mis-frases-${today()}.csv`, new Blob(['﻿' + filas.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' }), 'text/csv');
}

/* ================================================================== Páginas de «Más» */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
let anioVer = new Date().getFullYear();

export const MENU7 = [
  ['quehoy', 'Qué leo hoy', () => 'Dos preguntas y te propongo un libro', 'spark'],
  ['racha', 'Racha y hábito', () => `Racha de ${streak()} días · ${graciasQuedan()} gracias este mes`, 'flame'],
  ['ritmo', 'Tu ritmo', () => 'Calendario del año y tu hora dorada', 'chart'],
  ['temas', 'Temas de tus frases', () => { const n = todasEtiquetas().length; return n ? `${n} etiquetas` : 'Etiqueta tus frases para verlas por tema'; }, 'tag'],
  ['bingo', 'Bingo de lectura', () => { const e = estadoBingo(); return `${e.filter(x => x.hecho).length} de 16 casillas`; }, 'star'],
  ['respaldo2', 'Exportar tus notas', () => 'Obsidian, Notion y hojas de cálculo', 'upload'],
];

export const PAGES7 = {
  quehoy(b, ctx) {
    b.innerHTML = bloque('Qué leo hoy', 'Cuando no sabes qué elegir, te propongo un libro de tu lista según el tiempo y el ánimo.', '<div class="row" style="margin-top:12px"><button class="btn" id="qgo">Elegir por mí</button></div>');
    $('#qgo', b).onclick = () => queLeoHoy(ctx);
  },

  racha(b, ctx, redraw) {
    const p = S.meta.pausa, activa = p && p.hasta >= today(), meta = P.metaSemana || 5;
    b.innerHTML = bloque('Racha', 'Un día sin leer no tiene por qué romperla.', `<div class="rpair" style="margin-top:12px"><div><b>${streak()}</b><span>días de racha</span></div><div><b>${bestStreak()}</b><span>tu mejor racha</span></div></div>`)
      + bloque('Días de gracia', `Tienes ${GRACIAS_MES} al mes. Úsalos tocando un día vacío en «Esta semana» de Hoy: la racha sigue.`, `<div style="font:400 26px var(--f-display);margin-top:8px">${graciasQuedan()} de ${GRACIAS_MES} <span class="sub">este mes (${graciasUsadas()} usadas)</span></div>`)
      + bloque('Meta de la semana', 'Cuántos días quieres leer a la semana. Es una guía, no una obligación.', `<div class="row" id="rm" style="gap:6px;margin-top:10px">${[3, 4, 5, 6, 7].map(n => `<button class="chip" data-m="${n}" aria-pressed="${meta === n}">${n} días</button>`).join('')}</div>`)
      + bloque('Pausa de vacaciones', activa ? `La racha está en pausa hasta el ${p.hasta.split('-').reverse().join('/')}.` : 'Si vas a viajar o descansar, congela la racha hasta 14 días.',
        activa ? '<div class="row" style="margin-top:12px"><button class="btn ghost" id="pfin">Terminar la pausa</button></div>' : `<div class="row" id="pd" style="gap:6px;margin-top:10px">${[3, 7, 14].map(n => `<button class="btn ghost" data-d="${n}">${n} días</button>`).join('')}</div>`);
    $$('#rm [data-m]', b).forEach(x => x.onclick = () => { setPref('metaSemana', +x.dataset.m); redraw(); });
    $$('#pd [data-d]', b).forEach(x => x.onclick = async () => { const f = new Date(); f.setDate(f.getDate() + +x.dataset.d); S.meta.pausa = { desde: today(), hasta: iso(f) }; await saveMeta(); toast('Racha en pausa. ¡Buen descanso!'); redraw(); });
    $('#pfin', b)?.addEventListener('click', async () => { S.meta.pausa = null; await saveMeta(); redraw(); });
  },

  ritmo(b, ctx, redraw) {
    const pg = {}; for (const l of S.log) pg[l.date] = (pg[l.date] || 0) + (l.pages || 0);
    const ini = new Date(anioVer, 0, 1), dias = []; for (let d = new Date(ini); d.getFullYear() === anioVer; d.setDate(d.getDate() + 1)) dias.push(iso(d));
    const vals = dias.map(f => pg[f] || 0).filter(x => x > 0).sort((a, z) => a - z), q = f => { const v = pg[f] || 0; if (!v) return 0; const r = vals.indexOf(v) / Math.max(1, vals.length - 1); return r < .25 ? 1 : r < .5 ? 2 : r < .8 ? 3 : 4; };
    const off = (ini.getDay() + 6) % 7, totalAnio = dias.reduce((a, f) => a + (pg[f] || 0), 0), leidos = dias.filter(f => pg[f] > 0).length;
    const mejorDia = dias.reduce((m, f) => (pg[f] || 0) > (pg[m] || 0) ? f : m, dias[0]);
    const mes = Array(12).fill(0); dias.forEach(f => { mes[+f.slice(5, 7) - 1] += pg[f] || 0; }); const mejorMes = mes.indexOf(Math.max(...mes));
    const hr = Array(24).fill(0); for (const l of S.log) for (const [h, s] of Object.entries(l.hours || {})) hr[+h] += s; const tot = hr.reduce((a, x) => a + x, 0), mx = Math.max(...hr), hd = hr.indexOf(mx);
    b.innerHTML = bloque(`Tu ${anioVer}`, `${leidos} días de lectura · ${totalAnio.toLocaleString('es-CL')} páginas`, `<div class="row" style="gap:6px;margin:10px 0"><button class="btn ghost" id="ya" aria-label="Año anterior">‹</button><b style="align-self:center">${anioVer}</b><button class="btn ghost" id="ys" aria-label="Año siguiente" ${anioVer >= new Date().getFullYear() ? 'disabled' : ''}>›</button></div>
        <div class="heat5" id="ht">${dias.map((f, i) => `<i class="l${q(f)}" data-f="${f}" ${i === 0 ? `style="grid-row-start:${off + 1}"` : ''}></i>`).join('')}</div><div class="rw5"><span>ene</span><span>abr</span><span>jul</span><span>oct</span><span>dic</span></div><div class="small" id="hs" style="margin-top:8px">Toca un día para ver sus páginas.</div>`)
      + bloque('Datos curiosos', '', leidos ? `<div class="small" style="line-height:1.7;margin-top:6px">Tu mejor día fue el ${+mejorDia.slice(8)} de ${MESES[+mejorDia.slice(5, 7) - 1]} con ${pg[mejorDia]} páginas.<br>Tu mejor mes: ${MESES[mejorMes]} (${mes[mejorMes]} páginas).</div>` : '<div class="small" style="margin-top:6px">Aún no hay lecturas en este año.</div>')
      + bloque('Tu hora dorada', tot > 600 ? 'Cuándo lees más tiempo, según tus sesiones.' : 'Se calcula con el tiempo de tus sesiones de lectura. Aún hay pocos datos.', tot > 600 ? `<div class="hours5">${hr.map((v, i) => `<i class="${i === hd ? 'b' : ''}" style="height:${4 + v / mx * 56}px" title="${i} h"></i>`).join('')}</div><div class="rw5"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>
        <div class="small" style="margin-top:8px">Lees más entre las ${hd} y las ${hd + 1} h (${Math.round(hr[hd] / tot * 100)} % de tu tiempo).</div><div class="row" style="margin-top:12px"><button class="btn ghost" id="hrm">Avisarme a las ${String(hd).padStart(2, '0')}:00</button></div>` : '');
    $('#ya', b).onclick = () => { anioVer--; redraw(); }; $('#ys', b).onclick = () => { anioVer++; redraw(); };
    $('#ht', b).addEventListener('click', e => { const c = e.target.closest('i'); if (!c) return; const f = c.dataset.f; $('#hs', b).textContent = `${+f.slice(8)} de ${MESES[+f.slice(5, 7) - 1]}: ${pg[f] ? pg[f] + ' páginas' : 'no leíste'}`; });
    $('#hrm', b)?.addEventListener('click', () => { P.reminder = { ...P.reminder }; setPref('reminder', { on: true, time: String(hd).padStart(2, '0') + ':00' }); try { syncNativeReminder(); } catch { } toast(`Te aviso cada día a las ${String(hd).padStart(2, '0')}:00`); });
  },

  temas(b, ctx) {
    const t = todasEtiquetas(), mx = Math.max(1, ...t.map(x => x[1]));
    b.innerHTML = bloque('Temas de tus frases', t.length ? 'El tamaño depende de cuántas frases tiene cada etiqueta. Toca una para verlas.' : 'Aún no etiquetas ninguna frase. Al editar la nota de una frase puedes agregar etiquetas.',
      t.length ? `<div class="nube5">${t.map(([k, c]) => `<button data-t="${esc(k)}" style="font-size:${14 + c / mx * 22}px">#${esc(k)}<sup class="sub"> ${c}</sup></button>`).join('')}</div>` : '');
    $$('[data-t]', b).forEach(x => x.onclick = () => { setEtiqueta(x.dataset.t); ctx.go('fr'); });
  },

  bingo(b, ctx, redraw) {
    const e = estadoBingo(), hechas = e.filter(x => x.hecho).length, ln = lineas(e);
    b.innerHTML = bloque(`Bingo ${anioBingo()}`, `${hechas} de 16 casillas · ${ln} ${ln === 1 ? 'línea' : 'líneas'}${hechas === 16 ? ' · ¡cuadrícula completa!' : ''}`, `<div class="bingo5" id="bg">${e.map((x, i) => `<button class="${x.hecho ? 'on' : ''}" data-i="${i}">${x.hecho ? '✓ ' : ''}${esc(x.t)}</button>`).join('')}</div><div class="card" id="bd" style="margin:12px 0 0;font-size:13px">Toca una casilla para ver el detalle.</div>
      <div class="row" style="margin-top:12px"><button class="btn ghost" id="bsh">Compartir imagen</button></div>`);
    $('#bg', b).addEventListener('click', async ev => {
      const c = ev.target.closest('[data-i]'); if (!c) return; const x = e[+c.dataset.i], g = tablero();
      if (!x.auto) { g.man[x.id] = !g.man[x.id]; await saveMeta(); return redraw(); }
      $('#bd', b).innerHTML = x.hecho ? `<b>${esc(x.t)}</b><br>Se marcó con «${esc(x.por.t)}».` : `<b>${esc(x.t)}</b><br>Aún no. ${x.candidatos.length ? `Tienes ${x.candidatos.length} en tu lista que la completarían, por ejemplo «${esc(x.candidatos[0].t)}».` : 'Ninguno de tus libros por leer la completa todavía.'}<div class="row" style="margin-top:10px"><button class="btn ghost" id="bsw">Cambiar esta casilla</button></div>`;
      $('#bsw', b)?.addEventListener('click', async () => { const usados = new Set(g.ids), nuevo = POOL.find(r => !usados.has(r[0])); if (!nuevo) return toast('No quedan casillas para cambiar'); g.ids[g.ids.indexOf(x.id)] = nuevo[0]; await saveMeta(); redraw(); });
    });
    $('#bsh', b).onclick = async () => {
      await document.fonts?.ready; const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
      g.fillStyle = '#16262A'; g.fillRect(0, 0, W, H); g.fillStyle = '#F3ECDB'; g.font = "400 84px 'Young Serif',Georgia,serif"; g.fillText(`Bingo ${anioBingo()}`, 80, 160); g.fillStyle = '#A9B7B3'; g.font = '400 34px Figtree,system-ui,sans-serif'; g.fillText(`${hechas} de 16 casillas`, 80, 220);
      const s = 220, gap = 12, x0 = 80, y0 = 290;
      e.forEach((x, i) => { const cx = x0 + (i % 4) * (s + gap), cy = y0 + Math.floor(i / 4) * (s + gap); g.fillStyle = x.hecho ? '#62B7AB' : 'rgba(255,255,255,.08)'; g.beginPath(); g.roundRect(cx, cy, s, s, 22); g.fill(); g.fillStyle = x.hecho ? '#0B1613' : '#E6ECE9'; g.font = '600 26px Figtree,system-ui,sans-serif';
        const pal = (x.t.replace(/ \(tú lo marcas\)/, '')).split(' '); let ln2 = '', yy = cy + 80; for (const w of pal) { if (g.measureText(ln2 + ' ' + w).width > s - 24 && ln2) { g.fillText(ln2.trim(), cx + 14, yy); yy += 32; ln2 = w; } else ln2 += ' ' + w; } g.fillText(ln2.trim(), cx + 14, yy); });
      g.fillStyle = '#A9B7B3'; g.font = '400 30px Figtree,system-ui,sans-serif'; g.fillText('Mi Biblioteca Viva', 80, H - 70);
      shareImage(await new Promise(r => c.toBlob(r, 'image/png')), 'bingo.png', '');
    };
  },

  respaldo2(b, ctx, redraw, ir) {
    b.innerHTML = bloque('Exportar tus notas', 'Llévate tus libros y frases a otras herramientas. Todo se arma en tu teléfono.', `<div style="display:grid;gap:10px;margin-top:12px">
      <button class="ml" id="eo"><span class="mt"><b>Para Obsidian (.zip)</b><small>Una nota por libro, con frases, comentarios y etiquetas</small></span></button>
      <button class="ml" id="ec"><span class="mt"><b>Frases en CSV</b><small>Para Notion y hojas de cálculo</small></span></button>
      <button class="ml" id="el"><span class="mt"><b>Libros en CSV</b><small>Tu lista con estado, páginas y calificación</small></span></button></div>`)
      + bloque('Importar', 'Desde Goodreads o StoryGraph: exporta tu biblioteca allá en CSV y elígela en «Importar y agregar libros».', '<div class="row" style="margin-top:10px"><button class="btn ghost" id="ei">Ir a Importar</button></div>');
    $('#eo', b).onclick = async () => { toast('Preparando las notas…'); try { await exportarObsidian(); } catch { toast('No pude crear el archivo'); } };
    $('#ec', b).onclick = () => exportarFrasesCSV(); $('#el', b).onclick = () => exportCSV();
    $('#ei', b).onclick = () => ir('importar');
  },
};
