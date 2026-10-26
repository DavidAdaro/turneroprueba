// Arma una imagen (SVG, para rasterizar a PNG con @cf-wasm/resvg) de un
// pedido médico "manuscrito ficticio", para que InPatient pueda probar su
// lectura por IA sin que nadie suba una foto a mano — ver GET
// /api/integration/order-image. A propósito MÁS SIMPLE que
// HandwrittenOrder.jsx (el componente React que arma la vista "Ver pedido
// escaneado" para el staff, con textura de papel vía filtros SVG, firma
// con curvas Bézier e inclinación aleatoria): resvg (el motor de
// rasterizado que corre en el Worker) no tiene garantizado el soporte de
// filtros SVG (feTurbulence/feColorMatrix), así que esta versión los evita
// del todo en vez de arriesgarse a una imagen rota. No comparte código con
// ese componente — son bundles separados (frontend/backend) sin paquete
// compartido en este repo, y no hace falta que se vean idénticos: esta
// imagen solo tiene que ser legible para una IA de visión, no para una
// persona mirando la pantalla.

function esc(text) {
  return String(text ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
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

// Una sola familia de letra en TODO el SVG, a propósito: resvg (el motor
// de rasterizado, sin ningún sistema operativo con fuentes instaladas
// detrás) solo puede dibujar texto con la fuente que se le pasa a mano
// (ver Resvg.async(svg, { font: { fontBuffers: [...] } }) en
// routes/integration.js) — cualquier font-family que no coincida con esa
// queda en blanco, sin error ni aviso. "Caveat" (Google Fonts, licencia
// OFL, ver assets/Caveat-OFL.txt) tiene look de manuscrita, que es
// justamente el punto de esta imagen.
const FONT = 'Caveat';
const INK = '#1e3a8a';

export function buildOrderImageSvg(a) {
  const doctor = a.referring_physician || 'Médico solicitante';
  const license = a.order_physician_license || '';
  const date = a.order_date || a.date;
  const dmy = date ? date.split('-').reverse().join('/') : '';
  const body = a.order_observations || `Solicito ${a.study_name}.`;

  const lines = [
    `Pac: ${a.patient_last_name}, ${a.patient_first_name}`,
    `DNI ${a.dni}${a.insurance_name ? ` — ${a.insurance_name}${a.affiliate_number ? ` ${a.affiliate_number}` : ''}` : ''}`,
    '',
    ...wrap(body, 38),
    '',
    a.clinical_indication ? `Dx: ${a.clinical_indication}` : null,
    a.order_code ? `Cód. ${a.order_code}` : null,
  ].filter((l) => l !== null);

  const textLines = lines
    .map((l, i) => `<text x="40" y="${200 + i * 36}" font-family="${FONT}" font-size="26" fill="${INK}">${esc(l)}</text>`)
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 ${220 + lines.length * 36 + 80}" width="600">
  <rect width="100%" height="100%" fill="#fbf8ef" />
  <text x="40" y="50" font-family="${FONT}" font-size="26" font-weight="bold" fill="#1f2937">${esc(doctor)}</text>
  <text x="40" y="76" font-family="${FONT}" font-size="18" fill="#4b5563">${esc(license ? `Médico · ${license}` : 'Médico')}</text>
  <line x1="40" y1="88" x2="560" y2="88" stroke="#9ca3af" stroke-width="1.5" />
  <text x="40" y="150" font-family="${FONT}" font-size="40" fill="${INK}" font-weight="600">Rp/</text>
  ${textLines}
  <text x="40" y="${220 + lines.length * 36 + 30}" font-family="${FONT}" font-size="22" fill="${INK}">Mendoza, ${esc(dmy)}</text>
</svg>`;
}
