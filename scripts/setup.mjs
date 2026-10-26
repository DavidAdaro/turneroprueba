// Prepara todo para correr en local (Windows, Mac o Linux):
//   1. instala dependencias de backend y frontend
//   2. crea backend/.dev.vars con un secreto propio
//   3. crea la base local (D1 en backend/.wrangler) con datos de prueba
// Con --reset borra la base local y la vuelve a crear desde cero.
// Con --solo-propios borra todos los pacientes que no estén en
// backend/demo-patients.local.json (y sus turnos, informes e historial).
// Con --borrar-turnos borra todos los turnos (estudios hechos), informes e
// historial; quedan pacientes, equipos y catálogo de estudios.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONDITIONS } from '../backend/src/utils/demoConditions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, 'backend');
const frontend = join(root, 'frontend');
const reset = process.argv.includes('--reset');
const onlyOwn = process.argv.includes('--solo-propios');
const clearAppointments = process.argv.includes('--borrar-turnos');

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(' ')}   (${cwd.replace(root, '.') || '.'})`);
  const r = spawnSync([cmd, ...args].join(' '), { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`\n✘ Falló: ${cmd} ${args.join(' ')}`);
    process.exit(r.status || 1);
  }
}

// 1. Dependencias
// Se instala también si después de un pull apareció una dependencia nueva.
const missingDeps = (dir) => {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((d) => !existsSync(join(dir, 'node_modules', d, 'package.json')));
};
for (const dir of [backend, frontend]) {
  if (missingDeps(dir)) run('npm', ['install', '--no-audit', '--no-fund'], dir);
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
const migrationFiles = () => readdirSync(join(backend, 'migrations')).filter((x) => x.endsWith('.sql')).sort();
function d1Query(sql) {
  const r = spawnSync(`npx wrangler d1 execute turnero-db --local --json --command "${sql}"`, { cwd: backend, shell: true, encoding: 'utf8' });
  const out = r.stdout || '';
  try {
    return JSON.parse(out.slice(out.indexOf('[')))[0]?.results || [];
  } catch {
    return null;
  }
}
function appliedMigrations() {
  d1Query('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT)');
  const rows = d1Query('SELECT name FROM _migrations');
  if (!rows) {
    console.error('\n✘ No pude leer las migraciones aplicadas de la base local.');
    process.exit(1);
  }
  return new Set(rows.map((r) => r.name));
}
function markMigrations(files) {
  const values = files.map((f) => `('${f}', datetime('now'))`).join(', ');
  d1Query(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT); INSERT OR IGNORE INTO _migrations (name, applied_at) VALUES ${values}`);
}
if (reset && existsSync(dbDir)) {
  rmSync(dbDir, { recursive: true, force: true });
  console.log('\n✔ Base local borrada');
}
if (reset || !existsSync(dbDir)) {
  d1('./schema.sql');
  d1('./seed.sql');
  markMigrations(migrationFiles()); // la base nueva ya nace con todo lo de las migraciones
  console.log('\n✔ Base local creada con datos de prueba');
} else {
  // Migraciones en orden; se anotan en _migrations para no repetirlas
  // (algunas, como ALTER TABLE, no se pueden correr dos veces).
  const applied = appliedMigrations();
  for (const f of migrationFiles()) {
    if (applied.has(f)) continue;
    d1(`./migrations/${f}`);
    markMigrations([f]);
  }
  console.log('\n✔ Base local existente actualizada (migraciones aplicadas)');
}

