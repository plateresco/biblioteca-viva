// Puente con la app de Android (si la página corre dentro de la app). En el navegador, todo esto queda inactivo.
export const A = typeof window !== 'undefined' ? window.AndroidApp || null : null;
export const esApp = !!A;

export function haptic(tipo = 'tick') {
  try { if (A) A.haptico(tipo); else if (navigator.vibrate) navigator.vibrate(tipo === 'pesado' ? 14 : tipo === 'exito' ? [8, 40, 8] : 6); } catch { }
}

// Color real (opaco) de un elemento: sube por los padres hasta encontrar un fondo que no sea transparente.
function colorDe(el) {
  for (let e = el; e; e = e.parentElement) {
    const m = (getComputedStyle(e).backgroundColor.match(/[\d.]+/g) || []).map(Number);
    if (m.length >= 3 && (m.length < 4 || m[3] > 0.95)) return m.slice(0, 3);
  }
  return [22, 38, 42];
}
const hex = m => '#' + m.map(n => Math.round(n).toString(16).padStart(2, '0')).join('');
const oscuro = m => (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255 < .5;

// Barras del sistema del color de la página: la de arriba como el fondo y la de abajo como la barra de pestañas (si se ve).
export function pintarBarras() {
  if (!A) return;
  try {
    // Se mira qué hay realmente en el borde de arriba y de abajo de la pantalla (puede ser la estantería, el encabezado o la barra de pestañas).
    const en = y => document.elementFromPoint(Math.round(innerWidth / 2), y) || document.body;
    const arriba = colorDe(en(2)), abajo = colorDe(en(innerHeight - 2));
    A.barras(hex(arriba), hex(abajo), oscuro(arriba), oscuro(abajo));
  } catch { }
}

export const blobToB64 = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(b); });
