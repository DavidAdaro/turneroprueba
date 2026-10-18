import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { api } from '../api';
import { useData } from '../components/useData';
import HandwrittenOrder from '../components/HandwrittenOrder';
import { ErrorMsg } from '../components/ui';

// Pedido médico ficticio del turno, para ver o imprimir.
export default function OrderPrint() {
  const { id } = useParams();
  const { data: a, error } = useData(() => api.getAppointment(id), [id]);
  if (error) return <div className="p-6"><ErrorMsg error={error} /></div>;
  if (!a) return <p className="p-6 text-sm text-slate-500">Cargando…</p>;
  return (
    <div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[560px] items-center justify-between text-sm text-slate-600">
        <span>Pedido médico · {a.patient_last_name}, {a.patient_first_name} · {a.study_name}</span>
        <button className="btn-primary" onClick={() => window.print()}><Printer size={15} /> Imprimir</button>
      </div>
      <div className="flex justify-center p-4">
        <HandwrittenOrder a={a} />
      </div>
    </div>
  );
}
