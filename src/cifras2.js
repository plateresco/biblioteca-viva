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
  const gen = new Map(); for (const b of fin(yr)) { const g = (b.gen && b.gen[0]) || 'Sin género'; gen.set(g, (gen.get(g) || 0) + 1); }
  const gl = [...gen.entries()].sort((a, z) => z[1] - a[1]).slice(0, 6), gmax = Math.max(1, ...gl.map(x => x[1]));
  const mes = libroDelMes();
  return `<div class="grid2">
    <div class="card"><h3>Comparado con el año pasado</h3><div class="sub">A esta misma fecha</div>
      <div class="rpair" style="margin-top:10px"><div><b>${este}</b><span>libros en ${yr}</span></div><div><b>${pasado}</b><span>en ${yr - 1}</span></div></div>
      <div class="sub" style="margin-top:8px">${dif > 0 ? `Vas ${dif} ${dif === 1 ? 'libro' : 'libros'} por delante.` : dif < 0 ? `Vas ${-dif} ${dif === -1 ? 'libro' : 'libros'} por detrás.` : 'Vas igual que el año pasado.'}</div></div>
    <div class="card"><h3>Velocidad por libro</h3><div class="sub">Páginas por hora, según tu tiempo de lectura</div>
      ${vel.length ? vel.map(x => `<div class="vrow2"><span>${esc(x.b.t.slice(0, 26))}</span><div class="pbar"><i style="width:${x.v / vmax * 100}%"></i></div><b>${x.v}</b></div>`).join('') : '<div class="sub" style="margin-top:8px">Aparece cuando lees con el lector abierto o con una sesión de lectura.</div>'}</div>
    <div class="card"><h3>Por género</h3><div class="sub">Libros terminados en ${yr}. Los géneros se escriben en la ficha de cada libro.</div>
      ${gl.length ? gl.map(([g, n]) => `<div class="vrow2"><span>${esc(g)}</span><div class="pbar"><i style="width:${n / gmax * 100}%"></i></div><b>${n}</b></div>`).join('') : '<div class="sub" style="margin-top:8px">Aún no hay libros terminados este año.</div>'}</div>
    <div class="card"><h3>Libro del mes</h3>${mes ? `<div class="resume" style="margin-top:8px"><span class="rcov" style="--c1:${mes.b.c1 || '#555'};${coverUrl(mes.b) ? `--art:url('${coverUrl(mes.b)}')` : ''}"></span><div style="min-width:0;flex:1"><b>${esc(mes.b.t)}</b><span>${mes.p} páginas en ${MES[now.getMonth()]}</span></div></div><button class="go" id="shm" style="margin-top:8px">Compartir como imagen</button>` : '<div class="sub" style="margin-top:8px">Cuando leas este mes, aquí aparece el que más páginas lleva.</div>'}</div></div>`;
}
export function bindMasCifras(v) {
  $('#shm', v)?.addEventListener('click', async () => {
    const m = libroDelMes(); if (!m) return;
    toast('Preparando la imagen…'); await shareImage(await imgTarjeta({ g: ['#33505C', '#10202a'], k: 'Mi libro del mes', big: m.b.t.slice(0, 40), p: `${m.p} páginas en ${MES[new Date().getMonth()]}.` }), 'libro-del-mes.png', 'Mi libro del mes');
  });
}
