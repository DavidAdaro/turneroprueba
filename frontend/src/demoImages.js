// Imágenes médicas FICTICIAS dibujadas en canvas para el visor de
// demostración. No representan a ningún paciente: se generan a partir del
// tipo de estudio, la serie y el número de corte, con ruido determinístico
// (misma imagen cada vez para el mismo turno).

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hashString = (s) => [...String(s)].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);

// Intensidad de cada tejido según la técnica (0 negro … 255 blanco).
const PALETTES = {
  T1: { fat: 215, soft: 105, brain: 120, gray: 95, csf: 30, bone: 22, marrow: 195, fluid: 35, air: 4, disc: 85, muscle: 70, contrast: 120 },
  T2: { fat: 175, soft: 90, brain: 95, gray: 120, csf: 240, bone: 18, marrow: 125, fluid: 235, air: 4, disc: 195, muscle: 55, contrast: 110 },
  FLAIR: { fat: 165, soft: 95, brain: 105, gray: 125, csf: 22, bone: 18, marrow: 140, fluid: 25, air: 4, disc: 70, muscle: 60, contrast: 110 },
  STIR: { fat: 25, soft: 80, brain: 95, gray: 110, csf: 235, bone: 15, marrow: 40, fluid: 240, air: 4, disc: 190, muscle: 60, contrast: 110 },
  CT: { fat: 55, soft: 112, brain: 102, gray: 112, csf: 58, bone: 238, marrow: 175, fluid: 72, air: 3, disc: 98, muscle: 108, contrast: 200 },
  CTBONE: { fat: 28, soft: 58, brain: 55, gray: 60, csf: 40, bone: 252, marrow: 205, fluid: 45, air: 0, disc: 62, muscle: 55, contrast: 120 },
  CTLUNG: { fat: 150, soft: 205, brain: 200, gray: 205, csf: 190, bone: 255, marrow: 250, fluid: 195, air: 8, disc: 210, muscle: 200, contrast: 230, lung: 55 },
  DX: { fat: 70, soft: 92, brain: 95, gray: 95, csf: 90, bone: 232, marrow: 200, fluid: 92, air: 12, disc: 118, muscle: 100, contrast: 120 },
};

// Series por modalidad y zona.
export function seriesFor(modality, studyName = '') {
  const n = studyName.toLowerCase();
  if (modality === 'MR') {
    if (n.includes('columna')) return [s('T2 SAG', 'T2', 15), s('T1 SAG', 'T1', 15), s('STIR SAG', 'STIR', 15)];
    if (n.includes('rodilla')) return [s('PD FS COR', 'STIR', 20), s('T1 COR', 'T1', 20), s('T2 COR', 'T2', 20)];
    const list = [s('T1 AX', 'T1', 22), s('T2 AX', 'T2', 22), s('FLAIR AX', 'FLAIR', 22)];
    if (n.includes('gadolinio')) list.push(s('T1 AX + GADOLINIO', 'T1', 22, true));
    return list;
  }
  if (modality === 'US') return [s('MODO B', 'US', 12), s('DOPPLER COLOR', 'US', 6)];
  if (modality === 'MG') return [s('CC DERECHA', 'MG', 1, false, 'cc-r'), s('CC IZQUIERDA', 'MG', 1, false, 'cc-l'), s('MLO DERECHA', 'MG', 1, false, 'mlo-r'), s('MLO IZQUIERDA', 'MG', 1, false, 'mlo-l')];
  if (modality === 'CT') {
    if (n.includes('tórax') || n.includes('torax')) return [s('AXIAL MEDIASTINO', 'CT', 40), s('AXIAL PULMÓN', 'CTLUNG', 40)];
    if (n.includes('abdomen')) return [s('AXIAL', 'CT', 40, n.includes('contraste')), s('AXIAL HUESO', 'CTBONE', 40)];
    return [s('AXIAL CEREBRO', 'CT', 30), s('AXIAL HUESO', 'CTBONE', 30)];
  }
  if (n.includes('columna')) return [s('FRENTE (AP)', 'DX', 1), s('PERFIL', 'DX', 1, false, 'lat')];
  if (n.includes('rodilla')) return [s('FRENTE', 'DX', 1), s('PERFIL', 'DX', 1, false, 'lat')];
  return [s('FRENTE (PA)', 'DX', 1), s('PERFIL', 'DX', 1, false, 'lat')];
}
function s(name, technique, slices, contrast = false, view = 'ap') {
  return { name, technique, slices, contrast, view };
}

