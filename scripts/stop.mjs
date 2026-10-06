// Apaga lo que haya quedado escuchando en los puertos del Mini RIS
// (8788 backend, 5180 frontend), por ejemplo una ventana vieja de npm run dev.
import { PORTS, inUse, kill, pidsOn } from './ports.mjs';

let any = false;
for (const [name, port] of Object.entries(PORTS)) {
  if (!(await inUse(port))) continue;
  any = true;
  const pids = pidsOn(port);
  if (!pids.length) {
    console.log(`✘ El puerto ${port} (${name}) está ocupado pero no pude ver qué proceso lo usa. Cerrá la ventana donde corre.`);
    continue;
  }
  for (const pid of pids) console.log(`${kill(pid) ? '✔ Apagado' : '✘ No pude apagar'} el proceso ${pid} en el puerto ${port} (${name})`);
}
if (!any) console.log('No había nada corriendo en los puertos 8788 y 5180.');
