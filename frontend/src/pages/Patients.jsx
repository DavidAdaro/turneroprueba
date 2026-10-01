import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../components/useCatalogs';
import PatientForm from '../components/PatientForm';
import { Empty, Modal, PageHeader } from '../components/ui';
import { age } from '../utils';

export default function Patients() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const insurances = useCatalog('insurances') || [];
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => api.searchPatients(q).then(setRows).catch(() => setRows([])), 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <PageHeader title="Pacientes">
        <div className="relative">
          <Search size={15} className="absolute top-2 left-2.5 text-slate-400" />
          <input className="input w-72 pl-8" placeholder="DNI o apellido" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        {user.role !== 'radiologist' && (
          <button className="btn-primary" onClick={() => setCreating(true)}><UserPlus size={15} /> Nuevo paciente</button>
        )}
      </PageHeader>
      <div className="card overflow-x-auto">
        {rows?.length === 0 && <Empty>Sin resultados</Empty>}
        {rows?.length > 0 && (
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Paciente</th>
                <th className="th">DNI</th>
                <th className="th">Edad</th>
                <th className="th">Cobertura</th>
                <th className="th">Teléfono</th>
                <th className="th">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/pacientes/${p.id}`)}>
                  <td className="td font-medium">{p.last_name}, {p.first_name}</td>
                  <td className="td">{p.dni}</td>
                  <td className="td">{age(p.birth_date) ?? '—'}</td>
                  <td className="td">{p.insurance_name || 'Sin cobertura'}</td>
                  <td className="td">{p.phone || '—'}</td>
                  <td className="td text-xs text-amber-700">{p.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {creating && (
        <Modal title="Nuevo paciente" onClose={() => setCreating(false)} wide>
          <PatientForm insurances={insurances} onSaved={(p) => navigate(`/pacientes/${p.id}`)} onCancel={() => setCreating(false)} />
        </Modal>
      )}
    </div>
  );
}
