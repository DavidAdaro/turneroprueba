import { useMemo, useState } from 'react';
import { api } from '../api';
import { useCatalog } from './useCatalogs';
import PatientPicker from './PatientPicker';
import { Alert, ErrorMsg, Field, Modal } from './ui';
import { longDate } from '../utils';

// Dar un turno en un equipo/horario. El estudio se filtra por la modalidad
// del equipo y define la duración.
export default function BookModal({ equipment, date, startTime, overbook: initialOverbook = false, onClose, onBooked }) {
  const insurances = useCatalog('insurances') || [];
  const studies = useCatalog('studies') || [];
  const options = useMemo(() => studies.filter((s) => s.active && s.modality === equipment.modality), [studies, equipment]);
  const [patient, setPatient] = useState(null);
  const [form, setForm] = useState({
    study_id: '',
    start_time: startTime,
    insurance_id: '',
    referring_physician: '',
    clinical_indication: '',
    order_received: false,
    notes: '',
    overbook: initialOverbook,
    care_type: 'AMB',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const study = options.find((s) => String(s.id) === String(form.study_id));

  const choosePatient = (p) => {
    setPatient(p);
    setForm((f) => ({ ...f, insurance_id: p?.insurance_id ?? '' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!patient) return setError('Elegí o cargá un paciente');
    setBusy(true);
    setError('');
    try {
      const created = await api.createAppointment({
        ...form,
        equipment_id: equipment.id,
        patient_id: patient.id,
        date,
        insurance_id: form.insurance_id || null,
      });
      onBooked(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const mrRisk = equipment.modality === 'MR' && /marcapaso|implante|clip/i.test(patient?.notes || '');

  return (
    <Modal title={`Nuevo turno · ${equipment.name}`} onClose={onClose} wide>
      <p className="mb-3 text-sm text-slate-600">{longDate(date)}</p>
      <div className="space-y-4">
        <PatientPicker insurances={insurances} value={patient} onChange={choosePatient} />
        {mrRisk && <Alert>Atención: el paciente tiene observaciones que pueden contraindicar la resonancia. Verificalo antes de dar el turno.</Alert>}
        {patient && (
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Estudio *" className="sm:col-span-2">
                <select className="input" value={form.study_id} onChange={set('study_id')} required>
                  <option value="">Elegí un estudio…</option>
                  {options.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes} min){s.contrast ? ' · contraste' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Hora">
                <input type="time" className="input" value={form.start_time} onChange={set('start_time')} required />
              </Field>
              <Field label="Cobertura">
                <select className="input" value={form.insurance_id} onChange={set('insurance_id')}>
                  <option value="">Sin cobertura</option>
                  {insurances.filter((i) => i.active).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                      {i.requires_authorization ? ' (requiere autorización)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tipo de atención">
                <select className="input" value={form.care_type} onChange={set('care_type')}>
                  <option value="AMB">Ambulatorio</option>
                  <option value="INT">Internado</option>
                  <option value="GUA">Guardia</option>
                </select>
              </Field>
              <Field label="Médico derivante">
                <input className="input" value={form.referring_physician} onChange={set('referring_physician')} />
              </Field>
              <Field label="Indicación">
                <input className="input" value={form.clinical_indication} onChange={set('clinical_indication')} />
              </Field>
            </div>
            {study?.preparation && (
              <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <b>Preparación a informar:</b> {study.preparation}
              </div>
            )}
            <Field label="Notas internas">
              <input className="input" value={form.notes} onChange={set('notes')} />
            </Field>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.order_received} onChange={set('order_received')} /> Ya presentó la orden médica
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.overbook} onChange={set('overbook')} /> Sobreturno
              </label>
            </div>
            <ErrorMsg error={error} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
              <button className="btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Dar turno'}</button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
