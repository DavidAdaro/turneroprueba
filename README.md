# Mini RIS · Turnero de Imágenes (prueba)

Turnero para el **sector de Diagnóstico por Imágenes**, inspirado en
sistemas como Visual Medica, que cubre el circuito completo de un RIS
básico: **turno → recepción/admisión → técnico (worklist) → PACS → informe
→ entrega**. Es un proyecto **de prueba**: la recepción en el PACS se
simula por defecto, pero la integración real ya tiene sus endpoints.

## Flujo y estados del turno

| Paso | Quién | Estado | Qué pasa |
| --- | --- | --- | --- |
| Dar turno | Recepción | `given` (Dado) | Por equipo y horario libre. El estudio se filtra por la modalidad del equipo y define la duración. Valida superposición, horario de atención, bloqueos y que el paciente no tenga otro turno a la misma hora. Sobreturnos permitidos. |
| Confirmar | Recepción | `confirmed` | Desde el detalle o desde Recordatorios (WhatsApp). |
| Admitir | Recepción | `arrived` (Admitido) | Solo turnos del día. Exige **orden médica** y, si la obra social lo requiere, **N° de autorización**. Genera el **N° de acceso** (`AAAAMMDD-NNNN`) y el **StudyInstanceUID** DICOM. |
| Ingresar a sala | Técnico | `in_progress` (En sala) | Queda registrado el técnico. |
| Finalizar estudio | Técnico | `completed` (Realizado) | Observaciones técnicas (contraste, incidencias). Se envía al PACS (simulado) o se espera el aviso del PACS real. |
| Informar y firmar | Médico informante | `reported` (Informado) | Técnica, hallazgos y conclusión; ve estudios previos del paciente y el link al visor. Firmado no se puede editar. |
| Entregar | Recepción | `delivered` (Entregado) | Registra quién retiró. Informe imprimible en A4. |

Salidas: `absent` (Ausente) y `cancelled` (Cancelado, con motivo). Un turno
pendiente se puede **reprogramar** (otra fecha/hora u otro equipo de la
misma modalidad) y una admisión se puede anular. Cada paso queda en el
**historial del turno** (quién y cuándo).

## Funcionalidades

- **Turnero del día** (pantalla principal, estilo planilla de Visual Medica):
  una fila por turno coloreada según el estado, con Centro y tipo de
  atención (AMB / INT / GUA), N° de turno, N° de ficha (N° de acceso, en rojo
  mientras el paciente no fue admitido), paciente, documento, fecha de
  nacimiento, edad, estudio (en naranja si lleva contraste), modalidad,
  aseguradora (con aviso de orden o autorización faltante), hora de turno,
  arribo, inicio, fin y usuario. Íconos por fila: cancelar, admitir,
  confirmar, ver informe, WhatsApp, avanzar al siguiente paso, enviar a
  PACS, detalle, ausente, anular admisión, historial y visor (VM).
- **Agenda por equipo** (RM, TC, Eco, Rx, Mamo, …): vista de todos los
  equipos lado a lado o de uno solo; horarios libres, ocupados, bloqueados,
  sobreturnos y cancelados; búsqueda de turnos por DNI, apellido o N° de acceso.
- **Horarios de atención** por equipo (franjas por día de la semana y
  duración del turno) y **bloqueos** (mantenimiento, feriados, por equipo o
  de todo el centro, día entero o por horas; avisa cuántos turnos quedan
  adentro para reprogramar).
- **Pacientes**: DNI (también Patient ID DICOM), cobertura, plan, afiliado,
  peso, observaciones clínicas (alergias, marcapasos, claustrofobia) que se
  muestran en cada paso. Aviso al dar turno de RM si las observaciones
  mencionan marcapasos/implantes.
- **Catálogo de estudios** con código de nomenclador, modalidad, duración,
  contraste, **preparación** para el paciente y valores particular / por
  obra social (con coseguro).
- **Recordatorios por WhatsApp** (link `wa.me` con mensaje armado desde una
  plantilla que incluye la preparación del estudio). No necesita API.
- **Estadísticas**: turnos, realizados, ausentismo, espera promedio en sala,
  tiempo hasta el informe, por equipo, por cobertura y por día.
- **Facturación por obra social**: estudios realizados del período con su
  valor y autorización, agrupados por cobertura, exportable a CSV.
- **Integración PACS / modalidades** (ver abajo).

## Datos e imágenes de ejemplo

En el **Turnero del día**, el administrador tiene el botón **Cargar turnos de
ejemplo (±3 semanas)**: agrega turnos ficticios de **resonancia, tomografía y
rayos** desde 3 semanas atrás hasta 3 semanas adelante (unos 290 turnos de
~100 pacientes inventados con DNI 9000xxxx), sin domingos y con solo rayos
los sábados. Traen notas del turno, observaciones del paciente y del
técnico, indicación, médico derivante e informes (firmados o en borrador).
El estado depende del día: pasados → informados/entregados (con algún
ausente o cancelado), hoy → según la hora, futuros → dados/confirmados.
Se puede apretar más de una vez: no duplica.

