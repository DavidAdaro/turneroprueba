// Búsqueda sin distinguir mayúsculas ni acentos ("benitez" encuentra
// "Benítez"). SQLite no tiene unaccent, así que se normaliza con replace()
// en SQL y con NFD en JS.
const ACCENTS = [['á', 'a'], ['é', 'e'], ['í', 'i'], ['ó', 'o'], ['ú', 'u'], ['ü', 'u'], ['ñ', 'n'], ['Á', 'a'], ['É', 'e'], ['Í', 'i'], ['Ó', 'o'], ['Ú', 'u'], ['Ü', 'u'], ['Ñ', 'n']];

export const sqlNorm = (expr) => ACCENTS.reduce((acc, [from, to]) => `replace(${acc}, '${from}', '${to}')`, `lower(${expr})`);

export const normText = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