function anatomyFor(modality, studyName = '') {
  const n = studyName.toLowerCase();
  if (n.includes('columna')) return 'spine';
  if (n.includes('rodilla')) return 'knee';
  if (n.includes('tórax') || n.includes('torax')) return 'chest';
  if (n.includes('abdomen')) return 'abdomen';
  if (n.includes('mama')) return 'chest';
  return 'brain';
}

const gray = (v) => `rgb(${v | 0},${v | 0},${v | 0})`;
function ellipse(ctx, x, y, rx, ry, v, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2);
  ctx.fillStyle = gray(v);
  ctx.fill();
}
function rrect(ctx, x, y, w, h, r, v) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = gray(v);
  ctx.fill();
}

// ---------- Anatomías ----------

function brain(ctx, S, f, P, R, series) {
  const c = S / 2;
  const k = 0.5 + 0.5 * Math.sin(Math.PI * f); // tamaño del corte
  const rx = S * 0.33 * k + S * 0.05;
  const ry = S * 0.4 * k + S * 0.05;
  ellipse(ctx, c, c, rx + 10, ry + 10, P.fat); // cuero cabelludo
  ellipse(ctx, c, c, rx + 4, ry + 4, P.bone); // calota
  ellipse(ctx, c, c, rx, ry, P.csf); // LCR periférico
  ellipse(ctx, c, c, rx - 4, ry - 4, P.gray); // corteza
  ellipse(ctx, c, c, rx - 16, ry - 16, P.brain); // sustancia blanca
  // Surcos
  ctx.lineWidth = 2;
  ctx.strokeStyle = gray(P.csf);
  for (let i = 0; i < 70; i++) {
    const a = R() * Math.PI * 2;
    const r1 = 0.78 + R() * 0.2;
    const x = c + Math.cos(a) * (rx - 4) * r1;
    const y = c + Math.sin(a) * (ry - 4) * r1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (R() - 0.5) * 18, y + (R() - 0.5) * 18, c + Math.cos(a) * (rx - 4) * (r1 - 0.12), c + Math.sin(a) * (ry - 4) * (r1 - 0.12));
    ctx.stroke();
  }
  // Hoz del cerebro
  ctx.beginPath();
  ctx.moveTo(c, c - ry + 6);
  ctx.lineTo(c, c + ry - 6);
  ctx.stroke();
  // Ventrículos laterales en los cortes centrales
  if (f > 0.35 && f < 0.75) {
    const v = Math.sin(Math.PI * (f - 0.35) / 0.4);
    ellipse(ctx, c - 16, c - 8, 9 * v + 3, 38 * v + 4, P.csf, 0.15);
    ellipse(ctx, c + 16, c - 8, 9 * v + 3, 38 * v + 4, P.csf, -0.15);
  }
  // Globos oculares en los cortes bajos
  if (f < 0.3) {
    ellipse(ctx, c - rx * 0.45, c - ry - 2, 18, 16, P.fluid);
    ellipse(ctx, c + rx * 0.45, c - ry - 2, 18, 16, P.fluid);
  }
  // Realce con contraste: senos venosos y plexos
  if (series.contrast) {
    ellipse(ctx, c, c + ry - 8, 8, 6, 230);
    if (f > 0.4 && f < 0.7) ellipse(ctx, c - 12, c + 18, 5, 4, 220);
  }
}

