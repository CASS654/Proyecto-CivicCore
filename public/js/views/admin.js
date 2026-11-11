// Vistas del Super Admin: hub, padrón y claves, moderación, auditoría y parámetros.

import { loadIncidents, loadStats, loadAdminUsers, loadAuditLogs, userHeaders } from '../data.js';
import { auditCounts, criticalIncidents } from '../logic.js';
import { switchView, renderNavForRole } from '../nav.js';
import { saveSessionUser, state } from '../state.js';
import { escapeHtml, applyMunicipalitySettings, showToast } from '../ui.js';
import { openChangePasswordForUser } from './auth.js';

const dom = {
  adminCriticalAlertsContainer: document.getElementById('admin-critical-alerts-container'),
  adminKpiReportes: document.getElementById('admin-kpi-reportes'),
  adminKpiCriticos: document.getElementById('admin-kpi-criticos'),
  adminKpiVecinos: document.getElementById('admin-kpi-vecinos'),
  adminKpiFuncionarios: document.getElementById('admin-kpi-funcionarios'),
  adminUsersTableBody: document.getElementById('admin-users-table-body'),
  formCreateUser: document.getElementById('form-create-user'),
  adminModerationList: document.getElementById('admin-moderation-list'),
  adminEditPanel: document.getElementById('admin-edit-panel'),
  modIncidentId: document.getElementById('mod-incident-id'),
  modFolioTag: document.getElementById('mod-folio-tag'),
  modCategory: document.getElementById('mod-category'),
  modPriorityLevel: document.getElementById('mod-priority-level'),
  modAssignedTeam: document.getElementById('mod-assigned-team'),
  modTitle: document.getElementById('mod-title'),
  modDesc: document.getElementById('mod-desc'),
  auditTableBody: document.getElementById('audit-table-body'),
  auditStatEvents: document.getElementById('audit-stat-events'),
  auditStatAdminActions: document.getElementById('audit-stat-admin-actions'),
  auditStatAuthEvents: document.getElementById('audit-stat-auth-events'),
  btnRefreshUsers: document.getElementById('btn-refresh-users'),
  formModerateIncident: document.getElementById('form-moderate-incident'),
  btnRefreshAudit: document.getElementById('btn-refresh-audit'),
  btnSaveSettings: document.getElementById('btn-save-settings')
};

