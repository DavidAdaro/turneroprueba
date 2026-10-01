export async function readJson(c) {
  return c.req.json().catch(() => ({}));
}

export const toInt = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

export const toBool = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);

export const clean = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

// Construye un UPDATE con los campos presentes en body (whitelist).
export function buildUpdate(table, fields, body, id) {
  const sets = [];
  const values = [];
  for (const [field, transform] of Object.entries(fields)) {
    if (field in body) {
      sets.push(`${field} = ?`);
      values.push(transform(body[field]));
    }
  }
  if (!sets.length) return null;
  return { sql: `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`, values: [...values, id] };
}
