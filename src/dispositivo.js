// Nombre del dispositivo (para «seguías leyendo en tu teléfono») y marcas de lectura por dispositivo.
import { S } from './state.js';

export function nombreDispositivo() {
  try { const n = localStorage.getItem('bv-dev'); if (n) return n; } catch { }
  const ua = navigator.userAgent || '';
  const n = window.AndroidApp ? (innerWidth >= 700 ? 'Tablet' : 'Teléfono') : /Mobi|Android|iPhone/.test(ua) ? 'Teléfono' : 'Computador';
  try { localStorage.setItem('bv-dev', n); } catch { }
  return n;
}
export const cambiarNombre = n => { try { localStorage.setItem('bv-dev', n.trim() || nombreDispositivo()); } catch { } };

export function hace(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'justo ahora'; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24); return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}
// Último libro leído en cada dispositivo, según lo que se sincronizó.
export function porDispositivo() {
  const m = new Map();
  for (const b of S.books) if (b.dev && b.dev.n) { const o = m.get(b.dev.n); if (!o || b.dev.t > o.t) m.set(b.dev.n, { n: b.dev.n, t: b.dev.t, libro: b.t }); }
  return [...m.values()].sort((a, z) => z.t - a.t);
}
