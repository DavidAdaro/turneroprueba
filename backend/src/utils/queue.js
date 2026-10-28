// Cola de un equipo (consola): calcula a qué hora empieza y termina de verdad
// cada estudio. Un estudio no puede empezar antes de su turno ni mientras el
// equipo está ocupado, así que los sobreturnos y los estudios que se alargan
// generan demora, que se arrastra hasta que la absorbe un hueco (un ausente,
// el corte del mediodía) o un estudio que termina antes.
// Cuando el equipo se libera, entre los que ya están esperando pasa primero la
// guardia, después el de turno más temprano (y a igual hora, el turno antes
// que el sobreturno).
//
// items: [{ key, s, dur, urgent, overbook, start?, end? }] en minutos del día;
// start/end, si vienen, son horas reales ya registradas y se respetan.
// Devuelve Map key → { start, end }.
export function runQueue(items) {
  const out = new Map();
  const fixed = items.filter((x) => x.start != null).sort((a, b) => a.start - b.start);
  const rest = items.filter((x) => x.start == null).sort((a, b) => a.s - b.s);
  let free = -Infinity;
  while (fixed.length || rest.length) {
    const t = rest.length ? Math.max(free, rest[0].s) : Infinity;
    if (fixed.length && fixed[0].start <= t) {
      const f = fixed.shift();
      const end = f.end ?? f.start + f.dur;
      out.set(f.key, { start: f.start, end });
      free = Math.max(free, end);
      continue;
    }
    let pick = 0;
    for (let i = 1; i < rest.length && rest[i].s <= t; i++) {
      const a = rest[i];
      const b = rest[pick];
      if ((a.urgent && !b.urgent) || (a.urgent === b.urgent && a.s === b.s && b.overbook && !a.overbook)) pick = i;
    }
    // Si no termina antes de un estudio que ya empezó de verdad, espera a ese.
    if (fixed.length && t + rest[pick].dur > fixed[0].start) {
      const f = fixed.shift();
      const end = f.end ?? f.start + f.dur;
      out.set(f.key, { start: f.start, end });
      free = Math.max(free, end);
      continue;
    }
    const x = rest.splice(pick, 1)[0];
    out.set(x.key, { start: t, end: t + x.dur });
    free = t + x.dur;
  }
  return out;
}

// Duración real de un estudio según una semilla fija: entre 90 % y 125 % de
// la prevista, y de vez en cuando (~3 %) un
// imprevisto que lo alarga 15 a 35 min. Devuelve { dur, incident }.
const INCIDENTS = [
  'paciente claustrofóbico, hubo que tranquilizarlo y repetir secuencias',
  'reinicio del equipo por falla de software',
  'reacción leve al contraste, se observó al paciente',
  'paciente con dolor, costó posicionarlo',
  'se repitieron series por movimiento',
  'demora en la colocación de la vía para el contraste',
];
export function studyRun(minutes, seed) {
  let h = Math.imul(seed ^ 0x9e3779b9, 2654435761);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519) >>> 0;
  const dur = Math.max(3, Math.round(minutes * (0.9 + (h % 351) / 1000)));
  if ((h >>> 9) % 1000 >= 30) return { dur, incident: null };
  const extra = 15 + ((h >>> 3) % 21);
  return { dur: dur + extra, incident: { minutes: extra, why: INCIDENTS[(h >>> 5) % INCIDENTS.length] } };
}
