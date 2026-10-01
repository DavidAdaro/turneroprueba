import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Printer } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useData } from '../components/useData';
import { useCatalog } from '../components/useCatalogs';
import { Alert, ErrorMsg, Field, ModalityTag, StatusBadge } from '../components/ui';
import { age, formatDateTime, longDate, patientName, viewerUrl } from '../utils';

export default function ReportEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const settings = useCatalog('settings');
  const { data, error: loadError, reload } = useData(() => api.getReport(id), [id]);
  const [form, setForm] = useState({ technique: '', findings: '', conclusion: '' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    const r = data.report;
    setForm({
      technique: r?.technique ?? `${data.appointment.study_name}${data.appointment.study_contrast ? ', con contraste endovenoso' : ''}.`,
      findings: r?.findings ?? '',
      conclusion: r?.conclusion ?? '',
    });
  }, [data]);

  if (loadError) return <ErrorMsg error={loadError} />;
  if (!data) return <p className="text-sm text-slate-500">Cargando…</p>;
  const { appointment: a, report, priors } = data;
  const signed = report?.status === 'signed';
  const editable = user.role === 'radiologist' && !signed && a.status === 'completed';
  const viewer = viewerUrl(settings?.viewer_url_template, a);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api.saveReport(id, form);
      setMsg('Borrador guardado');
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sign = async () => {
    if (!confirm('¿Firmar el informe? Después no se puede modificar.')) return;
    setBusy(true);
    setError('');
    try {
      await api.saveReport(id, form);
      await api.signReport(id);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button className="btn-secondary px-2" onClick={() => navigate('/informes')}><ArrowLeft size={16} /></button>
          <h1 className="text-xl font-semibold">Informe · {a.study_name}</h1>
          <StatusBadge status={a.status} />
        </div>

        <div className="card space-y-1 p-4 text-sm">
          <div className="text-base font-semibold">{patientName(a)}</div>
          <div className="text-slate-600">
            DNI {a.dni} {a.patient_birth_date && `· ${age(a.patient_birth_date)} años`} {a.patient_sex && `· ${a.patient_sex}`} · {a.insurance_name || 'Sin cobertura'}
          </div>
          <div className="text-slate-600">
            <ModalityTag modality={a.modality} /> {a.equipment_name} · {longDate(a.date)} · N° acceso <b className="font-mono">{a.accession_number}</b>
          </div>
          <div className="text-slate-600">Derivante: {a.referring_physician || '—'} · Indicación: {a.clinical_indication || '—'}</div>
          {a.technician_notes && <div className="text-slate-600">Obs. técnica ({a.technician_name}): {a.technician_notes}</div>}
          {a.patient_notes && <Alert>⚠ {a.patient_notes}</Alert>}
          <div className="pt-1">
            {a.pacs_status === 'received' ? (
              viewer ? (
                <a href={viewer} target="_blank" rel="noreferrer" className="btn-primary"><ExternalLink size={15} /> Abrir imágenes ({a.image_count})</a>
              ) : (
                <span className="text-xs text-slate-500">PACS: {a.image_count} imágenes recibidas · configurá la URL del visor en Configuración → Centro</span>
              )
            ) : (
              <span className="text-xs text-amber-700">Las imágenes todavía no llegaron al PACS</span>
            )}
          </div>
        </div>

        <div className="card space-y-3 p-4">
          <Field label="Técnica">
            <textarea className="input" rows={2} value={form.technique} onChange={set('technique')} disabled={!editable} />
          </Field>
          <Field label="Hallazgos *">
            <textarea className="input font-[inherit]" rows={10} value={form.findings} onChange={set('findings')} disabled={!editable} />
          </Field>
          <Field label="Conclusión *">
            <textarea className="input" rows={3} value={form.conclusion} onChange={set('conclusion')} disabled={!editable} />
          </Field>
          <ErrorMsg error={error} />
          <div className="flex items-center justify-end gap-2">
            {msg && <span className="text-sm text-emerald-700">{msg}</span>}
            {signed && (
              <>
                <span className="text-sm text-emerald-700">
                  Firmado por {report.radiologist_name} {report.radiologist_license && `(${report.radiologist_license})`} · {formatDateTime(report.signed_at)}
                </span>
                <Link to={`/informe/${a.id}/imprimir`} target="_blank" className="btn-secondary"><Printer size={15} /> Imprimir</Link>
              </>
            )}
            {editable && (
              <>
                <button className="btn-secondary" disabled={busy} onClick={save}>Guardar borrador</button>
                <button className="btn-success" disabled={busy} onClick={sign}>Firmar informe</button>
              </>
            )}
            {!editable && !signed && <span className="text-sm text-slate-500">Solo un médico informante puede redactar el informe.</span>}
          </div>
        </div>
      </div>

      <aside className="card h-fit p-3">
        <div className="mb-2 text-sm font-semibold">Estudios previos del paciente</div>
        {priors.length === 0 && <p className="text-xs text-slate-400">Sin estudios previos</p>}
        <ul className="space-y-2">
          {priors.map((p) => (
            <li key={p.id} className="rounded border border-slate-200 p-2 text-xs">
              <div className="flex items-center gap-1.5 font-medium">
                <ModalityTag modality={p.modality} /> {p.study_name}
              </div>
              <div className="text-slate-500">{p.date.split('-').reverse().join('/')} · {p.accession_number}</div>
              {p.conclusion && <div className="mt-1 text-slate-700">{p.conclusion}</div>}
              {p.report_status === 'signed' && (
                <Link to={`/informe/${p.id}/imprimir`} target="_blank" className="text-blue-700 hover:underline">Ver informe</Link>
              )}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
