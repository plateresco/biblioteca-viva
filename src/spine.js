import { ST, coverUrl, spineGeom } from './state.js';
import { esc } from './ui.js';

const hash = id => (id * 2654435761 >>> 0);
export const spineStyleClass = b => ['', 'serif', 'caps'][hash(b.id) % 3];   // la tipografía del lomo cambia según el libro

export function spineStyle(b) {
  const g = spineGeom(b), u = coverUrl(b);
  return `--c1:${b.c1 || '#555'};--c2:${b.c2 || '#bbb'};--w:${g.w}px;--h:${g.h}px;--sc:${ST[b.s].c};--art:${u ? `url('${u}')` : 'none'}`;
}
export const spineInner = b => `<i class="hb"></i><i class="foil"></i><span class="t">${esc(b.t)}</span><i class="pub"></i><i class="tb"></i><i class="sheen"></i><b class="tip">${esc(b.t)} · ${b.p} págs.</b><i class="rib"></i>`;
