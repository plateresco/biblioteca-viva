// Exportar tus subrayados y notas: Markdown, Obsidian o texto simple.
import { S, byId } from './state.js';
import { $, $$, esc, openSheet, toast } from './ui.js';
import { A, blobToB64 } from './native.js';

const COL = { amarillo: 'amarillo', verde: 'verde', azul: 'azul', rosa: 'rosa' };
const fecha = t => { const d = new Date(t || Date.now()); return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }); };
const limpio = s => String(s || '').replace(/\s+/g, ' ').trim();

export function construir(bookId, fmt) {
  const ids = bookId ? [bookId] : [...new Set(S.notes.map(n => n.bookId))];
  const bloques = [];
  for (const id of ids) {
    const b = byId(id); if (!b) continue;
    const ns = S.notes.filter(n => n.bookId === id).sort((a, z) => (a.createdAt || 0) - (z.createdAt || 0)); if (!ns.length) continue;
    if (fmt === 'md') bloques.push(`# ${b.t}\n${b.a}\n\n` + ns.map(n => `> ${limpio(n.text)}\n${n.comment ? `\n**Mi nota:** ${limpio(n.comment)}\n` : ''}\n_Subrayado ${COL[n.color] || 'amarillo'} · ${fecha(n.createdAt)}_\n`).join('\n'));
    else if (fmt === 'obs') bloques.push(`---\ntitulo: ${b.t}\nautor: ${b.a}\ntags: [libros, subrayados]\n---\n\n` + ns.map(n => `> [!quote] ${fecha(n.createdAt)}\n> ${limpio(n.text)}\n${n.comment ? `\n> [!note] Mi nota\n> ${limpio(n.comment)}\n` : ''}`).join('\n'));
    else bloques.push(`${b.t} · ${b.a}\n\n` + ns.map(n => `"${limpio(n.text)}"${n.comment ? `\nNota: ${limpio(n.comment)}` : ''}`).join('\n\n'));
  }
  return bloques.join(fmt === 'txt' ? '\n\n----------\n\n' : '\n\n');
}

async function guardar(nombre, texto, mime) {
  if (A?.guardarArchivo) { A.guardarArchivo(nombre, mime, await blobToB64(new Blob([texto], { type: mime }))); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: mime })); a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
}

export function abrirExportar(bookId = null) {
  const libros = [...new Set(S.notes.map(n => n.bookId))].map(id => byId(id)).filter(Boolean);
  if (!libros.length) return toast('Aún no tienes frases para exportar');
  let fmt = 'md', sel = bookId && libros.some(b => b.id === bookId) ? bookId : null;
  const o = openSheet(`<h3>Exportar frases</h3><div class="sub">Se genera un archivo de texto con tus subrayados y tus notas.</div>
    <label style="display:grid;gap:4px;margin-top:12px;font-size:13px">Libro<select id="exb"><option value="">Todos los libros (${libros.length})</option>${libros.map(b => `<option value="${b.id}" ${b.id === sel ? 'selected' : ''}>${esc(b.t)}</option>`).join('')}</select></label>
    <div class="seg2" id="exf" style="margin-top:12px"><button data-f="md" aria-pressed="true">Markdown</button><button data-f="obs" aria-pressed="false">Obsidian</button><button data-f="txt" aria-pressed="false">Texto simple</button></div>
    <pre class="expre" id="exp"></pre>
    <div class="row" style="margin-top:12px"><button class="btn" id="exc">Copiar</button><button class="btn ghost" id="exg">Guardar archivo</button></div>`);
  const pinta = () => { $('#exp', o).textContent = construir(sel, fmt).slice(0, 6000) || '(sin frases)'; };
  $('#exb', o).onchange = e => { sel = e.target.value ? +e.target.value : null; pinta(); };
  $$('#exf button', o).forEach(b => b.onclick = () => { fmt = b.dataset.f; $$('#exf button', o).forEach(x => x.setAttribute('aria-pressed', x === b)); pinta(); });
  $('#exc', o).onclick = async () => { try { await navigator.clipboard.writeText(construir(sel, fmt)); toast('Copiado'); } catch { toast('Usa «Guardar archivo»'); } };
  $('#exg', o).onclick = () => { const b = sel ? byId(sel) : null, base = b ? b.t.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40) : 'mis-frases'; guardar(`${base}.${fmt === 'txt' ? 'txt' : 'md'}`, construir(sel, fmt), fmt === 'txt' ? 'text/plain' : 'text/markdown'); };
  pinta();
}
