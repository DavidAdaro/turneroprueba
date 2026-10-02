import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout, { NAV, homeFor } from './components/Layout';
import Login from './pages/Login';
import Agenda from './pages/Agenda';
import Turnero from './pages/Turnero';
import Reception from './pages/Reception';
import Technicians from './pages/Technicians';
import Reports from './pages/Reports';
import ReportEditor from './pages/ReportEditor';
import ReportPrint from './pages/ReportPrint';
import Viewer from './pages/Viewer';
import Delivery from './pages/Delivery';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Reminders from './pages/Reminders';
import Stats from './pages/Stats';
import Settings from './pages/Settings';

const PAGES = {
  '/turnero': Turnero,
  '/turnos': Agenda,
  '/recepcion': Reception,
  '/tecnicos': Technicians,
  '/informes': Reports,
  '/entrega': Delivery,
  '/pacientes': Patients,
  '/recordatorios': Reminders,
  '/estadisticas': Stats,
  '/configuracion': Settings,
};

// Solo se registran las rutas que el rol puede ver.
export default function App() {
  const { user } = useAuth();
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  const allowed = (path) => NAV.find((n) => n.to === path)?.roles.includes(user.role);
  return (
    <Routes>
      <Route path="/informe/:id/imprimir" element={<ReportPrint />} />
      <Route path="/visor/:id" element={<Viewer />} />
      <Route element={<Layout />}>
        {Object.entries(PAGES).map(([path, Page]) => allowed(path) && <Route key={path} path={path} element={<Page />} />)}
        {allowed('/informes') && <Route path="/informes/:id" element={<ReportEditor />} />}
        <Route path="/pacientes/:id" element={<PatientDetail />} />
        <Route path="*" element={<Navigate to={homeFor(user.role)} replace />} />
      </Route>
    </Routes>
  );
}