### Con tus propios pacientes de prueba (solo local)

Si existe `backend/demo-patients.local.json` (git lo ignora: **nunca se
sube al repositorio**), `npm run setup` / `npm run reset-db` carga esos
pacientes y el botón pasa a ser **Cargar turnos de ejemplo (3 semanas
atrás, pacientes propios)**: genera 2 o 3 turnos por día de las últimas 3
semanas **solo con esos pacientes**, en todas las especialidades (RM, TC,
Rx, ecografía y mamografía; ginecología y mamografía solo a mujeres; un
marcapasos común nunca a RM). El formato está en
`backend/demo-patients.example.json`. Cada paciente lleva `conditions`, que
se reparten así:

| Condición (`conditions`) | Siempre en |
| --- | --- |
| `pacemaker`, `biosafety` (marcapasos, clips/piercings) | observaciones del técnico |
| `claustrophobia`, `iodine`, `mobility` | notas del turno (administrativo) |
| `renal`, `dialysis` | informe médico |
| `oxygen` | notas del turno y observaciones del técnico |
| `prosthesis`, `glaucoma`, `obesity`, `pacemakerMR` | repartidas según el estudio |

Los turnos de tus pacientes **se suman** a los que ya haya: si un horario
del equipo está ocupado se usa el siguiente libre. Para agregarlos sin
borrar nada: poné el archivo, corré `npm run setup` (no `reset-db`), `npm
start` y el botón. Sin ese archivo, la demo usa pacientes inventados.

Los pacientes tienen, en forma arbitraria (~60 %), condiciones clínicas que
aparecen repartidas y coherentes en todo el circuito según el estudio:
**hemodiálisis**, **marcapasos** (común → nunca RM; o MR condicional con
protocolo de cardiología), **prótesis metálica**, **alergia al iodo**,
**claustrofobia** y **glaucoma**. Por ejemplo, un alérgico al iodo con TC
con contraste tiene en la ficha "ALERGIA AL IODO", en la nota del turno la
premedicación, en la observación técnica "premedicado según protocolo…" y
en el informe la mención del contraste; un paciente con glaucoma y TC de
abdomen tiene "NO administrar Buscapina" y el informe menciona el artefacto
por peristaltismo. La nota del turno aparece siempre que aplique; la
observación técnica y la frase del informe, no siempre (ver
`backend/src/utils/demoConditions.js`).

Los estudios con imágenes en el PACS se abren en el **visor de
demostración** (`/visor/:id`, botón **VM**): imágenes **ficticias** generadas
en el navegador según modalidad y zona (cerebro, columna, rodilla, tórax,
abdomen), con series (T1/T2/FLAIR/STIR, ventanas de TC, frente y perfil de
Rx), cortes con la rueda del mouse, brillo/contraste arrastrando, invertir,
y al costado las notas del turno, observaciones e informe. Si se configura
la URL de un visor real en Configuración → Centro, VM abre ese en su lugar.

## Roles

| Rol | Ve |
| --- | --- |
| Administrador (`admin`) | Todo, incluida Configuración (equipos, horarios, estudios, valores, obras sociales, bloqueos, usuarios, datos del centro). |
| Recepción (`reception`) | Turnos, Recepción, Entrega, Pacientes, Recordatorios, Estadísticas. |
| Técnico (`technician`) | Worklist de técnicos y Pacientes. |
| Médico informante (`radiologist`) | Informes y Pacientes. Su matrícula sale en el informe firmado. |

## Stack

Igual que `organizacionturnos`:

