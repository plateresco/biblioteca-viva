// Glosario personal: tocas una palabra, ves su significado (Wikcionario, gratis) y la guardas con su contexto. Se repasa como las frases.
import { S, byId, saveMeta, newId } from './state.js';
import { $, $$, esc, openSheet, closeSheet, toast } from './ui.js';

const DIAS = [1, 3, 7, 14, 30];
const gl = () => (S.meta.gloss = S.meta.gloss || []);
export const palabras = () => gl();
export const pendientes = () => gl().filter(w => !w.rv || w.rv.due <= Date.now());

const limpiaPalabra = s => String(s || '').replace(/[^\p{L}\-']/gu, '').toLowerCase();

async function buscarSignificado(palabra) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 10000);
  try {
    const u = `https://es.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&redirects=1&titles=${encodeURIComponent(palabra)}&format=json&origin=*`;
    const j = await (await fetch(u, { signal: c.signal })).json();
    const p = Object.values(j.query?.pages || {})[0]; if (!p || p.missing !== undefined || !p.extract) return null;
    const ls = p.extract.split('\n').map(x => x.trim()).filter(Boolean);
    const i = ls.findIndex(x => /^español$/i.test(x)); const cuerpo = (i >= 0 ? ls.slice(i + 1) : ls);
    const cortes = cuerpo.findIndex((x, k) => k > 0 && /^(portugués|inglés|catalán|francés|italiano|gallego|latín|euskera|alemán)$/i.test(x));
    const util = (cortes > 0 ? cuerpo.slice(0, cortes) : cuerpo).filter(x => !/^(etimología|pronunciación|silabación|referencias|véase también|traducciones|conjugación)/i.test(x));
    return util.join('\n').slice(0, 900) || null;
  } catch { return undefined; } finally { clearTimeout(t); }
}

/** Abre la hoja con el significado. libro = libro del que viene la palabra, ctx = la frase donde apareció. */
export function definir(palabra, ctx = '', libro = null) {
  const w = limpiaPalabra(palabra); if (!w) return toast('Selecciona una palabra');
  const o = openSheet(`<h3>${esc(w)}</h3><div class="sub" id="gs">Buscando el significado…</div><div id="gdef1" class="gdef"></div><div class="row" style="margin-top:12px" id="gb"></div>`);
  const ya = () => gl().find(x => x.w === w);
  buscarSignificado(w).then(def => {
    const s = $('#gs', o); if (!s) return;
    if (def === undefined) { s.textContent = 'No pude consultarlo. ¿Hay conexión a internet?'; }
    else if (!def) { s.textContent = 'No encontré esa palabra en el Wikcionario. Puede estar en otra forma (por ejemplo, el masculino o el infinitivo).'; }
    else { s.textContent = 'Wikcionario'; $('#gdef1', o).textContent = def; }
    $('#gb', o).innerHTML = `<button class="btn" id="gsv">${ya() ? 'Ya está en tu glosario' : 'Guardar en el glosario'}</button><a class="btn ghost" href="https://es.wiktionary.org/wiki/${encodeURIComponent(w)}" target="_blank" rel="noopener">Abrir Wikcionario</a>`;
    $('#gsv', o).onclick = async () => {
      if (ya()) return;
      gl().push({ id: newId(), w, def: (def || '').slice(0, 600), ctx: String(ctx).slice(0, 260), bookUid: libro?.uid || '', at: Date.now() });
      await saveMeta(); $('#gsv', o).textContent = 'Guardada'; toast('Palabra guardada en el glosario');
    };
  });
}

export function repasarGlosario() {
  const cola = pendientes().slice(0, 10); if (!cola.length) return toast('Hoy no hay palabras por repasar');
  let i = 0, vista = false;
  const o = openSheet(`<h3>Repaso del glosario</h3><div class="sub" id="gc"></div><div class="rquote" id="gw" style="text-align:center;font-style:normal"></div><div id="gdd" class="gdef" style="display:none"></div><div class="row" style="margin-top:12px" id="gbt"></div>`);
  const pinta = () => {
    const w = cola[i]; $('#gc', o).textContent = `${cola.length - i} por repasar`;
    if (!w) { $('#gw', o).textContent = 'Terminaste el repaso de hoy.'; $('#gbt', o).innerHTML = '<button class="btn" id="gok">Cerrar</button>'; $('#gok', o).onclick = closeSheet; $('#gdd', o).style.display = 'none'; return; }
    vista = false; $('#gw', o).innerHTML = `<b style="font:400 24px var(--f-display)">${esc(w.w)}</b>${w.ctx ? `<div class="small" style="margin-top:8px;font-style:italic">«${esc(w.ctx)}»</div>` : ''}`;
    $('#gdd', o).style.display = 'none'; $('#gbt', o).innerHTML = '<button class="btn" id="gsh">Ver significado</button>';
    $('#gsh', o).onclick = () => {
      vista = true; $('#gdd', o).style.display = 'block'; $('#gdd', o).textContent = w.def || '(sin definición guardada)';
      $('#gbt', o).innerHTML = '<button class="btn" id="gy">La sabía</button><button class="btn ghost" id="gn">Repasar de nuevo</button>';
      const fin = async ok => { const box = ok ? Math.min(DIAS.length - 1, (w.rv?.box ?? -1) + 1) : 0; w.rv = { box, due: Date.now() + (ok ? DIAS[box] * 864e5 : 10 * 60000) }; await saveMeta(); i++; pinta(); };
      $('#gy', o).onclick = () => fin(true); $('#gn', o).onclick = () => fin(false);
    };
  };
  pinta();
}
export async function quitarPalabra(id) { S.meta.gloss = gl().filter(w => w.id !== id); await saveMeta(); }
