// Siguiente lectura: sugerencias calculadas en el dispositivo con lo que ya sabes de tus libros (sin inteligencia artificial).
import { S } from './state.js';
import { series } from './orden.js';
import { pace } from './metrics.js';

const dias = f => f ? Math.floor((Date.now() - new Date(f + 'T00:00:00')) / 864e5) : 0;
const bajo = s => String(s || '').trim().toLowerCase();

export const FILTROS = [['todo', 'Todo'], ['corta', 'Corto'], ['autor', 'Mismo autor'], ['espera', 'Espera'], ['saga', 'Saga']];

/** Devuelve [{ b, why, k: [tipos] }], los mejores primero. */
export function sugerencias() {
  const porLeer = S.books.filter(b => b.s === 'porleer' && !b.loan);
  if (!porLeer.length) return [];
  const mapa = series(), ppd = Math.max(8, Math.round(pace() / 60 * 25));           // páginas por día que lees en promedio, aprox.
  const buenos = S.books.filter(b => b.s === 'leido' && (b.rating || 0) >= 4);
  const autores = new Map(buenos.map(b => [bajo(b.a), b]));
  const lista = new Map();
  const suma = (b, tipo, why, peso) => { const x = lista.get(b.id) || { b, k: [], why: '', score: 0 }; if (!x.k.includes(tipo)) x.k.push(tipo); if (!x.why || peso > x.peso) { x.why = why; x.peso = peso; } x.score += peso; lista.set(b.id, x); };

  for (const b of porLeer) {
    if (b.p && b.p <= 200) suma(b, 'corta', `Corto: lo terminas en ${Math.max(1, Math.ceil(b.p / ppd))} ${Math.ceil(b.p / ppd) <= 1 ? 'día' : 'días'}`, 2);
    const a = autores.get(bajo(b.a));
    if (a && bajo(b.a) !== 'autor desconocido') suma(b, 'autor', `Del mismo autor que calificaste con ${a.rating}`, 4);
    const m = dias(b.addedAt);
    if (m >= 60) suma(b, 'espera', `Lleva ${Math.round(m / 30)} meses esperando`, m >= 180 ? 3 : 2);
    const s = mapa.get(b.id);
    if (s && s.serie) {
      const leidos = S.books.filter(x => x !== b && (x.s === 'leido' || x.s === 'leyendo') && mapa.get(x.id)?.serie && bajo(mapa.get(x.id).serie) === bajo(s.serie));
      const prev = leidos.filter(x => (mapa.get(x.id).tomo || 0) < (s.tomo || 99)).sort((p, q) => (mapa.get(q.id).tomo || 0) - (mapa.get(p.id).tomo || 0))[0];
      if (prev) suma(b, 'saga', `Sigue la saga: ${prev.s === 'leido' ? 'terminaste' : 'estás leyendo'} «${prev.t}»`, 5);
    }
  }
  return [...lista.values()].sort((x, y) => y.score - x.score || (x.b.p || 0) - (y.b.p || 0));
}
