// Lector de cómics (CBZ): página a página o a doble página, de izquierda a derecha o estilo manga, con zoom.
import { byId, getFile, setStatus, persistBook, addPages, addTime, emit } from './state.js';
import { $, esc, ic, toast } from './ui.js';
import { leerCbz } from './documentos.js';
import { ensureEpub } from './sync.js';
import { dockear } from './dock.js';

const prefs = (() => { try { return JSON.parse(localStorage.getItem('bv-comicprefs')) || {}; } catch { return {}; } })();
const setPref = (k, v) => { prefs[k] = v; try { localStorage.setItem('bv-comicprefs', JSON.stringify(prefs)); } catch { } };
let cur = null;
export const cerrarComic = () => { if (cur) cur.cerrar(); };

export async function openComic(id, pag0) {
  cerrarComic(); document.querySelector('.docr')?.remove();
  const b = byId(id); let file = b && await getFile(id);
  if (b && !file && b.hasFile) { try { toast('Descargando el cómic desde Google Drive…'); file = await ensureEpub(b); } catch (e) { toast(e.message || 'No se pudo descargar'); return; } }
  if (!file) { toast('Este libro no tiene archivo'); return; }
  const root = document.createElement('div'); root.className = 'docr comicr';
  root.innerHTML = `<div class="dbar"><button class="iconbtn" id="cBack" aria-label="Volver">${ic('back')}</button><div class="ti"><b>${esc(b.t)}</b><span id="cLoc">Abriendo…</span></div>
    <button class="iconbtn" id="cMark" aria-label="Marcar página" aria-pressed="false">${ic('bookmark')}</button><button class="iconbtn" id="cOpt" aria-label="Ajustes">${ic('aa')}</button></div>
    <div class="darea comic" id="cArea"><div class="cimgs" id="cImgs"></div><div class="dskel" id="cSkel"><div class="skel" style="width:70%"></div></div></div>
    <div class="dpanel" id="cPanel" hidden></div>
    <div class="dfoot"><button class="iconbtn" id="cPrev" aria-label="Anterior">${ic('left')}</button><input type="range" id="cSlide" min="1" max="1" value="1" aria-label="Página"><button class="iconbtn" id="cNext" aria-label="Siguiente">${ic('right')}</button></div>`;
  document.body.appendChild(root); dockear(true);
  let zip, nombres; try { ({ zip, nombres } = await leerCbz(file)); } catch (e) { console.error(e); toast('No pude abrir este cómic'); root.remove(); dockear(false); return; }
  const n = nombres.length; let pag = Math.min(n, Math.max(1, +pag0 || b.pg || 1)), gen = 0; const urls = new Map();
  $('#cSlide', root).max = n;
  if (b.s !== 'leyendo' && b.s !== 'leido') await setStatus(b, 'leyendo');
  const url = async i => { if (i < 1 || i > n) return null; if (!urls.has(i)) urls.set(i, URL.createObjectURL(await zip.files[nombres[i - 1]].async('blob'))); return urls.get(i); };
  const dos = () => !!prefs.dos && $('#cArea', root).clientWidth >= 820 && pag < n;

  async function dibuja() {
    const mi = ++gen, ds = dos(), ids = ds ? [pag, pag + 1] : [pag]; if (ds && prefs.manga) ids.reverse();
    const us = await Promise.all(ids.map(url)); if (mi !== gen) return;
    const cont = $('#cImgs', root); cont.className = 'cimgs' + (ds ? ' dos' : '') + (prefs.ajuste === 'alto' ? ' alto' : '');
    cont.innerHTML = us.map(u => `<img src="${u}" alt="">`).join(''); $('#cSkel', root)?.remove(); $('#cArea', root).scrollTop = 0;
    $('#cLoc', root).textContent = `Página ${pag}${ds ? '–' + (pag + 1) : ''} de ${n}`; $('#cSlide', root).value = pag; pintaMark();
    url(pag + (ds ? 2 : 1)); url(pag + (ds ? 3 : 2));            // se van preparando las siguientes
  }
  let guarda = 0, fin = b.s === 'leido', acc = 0, flushed = 0;
  async function avanza() {
    const pr = pag / n, leidas = Math.round(pr * b.p), d = leidas - (b.r || 0);
    if (d > 0 && d <= 30) await addPages(b.id, d); if (d > 0) b.r = leidas; b.progress = pr; b.pg = pag; clearTimeout(guarda); guarda = setTimeout(() => persistBook(b), 600);
    if (pr >= .985 && !fin) { fin = true; await setStatus(b, 'leido'); toast('¡Terminaste el cómic!'); }
  }
  const ir = x => { pag = Math.min(n, Math.max(1, x)); dibuja(); avanza(); };
  const paso = () => (dos() ? 2 : 1), sig = () => ir(pag + (prefs.manga ? -paso() : paso())), ant = () => ir(pag + (prefs.manga ? paso() : -paso()));
  $('#cNext', root).onclick = () => (prefs.manga ? ir(pag - paso()) : ir(pag + paso())); $('#cPrev', root).onclick = () => (prefs.manga ? ir(pag + paso()) : ir(pag - paso()));
  $('#cSlide', root).oninput = e => ir(+e.target.value);
  const tecla = e => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return; if (e.key === 'ArrowRight') (prefs.manga ? ant() : sig()); else if (e.key === 'ArrowLeft') (prefs.manga ? sig() : ant()); else if (e.key === 'Escape') cerrar(); };
  document.addEventListener('keyup', tecla);
  const area = $('#cArea', root); let tx = 0, ty = 0, ult = 0;
  area.addEventListener('touchstart', e => { tx = e.changedTouches[0].screenX; ty = e.changedTouches[0].screenY; }, { passive: true });
  area.addEventListener('touchend', e => { const dx = e.changedTouches[0].screenX - tx, dy = e.changedTouches[0].screenY - ty; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) (dx < 0 ? sig() : ant()); }, { passive: true });
  area.addEventListener('click', e => {
    if (e.target.closest('.dpanel')) return; const w = area.clientWidth, x = e.clientX - area.getBoundingClientRect().left;
    if (Date.now() - ult < 300) { area.classList.toggle('zoom2'); ult = 0; return; } ult = Date.now();
    setTimeout(() => { if (ult && Date.now() - ult >= 280) { ult = 0; if (area.classList.contains('zoom2')) return; if (x < w * .3) ant(); else if (x > w * .7) sig(); } }, 300);
  });
  const marks = () => (b.marks = b.marks || []), pintaMark = () => $('#cMark', root).setAttribute('aria-pressed', String(marks().some(m => m.pg === pag)));
  $('#cMark', root).onclick = async () => { if (marks().some(m => m.pg === pag)) { b.marks = marks().filter(m => m.pg !== pag); toast('Marcador quitado'); } else { marks().push({ pg: pag, pct: Math.round(pag / n * 100), t: Date.now() }); toast('Página marcada'); } await persistBook(b); pintaMark(); };
  const panel = $('#cPanel', root);
  $('#cOpt', root).onclick = () => {
    if (!panel.hidden) { panel.hidden = true; return; } panel.hidden = false;
    panel.innerHTML = `<h3>Ajustes</h3><div class="opts"><label class="chk"><input type="checkbox" id="c-dos" ${prefs.dos ? 'checked' : ''}> Doble página (pantalla ancha)</label><label class="chk"><input type="checkbox" id="c-man" ${prefs.manga ? 'checked' : ''}> Lectura estilo manga (de derecha a izquierda)</label><label>Ajustar a<select id="c-aj"><option value="ancho" ${prefs.ajuste !== 'alto' ? 'selected' : ''}>El ancho</option><option value="alto" ${prefs.ajuste === 'alto' ? 'selected' : ''}>El alto</option></select></label><div class="small">Toca dos veces la página para acercarla.</div>${marks().length ? `<h3 style="margin-top:10px">Marcadores</h3>${marks().map(m => `<a data-pg="${m.pg}">Página ${m.pg}</a>`).join('')}` : ''}</div>`;
    $('#c-dos', panel).onchange = e => { setPref('dos', e.target.checked); dibuja(); }; $('#c-man', panel).onchange = e => { setPref('manga', e.target.checked); dibuja(); }; $('#c-aj', panel).onchange = e => { setPref('ajuste', e.target.value); dibuja(); };
    panel.querySelectorAll('[data-pg]').forEach(a => a.onclick = () => { ir(+a.dataset.pg); panel.hidden = true; });
  };
  const timeT = setInterval(() => { if (document.visibilityState === 'visible' && document.hasFocus()) { acc += 5; if (acc - flushed >= 20) { addTime(b.id, acc - flushed); flushed = acc; } } }, 5000);
  function cerrar() { clearInterval(timeT); if (acc > flushed) addTime(b.id, acc - flushed); clearTimeout(guarda); persistBook(b); document.removeEventListener('keyup', tecla); urls.forEach(u => URL.revokeObjectURL(u)); root.remove(); dockear(false); cur = null; emit(); }
  $('#cBack', root).onclick = cerrar; cur = { cerrar }; dibuja();
}
