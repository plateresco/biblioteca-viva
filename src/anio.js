// Tu año en libros: tarjetas que se arman con tu historial y se comparten como imagen.
import { S, today } from './state.js';
import { P } from './prefs.js';
import { $, $$, esc, openSheet, toast } from './ui.js';
import { imgTarjeta, shareImage } from './share.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const fmt = n => n.toLocaleString('es-CL');

export function resumenAnio(yr = new Date().getFullYear()) {
  const y = String(yr), logs = S.log.filter(l => (l.date || '').startsWith(y));
  const fin = S.books.filter(b => b.s === 'leido' && (b.en || '').startsWith(y));
  const pages = logs.reduce((a, l) => a + (l.pages || 0), 0), horas = Math.round(logs.reduce((a, l) => a + (l.secs || 0), 0) / 3600);
  const mes = Array(12).fill(0), dow = Array(7).fill(0), dias = new Set();
  for (const l of logs) { const d = new Date(l.date + 'T00:00:00'); mes[d.getMonth()] += l.pages || 0; dow[d.getDay()] += l.pages || 0; if ((l.pages || 0) > 0) dias.add(l.date); }
  const mx = Math.max(...mes), mejorMes = mx > 0 ? mes.indexOf(mx) : -1, peorMes = mx > 0 ? (() => { const hasta = new Date().getFullYear() === yr ? new Date().getMonth() + 1 : 12, pos = mes.slice(0, hasta).filter(v => v > 0); return pos.length > 1 ? mes.indexOf(Math.min(...pos)) : -1; })() : -1;
  const largo = fin.slice().sort((a, b) => (b.p || 0) - (a.p || 0))[0];
  const ritmo = fin.filter(b => b.st && b.en && (b.p || 0) >= 100).map(b => ({ b, d: Math.max(1, Math.round((new Date(b.en) - new Date(b.st)) / 864e5) + 1) })).sort((a, b) => (a.b.p / a.d) - (b.b.p / b.d)).reverse()[0];
  // racha más larga del año
  let mejor = 0, act = 0; const sorted = [...dias].sort(); let prev = null;
  for (const d of sorted) { const t = new Date(d + 'T00:00:00').getTime(); act = prev !== null && Math.round((t - prev) / 864e5) === 1 ? act + 1 : 1; prev = t; mejor = Math.max(mejor, act); }
  const dx = Math.max(...dow), diaFav = dx > 0 ? dow.indexOf(dx) : -1;
  // proyección: a este ritmo, cuántos libros terminas en el año
  const now = new Date(), esteAnio = now.getFullYear() === yr, ini = new Date(yr, 0, 1), fr = esteAnio ? Math.max(.08, (now - ini) / (new Date(yr + 1, 0, 1) - ini)) : 1;
  const proy = esteAnio ? Math.round(fin.length / fr) : fin.length, meta = P.goalYear || 12;
  const ppd = esteAnio && meta > fin.length ? Math.ceil((meta - fin.length) * (fin.reduce((a, b) => a + (b.p || 0), 0) / Math.max(1, fin.length) || 300) / Math.max(1, Math.round((new Date(yr + 1, 0, 1) - now) / 864e5))) : 0;
  return { yr, fin, pages, horas, mes, mejorMes, peorMes, largo, ritmo, mejor, diaFav, dias: dias.size, proy, meta, ppd, esteAnio };
}

function tarjetas(r) {
  const T = [];
  T.push({ g: ['#1E6F66', '#0f3b3a'], k: `Tu ${r.yr} en libros`, big: String(r.fin.length), p: `${r.fin.length === 1 ? 'libro terminado' : 'libros terminados'} · ${fmt(r.pages)} páginas${r.horas ? ` · ${r.horas} horas de lectura` : ''}.` });
  if (r.mejorMes >= 0) T.push({ g: ['#8E2F2A', '#3d1412'], k: 'Tu mes más lector', big: MESES[r.mejorMes][0].toUpperCase() + MESES[r.mejorMes].slice(1), p: `Leíste ${fmt(r.mes[r.mejorMes])} páginas.${r.peorMes >= 0 && r.peorMes !== r.mejorMes ? ` Tu mes más tranquilo fue ${MESES[r.peorMes]}.` : ''}`, mes: r.mes, top: r.mejorMes });
  if (r.largo) T.push({ g: ['#B5834A', '#4d3319'], k: 'Tu libro más largo', big: fmt(r.largo.p), p: `páginas de «${r.largo.t}»${r.ritmo && r.ritmo.b === r.largo ? '' : ''}.` });
  if (r.ritmo && r.ritmo.d <= 40) T.push({ g: ['#2F6F8A', '#10283a'], k: 'Tu lectura más veloz', big: `${r.ritmo.d} días`, p: `«${r.ritmo.b.t}»: ${Math.round(r.ritmo.b.p / r.ritmo.d)} páginas por día.` });
  if (r.mejor >= 2) T.push({ g: ['#4B3B8A', '#1b1538'], k: 'Tu racha', big: `${r.mejor} días`, p: `seguidos, tu récord del año.${r.diaFav >= 0 ? ` Tu día favorito para leer es el ${DIAS[r.diaFav]}.` : ''}` });
  if (r.esteAnio) T.push({ g: ['#33505C', '#10202a'], k: 'A este ritmo', big: String(r.proy), p: `libros al terminar el año. Tu meta es ${r.meta}${r.proy >= r.meta ? ': ¡la alcanzas!' : r.ppd ? `; para llegar, unas ${r.ppd} páginas por día.` : '.'}` });
  return T;
}

export function abrirAnio(yr) {
  const r = resumenAnio(yr), T = tarjetas(r); let i = 0;
  if (!r.fin.length && !r.pages) { toast('Aún no hay lecturas registradas este año'); return; }
  const o = openSheet(`<h3>Mi año en libros</h3><div class="sub">Toca la tarjeta para pasar a la siguiente.</div><div class="dotsrow2" id="ad"></div><div class="story2" id="ast" role="button" tabindex="0" aria-label="Siguiente tarjeta"></div>
    <div class="row" style="margin-top:12px"><button class="btn" id="ash">Compartir esta tarjeta</button><button class="btn ghost" id="anx">Siguiente</button></div>`);
  const pinta = () => {
    const t = T[i], st = $('#ast', o); st.style.background = `linear-gradient(150deg,${t.g[0]},${t.g[1]})`;
    const bars = t.mes ? `<div class="mbars2">${t.mes.map((v, k) => `<i class="${k === t.top ? 'top' : ''}" style="height:${Math.max(6, v / Math.max(...t.mes) * 100)}%"></i>`).join('')}</div>` : '';
    st.innerHTML = `<small>${esc(t.k)}</small><div><div class="big2">${esc(t.big)}</div>${bars}</div><p>${esc(t.p)}</p>`;
    $('#ad', o).innerHTML = T.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('');
  };
  const sig = () => { i = (i + 1) % T.length; pinta(); };
  $('#ast', o).onclick = sig; $('#anx', o).onclick = sig;
  $('#ast', o).onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sig(); } };
  $('#ash', o).onclick = async () => { toast('Preparando la imagen…'); await shareImage(await imgTarjeta(T[i]), `mi-${r.yr}-${i + 1}.png`, `Mi ${r.yr} en libros`); };
  pinta();
}
