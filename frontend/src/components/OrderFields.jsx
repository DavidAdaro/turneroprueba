import { Field } from './ui';

// Campos del pedido médico (los mismos que guarda InPatient en sus pedidos).
export const EMPTY_ORDER = {
  referring_physician: '',
  order_physician_license: '',
  order_date: '',
  order_code: '',
  clinical_indication: '',
  order_observations: '',
  order_received: false,
};

export const orderFrom = (a = {}) => ({
  referring_physician: a.referring_physician || '',
  order_physician_license: a.order_physician_license || '',
  order_date: a.order_date || '',
  order_code: a.order_code || '',
  clinical_indication: a.clinical_indication || '',
  order_observations: a.order_observations || '',
  order_received: !!a.order_received,
});

export default function OrderFields({ form, set, title = 'Pedido médico' }) {
  return (
    <fieldset className="rounded-md border border-slate-200 p-3">
      <legend className="px-1 text-xs font-semibold text-slate-600">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Médico solicitante">
          <input className="input" value={form.referring_physician} onChange={set('referring_physician')} placeholder="Dra. Castillo" />
        </Field>
        <Field label="Matrícula">
          <input className="input" value={form.order_physician_license} onChange={set('order_physician_license')} placeholder="MP 12345" />
        </Field>
        <Field label="Fecha del pedido">
          <input type="date" className="input" value={form.order_date} onChange={set('order_date')} />
        </Field>
        <Field label="Código/s pedidos">
          <input className="input" value={form.order_code} onChange={set('order_code')} placeholder="340101 x1" />
        </Field>
        <Field label="Diagnóstico / motivo" className="sm:col-span-2">
          <input className="input" value={form.clinical_indication} onChange={set('clinical_indication')} placeholder="Cefalea crónica refractaria" />
        </Field>
        <Field label="Texto del pedido / observaciones" className="sm:col-span-3">
          <textarea className="input" rows={2} value={form.order_observations} onChange={set('order_observations')} placeholder="Solicito RM de cerebro con y sin gadolinio…" />
        </Field>
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.order_received} onChange={set('order_received')} /> Presentó el pedido original
      </label>
    </fieldset>
  );
}

// Resumen de una línea del pedido (tooltips, listas).
export function orderSummary(a) {
  const parts = [
    a.order_received ? 'Pedido recibido' : 'Falta pedido médico',
    a.referring_physician && `Solicita: ${a.referring_physician}${a.order_physician_license ? ` (${a.order_physician_license})` : ''}`,
    a.order_date && `Fecha: ${a.order_date.split('-').reverse().join('/')}`,
    a.order_code && `Código: ${a.order_code}`,
    a.clinical_indication && `Dx: ${a.clinical_indication}`,
    a.order_observations && `Pedido: ${a.order_observations}`,
  ];
  return parts.filter(Boolean).join('\n');
}
