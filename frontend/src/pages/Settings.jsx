import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useData } from '../components/useData';
import { invalidateCatalogs } from '../components/useCatalogs';
import { ErrorMsg, Field, Modal, ModalityTag, PageHeader } from '../components/ui';
import { ROLE_LABELS, WEEKDAYS, formatDateTime, money, today } from '../utils';

const TABS = [
  ['equipment', 'Equipos y horarios'],
  ['studies', 'Estudios y valores'],
  ['insurances', 'Obras sociales'],
  ['blocks', 'Bloqueos de agenda'],
  ['users', 'Usuarios'],
  ['apikeys', 'API keys'],
  ['clinic', 'Centro e integración'],
];

export default function Settings() {
  const [tab, setTab] = useState('equipment');
  return (
    <div>
      <PageHeader title="Configuración" />
      <div className="mb-4 flex flex-wrap gap-1">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-sm ${tab === k ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>{l}</button>
        ))}
      </div>
      {tab === 'equipment' && <EquipmentTab />}
      {tab === 'studies' && <StudiesTab />}
      {tab === 'insurances' && <InsurancesTab />}
      {tab === 'blocks' && <BlocksTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'apikeys' && <ApiKeysTab />}
      {tab === 'clinic' && <ClinicTab />}
    </div>
  );
}

// Guarda, invalida catálogos cacheados y recarga.
function useSaver(reload) {
  const [error, setError] = useState('');
  const save = async (fn) => {
    setError('');
    try {
      const r = await fn();
      invalidateCatalogs();
      await reload();
      return r ?? true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };
  return { error, setError, save };
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

// ---------- Equipos ----------
function EquipmentTab() {
  const { data, reload } = useData(() => Promise.all([api.getEquipment(), api.getModalities()]), []);
  const { error, save } = useSaver(reload);
  const [editing, setEditing] = useState(null);
  if (!data) return null;
  const [equipment, modalities] = data;

  return (
    <div className="space-y-3">
      <ErrorMsg error={error} />
      <button className="btn-primary" onClick={() => setEditing({ name: '', modality: 'MR', ae_title: '', location: '', color: '#2563eb' })}><Plus size={15} /> Nuevo equipo</button>
      {equipment.map((e) => (
        <div key={e.id} className={`card p-3 ${e.active ? '' : 'opacity-60'}`} style={{ borderLeft: `4px solid ${e.color}` }}>
          <div className="flex flex-wrap items-center gap-2">
            <ModalityTag modality={e.modality} />
            <b>{e.name}</b>
            <span className="text-sm text-slate-500">{e.location} · AE Title: <span className="font-mono">{e.ae_title || '—'}</span></span>
            <div className="ml-auto flex gap-2">
              <button className="btn-secondary px-2 py-1 text-xs" onClick={() => setEditing(e)}>Editar</button>
              <button className="btn-secondary px-2 py-1 text-xs" onClick={() => save(() => api.updateEquipment(e.id, { active: !e.active }))}>{e.active ? 'Desactivar' : 'Activar'}</button>
            </div>
          </div>
          <Schedules equipment={e} save={save} />
        </div>
      ))}
      {editing && (
        <Modal title={editing.id ? 'Editar equipo' : 'Nuevo equipo'} onClose={() => setEditing(null)}>
          <EquipmentForm initial={editing} modalities={modalities} onSubmit={async (form) => {
            const ok = await save(() => (editing.id ? api.updateEquipment(editing.id, form) : api.createEquipment(form)));
            if (ok) setEditing(null);
          }} />
          <ErrorMsg error={error} />
        </Modal>
      )}
    </div>
  );
}

function EquipmentForm({ initial, modalities, onSubmit }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <Field label="Nombre *"><input className="input" value={f.name} onChange={set('name')} required /></Field>
      <Field label="Modalidad *">
        <select className="input" value={f.modality} onChange={set('modality')}>
          {Object.entries(modalities).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
        </select>
      </Field>
      <Field label="AE Title (DICOM)"><input className="input font-mono" value={f.ae_title || ''} onChange={set('ae_title')} maxLength={16} /></Field>
      <Field label="Ubicación"><input className="input" value={f.location || ''} onChange={set('location')} /></Field>
      <Field label="Color"><input type="color" className="h-9 w-20" value={f.color} onChange={set('color')} /></Field>
      <div className="flex items-end justify-end sm:col-span-2"><button className="btn-primary">Guardar</button></div>
    </form>
  );
}

function Schedules({ equipment, save }) {
  const [f, setF] = useState({ weekday: 1, start_time: '08:00', end_time: '12:00', slot_minutes: 20 });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1">
        {equipment.schedules.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs">
            {WEEKDAYS[s.weekday].slice(0, 3)} {s.start_time}–{s.end_time} · {s.slot_minutes}′
            <button className="text-slate-400 hover:text-red-600" onClick={() => save(() => api.deleteSchedule(equipment.id, s.id))} aria-label="Quitar franja"><Trash2 size={12} /></button>
          </span>
        ))}
        {equipment.schedules.length === 0 && <span className="text-xs text-slate-400">Sin horarios: no se pueden dar turnos</span>}
      </div>
      <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); save(() => api.addSchedule(equipment.id, f)); }}>
        <select className="input w-32" value={f.weekday} onChange={set('weekday')}>{WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}</select>
        <input type="time" className="input w-28" value={f.start_time} onChange={set('start_time')} />
        <input type="time" className="input w-28" value={f.end_time} onChange={set('end_time')} />
        <label className="flex items-center gap-1 text-xs text-slate-600">Turno cada <input type="number" className="input w-16" value={f.slot_minutes} onChange={set('slot_minutes')} min={5} max={240} /> min</label>
        <button className="btn-secondary px-2 py-1 text-xs"><Plus size={13} /> Franja</button>
      </form>
    </div>
  );
}

