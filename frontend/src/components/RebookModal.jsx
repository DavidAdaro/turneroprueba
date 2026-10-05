import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useCatalog } from './useCatalogs';
import { Alert, ErrorMsg, Field, Modal } from './ui';
import { formatDate, today } from '../utils';

// Dar un turno nuevo a un paciente ya conocido (por ejemplo, alguien que ya
// se hizo un estudio): se elige equipo, estudio y uno de los próximos
// horarios libres, o un horario manual como sobreturno.
export default function RebookModal({ patient, defaults = {}, onClose, onBooked }) {
  const equipment = (useCatalog('equipment') || []).filter((e) => e.active);
  const studies = useCatalog('studies') || [];
  const insurances = useCatalog('insurances') || [];
  const [form, setForm] = useState({
    equipment_id: defaults.equipment_id ? String(defaults.equipment_id) : '',
    study_id: defaults.study_id ? String(defaults.study_id) : '',
    date: today(),
    insurance_id: patient.insurance_id ?? '',
    care_type: 'AMB',
    referring_physician: defaults.referring_physician || '',
    clinical_indication: defaults.clinical_indication || '',
    notes: '',
    order_received: false,
  });
  const [slot, setSlot] = useState(null);
  const [manual, setManual] = useState('');
  const [free, setFree] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const eq = equipment.find((e) => String(e.id) === form.equipment_id);
  const options = useMemo(() => studies.filter((s) => s.active && eq && s.modality === eq.modality), [studies, eq]);
  const study = options.find((s) => String(s.id) === form.study_id);

  // Si cambia el equipo y el estudio ya no corresponde, se limpia.
  useEffect(() => {
    if (form.study_id && !options.some((s) => String(s.id) === form.study_id)) setForm((f) => ({ ...f, study_id: '' }));
  }, [options, form.study_id]);

  useEffect(() => {
    setSlot(null);
    setFree(null);
    if (!form.equipment_id) return;
    let alive = true;
    api
      .nextFree(form.equipment_id, form.date)
      .then((list) => alive && setFree(list))
      .catch(() => alive && setFree([]));
    return () => {
      alive = false;
    };
  }, [form.equipment_id, form.date]);

  const submit = async (e) => {
    e.preventDefault();
    const when = manual ? { date: form.date, start_time: manual, overbook: true } : slot;
    if (!when) return setError('Elegí un horario libre o cargá uno manual como sobreturno');
    setBusy(true);
    setError('');
    try {
      const created = await api.createAppointment({
        ...form,
        ...when,
        patient_id: patient.id,
        insurance_id: form.insurance_id || null,
      });
      onBooked(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const mrRisk = eq?.modality === 'MR' && /NO compatible con RM|marcapasos \(no/i.test(patient.notes || '');

  return (
    <Modal title={`Nuevo turno · ${patient.last_name}, ${patient.first_name}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-600">
          DNI {patient.dni}
          {patient.notes && <span className="ml-2 font-medium text-amber-700">⚠ {patient.notes}</span>}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Equipo *">
            <select className="input" value={form.equipment_id} onChange={set('equipment_id')} required>
              <option value="">Elegí un equipo…</option>
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>{e.modality} · {e.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Estudio *" className="sm:col-span-2">
            <select className="input" value={form.study_id} onChange={set('study_id')} required disabled={!eq}>
              <option value="">{eq ? 'Elegí un estudio…' : 'Primero elegí el equipo'}</option>
              {options.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min){s.contrast ? ' · contraste' : ''}</option>
              ))}
            </select>
          </Field>
        </div>
        {mrRisk && <Alert>El paciente tiene marcapasos no compatible con resonancia. Revisá la indicación antes de dar el turno.</Alert>}
        {study?.preparation && (
          <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900"><b>Preparación:</b> {study.preparation}</div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Desde el día">
            <input type="date" className="input" min={today()} value={form.date} onChange={(e) => e.target.value && set('date')(e)} />
          </Field>
          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-medium text-slate-600">Próximos horarios libres</div>
            <div className="flex flex-wrap gap-1">
              {!form.equipment_id && <span className="text-xs text-slate-400">Elegí un equipo</span>}
              {form.equipment_id && free === null && <span className="text-xs text-slate-400">Buscando…</span>}
              {free?.length === 0 && <span className="text-xs text-slate-400">Sin horarios libres en 60 días</span>}
              {free?.map((s) => {
                const sel = !manual && slot?.date === s.date && slot?.start_time === s.start_time;
                return (
                  <button
                    type="button"
                    key={s.date + s.start_time}
                    onClick={() => {
                      setManual('');
                      setSlot({ date: s.date, start_time: s.start_time });
                    }}
                    className={`rounded border px-2 py-0.5 text-xs ${sel ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-300 bg-white hover:bg-blue-50'}`}
                  >
                    {formatDate(s.date, { weekday: 'short', day: '2-digit', month: '2-digit' })} {s.start_time}
                  </button>
                );
              })}
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
              O sobreturno el {formatDate(form.date, { day: '2-digit', month: '2-digit' })} a las
              <input type="time" className="input w-28 py-0.5" value={manual} onChange={(e) => { setManual(e.target.value); setSlot(null); }} />
            </label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Cobertura">
            <select className="input" value={form.insurance_id} onChange={set('insurance_id')}>
              <option value="">Sin cobertura</option>
              {insurances.filter((i) => i.active).map((i) => (
                <option key={i.id} value={i.id}>{i.name}{i.requires_authorization ? ' (requiere autorización)' : ''}</option>
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
          <Field label="Indicación" className="sm:col-span-3">
            <input className="input" value={form.clinical_indication} onChange={set('clinical_indication')} />
          </Field>
          <Field label="Notas del turno" className="sm:col-span-3">
            <input className="input" value={form.notes} onChange={set('notes')} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.order_received} onChange={set('order_received')} /> Ya presentó la orden médica
        </label>
        <ErrorMsg error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Dar turno'}</button>
        </div>
      </form>
    </Modal>
  );
}
