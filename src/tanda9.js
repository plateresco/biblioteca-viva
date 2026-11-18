// Tanda 9: bienvenida de tres pasos, modo viaje y avisos con contexto.
import { S, byId } from './state.js';
import { P, setPref } from './prefs.js';
import { $, $$, esc, toast } from './ui.js';
import { A } from './native.js';
import { inventario, mb, sePuedeQuitar, quitarLocal, bajar, esAudio } from './espacio.js';
import { hasToken, isEnabled } from './sync.js';
import { contextoAvisos, empujarWidgets } from './widgets.js';

const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { } return null; };
const bloque = (t, sub, cuerpo) => `<div class="card"><h3>${t}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}${cuerpo || ''}</div>`;

/* ================================================================== Bienvenida */
const PASOS = [
  { sel: ['#tplus', '.tab[data-t="lib"]'], t: 'Agrega tu primer libro', d: 'Aquí agregas un EPUB, un libro de papel con su ISBN o una foto de tu estantería.' },
  { sel: ['.tab[data-t="lib"]'], t: 'Tu estante', d: 'Cada libro es un lomo. Tócalo para sacarlo y empezar a leer.' },
  { sel: ['.tab[data-t="hoy"]'], t: 'Hoy', d: 'Tu libro actual, tu meta y tu racha, siempre a mano.' },
];
export function tour(forzar = false) {
  if (!forzar && (LS('bv-tour') || S.books.length)) return;
  if ($('#tour')) return;
  const o = document.createElement('div'); o.id = 'tour'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Bienvenida');
  o.innerHTML = '<div class="tspot" id="tsp"></div><div class="ttip" id="ttp"></div>'; document.body.appendChild(o);
  let i = 0;
  const fin = () => { LS('bv-tour', '1'); o.remove(); removeEventListener('resize', pinta); };
  const objetivo = p => { for (const s of p.sel) { const e = document.querySelector(s); if (e) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return r; } } return null; };
  const pinta = () => {
    const p = PASOS[i], r = objetivo(p) || { left: innerWidth / 2 - 30, top: innerHeight - 70, width: 60, height: 60, bottom: innerHeight - 10 }, pad = 6;
    const sp = $('#tsp', o); sp.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px;border-radius:${Math.min(22, (r.height + pad * 2) / 2.2)}px`;
    const tp = $('#ttp', o), arriba = r.top > innerHeight / 2, w = Math.min(340, innerWidth - 24);
    tp.style.cssText = `width:${w}px;left:${Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2))}px;${arriba ? `bottom:${innerHeight - r.top + 18}px` : `top:${r.bottom + 18}px`}`;
    const hayCat = i === 0 && A?.httpGet && A?.descargarEpub;
    tp.innerHTML = `<b>${esc(p.t)}</b><p>${esc(p.d)}</p>${hayCat ? '<button class="linkb" id="tcat">Probar con un clásico gratis</button>' : ''}<div class="trow"><span class="tdots">${PASOS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</span><span class="row" style="gap:6px"><button class="btn ghost" id="tsk">Saltar</button><button class="btn" id="tnx">${i === PASOS.length - 1 ? 'Listo' : 'Siguiente'}</button></span></div>`;
    $('#tsk', tp).onclick = fin; $('#tnx', tp).onclick = () => { if (i === PASOS.length - 1) fin(); else { i++; pinta(); } };
    $('#tcat', tp)?.addEventListener('click', () => { fin(); import('./catalogo.js').then(m => m.abrirCatalogo()); });
  };
  addEventListener('resize', pinta); pinta();
}

/* ================================================================== Modo viaje */
const selViaje = () => { try { return new Set(JSON.parse(LS('bv-viaje-sel') || '[]')); } catch { return new Set(); } };
const guardaSel = s => LS('bv-viaje-sel', JSON.stringify([...s]));
const bajados = () => { try { return JSON.parse(LS('bv-viaje-bajados') || '[]'); } catch { return []; } };

async function paginaViaje(b, ctx, redraw) {
  b.innerHTML = '<div class="skel"><i></i><i></i><i></i></div>';
  const inv = await inventario(); if (!document.body.contains(b)) return;
  let sel = selViaje();
  if (!LS('bv-viaje-sel')) { inv.filter(x => x.b.s === 'leyendo' || x.b.s === 'porleer').slice(0, 3).forEach(x => sel.add(x.b.id)); guardaSel(sel); }
  sel = new Set([...sel].filter(id => inv.some(x => x.b.id === id)));
  let libre = null; try { const e = await navigator.storage?.estimate?.(); if (e?.quota) libre = e.quota - e.usage; } catch { }
  const elegidos = inv.filter(x => sel.has(x.b.id)), faltan = elegidos.filter(x => !x.local && !esAudio(x.b)), peso = elegidos.reduce((a, x) => a + (x.t || 0), 0);
  const puede = faltan.length && (isEnabled() || hasToken());
  const fila = x => `<label class="vjr9"><input type="checkbox" data-i="${x.b.id}" ${sel.has(x.b.id) ? 'checked' : ''}><span class="vcov" style="--c1:${x.b.c1 || '#555'}"></span><span style="flex:1;min-width:0"><b>${esc(x.b.t)}</b><small class="sub">${x.t != null ? mb(x.t) : 'en Drive'}</small></span>${x.local ? '<span class="bdg9 ok">En el teléfono</span>' : esAudio(x.b) ? '<span class="bdg9">Solo en otro equipo</span>' : '<span class="bdg9">En Drive</span>'}</label>`;
  const hay = bajados().length;
  b.innerHTML = bloque('Modo viaje', 'Elige los libros que llevas sin conexión. Los que están solo en Drive se bajan antes de salir.',
    `<div class="vjres"><b>Llevas ${elegidos.length} ${elegidos.length === 1 ? 'libro' : 'libros'}</b><span class="sub">${peso ? mb(peso) : '—'}${libre != null ? ` · libres ${mb(libre)}` : ''}</span></div>`)
    + `<div class="card"><div style="display:grid;gap:6px" id="vjl">${inv.length ? inv.map(fila).join('') : '<div class="sub">Aún no hay libros con archivo.</div>'}</div>
      <div id="vjs" style="margin-top:12px">${!faltan.length && elegidos.length ? '<div class="okb9">Todo listo para viajar</div>' : `<button class="btn" id="vjgo" style="width:100%" ${puede ? '' : 'disabled'}>${faltan.length ? `Bajar ${faltan.length} ${faltan.length === 1 ? 'libro' : 'libros'}` : 'Elige libros'}</button>${faltan.length && !puede ? '<div class="small" style="margin-top:6px">Conecta Google Drive en «Sincronización» para poder bajarlos.</div>' : ''}`}</div></div>`
    + (hay ? bloque('Al volver', `Bajaste ${hay} ${hay === 1 ? 'libro' : 'libros'} para el viaje. Puedes quitarlos de este teléfono sin perderlos: siguen en Drive.`, '<div class="row" style="margin-top:10px"><button class="btn ghost" id="vjlib">Liberar lo que bajé</button></div>') : '');
  $$('#vjl input', b).forEach(c => c.onchange = () => { const s = selViaje(); c.checked ? s.add(+c.dataset.i) : s.delete(+c.dataset.i); guardaSel(s); redraw(); });
  $('#vjgo', b)?.addEventListener('click', async () => {
    const zona = $('#vjs', b); let n = 0; const baj = bajados();
    for (const x of faltan) {
      zona.innerHTML = `<div class="sub">Bajando ${esc(x.b.t)}… (${n + 1} de ${faltan.length})</div><div class="prog5"><i style="width:${n / faltan.length * 100}%"></i></div>`;
      try { await bajar(x.b); baj.push(x.b.id); n++; } catch (e) { toast(e.message || 'No se pudo bajar'); break; }
    }
    LS('bv-viaje-bajados', JSON.stringify([...new Set(baj)])); toast(n === faltan.length ? 'Todo listo para viajar' : `Se bajaron ${n} de ${faltan.length}`); redraw();
  });
  $('#vjlib', b)?.addEventListener('click', async () => {
    let q = 0; for (const id of bajados()) { const bk = byId(id); if (bk && sePuedeQuitar(bk)) { try { await quitarLocal(bk); q++; } catch { } } }
    LS('bv-viaje-bajados', null); toast(q ? `Liberados ${q} libros de este teléfono` : 'No había nada que liberar'); redraw();
  });
}

/* ================================================================== Avisos */
const aviso = () => ({ prestamos: true, meta: true, plan: true, desde: '22:00', hasta: '08:00', ...(P.avisos || {}) });
function paginaAvisos(b, ctx, redraw) {
  const a = aviso(), cx = contextoAvisos(), hoy = cx.prestamo?.txt && a.prestamos ? ['Préstamo por vencer', cx.prestamo.txt] : cx.plan?.txt && a.plan ? ['Plan de lectura', cx.plan.txt] : [a.meta ? '¿Un rato de lectura?' : 'Recordatorio', a.meta ? 'Te faltan algunas páginas de tu meta de hoy.' : 'Un ratito antes de que termine el día.'];
  const fila = (k, n, d) => `<label class="chk2" style="align-items:flex-start"><input type="checkbox" data-k="${k}" ${a[k] ? 'checked' : ''}><span><b>${n}</b><br><span class="small">${d}</span></span></label>`;
  b.innerHTML = bloque('Avisos con contexto', P.reminder.on ? `El aviso diario sale a las ${P.reminder.time}. Elige qué puede decirte.` : 'Activa el recordatorio diario en «Recordatorio» para recibir avisos. Aquí eliges qué pueden decir.',
    `<div style="display:grid;gap:8px;margin-top:10px">${fila('prestamos', 'Préstamos por vencer', 'Cuando un libro prestado se devuelve en 2 días o menos.')}${fila('plan', 'Plan de lectura atrasado', 'Si vas con retraso para terminar un libro en su fecha.')}${fila('meta', 'Meta del día', 'Las páginas que te faltan para tu meta.')}</div>`)
    + bloque('Horario de silencio', 'Nada se avisa dentro de este horario. Si el aviso cae ahí, sale cuando termina.', `<div class="two" style="margin-top:10px"><label style="display:grid;gap:4px;font-size:13px">Desde<input type="time" id="avd" value="${a.desde}"></label><label style="display:grid;gap:4px;font-size:13px">Hasta<input type="time" id="avh" value="${a.hasta}"></label></div>`)
    + bloque('Así se vería hoy', 'Solo se manda un aviso por día: el más importante.', `<div class="notif9"><b>${esc(hoy[0])}</b><span>${esc(hoy[1])}</span></div>${A?.avisos ? '' : '<div class="small" style="margin-top:8px">Los avisos con la app cerrada funcionan en la app de Android.</div>'}`);
  const guarda = () => { setPref('avisos', { ...aviso(), prestamos: $('[data-k=prestamos]', b).checked, plan: $('[data-k=plan]', b).checked, meta: $('[data-k=meta]', b).checked, desde: $('#avd', b).value || '22:00', hasta: $('#avh', b).value || '08:00' }); empujarWidgets(); };
  $$('input[data-k]', b).forEach(c => c.onchange = () => { guarda(); redraw(); });
  $('#avd', b).onchange = $('#avh', b).onchange = () => { guarda(); toast('Horario guardado'); };
}

export const MENU9 = [
  ['viaje', 'Modo viaje', () => 'Libros sin conexión para el avión', 'download'],
  ['avisos', 'Avisos con contexto', () => { const a = aviso(); return [a.prestamos, a.plan, a.meta].filter(Boolean).length + ' de 3 activos'; }, 'bell'],
];
export const PAGES9 = { viaje: paginaViaje, avisos: paginaAvisos };
