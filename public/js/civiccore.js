/**
 * CivicCore - Controlador Principal de la Aplicación Web (SPA)
 * Soporte Completo para 4 Niveles de Acceso y Sistema de Prioridades:
 *   1. Invitado (Guest): Solo genera reportes anónimos (Prioridad Normal).
 *   2. Vecino (Resident): Portal ciudadano, rastreo de folios, prioridad alta verificada.
 *   3. Trabajador (Municipal Worker): Bandeja comunal, mapa georreferenciado, panel KPIs y triaje.
 *   4. Super Admin (Root): Consola maestra, padrón de claves, moderación directa y auditoría legal.
 */
// Punto de entrada: conecta las vistas, registra eventos globales y publica window.civicApp.

import { ROLE_PERMISSIONS } from './config.js';
import { onLoaded, loadIncidents, loadAdminUsers, loadAuditLogs } from './data.js';
import { onEnter, switchView, renderNavForRole, init as initNav } from './nav.js';
import { state } from './state.js';
import { showToast } from './ui.js';
import { renderAdminHub, renderAdminUsersTable, openUserActionsMenu, closeUserActionsMenu, openEditUserModal, closeEditUserModal, toggleUserStatus, renderAdminModerationList, openModerationFor, closeModerationPanel, loadAdminSettings, renderAuditLogsTable, init as initAdmin } from './views/admin.js';
import { applySystemPrefs, toggleQuickTheme, openSystemSettingsModal, closeSystemSettingsModal, init as initAjustes } from './views/ajustes.js';
import { openChangePasswordForUser, openChangeMyPasswordModal, closeChangePasswordModal, logout, quickLogin, switchAuthView, openAuthModal, closeAuthModal, loadGoogleAuthConfig, init as initAuth } from './views/auth.js';
import { renderIncidentsList, updateTabCounters, openIncidentModal, closeIncidentModal, init as initIncidencias } from './views/incidencias.js';
import { renderHomeStats, handleHomeFolioSearch, scrollToHomeTracker, reportCategory, init as initInicio } from './views/inicio.js';
import { renderMapPins, init as initMapa } from './views/mapa.js';
import { closeReportSuccessModal, removeCustomPhoto, onEnterNuevo, init as initNuevo } from './views/nuevo.js';
import { renderDashboardStats } from './views/panel.js';
import { renderVecinoPortal, handleFolioTracking, init as initVecino } from './views/vecino.js';

const dom = {
  btnSyncAll: document.getElementById('btn-sync-all')
};

// Lo que hace cada vista al entrar (antes era una cadena de if en switchView)
Object.assign(onEnter, {
  'view-inicio': renderHomeStats,
  'view-mapa': renderMapPins,
  'view-panel': renderDashboardStats,
  'view-nuevo': onEnterNuevo,
  'view-vecino': renderVecinoPortal,
  'view-admin-hub': renderAdminHub,
  'view-admin-users': loadAdminUsers,
  'view-admin-moderation': renderAdminModerationList,
  'view-admin-audit': () => { loadAuditLogs(); loadAdminSettings(); }
});

// Qué se vuelve a dibujar cuando llegan datos nuevos
Object.assign(onLoaded, {
  incidents: () => {
    renderIncidentsList();
    renderVecinoPortal();
    updateTabCounters();
    renderMapPins();
    renderAdminHub();
    renderAdminModerationList();
  },
  stats: () => {
    renderDashboardStats();
    renderAdminHub();
    renderHomeStats();
  },
  users: renderAdminUsersTable,
  audit: renderAuditLogsTable
});

// Eventos globales de la cabecera y del teclado
function initGlobalEvents() {

  // Sincronizar Todo
  if (dom.btnSyncAll) {
    dom.btnSyncAll.addEventListener('click', () => {
      dom.btnSyncAll.classList.add('animate-spin');
      loadIncidents()
        .then(() => showToast('Datos sincronizados con éxito', 'success'))
        .catch(() => showToast('Error al sincronizar datos', 'error'))
        .finally(() => {
          setTimeout(() => dom.btnSyncAll.classList.remove('animate-spin'), 600);
        });
    });
  }

  // Cerrar modales con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAuthModal();
      closeIncidentModal();
      closeReportSuccessModal();
      closeChangePasswordModal();
      closeSystemSettingsModal();
      closeEditUserModal();
      closeUserActionsMenu();
    }
  });

}

window.civicApp = {
  switchView,
  renderHomeStats,
  handleHomeFolioSearch,
  scrollToHomeTracker,
  reportCategory,
  quickLogin,
  logout,
  openAuthModal,
  closeAuthModal,
  switchAuthView,
  openIncidentModal,
  openModerationFor,
  closeModerationPanel,
  openUserActionsMenu,
  closeUserActionsMenu,
  openEditUserModal,
  closeEditUserModal,
  toggleUserStatus,
  openChangePasswordForUser,
  openChangeMyPasswordModal,
  closeChangePasswordModal,
  openSystemSettingsModal,
  closeSystemSettingsModal,
  toggleQuickTheme,
  removeCustomPhoto,
  trackFolioNumber: (id) => handleFolioTracking(id),
  state
};

// ==========================================
// Inicio de la Aplicación
// ==========================================
function init() {
  applySystemPrefs();
  [initAuth, initNav, initGlobalEvents, initAjustes, initVecino, initNuevo, initIncidencias, initMapa, initAdmin, initInicio].forEach(fn => fn());
  renderNavForRole(state.currentUser.role);
  switchView(ROLE_PERMISSIONS[state.currentUser.role].defaultView);
  loadIncidents();
  loadGoogleAuthConfig();
}

// Los módulos se ejecutan con el HTML ya analizado, pero se conserva el chequeo original
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