// ==========================================
// Nivel 4: Super Administrador Hub, Usuarios, Moderación y Auditoría
// ==========================================
function renderAdminHub() {
  const container = dom.adminCriticalAlertsContainer;
  const critical = criticalIncidents(state.incidents);

  // Actualizar los 4 KPIs del Super Administrador
  if (dom.adminKpiReportes) dom.adminKpiReportes.textContent = state.incidents.length;
  if (dom.adminKpiCriticos) dom.adminKpiCriticos.textContent = critical.length;
  if (state.stats) {
    if (dom.adminKpiVecinos) dom.adminKpiVecinos.textContent = state.stats.vecinosCount ?? (state.users.filter(u => u.role === 'vecino').length || 1);
    if (dom.adminKpiFuncionarios) dom.adminKpiFuncionarios.textContent = state.stats.funcionariosCount ?? (state.users.filter(u => u.role === 'trabajador').length || 1);
  }

  if (!container) return;

  if (critical.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-outline bg-surface-container-low rounded-xl">
        <span class="material-symbols-outlined text-3xl text-emerald-600 mb-1">check_circle</span>
        <p class="text-xs font-bold text-on-surface">No hay alertas críticas pendientes de despacho</p>
      </div>
    `;
    return;
  }

  container.innerHTML = critical.map(inc => `
    <div class="p-3.5 rounded-xl bg-error-container/30 border border-error-container flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
      <div class="flex items-start gap-3 min-w-0">
        <span class="material-symbols-outlined text-error text-[20px] mt-0.5 shrink-0">bolt</span>
        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-mono text-xs font-bold text-on-surface">${escapeHtml(inc.folio)}</span>
            <span class="px-2 py-0.5 rounded-full bg-error text-on-error font-bold text-[10px]">Urgente / Prioridad ${escapeHtml(inc.priorityLevel)}</span>
            <span class="text-xs font-bold text-on-surface truncate">${escapeHtml(inc.title)}</span>
          </div>
          <span class="text-xs text-on-surface-variant truncate mt-0.5">${escapeHtml(inc.address)} • Reportado por: ${escapeHtml(inc.reportedBy)}</span>
        </div>
      </div>
      <button onclick="window.civicApp.openModerationFor('${escapeHtml(inc.id)}')" class="w-full sm:w-auto justify-center px-3.5 py-2 sm:py-1.5 rounded-lg bg-primary text-on-primary font-bold text-xs shrink-0 shadow-sm hover:bg-primary-container transition-all flex items-center gap-1">
        <span class="material-symbols-outlined text-[15px]">rate_review</span>
        <span>Moderar Ahora</span>
      </button>
    </div>
  `).join('');
}

function renderAdminUsersTable() {
  const tbody = dom.adminUsersTableBody;
  if (state.users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-outline">No hay usuarios registrados en el sistema</td></tr>`;
    return;
  }

  tbody.innerHTML = state.users.map(u => {
    return `
    <tr class="hover:bg-surface-container-low transition-colors">
      <td class="py-3 px-3">
        <div class="font-bold text-on-surface">${escapeHtml(u.name)}</div>
        <div class="text-[11px] text-outline">${escapeHtml(u.email)}</div>
      </td>
      <td class="py-3 px-3 font-mono text-[11px]">${escapeHtml(u.rutDni || 'N/A')}</td>
      <td class="py-3 px-3">
        <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${u.role === 'admin' ? 'bg-red-100 text-red-800' : (u.role === 'trabajador' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800')}">
          ${escapeHtml(u.role)}
        </span>
      </td>
      <td class="py-3 px-3">${escapeHtml(u.department || 'Comuna')}</td>
      <td class="py-3 px-3">
        <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${u.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
          ${u.status === 'active' ? 'Activo' : 'Suspendido'}
        </span>
      </td>
      <td class="py-3 px-3 text-right">
        <button type="button" onclick="window.civicApp.openUserActionsMenu(event, ${Number(u.id)})" class="user-actions-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs border border-outline-variant/30 shadow-sm transition-all active:scale-95" title="Opciones de cuenta">
          <span class="material-symbols-outlined text-[15px] text-primary">tune</span>
          <span>Opciones</span>
          <span class="material-symbols-outlined text-[13px] text-outline">expand_more</span>
        </button>
      </td>
    </tr>
    `;
  }).join('');
}

// ==========================================
// Menú Flotante de Acciones y Modificación de Usuario
// ==========================================
let activeActionsUserId = null;

