import { useState } from 'react';
import { api } from '../api';
import { ErrorMsg, Field } from './ui';

const EMPTY = {
  dni: '',
  first_name: '',
  last_name: '',
  birth_date: '',
  sex: '',
  phone: '',
  email: '',
  insurance_id: '',
  insurance_plan: '',
  affiliate_number: '',
  weight_kg: '',
  notes: '',
};

export default function PatientForm({ patient, insurances, initial = {}, onSaved, onCancel }) {
  const [form, setForm] = useState(() => {
    const base = { ...EMPTY, ...initial, ...(patient || {}) };
    return Object.fromEntries(Object.keys(EMPTY).map((k) => [k, base[k] ?? '']));
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = patient ? await api.updatePatient(patient.id, form) : await api.createPatient(form);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="DNI *">
          <input className="input" value={form.dni} onChange={set('dni')} required autoFocus={!patient} />
        </Field>
        <Field label="Apellido *">
          <input className="input" value={form.last_name} onChange={set('last_name')} required />
        </Field>
        <Field label="Nombre *">
          <input className="input" value={form.first_name} onChange={set('first_name')} required />
        </Field>
        <Field label="Fecha de nacimiento">
          <input type="date" className="input" value={form.birth_date} onChange={set('birth_date')} />
        </Field>
        <Field label="Sexo">
          <select className="input" value={form.sex} onChange={set('sex')}>
            <option value="">—</option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
            <option value="O">Otro</option>
          </select>
        </Field>
        <Field label="Peso (kg)">
          <input type="number" className="input" value={form.weight_kg} onChange={set('weight_kg')} min="0" step="0.1" />
        </Field>
        <Field label="Celular (con código de país)">
          <input className="input" value={form.phone} onChange={set('phone')} placeholder="549351..." />
        </Field>
        <Field label="Email" className="sm:col-span-2">
          <input type="email" className="input" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Obra social">
          <select className="input" value={form.insurance_id} onChange={set('insurance_id')}>
            <option value="">Sin cobertura</option>
            {insurances.filter((i) => i.active).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Plan">
          <input className="input" value={form.insurance_plan} onChange={set('insurance_plan')} />
        </Field>
        <Field label="N° de afiliado">
          <input className="input" value={form.affiliate_number} onChange={set('affiliate_number')} />
        </Field>
      </div>
      <Field label="Observaciones clínicas (alergias, marcapasos, claustrofobia, embarazo...)">
        <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} />
      </Field>
      <ErrorMsg error={error} />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button className="btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar paciente'}
        </button>
      </div>
    </form>
  );
}