// ---------- Estudios ----------
function StudiesTab() {
  const { data, reload } = useData(() => Promise.all([api.getStudies(), api.getModalities(), api.getInsurances()]), []);
  const { error, save } = useSaver(reload);
  const [editing, setEditing] = useState(null);
  const [pricing, setPricing] = useState(null);
  if (!data) return null;
  const [studies, modalities, insurances] = data;

  return (
    <div className="space-y-3">
      <ErrorMsg error={error} />
      <button className="btn-primary" onClick={() => setEditing({ code: '', name: '', modality: 'MR', duration_minutes: 20, contrast: false, preparation: '', private_price: 0 })}><Plus size={15} /> Nuevo estudio</button>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50"><tr><th className="th">Mod.</th><th className="th">Código</th><th className="th">Estudio</th><th className="th">Duración</th><th className="th">Particular</th><th className="th">Valores OS</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {studies.map((s) => (
              <tr key={s.id} className={s.active ? '' : 'opacity-50'}>
                <td className="td"><ModalityTag modality={s.modality} /></td>
                <td className="td font-mono text-xs">{s.code}</td>
                <td className="td">{s.name}{s.contrast ? <span className="ml-1 text-xs text-purple-700">contraste</span> : null}{s.preparation && <div className="text-xs text-slate-500">{s.preparation}</div>}</td>
                <td className="td">{s.duration_minutes} min</td>
                <td className="td">{money(s.private_price)}</td>
                <td className="td text-xs">{s.prices.length} coberturas</td>
                <td className="td whitespace-nowrap text-right">
                  <button className="btn-secondary mr-1 px-2 py-1 text-xs" onClick={() => setPricing(s)}>Valores</button>
                  <button className="btn-secondary mr-1 px-2 py-1 text-xs" onClick={() => setEditing(s)}>Editar</button>
                  <button className="btn-secondary px-2 py-1 text-xs" onClick={() => save(() => api.updateStudy(s.id, { active: !s.active }))}>{s.active ? 'Desactivar' : 'Activar'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal title={editing.id ? 'Editar estudio' : 'Nuevo estudio'} onClose={() => setEditing(null)}>
          <StudyForm initial={editing} modalities={modalities} onSubmit={async (form) => {
            const ok = await save(() => (editing.id ? api.updateStudy(editing.id, form) : api.createStudy(form)));
            if (ok) setEditing(null);
          }} />
          <ErrorMsg error={error} />
        </Modal>
      )}
      {pricing && (
        <Modal title={`Valores · ${pricing.name}`} onClose={() => setPricing(null)}>
          <PricesForm study={pricing} insurances={insurances} onSubmit={async (prices) => {
            const ok = await save(() => api.saveStudyPrices(pricing.id, prices));
            if (ok) setPricing(null);
          }} />
        </Modal>
      )}
    </div>
  );
}