function spine(ctx, S, f, P, R, series) {
  const c = S / 2;
  const lateral = series.technique === 'DX' ? series.view === 'lat' : true;
  ctx.fillStyle = gray(P.fat);
  ctx.fillRect(c - S * 0.32, 0, S * 0.64, S);
  ellipse(ctx, c + S * 0.18, c, S * 0.1, S * 0.55, P.muscle); // músculos paravertebrales
  const top = S * 0.08;
  const n = 6;
  const h = (S * 0.84) / n;
  const centralCut = Math.abs(f - 0.5) < 0.3 || series.technique === 'DX';
  for (let i = 0; i < n; i++) {
    const y = top + i * h;
    const curve = Math.sin((i / n) * Math.PI) * (lateral ? 18 : 0);
    const x = c - (lateral ? 40 : 30) - curve;
    const w = lateral ? 62 : 60 + i * 3;
    rrect(ctx, x, y, w, h * 0.74, 6, P.bone);
    rrect(ctx, x + 4, y + 4, w - 8, h * 0.74 - 8, 5, P.marrow);
    rrect(ctx, x + 2, y + h * 0.76, w - 4, h * 0.2, 4, P.disc); // disco
    if (lateral) {
      ellipse(ctx, x + w + 38, y + h * 0.4, 10, h * 0.28, P.bone); // apófisis espinosa
    } else {
      ellipse(ctx, x - 10, y + h * 0.35, 9, 6, P.bone);
      ellipse(ctx, x + w + 10, y + h * 0.35, 9, 6, P.bone);
    }
  }
  if (lateral && centralCut) {
    // Canal raquídeo con médula/cola de caballo
    ctx.fillStyle = gray(P.csf);
    ctx.fillRect(c + 26, top, 16, S * 0.84);
    ctx.fillStyle = gray(P.soft);
    ctx.fillRect(c + 31, top, 5, S * 0.36);
  }
  if (series.technique === 'DX' && !lateral) {
    ellipse(ctx, c, S * 0.97, S * 0.38, S * 0.12, P.bone); // pelvis
    ellipse(ctx, c, S * 0.99, S * 0.26, S * 0.08, P.soft);
  }
}

function knee(ctx, S, f, P, R, series) {
  const c = S / 2;
  const lateral = series.view === 'lat';
  const k = series.technique === 'DX' ? 1 : 0.6 + 0.4 * Math.sin(Math.PI * f);
  ellipse(ctx, c, c, S * 0.3, S * 0.6, P.soft); // partes blandas
  ellipse(ctx, c, c, S * 0.26, S * 0.6, P.muscle);
  // Fémur
  rrect(ctx, c - 42 * k, 0, 84 * k, c - 30, 10, P.bone);
  rrect(ctx, c - 36 * k, 0, 72 * k, c - 36, 10, P.marrow);
  ellipse(ctx, c - (lateral ? 0 : 38) * k, c - 46, (lateral ? 70 : 40) * k, 40, P.bone);
  if (!lateral) ellipse(ctx, c + 38 * k, c - 46, 40 * k, 40, P.bone);
  ellipse(ctx, c - (lateral ? 0 : 38) * k, c - 48, (lateral ? 62 : 33) * k, 33, P.marrow);
  if (!lateral) ellipse(ctx, c + 38 * k, c - 48, 33 * k, 33, P.marrow);
  // Espacio articular, cartílago y meniscos
  ctx.fillStyle = gray(series.technique === 'DX' ? P.soft : P.fluid);
  ctx.fillRect(c - 85 * k, c - 8, 170 * k, 14);
  if (series.technique !== 'DX') {
    ctx.fillStyle = gray(12);
    ctx.beginPath();
    ctx.moveTo(c - 85 * k, c - 8);
    ctx.lineTo(c - 45 * k, c);
    ctx.lineTo(c - 85 * k, c + 6);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(c + 85 * k, c - 8);
    ctx.lineTo(c + 45 * k, c);
    ctx.lineTo(c + 85 * k, c + 6);
    ctx.fill();
  }
  // Tibia (y peroné en frente)
  rrect(ctx, c - 80 * k, c + 8, 160 * k, 40, 12, P.bone);
  rrect(ctx, c - 74 * k, c + 12, 148 * k, 34, 10, P.marrow);
  rrect(ctx, c - 40 * k, c + 40, 80 * k, S, 10, P.bone);
  rrect(ctx, c - 34 * k, c + 44, 68 * k, S, 10, P.marrow);
  if (!lateral) rrect(ctx, c + 70 * k, c + 60, 22, S, 8, P.bone);
  if (lateral) ellipse(ctx, c + 95, c - 40, 22, 40, P.bone); // rótula
}