- **backend/**: Cloudflare Worker con [Hono](https://hono.dev) + D1
  (SQLite). JWT (`hono/jwt`) + `bcryptjs`.
- **frontend/**: React + Vite + React Router + Tailwind v4, desplegado como
  Worker de assets estáticos.

Fechas y horas se guardan como hora local del centro
(`America/Argentina/Buenos_Aires`).

## Correr en local

Todo corre en tu compu (Windows, Mac o Linux); solo hace falta
[Node.js](https://nodejs.org) 18 o superior. Desde la carpeta del proyecto:

```bash
npm start
```

La primera vez prepara todo solo (instala dependencias, crea
`backend/.dev.vars` con un secreto propio y la base local con datos de
prueba) y después levanta backend y frontend juntos en la misma ventana.
Abrí **http://localhost:5180**. `Ctrl+C` corta los dos.

| Comando | Qué hace |
| --- | --- |
| `npm start` | Levanta backend (http://localhost:8788) y frontend (http://localhost:5180). |
| `npm run setup` | Instala lo que falte y actualiza la base local **sin borrar datos** (correrlo después de un `git pull`). |
| `npm run stop` | Apaga lo que haya quedado prendido en los puertos 8788 y 5180 (por ejemplo, una ventana vieja de `npm run dev`). |
| `npm run solo-mis-pacientes` | Borra todos los pacientes que no estén en `backend/demo-patients.local.json`, con sus turnos, informes e historial. Los tuyos quedan intactos. |
| `npm run borrar-turnos` | Borra **todos los turnos** (estudios hechos y pendientes) con sus informes e historial. Quedan pacientes, equipos, catálogo de estudios, usuarios y API keys. |
| `npm run reset-db` | Borra la base local y la crea de nuevo desde cero con los datos de prueba. |

La base es un SQLite local (D1 simulado por wrangler) en
`backend/.wrangler/`; no se conecta a ningún servicio externo.

Usa los puertos 8788 (backend) y 5180 (frontend) para no chocar con
`organizacionturnos` (InPatient), que usa 8787 y 5173; se pueden correr los dos a la vez.

Usuarios de prueba (contraseña `turnero123`):

| Email | Rol |
| --- | --- |
| admin@turnero.test | Administrador |
| recepcion@turnero.test | Recepción |
| tecnico@turnero.test | Técnico |
| informante@turnero.test | Médico informante |

Tests de la lógica de agenda: `cd backend && npm test`.

## Despliegue en Cloudflare

```bash
cd backend
npx wrangler d1 create turnero-db      # copiar el database_id a wrangler.jsonc
npm run db:schema:remote && npm run db:seed:remote
npx wrangler secret put JWT_SECRET
npm run db:migrate:remote              # solo si la base es anterior a las API keys
# CORS_ORIGIN en wrangler.jsonc = URL del frontend
npm run deploy

cd ../frontend
VITE_API_URL=https://<backend>.workers.dev/api npm run build
npx wrangler deploy
```

Antes de usarlo con datos reales: cambiar las contraseñas de los usuarios
de prueba (o no cargar `seed.sql`).

## API keys e integración con sistemas externos

En **Configuración → API keys** el administrador genera keys para otros
sistemas (InPatient, el PACS, un broker de worklist). Cada key tiene un
nombre y solo los permisos que se le marcan. Se muestra completa **una sola
vez** al crearla (en la base queda solo su hash SHA-256), se ve cuándo se
usó por última vez, se le pueden cambiar los permisos y se puede revocar en
el acto.

| Permiso | Endpoint |
| --- | --- |
| `schedule:read` | `GET /api/integration/schedule?date=AAAA-MM-DD[&modality=MR][&ae_title=RM15T]` — turnero del día: paciente, estudio, equipo, cobertura, horarios, estado, N° de acceso, estado de PACS e informe. |
| `worklist:read` | `GET /api/integration/worklist?ae_title=RM15T[&date=]` — **Modality Worklist** en JSON con atributos DICOM (`AccessionNumber`, `StudyInstanceUID`, `PatientID`, `PatientName`, `ScheduledProcedureStepSequence`, …) de los pacientes admitidos o en sala. Pensado para que un broker MWL (plugin de Orthanc, dcm4chee, etc.) la sirva a la modalidad, así el estudio llega al PACS con el N° de acceso y el UID del RIS. |
| `pacs:write` | `POST /api/integration/study-received` con `{ "accession_number", "study_instance_uid", "image_count" }` — el PACS avisa que recibió el estudio; si el técnico no lo había finalizado, pasa a Realizado. |
| `clinical:read` | Datos clínicos. En `GET /api/integration/schedule` agrega a cada turno un objeto `clinical` con `patient_notes` (observaciones del paciente: alergias, marcapasos, claustrofobia…), `clinical_indication` (diagnóstico presuntivo), `appointment_notes` (notas del turno), `technician_notes` (observaciones del técnico) y `report` (informe **firmado**: técnica, hallazgos, conclusión, médico y matrícula; un borrador figura solo como `{ "status": "draft" }`). Además habilita `GET /api/integration/patients/<DNI>`: paciente con sus observaciones y el historial de estudios con esos mismos datos. |

Todas se llaman servidor a servidor con el header `X-API-Key`:

```bash
curl -H "X-API-Key: ris_..." "http://localhost:8788/api/integration/schedule?date=2026-10-02"
```

`INTEGRATION_API_KEY` (secreto opcional del Worker) sigue funcionando como
key maestra con todos los permisos. Si la base se creó antes de que
existieran las API keys, agregá la tabla sin borrar datos con
`npm run db:migrate:local` (o `db:migrate:remote`).

Modo PACS (`PACS_MODE`, variable del Worker):

- sin definir / `simulated` (por defecto, **prueba**): al finalizar el
  estudio se simula que las imágenes llegaron al PACS.
- `external`: el turno queda con PACS pendiente hasta el aviso de
  `study-received`.

Para abrir las imágenes desde el RIS, cargar en Configuración → Centro la
URL del visor, p. ej. `https://pacs.ejemplo.com/ohif/viewer?StudyInstanceUIDs={uid}`.

## Pendiente / fuera de alcance de la prueba

- Turnos online para pacientes y envío automático de recordatorios
  (hoy es un link de WhatsApp que envía la recepción).
- MWL DICOM nativa (C-FIND) y HL7: se expone JSON para un broker.
- Plantillas de informe por estudio, dictado y firma digital con
  certificado.
- Multi-sede / multi-institución.
