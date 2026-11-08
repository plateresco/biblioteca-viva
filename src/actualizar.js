// Versiones nuevas de la app de Android: se consultan en GitHub (público) y se instalan desde la propia app.
import { A } from './native.js';
import { $, esc, ic, openSheet, closeSheet, toast } from './ui.js';

const REPO = 'plateresco/biblioteca-viva';
export const versionActual = () => (A ? { code: A.versionCode(), name: A.versionName() } : null);

export async function buscarActualizacion() {
  const v = versionActual(); if (!v) return null;
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error('No pude consultar GitHub.');
  const j = await r.json(), code = parseInt(String(j.tag_name || '').replace(/\D/g, '')) || 0;
  const asset = (j.assets || []).find(a => /\.apk$/i.test(a.name));
  if (!asset || code <= v.code) return { nueva: false, actual: v };
  return { nueva: true, actual: v, code, name: j.name || ('versión ' + code), url: asset.browser_download_url, notas: (j.body || '').slice(0, 400) };
}

export function ofrecerInstalar(u) {
  const o = openSheet(`<h3>Hay una versión nueva</h3><div class="sub">${esc(u.name)} · la tuya es la ${esc(u.actual.name)}</div>
    ${u.notas ? `<p style="font-size:13.5px;color:var(--muted)">${esc(u.notas)}</p>` : ''}
    <div class="row" style="margin-top:14px"><button class="btn" id="upd">Actualizar ahora</button><button class="btn ghost" data-x>Después</button></div><div class="small" id="updm" style="margin-top:10px"></div>`);
  $('#upd', o).onclick = () => { $('#upd', o).disabled = true; $('#updm', o).textContent = 'Descargando… Android te pedirá confirmar la instalación.'; A.instalarActualizacion(u.url); };
  window.__actualizacionFalla = () => { const b = $('#upd'); if (b) { b.disabled = false; $('#updm').textContent = 'No se pudo bajar. Intenta de nuevo.'; } };
}

// Al abrir la app: avisa una vez por versión.
export async function avisarSiHay() {
  if (!A) return;
  try {
    const u = await buscarActualizacion(); if (!u?.nueva) return;
    if (localStorage.getItem('bv-upd-visto') === String(u.code)) return;
    localStorage.setItem('bv-upd-visto', String(u.code)); ofrecerInstalar(u);
  } catch { /* sin conexión: se intenta otro día */ }
}