function chestCT(ctx, S, f, P, R, series) {
  const c = S / 2;
  const k = 0.75 + 0.25 * Math.sin(Math.PI * f);
  ellipse(ctx, c, c, S * 0.43 * k, S * 0.3 * k, P.fat);
  ellipse(ctx, c, c, S * 0.41 * k, S * 0.28 * k, P.muscle);
  const lung = P.lung ?? P.air;
  ellipse(ctx, c - S * 0.19, c - 6, S * 0.16 * k, S * 0.22 * k, lung);
  ellipse(ctx, c + S * 0.19, c - 6, S * 0.16 * k, S * 0.22 * k, lung);
  // Vasos pulmonares
  for (let i = 0; i < 40; i++) {
    const side = i % 2 ? 1 : -1;
    ellipse(ctx, c + side * (S * 0.1 + R() * S * 0.18), c - S * 0.15 + R() * S * 0.3, 1.5 + R() * 2, 1.5 + R() * 2, P.soft);
  }
  ellipse(ctx, c + 12, c + 8, S * 0.11, S * 0.1, P.soft); // corazón
  ellipse(ctx, c - 8, c - 34, 16, 16, series.contrast ? P.contrast : P.soft); // aorta
  ellipse(ctx, c, c + S * 0.2, 26, 22, P.bone); // vértebra
  ellipse(ctx, c, c + S * 0.2, 18, 15, P.marrow);
  for (let i = 0; i < 14; i++) {
    const a = Math.PI * (0.15 + (i / 13) * 0.7) + Math.PI;
    for (const side of [-1, 1]) {
      ellipse(ctx, c + side * Math.cos(a) * S * 0.39 * k, c - Math.sin(a) * S * 0.26 * k, 5, 4, P.bone);
    }
  }
  if (series.technique === 'CTLUNG' && f > 0.3 && f < 0.5) ellipse(ctx, c - S * 0.22, c - S * 0.1, 5, 5, P.soft); // nódulo
}

function chestDX(ctx, S, f, P, R, series) {
  const c = S / 2;
  if (series.view === 'lat') {
    ellipse(ctx, c, c + 10, S * 0.3, S * 0.42, P.soft);
    ellipse(ctx, c - 10, c - 10, S * 0.24, S * 0.34, P.air + 40);
    ellipse(ctx, c - 40, c + 50, S * 0.12, S * 0.16, P.soft + 20);
    for (let i = 0; i < 9; i++) rrect(ctx, c + S * 0.2, S * 0.14 + i * 32, 26, 24, 4, P.bone);
    return;
  }
  ctx.fillStyle = gray(P.soft);
  ctx.beginPath();
  ctx.moveTo(c - S * 0.42, S * 0.12);
  ctx.lineTo(c + S * 0.42, S * 0.12);
  ctx.lineTo(c + S * 0.46, S * 0.95);
  ctx.lineTo(c - S * 0.46, S * 0.95);
  ctx.fill();
  ellipse(ctx, c - S * 0.18, c - 10, S * 0.15, S * 0.3, P.air + 35); // pulmones
  ellipse(ctx, c + S * 0.18, c - 10, S * 0.15, S * 0.3, P.air + 35);
  ellipse(ctx, c + 30, c + 60, S * 0.15, S * 0.13, P.soft + 25); // corazón
  ctx.fillStyle = gray(P.soft + 20);
  ctx.fillRect(c - 22, S * 0.12, 44, S * 0.6); // mediastino
  // Costillas
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(235,235,235,0.55)';
  for (let i = 0; i < 9; i++) {
    const y = S * 0.2 + i * 28;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(c + side * 18, y);
      ctx.quadraticCurveTo(c + side * S * 0.36, y - 30, c + side * S * 0.34, y + 40);
      ctx.stroke();
    }
  }
  // Clavículas y columna
  ctx.lineWidth = 10;
  ctx.strokeStyle = gray(P.bone);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c + side * 14, S * 0.16);
    ctx.quadraticCurveTo(c + side * S * 0.2, S * 0.1, c + side * S * 0.38, S * 0.14);
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) rrect(ctx, c - 12, S * 0.12 + i * 28, 24, 22, 3, 160);
  // Diafragma
  ellipse(ctx, c - S * 0.18, S * 0.86, S * 0.17, S * 0.08, P.soft);
  ellipse(ctx, c + S * 0.18, S * 0.88, S * 0.17, S * 0.08, P.soft);
}