function openUserActionsMenu(event, userId) {
  event.stopPropagation();
  const triggerBtn = event.currentTarget;
  const user = state.users.find(u => u.id === userId);
  if (!user) return;

  const menu = document.getElementById('user-actions-dropdown-menu');
  if (!menu) return;

  // Toggle: si el menú ya está abierto para este mismo usuario, cerrarlo
  if (!menu.classList.contains('hidden') && activeActionsUserId === userId) {
    closeUserActionsMenu();
    return;
  }

  activeActionsUserId = userId;

  // Poblar información del usuario
  const nameEl = document.getElementById('dropdown-user-name');
  const emailEl = document.getElementById('dropdown-user-email');
  if (nameEl) nameEl.textContent = user.name;
  if (emailEl) emailEl.textContent = `${user.email} • ${user.role}`;

  // Opción: Cambiar Contraseña
  const btnPwd = document.getElementById('dropdown-btn-password');
  if (btnPwd) {
    btnPwd.onclick = () => {
      closeUserActionsMenu();
      openChangePasswordForUser(user.id, user.name, user.email);
    };
  }

  // Opción: Cambiar Correo / Datos
  const btnEdit = document.getElementById('dropdown-btn-edit');
  if (btnEdit) {
    btnEdit.onclick = () => {
      closeUserActionsMenu();
      openEditUserModal(user.id);
    };
  }

  // Opción: Suspender / Activar
  const isSelf = (state.currentUser.email && user.email === state.currentUser.email) || (user.role === 'admin' && state.currentUser.role === 'admin' && state.users.filter(x => x.role === 'admin').length <= 1);
  const btnStatus = document.getElementById('dropdown-btn-status');
  const statusIconContainer = document.getElementById('dropdown-status-icon-container');
  const statusIcon = document.getElementById('dropdown-status-icon');
  const statusTitle = document.getElementById('dropdown-status-title');
  const statusSubtitle = document.getElementById('dropdown-status-subtitle');

  if (btnStatus) {
    if (isSelf) {
      btnStatus.disabled = true;
      btnStatus.classList.add('opacity-40', 'cursor-not-allowed');
      if (statusTitle) {
        statusTitle.textContent = 'Super Admin Protegido';
        statusTitle.className = 'font-bold text-xs text-outline';
      }
      if (statusSubtitle) statusSubtitle.textContent = 'Tu cuenta actual no puede ser suspendida';
      if (statusIcon) statusIcon.textContent = 'security';
      if (statusIconContainer) statusIconContainer.className = 'w-7 h-7 rounded-lg bg-surface-container text-outline flex items-center justify-center shrink-0';
    } else {
      btnStatus.disabled = false;
      btnStatus.classList.remove('opacity-40', 'cursor-not-allowed');
      const isSuspended = user.status === 'suspended';
      if (isSuspended) {
        if (statusTitle) {
          statusTitle.textContent = 'Reactivar Usuario';
          statusTitle.className = 'font-bold text-xs text-emerald-700';
        }
        if (statusSubtitle) statusSubtitle.textContent = 'Restablecer acceso normal';
        if (statusIcon) statusIcon.textContent = 'check_circle';
        if (statusIconContainer) statusIconContainer.className = 'w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0';
        btnStatus.onclick = () => {
          closeUserActionsMenu();
          toggleUserStatus(user.id, 'active');
        };
      } else {
        if (statusTitle) {
          statusTitle.textContent = 'Suspender Usuario';
          statusTitle.className = 'font-bold text-xs text-error';
        }
        if (statusSubtitle) statusSubtitle.textContent = 'Inhabilitar temporalmente el acceso';
        if (statusIcon) statusIcon.textContent = 'block';
        if (statusIconContainer) statusIconContainer.className = 'w-7 h-7 rounded-lg bg-error-container text-on-error-container flex items-center justify-center shrink-0';
        btnStatus.onclick = () => {
          closeUserActionsMenu();
          toggleUserStatus(user.id, 'suspended');
        };
      }
    }
  }

  // Calcular posición flotante usando el tamaño REAL del menú
  const rect = triggerBtn.getBoundingClientRect();
  const gap = 6;
  const margin = 10;

  // Mostrarlo invisible para poder medirlo
  menu.style.visibility = 'hidden';
  menu.classList.remove('hidden');
  const menuWidth = menu.offsetWidth;
  const menuHeight = menu.offsetHeight;

  let left = rect.right - menuWidth;
  left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin));

  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  let top;
  if (spaceBelow >= menuHeight + gap + margin || spaceBelow >= spaceAbove) {
    // Abajo del botón
    top = rect.bottom + gap;
  } else {
    // Arriba del botón, sin taparlo
    top = rect.top - menuHeight - gap;
  }
  top = Math.max(margin, Math.min(top, window.innerHeight - menuHeight - margin));

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.visibility = '';
  triggerBtn.setAttribute('aria-expanded', 'true');
}

