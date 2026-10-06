// Levanta backend (http://localhost:8788) y frontend (http://localhost:5180)
// en una sola ventana. Ctrl+C corta los dos.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const needsSetup = ['backend/node_modules', 'frontend/node_modules', 'backend/.dev.vars', 'backend/.wrangler/state/v3/d1'].some(
  (p) => !existsSync(join(root, p))
);
if (needsSetup) {
  console.log('Primera vez: preparando el proyecto (npm run setup)…');
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'setup.mjs')], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}

const COLORS = { backend: '\x1b[36m', frontend: '\x1b[35m' };
const children = [];
let ready = { backend: false, frontend: false };
let announced = false;

function start(name, cwd) {
  const child = spawn('npm', ['run', 'dev'], {
    cwd: join(root, cwd),
    shell: true,
    // En Linux/Mac, grupo de procesos propio para poder cortar npm y sus hijos juntos.
    detached: process.platform !== 'win32',
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  const prefix = `${COLORS[name]}[${name}]\x1b[0m `;
  const onData = (buf) => {
    const text = buf.toString();
    const plain = text.replace(/\x1b\[[0-9;]*m/g, ''); // sin colores, para detectar cuándo está listo
    for (const line of text.split(/\r?\n/)) if (line.trim()) process.stdout.write(prefix + line + '\n');
    if (/Ready on/.test(plain) && name === 'backend') ready.backend = true;
    if (/localhost:5180/.test(plain) && name === 'frontend') ready.frontend = true;
    if (ready.backend && ready.frontend && !announced) {
      announced = true;
      console.log('\n\x1b[32m✔ Mini RIS corriendo: abrí http://localhost:5180  (admin@turnero.test / turnero123)\x1b[0m\n  Ctrl+C para cortar.\n');
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('exit', (code) => {
    console.log(`${prefix}terminó (código ${code ?? '-'})`);
    stopAll(code ?? 0);
  });
  children.push(child);
}

let stopping = false;
function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    if (c.exitCode !== null) continue;
    // En Windows hay que matar el árbol de procesos (npm → node).
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
    else {
      try {
        process.kill(-c.pid, 'SIGTERM');
      } catch {
        c.kill('SIGTERM');
      }
    }
  }
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

start('backend', 'backend');
start('frontend', 'frontend');
