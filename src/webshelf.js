// Tu estantería como una página web: un solo archivo HTML con tus libros, portadas y calificaciones, para subirlo a cualquier sitio gratuito.
import { S, ST } from './state.js';
import { A, blobToB64 } from './native.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dataUrl = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.onerror = () => r(null); f.readAsDataURL(b); });

export async function construirPagina({ estados, resenas, titulo }) {
  const libros = S.books.filter(b => !b.oculto && estados.includes(b.s)).sort((a, z) => (z.en || '').localeCompare(a.en || '') || (a.order || 0) - (z.order || 0));
  const tarjetas = [];
  for (const b of libros.slice(0, 400)) {
    const img = b.cover ? await dataUrl(b.cover) : null, st = ST[b.s];
    tarjetas.push(`<article class="b"><div class="c" style="--c:${esc(b.c1 || '#555')}">${img ? `<img src="${img}" alt="">` : `<span>${esc(b.t)}</span>`}</div><h3>${esc(b.t)}</h3><p>${esc(b.a)}</p><p class="s" style="color:${esc(st.c.replace('var(--', '').replace(')', '') === 'ok' ? '#5DBB86' : st.c.includes('warn') ? '#E0B24A' : st.c.includes('bad') ? '#E07A70' : '#9AA9A5')}">${esc(st.n)}${b.rating ? ' · ' + '★'.repeat(b.rating) : ''}</p>${resenas && b.rev ? `<q>${esc(b.rev.slice(0, 220))}</q>` : ''}</article>`);
  }
  const leidos = S.books.filter(b => b.s === 'leido' && !b.oculto).length;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title>
<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#16262A;color:#EDE6D6;font:16px/1.5 system-ui,sans-serif;padding:28px max(16px,4vw)}h1{font:400 clamp(28px,5vw,46px)/1.1 Georgia,serif;margin:0 0 6px}.sub{color:#A9B7B3;margin:0 0 26px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:22px}.b{display:grid;gap:4px;align-content:start}.c{aspect-ratio:2/3;border-radius:3px 8px 8px 3px;background:var(--c);display:grid;place-items:center;overflow:hidden;box-shadow:inset 4px 0 0 rgba(0,0,0,.3),0 12px 20px -10px rgba(0,0,0,.7)}.c img{width:100%;height:100%;object-fit:cover}.c span{padding:10px;text-align:center;font:400 15px Georgia,serif;color:#F3E6C2}
h3{font-size:14px;margin:8px 0 0}p{margin:0;font-size:12.5px;color:#A9B7B3}.s{font-weight:600}q{font:italic 13px/1.4 Georgia,serif;color:#cfc7b4;quotes:none}footer{margin-top:40px;color:#6f807c;font-size:12px}</style></head><body>
<h1>${esc(titulo)}</h1><p class="sub">${libros.length} libros · ${leidos} leídos</p><div class="g">${tarjetas.join('')}</div><footer>Hecho con Mi Biblioteca Viva</footer></body></html>`;
}

export async function guardarPagina(html) {
  if (A?.guardarArchivo) { A.guardarArchivo('mi-estanteria.html', 'text/html', await blobToB64(new Blob([html], { type: 'text/html' }))); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = 'mi-estanteria.html'; document.body.appendChild(a); a.click(); a.remove();
}
