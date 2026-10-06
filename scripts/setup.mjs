// Prepara todo para correr en local (Windows, Mac o Linux):
//   1. instala dependencias de backend y frontend
//   2. crea backend/.dev.vars con un secreto propio
//   3. crea la base local (D1 en backend/.wrangler) con datos de prueba
// Con --reset borra la base local y la vuelve a crear desde cero.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, 'backend');
const frontend = join(root, 'frontend');
const reset = process.argv.includes('--reset');

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(' ')}   (${cwd.replace(root, '.') || '.'})`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`\n✘ Falló: ${cmd} ${args.join(' ')}`);
    process.exit(r.status || 1);
  }
}

// 1. Dependencias
for (const dir of [backend, frontend]) {
  if (!existsSync(join(dir, 'node_modules'))) run('npm', ['install', '--no-audit', '--no-fund'], dir);
}

// 2. Secretos locales
const devVars = join(backend, '.dev.vars');
if (!existsSync(devVars)) {
  const example = readFileSync(join(backend, '.dev.vars.example'), 'utf8');
  writeFileSync(devVars, example.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${randomBytes(32).toString('hex')}`));
  console.log('\n✔ Creado backend/.dev.vars con un JWT_SECRET propio');
}

// 3. Base de datos local
const d1 = (file) => run('npx', ['wrangler', 'd1', 'execute', 'turnero-db', '--local', `--file=${file}`], backend);
const dbDir = join(backend, '.wrangler', 'state', 'v3', 'd1');
if (reset && existsSync(dbDir)) {
  rmSync(dbDir, { recursive: true, force: true });
  console.log('\n✔ Base local borrada');
}
if (reset || !existsSync(dbDir)) {
  d1('./schema.sql');
  d1('./seed.sql');
  console.log('\n✔ Base local creada con datos de prueba');
} else {
  d1('./migrations/0001_api_keys.sql'); // idempotente: solo agrega lo que falte
  console.log('\n✔ Base local existente actualizada (no se borró nada)');
}

console.log(`
Listo. Para usarlo:

  npm start

y abrí http://localhost:5180  (usuario admin@turnero.test / turnero123).
En "Turnero del día", el botón "Cargar turnos de ejemplo (±3 semanas)" llena la agenda.
`);
