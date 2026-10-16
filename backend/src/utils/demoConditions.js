// Condiciones clínicas ficticias para los turnos de ejemplo. Cada una sabe
// qué texto poner en cada lugar del circuito según el estudio:
//   patient → observaciones del paciente (ficha)
//   note    → notas del turno (lo que tiene que saber recepción)
//   tech    → observaciones del técnico (qué se hizo en la sala)
//   report  → frase del informe médico (cómo afectó al estudio)
// ctx = { mod: 'MR'|'CT'|'DX', contrast: bool, zone: 'cerebro'|'abdomen'|'torax'|'columna'|'rodilla' }

// always: lugares donde la condición aparece SIEMPRE (en el resto, a veces).
export const CONDITIONS = {
  renal: {
    patient: 'Insuficiencia renal crónica (FG 35 ml/min)',
    always: ['report'],
    note: ({ contrast }) => (contrast ? 'IRC: pedir creatinina y filtrado glomerular recientes antes del contraste.' : null),
    tech: ({ contrast, mod }) =>
      contrast ? (mod === 'MR' ? 'Gadolinio macrocíclico a media dosis por IRC.' : 'Se realizó sin contraste EV por insuficiencia renal.') : null,
    report: ({ zone, mod }) =>
      zone === 'abdomen' && mod === 'US'
        ? 'Riñones de tamaño reducido con aumento de la ecogenicidad cortical, compatible con nefropatía médica crónica.'
        : zone === 'abdomen'
          ? 'Riñones de tamaño disminuido con adelgazamiento cortical, en relación con insuficiencia renal crónica conocida.'
          : mod === 'CT' || mod === 'MR'
            ? 'Antecedente de insuficiencia renal crónica: estudio realizado sin contraste endovenoso.'
            : 'Antecedente de insuficiencia renal crónica (FG 35 ml/min).',
  },
  oxygen: {
    patient: 'Oxigenodependiente (cánula nasal 2 l/min)',
    always: ['note', 'tech'],
    note: ({ mod }) =>
      mod === 'MR' ? 'Requiere oxígeno: usar el tubo AMAGNÉTICO de la sala de RM, no el propio.' : 'Requiere oxígeno: viene con tubo portátil; tener oxígeno central listo en la sala.',
    tech: ({ mod }) =>
      mod === 'MR' ? 'O2 2 l/min con tubo amagnético; saturación controlada durante el estudio.' : 'Paciente con O2 por cánula nasal a 2 l/min durante todo el estudio.',
    report: () => null,
  },
  mobility: {
    patient: 'Movilidad reducida (silla de ruedas)',
    always: ['note'],
    note: () => 'Movilidad reducida: asignar camilla o silla y dos personas para la transferencia.',
    tech: ({ mod }) => (mod === 'DX' ? 'Proyecciones en sedestación por movilidad reducida.' : 'Transferencia a la camilla con dos operadores.'),
    report: ({ mod }) => (mod === 'DX' ? 'Proyecciones obtenidas en sedestación.' : null),
  },
  obesity: {
    patient: 'Obesidad (más de 110 kg)',
    note: ({ mod }) => (mod === 'MR' || mod === 'CT' ? 'Peso elevado: confirmar que está dentro del límite de la camilla (máx. 200 kg) y el diámetro del túnel.' : null),
    tech: ({ mod }) => (mod === 'US' ? 'Ventana acústica limitada por panículo adiposo.' : 'Peso dentro del límite de la camilla; se ajustaron los parámetros de adquisición.'),
    report: ({ mod }) => (mod === 'US' || mod === 'CT' ? 'Evaluación parcialmente limitada por el hábito corporal.' : null),
  },
  biosafety: {
    patient: 'Elementos metálicos: clip de aneurisma cerebral (titanio, RM condicional) y piercings',
    always: ['tech'],
    note: ({ mod }) => (mod === 'MR' ? 'Bioseguridad RM: traer el certificado del clip de aneurisma y retirar piercings antes de venir.' : null),
    tech: ({ mod }) =>
      mod === 'MR'
        ? 'Bioseguridad: formulario de seguridad RM firmado; clip de aneurisma de titanio verificado como RM condicional (≤3T); se retiraron piercings.'
        : 'Se retiraron piercings y elementos metálicos del campo.',
    report: ({ mod, zone }) => (mod === 'MR' && zone === 'cerebro' ? 'Artefacto de susceptibilidad por clip quirúrgico en territorio de la arteria cerebral media derecha.' : null),
  },
  // ---- Bioseguridad y otras (pacientes ficticios) ----
  cochlear: {
    patient: 'Implante coclear derecho (NO apto RM sin protocolo del fabricante)',
    noMR: true,
    always: ['tech'],
    note: ({ mod }) => (mod === 'CT' ? 'Implante coclear: por eso TC y no RM.' : 'Implante coclear: no ingresar a la sala de RM.'),
    tech: ({ mod }) =>
      mod === 'CT' ? 'Artefacto metálico del implante coclear en peñasco derecho; se reconstruyó con algoritmo de reducción de artefactos.' : 'Bioseguridad: implante coclear; se retiró el procesador externo durante el estudio.',
    report: ({ mod, zone }) => (mod === 'CT' && zone === 'cerebro' ? 'Artefacto por implante coclear derecho que limita la evaluación del peñasco homolateral.' : null),
  },
  metalFragments: {
    patient: 'Soldador: riesgo de esquirlas metálicas oculares',
    always: ['tech'],
    note: ({ mod }) => (mod === 'MR' ? 'BIOSEGURIDAD RM: soldador; hacer Rx de órbitas antes de la RM para descartar esquirlas.' : 'Antecedente laboral de soldadura (esquirlas metálicas).'),
    tech: ({ mod }) =>
      mod === 'MR'
        ? 'Bioseguridad: Rx de órbitas previa negativa para cuerpos extraños metálicos; cuestionario de seguridad RM firmado.'
        : 'Se interrogó sobre elementos metálicos (soldador); sin hallazgos que contraindiquen el estudio.',
    report: ({ mod }) => (mod === 'DX' ? 'No se observan cuerpos extraños radiopacos en las órbitas.' : null),
  },
  insulinPump: {
    patient: 'Diabetes tipo 1 con bomba de insulina y sensor de glucosa',
    always: ['tech'],
    note: ({ mod }) =>
      mod === 'MR' || mod === 'CT' ? 'Bomba de insulina y sensor: retirarlos antes de entrar a la sala (traer insumos de recambio).' : 'Usa bomba de insulina.',
    tech: ({ mod }) =>
      mod === 'MR' || mod === 'CT'
        ? 'Bioseguridad: se desconectaron bomba de insulina y sensor de glucosa durante el estudio; reconectados al finalizar.'
        : 'Bomba de insulina fuera del campo de exposición.',
    report: () => null,
  },
  tattoo: {
    patient: 'Tatuajes extensos en ambos brazos y espalda',
    always: ['tech'],
    note: ({ mod }) => (mod === 'MR' ? 'Tatuajes extensos: avisarle que informe si siente calor durante la RM.' : null),
    tech: ({ mod }) =>
      mod === 'MR' ? 'Bioseguridad: tatuajes extensos; compresas frías y control verbal; sin calentamiento referido.' : 'Tatuajes extensos sin implicancia para el estudio.',
    report: () => null,
  },
  pregnancy: {
    patient: 'Posible embarazo (FUM hace 6 semanas)',
    always: ['note'],
    note: ({ mod }) =>
      mod === 'US'
        ? 'Posible embarazo: la ecografía no tiene restricciones.'
        : mod === 'MR'
          ? 'Posible embarazo: RM sin gadolinio y solo si el médico lo justifica; confirmar con test.'
          : 'POSIBLE EMBARAZO: pedir test antes del estudio; si es positivo, reprogramar o consultar con el médico.',
    tech: ({ mod }) => (mod === 'DX' || mod === 'CT' || mod === 'MG' ? 'Test de embarazo negativo; protector plomado abdominal.' : null),
    report: ({ mod }) => (mod === 'DX' || mod === 'CT' ? 'Estudio realizado con protección plomada abdominal.' : null),
  },
  latex: {
    patient: 'ALERGIA AL LÁTEX',
    always: ['note', 'tech'],
    note: () => 'ALERGIA AL LÁTEX: preparar sala y material libres de látex (guantes de nitrilo).',
    tech: () => 'Sala y material libres de látex; sin reacciones.',
    report: () => null,
  },
  anticoagulated: {
    patient: 'Anticoagulado (acenocumarol)',
    always: ['tech'],
    note: ({ contrast }) => (contrast ? 'Anticoagulado: avisar al técnico para compresión prolongada de la vía.' : null),
    tech: ({ contrast }) => (contrast ? 'Anticoagulado: compresión de 5 minutos del sitio de punción, sin hematoma.' : 'Paciente anticoagulado, sin incidencias.'),
    report: () => null,
  },
  metformin: {
    patient: 'Diabético tipo 2 en tratamiento con metformina',
    always: ['note'],
    note: ({ contrast, mod }) =>
      contrast && mod === 'CT' ? 'Metformina: suspenderla 48 h después del contraste y retomar con función renal normal.' : 'Diabético con metformina: no suspenderla (estudio sin contraste iodado); puede desayunar si no requiere ayuno.',
    tech: ({ contrast }) => (contrast ? 'Se indicó suspender metformina 48 h post contraste.' : null),
    report: () => null,
  },
  dialysis: {
    patient: 'Insuficiencia renal crónica en hemodiálisis (lun-mié-vie). Fístula AV en brazo izquierdo',
    note: ({ mod, contrast }) =>
      mod === 'CT' && contrast
        ? 'HEMODIÁLISIS: coordinar sesión dentro de las 24 h post contraste y avisar a nefrología. No requiere creatinina.'
        : mod === 'MR' && contrast
          ? 'HEMODIÁLISIS: gadolinio solo macrocíclico y con diálisis programada después del estudio. Consultar con el médico informante.'
          : 'Paciente en hemodiálisis: dar turnos martes, jueves o sábado.',
    tech: ({ contrast }) =>
      contrast
        ? 'Fístula AV en brazo izquierdo: vía en brazo derecho. Contraste administrado; se avisó a la unidad de diálisis.'
        : 'Fístula AV en brazo izquierdo: no se tomó presión ni vía en ese brazo.',
    report: ({ zone, mod }) =>
      zone === 'abdomen'
        ? 'Riñones de tamaño disminuido con pérdida de la diferenciación córtico-medular, en relación con nefropatía crónica conocida.'
        : mod === 'DX'
          ? null
          : 'Paciente con insuficiencia renal en hemodiálisis.',
  },
  pacemaker: {
    patient: 'Marcapasos definitivo (NO compatible con RM)',
    noMR: true,
    always: ['tech'],
    note: ({ mod }) => (mod === 'CT' ? 'Portador de marcapasos: por eso se indicó TC y no RM.' : 'Portador de marcapasos: confirmar que el estudio no sea RM.'),
    tech: ({ mod }) =>
      mod === 'DX' ? 'Generador de marcapasos visible en la proyección; se informó al médico.' : 'Se minimizó la exposición directa sobre el generador del marcapasos.',
    report: ({ mod, zone }) =>
      zone === 'torax' || mod === 'DX'
        ? 'Generador de marcapasos en región pectoral izquierda con electrodo en cavidades cardíacas derechas.'
        : 'Artefacto lineal por electrodo de marcapasos.',
  },
  pacemakerMR: {
    patient: 'Marcapasos MR condicional (requiere protocolo con cardiología)',
    note: ({ mod }) =>
      mod === 'MR'
        ? 'MARCAPASOS MR CONDICIONAL: coordinar cardiólogo presente para programar el equipo antes y después. Turno de 60 min.'
        : 'Portador de marcapasos MR condicional.',
    tech: ({ mod }) =>
      mod === 'MR'
        ? 'Cardiólogo presente. Marcapasos programado en modo seguro y reprogramado al finalizar. SAR limitado según fabricante.'
        : null,
    report: ({ mod }) =>
      mod === 'MR'
        ? 'Estudio realizado bajo protocolo de marcapasos MR condicional; artefacto de susceptibilidad en región pectoral izquierda.'
        : null,
  },
  prosthesis: {
    patient: 'Prótesis metálica (reemplazo total de cadera derecha, titanio)',
    note: ({ mod }) =>
      mod === 'MR' ? 'Prótesis metálica: pedir el certificado de compatibilidad con RM antes de entrar.' : 'Tiene prótesis de cadera: avisar en la toma.',
    tech: ({ mod }) =>
      mod === 'MR'
        ? 'Artefacto por material protésico; se usaron secuencias de reducción de artefacto metálico (MARS).'
        : mod === 'CT'
          ? 'Reconstrucción con algoritmo de reducción de artefacto metálico.'
          : 'Material protésico en el campo; se agregó una proyección adicional.',
    report: ({ mod, zone }) =>
      mod === 'DX' || zone === 'columna'
        ? 'Prótesis de cadera derecha normoposicionada, sin signos de aflojamiento.'
        : 'Artefacto por material protésico que limita parcialmente la evaluación de las estructuras adyacentes.',
  },
  iodine: {
    patient: 'ALERGIA AL IODO (urticaria con contraste en 2019)',
    always: ['note'],
    note: ({ mod, contrast }) =>
      mod === 'CT' && contrast
        ? 'ALÉRGICO AL IODO: premedicación con corticoide 13, 7 y 1 h antes y antihistamínico 1 h antes. Si no está premedicado, NO inyectar.'
        : mod === 'CT'
          ? 'Alergia al iodo: estudio sin contraste, no requiere premedicación.'
          : mod === 'MR'
            ? 'Alergia al iodo: el gadolinio no tiene reacción cruzada, pero dejarlo en observación 15 min.'
            : 'Alérgico al iodo (no aplica a este estudio).',
    tech: ({ mod, contrast }) =>
      mod === 'CT' && contrast
        ? 'Paciente premedicado según protocolo. Contraste no iónico 80 ml sin reacciones. Observación de 30 min en sala.'
        : mod === 'CT'
          ? 'Se realizó sin contraste endovenoso por antecedente alérgico.'
          : null,
    report: ({ mod, contrast }) =>
      mod === 'CT' && !contrast
        ? 'Estudio sin contraste endovenoso por antecedente de alergia al iodo, lo que limita la evaluación vascular y de lesiones focales.'
        : mod === 'CT'
          ? 'Contraste iodado administrado con premedicación, sin reacciones.'
          : null,
  },
  claustrophobia: {
    patient: 'Claustrofobia',
    always: ['note'],
    note: ({ mod }) =>
      mod === 'MR'
        ? 'CLAUSTROFOBIA SEVERA: traer el ansiolítico que le indicó su médico; venir acompañado (no puede manejar después).'
        : mod === 'CT'
          ? 'Claustrofobia: explicarle que el tomógrafo es abierto y corto.'
          : 'Claustrofobia: avisarle que este estudio es en sala abierta.',
    tech: ({ mod }) =>
      mod === 'MR'
        ? 'Paciente ansioso: ingresó pies primero, con música y acompañante. Se interrumpió una vez; protocolo abreviado.'
        : mod === 'CT'
          ? 'Leve ansiedad; se completó sin inconvenientes.'
          : null,
    report: ({ mod }) => (mod === 'MR' ? 'Estudio parcialmente limitado por artefactos de movimiento (paciente claustrofóbico, protocolo abreviado).' : null),
  },
  glaucoma: {
    patient: 'Glaucoma de ángulo cerrado',
    note: ({ zone }) =>
      zone === 'abdomen'
        ? 'GLAUCOMA: NO administrar Buscapina (butilescopolamina) ni otros antiespasmódicos anticolinérgicos.'
        : 'Glaucoma de ángulo cerrado: no usar anticolinérgicos.',
    tech: ({ zone, mod }) =>
      zone === 'abdomen' ? 'No se administró antiespasmódico por glaucoma.' : mod === 'DX' ? null : 'Sin medicación adicional (glaucoma).',
    report: ({ zone }) =>
      zone === 'abdomen'
        ? 'Leve artefacto por peristaltismo intestinal (no se administró antiespasmódico por glaucoma).'
        : zone === 'cerebro'
          ? 'Globos oculares de morfología conservada.'
          : null,
  },
};

