// Reproductor de audiolibros: capítulos, velocidad, temporizador para dormir, marcadores, y sigue sonando con la pantalla apagada en Android.
import { byId, getFile, setStatus, persistBook, addTime, emit, coverUrl } from './state.js';
import { $, $$, esc, ic, toast } from './ui.js';
import { A } from './native.js';

const RATES = [1, 1.25, 1.5, 1.75, 2, 0.85];
const SLEEPS = [['Apagado', 0], ['15 min', 15], ['30 min', 30], ['60 min', 60], ['Fin del capítulo', -1]];
const fm = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
let cur = null;
export const cerrarAudio = () => { if (cur) cur.cerrar(); };

export async function openAudio(id) {
  cerrarAudio(); document.querySelector('.docr')?.remove();
  const b = byId(id), data = b && await getFile(id);
  if (!data || !data.pistas) { toast('Este audiolibro está solo en el dispositivo donde lo importaste.'); return; }
  const pistas = data.pistas, offs = []; let total = 0; for (const p of pistas) { offs.push(total); total += p.dur || 0; }
  // capítulos: una pista por capítulo, o los capítulos que trae el M4B
  const caps = pistas.length > 1 ? pistas.map((p, i) => ({ t: offs[i], n: p.n })) : (b.audio?.caps?.length ? b.audio.caps.map(c => ({ t: c.t, n: c.n })) : [{ t: 0, n: b.t }]);

  const root = document.createElement('div'); root.className = 'docr audior';
  const cu = coverUrl(b);
  root.innerHTML = `<div class="dbar"><button class="iconbtn" id="aBack" aria-label="Volver">${ic('back')}</button><div class="ti"><b>${esc(b.t)}</b><span id="aLoc"></span></div><button class="iconbtn" id="aMark" aria-label="Agregar marcador">${ic('bookmark')}</button></div>
    <div class="abody"><div class="acov" style="--c1:${b.c1 || '#2F6F8A'};${cu ? `background-image:url('${cu}')` : ''}">${cu ? '' : `<span>${esc(b.t)}</span>`}</div>
      <div class="acap" id="aCap"></div>
      <div class="ascrub"><input type="range" id="aSc" min="0" max="${Math.max(1, Math.round(total))}" value="0" step="1" aria-label="Posición"><div class="at"><span id="aT1">0:00</span><span id="aT2">-0:00</span></div></div>
      <div class="actr"><button class="iconbtn big" id="aPrev" aria-label="Capítulo anterior">${ic('left')}</button><button class="iconbtn big" id="aB" aria-label="Retroceder 15 segundos">−15</button><button class="iconbtn play" id="aPlay" aria-label="Reproducir">${ic('play')}</button><button class="iconbtn big" id="aF" aria-label="Adelantar 15 segundos">+15</button><button class="iconbtn big" id="aNext" aria-label="Capítulo siguiente">${ic('right')}</button></div>
      <div class="arow"><button class="lchip" id="aRate">Velocidad <b>1x</b></button><button class="lchip" id="aSleep">Dormir <b>Apagado</b></button></div>
      <div class="alist" id="aList"></div></div>`;
  document.body.appendChild(root);
  const au = new Audio(); au.preload = 'auto'; const urls = []; let pi = Math.min(pistas.length - 1, b.ap?.pi || 0), ri = 0, si = 0, sleepAt = 0, sleepFin = false, acc = 0;
  const cargaPista = (i, t) => { urls.forEach(u => URL.revokeObjectURL(u)); urls.length = 0; const u = URL.createObjectURL(pistas[i].blob); urls.push(u); pi = i; au.src = u; au.onloadedmetadata = () => { try { au.currentTime = Math.min(t || 0, au.duration || 0); } catch { } au.playbackRate = RATES[ri]; au.onloadedmetadata = null; if (reanuda) { reanuda = false; au.play().catch(() => { }); } }; };
  let reanuda = false;
  const pos = () => (offs[pi] || 0) + (au.currentTime || 0);
  const capDe = p => { let k = 0; caps.forEach((c, i) => { if (p >= c.t - 0.5) k = i; }); return k; };
  const irA = p => {                                    // posición global en segundos
    p = Math.min(Math.max(0, p), total); let i = 0; offs.forEach((o, k) => { if (p >= o) i = k; });
    if (i === pi) { au.currentTime = p - offs[i]; } else { reanuda = !au.paused; cargaPista(i, p - offs[i]); }
    pinta();
  };
  const pinta = () => {
    const p = pos(), k = capDe(p); $('#aT1', root).textContent = fm(p); $('#aT2', root).textContent = '-' + fm(total - p); $('#aSc', root).value = Math.round(p);
    $('#aCap', root).textContent = caps[k]?.n || ''; $('#aLoc', root).textContent = `${Math.round(p / Math.max(1, total) * 100)} % · quedan ${fm(total - p)}`;
    $$('#aList .on', root).forEach(x => x.classList.remove('on')); $('#aList [data-k="' + k + '"]', root)?.classList.add('on');
  };
  $('#aList', root).innerHTML = caps.length > 1 ? caps.map((c, i) => `<div data-k="${i}"><span>${esc(c.n)}</span><small>${fm(c.t)}</small></div>`).join('') : '';
  $$('#aList [data-k]', root).forEach(d => d.onclick = () => { irA(caps[+d.dataset.k].t); au.play().catch(() => { }); });
  const marks = () => (b.abm = b.abm || []);
  $('#aMark', root).onclick = async () => { marks().push({ t: Math.round(pos()), at: Date.now() }); await persistBook(b); toast(`Marcador en ${fm(pos())}`); };

  const estado = () => { try { A?.lecturaEstado && A.lecturaEstado(true, au.paused, b.t, caps[capDe(pos())]?.n || ''); } catch { } };
  $('#aPlay', root).onclick = () => { au.paused ? au.play().catch(() => toast('No pude reproducir este archivo')) : au.pause(); };
  au.onplay = () => { $('#aPlay', root).innerHTML = ic('pause'); estado(); }; au.onpause = () => { $('#aPlay', root).innerHTML = ic('play'); estado(); guarda(); };
  au.onended = () => { if (pi < pistas.length - 1) { reanuda = true; cargaPista(pi + 1, 0); } else { au.pause(); fin(); } };
  au.ontimeupdate = () => {
    pinta();
    if (sleepAt && Date.now() >= sleepAt) { au.pause(); sleepAt = 0; si = 0; $('#aSleep b', root).textContent = 'Apagado'; toast('Pausa: hora de dormir'); }
    if (sleepFin && capDe(pos()) !== finCap) { au.pause(); sleepFin = false; si = 0; $('#aSleep b', root).textContent = 'Apagado'; }
  };
  let finCap = 0, terminado = b.s === 'leido';
  async function fin() { if (!terminado) { terminado = true; await setStatus(b, 'leido'); toast('¡Terminaste el audiolibro!'); } }
  let gT = 0; const guarda = () => { b.ap = { pi, t: Math.round(au.currentTime || 0) }; const pr = pos() / Math.max(1, total); b.progress = pr; b.r = Math.round(pr * b.p); persistBook(b); if (pr >= .985) fin(); };
  const gI = setInterval(() => { if (!au.paused) { guarda(); acc += 10; addTime(b.id, 10); } }, 10000);
  $('#aSc', root).oninput = e => irA(+e.target.value);
  $('#aB', root).onclick = () => irA(pos() - 15); $('#aF', root).onclick = () => irA(pos() + 15);
  $('#aPrev', root).onclick = () => { const k = capDe(pos()); irA(pos() - caps[k].t > 4 ? caps[k].t : (caps[Math.max(0, k - 1)]?.t || 0)); };
  $('#aNext', root).onclick = () => { const k = capDe(pos()); if (caps[k + 1]) irA(caps[k + 1].t); };
  $('#aRate', root).onclick = () => { ri = (ri + 1) % RATES.length; au.playbackRate = RATES[ri]; $('#aRate b', root).textContent = String(RATES[ri]).replace('.', ',') + 'x'; };
  $('#aSleep', root).onclick = () => { si = (si + 1) % SLEEPS.length; const [n, m] = SLEEPS[si]; sleepAt = m > 0 ? Date.now() + m * 60000 : 0; sleepFin = m < 0; finCap = capDe(pos()); $('#aSleep b', root).textContent = n; };
  window.__lecturaAccion = a => { if (a === 'pausa') $('#aPlay', root).click(); else if (a === 'prev') irA(pos() - 30); else if (a === 'next') irA(pos() + 30); else if (a === 'stop') au.pause(); };
  try { if ('mediaSession' in navigator) { navigator.mediaSession.metadata = new MediaMetadata({ title: b.t, artist: b.a || '' }); navigator.mediaSession.setActionHandler('play', () => au.play()); navigator.mediaSession.setActionHandler('pause', () => au.pause()); navigator.mediaSession.setActionHandler('seekbackward', () => irA(pos() - 15)); navigator.mediaSession.setActionHandler('seekforward', () => irA(pos() + 15)); } } catch { }
  if (b.s !== 'leyendo' && b.s !== 'leido') await setStatus(b, 'leyendo');
  function cerrar() {
    clearInterval(gI); guarda(); au.pause(); au.removeAttribute('src'); urls.forEach(u => URL.revokeObjectURL(u));
    try { A?.lecturaEstado && A.lecturaEstado(false, false, '', ''); } catch { } delete window.__lecturaAccion;
    root.remove(); cur = null; emit();
  }
  $('#aBack', root).onclick = cerrar; cur = { cerrar };
  cargaPista(pi, b.ap?.t || 0); pinta();
}
