import { useEffect } from 'react';
import { X } from 'lucide-react';
import { STATUS } from '../utils';

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4" onMouseDown={onClose}>
      <div
        className={`card my-8 w-full text-left text-sm font-normal text-slate-800 normal-case ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, cls: '' };
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export function ErrorMsg({ error }) {
  if (!error) return null;
  return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Empty({ children }) {
  return <div className="px-3 py-8 text-center text-sm text-slate-400">{children}</div>;
}

export function ModalityTag({ modality }) {
  return <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">{modality}</span>;
}

export function Alert({ children }) {
  return <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{children}</div>;
}
