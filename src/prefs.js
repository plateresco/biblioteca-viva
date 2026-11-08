// Preferencias de este dispositivo (tema, vista, metas, recordatorio, tamaño de texto).
const KEY = 'bv-prefs';
const DEF = { theme: 'auto', view: 'shelf', goalDay: 20, goalYear: 12, reminder: { on: false, time: '21:30' }, textScale: 100 };
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
import('./native.js').then(n => { n.pintarBarras(); matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => setTimeout(n.pintarBarras, 50)); });
}
export function applyPrefs() {
  const r = document.documentElement;
  if (P.theme === 'auto') r.removeAttribute('data-theme'); else r.dataset.theme = P.theme;
  r.style.setProperty('--ts', P.textScale / 100);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = P.theme === 'dia' ? '#EFE6D2' : P.theme === 'contraste' ? '#000000' : '#16262A';
  setTimeout(() => import('./native.js').then(n => n.pintarBarras()), 30);
}
applyPrefs();