// Qué condiciones tiene cada paciente del padrón generado (~60 % con alguna).
const POOL_CONDITIONS = [
  ['dialysis'], ['pacemaker'], ['prosthesis'], ['iodine'], ['claustrophobia'], ['glaucoma'],
  ['iodine', 'claustrophobia'], ['dialysis', 'glaucoma'], ['pacemakerMR'], ['prosthesis', 'iodine'],
  ['claustrophobia'], ['iodine'], [], [], [], [], [], [],
];
export const conditionsForPool = (i) => POOL_CONDITIONS[(i * 7) % POOL_CONDITIONS.length];

export const patientNotesFor = (conditions, extra) =>
  [extra, ...conditions.map((c) => CONDITIONS[c].patient)].filter(Boolean).join('. ') || null;

export function zoneOf(studyName) {
  const n = studyName.toLowerCase();
  if (n.includes('mamo') || n.includes('mama')) return 'mama';
  if (n.includes('tiroid')) return 'cuello';
  if (n.includes('ginecol')) return 'pelvis';
  if (n.includes('abdom')) return 'abdomen'; // abdomen / abdominal
  if (n.includes('tórax') || n.includes('torax')) return 'torax';
  if (n.includes('columna')) return 'columna';
  if (n.includes('rodilla')) return 'rodilla';
  return 'cerebro';
}

// Un paciente con marcapasos común nunca va a RM.
export const canDo = (conditions, mod) => !(mod === 'MR' && conditions.some((c) => CONDITIONS[c].noMR));

// Textos de las condiciones para un turno. pick(n) es un azar determinístico
// (0..999) para repartir: la nota del turno va siempre que aplique, la
// observación técnica y la frase del informe no siempre.
export function conditionTexts(conditions, ctx, pick) {
  const out = { note: [], tech: [], report: [] };
  conditions.forEach((c, i) => {
    const def = CONDITIONS[c];
    const note = def.note(ctx);
    const tech = def.tech(ctx);
    const report = def.report(ctx);
    if (note) out.note.push(note);
    const always = def.always || [];
    if (tech && (always.includes('tech') || pick(i) < 800)) out.tech.push(tech);
    if (report && (always.includes('report') || pick(i + 10) < 750)) out.report.push(report);
  });
  return { note: out.note.join(' '), tech: out.tech.join(' '), report: out.report.join(' ') };
}
