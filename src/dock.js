// En pantallas anchas el libro se abre en un panel a la derecha y la estantería queda visible a la izquierda.
import { P } from './prefs.js';

export const dockActivo = () => P.paneles !== false && innerWidth >= 1100;
export function dockear(on) {
  const b = document.body, ya = b.classList.contains('rd-dock');
  if (on && dockActivo()) { b.classList.add('rd-dock'); } else b.classList.remove('rd-dock');
  if (ya !== b.classList.contains('rd-dock')) setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
}
