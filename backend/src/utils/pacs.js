// Integración con PACS. Modo de prueba ("simulated", por defecto): al
// finalizar el estudio el técnico, se simula que las imágenes llegaron al
// PACS. Modo "external": el turno queda esperando que el PACS (o un router
// DICOM) avise por POST /api/integration/study-received.

// UID DICOM único derivado de un UUID (raíz 2.25, ver DICOM PS3.5 B.2).
export function newDicomUid() {
  const hex = crypto.randomUUID().replace(/-/g, '');
  return `2.25.${BigInt(`0x${hex}`).toString()}`;
}

const SIMULATED_IMAGES = { MR: [180, 600], CT: [200, 900], US: [8, 40], DX: [1, 4], MG: [4, 6], NM: [40, 150], XA: [30, 200], DXA: [2, 4] };

export function pacsMode(env) {
  return env.PACS_MODE === 'external' ? 'external' : 'simulated';
}

// Devuelve el resultado del envío: { pacs_status, image_count }.
export function simulatePacsReception(modality) {
  const [min, max] = SIMULATED_IMAGES[modality] || [1, 50];
  return { pacs_status: 'received', image_count: min + Math.floor(Math.random() * (max - min + 1)) };
}

// Genera un N° de acceso único por día: AAAAMMDD-NNNN.
export async function nextAccessionNumber(db, date) {
  const prefix = date.replace(/-/g, '');
  const row = await db
    .prepare("SELECT accession_number FROM appointments WHERE accession_number LIKE ? ORDER BY accession_number DESC LIMIT 1")
    .bind(`${prefix}-%`)
    .first();
  const last = row ? Number(row.accession_number.split('-')[1]) : 0;
  return `${prefix}-${String(last + 1).padStart(4, '0')}`;
}
