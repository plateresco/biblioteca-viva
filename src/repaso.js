// Repasar tus frases: una pregunta corta por frase («¿de qué libro es?»). Lo que fallas vuelve en minutos; lo que aciertas, en días. Sin notas ni puntajes.
import { S, byId, saveNote } from './state.js';
import { $, $$, esc, openSheet, toast } from './ui.js';

const DIAS = [1, 3, 7, 14, 30];
const mezcla = a => { const l = a.slice(); for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
const elegibles = () => S.notes.filter(n => byId(n.bookId) && (n.text || '').length >= 25);
export const pendientes = (tag = '') => elegibles().filter(n => (!n.rv || n.rv.due <= Date.now()) && (!tag || (n.tags || []).includes(tag)));

export function abrirRepaso(tag = '') {
  const todas = elegibles(), libros = [...new Set(todas.map(n => n.bookId))];
  if (todas.length < 3 || libros.length < 2) return toast('Necesitas al menos 3 frases de 2 libros para repasar');
  let cola = mezcla(pendientes(tag)).slice(0, 10); const total = cola.length;
  if (!cola.length) return toast('Hoy no hay frases por repasar. Vuelve mañana.');
  let hechas = 0, resp = false;
  const o = openSheet(`<h3>Repaso de frases</h3><div class="sub" id="rcola"></div><div class="rbar2"><i id="rprog"></i></div>
    <div class="rquote" id="rq"></div><div id="ro" style="display:grid;gap:8px;margin-top:10px"></div><div class="small" id="rfb" style="min-height:36px;margin-top:8px"></div>`);
  const pinta = () => {
    $('#rcola', o).textContent = cola.length ? `${cola.length} por repasar` : 'Listo';
    $('#rprog', o).style.width = (hechas / total * 100) + '%';
    const n = cola[0];
    if (!n) { $('#rq', o).textContent = 'Terminaste el repaso de hoy.'; $('#ro', o).innerHTML = '<button class="btn" id="rok">Cerrar</button>'; $('#rfb', o).textContent = 'Las frases que fallaste vuelven antes que las demás.'; $('#rok', o).onclick = () => document.querySelector('#sheet')?.remove(); return; }
    resp = false; const b = byId(n.bookId);
    const otros = mezcla(libros.filter(id => id !== n.bookId)).slice(0, 2).map(id => byId(id));
    const ops = mezcla([b, ...otros].filter(Boolean));
    $('#rq', o).textContent = `«${n.text.slice(0, 260)}${n.text.length > 260 ? '…' : ''}»`; $('#rfb', o).textContent = '¿De qué libro es?';
    $('#ro', o).innerHTML = ops.map(x => `<button class="ropt" data-id="${x.id}">${esc(x.t)}</button>`).join('');
    $$('.ropt', o).forEach(bt => bt.onclick = async () => {
      if (resp) return; resp = true; const ok = +bt.dataset.id === n.bookId;
      $$('.ropt', o).forEach(x => { if (+x.dataset.id === n.bookId) x.classList.add('good'); });
      const box = ok ? Math.min(DIAS.length - 1, (n.rv?.box ?? -1) + 1) : 0;
      n.rv = { box, due: Date.now() + (ok ? DIAS[box] * 864e5 : 5 * 60000) }; n.upd = Date.now(); await saveNote(n);
      if (ok) { cola.shift(); hechas++; $('#rfb', o).textContent = `Bien. Esta frase vuelve en ${DIAS[box]} ${DIAS[box] === 1 ? 'día' : 'días'}.`; }
      else { bt.classList.add('bad'); cola.push(cola.shift()); $('#rfb', o).textContent = `Era de «${b.t}». Vuelve en unos minutos.`; }
      setTimeout(pinta, 1500);
    });
  };
  pinta();
}