// 4. Pacientes para la demo: los propios (demo-patients.local.json, solo en
// tu compu) más los ficticios del repo (demo-patients.ficticios.json).
const poolFiles = ['demo-patients.local.json', 'demo-patients.ficticios.json'].map((f) => join(backend, f)).filter(existsSync);
if (poolFiles.length) {
  let pool = [];
  for (const f of poolFiles) {
    try {
      pool.push(...JSON.parse(readFileSync(f, 'utf8')).filter((p) => p && p.dni));
    } catch (err) {
      console.error(`\n✘ ${f.replace(root, '.')} no es un JSON válido: ${err.message}`);
      process.exit(1);
    }
  }
  pool = [...new Map(pool.map((p) => [String(p.dni).replace(/\D/g, ''), p])).values()];
  const q = (v) => (v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
  const notes = (p) => [p.extra, ...(p.conditions || []).map((c) => CONDITIONS[c]?.patient)].filter(Boolean).join('. ');
  const sql = [
    ...pool.map(
      (p) =>
        `INSERT INTO patients (dni, first_name, last_name, birth_date, sex, insurance_id, affiliate_number, weight_kg, notes)
         VALUES (${q(String(p.dni).replace(/\D/g, ''))}, ${q(p.first_name)}, ${q(p.last_name)}, ${q(p.birth_date)}, ${q(p.sex)},
           (SELECT id FROM insurances WHERE code = ${q(p.insurance)}), ${q(p.affiliate_number)}, ${p.weight_kg ? Number(p.weight_kg) : 'NULL'}, ${q(notes(p))})
         ON CONFLICT(dni) DO UPDATE SET first_name = excluded.first_name, last_name = excluded.last_name, birth_date = excluded.birth_date,
           sex = excluded.sex, insurance_id = excluded.insurance_id, affiliate_number = excluded.affiliate_number,
           weight_kg = excluded.weight_kg, notes = excluded.notes;`
    ),
    `INSERT INTO settings (key, value) VALUES ('demo_pool', ${q(JSON.stringify(pool.map((p) => ({ ...p, dni: String(p.dni).replace(/\D/g, '') }))))})
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
  ].join('\n');
  const tmp = join(backend, '.wrangler', 'demo-pool.sql');
  mkdirSync(dirname(tmp), { recursive: true });
  writeFileSync(tmp, sql);
  d1('./.wrangler/demo-pool.sql');
  console.log(`\n✔ Pacientes para la demo (${pool.length}): ${pool.map((p) => `${p.last_name}, ${p.first_name}`).join(" · ")}`);

  // Dejar solo los pacientes propios: a pedido (--solo-propios) o al
  // recrear la base (--reset), para que no queden los de ejemplo del seed.
  if (onlyOwn || reset) {
    const dnis = pool.map((p) => q(String(p.dni).replace(/\D/g, ''))).join(', ');
    // Se conservan también los pacientes de relleno ficticios de la agenda completa (DNI 903xxxxx).
    const others = `SELECT id FROM patients WHERE dni NOT IN (${dnis}) AND dni NOT LIKE '903_____'`;
    const theirAppointments = `SELECT id FROM appointments WHERE patient_id IN (${others})`;
    const prune = join(backend, '.wrangler', 'prune.sql');
    writeFileSync(
      prune,
      [
        `DELETE FROM reports WHERE appointment_id IN (${theirAppointments});`,
        `DELETE FROM appointment_events WHERE appointment_id IN (${theirAppointments});`,
        `DELETE FROM appointments WHERE patient_id IN (${others});`,
        `DELETE FROM patients WHERE dni NOT IN (${dnis}) AND dni NOT LIKE '903_____';`,
      ].join('\n')
    );
    d1('./.wrangler/prune.sql');
    console.log(`\n✔ Quedaron solo los ${pool.length} pacientes de la demo (propios + ficticios); el resto se borró con sus turnos`);
  }
} else {
  if (onlyOwn) {
    console.error('\n✘ No encontré backend/demo-patients.local.json ni demo-patients.ficticios.json: no sé qué pacientes dejar. No se borró nada.');
    process.exit(1);
  }
  // Sin archivo propio, la demo usa pacientes inventados.
  writeFileSync(join(backend, '.wrangler', 'demo-pool.sql'), "DELETE FROM settings WHERE key = 'demo_pool';");
  d1('./.wrangler/demo-pool.sql');
}

// 5. Borrar todos los turnos (a pedido).
if (clearAppointments) {
  const file = join(backend, '.wrangler', 'clear-appointments.sql');
  writeFileSync(file, ['DELETE FROM reports;', 'DELETE FROM appointment_events;', 'DELETE FROM appointments;'].join('\n'));
  d1('./.wrangler/clear-appointments.sql');
  console.log('\n✔ Se borraron todos los turnos, informes e historial (quedan pacientes, equipos y catálogo de estudios)');
}

console.log(`
Listo. Para usarlo:

  npm start

y abrí http://localhost:5180  (usuario admin@turnero.test / turnero123).
En "Turnero del día", el botón "Cargar turnos de ejemplo" llena la agenda de todos los equipos.
`);
