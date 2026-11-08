// Preferencias de este dispositivo (tema, vista, metas, recordatorio, tamaño de texto).
const KEY = 'bv-prefs';
const DEF = { theme: 'auto', view: 'shelf', goalDay: 20, goalYear: 12, reminder: { on: false, time: '21:30' }, textScale: 100, accent: null, wood: null, spine: 'cuero', titleFont: 'young', dens: 'comoda', hoyOrder: [], hoyHide: [] };
let stored = {};
try { stored = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { }
export const P = { ...DEF, ...stored, reminder: { ...DEF.reminder, ...(stored.reminder || {}) } };

export const THEMES = [
  ['auto', 'Automático', 'Sigue el modo de tu dispositivo', '#16262A'],
  ['noche', 'Noche', 'Sala oscura con madera cálida', '#16262A'],
  ['dia', 'Día', 'Más clara, para leer afuera', '#EFE6D2'],
  ['sepia', 'Sepia', 'Cálido y suave para la vista', '#2B1F14'],
  ['contraste', 'Alto contraste', 'Máxima legibilidad', '#000000'],
];

export function setPref(k, v) {
  P[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { }
  applyPrefs();
}
export const ACENTOS = [[null, 'Según el tema'], ['#62B7AB', 'Verde mar'], ['#E0A23B', 'Ámbar'], ['#E07A70', 'Coral'], ['#8FA8F0', 'Azul'], ['#B48AE0', 'Violeta'], ['#1E5F5A', 'Verde oscuro']];
export const MADERAS = [[null, 'Según el tema', null], ['roble', 'Roble', ['#B68A52', '#8D6A3C']], ['nogal', 'Nogal', ['#6E4A2A', '#4A301B']], ['blanca', 'Blanca', ['#D9D3C4', '#B9B2A0']], ['metal', 'Metal', ['#8A949A', '#5F686E']]];
export const LOMOS = [['cuero', 'Cuero y oro'], ['tela', 'Tela'], ['min', 'Minimalista']];
export const FUENTES = [['young', 'Young Serif', "'Young Serif',Georgia,serif"], ['news', 'Newsreader', "'Newsreader',Georgia,serif"], ['fig', 'Figtree', "'Figtree',system-ui,sans-serif"]];
const luz = h => (parseInt(h.slice(1, 3), 16) * .299 + parseInt(h.slice(3, 5), 16) * .587 + parseInt(h.slice(5, 7), 16) * .114) / 255;
export function applyPrefs() {
  const r = document.documentElement;
  const set = (k, v) => v == null ? r.style.removeProperty(k) : r.style.setProperty(k, v);
  // apariencia propia: color de acento, madera, lomos, letra de títulos y densidad
  const ink = P.accent ? (luz(P.accent) > .55 ? '#0B1613' : '#FFFFFF') : null;
  set('--accent', P.accent); set('--accent-ink', ink); set('--r-accent', P.accent); set('--r-accent-ink', ink);
  const w = MADERAS.find(m => m[0] === P.wood)?.[2];
  set('--wood1', w ? w[0] : null); set('--wood2', w ? w[1] : null); set('--r-wood1', w ? w[0] : null); set('--r-wood2', w ? w[1] : null);
  set('--f-display', FUENTES.find(f => f[0] === P.titleFont)?.[2] || null);
  r.dataset.spine = P.spine || 'cuero'; r.dataset.dens = P.dens || 'comoda';
  if (P.theme === 'auto') r.removeAttribute('data-theme'); else r.dataset.theme = P.theme;
  r.style.setProperty('--ts', P.textScale / 100);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = P.theme === 'dia' ? '#EFE6D2' : P.theme === 'contraste' ? '#000000' : '#16262A';
  setTimeout(() => import('./native.js').then(n => n.pintarBarras()), 30);
}
applyPrefs();
