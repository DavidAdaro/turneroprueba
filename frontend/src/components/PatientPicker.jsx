import { useEffect, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { api } from '../api';
import PatientForm from './PatientForm';
import { age } from '../utils';

// Buscar paciente por DNI/apellido o darlo de alta en el momento.
export default function PatientPicker({ insurances, value, onChange }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => api.searchPatients(q).then(setResults).catch(() => setResults([])), 250);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div className="flex items-start justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
        <div>
          <div className="font-medium">
            {value.last_name}, {value.first_name}
          </div>
          <div className="text-xs text-slate-600">
            DNI {value.dni}
            {value.birth_date && ` · ${age(value.birth_date)} años`} · {value.insurance_name || 'Sin cobertura'}
          </div>
          {value.notes && <div className="mt-1 text-xs font-medium text-amber-700">⚠ {value.notes}</div>}
        </div>
        <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => onChange(null)}>
          Cambiar
        </button>
      </div>
    );
  }

  if (creating) {
    const digits = q.replace(/\D/g, '');
    return (
      <div className="rounded-md border border-slate-200 p-3">
        <div className="mb-2 text-sm font-medium">Nuevo paciente</div>
        <PatientForm
          insurances={insurances}
          initial={digits.length >= 6 ? { dni: digits } : { last_name: q }}
          onSaved={(p) => {
            setCreating(false);
            onChange(p);
          }}
          onCancel={() => setCreating(false)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute top-2 left-2.5 text-slate-400" />
          <input className="input pl-8" placeholder="Buscar por DNI o apellido…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <button type="button" className="btn-secondary" onClick={() => setCreating(true)}>
          <UserPlus size={16} /> Nuevo
        </button>
      </div>
      {results.length > 0 && (
        <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-200">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50"
                onClick={() => onChange(p)}
              >
                <span className="font-medium">
                  {p.last_name}, {p.first_name}
                </span>{' '}
                <span className="text-slate-500">
                  · DNI {p.dni} · {p.insurance_name || 'Sin cobertura'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && results.length === 0 && (
        <p className="mt-1 text-xs text-slate-500">Sin resultados. Podés darlo de alta con “Nuevo”.</p>
      )}
    </div>
  );
}