function closeUserActionsMenu() {
  activeActionsUserId = null;
  const menu = document.getElementById('user-actions-dropdown-menu');
  if (menu) menu.classList.add('hidden');
  document.querySelectorAll('.user-actions-btn[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}

function openEditUserModal(userId) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;

  const modal = document.getElementById('modal-edit-user');
  const idEl = document.getElementById('edit-user-id');
  const nameEl = document.getElementById('edit-user-name');
  const emailEl = document.getElementById('edit-user-email');
  const rutEl = document.getElementById('edit-user-rut');
  const roleEl = document.getElementById('edit-user-role');
  const deptEl = document.getElementById('edit-user-dept');

  if (idEl) idEl.value = user.id;
  if (nameEl) nameEl.value = user.name || '';
  if (emailEl) emailEl.value = user.email || '';
  if (rutEl) rutEl.value = user.rutDni || '';
  if (roleEl) roleEl.value = user.role || 'vecino';
  if (deptEl) deptEl.value = user.department || '';

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeEditUserModal() {
  const modal = document.getElementById('modal-edit-user');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  const form = document.getElementById('form-edit-user');
  if (form) form.reset();
}

async function handleEditUserSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-user-id').value;
  if (!id) return;

  const name = document.getElementById('edit-user-name').value.trim();
  const email = document.getElementById('edit-user-email').value.trim();
  const rutDni = document.getElementById('edit-user-rut').value.trim();
  const role = document.getElementById('edit-user-role').value;
  const department = document.getElementById('edit-user-dept').value.trim();

  const submitBtn = document.getElementById('btn-submit-edit-user');
  const originalContent = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Guardando...';
  }

  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: userHeaders(),
      body: JSON.stringify({ name, email, rutDni, role, department })
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al actualizar usuario');

    showToast(`Datos de ${json.data.name} actualizados con éxito`, 'success');
    closeEditUserModal();

    // Si el usuario editado es la cuenta activa, actualizar estado
    if (state.currentUser.email === email || state.currentUser.id === Number(id)) {
      state.currentUser.name = json.data.name;
      state.currentUser.email = json.data.email;
      state.currentUser.role = json.data.role;
      saveSessionUser(state.currentUser);
      renderNavForRole(state.currentUser.role);
    }

    await loadAdminUsers();
  } catch (err) {
    console.error('Error al editar usuario:', err);
    showToast(err.message || 'Error al actualizar datos del usuario', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalContent;
    }
  }
}

async function handleCreateUserSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('admin-user-name').value.trim();
  const email = document.getElementById('admin-user-email').value.trim();
  const rutDni = document.getElementById('admin-user-rut').value.trim();
  const role = document.getElementById('admin-user-role').value;
  const department = document.getElementById('admin-user-dept').value.trim();

  try {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: userHeaders(),
      body: JSON.stringify({ name, email, rutDni, role, department })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast(`Usuario ${name} registrado con clave civic123`, 'success');
    dom.formCreateUser.reset();
    await loadAdminUsers();
  } catch (err) {
    console.error('Error al crear usuario:', err);
    showToast('Error al registrar usuario', 'error');
  }
}

