// Clásicos gratis: catálogo de libros de dominio público (Project Gutenberg). La búsqueda y la descarga las hace la app de Android,
// porque el navegador no deja leer ese sitio desde otra página; el EPUB baja directo a tu estantería.
import { S } from './state.js';
import { norm } from './importar.js';
import { A } from './native.js';
import { $, $$, esc, openSheet, closeSheet, toast } from './ui.js';

export const disponible = () => !!(A && A.httpGet && A.descargarEpub);
const BASE = 'https://www.gutenberg.org';

function http(url) {
  return new Promise((res, rej) => {
    const id = Math.random().toString(36).slice(2), t = setTimeout(() => rej(new Error('El catálogo tardó demasiado en responder.')), 25000);
    const prev = window.__httpRes;
    window.__httpRes = (i, st, body) => { if (i !== id) return prev && prev(i, st, body); clearTimeout(t); window.__httpRes = prev; st >= 200 && st < 300 ? res(body) : rej(new Error('No pude consultar el catálogo (' + st + ').')); };
    A.httpGet(id, url);
  });
}

export async function buscar(q, idioma) {
  const consulta = [idioma && idioma !== 'todos' ? `l.${idioma}` : '', q].filter(Boolean).join(' ').trim() || 'l.es';
  const xml = await http(`${BASE}/ebooks/search.opds/?query=${encodeURIComponent(consulta)}&sort_order=downloads`);
  const doc = new DOMParser().parseFromString(xml, 'text/xml'), out = [];
  for (const e of doc.querySelectorAll('entry')) {
    const id = (e.querySelector('id')?.textContent.match(/gutenberg:(\d+)/) || (e.querySelector('link[href*="/ebooks/"]')?.getAttribute('href') || '').match(/ebooks\/(\d+)/) || [])[1];
    const t = e.querySelector('title')?.textContent.trim(), a = e.querySelector('content')?.textContent.trim();
    if (id && t && !/^\d+ (books?|libros?)/i.test(t)) out.push({ id, t, a: a || '' });
  }
  return out.slice(0, 25);
}

const tengo = x => S.books.some(b => b.gutenberg === x.id || (norm(b.t) === norm(x.t)));

export function abrirCatalogo() {
  if (!disponible()) { toast('El catálogo funciona en la app de Android.'); return; }
  let idioma = 'es', corre = 0;
  const o = openSheet(`<h3>Clásicos gratis</h3><div class="sub">Libros de dominio público de Project Gutenberg. Se bajan como EPUB y quedan en «Por leer».</div>
    <form id="cqf" style="display:flex;gap:8px;margin-top:12px"><input id="cq" type="search" placeholder="Título o autor" aria-label="Buscar" style="flex:1"><button class="btn" type="submit">Buscar</button></form>
    <div class="row" id="ci" style="gap:6px;margin:10px 0">${[['es', 'Español'], ['en', 'Inglés'], ['todos', 'Todos']].map(([k, n]) => `<button class="chip" data-i="${k}" aria-pressed="${k === idioma}">${n}</button>`).join('')}</div>
    <div id="cl" style="display:grid;gap:8px;max-height:52vh;overflow:auto"></div>`);
  const lista = async () => {
    const mi = ++corre, l = $('#cl', o); l.innerHTML = '<div class="small">Buscando…</div>';
    try {
      const r = await buscar($('#cq', o).value, idioma); if (mi !== corre) return;
      l.innerHTML = r.length ? r.map(x => `<div class="cat2"><div style="min-width:0;flex:1"><b>${esc(x.t)}</b><div class="small">${esc(x.a)}</div></div><button class="btn ${tengo(x) ? 'ghost' : ''}" data-g="${x.id}" data-t="${esc(x.t)}">${tengo(x) ? 'En tu estante' : 'Agregar'}</button></div>`).join('') : '<div class="small">No encontré nada. Prueba con otra palabra o con el idioma «Todos».</div>';
      $$('[data-g]', l).forEach(b => b.onclick = () => bajar(b));
    } catch (e) { if (mi === corre) l.innerHTML = `<div class="small" style="color:var(--bad)">${esc(e.message || 'No pude consultar el catálogo.')}</div>`; }
  };
  const bajar = b => {
    if (b.textContent === 'En tu estante' || b.disabled) return;
    b.disabled = true; b.textContent = 'Bajando…';
    window.__descargaError = m => { b.disabled = false; b.textContent = 'Agregar'; toast(m || 'No se pudo bajar el libro'); };
    window.__descargaOk = () => { b.textContent = 'En tu estante'; b.classList.add('ghost'); };
    A.descargarEpub(`${BASE}/ebooks/${b.dataset.g}.epub3.images`, `gutenberg-${b.dataset.g}.epub`);
  };
  $('#cqf', o).onsubmit = e => { e.preventDefault(); lista(); };
  $$('#ci [data-i]', o).forEach(c => c.onclick = () => { idioma = c.dataset.i; $$('#ci [data-i]', o).forEach(x => x.setAttribute('aria-pressed', x === c)); lista(); });
  lista();
}
