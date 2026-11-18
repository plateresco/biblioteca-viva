// Más cifras: velocidad por libro, géneros, comparación con el año pasado y libro del mes.
import { S, MES, coverUrl } from './state.js';
import { $, esc, toast } from './ui.js';
import { imgTarjeta, shareImage } from './share.js';
import { P } from './prefs.js';

const pph = () => {                                                  // páginas por hora de cada libro, con las sesiones que tienen tiempo
  const m = new Map();
  for (const l of S.log) { if (!(l.secs > 60) || !(l.pages > 0)) continue; const x = m.get(l.bookId) || { p: 0, s: 0 }; x.p += l.pages; x.s += l.secs; m.set(l.bookId, x); }
  return [...m.entries()].map(([id, x]) => ({ b: S.books.find(b => b.id === id), v: Math.round(x.p / (x.s / 3600)), min: Math.round(x.s / 60) })).filter(x => x.b && x.min >= 10).sort((a, z) => z.v - a.v);
};
function libroDelMes() {
  const now = new Date(), pre = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, m = new Map();
  for (const l of S.log) if ((l.date || '').startsWith(pre)) m.set(l.bookId, (m.get(l.bookId) || 0) + (l.pages || 0));
  const top = [...m.entries()].sort((a, z) => z[1] - a[1])[0];
  return top ? { b: S.books.find(b => b.id === top[0]), p: top[1] } : null;
}

export function htmlMasCifras() {
  const now = new Date(), yr = now.getFullYear(), mismoDia = d => d.getMonth() < now.getMonth() || (d.getMonth() === now.getMonth() && d.getDate() <= now.getDate());
  const fin = y => S.books.filter(b => b.s === 'leido' && (b.en || '').startsWith(String(y)));
  const este = fin(yr).length, pasado = fin(yr - 1).filter(b => mismoDia(new Date(b.en + 'T00:00:00'))).length, dif = este - pasado;
  const vel = pph().slice(0, 5), vmax = Math.max(1, ...vel.map(x => x.v));
  const mes = libroDelMes();
  return `<div class="grid2">
    <div class="card"><h3>Comparado con el año pasado</h3><div class="sub">A esta misma fecha</div>
      <div class="rpair" style="margin-top:10px"><div><b>${este}</b><span>libros en ${yr}</span></div><div><b>${pasado}</b><span>en ${yr - 1}</span></div></div>
      <div class="sub" style="margin-top:8px">${dif > 0 ? `Vas ${dif} ${dif === 1 ? 'libro' : 'libros'} por delante.` : dif < 0 ? `Vas ${-dif} ${dif === -1 ? 'libro' : 'libros'} por detrás.` : 'Vas igual que el año pasado.'}</div></div>
    <div class="card"><h3>Velocidad por libro</h3><div class="sub">Páginas por hora, según tu tiempo de lectura</div>
      ${vel.length ? vel.map(x => `<div class="vrow2"><span>${esc(x.b.t.slice(0, 26))}</span><div class="pbar"><i style="width:${x.v / vmax * 100}%"></i></div><b>${x.v}</b></div>`).join('') : '<div class="sub" style="margin-top:8px">Aparece cuando lees con el lector abierto o con una sesión de lectura.</div>'}</div>
    ${htmlGenero()}
    <div class="card"><h3>Libro del mes</h3>${mes ? `<div class="resume" style="margin-top:8px"><span class="rcov" style="--c1:${mes.b.c1 || '#555'};${coverUrl(mes.b) ? `--art:url('${coverUrl(mes.b)}')` : ''}"></span><div style="min-width:0;flex:1"><b>${esc(mes.b.t)}</b><span>${mes.p} páginas en ${MES[now.getMonth()]}</span></div></div><button class="go" id="shm" style="margin-top:8px">Compartir como imagen</button>` : '<div class="sub" style="margin-top:8px">Cuando leas este mes, aquí aparece el que más páginas lleva.</div>'}</div></div>`;
}

