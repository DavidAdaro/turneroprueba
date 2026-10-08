// Prepara todo para correr en local (Windows, Mac o Linux):
//   1. instala dependencias de backend y frontend
//   2. crea backend/.dev.vars con un secreto propio
//   3. crea la base local (D1 en backend/.wrangler) con datos de prueba
// Con --reset borra la base local y la vuelve a crear desde cero.
// Con --solo-propios borra todos los pacientes que no estén en
// backend/demo-patients.local.json (y sus turnos, informes e historial).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, 'backend');
const frontend = join(root, 'frontend');
const reset = process.argv.includes('--reset');
const onlyOwn = process.argv.includes('--solo-propios');

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(' ')}   (${cwd.replace(root, '.') || '.'})`);
  const r = spawnSync([cmd, ...args].join(' '), { cwd, stdio: 'inherit', shell: true });
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
  // Migraciones idempotentes, en orden: solo agregan/actualizan lo que falte.
  for (const f of readdirSync(join(backend, 'migrations')).filter((x) => x.endsWith('.sql')).sort()) d1(`./migrations/${f}`);
  console.log('\n✔ Base local existente actualizada (no se borró nada)');
}

// 4. Pacientes propios para la demo (opcional, solo local).
const poolFile = join(backend, 'demo-patients.local.json');
if (existsSync(poolFile)) {
  let pool;
  try {
    pool = JSON.parse(readFileSync(poolFile, 'utf8')).filter((p) => p && p.dni);
  } catch (err) {
    console.error(`\n✘ backend/demo-patients.local.json no es un JSON válido: ${err.message}`);
    process.exit(1);
  }
  const q = (v) => (v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
  const CONDITION_TEXT = {
    renal: 'Insuficiencia renal crónica (FG 35 ml/min)',
    dialysis: 'Insuficiencia renal crónica en hemodiálisis (lun-mié-vie). Fístula AV en brazo izquierdo',
    pacemaker: 'Marcapasos definitivo (NO compatible con RM)',
    pacemakerMR: 'Marcapasos MR condicional (requiere protocolo con cardiología)',
    prosthesis: 'Prótesis metálica (reemplazo total de cadera derecha, titanio)',
    biosafety: 'Elementos metálicos: clip de aneurisma cerebral (titanio, RM condicional) y piercings',
    iodine: 'ALERGIA AL IODO (urticaria con contraste en 2019)',
    claustrophobia: 'Claustrofobia',
    glaucoma: 'Glaucoma de ángulo cerrado',
    oxygen: 'Oxigenodependiente (cánula nasal 2 l/min)',
    mobility: 'Movilidad reducida (silla de ruedas)',
    obesity: 'Obesidad (110 kg)',
  };
  const notes = (p) => [p.extra, ...(p.conditions || []).map((c) => CONDITION_TEXT[c])].filter(Boolean).join('. ');
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
  console.log(`\n✔ Pacientes propios para la demo: ${pool.map((p) => `${p.last_name}, ${p.first_name}`).join(' · ')}`);

  // Dejar solo los pacientes propios: a pedido (--solo-propios) o al
  // recrear la base (--reset), para que no queden los de ejemplo del seed.
  if (onlyOwn || reset) {
    const dnis = pool.map((p) => q(String(p.dni).replace(/\D/g, ''))).join(', ');
    const others = `SELECT id FROM patients WHERE dni NOT IN (${dnis})`;
    const theirAppointments = `SELECT id FROM appointments WHERE patient_id IN (${others})`;
    const prune = join(backend, '.wrangler', 'prune.sql');
    writeFileSync(
      prune,
      [
        `DELETE FROM reports WHERE appointment_id IN (${theirAppointments});`,
        `DELETE FROM appointment_events WHERE appointment_id IN (${theirAppointments});`,
        `DELETE FROM appointments WHERE patient_id IN (${others});`,
        `DELETE FROM patients WHERE dni NOT IN (${dnis});`,
      ].join('\n')
    );
    d1('./.wrangler/prune.sql');
    console.log(`\n✔ Quedaron solo ${pool.length} pacientes (los de demo-patients.local.json); el resto se borró con sus turnos`);
  }
} else {
  if (onlyOwn) {
    console.error('\n✘ No encontré backend/demo-patients.local.json: sin ese archivo no sé qué pacientes dejar. No se borró nada.');
    process.exit(1);
  }
  // Sin archivo propio, la demo usa pacientes inventados.
  writeFileSync(join(backend, '.wrangler', 'demo-pool.sql'), "DELETE FROM settings WHERE key = 'demo_pool';");
  d1('./.wrangler/demo-pool.sql');
}

console.log(`
Listo. Para usarlo:

  npm start

y abrí http://localhost:5180  (usuario admin@turnero.test / turnero123).
En "Turnero del día", el botón "Cargar turnos de ejemplo (±3 semanas)" llena la agenda.
`);
