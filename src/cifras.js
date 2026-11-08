import { S, FORMATS, MES, today } from './state.js';
import { P, setPref } from './prefs.js';
import { $, $$, esc, ic, toast, reduce } from './ui.js';
import { streak, bestStreak, hourHistogram, yearStats, iso } from './metrics.js';
import { imgYear, shareImage } from './share.js';

export function drawStats() {
  const v = $('#v-stats'), mes = S.ui.statsMode === 'mes', now = new Date(), yr = now.getFullYear();
  const byMonth = Array(12).fill(0), byYear = {}, byDate = new Map();
  for (const l of S.log) {
    const [y, m] = l.date.split('-').map(Number);
    byYear[y] = (byYear[y] || 0) + (l.pages || 0);
    if (y === yr) byMonth[m - 1] += l.pages || 0;
    byDate.set(l.date, (byDate.get(l.date) || 0) + (l.pages || 0));
  }
  const years = Object.keys(byYear).map(Number).sort(); if (!years.includes(yr)) years.push(yr);
  const data = mes ? byMonth.map((n, i) => [MES[i][0].toUpperCase(), n]).slice(0, now.getMonth() + 1) : years.map(y => [String(y), byYear[y] || 0]);
  const max = Math.max(1, ...data.map(d => d[1]));
  const ys = yearStats(yr), goal = P.goalYear || 12, pct = Math.min(1, ys.books / goal), R = 40, C = 2 * Math.PI * R, st = streak();
  const done = S.books.filter(b => b.s === 'leido'), fmt = n => n.toLocaleString('es-CL');

  // calendario: 53 semanas terminando hoy, desde un lunes
  const end = new Date(now), start = new Date(end); start.setDate(end.getDate() - 364); while (start.getDay() !== 1) start.setDate(start.getDate() - 1);
  const cells = []; for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) { const k = iso(d), p = byDate.get(k) || 0; cells.push({ d: new Date(d), p }); }
  const lvl = p => p === 0 ? 0 : p < 10 ? 1 : p < 30 ? 2 : p < 60 ? 3 : 4;
  let lastM = -1; const cols = Math.ceil(cells.length / 7);
  const months = Array.from({ length: cols }, (_, c) => { const x = cells[c * 7]; if (!x) return '<span></span>'; const m = x.d.getMonth(), show = m !== lastM && x.d.getDate() <= 7; if (show) lastM = m; return `<span>${show ? MES[m] : ''}</span>`; }).join('');
  const activeDays = cells.filter(c => c.p > 0).length, totalYear = cells.reduce((a, c) => a + c.p, 0);
  const hrs = hourHistogram(), hmax = Math.max(...hrs), best = hmax ? hrs.indexOf(hmax) : -1;

  v.innerHTML = `<div class="apphead"><div><h2>Mis cifras</h2><div class="sub">Páginas, constancia y metas</div></div></div><div class="pad">
   <div class="tiles"><div class="tile"><b>${fmt(byMonth[now.getMonth()])}</b><span>páginas en ${MES[now.getMonth()]}.</span></div><div class="tile"><b>${fmt(byYear[yr] || 0)}</b><span>páginas en ${yr}</span></div>
    <div class="tile"><b>${ys.books}</b><span>libros leídos en ${yr}</span></div><div class="tile"><b>${st} ${st === 1 ? 'día' : 'días'}</b><span>racha actual · mejor ${bestStreak()}</span></div></div>
   <div class="card"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px"><div><h3>Tu año leyendo</h3><div class="sub">${fmt(totalYear)} páginas en ${activeDays} días de lectura</div></div></div>
     <div class="heat ${reduce ? 'vis' : 'pre'}" id="heat"><div class="heatin"><div class="months">${months}</div><div class="hg"><div class="dl"><span>L</span><span></span><span>M</span><span></span><span>V</span><span></span><span>D</span></div>
       <div class="cells">${cells.map((c, i) => `<i class="l${lvl(c.p)}" style="--col:${Math.floor(i / 7)}" data-t="${c.d.getDate()} ${MES[c.d.getMonth()]} · ${c.p ? c.p + ' págs.' : 'sin lectura'}"></i>`).join('')}</div></div></div></div>
     <div class="legendh"><span>Menos</span><i style="background:var(--surface2)"></i><i style="background:color-mix(in srgb,var(--accent) 28%,var(--surface2))"></i><i style="background:color-mix(in srgb,var(--accent) 52%,var(--surface2))"></i><i style="background:color-mix(in srgb,var(--accent) 76%,var(--surface2))"></i><i style="background:var(--accent)"></i><span>Más</span></div></div>
   <div class="grid2">
    <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3>Páginas leídas</h3><div class="row" style="gap:6px"><button class="chip" data-m="mes" aria-pressed="${mes}">Por mes</button><button class="chip" data-m="anio" aria-pressed="${!mes}">Por año</button></div></div>
      <div class="sub">${mes ? `${yr}, mes a mes` : 'Año a año'}</div>
      ${S.log.length ? `<div class="bars">${data.map((d, i) => `<div class="bar ${i === data.length - 1 ? 'cur' : ''}"><em>${d[1] || ''}</em><i style="height:${Math.max(2, d[1] / max * 78)}%"></i></div>`).join('')}</div><div class="xl">${data.map(d => `<span>${d[0]}</span>`).join('')}</div>` : `<div class="empty" style="padding:24px 0 8px">Cuando leas o registres tu avance, aquí verás cuántas páginas llevas.</div>`}</div>
    <div class="card"><h3>¿A qué hora lees?</h3>${hmax ? `<div class="sub">Tu mejor hora: ${String(best).padStart(2, '0')}:00</div><div class="hours">${hrs.map((h, i) => `<i class="${i === best ? 'max' : ''}" style="height:${Math.max(4, h / hmax * 100)}%" title="${i}:00"></i>`).join('')}</div><div class="hl2"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>23 h</span></div>` : `<div class="sub" style="margin-top:8px">Aparecerá cuando leas con el lector abierto o con una sesión de lectura: la app anota a qué hora lo haces. Todo queda en tu dispositivo.</div>`}</div>
   </div>
   <div class="grid2"><div class="card"><div class="ringwrap"><svg class="ring" viewBox="0 0 100 100" role="img" aria-label="${ys.books} de ${goal} libros"><circle class="tr" cx="50" cy="50" r="${R}"/><circle class="fg" cx="50" cy="50" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 50 50)"/><text x="50" y="58">${ys.books}</text></svg>
     <div><h3>Meta del año</h3><div class="sub">${ys.books} de <input class="goalin" id="goal" type="number" min="1" value="${goal}" aria-label="Meta de libros"> libros.<br>${goal - ys.books > 0 ? `Faltan ${goal - ys.books}.` : '¡Meta cumplida!'}</div></div></div></div>
   <div class="card"><h3>Cómo lees</h3><div class="sub" style="margin-bottom:10px">Libros terminados por formato</div>
     ${FORMATS.map(f => { const n = done.filter(b => b.f === f).length; return `<div style="display:grid;grid-template-columns:56px 1fr 20px;gap:10px;align-items:center;margin:6px 0;font-size:13px"><span>${f}</span><div class="pbar"><i style="width:${done.length ? n / done.length * 100 : 0}%"></i></div><b>${n}</b></div>`; }).join('')}</div></div>
   <div class="wrapped"><small>Tu ${yr} en libros</small><h3>${ys.books ? `Leíste ${ys.books} ${ys.books === 1 ? 'libro' : 'libros'} este año` : 'Tu resumen del año va tomando forma'}</h3>
     <div class="wgrid"><div><b>${fmt(ys.pages)}</b><span>páginas</span></div><div><b>${ys.books}</b><span>libros</span></div><div><b>${ys.hours ? ys.hours + ' h' : '–'}</b><span>de lectura</span></div></div><button class="go" id="shy">${ic('image')}Compartir como imagen</button></div>
  </div>`;
  $$('[data-m]', v).forEach(b => b.onclick = () => { S.ui.statsMode = b.dataset.m; drawStats(); });
  $('#goal', v).onchange = e => { setPref('goalYear', Math.max(1, +e.target.value || 12)); drawStats(); };
  $('#shy', v).onclick = async () => { toast('Preparando la imagen…'); await shareImage(await imgYear(ys, yr), `mi-${yr}.png`, `Mi ${yr} en libros`); };
  // calendario: aparece en cascada al llegar a la sección, y se desliza a los días más recientes
  const heat = $('#heat', v); heat.scrollLeft = heat.scrollWidth;
  const show = () => { heat.classList.remove('pre'); heat.classList.add('vis'); heat.scrollLeft = heat.scrollWidth; };
  if (!reduce) { const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { show(); io.disconnect(); } }, { threshold: .2 }); io.observe(heat); setTimeout(() => { if (heat.classList.contains('pre')) show(); }, 3000); }
  const tip = tipEl(); heat.addEventListener('pointermove', e => { const c = e.target.closest('.cells i'); if (!c) { tip.style.opacity = 0; return; } tip.textContent = c.dataset.t; tip.style.opacity = 1; tip.style.left = Math.min(innerWidth - 170, e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 36) + 'px'; });
  heat.addEventListener('pointerleave', () => tip.style.opacity = 0);
}
function tipEl() { let t = $('#tipc'); if (!t) { t = document.createElement('div'); t.id = 'tipc'; t.className = 'tipc'; document.body.appendChild(t); } return t; }