// Géneros: gráfico circular con el periodo a elegir; al tocar un género se ve su cantidad al centro.
const COL = ['#62B7AB', '#E4B861', '#C9809A', '#8FA8F0', '#B48AE0', '#E07A70'];
let gPer = 'anio', gSel = -1;
function generos() {
  const now = new Date(), yr = String(now.getFullYear()), ym = yr + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const lib = S.books.filter(b => b.s === 'leido' && (gPer === 'todo' || (b.en || '').startsWith(gPer === 'mes' ? ym : yr)));
  const m = new Map(); for (const b of lib) { const g = (b.gen && b.gen[0]) || 'Sin género'; m.set(g, (m.get(g) || 0) + 1); }
  const l = [...m.entries()].sort((a, z) => z[1] - a[1]); const top = l.slice(0, 5), resto = l.slice(5).reduce((a, x) => a + x[1], 0);
  if (resto) top.push(['Otros', resto]); return { l: top, tot: lib.length };
}
function htmlGenero() {
  const { l, tot } = generos(); let acc = 0;
  const cg = l.length ? 'conic-gradient(' + l.map(([, n], i) => { const a0 = acc / tot * 100; acc += n; return `${COL[i]} ${a0}% ${acc / tot * 100}%`; }).join(',') + ')' : 'var(--line)';
  const centro = gSel >= 0 && l[gSel] ? `${l[gSel][1]}<small>${esc(l[gSel][0].slice(0, 14))}</small>` : `${tot}<small>libros</small>`;
  return `<div class="card" id="genc"><h3>Por género</h3><div class="sub">Libros terminados. Los géneros se completan desde «Completar datos» o la ficha.</div>
    <div class="row" style="gap:6px;margin:10px 0">${[['mes', 'Este mes'], ['anio', 'Este año'], ['todo', 'Todo']].map(([k, n]) => `<button class="chip" data-gp="${k}" aria-pressed="${gPer === k}">${n}</button>`).join('')}</div>
    ${l.length ? `<div class="gdon"><div class="donut9" style="background:${cg}"><i>${centro}</i></div><div class="gleg">${l.map(([g, n], i) => `<button class="glg ${gSel === i ? 'on' : ''}" data-gi="${i}"><i style="background:${COL[i]}"></i><span>${esc(g)}</span><b>${Math.round(n / tot * 100)} %</b></button>`).join('')}</div></div>
      <div class="row" style="margin-top:10px"><button class="btn ghost" id="shg">Compartir</button></div>` : '<div class="sub" style="margin-top:8px">Aún no hay libros terminados en este periodo.</div>'}</div>`;
}
function bindGenero(v) {
  const c = $('#genc', v); if (!c) return;
  c.querySelectorAll('[data-gp]').forEach(b => b.onclick = () => { gPer = b.dataset.gp; gSel = -1; c.outerHTML = htmlGenero(); bindGenero(v); });
  c.querySelectorAll('[data-gi]').forEach(b => b.onclick = () => { gSel = gSel === +b.dataset.gi ? -1 : +b.dataset.gi; c.outerHTML = htmlGenero(); bindGenero(v); });
  $('#shg', c)?.addEventListener('click', async () => {
    const { l, tot } = generos(); if (!l.length) return; toast('Preparando la imagen…');
    await shareImage(await imgTarjeta({ g: ['#33505C', '#10202a'], k: 'Lo que leo', big: l[0][0].slice(0, 22), p: l.slice(0, 4).map(([g, n]) => `${g}: ${n}`).join(' · ') + ` · ${tot} libros` }), 'mis-generos.png', 'Mis géneros');
  });
}
export function bindMasCifras(v) {
  bindGenero(v);
  $('#shm', v)?.addEventListener('click', async () => {
    const m = libroDelMes(); if (!m) return;
    toast('Preparando la imagen…'); await shareImage(await imgTarjeta({ g: ['#33505C', '#10202a'], k: 'Mi libro del mes', big: m.b.t.slice(0, 40), p: `${m.p} páginas en ${MES[new Date().getMonth()]}.` }), 'libro-del-mes.png', 'Mi libro del mes');
  });
}