function StudyForm({ initial, modalities, onSubmit }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <Field label="Nombre *" className="sm:col-span-2"><input className="input" value={f.name} onChange={set('name')} required /></Field>
      <Field label="Código (nomenclador)"><input className="input" value={f.code || ''} onChange={set('code')} /></Field>
      <Field label="Modalidad">
        <select className="input" value={f.modality} onChange={set('modality')}>{Object.keys(modalities).map((k) => <option key={k}>{k}</option>)}</select>
      </Field>
      <Field label="Duración (min)"><input type="number" className="input" value={f.duration_minutes} onChange={set('duration_minutes')} min={5} max={240} /></Field>
      <Field label="Valor particular"><input type="number" className="input" value={f.private_price} onChange={set('private_price')} min={0} /></Field>
      <div className="sm:col-span-2"><Toggle checked={f.contrast} onChange={(v) => setF({ ...f, contrast: v })} label="Lleva contraste" /></div>
      <Field label="Preparación (se envía al paciente en el recordatorio)" className="sm:col-span-2"><textarea className="input" rows={2} value={f.preparation || ''} onChange={set('preparation')} /></Field>
      <div className="flex justify-end sm:col-span-2"><button className="btn-primary">Guardar</button></div>
    </form>
  );
}

function PricesForm({ study, insurances, onSubmit }) {
  const [rows, setRows] = useState(() =>
    insurances.filter((i) => i.active).map((i) => {
      const p = study.prices.find((x) => x.insurance_id === i.id);
      return { insurance_id: i.id, name: i.name, price: p?.price ?? '', copay: p?.copay ?? '' };
    })
  );
  const set = (idx, k) => (e) => setRows(rows.map((r, i) => (i === idx ? { ...r, [k]: e.target.value } : r)));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(rows.filter((r) => r.price !== '')); }} className="space-y-2">
      <p className="text-xs text-slate-500">Dejá vacío el valor para las coberturas que no cubren el estudio.</p>
      <table className="w-full">
        <thead><tr><th className="th">Cobertura</th><th className="th">Valor</th><th className="th">Coseguro</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.insurance_id}>
              <td className="td">{r.name}</td>
              <td className="td"><input type="number" className="input" value={r.price} onChange={set(i, 'price')} min={0} /></td>
              <td className="td"><input type="number" className="input" value={r.copay} onChange={set(i, 'copay')} min={0} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-end"><button className="btn-primary">Guardar valores</button></div>
    </form>
  );
}

