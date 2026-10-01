import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { api } from '../api';
import { useData } from '../components/useData';
import { useCatalog } from '../components/useCatalogs';
import { ErrorMsg } from '../components/ui';
import { age, formatDateTime, longDate } from '../utils';

// Informe en formato imprimible (A4).
export default function ReportPrint() {
  const { id } = useParams();
  const settings = useCatalog('settings');
  const { data, error } = useData(() => api.getReport(id), [id]);
  if (error) return <div className="p-6"><ErrorMsg error={error} /></div>;
  if (!data) return <p className="p-6 text-sm text-slate-500">Cargando…</p>;
  const { appointment: a, report } = data;
  if (report?.status !== 'signed') return <div className="p-6"><ErrorMsg error="El informe todavía no está firmado" /></div>;

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-3 flex max-w-[210mm] justify-end">
        <button className="btn-primary" onClick={() => window.print()}><Printer size={15} /> Imprimir</button>
      </div>
      <article className="mx-auto min-h-[297mm] max-w-[210mm] bg-white p-[18mm] text-[13px] leading-relaxed text-slate-900 shadow print:shadow-none">
        <header className="mb-6 flex items-start justify-between border-b-2 border-slate-800 pb-3">
          <div>
            <div className="text-lg font-bold">{settings?.clinic_name}</div>
            <div className="text-xs text-slate-600">{settings?.clinic_address}</div>
            <div className="text-xs text-slate-600">{settings?.clinic_phone}</div>
          </div>
          <div className="text-right text-xs">
            <div>N° de acceso: <b className="font-mono">{a.accession_number}</b></div>
            <div>{longDate(a.date)}</div>
          </div>
        </header>

        <table className="mb-6 w-full text-sm">
          <tbody>
            <tr>
              <td className="w-1/2 py-0.5"><b>Paciente:</b> {a.patient_last_name}, {a.patient_first_name}</td>
              <td className="py-0.5"><b>DNI:</b> {a.dni}{a.patient_birth_date && ` · ${age(a.patient_birth_date)} años`}</td>
            </tr>
            <tr>
              <td className="py-0.5"><b>Cobertura:</b> {a.insurance_name || 'Particular'} {a.affiliate_number && `(${a.affiliate_number})`}</td>
              <td className="py-0.5"><b>Médico derivante:</b> {a.referring_physician || '—'}</td>
            </tr>
          </tbody>
        </table>

        <h1 className="mb-4 text-center text-base font-bold uppercase tracking-wide">{a.study_name}</h1>

        {report.technique && (
          <section className="mb-4">
            <h2 className="font-bold">Técnica</h2>
            <p className="whitespace-pre-wrap">{report.technique}</p>
          </section>
        )}
        <section className="mb-4">
          <h2 className="font-bold">Hallazgos</h2>
          <p className="whitespace-pre-wrap">{report.findings}</p>
        </section>
        <section className="mb-10">
          <h2 className="font-bold">Conclusión</h2>
          <p className="whitespace-pre-wrap font-medium">{report.conclusion}</p>
        </section>

        <div className="ml-auto w-64 border-t border-slate-800 pt-1 text-center text-xs">
          <div className="font-semibold">{report.radiologist_name}</div>
          {report.radiologist_license && <div>{report.radiologist_license}</div>}
          <div className="text-slate-500">Firmado electrónicamente el {formatDateTime(report.signed_at)}</div>
        </div>
        {settings?.report_footer && <footer className="mt-10 border-t border-slate-300 pt-2 text-center text-[11px] text-slate-500">{settings.report_footer}</footer>}
      </article>
    </div>
  );
}