function abdomen(ctx, S, f, P, R, series) {
  const c = S / 2;
  const k = 0.8 + 0.2 * Math.sin(Math.PI * f);
  ellipse(ctx, c, c, S * 0.44 * k, S * 0.33 * k, P.fat);
  ellipse(ctx, c, c, S * 0.4 * k, S * 0.3 * k, P.soft - 10);
  const organ = series.contrast ? P.soft + 25 : P.soft;
  if (f < 0.6) ellipse(ctx, c - S * 0.2, c - 20, S * 0.18 * (1 - f * 0.8), S * 0.17, organ + 8); // hígado
  if (f < 0.5) ellipse(ctx, c + S * 0.26, c - 30, S * 0.08, S * 0.1, organ + 4); // bazo
  if (f > 0.3 && f < 0.8) {
    const kid = series.contrast ? P.contrast : P.soft + 12;
    ellipse(ctx, c - S * 0.15, c + 40, 26, 36, kid, 0.3);
    ellipse(ctx, c + S * 0.15, c + 40, 26, 36, kid, -0.3);
  }
  ellipse(ctx, c - 22, c + 20, 10, 10, series.contrast ? P.contrast : P.soft); // aorta
  ellipse(ctx, c, c + S * 0.2, 28, 24, P.bone);
  ellipse(ctx, c, c + S * 0.2, 20, 17, P.marrow);
  ellipse(ctx, c - 60, c + S * 0.22, 40, 30, P.muscle);
  ellipse(ctx, c + 60, c + S * 0.22, 40, 30, P.muscle);
  for (let i = 0; i < 12; i++) {
    const x = c - 60 + R() * 140;
    const y = c - 40 + R() * 90;
    ellipse(ctx, x, y, 12 + R() * 10, 10 + R() * 8, P.soft + 5);
    if (R() > 0.5) ellipse(ctx, x + 3, y - 2, 4 + R() * 5, 3 + R() * 4, P.air);
  }
}

// Ecografía: abanico con textura de speckle y estructuras hipoecoicas.
function ultrasound(ctx, S, f, R, series, studyName) {
  const cx = S / 2;
  const top = S * 0.08;
  const r = S * 0.85;
  const fan = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 22, top);
    ctx.arc(cx, top - 40, r, Math.PI / 2 + 0.62, Math.PI / 2 - 0.62, true);
    ctx.lineTo(cx + 22, top);
    ctx.closePath();
  };
  fan();
  ctx.fillStyle = gray(70);
  ctx.fill();
  ctx.save();
  fan();
  ctx.clip();
  // Speckle
  for (let i = 0; i < 2600; i++) ellipse(ctx, R() * S, top + R() * r, 1 + R() * 2.5, 0.6 + R() * 1.2, 40 + R() * 110);
  const n = (studyName || '').toLowerCase();
  if (n.includes('tiroid')) {
    ellipse(ctx, cx - 70, S * 0.38, 70, 40, 105);
    ellipse(ctx, cx + 70, S * 0.38, 70, 40, 105);
    ellipse(ctx, cx - 60 + f * 30, S * 0.38, 14, 11, 95); // nódulo
    ellipse(ctx, cx, S * 0.62, 30, 30, 10); // tráquea (sombra)
  } else if (n.includes('ginecol')) {
    ellipse(ctx, cx, S * 0.45, 95, 60, 95);
    ellipse(ctx, cx, S * 0.45, 70, 6, 170); // endometrio
    ellipse(ctx, cx - 150, S * 0.55, 32, 24, 80);
    ellipse(ctx, cx + 150, S * 0.55, 32, 24, 80);
  } else {
    ellipse(ctx, cx - 40, S * 0.42, 180, 120, 100); // hígado
    ellipse(ctx, cx + 30 + f * 20, S * 0.5, 34, 22, 8); // vesícula (anecoica)
    ctx.strokeStyle = gray(220);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx - 40, S * 0.75, 200, 60, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke(); // diafragma
  }
  if (series.name.includes('DOPPLER')) {
    ctx.fillStyle = 'rgba(220,40,40,0.75)';
    ctx.fillRect(cx - 20, S * 0.55, 40, 10);
    ctx.fillStyle = 'rgba(40,90,230,0.75)';
    ctx.fillRect(cx - 20, S * 0.58, 40, 10);
  }
  ctx.restore();
  // Escala de profundidad
  ctx.fillStyle = gray(200);
  for (let i = 0; i < 9; i++) ctx.fillRect(S - 16, top + (i * r) / 9, 8, 2);
}

