// Utilidades de puertos compartidas por start.mjs y stop.mjs.
import { execSync } from 'node:child_process';
import net from 'node:net';

export const PORTS = { backend: 8788, frontend: 5180 };

// true si algo ya está escuchando en el puerto (IPv4 o IPv6).
export function inUse(port) {
  const tryHost = (host) =>
    new Promise((resolve) => {
      const s = net.connect({ port, host });
      s.once('connect', () => {
        s.destroy();
        resolve(true);
      });
      s.once('error', () => resolve(false));
      s.setTimeout(800, () => {
        s.destroy();
        resolve(false);
      });
    });
  return Promise.all([tryHost('127.0.0.1'), tryHost('::1')]).then(([a, b]) => a || b);
}

// PIDs de los procesos que escuchan en el puerto.
export function pidsOn(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' }) + execSync('netstat -ano -p tcpv6', { encoding: 'utf8' });
      return [
        ...new Set(
          out
            .split(/\r?\n/)
            .filter((l) => /LISTENING|ESCUCHANDO/i.test(l) && new RegExp(`:${port}\\s`).test(l))
            .map((l) => l.trim().split(/\s+/).pop())
            .filter((pid) => /^\d+$/.test(pid) && pid !== '0')
        ),
      ];
    }
    return execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' }).split(/\s+/).filter(Boolean);
  } catch {
    return [];
  }
}

export function kill(pid) {
  try {
    if (process.platform === 'win32') execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    else process.kill(Number(pid), 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}
