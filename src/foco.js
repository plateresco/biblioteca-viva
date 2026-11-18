// Sesiones de foco: un tiempo fijo de lectura con aviso para descansar la vista (20-20-20), pausas y un historial.
import { S, byId, saveMeta, addPages, addTime, today } from './state.js';
import { pagesToday } from './metrics.js';
import { $, $$, esc, openSheet, closeSheet, toast } from './ui.js';
import { A } from './native.js';
const currentBook = () => S.books.find(b => b.s === 'leyendo' && !b.oculto) || S.books.find(b => b.s === 'porleer' && !b.oculto) || null;

export const sesiones = () => (S.meta.sesiones = S.meta.sesiones || []);
let s = null;      // sesión en curso: { dur, fin, restante, corre, libroId, p0, vioLector, ojos, noMol, tI }

const fm = x => String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(Math.floor(x % 60)).padStart(2, '0');

export function abrirFoco() {
  if (s) return pildora(true);
  const cur = currentBook(), libros = S.books.filter(b => (b.s === 'leyendo' || b.s === 'porleer') && !b.oculto);
  const o = openSheet(`<h3>Sesión de foco</h3><div class="sub">Un tiempo fijo para leer sin distracciones. Cada 20 minutos te aviso para mirar a lo lejos unos segundos.</div>
    <div class="row" id="fd" style="gap:6px;margin:14px 0">${[25, 45, 60].map(m => `<button class="chip" data-m="${m}" aria-pressed="${m === 25}">${m} min</button>`).join('')}</div>
    <label style="display:grid;gap:4px;font-size:13px">Libro<select id="fb">${libros.map(b => `<option value="${b.id}" ${cur && b.id === cur.id ? 'selected' : ''}>${esc(b.t)}</option>`).join('') || '<option value="">Sin libro</option>'}</select></label>
    <label class="chk2" style="margin-top:12px"><input type="checkbox" id="fo" checked> Avisarme para descansar la vista (20-20-20)</label>
    ${A?.noMolestar ? '<label class="chk2"><input type="checkbox" id="fn"> No molestar durante la sesión</label>' : ''}
    <div class="row" style="margin-top:16px"><button class="btn" id="fgo">Empezar</button><button class="btn ghost" data-x>Cancelar</button></div>`);
  let dur = 25;
  $$('#fd .chip', o).forEach(c => c.onclick = () => { dur = +c.dataset.m; $$('#fd .chip', o).forEach(x => x.setAttribute('aria-pressed', x === c)); });
  $('#fgo', o).onclick = () => { empezar(dur, +$('#fb', o).value || null, $('#fo', o).checked, !!$('#fn', o)?.checked); closeSheet(); };
}

function empezar(dur, libroId, ojos, noMol) {
  s = { dur, restante: dur * 60, fin: Date.now() + dur * 60000, corre: true, libroId, p0: pagesToday(), vioLector: false, ojos, noMol, seg: 0, proxOjos: 20 * 60, ini: Date.now() };
  if (noMol && A?.noMolestar) { try { A.noMolestar(true); } catch { } }
  s.tI = setInterval(tick, 500); pildora(false); toast(`Sesión de ${dur} minutos: ¡a leer!`);
}
function tick() {
  if (!s) return;
  if (s.corre) {
    s.restante = Math.max(0, (s.fin - Date.now()) / 1000);
    if (document.querySelector('#reader,.docr')) s.vioLector = true;
    const leido = s.dur * 60 - s.restante;
    if (s.ojos && leido >= s.proxOjos && s.restante > 30) { s.proxOjos += 20 * 60; ojos(); }
    if (s.restante <= 0) return terminar();
  }
  const p = $('#fpill'); if (p) { $('b', p).textContent = fm(s.restante); }
}
function ojos() { toast('Descanso para los ojos: mira algo lejano durante 20 segundos'); try { navigator.vibrate && navigator.vibrate([60, 80, 60]); } catch { } }

function pildora(expandir) {
  let p = $('#fpill');
  if (!p) { p = document.createElement('div'); p.id = 'fpill'; document.body.appendChild(p); }
  const pinta = () => {
    p.innerHTML = `<b>${fm(s.restante)}</b><button data-a="pausa" aria-label="${s.corre ? 'Pausar' : 'Seguir'}">${s.corre ? '❚❚' : '▶'}</button><button data-a="fin" aria-label="Terminar la sesión">✕</button>`;
  };
  p.onclick = e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a || !s) return;
    if (a === 'pausa') { if (s.corre) { s.corre = false; s.restante = Math.max(0, (s.fin - Date.now()) / 1000); } else { s.corre = true; s.fin = Date.now() + s.restante * 1000; } pinta(); }
    else if (a === 'fin') terminar(true);
  };
  pinta();
}

async function terminar(manual = false) {
  if (!s) return; const x = s; s = null; clearInterval(x.tI); $('#fpill')?.remove();
  if (x.noMol && A?.noMolestar) { try { A.noMolestar(false); } catch { } }
  const real = Math.max(1, Math.round(((x.dur * 60) - (manual ? Math.max(0, (x.fin - Date.now()) / 1000) : 0)) / 60)), dp = Math.max(0, pagesToday() - x.p0);
  const o = openSheet(`<h3>${manual ? 'Sesión terminada' : '¡Sesión completa!'}</h3><div class="sub">${real} minutos de lectura${dp ? ` · ${dp} páginas` : ''}.</div>
    ${x.vioLector ? '' : `<label style="display:grid;gap:4px;margin-top:12px;font-size:13px">¿Cuántas páginas leíste?<input id="fp" type="number" min="0" value="0" inputmode="numeric"></label>`}
    <div class="sub" style="margin-top:12px">¿Cómo fue esta sesión?</div><div class="row" id="fmo" style="gap:6px;margin-top:6px">${['Tranquila', 'Absorbente', 'Cansada', 'Difícil'].map(m => `<button class="chip" data-m="${m}" aria-pressed="false">${m}</button>`).join('')}</div>
    ${!manual ? '<p style="margin-top:12px;font-style:italic">Descansa unos minutos. Estírate y toma agua.</p>' : ''}
    <div class="row" style="margin-top:14px"><button class="btn" id="fok">Guardar</button></div>`);
  let mood = ''; $$('#fmo .chip', o).forEach(c => c.onclick = () => { mood = mood === c.dataset.m ? '' : c.dataset.m; $$('#fmo .chip', o).forEach(x => x.setAttribute('aria-pressed', x.dataset.m === mood)); });
  $('#fok', o).onclick = async () => {
    const pg = +($('#fp', o)?.value || 0), id = x.libroId;
    if (!x.vioLector && id) { if (pg > 0) await addPages(id, Math.min(pg, 200)); await addTime(id, real * 60); }
    sesiones().push({ t: Date.now(), d: today(), min: real, libro: id ? byId(id)?.uid || '' : '', pag: dp + (x.vioLector ? 0 : pg), ...(mood ? { mood } : {}) });
    S.meta.sesiones = sesiones().slice(-300); await saveMeta(); closeSheet(); toast('Sesión guardada');
  };
}
export const enCurso = () => !!s;
