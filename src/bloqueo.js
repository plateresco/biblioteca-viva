// Bloqueo con PIN (y huella en Android) y libros ocultos. El PIN se guarda solo como huella criptográfica en este dispositivo.
import { A } from './native.js';
import { S } from './state.js';

const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { } };
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
async function hash(pin, sal) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(sal + ':' + pin))); }

export const hayPin = () => !!LS('bv-pin');
export const minutosAuto = () => +(LS('bv-autolock') ?? 1);
export const fijarAuto = m => LS('bv-autolock', String(m));
export const bioActiva = () => LS('bv-bio') === '1' && !!A?.biometriaDisponible?.();
export const fijarBio = on => LS('bv-bio', on ? '1' : null);
export async function fijarPin(pin) { const sal = Math.random().toString(36).slice(2); LS('bv-pin', JSON.stringify({ sal, h: await hash(pin, sal) })); }
export const quitarPin = () => { LS('bv-pin', null); LS('bv-bio', null); };
export async function verificarPin(pin) { try { const { sal, h } = JSON.parse(LS('bv-pin')); return (await hash(pin, sal)) === h; } catch { return false; } }

let bloqueado = false, oculto0 = 0, fallos = 0, hasta = 0;

/** Pide el PIN y devuelve una promesa que se cumple al desbloquear. permiteCancelar: para pedir el PIN dentro de la app (no al abrirla). */
export function pedirPin(permiteCancelar = false) {
  return new Promise(res => {
    const o = document.createElement('div'); o.id = 'lockscr'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Bloqueo');
    let pin = '';
    const pinta = () => { o.innerHTML = `<div class="lk"><b class="lkt">Mi Biblioteca</b><div class="lkm" id="lkm">${hasta > Date.now() ? 'Espera unos segundos' : 'Escribe tu PIN'}</div>
      <div class="lkd">${[0, 1, 2, 3, 4, 5].map(i => `<i class="${i < pin.length ? 'f' : ''}"></i>`).join('')}</div>
      <div class="lkp">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-n="${n}">${n}</button>`).join('')}<button data-a="bio" ${bioActiva() ? '' : 'style="visibility:hidden"'} aria-label="Usar huella">◉</button><button data-n="0">0</button><button data-a="del" aria-label="Borrar">⌫</button></div>
      ${permiteCancelar ? '<button class="lkc" data-a="x">Cancelar</button>' : ''}</div>`; };
    const cierra = ok => { o.remove(); if (ok) res(true); else res(false); };
    const prueba = async () => {
      if (hasta > Date.now()) return;
      if (await verificarPin(pin)) { fallos = 0; return cierra(true); }
      fallos++; pin = ''; if (fallos >= 5) { hasta = Date.now() + 30000; fallos = 0; }
      pinta(); const m = o.querySelector('#lkm'); if (m) m.textContent = hasta > Date.now() ? 'Demasiados intentos. Espera 30 segundos.' : 'PIN incorrecto';
      o.querySelector('.lk')?.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 220 });
    };
    o.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.n != null && pin.length < 6 && hasta <= Date.now()) { pin += b.dataset.n; pinta(); if (pin.length >= 4) setTimeout(() => { if (pin.length >= 4) prueba(); }, pin.length === 6 ? 0 : 350); }
      else if (b.dataset.a === 'del') { pin = pin.slice(0, -1); pinta(); }
      else if (b.dataset.a === 'bio') bio();
      else if (b.dataset.a === 'x') cierra(false);
    });
    const bio = () => { if (!A?.biometria) return; window.__bioOk = () => cierra(true); window.__bioError = () => { }; A.biometria(); };
    pinta(); document.body.appendChild(o);
    if (bioActiva()) setTimeout(bio, 250);
  });
}

export async function bloquear() {
  if (bloqueado || !hayPin()) return;
  bloqueado = true; await pedirPin(false); bloqueado = false; S.ui.verOcultos = false;
}
export function iniciarBloqueo() {
  if (hayPin()) { document.documentElement.classList.add('bloq'); bloquear().then(() => document.documentElement.classList.remove('bloq')); }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') oculto0 = Date.now();
    else if (hayPin() && oculto0 && Date.now() - oculto0 > minutosAuto() * 60000) { oculto0 = 0; bloquear(); }
  });
}
// Libros ocultos: solo se ven si desbloqueas (o si no hay PIN).
export const verOcultos = async on => { if (on && hayPin() && !(await pedirPin(true))) return false; S.ui.verOcultos = on; return true; };
export const visible = b => !b.oculto || !!S.ui.verOcultos;
