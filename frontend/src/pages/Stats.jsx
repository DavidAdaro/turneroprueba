import { useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../api';
import { useData } from '../components/useData';
import { useCatalog } from '../components/useCatalogs';
import { ErrorMsg, Field, PageHeader } from '../components/ui';
import { STATUS, addDays, money, today } from '../utils';

export default function Stats() {
  const [from, setFrom] = useState(addDays(today(), -30));
  const [to, setTo] = useState(today());
  const [tab, setTab] = useState('stats');
  return (
    <div>
      <PageHeader title="Estadísticas y facturación">
        <Field label="Desde"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Hasta"><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </PageHeader>
      <div className="mb-4 flex gap-1">
        {[['stats', 'Estadísticas'], ['billing', 'Facturación por obra social']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-sm ${tab === k ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}>{l}</button>
        ))}
      </div>
      {tab === 'stats' ? <Dashboard from={from} to={to} /> : <Billing from={from} to={to} />}
    </div>
  );
}

function Bar({ label, value, max, sub }) {
  return (
    <div className="text-sm">
      <div className="flex justify-between"><span>{label}</span><span className="font-medium">{value}{sub && <span className="ml-1 text-xs text-slate-500">{sub}</span>}</span></div>
      <div className="mt-0.5 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-blue-500" style={{ width: `${max ? (value / max) * 100 : 0}%` }} /></div>
    </div>
  );
}

function Dashboard({ from, to }) {
  const { data, error } = useData(() => api.getStats(from, to), [from, to]);
  if (error) return <ErrorMsg error={error} />;
  if (!data) return <p className="text-sm text-slate-500">Cargando…</p>;
  const by = Object.fromEntries(data.byStatus.map((s) => [s.status, s.n]));
  const total = data.byStatus.filter((s) => s.status !== 'cancelled').reduce((n, s) => n + s.n, 0);
  const done = (by.completed || 0) + (by.reported || 0) + (by.delivered || 0);
  const absentRate = total ? Math.round(((by.absent || 0) / total) * 100) : 0;
  const maxEq = Math.max(...data.byEquipment.map((e) => e.total), 1);
  const maxIns = Math.max(...data.byInsurance.map((e) => e.n), 1);
  const maxDay = Math.max(...data.byDay.map((d) => d.total), 1);
  const t = data.turnaround || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ['Turnos', total],
          ['Realizados', done],
          ['Ausentismo', `${absentRate}%`],
          ['Espera promedio', t.wait_minutes != null ? `${Math.round(t.wait_minutes)} min` : '—'],
          ['Tiempo a informe', t.report_hours != null ? `${t.report_hours.toFixed(1)} h` : '—'],
        ].map(([l, v]) => (
          <div key={l} className="card p-3"><div className="text-2xl font-semibold">{v}</div><div className="text-xs text-slate-500">{l}</div></div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-2 p-4">
          <div className="text-sm font-semibold">Por equipo</div>
          {data.byEquipment.map((e) => <Bar key={e.name} label={`${e.modality} · ${e.name}`} value={e.total} max={maxEq} sub={`${e.done} realizados · ${e.absent} ausentes`} />)}
        </div>
        <div className="card space-y-2 p-4">
          <div className="text-sm font-semibold">Estudios realizados por cobertura</div>
          {data.byInsurance.map((e) => <Bar key={e.name} label={e.name} value={e.n} max={maxIns} />)}
        </div>
        <div className="card space-y-2 p-4">
          <div className="text-sm font-semibold">Por estado</div>
          {data.byStatus.map((s) => <Bar key={s.status} label={STATUS[s.status]?.label || s.status} value={s.n} max={Math.max(...data.byStatus.map((x) => x.n))} />)}
        </div>
        <div className="card p-4">
          <div className="mb-2 text-sm font-semibold">Turnos por día</div>
          <div className="flex h-40 gap-0.5">
            {data.byDay.map((d) => (
              <div key={d.date} className="flex max-w-10 flex-1 flex-col justify-end" title={`${d.date}: ${d.total} turnos, ${d.done} realizados`}>
                <div className="rounded-t bg-blue-200" style={{ height: `${((d.total - d.done) / maxDay) * 100}%` }} />
                <div className="bg-blue-600" style={{ height: `${(d.done / maxDay) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-1 text-xs text-slate-500">Azul oscuro: realizados · claro: resto</div>
        </div>
      </div>
    </div>
  );
}

function Billing({ from, to }) {
  const insurances = useCatalog('insurances') || [];
  const [insuranceId, setInsuranceId] = useState('');
  const { data, error } = useData(() => api.getBilling(from, to, insuranceId || undefined), [from, to, insuranceId]);
  const rows = data?.rows || [];
  const groups = rows.reduce((g, r) => {
    (g[r.insurance_name] ||= []).push(r);
    return g;
  }, {});

  const exportCsv = () => {
    const header = ['Fecha', 'N° acceso', 'Cobertura', 'Afiliado', 'DNI', 'Paciente', 'Código', 'Estudio', 'Autorización', 'Valor', 'Coseguro'];
    const lines = rows.map((r) =>
      [r.date, r.accession_number, r.insurance_name, r.affiliate_number, r.dni, `${r.last_name}, ${r.first_name}`, r.study_code, r.study_name, r.authorization_number, r.price, r.copay]
        .map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`)
        .join(';')
    );
    const blob = new Blob(['﻿' + [header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = `facturacion_${from}_${to}.csv`;
    el.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select className="input w-60" value={insuranceId} onChange={(e) => setInsuranceId(e.target.value)}>
          <option value="">Todas las coberturas</option>
          {insurances.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <button className="btn-secondary" onClick={exportCsv} disabled={!rows.length}><Download size={15} /> Exportar CSV</button>
      </div>
      <ErrorMsg error={error} />
      {Object.entries(groups).map(([name, items]) => {
        const total = items.reduce((n, r) => n + r.price, 0);
        const copay = items.reduce((n, r) => n + r.copay, 0);
        return (
          <div key={name} className="card overflow-x-auto">
            <div className="flex justify-between border-b border-slate-200 px-3 py-2 text-sm">
              <b>{name}</b>
              <span>{items.length} estudios · a facturar <b>{money(total)}</b> · coseguros {money(copay)}</span>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50"><tr><th className="th">Fecha</th><th className="th">Paciente</th><th className="th">Código</th><th className="th">Estudio</th><th className="th">Autorización</th><th className="th text-right">Valor</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="td">{r.date.split('-').reverse().join('/')}</td>
                    <td className="td">{r.last_name}, {r.first_name} <span className="text-xs text-slate-500">{r.affiliate_number}</span></td>
                    <td className="td font-mono text-xs">{r.study_code}</td>
                    <td className="td">{r.study_name}</td>
                    <td className="td text-xs">{r.authorization_number || '—'}</td>
                    <td className="td text-right">{r.missing_price ? <span className="text-xs text-amber-700">sin valor cargado</span> : money(r.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      {data && rows.length === 0 && <div className="card"><p className="p-6 text-center text-sm text-slate-400">No hay estudios realizados en el período</p></div>}
    </div>
  );
}
