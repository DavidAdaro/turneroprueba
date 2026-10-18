import { hashString } from '../demoImages';

// Pedido médico FICTICIO dibujado como si estuviera escrito a mano en un
// recetario: encabezado impreso del médico, "Rp/", texto manuscrito en tinta
// azul, diagnóstico, fecha, firma y sello. Se arma con los datos del pedido
// del turno; lleva la marca "PEDIDO FICTICIO".

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrap(text, max) {
  const lines = [];
  let line = '';
  for (const word of String(text || '').split(/\s+/).filter(Boolean)) {
    if ((line + ' ' + word).trim().length > max) {
      if (line) lines.push(line);
      line = word;
    } else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

const HAND = "'Caveat', 'Segoe Script', 'Bradley Hand', 'Comic Sans MS', cursive";
const INK = '#1e3a8a';

export default function HandwrittenOrder({ a, width = 520 }) {
  const R = rng(hashString(`${a.id}-${a.order_date}-${a.referring_physician}`));
  const tilt = (R() - 0.5) * 3;
  const doctor = a.referring_physician || 'Dr. Médico Solicitante';
  const license = a.order_physician_license || 'MP —';
  const date = a.order_date || a.date;
  const dmy = date ? date.split('-').reverse().join('/') : '';
  const body = a.order_observations || `Solicito ${a.study_name}.${a.clinical_indication ? ` Dx: ${a.clinical_indication}.` : ''}`;

  // Renglones manuscritos con un poco de temblor (inclinación y margen).
  const lines = [
    `Pac: ${a.patient_last_name}, ${a.patient_first_name}`,
    `DNI ${a.dni}${a.insurance_name ? ` — ${a.insurance_name}${a.affiliate_number ? ` ${a.affiliate_number}` : ''}` : ''}`,
    '',
    ...wrap(body, 34),
    '',
    a.clinical_indication ? `Dx: ${a.clinical_indication}` : null,
    a.order_code ? `Cód. ${a.order_code}` : null,
  ].filter((l) => l !== null);

  // Firma: garabato con curvas de Bézier.
  let sig = 'M 300 690';
  let x = 300;
  for (let i = 0; i < 7; i++) {
    const nx = x + 18 + R() * 22;
    sig += ` C ${x + 8} ${650 + R() * 30}, ${nx - 8} ${700 + R() * 30}, ${nx} ${672 + R() * 22}`;
    x = nx;
  }
  sig += ` M 296 ${708 + R() * 6} Q ${x / 2 + 160} ${690 + R() * 20} ${x + 20} ${700 + R() * 10}`;

  return (
    <svg viewBox="0 0 600 820" width={width} style={{ maxWidth: '100%', transform: `rotate(${tilt}deg)` }} className="shadow-lg" role="img" aria-label="Pedido médico ficticio">
      <defs>
        <filter id="paper">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.96  0 0 0 0 0.94  0 0 0 0 0.88  0 0 0 0.08 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <rect width="600" height="820" fill="#fbf8ef" />
      <rect width="600" height="820" filter="url(#paper)" />

      {/* Encabezado impreso del recetario */}
      <text x="40" y="58" fontFamily="Georgia, serif" fontSize="24" fontWeight="bold" fill="#1f2937">{doctor}</text>
      <text x="40" y="82" fontFamily="Georgia, serif" fontSize="13" fill="#4b5563">Médico · {license}</text>
      <text x="40" y="100" fontFamily="Georgia, serif" fontSize="12" fill="#6b7280">Consultorio: Av. San Martín 1234, Mendoza · Tel. 261 400-0000</text>
      <line x1="40" y1="114" x2="560" y2="114" stroke="#9ca3af" strokeWidth="1.5" />

      {/* Rp/ */}
      <text x="40" y="170" fontFamily={HAND} fontSize="46" fill={INK} fontWeight="600">Rp/</text>

      {/* Texto manuscrito */}
      {lines.map((l, i) => (
        <text
          key={i}
          x={70 + (R() - 0.5) * 10}
          y={220 + i * 40}
          fontFamily={HAND}
          fontSize={30 + (R() - 0.5) * 2}
          fill={INK}
          transform={`rotate(${(R() - 0.5) * 2.2} 300 ${220 + i * 40})`}
          opacity={0.92}
        >
          {l}
        </text>
      ))}

      {/* Fecha, firma y sello */}
      <text x="40" y="660" fontFamily={HAND} fontSize="28" fill={INK}>Mendoza, {dmy}</text>
      <path d={sig} fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
      <g transform={`rotate(${-8 + R() * 6} 470 740)`} opacity="0.72">
        <rect x="380" y="712" width="185" height="62" rx="8" fill="none" stroke="#6d28d9" strokeWidth="2.5" />
        <text x="472" y="738" textAnchor="middle" fontFamily="Georgia, serif" fontSize="15" fontWeight="bold" fill="#6d28d9">{doctor}</text>
        <text x="472" y="760" textAnchor="middle" fontFamily="Georgia, serif" fontSize="13" fill="#6d28d9">{license}</text>
      </g>

      {/* Marca de agua */}
      <text x="300" y="470" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="44" fontWeight="bold" fill="#dc2626" opacity="0.12" transform="rotate(-30 300 470)">
        PEDIDO FICTICIO · DEMO
      </text>
    </svg>
  );
}
