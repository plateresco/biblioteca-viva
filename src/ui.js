export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const esc =s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const P = {
  home: '<path d="M4 11l8-7 8 7v9H4zM10 20v-6h4v6"/>',
  more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  tag: '<path d="M3 12l9-9h8v8l-9 9z"/><path d="M15.5 8.5h.01" stroke-width="3"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  bell: '<path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15zM10 21h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 5a3.5 3.5 0 010 7M18 14c2 .7 3 2.5 3 5"/>',
  palette: '<path d="M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2-.6-1.2.2-2.5 1.6-2.5H17a4 4 0 004-4c0-5-4-9.5-9-9.5z"/><path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01" stroke-width="3"/>',
  keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01" stroke-width="2.4"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M5 17l5-4 4 3 3-2 3 3"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  shelf: '<path d="M4 20V5M20 20V5M4 20h16M8 20v-9h3v9M13 20V8h3v12"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  book: '<path d="M4 5.5C6.5 4 9.5 4 12 5.5c2.5-1.5 5.5-1.5 8 0V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 5.5V19"/>',
  chart: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  spark: '<path d="M12 3l2 5.5L19.5 10 14 12l-2 5.5L10 12l-5.5-2L10 8.5zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  aa: '<path d="M3 18l5-12 5 12M5 14h6M15 18l3.5-8 3.5 8M16.2 15.5h4.6"/>',
  phones: '<path d="M4 15v-3a8 8 0 0116 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  play: '<path d="M8 5l11 7-11 7z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  move: '<path d="M7 4l-3 3 3 3M4 7h13M17 20l3-3-3-3M20 17H7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  quote: '<path d="M7 7h4v5H8c0 2 1 3 3 3v2c-3 0-5-2-5-5zM15 7h4v5h-3c0 2 1 3 3 3v2c-3 0-5-2-5-5z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  cloud: '<path d="M7 18a4 4 0 01-.6-7.95A6 6 0 0118 9.5 4.3 4.3 0 0117.5 18z"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
};
export const ic = (n, extra = '') => `<svg class="i ${extra}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

let toastT;
export function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

// Hoja inferior reutilizable (portada, formularios).
export function openSheet(html, { onClose } = {}) {
  closeSheet();
  const o = document.createElement('div');
  o.className = 'overlay'; o.id = 'sheet';
  o.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="iconbtn close" data-x aria-label="Cerrar">${ic('x')}</button>${html}</div>`;
  document.body.appendChild(o);
  const done = () => { closeSheet(); onClose && onClose(); };
  o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-x]')) done(); });
  o._done = done;
  return o;
}
export function closeSheet() { const o = $('#sheet'); if (o) o.remove(); }
