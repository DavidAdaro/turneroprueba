import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, Pencil } from 'lucide-react';
import RebookModal from '../components/RebookModal';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useData } from '../components/useData';
import { useCatalog } from '../components/useCatalogs';
import PatientForm from '../components/PatientForm';
import AppointmentModal from '../components/AppointmentModal';
import { Alert, Empty, ErrorMsg, Modal, ModalityTag, StatusBadge } from '../components/ui';
import { age } from '../utils';

// Ficha del paciente: datos y todos sus estudios.
export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const insurances = useCatalog('insurances') || [];
  const { data: p, error, reload } = useData(() => api.getPatient(id), [id]);
  const [editing, setEditing] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [rebook, setRebook] = useState(false);

  if (error) return <ErrorMsg error={error} />;
  if (!p) return <p className="text-sm text-slate-500">Cargando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button className="btn-secondary px-2" onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
        <h1 className="text-xl font-semibold">{p.last_name}, {p.first_name}</h1>
        {['admin', 'reception'].includes(user.role) && (
          <button className="btn-primary ml-auto" onClick={() => setRebook(true)}><CalendarPlus size={14} /> Nuevo turno</button>
        )}
        {user.role !== 'radiologist' && (
          <button className={`btn-secondary ${['admin', 'reception'].includes(user.role) ? '' : 'ml-auto'}`} onClick={() => setEditing(true)}><Pencil size={14} /> Editar</button>
        )}
      </div>
      <div className="card grid gap-x-6 gap-y-1 p-4 text-sm sm:grid-cols-3">
        <div><span className="text-slate-500">DNI:</span> {p.dni}</div>
        <div><span className="text-slate-500">Nacimiento:</span> {p.birth_date ? `${p.birth_date.split('-').reverse().join('/')} (${age(p.birth_date)} años)` : '—'}</div>
        <div><span className="text-slate-500">Sexo:</span> {p.sex || '—'}</div>
        <div><span className="text-slate-500">Cobertura:</span> {p.insurance_name || 'Sin cobertura'} {p.insurance_plan}</div>
        <div><span className="text-slate-500">Afiliado:</span> {p.affiliate_number || '—'}</div>
        <div><span className="text-slate-500">Peso:</span> {p.weight_kg ? `${p.weight_kg} kg` : '—'}</div>
        <div><span className="text-slate-500">Teléfono:</span> {p.phone || '—'}</div>
        <div className="sm:col-span-2"><span className="text-slate-500">Email:</span> {p.email || '—'}</div>
        {p.notes && <div className="pt-2 sm:col-span-3"><Alert>⚠ {p.notes}</Alert></div>}
      </div>
      <div className="flex gap-3 text-sm">
        {[['Turnos', p.stats.total], ['Realizados', p.stats.done], ['Ausentes', p.stats.absent], ['Cancelados', p.stats.cancelled]].map(([l, n]) => (
          <div key={l} className="card px-4 py-2"><div className="text-lg font-semibold">{n}</div><div className="text-xs text-slate-500">{l}</div></div>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">Estudios</div>
        {p.appointments.length === 0 && <Empty>Sin turnos</Empty>}
        {p.appointments.length > 0 && (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr><th className="th">Fecha</th><th className="th">Estudio</th><th className="th">Equipo</th><th className="th">N° acceso</th><th className="th">Estado</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {p.appointments.map((a) => (
                <tr key={a.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenId(a.id)}>
                  <td className="td">{a.date.split('-').reverse().join('/')} {a.start_time}</td>
                  <td className="td"><div className="flex items-center gap-1.5"><ModalityTag modality={a.modality} /> {a.study_name}</div></td>
                  <td className="td text-slate-600">{a.equipment_name}</td>
                  <td className="td font-mono text-xs">{a.accession_number || '—'}</td>
                  <td className="td"><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing && (
        <Modal title="Editar paciente" onClose={() => setEditing(false)} wide>
          <PatientForm patient={p} insurances={insurances} onSaved={() => { setEditing(false); reload(); }} onCancel={() => setEditing(false)} />
        </Modal>
      )}
      {rebook && (
        <RebookModal
          patient={p}
          defaults={{ equipment_id: p.appointments[0]?.equipment_id }}
          onClose={() => setRebook(false)}
          onBooked={(n) => {
            setRebook(false);
            reload();
            setOpenId(n.id);
          }}
        />
      )}
      {openId && <AppointmentModal id={openId} onClose={() => setOpenId(null)} onChanged={reload} />}
    </div>
  );
}
