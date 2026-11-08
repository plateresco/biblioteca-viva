// Recordatorio de lectura: funciona mientras la app está abierta o al abrirla (sin servidor no hay avisos con la app cerrada).
import { S, today } from './state.js';
import { P } from './prefs.js';
import { toast } from './ui.js';
import { A } from './native.js';

let timer = null;
const readToday = () => S.log.some(l => l.date === today() && (l.pages > 0 || l.secs > 0));
export function reminderDue() {
  if (!P.reminder.on || readToday()) return false;
  const [h, m] = P.reminder.time.split(':').map(Number), due = new Date(); due.setHours(h, m, 0, 0);
  return new Date() >= due;
}
// Dentro de la app, Android se encarga del aviso (suena aunque la app esté cerrada).
export function syncNativeReminder() {
  if (!A?.programarRecordatorio) return;
  const [h, m] = P.reminder.time.split(':').map(Number);
  A.programarRecordatorio(!!P.reminder.on, h || 21, m || 0);
  if (P.reminder.on) A.pedirPermisoNotificaciones();
}
export function checkReminder(ctx) {
  clearTimeout(timer);
  if (A?.programarRecordatorio) { syncNativeReminder(); return; }
  if (!P.reminder.on || readToday()) return;
  const [h, m] = P.reminder.time.split(':').map(Number), due = new Date(); due.setHours(h, m, 0, 0);
  const wait = due - new Date();
  if (wait <= 0) return;                                   // ya pasó la hora: la pantalla Hoy muestra el aviso
  timer = setTimeout(() => {
    if (readToday()) return;
    const body = 'Un ratito de lectura antes de que termine el día.';
    try { if ('Notification' in window && Notification.permission === 'granted') { new Notification('¿Un rato de lectura?', { body, icon: 'icon-192.png' }); return; } } catch { }
    toast('¿Un rato de lectura? ' + body);
  }, Math.min(wait, 2147483000));
}
