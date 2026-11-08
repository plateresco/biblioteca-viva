import { S, ST, byId, coverUrl, addPages, addTime, saveBook, setStatus, today, MES } from './state.js';
import { P, setPref } from './prefs.js';
import { $, $$, esc, ic, toast, reduce } from './ui.js';
import { pagesToday, streak, weekDots, leftText, pace, minutesToday, fmtDur, lastReadOf, daysSince } from './metrics.js';
import { reminderDue } from './reminder.js';

// Sesión de lectura manual (para libros de papel o audiolibros; con EPUB el lector mide el tiempo solo)
const sess = { running: false, sec: 0, pages: 0, bookId: null, iv: null };
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

export function currentBook() {
  const ing = S.books.filter(b => b.s === 'leyendo').sort((a, b) => (lastReadOf(b.id) || b.st || '').localeCompare(lastReadOf(a.id) || a.st || '')).reverse();
  return ing[0] || S.books.find(b => b.s === 'porleer') || null;
}
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function drawHoy(ctx) {
  const v = $('#v-hoy'), now = new Date(), cur = currentBook(), done = pagesToday(), goal = P.goalDay || 20, R = 40, C = 2 * Math.PI * R;
  const retomar = S.books.filter(b => b !== cur && (b.s === 'abandonado' || (b.s === 'leyendo' && (daysSince(lastReadOf(b.id)) ?? 99) >= 7))).slice(0, 3);
  const q = S.notes.length ? S.notes[S.ui.qi % S.notes.length] : null;
  const dots = weekDots(), st = streak();
  if (!sess.bookId || !byId(sess.bookId)) sess.bookId = cur?.id ?? null;
  const cu = cur && coverUrl(cur);
  const sessBooks = S.books.filter(b => b.s === 'leyendo' || b.s === 'porleer');

  v.innerHTML = `<div class="apphead"><div><h2>Hoy</h2><div class="sub">${DIAS[now.getDay()]} ${now.getDate()} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][now.getMonth()]}</div></div>
    <button class="iconbtn" id="hsr" aria-label="Buscar">${ic('search')}</button></div><div class="pad">
  ${reminderDue() ? `<div class="banner">${ic('bell')}<span>Aún no leíste hoy. ¿Un ratito con ${esc(cur?.t || 'tu libro')}?</span></div>` : ''}
  ${!S.books.length ? `<div class="card onb"><h3>Empecemos tu biblioteca</h3><div class="sub">Tres formas de agregar libros:</div>
    <div class="steps3"><button class="stp" data-a="add"><b>1 · EPUB</b><span>La app toma el título, el autor y la portada.</span></button><button class="stp" data-a="isbn"><b>2 · Libro de papel</b><span>Escanea el ISBN o escríbelo.</span></button><button class="stp" data-a="csv"><b>3 · Lista de otra app</b><span>Importa un archivo CSV de Goodreads.</span></button></div></div>` : `
  <div class="hoy">
   <div class="card hc cont">${cur ? `<h3>Seguir leyendo</h3><div class="resume"><span class="rcov" style="--c1:${cur.c1 || '#555'};${cu ? `--art:url('${cu}')` : ''}"></span><div style="min-width:0;flex:1"><b>${esc(cur.t)}</b><span>${esc(cur.a)} · ${Math.round((cur.r || 0) / cur.p * 100)} %</span></div><button class="go" id="goCur">${cur.hasFile ? 'Continuar' : 'Ficha'}</button></div>
     <div class="pbar"><i style="width:${Math.round((cur.r || 0) / cur.p * 100)}%"></i></div><div class="sub" style="margin-top:6px">${esc(leftText(cur))}</div>` : `<h3>Seguir leyendo</h3><div class="sub">No tienes un libro en curso. Elige uno de tu estantería.</div>`}</div>
   <div class="card hc"><h3>Meta de hoy</h3><div class="mrow"><svg class="ring" viewBox="0 0 100 100" role="img" aria-label="${done} de ${goal} páginas"><circle class="tr" cx="50" cy="50" r="${R}"/><circle class="fg" id="rfg" cx="50" cy="50" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 50 50)"/><text x="50" y="58">${done}</text></svg>
     <div><div style="font-weight:600">${done} de <input class="goalin" id="gd" type="number" min="1" value="${goal}" aria-label="Meta diaria de páginas"> págs.</div><div class="sub">${done >= goal ? '¡Meta cumplida hoy!' : `Con ${goal - done} más cierras el día${st ? ` y llevas ${st + (done ? 0 : 1)} ${st + (done ? 0 : 1) === 1 ? 'día' : 'días'} seguidos` : ''}.`}</div><div class="sub">${minutesToday() ? `Hoy leíste ${fmtDur(minutesToday())}.` : ''}</div></div></div></div>
   <div class="card hc"><h3>Esta semana</h3><div class="days">${dots.map(d => `<span><i class="${d.on ? 'on' : ''} ${d.today ? 'today' : ''}"></i>${d.l}</span>`).join('')}</div><div class="sub" style="margin-top:10px">Racha: ${st} ${st === 1 ? 'día' : 'días'}</div></div>
   <div class="card hc sessc"><h3>Sesión de lectura</h3>
     <select id="sbk" aria-label="Libro de la sesión">${sessBooks.map(b => `<option value="${b.id}" ${b.id === sess.bookId ? 'selected' : ''}>${esc(b.t)}</option>`).join('') || '<option value="">Sin libros</option>'}</select>
     <div class="timer" id="tm">${fmt(sess.sec)}</div>
     <div class="row2"><button class="btn" id="tmGo">${sess.running ? 'Pausar' : (sess.sec ? 'Seguir' : 'Empezar')}</button><button class="btn ghost" id="tmEnd" ${sess.sec || sess.pages ? '' : 'disabled'}>Terminar</button></div>
     <div class="row2" style="margin-top:10px"><span class="sub">Páginas leídas</span><div class="stepper"><button id="pgm" aria-label="Menos">−</button><output id="pgo">${sess.pages}</output><button id="pgp" aria-label="Más">+</button></div></div></div>
   ${cur ? `<div class="card hc"><h3>Ritmo para terminar ${esc(cur.t)}</h3><div class="sub">Te quedan ${Math.max(0, cur.p - (cur.r || 0))} de ${cur.p} páginas.</div>
     <div class="ctl2"><span>Quiero terminarlo en</span><input id="rdays" type="range" min="3" max="60" value="21" aria-label="Días"><output id="rdo">21 días</output></div><div id="rout"></div></div>` : ''}
   ${retomar.length ? `<div class="card hc"><h3>Retomar</h3>${retomar.map(b => `<div class="resume" data-id="${b.id}"><span class="rcov" style="--c1:${b.c1 || '#555'};${coverUrl(b) ? `--art:url('${coverUrl(b)}')` : ''}"></span><div style="min-width:0;flex:1"><b>${esc(b.t)}</b><span>${ST[b.s].n}${lastReadOf(b.id) ? ` · hace ${daysSince(lastReadOf(b.id))} días` : ''}</span></div><button class="go" data-r="${b.id}">Abrir</button></div>`).join('')}</div>` : ''}
   ${q ? `<div class="card hc quotec"><h3>Frase de tus libros</h3><q>“${esc(q.text)}”</q><div class="sub">${esc(q.title)}</div></div>` : ''}
  </div>`}</div>`;

  $('#hsr', v).onclick = () => import('./palette.js').then(m => m.openPalette());
  $$('.stp', v).forEach(b => b.onclick = () => { const a = b.dataset.a; if (a === 'add') ctx.add(); else if (a === 'isbn') ctx.add('isbn'); else import('./more.js').then(m => { m.openMore('importar'); ctx.go('more'); }); });
  $('#goCur', v)?.addEventListener('click', () => cur.hasFile ? ctx.openReader(cur.id) : ctx.openSheet(cur.id));
  $$('[data-r]', v).forEach(b => b.onclick = () => { const x = byId(+b.dataset.r); x.hasFile ? ctx.openReader(x.id) : ctx.openSheet(x.id); });
  $('#gd', v)?.addEventListener('change', e => { setPref('goalDay', Math.max(1, +e.target.value || 20)); drawHoy(ctx); });
  const fg = $('#rfg', v); if (fg) requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = C * (1 - Math.min(1, done / goal)); }));

  // sesión
  const tm = () => { const el = $('#tm'); if (el) el.textContent = fmt(sess.sec); };
  $('#sbk', v)?.addEventListener('change', e => { sess.bookId = +e.target.value; });
  $('#tmGo', v)?.addEventListener('click', e => {
    sess.running = !sess.running; clearInterval(sess.iv);
    if (sess.running) sess.iv = setInterval(() => { sess.sec++; tm(); }, 1000);
    e.target.textContent = sess.running ? 'Pausar' : 'Seguir'; $('#tmEnd', v).disabled = false;
  });
  $('#pgp', v)?.addEventListener('click', () => { sess.pages++; $('#pgo').textContent = sess.pages; $('#tmEnd').disabled = false; });
  $('#pgm', v)?.addEventListener('click', () => { sess.pages = Math.max(0, sess.pages - 1); $('#pgo').textContent = sess.pages; });
  $('#tmEnd', v)?.addEventListener('click', async () => {
    clearInterval(sess.iv); const { sec, pages } = sess, b = byId(sess.bookId);
    sess.running = false; sess.sec = 0; sess.pages = 0;
    if (b && (sec > 0 || pages > 0)) {
      if (pages) { await addPages(b.id, pages); b.r = Math.min(b.p, (b.r || 0) + pages); b.progress = b.r / b.p; }
      if (sec) await addTime(b.id, sec);
      if (b.s === 'porleer') { b.s = 'leyendo'; b.st = today(); }
      if (b.r >= b.p && b.s !== 'leido') await setStatus(b, 'leido'); else await saveBook(b);
      toast(`Sesión guardada: ${Math.max(1, Math.round(sec / 60))} min y ${pages} págs.`);
    } else drawHoy(ctx);
  });
  // ritmo
  const rd = () => {
    const el = $('#rdays', v); if (!el || !cur) return;
    const d = +el.value, left = Math.max(0, cur.p - (cur.r || 0)), ppd = Math.ceil(left / d), mpd = Math.ceil(ppd / pace() * 60), end = new Date(); end.setDate(end.getDate() + d);
    $('#rdo', v).textContent = d + ' días';
    $('#rout', v).innerHTML = `<div class="rpair"><div><b>${ppd}</b><span>págs. por día</span></div><div><b>${mpd}</b><span>min por día</span></div></div><div class="sub" style="margin-top:8px">Lo terminarías el <b>${end.getDate()} de ${MES[end.getMonth()]}</b>. ${ppd > 40 ? 'Es un ritmo exigente.' : ppd > 20 ? 'Es un ritmo cómodo.' : 'Es un ritmo muy tranquilo.'}</div>`;
  };
  $('#rdays', v)?.addEventListener('input', rd); rd();
}