async function toggleUserStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/admin/users/${id}/status`, {
      method: 'PATCH',
      headers: userHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast(`Estado de usuario actualizado a ${newStatus}`, 'success');
    await loadAdminUsers();
  } catch (err) {
    console.error('Error al cambiar estado de usuario:', err);
    showToast('Error al actualizar estado', 'error');
  }
}

// Moderación Canónica de Reportes
function renderAdminModerationList() {
  const list = dom.adminModerationList;
  if (!list) return;

  if (!state.selectedModerationId && dom.adminEditPanel) {
    dom.adminEditPanel.classList.add('hidden');
  }

  if (state.incidents.length === 0) {
    list.innerHTML = `<div class="col-span-full p-6 text-center text-outline">No hay incidencias para moderar</div>`;
    return;
  }

  list.innerHTML = state.incidents.map(inc => {
    const isSelected = state.selectedModerationId === inc.id;
    return `
    <div class="p-3.5 sm:p-4 rounded-xl border ${isSelected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-outline-variant/20 bg-surface-container-lowest hover:border-primary/50'} shadow-sm flex items-center justify-between gap-2.5 sm:gap-3 cursor-pointer transition-all hover:shadow-md" onclick="window.civicApp.openModerationFor('${escapeHtml(inc.id)}')">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span class="font-mono text-xs font-bold text-primary">${escapeHtml(inc.folio)}</span>
          <span class="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-bold text-[10px]">
            Prioridad ${escapeHtml(inc.priorityLevel)} (${escapeHtml(inc.priorityLabel)})
          </span>
        </div>
        <h4 class="font-bold text-sm text-on-surface truncate mt-1">${escapeHtml(inc.title)}</h4>
        <p class="text-xs text-outline truncate">${escapeHtml(inc.address)}</p>
      </div>
      <div class="flex items-center gap-1 shrink-0 ${isSelected ? 'bg-primary text-on-primary' : 'bg-primary/10 text-primary'} font-bold text-xs px-2.5 py-1.5 rounded-lg transition-all">
        <span class="material-symbols-outlined text-[16px]">edit</span>
        <span>${isSelected ? 'Editando' : 'Editar'}</span>
      </div>
    </div>
    `;
  }).join('');
}

function openModerationFor(incidentId) {
  const inc = state.incidents.find(i => i.id === incidentId);
  if (!inc) return;

  state.selectedModerationId = inc.id;

  // Solo cambiar de vista si no estamos ya en Edición (evita el salto hacia arriba)
  if (state.currentView !== 'view-admin-moderation') {
    switchView('view-admin-moderation', { keepScroll: true });
  }

  if (dom.adminEditPanel) {
    dom.adminEditPanel.classList.remove('hidden');
  }
  if (dom.modIncidentId) dom.modIncidentId.value = inc.id;
  if (dom.modFolioTag) dom.modFolioTag.textContent = `${inc.folio} • ${inc.categoryLabel || ''}`;
  if (dom.modCategory) dom.modCategory.value = inc.category || 'vialidad';
  if (dom.modPriorityLevel) dom.modPriorityLevel.value = String(inc.priorityLevel || '1');
  if (dom.modAssignedTeam) dom.modAssignedTeam.value = inc.assignedTeam || '';
  if (dom.modTitle) dom.modTitle.value = inc.title || '';
  if (dom.modDesc) dom.modDesc.value = inc.description || '';

  renderAdminModerationList();

  // Desplazar siempre al editor dentro del contenedor con scroll (#main-scroll-container)
  if (dom.adminEditPanel) {
    requestAnimationFrame(() => {
      dom.adminEditPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  showToast(`Editando reporte ${inc.folio}`, 'info');
}

function closeModerationPanel() {
  state.selectedModerationId = null;
  if (dom.adminEditPanel) {
    dom.adminEditPanel.classList.add('hidden');
  }
  if (dom.modIncidentId) dom.modIncidentId.value = '';
  if (dom.modFolioTag) dom.modFolioTag.textContent = 'Selecciona un reporte';
  if (dom.modCategory) dom.modCategory.value = 'vialidad';
  if (dom.modPriorityLevel) dom.modPriorityLevel.value = '1';
  if (dom.modAssignedTeam) dom.modAssignedTeam.value = '';
  if (dom.modTitle) dom.modTitle.value = '';
  if (dom.modDesc) dom.modDesc.value = '';
  renderAdminModerationList();
}

async function loadAdminSettings() {
  try {
    const res = await fetch('/api/admin/settings', {
      headers: userHeaders()
    });
    if (!res.ok) return;
    const json = await res.json();
    const s = json.data || {};
    const municipalityEl = document.getElementById('setting-municipality');
    const phoneEl = document.getElementById('setting-phone');
    const slaEl = document.getElementById('setting-sla');
    if (municipalityEl && s.municipality_name) municipalityEl.value = s.municipality_name;
    if (phoneEl && s.emergency_phone) phoneEl.value = s.emergency_phone;
    if (slaEl && s.sla_hours) slaEl.value = s.sla_hours;
  } catch (err) {
    console.error('Error al cargar configuración municipal:', err);
  }
}

async function handleModerateSubmit(e) {
  e.preventDefault();
  const id = dom.modIncidentId ? dom.modIncidentId.value : '';
  if (!id) {
    showToast('Selecciona un reporte para moderar', 'error');
    return;
  }

  const category = dom.modCategory ? dom.modCategory.value : undefined;
  const priorityLevel = parseInt(dom.modPriorityLevel.value, 10);
  const assignedTeam = dom.modAssignedTeam.value.trim();
  const title = dom.modTitle.value.trim();
  const description = dom.modDesc.value.trim();

  try {
    const res = await fetch(`/api/admin/incidents/${id}/moderate`, {
      method: 'PATCH',
      headers: userHeaders(),
      body: JSON.stringify({ category, priorityLevel, assignedTeam, title, description })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast(`Incidencia ${id} moderada con éxito`, 'success');
    closeModerationPanel();
    await loadIncidents();
    renderAdminModerationList();
  } catch (err) {
    console.error('Error al moderar incidencia:', err);
    showToast('Error al aplicar cambios canónicos', 'error');
  }
}

function renderAuditLogsTable() {
  const tbody = dom.auditTableBody;
  if (!tbody) return;

  if (dom.auditStatEvents) dom.auditStatEvents.textContent = `${state.auditLogs.length} logs`;
  if (dom.auditStatAdminActions) {
    dom.auditStatAdminActions.textContent = String(auditCounts(state.auditLogs).admin);
  }
  if (dom.auditStatAuthEvents) {
    dom.auditStatAuthEvents.textContent = String(auditCounts(state.auditLogs).auth);
  }

  if (state.auditLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-outline">No hay eventos registrados en la bitácora</td></tr>`;
    return;
  }

  tbody.innerHTML = state.auditLogs.map(log => {
    let formattedDate = log.created_at;
    try {
      const d = new Date(log.created_at);
      formattedDate = d.toLocaleString('es-CL', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch (e) {}

    return `
    <tr class="hover:bg-surface-container-low transition-colors">
      <td class="py-2.5 px-3 text-outline text-[11px] whitespace-nowrap">${escapeHtml(formattedDate)}</td>
      <td class="py-2.5 px-3 font-bold text-primary whitespace-nowrap">${escapeHtml(log.action)}</td>
      <td class="py-2.5 px-3 whitespace-nowrap">${escapeHtml(log.actor_name)}</td>
      <td class="py-2.5 px-3 whitespace-nowrap"><span class="px-1.5 py-0.5 rounded bg-surface-container text-[10px] font-bold">${escapeHtml(log.actor_role)}</span></td>
      <td class="py-2.5 px-3 text-on-surface-variant">${escapeHtml(log.target_info || '-')}</td>
    </tr>
    `;
  }).join('');
}

function init() {
  const modalEditUser = document.getElementById('modal-edit-user');
  if (modalEditUser) {
    modalEditUser.addEventListener('click', (e) => {
      if (e.target === modalEditUser) closeEditUserModal();
    });
  }

  // Eventos Super Admin
  if (dom.formCreateUser) dom.formCreateUser.addEventListener('submit', handleCreateUserSubmit);
  if (dom.btnRefreshUsers) dom.btnRefreshUsers.addEventListener('click', loadAdminUsers);
  if (dom.formModerateIncident) dom.formModerateIncident.addEventListener('submit', handleModerateSubmit);
  if (dom.btnRefreshAudit) dom.btnRefreshAudit.addEventListener('click', loadAuditLogs);
  if (dom.btnSaveSettings) {
    dom.btnSaveSettings.addEventListener('click', async () => {
      try {
        const settings = {
          municipality_name: document.getElementById('setting-municipality').value.trim(),
          emergency_phone: document.getElementById('setting-phone').value.trim(),
          sla_hours: document.getElementById('setting-sla').value.trim()
        };

        for (const [key, value] of Object.entries(settings)) {
          const res = await fetch('/api/admin/settings', {
            method: 'POST',
            headers: userHeaders(),
            body: JSON.stringify({ key, value })
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }

        applyMunicipalitySettings(settings);
        await loadAuditLogs();
        await loadStats();

        showToast('Parámetros de la plataforma actualizados', 'success');
      } catch (err) {
        console.error('Error al guardar configuración:', err);
        showToast('Error al guardar configuración', 'error');
      }
    });
  }

  // Eventos de Modificación de Usuarios y Menú Desplegable
  const formEditUser = document.getElementById('form-edit-user');
  if (formEditUser) formEditUser.addEventListener('submit', handleEditUserSubmit);

  document.addEventListener('click', (e) => {
    const menu = document.getElementById('user-actions-dropdown-menu');
    if (menu && !menu.classList.contains('hidden')) {
      if (!menu.contains(e.target) && !e.target.closest('.user-actions-btn')) {
        closeUserActionsMenu();
      }
    }
  });

  // capture:true para detectar también scroll de contenedores internos (ej. tabla con overflow)
  document.addEventListener('scroll', (e) => {
    const menu = document.getElementById('user-actions-dropdown-menu');
    if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target)) {
      closeUserActionsMenu();
    }
  }, { passive: true, capture: true });
  window.addEventListener('resize', closeUserActionsMenu);
}

export { renderAdminHub, renderAdminUsersTable, openUserActionsMenu, closeUserActionsMenu, openEditUserModal, closeEditUserModal, toggleUserStatus, renderAdminModerationList, openModerationFor, closeModerationPanel, loadAdminSettings, renderAuditLogsTable, init };
