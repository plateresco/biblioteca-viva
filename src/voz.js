// Voz neuronal sin conexión (solo en la app de Android): descargar, quitar y elegir la voz.
import { $, $$, esc, toast } from './ui.js';

const A = typeof window !== 'undefined' ? window.AndroidApp : null;
export const hayNeural = () => !!(A && A.neuralCatalogo);

let actual = null;     // función que vuelve a dibujar el panel visible
let bajando = {};      // id -> porcentaje

if (typeof window !== 'undefined') {
  window.__vozProgreso = (id, p) => { bajando[id] = p; $$(`[data-vp="${id}"]`).forEach(e => { e.textContent = `Descargando… ${p} %`; }); };
  window.__vozListo = id => { delete bajando[id]; toast('Voz instalada'); actual && actual(); };
  window.__vozError = (id, m) => { delete bajando[id]; toast(m || 'No se pudo descargar la voz'); actual && actual(); };
}

export function dibujarVozNeuronal(cont, prefs, setPref, alCambiar) {
  if (!cont) return;
  if (!hayNeural()) { cont.innerHTML = '<div class="small">La voz neuronal funciona en la app de Android.</div>'; return; }
  const pinta = () => {
    let voces = []; try { voces = JSON.parse(A.neuralCatalogo()); } catch { /* sin catálogo */ }
    const instaladas = voces.filter(v => v.lista), activa = instaladas.some(v => v.id === prefs.neural) ? prefs.neural : '';
    cont.innerHTML = `<div class="vneu"><b>Voz neuronal sin conexión</b>
      <div class="small">Suena mucho más natural y funciona sin internet. Se descarga una vez (unos 20 MB cada voz).</div>
      <label class="vopt"><input type="radio" name="vmotor" value="" ${!activa ? 'checked' : ''}> <span>Voz de Android (la de Google)</span></label>
      ${voces.map(v => `<div class="vrow">
        ${v.lista ? `<label class="vopt"><input type="radio" name="vmotor" value="${esc(v.id)}" ${activa === v.id ? 'checked' : ''}> <span><b>${esc(v.nombre)}</b></span></label>` : `<span class="vopt"><span><b>${esc(v.nombre)}</b></span></span>`}
        ${v.lista ? `<button class="btn ghost" data-q="${esc(v.id)}">Quitar</button>`
          : bajando[v.id] != null ? `<span class="small" data-vp="${esc(v.id)}">Descargando… ${bajando[v.id]} %</span>`
          : `<button class="btn" data-d="${esc(v.id)}">Descargar · ${v.mb} MB</button>`}
      </div>`).join('')}</div>`;
    $$('input[name="vmotor"]', cont).forEach(r => r.onchange = () => { setPref('neural', r.value); prefs.neural = r.value; alCambiar && alCambiar(); });
    $$('[data-d]', cont).forEach(b => b.onclick = () => { bajando[b.dataset.d] = 0; A.neuralDescargar(b.dataset.d); pinta(); });
    $$('[data-q]', cont).forEach(b => b.onclick = () => { if (prefs.neural === b.dataset.q) { setPref('neural', ''); prefs.neural = ''; } A.neuralBorrar(b.dataset.q); setTimeout(pinta, 250); });
  };
  actual = pinta; pinta();
}
