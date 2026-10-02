const KEY_PREFIX = 'ris_';

// Permisos que se le pueden dar a una API key.
export const SCOPES = {
  'schedule:read': 'Leer el turnero del día (turnos con paciente, estudio y estado)',
  'worklist:read': 'Leer la Modality Worklist (pacientes admitidos por equipo)',
  'pacs:write': 'Avisar que el PACS recibió un estudio',
};

const bytesToHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

// Se muestra completa una sola vez, al crearla; después solo se guarda el hash.
export function generateApiKey() {
  return `${KEY_PREFIX}${bytesToHex(crypto.getRandomValues(new Uint8Array(24)))}`;
}

export async function hashApiKey(key) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return bytesToHex(new Uint8Array(digest));
}

// Para reconocer la key en la lista sin poder reconstruirla.
export const keyPrefixOf = (key) => key.slice(0, KEY_PREFIX.length + 8);

export function parseScopes(json) {
  try {
    const list = JSON.parse(json || '[]');
    return Array.isArray(list) ? list.filter((s) => s in SCOPES) : [];
  } catch {
    return [];
  }
}
