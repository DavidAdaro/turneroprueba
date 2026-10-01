const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8788/api';

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

async function request(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (res.status === 401 && path !== '/auth/login') onUnauthorized();
  if (!res.ok) throw new Error((data && data.error) || `Error ${res.status}`);
  return data;
}

const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  return s.toString() ? `?${s}` : '';
};

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),

  getSettings: () => request('/settings'),
  saveSettings: (data) => request('/settings', { method: 'PUT', body: data }),

  getUsers: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: data }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: data }),

  getInsurances: () => request('/insurances'),
  createInsurance: (data) => request('/insurances', { method: 'POST', body: data }),
  updateInsurance: (id, data) => request(`/insurances/${id}`, { method: 'PUT', body: data }),

  getModalities: () => request('/equipment/modalities'),
  getEquipment: () => request('/equipment'),
  createEquipment: (data) => request('/equipment', { method: 'POST', body: data }),
  updateEquipment: (id, data) => request(`/equipment/${id}`, { method: 'PUT', body: data }),
  addSchedule: (id, data) => request(`/equipment/${id}/schedules`, { method: 'POST', body: data }),
  deleteSchedule: (id, scheduleId) => request(`/equipment/${id}/schedules/${scheduleId}`, { method: 'DELETE' }),

  getStudies: () => request('/studies'),
  createStudy: (data) => request('/studies', { method: 'POST', body: data }),
  updateStudy: (id, data) => request(`/studies/${id}`, { method: 'PUT', body: data }),
  saveStudyPrices: (id, prices) => request(`/studies/${id}/prices`, { method: 'PUT', body: { prices } }),

  getBlocks: (from) => request(`/blocks${qs({ from })}`),
  createBlock: (data) => request('/blocks', { method: 'POST', body: data }),
  deleteBlock: (id) => request(`/blocks/${id}`, { method: 'DELETE' }),

  searchPatients: (q) => request(`/patients${qs({ q })}`),
  getPatient: (id) => request(`/patients/${id}`),
  createPatient: (data) => request('/patients', { method: 'POST', body: data }),
  updatePatient: (id, data) => request(`/patients/${id}`, { method: 'PUT', body: data }),

  getDay: (date, equipmentId) => request(`/appointments/day${qs({ date, equipment_id: equipmentId })}`),
  listAppointments: (params) => request(`/appointments/list${qs(params)}`),
  searchAppointments: (q) => request(`/appointments/search${qs({ q })}`),
  nextFree: (equipmentId, from) => request(`/appointments/next-free${qs({ equipment_id: equipmentId, from })}`),
  getAppointment: (id) => request(`/appointments/${id}`),
  createAppointment: (data) => request('/appointments', { method: 'POST', body: data }),
  updateAppointment: (id, data) => request(`/appointments/${id}`, { method: 'PATCH', body: data }),
  appointmentAction: (id, action, data = {}) => request(`/appointments/${id}/actions/${action}`, { method: 'POST', body: data }),
  reschedule: (id, data) => request(`/appointments/${id}/reschedule`, { method: 'POST', body: data }),
  reminderSent: (id) => request(`/appointments/${id}/reminder-sent`, { method: 'POST' }),

  reportWorklist: (status, modality) => request(`/reports/worklist${qs({ status, modality })}`),
  getReport: (appointmentId) => request(`/reports/${appointmentId}`),
  saveReport: (appointmentId, data) => request(`/reports/${appointmentId}`, { method: 'PUT', body: data }),
  signReport: (appointmentId) => request(`/reports/${appointmentId}/sign`, { method: 'POST' }),

  getStats: (from, to) => request(`/stats${qs({ from, to })}`),
  getBilling: (from, to, insuranceId) => request(`/stats/billing${qs({ from, to, insurance_id: insuranceId })}`),
};
