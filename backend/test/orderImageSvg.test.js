import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderImageSvg } from '../src/utils/orderImageSvg.js';

const appointment = {
  patient_first_name: 'Julieta',
  patient_last_name: 'Arce',
  dni: '90200009',
  insurance_name: 'Swiss Medical',
  affiliate_number: '80902009',
  study_name: 'TC de abdomen y pelvis con contraste',
  referring_physician: 'Dra. Castillo',
  order_physician_license: 'MP 10395',
  order_date: '2026-10-24',
  order_observations: 'Solicito TC de abdomen y pelvis con contraste.',
  clinical_indication: 'Dolor abdominal',
  order_code: '341003',
};

test('arma un SVG válido con los datos del pedido', () => {
  const svg = buildOrderImageSvg(appointment);
  assert.match(svg, /^<svg/);
  assert.match(svg, /Arce, Julieta/);
  assert.match(svg, /90200009/);
  assert.match(svg, /Dra\. Castillo/);
  assert.match(svg, /341003/);
  assert.match(svg, /24\/10\/2026/);
});

test('sin texto de observaciones, cae a "Solicito <estudio>"', () => {
  const svg = buildOrderImageSvg({ ...appointment, order_observations: '' });
  // El texto se envuelve en más de una línea (ancho máx. 38 caracteres) —
  // alcanza con confirmar que "Solicito" y el estudio aparecen.
  assert.match(svg, /Solicito/);
  assert.match(svg, /abdomen y pelvis/);
});

test('escapa caracteres especiales para no romper el XML', () => {
  const svg = buildOrderImageSvg({ ...appointment, clinical_indication: 'Dolor < 48hs & fiebre' });
  assert.doesNotMatch(svg, /Dolor < 48hs & fiebre/);
  assert.match(svg, /Dolor &lt; 48hs &amp; fiebre/);
});

test('nunca deja una línea sin cerrar, incluso sin ningún dato opcional', () => {
  const svg = buildOrderImageSvg({ patient_first_name: 'Ana', patient_last_name: 'Gómez', dni: '1', study_name: 'Eco' });
  assert.match(svg, /<\/svg>$/);
});
