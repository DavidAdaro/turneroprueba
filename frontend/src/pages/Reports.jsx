import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useData } from '../components/useData';
import { useCatalog } from '../components/useCatalogs';
import { Empty, ErrorMsg, ModalityTag, PageHeader } from '../components/ui';
import { formatDateTime, patientName } from '../utils';

// Lista de trabajo del médico informante.
export default function Reports() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('pending');
  const [modality, setModality] = useState('');
  const modalities = useCatalog('equipment')?.map((e) => e.modality) || [];
  const { data, error } = useData(() => api.reportWorklist(status, modality || undefined), [status, modality]);

  return (
    <div>
      <PageHeader title="Informes" subtitle="Estudios realizados para informar">
        <select className="input w-44" value={modality} onChange={(e) => setModality(e.target.value)}>
          <option value="">Todas las modalidades</option>
          {[...new Set(modalities)].map((m) => <option key={m}>{m}</option>)}
        </select>
        <div className="flex rounded-md border border-slate-300 bg-white p-0.5">
          {[['pending', 'Pendientes'], ['signed', 'Firmados']].map(([k, l]) => (
            <button key={k} onClick={() => setStatus(k)} className={`rounded px-3 py-1 text-sm ${status === k ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>{l}</button>
          ))}
        </div>
      </PageHeader>
      <ErrorMsg error={error} />
      <div className="card overflow-x-auto">
        {data?.length === 0 && <Empty>{status === 'pending' ? 'No hay estudios pendientes de informe 🎉' : 'Sin informes firmados'}</Empty>}
        {data?.length > 0 && (
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Realizado</th>
                <th className="th">Paciente</th>
                <th className="th">Estudio</th>
                <th className="th">N° acceso</th>
                <th className="th">Derivante / indicación</th>
                <th className="th">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((a) => (
                <tr key={a.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/informes/${a.id}`)}>
                  <td className="td text-xs text-slate-500">{formatDateTime(a.completed_at)}</td>
                  <td className="td font-medium">{patientName(a)}</td>
                  <td className="td"><div className="flex items-center gap-1.5"><ModalityTag modality={a.modality} /> {a.study_name}</div></td>
                  <td className="td font-mono text-xs">{a.accession_number}</td>
                  <td className="td text-xs text-slate-600">{a.referring_physician || '—'}<div>{a.clinical_indication}</div></td>
                  <td className="td text-xs">{a.report_status === 'signed' ? '✓ Firmado' : a.report_status === 'draft' ? 'Borrador' : 'Sin informe'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
