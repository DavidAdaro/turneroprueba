import { ModalityTag, StatusBadge, Empty } from './ui';
import { minutesSince, patientName } from '../utils';

// Tabla de turnos usada en recepción, técnicos y entrega.
export default function WorkList({ rows, onOpen, showDate = false, showWait = false, actions }) {
  if (!rows?.length) return <Empty>No hay estudios en esta lista</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {showDate && <th className="th">Fecha</th>}
            <th className="th">Hora</th>
            <th className="th">Paciente</th>
            <th className="th">Estudio</th>
            <th className="th">Cobertura</th>
            <th className="th">N° acceso</th>
            <th className="th">Estado</th>
            {actions && <th className="th" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((a) => {
            const wait = showWait && a.status === 'arrived' ? minutesSince(a.arrived_at) : null;
            return (
              <tr key={a.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen(a.id)}>
                {showDate && <td className="td text-slate-500">{a.date.split('-').reverse().join('/')}</td>}
                <td className="td font-mono">
                  {a.start_time}
                  {a.overbook ? <span className="ml-1 text-[10px] text-orange-600">ST</span> : null}
                </td>
                <td className="td">
                  <div className="font-medium">{patientName(a)}</div>
                  <div className="text-xs text-slate-500">
                    DNI {a.dni}
                    {a.patient_notes && <span className="ml-1 text-amber-700">⚠ {a.patient_notes}</span>}
                  </div>
                </td>
                <td className="td">
                  <div className="flex items-center gap-1.5">
                    <ModalityTag modality={a.modality} /> {a.study_name}
                  </div>
                  <div className="text-xs text-slate-500">{a.equipment_name}</div>
                </td>
                <td className="td text-xs">
                  {a.insurance_name || 'Sin cobertura'}
                  {a.requires_authorization && !a.authorization_number ? <div className="text-amber-700">Falta autorización</div> : null}
                  {!a.order_received && ['given', 'confirmed'].includes(a.status) ? <div className="text-amber-700">Falta orden</div> : null}
                </td>
                <td className="td font-mono text-xs">{a.accession_number || '—'}</td>
                <td className="td">
                  <StatusBadge status={a.status} />
                  {wait !== null && (
                    <div className={`mt-0.5 text-xs ${wait > 30 ? 'font-medium text-red-600' : 'text-slate-500'}`}>espera {wait} min</div>
                  )}
                  {['completed', 'reported', 'delivered'].includes(a.status) && (
                    <div className={`mt-0.5 text-xs ${a.pacs_status === 'received' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      PACS {a.pacs_status === 'received' ? `✓ ${a.image_count} img` : 'pendiente'}
                    </div>
                  )}
                </td>
                {actions && (
                  <td className="td text-right" onClick={(e) => e.stopPropagation()}>
                    {actions(a)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
