// Estado en memoria y su persistencia en localStorage (sesión y preferencias).

import { GUEST_USER, DEFAULT_SYSTEM_PREFS } from './config.js';

// shortcut: la sesión (rol incluido) vive en localStorage y se envía tal cual al servidor; editarla cambia el rol.
// Se arregla junto con la autorización del backend (ver src/middlewares/auth.js).
function loadSessionUser() {
  try {
    const raw = localStorage.getItem('civiccore_session_user');
    if (!raw) return { ...GUEST_USER };
    const parsed = JSON.parse(raw);
    if (parsed && parsed.role && parsed.role !== 'invitado') {
      return { ...GUEST_USER, ...parsed };
    }
  } catch (e) {}
  return { ...GUEST_USER };
}

function saveSessionUser(user) {
  try {
    if (!user || user.role === 'invitado') {
      localStorage.removeItem('civiccore_session_user');
    } else {
      localStorage.setItem('civiccore_session_user', JSON.stringify(user));
    }
  } catch (e) {}
}

// ==========================================
// Estado Global de la Aplicación
// ==========================================
const state = {
  currentUser: loadSessionUser(),
  currentView: 'view-inicio',
  currentFormStep: 1,
  incidents: [],
  stats: null,
  users: [],
  auditLogs: [],
  filterStatus: 'all',
  filterCategory: 'all',
  searchQuery: '',
  selectedSector: 'all',
  activeModalIncident: null,
  selectedModerationId: null
};

const systemPrefs = loadSystemPrefsFromStorage();

function loadSystemPrefsFromStorage() {
  try {
    const raw = localStorage.getItem('civiccore_system_prefs');
    if (!raw) return { ...DEFAULT_SYSTEM_PREFS };
    return { ...DEFAULT_SYSTEM_PREFS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_SYSTEM_PREFS };
  }
}

function saveSystemPrefsToStorage() {
  try {
    localStorage.setItem('civiccore_system_prefs', JSON.stringify(systemPrefs));
  } catch (e) {}
}

// Vuelve a los valores de fábrica sin reasignar el objeto (los otros módulos guardan la referencia)
function resetSystemPrefs() {
  Object.keys(systemPrefs).forEach(k => delete systemPrefs[k]);
  Object.assign(systemPrefs, DEFAULT_SYSTEM_PREFS);
}

export { saveSessionUser, state, systemPrefs, saveSystemPrefsToStorage, resetSystemPrefs };