// Mamografía: mama en proyección CC o MLO, densidad tipo B.
function mammo(ctx, S, f, R, series) {
  const right = series.view.endsWith('-r');
  const mlo = series.view.startsWith('mlo');
  const wall = right ? 0 : S; // pared torácica al costado
  const dir = right ? 1 : -1;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(wall, S / 2, S * 0.62, S * 0.44, 0, right ? -Math.PI / 2 : Math.PI / 2, right ? Math.PI / 2 : (3 * Math.PI) / 2);
  ctx.closePath();
  ctx.fillStyle = gray(110);
  ctx.fill();
  ctx.clip();
  for (let i = 0; i < 70; i++) {
    const x = wall + dir * (S * 0.05 + R() * S * 0.45);
    const y = S * 0.25 + R() * S * 0.5;
    ellipse(ctx, x, y, 10 + R() * 30, 6 + R() * 18, 140 + R() * 70, R() * Math.PI);
  }
  if (mlo) {
    ctx.fillStyle = gray(200); // músculo pectoral
    ctx.beginPath();
    ctx.moveTo(wall, 0);
    ctx.lineTo(wall + dir * S * 0.32, 0);
    ctx.lineTo(wall, S * 0.6);
    ctx.fill();
  }
  ctx.restore();
  ellipse(ctx, wall + dir * S * 0.61, S / 2, 9, 12, 190); // pezón
  ctx.fillStyle = gray(230);
  ctx.font = 'bold 22px monospace';
  ctx.fillText(`${right ? 'R' : 'L'} ${mlo ? 'MLO' : 'CC'}`, right ? S - 110 : 20, S - 30);
}

const DRAW = { brain, spine, knee, chest: chestCT, abdomen };

// Dibuja la imagen `index` (0..slices-1) de la serie en el canvas.
export function drawDemoImage(canvas, { modality, studyName, seed, series, index }) {
  const S = canvas.width;
  const ctx = canvas.getContext('2d');
  const P = PALETTES[series.technique] || PALETTES.CT;
  const R = rng(seed ^ hashString(series.name) ^ Math.imul(index + 1, 2654435761));
  const f = series.slices > 1 ? (index + 0.5) / series.slices : 0.5;
  const anatomy = anatomyFor(modality, studyName);

  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  ctx.filter = series.technique === 'DX' ? 'blur(2px)' : 'blur(1px)';
  if (modality === 'US') ultrasound(ctx, S, f, R, series, studyName);
  else if (modality === 'MG') mammo(ctx, S, f, R, series);
  else if (modality === 'DX' && anatomy === 'chest') chestDX(ctx, S, f, P, R, series);
  else (DRAW[anatomy] || brain)(ctx, S, f, P, R, series);
  ctx.restore();

  // Ruido para que parezca una adquisición real.
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  const amp = modality === 'MR' ? 14 : modality === 'CT' ? 9 : modality === 'US' ? 30 : 6;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, d[i] + (R() - 0.5) * amp));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}
