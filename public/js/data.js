// Carga de datos desde la API hacia state. Las vistas se registran en onLoaded (ver civiccore.js).

import { findIncident, folioQueryId } from './logic.js';
import { state } from './state.js';
import { applyMunicipalitySettings, showToast } from './ui.js';

const onLoaded = { incidents() {}, stats() {}, users() {}, audit() {} };

// Identidad de la sesión que el backend usa para autorizar (ver src/middlewares/auth.js)
function userHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-user-id': String(state.currentUser.id || ''),
    'x-user-email': state.currentUser.email || '',
    'x-user-role': state.currentUser.role,
    'x-user-name': state.currentUser.name
  };
}

// Busca un folio ya normalizado en memoria y, si no está, en el servidor; null si no existe
async function findIncidentByFolio(clean) {
  const local = findIncident(state.incidents, clean);
  if (local) return local;
  try {
    const res = await fetch(`/api/incidents/${folioQueryId(clean)}`);
    if (res.ok) return (await res.json()).data;
  } catch (e) {}
  return null;
}

// ==========================================
// Carga de Datos desde la API REST
// ==========================================
async function loadIncidents() {
  try {
    const res = await fetch('/api/incidents', {
      headers: userHeaders()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    state.incidents = json.data || [];
    onLoaded.incidents();
    await loadStats();
  } catch (err) {
    console.error('Error al cargar incidencias:', err);
    showToast('Error al conectar con el servidor municipal', 'error');
  }
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    state.stats = json.data;
    onLoaded.stats();
    if (state.stats && state.stats.settings) {
      applyMunicipalitySettings(state.stats.settings);
    }
  } catch (err) {
    console.error('Error al cargar métricas:', err);
  }
}

async function loadAdminUsers() {
  try {
    const res = await fetch('/api/admin/users', {
      headers: userHeaders()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    state.users = json.data || [];
    onLoaded.users();
  } catch (err) {
    console.error('Error al cargar usuarios:', err);
  }
}

async function loadAuditLogs() {
  try {
    const res = await fetch('/api/admin/audit-logs', {
      headers: userHeaders()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    state.auditLogs = json.data || [];
    onLoaded.audit();
  } catch (err) {
    console.error('Error al cargar logs de auditoría:', err);
  }
}

export { onLoaded, userHeaders, findIncidentByFolio, loadIncidents, loadStats, loadAdminUsers, loadAuditLogs };
