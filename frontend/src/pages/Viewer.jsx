import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Contrast, RotateCcw } from 'lucide-react';
import { api } from '../api';
import { useData } from '../components/useData';
import { useCatalog } from '../components/useCatalogs';
import { drawDemoImage, hashString, seriesFor } from '../demoImages';
import { STATUS, age, formatDateTime, longDate } from '../utils';

const SIZE = 512;

// Visor de DEMOSTRACIÓN: muestra imágenes ficticias generadas para el turno
// (no hay PACS real conectado) junto con las notas y observaciones.
export default function Viewer() {
  const { id } = useParams();
  const settings = useCatalog('settings');
  const { data, error } = useData(() => api.getReport(id), [id]);
  const a = data?.appointment;
  const series = useMemo(() => (a ? seriesFor(a.modality, a.study_name) : []), [a]);
  const [serie, setSerie] = useState(0);
  const [slice, setSlice] = useState(0);
  const [wl, setWl] = useState({ b: 100, c: 100 });
  const [invert, setInvert] = useState(false);
  const canvas = useRef(null);
  const drag = useRef(null);
  const current = series[serie];

  useEffect(() => {
    if (current) setSlice(Math.floor(current.slices / 2));
  }, [serie, current]);

  useEffect(() => {
    if (!a || !current || !canvas.current) return;
    drawDemoImage(canvas.current, {
      modality: a.modality,
      studyName: a.study_name,
      seed: hashString(a.study_instance_uid || a.id),
      series: current,
      index: Math.min(slice, current.slices - 1),
    });
  }, [a, current, slice]);

  if (error) return <div className="min-h-screen bg-black p-6 text-red-400">{error}</div>;
  if (!a) return <div className="min-h-screen bg-black p-6 text-white/60">Cargando…</div>;
  if (a.pacs_status !== 'received') {
    return <div className="min-h-screen bg-black p-6 text-white/70">Este estudio todavía no tiene imágenes en el PACS.</div>;
  }

  const scroll = (e) => {
    e.preventDefault();
    setSlice((s) => Math.max(0, Math.min(current.slices - 1, s + (e.deltaY > 0 ? 1 : -1))));
  };
  // Arrastrar: horizontal = contraste, vertical = brillo (ventana/nivel).
  const onDown = (e) => (drag.current = { x: e.clientX, y: e.clientY, ...wl });
  const onMove = (e) => {
    if (!drag.current) return;
    const d = drag.current;
    setWl({ c: Math.max(30, Math.min(300, d.c + (e.clientX - d.x) * 0.5)), b: Math.max(30, Math.min(300, d.b - (e.clientY - d.y) * 0.5)) });
  };
  const report = data.report;

  return (
    <div className="flex min-h-screen bg-black text-[13px] text-white">
      {/* Series */}
      <aside className="w-44 shrink-0 space-y-2 border-r border-white/10 p-2">
        <div className="text-xs font-semibold text-white/60">SERIES</div>
        {series.map((sr, i) => (
          <button key={sr.name} onClick={() => setSerie(i)} className={`block w-full rounded border p-1 text-left ${i === serie ? 'border-sky-400 bg-sky-900/40' : 'border-white/10 hover:bg-white/5'}`}>
            <Thumb a={a} sr={sr} />
            <div className="mt-1 text-[11px] font-medium">{sr.name}</div>
            <div className="text-[10px] text-white/50">{sr.slices} imagen{sr.slices > 1 ? 'es' : ''}</div>
          </button>
        ))}
      </aside>

      {/* Imagen */}
      <main className="flex flex-1 flex-col items-center justify-center p-3">
        <div className="mb-2 flex gap-2 text-xs">
          <button className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => setInvert((v) => !v)}><Contrast size={14} /> Invertir</button>
          <button className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => { setWl({ b: 100, c: 100 }); setInvert(false); }}><RotateCcw size={14} /> Restablecer</button>
          <span className="self-center text-white/40">Rueda: cambiar corte · Arrastrar: brillo/contraste</span>
        </div>
        <div
          className="relative cursor-crosshair select-none"
          onWheel={scroll}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={() => (drag.current = null)}
          onMouseLeave={() => (drag.current = null)}
        >
          <canvas
            ref={canvas}
            width={SIZE}
            height={SIZE}
            className="block h-[min(78vh,78vw)] w-[min(78vh,78vw)] max-w-[720px] max-h-[720px]"
            style={{ filter: `brightness(${wl.b}%) contrast(${wl.c}%)${invert ? ' invert(1)' : ''}` }}
          />
          {/* Superposiciones */}
          <div className="pointer-events-none absolute inset-0 p-2 font-mono text-[11px] leading-tight text-amber-200 [text-shadow:0_0_3px_#000,0_0_2px_#000]">
            <div className="absolute top-2 left-2">
              {a.patient_last_name.toUpperCase()}^{a.patient_first_name.toUpperCase()}
              <br />ID {a.dni} · {a.patient_sex || '-'} · {a.patient_birth_date ? `${age(a.patient_birth_date)}a` : ''}
              <br />{a.study_name}
            </div>
            <div className="absolute top-2 right-2 text-right">
              {settings?.clinic_name}
              <br />ACC {a.accession_number}
              <br />{a.date.split('-').reverse().join('/')} · {a.ae_title || a.equipment_name}
            </div>
            <div className="absolute bottom-2 left-2">
              {current.name}
              <br />Im {Math.min(slice, current.slices - 1) + 1}/{current.slices}
            </div>
            <div className="absolute right-2 bottom-2 text-right text-red-300">
              IMAGEN FICTICIA · DEMO
              <br />W {Math.round(wl.c)} / L {Math.round(wl.b)}
            </div>
          </div>
        </div>
        {current.slices > 1 && (
          <input type="range" className="mt-3 w-[min(78vh,78vw)] max-w-[720px]" min={0} max={current.slices - 1} value={slice} onChange={(e) => setSlice(Number(e.target.value))} aria-label="Corte" />
        )}
      </main>

      {/* Datos del turno */}
      <aside className="w-80 shrink-0 space-y-3 overflow-y-auto border-l border-white/10 p-3">
        <div>
          <div className="text-base font-semibold">{a.patient_last_name}, {a.patient_first_name}</div>
          <div className="text-white/60">DNI {a.dni} · {a.insurance_name || 'Sin cobertura'}</div>
          <div className="text-white/60">{longDate(a.date)} · {a.start_time} · {a.equipment_name}</div>
          <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs ${STATUS[a.status].cls}`}>{STATUS[a.status].label}</span>
          <span className="ml-2 text-xs text-white/50">{a.image_count} imágenes en PACS</span>
        </div>
        <Block title="Indicación / derivante">{[a.clinical_indication, a.referring_physician].filter(Boolean).join(' · ')}</Block>
        <Block title="Notas del turno" tone="sky">{a.notes}</Block>
        <Block title="Observaciones del paciente" tone="amber">{a.patient_notes}</Block>
        <Block title={`Observaciones técnicas${a.technician_name ? ` (${a.technician_name})` : ''}`} tone="violet">{a.technician_notes}</Block>
        <Block title={report ? `Informe ${report.status === 'signed' ? `firmado por ${report.radiologist_name}` : '(borrador)'}` : 'Informe'} tone="emerald">
          {report ? (
            <>
              {report.findings && <p className="mb-1 whitespace-pre-wrap">{report.findings}</p>}
              {report.conclusion && <p className="font-semibold">{report.conclusion}</p>}
              {report.signed_at && <p className="mt-1 text-[11px] text-white/40">{formatDateTime(report.signed_at)}</p>}
            </>
          ) : null}
        </Block>
      </aside>
    </div>
  );
}

const TONES = { sky: 'border-sky-500', amber: 'border-amber-500', violet: 'border-violet-500', emerald: 'border-emerald-500' };

function Block({ title, tone, children }) {
  return (
    <div className={`border-l-2 pl-2 ${TONES[tone] || 'border-white/30'}`}>
      <div className="text-[11px] font-semibold tracking-wide text-white/50 uppercase">{title}</div>
      <div className="text-white/90">{children || <span className="text-white/30">—</span>}</div>
    </div>
  );
}

function Thumb({ a, sr }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      drawDemoImage(ref.current, { modality: a.modality, studyName: a.study_name, seed: hashString(a.study_instance_uid || a.id), series: sr, index: Math.floor(sr.slices / 2) });
    }
  }, [a, sr]);
  return <canvas ref={ref} width={160} height={160} className="w-full" />;
}