// ---------- Obras sociales ----------
function InsurancesTab() {
  const { data, reload } = useData(() => api.getInsurances(), []);
  const { error, save } = useSaver(reload);
  const [f, setF] = useState({ name: '', code: '', requires_authorization: false });
  if (!data) return null;
  return (
    <div className="space-y-3">
      <ErrorMsg error={error} />
      <form className="card flex flex-wrap items-end gap-2 p-3" onSubmit={async (e) => {
        e.preventDefault();
        if (await save(() => api.createInsurance(f))) setF({ name: '', code: '', requires_authorization: false });
      }}>
        <Field label="Nombre"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field label="Código"><input className="input w-28" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
        <Toggle checked={f.requires_authorization} onChange={(v) => setF({ ...f, requires_authorization: v })} label="Requiere autorización" />
        <button className="btn-primary"><Plus size={15} /> Agregar</button>
      </form>
      <div className="card divide-y divide-slate-100">
        {data.map((i) => (
          <div key={i.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 text-sm ${i.active ? '' : 'opacity-50'}`}>
            <b className="w-48">{i.name}</b>
            <span className="w-20 font-mono text-xs">{i.code}</span>
            <Toggle checked={i.requires_authorization} onChange={(v) => save(() => api.updateInsurance(i.id, { requires_authorization: v }))} label="Requiere autorización" />
            <button className="btn-secondary ml-auto px-2 py-1 text-xs" onClick={() => save(() => api.updateInsurance(i.id, { active: !i.active }))}>{i.active ? 'Desactivar' : 'Activar'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Bloqueos ----------
function BlocksTab() {
  const { data, reload } = useData(() => Promise.all([api.getBlocks(today()), api.getEquipment()]), []);
  const { error, save } = useSaver(reload);
  const [msg, setMsg] = useState('');
  const [f, setF] = useState({ equipment_id: '', start_date: today(), end_date: today(), start_time: '', end_time: '', reason: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  if (!data) return null;
  const [blocks, equipment] = data;
  return (
    <div className="space-y-3">
      <form className="card grid gap-2 p-3 sm:grid-cols-4" onSubmit={async (e) => {
        e.preventDefault();
        setMsg('');
        const r = await save(() => api.createBlock({ ...f, equipment_id: f.equipment_id || null }));
        if (r?.affected_appointments) setMsg(`Atención: hay ${r.affected_appointments} turno(s) dentro del bloqueo para reprogramar.`);
      }}>
        <Field label="Equipo">
          <select className="input" value={f.equipment_id} onChange={set('equipment_id')}>
            <option value="">Todo el centro (feriado)</option>
            {equipment.map((e) => <option key={e.id} value={e.id}>{e.modality} · {e.name}</option>)}
          </select>
        </Field>
        <Field label="Desde"><input type="date" className="input" value={f.start_date} onChange={set('start_date')} required /></Field>
        <Field label="Hasta"><input type="date" className="input" value={f.end_date} onChange={set('end_date')} required /></Field>
        <Field label="Motivo"><input className="input" value={f.reason} onChange={set('reason')} placeholder="Mantenimiento, feriado..." /></Field>
        <Field label="Hora desde (vacío = día entero)"><input type="time" className="input" value={f.start_time} onChange={set('start_time')} /></Field>
        <Field label="Hora hasta"><input type="time" className="input" value={f.end_time} onChange={set('end_time')} /></Field>
        <div className="flex items-end sm:col-span-2"><button className="btn-primary"><Plus size={15} /> Bloquear agenda</button></div>
      </form>
      <ErrorMsg error={error} />
      {msg && <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{msg}</div>}
      <div className="card divide-y divide-slate-100">
        {blocks.length === 0 && <p className="p-4 text-center text-sm text-slate-400">Sin bloqueos vigentes</p>}
        {blocks.map((b) => (
          <div key={b.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="w-56">{b.equipment_name || 'Todo el centro'}</span>
            <span className="w-56">{b.start_date.split('-').reverse().join('/')}{b.end_date !== b.start_date && ` → ${b.end_date.split('-').reverse().join('/')}`}</span>
            <span className="w-28 text-slate-500">{b.start_time ? `${b.start_time}–${b.end_time}` : 'día entero'}</span>
            <span className="flex-1">{b.reason}</span>
            <button className="text-slate-400 hover:text-red-600" onClick={() => save(() => api.deleteBlock(b.id))} aria-label="Quitar bloqueo"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Usuarios ----------
function UsersTab() {
  const { data, reload } = useData(() => api.getUsers(), []);
  const { error, save } = useSaver(reload);
  const [editing, setEditing] = useState(null);
  if (!data) return null;
  return (
    <div className="space-y-3">
      <ErrorMsg error={error} />
      <button className="btn-primary" onClick={() => setEditing({ name: '', email: '', role: 'reception', license_number: '', password: '' })}><Plus size={15} /> Nuevo usuario</button>
      <div className="card divide-y divide-slate-100">
        {data.map((u) => (
          <div key={u.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 text-sm ${u.active ? '' : 'opacity-50'}`}>
            <b className="w-48">{u.name}</b>
            <span className="w-64 text-slate-600">{u.email}</span>
            <span className="w-40">{ROLE_LABELS[u.role]}</span>
            <span className="text-xs text-slate-500">{u.license_number}</span>
            <div className="ml-auto flex gap-2">
              <button className="btn-secondary px-2 py-1 text-xs" onClick={() => setEditing({ ...u, password: '' })}>Editar</button>
              <button className="btn-secondary px-2 py-1 text-xs" onClick={() => save(() => api.updateUser(u.id, { active: !u.active }))}>{u.active ? 'Desactivar' : 'Activar'}</button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <Modal title={editing.id ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => setEditing(null)}>
          <UserForm initial={editing} onSubmit={async (f) => {
            const body = { name: f.name, email: f.email, role: f.role, license_number: f.license_number };
            if (f.password) body.password = f.password;
            const ok = await save(() => (editing.id ? api.updateUser(editing.id, body) : api.createUser(body)));
            if (ok) setEditing(null);
          }} />
          <div className="mt-2"><ErrorMsg error={error} /></div>
        </Modal>
      )}
    </div>
  );
}

function UserForm({ initial, onSubmit }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <Field label="Nombre *"><input className="input" value={f.name} onChange={set('name')} required /></Field>
      <Field label="Email *"><input type="email" className="input" value={f.email} onChange={set('email')} required /></Field>
      <Field label="Rol">
        <select className="input" value={f.role} onChange={set('role')}>{Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </Field>
      <Field label="Matrícula (informantes)"><input className="input" value={f.license_number || ''} onChange={set('license_number')} /></Field>
      <Field label={initial.id ? 'Nueva contraseña (opcional)' : 'Contraseña * (mín. 8)'} className="sm:col-span-2">
        <input type="password" className="input" value={f.password} onChange={set('password')} minLength={initial.id && !f.password ? undefined : 8} required={!initial.id} />
      </Field>
      <div className="flex justify-end sm:col-span-2"><button className="btn-primary">Guardar</button></div>
    </form>
  );
}

// ---------- API keys ----------
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8788/api').replace(/\/$/, '');

function ApiKeysTab() {
  const { data, error: loadError, reload } = useData(() => Promise.all([api.getApiKeys(), api.getApiKeyScopes()]), []);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState(['schedule:read']);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  if (loadError) return <ErrorMsg error={loadError} />;
  if (!data) return null;
  const [keys, scopeLabels] = data;

  const toggle = (s) => setScopes((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));
  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const k = await api.createApiKey({ name, scopes });
      setCreated(k);
      setCopied(false);
      setName('');
      reload();
    } catch (err) {
      setError(err.message);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
    } catch {
      setError('No se pudo copiar: seleccioná la key y copiala a mano');
    }
  };
  const revoke = async (k) => {
    if (!confirm(`¿Revocar la key "${k.name}"? Los sistemas que la usen dejan de tener acceso en el acto.`)) return;
    try {
      await api.revokeApiKey(k.id);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-4xl space-y-3">
      <form onSubmit={create} className="card space-y-3 p-4">
        <div className="flex items-center gap-2 font-medium"><KeyRound size={17} /> Generar API key</div>
        <Field label="Nombre (para qué sistema es)">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder='Ej.: "InPatient", "PACS Orthanc"' required />
        </Field>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-600">Permisos</div>
          {Object.entries(scopeLabels).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 py-0.5 text-sm">
              <input type="checkbox" checked={scopes.includes(k)} onChange={() => toggle(k)} />
              <code className="text-xs">{k}</code> <span className="text-slate-600">— {label}</span>
            </label>
          ))}
        </div>
        <ErrorMsg error={error} />
        <div className="flex justify-end"><button className="btn-primary" disabled={!scopes.length}><Plus size={15} /> Generar</button></div>
      </form>

      {created && (
        <div className="card space-y-2 border-emerald-300 bg-emerald-50 p-4">
          <div className="font-medium text-emerald-900">API key "{created.name}" creada</div>
          <p className="text-sm text-emerald-900">Copiala ahora: <b>no se vuelve a mostrar</b>. Si la perdés, revocala y generá otra.</p>
          <div className="flex gap-2">
            <input className="input font-mono text-xs" readOnly value={created.key} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn-secondary shrink-0" onClick={copy}>{copied ? <><Check size={15} /> Copiada</> : <><Copy size={15} /> Copiar</>}</button>
          </div>
          <div className="text-xs text-slate-600">
            Uso: header <code>X-API-Key: {created.key_prefix}…</code> contra <code>{API_BASE}/integration/…</code>
            <pre className="mt-1 overflow-x-auto rounded bg-white p-2">{`curl -H "X-API-Key: <la key>" "${API_BASE}/integration/schedule?date=${today()}"`}</pre>
          </div>
          <div className="flex justify-end"><button type="button" className="btn-secondary" onClick={() => setCreated(null)}>Listo, ya la guardé</button></div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50"><tr><th className="th">Nombre</th><th className="th">Key</th><th className="th">Permisos</th><th className="th">Creada</th><th className="th">Último uso</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {keys.length === 0 && <tr><td colSpan={6} className="td py-6 text-center text-slate-400">Todavía no hay API keys</td></tr>}
            {keys.map((k) => (
              <tr key={k.id} className={k.revoked_at ? 'opacity-50' : ''}>
                <td className="td font-medium">{k.name}</td>
                <td className="td font-mono text-xs">{k.key_prefix}…</td>
                <td className="td text-xs">{k.scopes.join(', ')}</td>
                <td className="td text-xs">{formatDateTime(k.created_at)}{k.created_by_name && <div className="text-slate-500">{k.created_by_name}</div>}</td>
                <td className="td text-xs">{k.last_used_at ? formatDateTime(k.last_used_at) : 'Nunca'}</td>
                <td className="td text-right">
                  {k.revoked_at ? (
                    <span className="text-xs text-red-600">Revocada {formatDateTime(k.revoked_at)}</span>
                  ) : (
                    <button className="btn-secondary px-2 py-1 text-xs text-red-600" onClick={() => revoke(k)}>Revocar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Centro ----------
function ClinicTab() {
  const { data, reload } = useData(() => api.getSettings(), []);
  const { error, save } = useSaver(reload);
  const [f, setF] = useState(null);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (data) setF(data);
  }, [data]);
  if (!f) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="card max-w-3xl space-y-3 p-4" onSubmit={async (e) => {
      e.preventDefault();
      if (await save(() => api.saveSettings(f))) {
        setOk(true);
        setTimeout(() => setOk(false), 2000);
      }
    }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Nombre del centro"><input className="input" value={f.clinic_name} onChange={set('clinic_name')} /></Field>
        <Field label="Dirección"><input className="input" value={f.clinic_address} onChange={set('clinic_address')} /></Field>
        <Field label="Teléfono"><input className="input" value={f.clinic_phone} onChange={set('clinic_phone')} /></Field>
      </div>
      <Field label="Mensaje de recordatorio por WhatsApp — variables: {paciente} {estudio} {fecha} {hora} {centro} {preparacion}">
        <textarea className="input" rows={4} value={f.reminder_template} onChange={set('reminder_template')} />
      </Field>
      <Field label="URL del visor DICOM (PACS) — variables: {uid} (StudyInstanceUID) y {accession}">
        <input className="input font-mono text-xs" value={f.viewer_url_template} onChange={set('viewer_url_template')} placeholder="https://pacs.ejemplo.com/ohif/viewer?StudyInstanceUIDs={uid}" />
      </Field>
      <Field label="Pie del informe impreso">
        <input className="input" value={f.report_footer} onChange={set('report_footer')} />
      </Field>
      <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
        <b>Integración con sistemas externos</b> (servidor a servidor, header <code>X-API-Key</code> con una key generada en la pestaña <b>API keys</b>):
        <ul className="mt-1 list-disc pl-5">
          <li><code>GET /api/integration/schedule?date=AAAA-MM-DD</code> → turnero del día (permiso <code>schedule:read</code>).</li>
          <li><code>GET /api/integration/worklist?ae_title=RM15T</code> → Modality Worklist (JSON con atributos DICOM) de los pacientes admitidos (permiso <code>worklist:read</code>).</li>
          <li><code>POST /api/integration/study-received</code> <code>{'{ accession_number, study_instance_uid, image_count }'}</code> → el PACS avisa que recibió el estudio (permiso <code>pacs:write</code>).</li>
          <li>Con <code>PACS_MODE</code> sin configurar, la recepción en PACS se simula al finalizar el estudio (modo prueba).</li>
        </ul>
      </div>
      <ErrorMsg error={error} />
      <div className="flex items-center justify-end gap-2">
        {ok && <span className="text-sm text-emerald-700">Guardado</span>}
        <button className="btn-primary">Guardar</button>
      </div>
    </form>
  );
}
