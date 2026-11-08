// Puente con la app de Android (si la página corre dentro de la app). En el navegador, todo esto queda inactivo.
export const A = typeof window !== 'undefined' ? window.AndroidApp || null : null;
export const esApp = !!A;

export function haptic(tipo = 'tick') {
  try { if (A) A.haptico(tipo); else if (navigator.vibrate) navigator.vibrate(tipo === 'pesado' ? 14 : tipo === 'exito' ? [8, 40, 8] : 6); } catch { }
}

// Barras del sistema del color de la sala (se llama al cambiar de tema).
export function pintarBarras() {
  if (!A) return;
  try {
    const bg = getComputedStyle(document.body).backgroundColor, m = bg.match(/\d+/g) || [22, 38, 42];
    const hex = '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
    const lum = (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255;
    A.barras(hex, lum < .5);
  } catch { }
}

export const blobToB64 = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(b); });
