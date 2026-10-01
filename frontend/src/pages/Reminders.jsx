import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { api } from '../api';
import { useData } from '../components/useData';
import { useCatalog } from '../components/useCatalogs';
import { Empty, ErrorMsg, ModalityTag, PageHeader, StatusBadge } from '../components/ui';
import { addDays, longDate, patientName, today, whatsappLink } from '../utils';

// Recordatorios por WhatsApp de los turnos de un día (por defecto mañana),
// con la preparación del estudio incluida en el mensaje.
export default function Reminders() {
  const settings = useCatalog('settings');
  const [date, setDate] = useState(addDays(today(), 1));
  const { data, error, reload } = useData(() => api.listAppointments({ from: date, to: date, status: 'given,confirmed' }), [date]);
  const pending = (data || []).filter((a) => !a.reminder_sent_at).length;

  const send = async (a, link) => {
    window.open(link, '_blank', 'noopener');
    await api.reminderSent(a.id).catch(() => {});
    reload();
  };

  return (
    <div>
      <PageHeader title="Recordatorios" subtitle="Enviá el recordatorio por WhatsApp con la preparación del estudio">
        <input type="date" className="input w-40" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </PageHeader>
      <p className="mb-3 text-sm text-slate-600">{longDate(date)} · {data?.length ?? 0} turnos · {pending} sin recordatorio</p>
      <ErrorMsg error={error} />
      <div className="card divide-y divide-slate-100">
        {data?.length === 0 && <Empty>No hay turnos pendientes ese día</Empty>}
        {data?.map((a) => {
          const link = whatsappLink(settings?.reminder_template, a, settings);
          return (
            <div key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <span className="w-12 font-mono">{a.start_time}</span>
              <ModalityTag modality={a.modality} />
              <div className="min-w-48 flex-1">
                <div className="font-medium">{patientName(a)}</div>
                <div className="text-xs text-slate-500">{a.study_name} · {a.patient_phone || 'sin teléfono'}</div>
              </div>
              <StatusBadge status={a.status} />
              {a.status === 'given' && (
                <button className="btn-secondary px-2 py-1 text-xs" onClick={() => api.appointmentAction(a.id, 'confirm').then(reload)}>Confirmó</button>
              )}
              {link ? (
                <button className={`px-2 py-1 text-xs ${a.reminder_sent_at ? 'btn-secondary' : 'btn-success'}`} onClick={() => send(a, link)}>
                  <MessageCircle size={14} /> {a.reminder_sent_at ? 'Reenviar' : 'Enviar WhatsApp'}
                </button>
              ) : (
                <span className="text-xs text-slate-400">Sin celular</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
