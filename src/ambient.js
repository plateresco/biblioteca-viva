// Sonido ambiente para leer, generado en el dispositivo (sin archivos ni conexión): lluvia, viento, ruido marrón y sala de biblioteca.
export const SONIDOS = [['', 'Sin sonido'], ['lluvia', 'Lluvia'], ['viento', 'Viento'], ['marron', 'Ruido marrón'], ['biblioteca', 'Biblioteca']];

let ctx = null, nodos = [], master = null, timer = 0, activo = '';

function ruido(tipo) {
  const n = ctx.sampleRate * 3, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  let ult = 0;
  for (let i = 0; i < n; i++) {
    const b = Math.random() * 2 - 1;
    if (tipo === 'marron') { ult = (ult + .02 * b) / 1.02; d[i] = ult * 3.5; } else d[i] = b;
  }
  const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s;
}
const filtro = (t, f, q = .7) => { const x = ctx.createBiquadFilter(); x.type = t; x.frequency.value = f; x.Q.value = q; return x; };

export function sonar(tipo, vol = .35) {
  parar();
  if (!tipo) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
    master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination);
    const fuente = ruido(tipo === 'lluvia' || tipo === 'biblioteca' ? 'blanco' : 'marron'); nodos.push(fuente);
    if (tipo === 'lluvia') { const hp = filtro('highpass', 700), lp = filtro('lowpass', 7000); fuente.connect(hp); hp.connect(lp); lp.connect(master); }
    else if (tipo === 'viento') {
      const bp = filtro('bandpass', 450, 1.2); fuente.connect(bp); bp.connect(master);
      const lfo = ctx.createOscillator(), g = ctx.createGain(); lfo.frequency.value = .12; g.gain.value = 260; lfo.connect(g); g.connect(bp.frequency); lfo.start(); nodos.push(lfo);
    }
    else if (tipo === 'marron') { const lp = filtro('lowpass', 1100); fuente.connect(lp); lp.connect(master); }
    else if (tipo === 'biblioteca') {
      const lp = filtro('lowpass', 420), g = ctx.createGain(); g.gain.value = .35; fuente.connect(lp); lp.connect(g); g.connect(master);
      const hoja = () => {                                   // de vez en cuando, una página que se pasa
        if (activo !== 'biblioteca' || !ctx) return;
        const r = ruido('blanco'), bp = filtro('bandpass', 2600, .8), gg = ctx.createGain(); const t = ctx.currentTime;
        gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(.5, t + .05); gg.gain.exponentialRampToValueAtTime(.001, t + .5);
        r.connect(bp); bp.connect(gg); gg.connect(master); r.start(); r.stop(t + .6);
        timer = setTimeout(hoja, 6000 + Math.random() * 9000);
      };
      timer = setTimeout(hoja, 4000);
    }
    fuente.start(); activo = tipo;
  } catch { activo = ''; }
}
export function volumen(v) { if (master) master.gain.value = v; }
export function parar() {
  clearTimeout(timer); activo = '';
  for (const n of nodos) { try { n.stop(); } catch { } try { n.disconnect(); } catch { } }
  nodos = []; try { master && master.disconnect(); } catch { } master = null;
}
export const suena = () => !!activo;
