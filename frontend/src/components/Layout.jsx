import { NavLink, Outlet } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  FileText,
  LogOut,
  MessageCircle,
  PackageCheck,
  ScanLine,
  Settings,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../utils';

// Menú en el orden del flujo: turno → recepción → técnico → informe → entrega.
export const NAV = [
  { to: '/turnos', label: 'Turnos', icon: CalendarDays, roles: ['admin', 'reception'] },
  { to: '/recepcion', label: 'Recepción', icon: ClipboardCheck, roles: ['admin', 'reception'] },
  { to: '/tecnicos', label: 'Técnicos', icon: ScanLine, roles: ['admin', 'technician'] },
  { to: '/informes', label: 'Informes', icon: FileText, roles: ['admin', 'radiologist'] },
  { to: '/entrega', label: 'Entrega', icon: PackageCheck, roles: ['admin', 'reception'] },
  { to: '/pacientes', label: 'Pacientes', icon: Users, roles: ['admin', 'reception', 'technician', 'radiologist'] },
  { to: '/recordatorios', label: 'Recordatorios', icon: MessageCircle, roles: ['admin', 'reception'] },
  { to: '/estadisticas', label: 'Estadísticas', icon: BarChart3, roles: ['admin', 'reception'] },
  { to: '/configuracion', label: 'Configuración', icon: Settings, roles: ['admin'] },
];

export const homeFor = (role) => NAV.find((n) => n.roles.includes(role))?.to || '/pacientes';

export default function Layout() {
  const { user, logout } = useAuth();
  const items = NAV.filter((n) => n.roles.includes(user.role));
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <aside className="no-print sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="text-sm font-bold text-blue-700">Mini RIS</div>
          <div className="text-xs text-slate-500">Turnero de Imágenes · prueba</div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  isActive ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3 text-sm">
          <div className="font-medium">{user.name}</div>
          <div className="mb-2 text-xs text-slate-500">{ROLE_LABELS[user.role]}</div>
          <button onClick={logout} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600">
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
