/**
 * CivicCore - Controlador Principal de la Aplicación Web (SPA)
 * Soporte Completo para 4 Niveles de Acceso y Sistema de Prioridades:
 *   1. Invitado (Guest): Solo genera reportes anónimos (Prioridad Normal).
 *   2. Vecino (Resident): Portal ciudadano, rastreo de folios, prioridad alta verificada.
 *   3. Trabajador (Municipal Worker): Bandeja comunal, mapa georreferenciado, panel KPIs y triaje.
 *   4. Super Admin (Root): Consola maestra, padrón de claves, moderación directa y auditoría legal.
 */

(function () {
  'use strict';

  // ==========================================
  // Estado Global de la Aplicación
  // ==========================================
  const state = {
    currentUser: {
      id: 0,
      name: 'Vecino Invitado',
      email: 'invitado@comuna.cl',
      role: 'invitado',
      rutDni: 'Sin DNI',
      department: 'Comunidad'
    },
    currentView: 'view-nuevo',
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

  // Configuración de Vistas Permitidas por Rol
  const ROLE_PERMISSIONS = {
    invitado: {
      defaultView: 'view-nuevo',
      allowedViews: ['view-nuevo'],
      label: 'Invitado',
      badgeClass: 'bg-slate-200 text-slate-800',
      description: 'Acceso público para generación rápida de reportes urbanos sin credenciales.'
    },
    vecino: {
      defaultView: 'view-vecino',
      allowedViews: ['view-vecino', 'view-nuevo'],
      label: 'Vecino Verificado',
      badgeClass: 'bg-emerald-100 text-emerald-800',
      description: 'Portal vecinal acreditado. Seguimiento de folios y prioridad comunal.'
    },
    trabajador: {
      defaultView: 'view-incidencias',
      allowedViews: ['view-incidencias', 'view-mapa', 'view-panel', 'view-nuevo'],
      label: 'Funcionario Municipal',
      badgeClass: 'bg-blue-100 text-blue-800',
      description: 'Mando operativo municipal: bandeja de triaje, mapa georreferenciado y KPIs.'
    },
    admin: {
      defaultView: 'view-admin-hub',
      allowedViews: ['view-admin-hub', 'view-admin-users', 'view-admin-moderation', 'view-admin-audit', 'view-incidencias', 'view-mapa', 'view-panel', 'view-nuevo'],
      label: 'Super Administrador',
      badgeClass: 'bg-red-100 text-red-800',
      description: 'Control del sistema: gobernanza de claves, moderación y trazabilidad CGR.'
    }
  };

  // ==========================================
  // Inicialización y Cache de Elementos del DOM
  // ==========================================
  const dom = {
    views: document.querySelectorAll('.view-panel'),
    headerTitle: document.getElementById('header-view-title'),
    headerContextTag: document.getElementById('header-context-tag'),
    roleInfoBanner: document.getElementById('role-info-banner'),
    sidebarNavMenu: document.getElementById('sidebar-nav-menu'),
    mobileNavContainer: document.getElementById('mobile-bottom-nav-container'),
    mobileBottomNav: document.getElementById('mobile-bottom-nav'),
    sidebarDesktop: document.getElementById('sidebar-desktop'),
    btnSidebarNuevo: document.getElementById('btn-sidebar-nuevo'),
    btnSidebarNuevoText: document.getElementById('btn-sidebar-nuevo-text'),
    sidebarUserName: document.getElementById('sidebar-user-name'),
    sidebarUserRole: document.getElementById('sidebar-user-role'),
    sidebarAvatarIcon: document.getElementById('sidebar-avatar-icon'),
    currentUserBadge: document.getElementById('current-user-badge'),
    userDisplayName: document.getElementById('user-display-name'),
    userDisplayRole: document.getElementById('user-display-role'),
    btnAuthText: document.getElementById('btn-auth-text'),
    rolePills: document.querySelectorAll('.role-pill'),

    // Bandeja de Incidencias
    incidentsContainer: document.getElementById('incidents-container'),
    inputSearch: document.getElementById('input-search'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    selectFilterCategory: document.getElementById('select-filter-category'),
    statusTabs: document.querySelectorAll('.tab-status'),
    tabCountAll: document.getElementById('tab-count-all'),
    tabCountNew: document.getElementById('tab-count-new'),
    tabCountProgress: document.getElementById('tab-count-progress'),
    tabCountResolved: document.getElementById('tab-count-resolved'),

    // Formulario Registro
    form: document.getElementById('incident-form'),
    formFolioPreview: document.getElementById('form-folio-preview'),
    formPriorityBadge: document.getElementById('form-priority-preview-badge'),
    stepLabel: document.getElementById('step-label'),
    stepIndicator: document.getElementById('step-indicator'),
    stepProgressBar: document.getElementById('step-progress-bar'),
    urgencyRoleNote: document.getElementById('urgency-role-note'),

    // Portal Vecino
    portalVecinoGreeting: document.getElementById('portal-vecino-greeting'),
    folioTrackerForm: document.getElementById('folio-tracker-form'),
    folioInput: document.getElementById('folio-input'),
    folioResultBox: document.getElementById('folio-result-box'),
    trackerResFolio: document.getElementById('tracker-res-folio'),
    trackerResStatus: document.getElementById('tracker-res-status'),
    trackerResPriority: document.getElementById('tracker-res-priority'),
    trackerResTitle: document.getElementById('tracker-res-title'),
    trackerResAddress: document.getElementById('tracker-res-address'),
    btnViewTrackedDetail: document.getElementById('btn-view-tracked-detail'),
    vecinoIncidentsGrid: document.getElementById('vecino-incidents-grid'),
    vecinoReportCount: document.getElementById('vecino-report-count'),

    // Mapa
    mapPinsLayer: document.getElementById('map-pins-layer'),
    mapSectorBtns: document.querySelectorAll('.map-sector-btn'),
    mapIncidentPreview: document.getElementById('map-incident-preview'),
    previewFolio: document.getElementById('preview-folio'),
    previewStatus: document.getElementById('preview-status'),
    previewTitle: document.getElementById('preview-title'),
    previewAddress: document.getElementById('preview-address'),
    btnCloseMapPreview: document.getElementById('btn-close-map-preview'),

    // KPIs Panel Municipal
    kpiTotal: document.getElementById('kpi-total'),
    kpiNew: document.getElementById('kpi-new'),
    kpiProgress: document.getElementById('kpi-progress'),
    kpiResolved: document.getElementById('kpi-resolved'),
    kpiRate: document.getElementById('kpi-rate'),
    categoriesStatsBars: document.getElementById('categories-stats-bars'),

    // Super Admin Hub & Moderación
    adminCriticalAlertsContainer: document.getElementById('admin-critical-alerts-container'),
    adminUsersTableBody: document.getElementById('admin-users-table-body'),
    formCreateUser: document.getElementById('form-create-user'),
    btnRefreshUsers: document.getElementById('btn-refresh-users'),
    adminEditPanel: document.getElementById('admin-edit-panel'),
    formModerateIncident: document.getElementById('form-moderate-incident'),
    modIncidentId: document.getElementById('mod-incident-id'),
    modFolioTag: document.getElementById('mod-folio-tag'),
    modPriorityLevel: document.getElementById('mod-priority-level'),
    modAssignedTeam: document.getElementById('mod-assigned-team'),
    modTitle: document.getElementById('mod-title'),
    modDesc: document.getElementById('mod-desc'),
    adminModerationList: document.getElementById('admin-moderation-list'),
    auditTableBody: document.getElementById('audit-table-body'),
    auditStatEvents: document.getElementById('audit-stat-events'),
    btnRefreshAudit: document.getElementById('btn-refresh-audit'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    adminKpiVecinos: document.getElementById('admin-kpi-vecinos'),
    adminKpiFuncionarios: document.getElementById('admin-kpi-funcionarios'),
    adminKpiReportes: document.getElementById('admin-kpi-reportes'),
    adminKpiCriticos: document.getElementById('admin-kpi-criticos'),

    // Modales
    modalAuth: document.getElementById('modal-auth'),
    btnOpenAuthModal: document.getElementById('btn-open-auth-modal'),
    btnCloseAuthModal: document.getElementById('btn-close-auth-modal'),
    formAuthLogin: document.getElementById('form-auth-login'),
    authInputEmail: document.getElementById('auth-input-email'),
    authInputPassword: document.getElementById('auth-input-password'),
    btnTogglePassword: document.getElementById('btn-toggle-password'),

    modalIncident: document.getElementById('modal-incident-detail'),
    modalImg: document.getElementById('modal-img'),
    modalFolio: document.getElementById('modal-folio'),
    modalStatusBadge: document.getElementById('modal-status-badge'),
    modalPriorityBadge: document.getElementById('modal-priority-badge'),
    modalTitle: document.getElementById('modal-title'),
    modalAddress: document.getElementById('modal-address'),
    modalDesc: document.getElementById('modal-desc'),
    modalReportedBy: document.getElementById('modal-reportedBy'),
    modalChannel: document.getElementById('modal-channel'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnChangeStatus: document.querySelectorAll('.btn-change-status'),
    modalStatusActionsContainer: document.getElementById('modal-status-actions-container'),

    // Utilidades
    btnSyncAll: document.getElementById('btn-sync-all'),
    toastContainer: document.getElementById('toast-container'),

    // Cambio de Contraseña
    sidebarBtnChangePassword: document.getElementById('sidebar-btn-change-password'),
    modalChangePassword: document.getElementById('modal-change-password'),
    btnClosePasswordModal: document.getElementById('btn-close-password-modal'),
    btnCancelChangePwd: document.getElementById('btn-cancel-change-pwd'),
    formChangePassword: document.getElementById('form-change-password'),
    changePwdTitle: document.getElementById('change-pwd-modal-title'),
    changePwdUserName: document.getElementById('change-pwd-user-name'),
    changePwdUserEmail: document.getElementById('change-pwd-user-email'),
    changePwdTargetId: document.getElementById('change-pwd-target-id'),
    changePwdTargetEmail: document.getElementById('change-pwd-target-email'),
    inputNewPassword: document.getElementById('input-new-password'),
    inputConfirmPassword: document.getElementById('input-confirm-password'),
    btnToggleNewPwd: document.getElementById('btn-toggle-new-pwd'),
    btnToggleConfirmPwd: document.getElementById('btn-toggle-confirm-pwd')
  };

  // ==========================================
  // Navegación & Control de Vistas por Rol
  // ==========================================
  function switchView(targetViewId, options = {}) {
    const roleConfig = ROLE_PERMISSIONS[state.currentUser.role] || ROLE_PERMISSIONS.invitado;

    // Verificar si el rol tiene permiso para acceder a la vista
    if (!roleConfig.allowedViews.includes(targetViewId)) {
      showToast(`El rol ${roleConfig.label} no tiene acceso a esta sección. Redirigiendo...`, 'info');
      targetViewId = roleConfig.defaultView;
    }

    state.currentView = targetViewId;

    // Ocultar todas las vistas y mostrar la activa
    dom.views.forEach(v => {
      if (v.id === targetViewId) {
        v.classList.remove('hidden');
      } else {
        v.classList.add('hidden');
      }
    });

    // Actualizar estados visuales de los enlaces activos
    updateActiveNavIndicators(targetViewId);

    // Actualizar títulos del Header
    updateHeaderTitles(targetViewId);

    // Acciones específicas al ingresar a una vista
    if (targetViewId === 'view-mapa') {
      renderMapPins();
    } else if (targetViewId === 'view-panel') {
      renderDashboardStats();
    } else if (targetViewId === 'view-nuevo') {
      updateFolioPreview();
      updateFormUrgencyBadge();
      const reportedByEl = document.getElementById('input-reportedBy');
      if (reportedByEl) {
        if (state.currentUser.role !== 'invitado') {
          reportedByEl.placeholder = state.currentUser.name;
          if (!reportedByEl.value) reportedByEl.value = state.currentUser.name;
        } else {
          reportedByEl.placeholder = 'Ej: Carmen Soto (o déjalo en blanco si eres anónimo)';
          if (reportedByEl.value === 'Carmen Soto' || reportedByEl.value === 'Lic. Elena Morales' || reportedByEl.value === 'Super Admin Root') {
            reportedByEl.value = '';
          }
        }
      }
    } else if (targetViewId === 'view-vecino') {
      renderVecinoPortal();
    } else if (targetViewId === 'view-admin-hub') {
      renderAdminHub();
    } else if (targetViewId === 'view-admin-users') {
      loadAdminUsers();
    } else if (targetViewId === 'view-admin-moderation') {
      renderAdminModerationList();
    } else if (targetViewId === 'view-admin-audit') {
      loadAuditLogs();
      loadAdminSettings();
    }

    if (!options.keepScroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function updateHeaderTitles(viewId) {
    const titles = {
      'view-nuevo': { title: 'Generar Reporte Ciudadano', context: 'Ingreso Comunal' },
      'view-vecino': { title: 'Portal Vecinal Ciudadano', context: 'Comunidad Conectada' },
      'view-incidencias': { title: 'Bandeja de Incidencias', context: 'Despacho y Triaje' },
      'view-mapa': { title: 'Mapa Comunal de Incidencias', context: 'Georreferenciación' },
      'view-panel': { title: 'Panel de Gestión Municipal', context: 'KPIs y Métricas' },
      'view-admin-hub': { title: 'Admin Hub • Consola Maestra', context: 'Gobernanza TI' },
      'view-admin-users': { title: 'Padrón y Emisión de Claves', context: 'Seguridad' },
      'view-admin-moderation': { title: 'Gobernanza & Edición Canónica', context: 'Moderación' },
      'view-admin-audit': { title: 'Auditoría & Trazabilidad (Ley 19.628)', context: 'Fe Pública' }
    };

    const info = titles[viewId] || { title: 'CivicCore', context: 'Municipalidad' };
    if (dom.headerTitle) dom.headerTitle.textContent = info.title;
    if (dom.headerContextTag) dom.headerContextTag.textContent = info.context;
  }

  function updateActiveNavIndicators(viewId) {
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      const target = item.getAttribute('data-target');
      if (target === viewId) {
        item.className = 'sidebar-nav-item active w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-xs transition-all text-primary bg-surface-container-high shadow-sm';
      } else {
        item.className = 'sidebar-nav-item w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all';
      }
    });

    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      const target = btn.getAttribute('data-target');
      if (target === viewId) {
        btn.classList.add('text-primary', 'font-bold');
        btn.classList.remove('text-on-surface-variant');
      } else {
        btn.classList.remove('text-primary', 'font-bold');
        btn.classList.add('text-on-surface-variant');
      }
    });
  }

  // ==========================================
  // Renderizado Dinámico de Menús según Rol
  // ==========================================
  function renderNavForRole(role) {
    const roleConfig = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.invitado;

    // 1. Selector de Roles Superior (si existe)
    if (dom.rolePills && dom.rolePills.length > 0) {
      dom.rolePills.forEach(pill => {
        const pillRole = pill.getAttribute('data-role');
        if (pillRole === role) {
          pill.className = 'role-pill px-2.5 py-1 rounded-lg font-bold text-[11px] bg-primary text-on-primary shadow-sm transition-all flex items-center gap-1';
        } else {
          pill.className = 'role-pill px-2.5 py-1 rounded-lg font-semibold text-[11px] text-on-surface-variant hover:bg-surface-container transition-all flex items-center gap-1';
        }
      });
    }

    // 2. Control de Visibilidad de Paneles según Rol
    if (role === 'invitado') {
      // Para invitado: ocultar sidebar en desktop, barra inferior en móvil y badge de usuario
      if (dom.sidebarDesktop) dom.sidebarDesktop.classList.add('lg:hidden');
      if (dom.mobileBottomNav) dom.mobileBottomNav.classList.add('hidden');
      if (dom.currentUserBadge) {
        dom.currentUserBadge.classList.add('hidden');
        dom.currentUserBadge.classList.remove('flex');
      }
      if (dom.sidebarBtnChangePassword) dom.sidebarBtnChangePassword.classList.add('hidden');
      if (dom.btnAuthText) dom.btnAuthText.textContent = 'Iniciar Sesión';
      if (dom.roleInfoBanner) {
        dom.roleInfoBanner.innerHTML = '';
        dom.roleInfoBanner.classList.add('hidden');
      }
    } else {
      // Para usuarios autenticados: mostrar sidebar, barra móvil y badge de usuario
      if (dom.sidebarDesktop) dom.sidebarDesktop.classList.remove('lg:hidden');
      if (dom.mobileBottomNav) dom.mobileBottomNav.classList.remove('hidden');
      if (dom.currentUserBadge) {
        dom.currentUserBadge.classList.remove('hidden');
        dom.currentUserBadge.classList.add('flex');
      }
      if (dom.sidebarBtnChangePassword) dom.sidebarBtnChangePassword.classList.remove('hidden');
      if (dom.btnAuthText) dom.btnAuthText.textContent = 'Cerrar Sesión';
      if (dom.roleInfoBanner) {
        dom.roleInfoBanner.innerHTML = '';
        dom.roleInfoBanner.classList.add('hidden');
      }
    }

    // 3. Renderizar Sidebar Desktop
    let sidebarHtml = '';

    if (role === 'invitado') {
      sidebarHtml = `
        <div class="px-3 py-2 text-[10px] font-bold text-outline uppercase tracking-wider">Menú Invitado</div>
        <button data-target="view-nuevo" class="sidebar-nav-item active w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-xs transition-all text-primary bg-surface-container-high shadow-sm">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[20px]">add_alert</span>
            <span>Generar Reporte</span>
          </div>
          <span class="px-1.5 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-bold">1</span>
        </button>
        <button onclick="window.civicApp.openAuthModal()" class="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl font-medium text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all mt-2">
          <span class="material-symbols-outlined text-[20px]">vpn_key</span>
          <span>Acceder con Cuenta</span>
        </button>
      `;
    } else if (role === 'vecino') {
      sidebarHtml = `
        <div class="px-3 py-2 text-[10px] font-bold text-outline uppercase tracking-wider">Menú Vecinal</div>
        <button data-target="view-vecino" class="sidebar-nav-item active w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-xs transition-all text-primary bg-surface-container-high shadow-sm">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[20px]">cottage</span>
            <span>Portal Vecinal</span>
          </div>
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </button>
        <button data-target="view-nuevo" class="sidebar-nav-item w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[20px]">add_alert</span>
            <span>Reportar Incidencia</span>
          </div>
          <span class="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Alta Prioridad</span>
        </button>
      `;
    } else if (role === 'trabajador') {
      sidebarHtml = `
        <div class="px-3 py-2 text-[10px] font-bold text-outline uppercase tracking-wider">Operaciones Municipales</div>
        <button data-target="view-incidencias" class="sidebar-nav-item active w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-xs transition-all text-primary bg-surface-container-high shadow-sm">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[20px]">assignment</span>
            <span>Bandeja de Reportes</span>
          </div>
          <span id="badge-total-incidencias" class="px-2 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-bold">${state.incidents.length}</span>
        </button>
        <button data-target="view-mapa" class="sidebar-nav-item w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[20px]">map</span>
            <span>Mapa Comunal</span>
          </div>
          <span class="w-2 h-2 rounded-full bg-tertiary-container animate-ping"></span>
        </button>
        <button data-target="view-panel" class="sidebar-nav-item w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[20px]">dashboard</span>
            <span>Panel de Gestión (KPIs)</span>
          </div>
        </button>
      `;
    } else if (role === 'admin') {
      sidebarHtml = `
        <div class="px-3 py-2 text-[10px] font-bold text-outline uppercase tracking-wider">Super Admin Hub</div>
        <button data-target="view-admin-hub" class="sidebar-nav-item active w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-xs transition-all text-primary bg-surface-container-high shadow-sm">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[20px]">shield_person</span>
            <span>Consola Maestra</span>
          </div>
          <span class="px-1.5 py-0.5 rounded-full bg-error text-on-error text-[9px] font-bold">ROOT</span>
        </button>
        <button data-target="view-admin-users" class="sidebar-nav-item w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[20px]">vpn_key</span>
            <span>Padrón & Claves</span>
          </div>
        </button>
        <button data-target="view-admin-moderation" class="sidebar-nav-item w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[20px]">edit_note</span>
            <span>Edición Canónica</span>
          </div>
        </button>
        <button data-target="view-admin-audit" class="sidebar-nav-item w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[20px]">history_edu</span>
            <span>Auditoría Legal</span>
          </div>
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </button>
        <div class="pt-3 border-t border-outline-variant/20">
          <div class="px-3 py-1 text-[10px] font-bold text-outline uppercase tracking-wider">Supervisión Comunal</div>
          <button data-target="view-incidencias" class="sidebar-nav-item w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]">assignment</span>
              <span>Bandeja General</span>
            </div>
          </button>
        </div>
      `;
    }

    dom.sidebarNavMenu.innerHTML = sidebarHtml;

    // Asignar listeners a los nuevos botones del sidebar
    dom.sidebarNavMenu.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const target = item.getAttribute('data-target');
        switchView(target);
      });
    });

    // 4. Renderizar Barra Móvil Inferior
    let mobileHtml = '';
    if (role === 'invitado') {
      mobileHtml = `
        <button data-target="view-nuevo" class="mobile-nav-btn active flex flex-col items-center justify-center min-w-[56px] text-primary font-bold">
          <span class="material-symbols-outlined text-[24px]">add_circle</span>
          <span class="text-[10px] mt-0.5">Reportar</span>
        </button>
        <button onclick="window.civicApp.openAuthModal()" class="mobile-nav-btn flex flex-col items-center justify-center min-w-[56px] text-on-surface-variant">
          <span class="material-symbols-outlined text-[24px]">login</span>
          <span class="text-[10px] mt-0.5">Acceder</span>
        </button>
      `;
    } else if (role === 'vecino') {
      mobileHtml = `
        <button data-target="view-vecino" class="mobile-nav-btn active flex flex-col items-center justify-center min-w-[56px] text-primary font-bold">
          <span class="material-symbols-outlined text-[24px]">cottage</span>
          <span class="text-[10px] mt-0.5">Vecinal</span>
        </button>
        <div class="relative -top-4">
          <button onclick="window.civicApp.switchView('view-nuevo')" class="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-all">
            <span class="material-symbols-outlined text-[26px]">add</span>
          </button>
        </div>
        <button onclick="window.civicApp.logout()" class="mobile-nav-btn flex flex-col items-center justify-center min-w-[56px] text-on-surface-variant">
          <span class="material-symbols-outlined text-[24px]">logout</span>
          <span class="text-[10px] mt-0.5">Salir</span>
        </button>
      `;
    } else if (role === 'trabajador') {
      mobileHtml = `
        <button data-target="view-incidencias" class="mobile-nav-btn active flex flex-col items-center justify-center min-w-[56px] text-primary font-bold">
          <span class="material-symbols-outlined text-[22px]">assignment</span>
          <span class="text-[10px] mt-0.5">Bandeja</span>
        </button>
        <button data-target="view-mapa" class="mobile-nav-btn flex flex-col items-center justify-center min-w-[56px] text-on-surface-variant">
          <span class="material-symbols-outlined text-[22px]">map</span>
          <span class="text-[10px] mt-0.5">Mapa</span>
        </button>
        <div class="relative -top-4">
          <button onclick="window.civicApp.switchView('view-nuevo')" class="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-all">
            <span class="material-symbols-outlined text-[26px]">add</span>
          </button>
        </div>
        <button data-target="view-panel" class="mobile-nav-btn flex flex-col items-center justify-center min-w-[56px] text-on-surface-variant">
          <span class="material-symbols-outlined text-[22px]">dashboard</span>
          <span class="text-[10px] mt-0.5">KPIs</span>
        </button>
      `;
    } else if (role === 'admin') {
      mobileHtml = `
        <button data-target="view-admin-hub" class="mobile-nav-btn active flex flex-col items-center justify-center min-w-[56px] text-primary font-bold">
          <span class="material-symbols-outlined text-[22px]">shield_person</span>
          <span class="text-[10px] mt-0.5">Hub</span>
        </button>
        <button data-target="view-admin-users" class="mobile-nav-btn flex flex-col items-center justify-center min-w-[56px] text-on-surface-variant">
          <span class="material-symbols-outlined text-[22px]">vpn_key</span>
          <span class="text-[10px] mt-0.5">Claves</span>
        </button>
        <button data-target="view-admin-moderation" class="mobile-nav-btn flex flex-col items-center justify-center min-w-[56px] text-on-surface-variant">
          <span class="material-symbols-outlined text-[22px]">edit_note</span>
          <span class="text-[10px] mt-0.5">Moderar</span>
        </button>
        <button data-target="view-admin-audit" class="mobile-nav-btn flex flex-col items-center justify-center min-w-[56px] text-on-surface-variant">
          <span class="material-symbols-outlined text-[22px]">history_edu</span>
          <span class="text-[10px] mt-0.5">Auditoría</span>
        </button>
      `;
    }

    dom.mobileNavContainer.innerHTML = mobileHtml;

    // Asignar listeners barra móvil
    dom.mobileNavContainer.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        if (target) switchView(target);
      });
    });

    // 5. Actualizar Widgets de Perfil
    if (dom.userDisplayName) dom.userDisplayName.textContent = state.currentUser.name;
    if (dom.userDisplayRole) {
      dom.userDisplayRole.textContent = state.currentUser.role;
      dom.userDisplayRole.className = `px-1.5 py-0.2 rounded-full font-bold uppercase text-[9px] ${roleConfig.badgeClass}`;
    }
    if (dom.sidebarUserName) dom.sidebarUserName.textContent = state.currentUser.name;
    if (dom.sidebarUserRole) dom.sidebarUserRole.textContent = `${roleConfig.label}`;
    if (dom.sidebarAvatarIcon) {
      dom.sidebarAvatarIcon.textContent = role === 'admin' ? 'shield_person' : (role === 'trabajador' ? 'engineering' : (role === 'vecino' ? 'cottage' : 'person'));
    }
    if (dom.btnAuthText) {
      dom.btnAuthText.textContent = role === 'invitado' ? 'Iniciar Sesión' : 'Cerrar Sesión';
    }

    // 6. Configurar Formulario según Rol
    updateFormUrgencyBadge();
  }

  // ==========================================
  // Carga de Datos desde la API REST
  // ==========================================
  async function loadIncidents() {
    try {
      const res = await fetch('/api/incidents', {
        headers: {
          'x-user-role': state.currentUser.role,
          'x-user-name': state.currentUser.name
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      state.incidents = json.data || [];

      renderIncidentsList();
      renderVecinoPortal();
      updateTabCounters();
      renderMapPins();
      renderAdminHub();
      renderAdminModerationList();
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
      renderDashboardStats();
      renderAdminHub();
    } catch (err) {
      console.error('Error al cargar métricas:', err);
    }
  }

  // ==========================================
  // Nivel 3: Renderizado de Bandeja de Incidencias con Prioridades
  // ==========================================
  function renderIncidentsList() {
    const container = dom.incidentsContainer;
    if (!container) return;

    let filtered = [...state.incidents];

    if (state.filterStatus !== 'all') {
      filtered = filtered.filter(i => i.status === state.filterStatus);
    }

    if (state.filterCategory !== 'all') {
      filtered = filtered.filter(i => i.category === state.filterCategory);
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter(i =>
        (i.folio || '').toLowerCase().includes(q) ||
        (i.title || '').toLowerCase().includes(q) ||
        (i.address || '').toLowerCase().includes(q) ||
        (i.categoryLabel || '').toLowerCase().includes(q) ||
        (i.reportedBy || '').toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full bg-surface-container-lowest rounded-2xl p-12 text-center border border-outline-variant/20 shadow-sm">
          <span class="material-symbols-outlined text-5xl text-outline mb-3">search_off</span>
          <h3 class="text-base font-bold text-on-surface">No se encontraron reportes con los filtros seleccionados</h3>
          <p class="text-xs text-outline mt-1 max-w-sm mx-auto">Prueba cambiando el estado operativo o la categoría.</p>
        </div>
      `;
      return;
    }

    // Badges de Estado
    const statusBadges = {
      new: '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary text-[11px] font-bold"><span class="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>Nueva</span>',
      progress: '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-secondary text-[11px] font-bold"><span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>En Terreno</span>',
      resolved: '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-tertiary text-[11px] font-bold"><span class="material-symbols-outlined text-[13px]">check</span>Resuelta</span>'
    };

    // Badges de Prioridad (Funcionario > Vecino > Invitado)
    function getPriorityBadge(level, label) {
      if (level >= 4) {
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-wide shadow-sm"><span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>P4 • Crítica (Admin)</span>`;
      }
      if (level === 3) {
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wide"><span class="material-symbols-outlined text-[11px]">bolt</span>P3 • Muy Alta (Funcionario)</span>`;
      }
      if (level === 2) {
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wide"><span class="material-symbols-outlined text-[11px]">verified</span>P2 • Alta (Vecino)</span>`;
      }
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">P1 • Normal (Invitado)</span>`;
    }

    container.innerHTML = filtered.map(incident => `
      <article class="bg-surface-container-lowest rounded-2xl p-5 shadow-sm hover:shadow-md border border-outline-variant/20 transition-all flex flex-col justify-between gap-3.5">
        
        <div>
          <!-- Cabecera de Prioridad y Folio -->
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono text-xs font-bold text-primary">${incident.folio}</span>
              ${getPriorityBadge(incident.priorityLevel, incident.priorityLabel)}
            </div>
            ${statusBadges[incident.status] || ''}
          </div>

          <!-- Título y Miniatura -->
          <div class="flex gap-3 items-start mt-1">
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-bold text-on-surface leading-snug line-clamp-2">${incident.title}</h3>
              <p class="text-xs text-outline flex items-center gap-1 mt-1 truncate">
                <span class="material-symbols-outlined text-[14px] shrink-0 text-primary">pin_drop</span>
                <span class="truncate">${incident.address}</span>
              </p>
            </div>
            ${incident.image ? `
              <div class="w-13 h-13 rounded-xl overflow-hidden bg-surface-container shrink-0 shadow-sm">
                <img src="${incident.image}" alt="Evidencia" class="w-full h-full object-cover">
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Info Cuadrilla y Rol del Denunciante -->
        <div class="p-2.5 rounded-xl bg-surface-container-low text-xs space-y-1">
          <div class="flex items-center justify-between text-on-surface-variant font-medium">
            <span class="flex items-center gap-1.5 truncate">
              <span class="material-symbols-outlined text-[15px] text-primary shrink-0">engineering</span>
              <span class="truncate">${incident.assignedTeam || 'Sin cuadrilla asignada'}</span>
            </span>
          </div>
          <div class="text-[11px] text-outline flex items-center justify-between pt-0.5">
            <span>Actor: <strong>${incident.reportedBy || 'Anónimo'}</strong></span>
            <span class="capitalize text-primary font-bold">(${incident.reportedByRole || 'invitado'})</span>
          </div>
        </div>

        <!-- Botón Ver y Gestionar -->
        <div class="flex items-center justify-between pt-1 border-t border-outline-variant/10">
          <span class="text-[11px] text-outline flex items-center gap-1">
            <span class="material-symbols-outlined text-[13px]">location_city</span>
            ${incident.sectorLabel || 'Sector'}
          </span>
          <button class="btn-open-detail flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-container text-primary text-xs font-bold hover:bg-surface-container-high transition-all active:scale-95" data-id="${incident.id}">
            <span>Gestionar Triaje</span>
            <span class="material-symbols-outlined text-[14px]">chevron_right</span>
          </button>
        </div>

      </article>
    `).join('');

    container.querySelectorAll('.btn-open-detail').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openIncidentModal(id);
      });
    });
  }

  function updateTabCounters() {
    const total = state.incidents.length;
    const countNew = state.incidents.filter(i => i.status === 'new').length;
    const countProgress = state.incidents.filter(i => i.status === 'progress').length;
    const countResolved = state.incidents.filter(i => i.status === 'resolved').length;

    if (dom.tabCountAll) dom.tabCountAll.textContent = total;
    if (dom.tabCountNew) dom.tabCountNew.textContent = countNew;
    if (dom.tabCountProgress) dom.tabCountProgress.textContent = countProgress;
    if (dom.tabCountResolved) dom.tabCountResolved.textContent = countResolved;

    const badgeTotal = document.getElementById('badge-total-incidencias');
    if (badgeTotal) badgeTotal.textContent = total;
  }

  // ==========================================
  // Nivel 2: Portal Vecinal Ciudadano
  // ==========================================
  function renderVecinoPortal() {
    if (dom.portalVecinoGreeting) {
      dom.portalVecinoGreeting.textContent = `¡Hola, ${state.currentUser.name}!`;
    }

    const grid = dom.vecinoIncidentsGrid;
    if (!grid) return;

    // Filtrar reportes recientes
    const recent = state.incidents.slice(0, 6);
    if (dom.vecinoReportCount) dom.vecinoReportCount.textContent = `${state.incidents.length} reportes en la comuna`;

    grid.innerHTML = recent.map(inc => `
      <div class="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/20 flex flex-col justify-between gap-3">
        <div>
          <div class="flex items-center justify-between text-xs mb-1.5">
            <span class="font-mono font-bold text-primary">${inc.folio}</span>
            <span class="px-2 py-0.2 rounded-full ${inc.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-primary-fixed text-primary'} font-bold text-[10px]">
              ${inc.statusLabel}
            </span>
          </div>
          <h4 class="font-bold text-sm text-on-surface line-clamp-2">${inc.title}</h4>
          <p class="text-xs text-outline flex items-center gap-1 mt-1 truncate">
            <span class="material-symbols-outlined text-[14px] text-primary">pin_drop</span>
            <span>${inc.address}</span>
          </p>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-outline-variant/10 text-xs">
          <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px]">
            ${inc.priorityLabel || 'Alta (Vecino)'}
          </span>
          <button onclick="window.civicApp.trackFolioNumber('${inc.id}')" class="text-primary font-bold hover:underline flex items-center gap-0.5 text-xs">
            <span>Rastrear</span>
            <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>
      </div>
    `).join('');
  }

  async function handleFolioTracking(folioInput) {
    const raw = (folioInput || (dom.folioInput ? dom.folioInput.value : '') || '').trim();
    if (!raw) {
      showToast('Ingresa un número de folio para rastrear', 'info');
      return;
    }

    const clean = raw.replace('#', '').toUpperCase();
    let found = state.incidents.find(i => (i.id && i.id.toUpperCase() === clean) || (i.folio && i.folio.toUpperCase().includes(clean)));

    // Si no está en la lista en memoria, buscar directamente en el servidor
    if (!found) {
      try {
        const queryId = clean.startsWith('CIV-') ? clean : `CIV-${clean}`;
        const res = await fetch(`/api/incidents/${queryId}`);
        if (res.ok) {
          const json = await res.json();
          found = json.data;
        }
      } catch (e) {}
    }

    if (!found) {
      showToast(`No se encontró reporte con folio #${clean}`, 'error');
      return;
    }

    // Actualizar caja de resultados
    if (dom.trackerResFolio) dom.trackerResFolio.textContent = found.folio;
    if (dom.trackerResStatus) dom.trackerResStatus.textContent = found.statusLabel;
    if (dom.trackerResPriority) dom.trackerResPriority.textContent = found.priorityLabel || 'Prioridad Normal';
    if (dom.trackerResTitle) dom.trackerResTitle.textContent = found.title;
    if (dom.trackerResAddress) dom.trackerResAddress.innerHTML = `<span class="material-symbols-outlined text-[14px]">pin_drop</span> ${found.address} • Cuadrilla: ${found.assignedTeam || 'En despacho'}`;

    if (dom.folioResultBox) dom.folioResultBox.classList.remove('hidden');
    if (dom.btnViewTrackedDetail) dom.btnViewTrackedDetail.onclick = () => openIncidentModal(found.id);

    showToast(`Folio ${found.folio} localizado exitosamente`, 'success');
  }

  // ==========================================
  // Nivel 4: Super Administrador Hub, Usuarios, Moderación y Auditoría
  // ==========================================
  function renderAdminHub() {
    const container = dom.adminCriticalAlertsContainer;
    const critical = state.incidents.filter(i => (i.priorityLevel >= 3 || i.urgency === 'high') && i.status !== 'resolved');

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
              <span class="font-mono text-xs font-bold text-on-surface">${inc.folio}</span>
              <span class="px-2 py-0.2 rounded-full bg-error text-on-error font-bold text-[10px]">Urgente / Prioridad ${inc.priorityLevel}</span>
              <span class="text-xs font-bold text-on-surface truncate">${inc.title}</span>
            </div>
            <span class="text-xs text-on-surface-variant truncate mt-0.5">${inc.address} • Reportado por: ${inc.reportedBy}</span>
          </div>
        </div>
        <button onclick="window.civicApp.openModerationFor('${inc.id}')" class="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-xs shrink-0 self-end sm:self-center shadow-sm hover:bg-primary-container transition-all flex items-center gap-1">
          <span class="material-symbols-outlined text-[15px]">rate_review</span>
          <span>Moderar Ahora</span>
        </button>
      </div>
    `).join('');
  }

  async function loadAdminUsers() {
    try {
      const res = await fetch('/api/admin/users', {
        headers: {
          'x-user-role': state.currentUser.role,
          'x-user-name': state.currentUser.name
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      state.users = json.data || [];
      renderAdminUsersTable();
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
    }
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
          <div class="font-bold text-on-surface">${u.name}</div>
          <div class="text-[11px] text-outline">${u.email}</div>
        </td>
        <td class="py-3 px-3 font-mono text-[11px]">${u.rutDni || 'N/A'}</td>
        <td class="py-3 px-3">
          <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${u.role === 'admin' ? 'bg-red-100 text-red-800' : (u.role === 'trabajador' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800')}">
            ${u.role}
          </span>
        </td>
        <td class="py-3 px-3">${u.department || 'Comuna'}</td>
        <td class="py-3 px-3">
          <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${u.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
            ${u.status === 'active' ? 'Activo' : 'Suspendido'}
          </span>
        </td>
        <td class="py-3 px-3 text-right">
          <button type="button" onclick="window.civicApp.openUserActionsMenu(event, ${u.id})" class="user-actions-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs border border-outline-variant/30 shadow-sm transition-all active:scale-95" title="Opciones de cuenta">
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
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': state.currentUser.role,
          'x-user-name': state.currentUser.name
        },
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
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': state.currentUser.role,
          'x-user-name': state.currentUser.name
        },
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
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': state.currentUser.role,
          'x-user-name': state.currentUser.name
        },
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

  // ==========================================
  // Cambio de Contraseña (Admin & Propia Cuenta)
  // ==========================================
  function openChangePasswordForUser(userId, userName, userEmail) {
    if (!dom.modalChangePassword) return;

    if (dom.changePwdTargetId) dom.changePwdTargetId.value = userId || '';
    if (dom.changePwdTargetEmail) dom.changePwdTargetEmail.value = userEmail || '';
    if (dom.changePwdUserName) dom.changePwdUserName.textContent = userName || 'Usuario';
    if (dom.changePwdUserEmail) dom.changePwdUserEmail.textContent = userEmail || '';

    const isSelf = state.currentUser && state.currentUser.email === userEmail;
    if (dom.changePwdTitle) {
      dom.changePwdTitle.textContent = isSelf ? 'Cambiar Mi Contraseña' : `Cambiar Clave: ${userName}`;
    }

    if (dom.inputNewPassword) dom.inputNewPassword.value = '';
    if (dom.inputConfirmPassword) dom.inputConfirmPassword.value = '';

    dom.modalChangePassword.classList.remove('hidden');
    dom.modalChangePassword.classList.add('flex');
    if (dom.inputNewPassword) dom.inputNewPassword.focus();
  }

  function openChangeMyPasswordModal() {
    if (!state.currentUser || state.currentUser.role === 'invitado') {
      showToast('Debes iniciar sesión para cambiar tu contraseña', 'info');
      openAuthModal();
      return;
    }

    const currentId = state.currentUser.id || '';
    const currentName = state.currentUser.name || 'Mi Cuenta';
    const currentEmail = state.currentUser.email || '';

    openChangePasswordForUser(currentId, currentName, currentEmail);
  }

  function closeChangePasswordModal() {
    if (!dom.modalChangePassword) return;
    dom.modalChangePassword.classList.add('hidden');
    dom.modalChangePassword.classList.remove('flex');
    if (dom.inputNewPassword) dom.inputNewPassword.value = '';
    if (dom.inputConfirmPassword) dom.inputConfirmPassword.value = '';
  }

  async function handleChangePasswordSubmit(e) {
    e.preventDefault();

    const targetId = dom.changePwdTargetId ? dom.changePwdTargetId.value : '';
    const targetEmail = dom.changePwdTargetEmail ? dom.changePwdTargetEmail.value : '';
    const newPassword = dom.inputNewPassword ? dom.inputNewPassword.value.trim() : '';
    const confirmPassword = dom.inputConfirmPassword ? dom.inputConfirmPassword.value.trim() : '';

    if (!newPassword || newPassword.length < 4) {
      showToast('La nueva contraseña debe tener al menos 4 caracteres', 'error');
      if (dom.inputNewPassword) dom.inputNewPassword.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('Las contraseñas no coinciden. Por favor verifícalas.', 'error');
      if (dom.inputConfirmPassword) dom.inputConfirmPassword.focus();
      return;
    }

    const submitBtn = document.getElementById('btn-submit-change-pwd');
    const originalContent = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></span>
        <span>Guardando...</span>
      `;
    }

    try {
      let res;
      if (targetId && state.currentUser.role === 'admin') {
        res = await fetch(`/api/admin/users/${targetId}/password`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': state.currentUser.role,
            'x-user-name': state.currentUser.name,
            'x-user-email': state.currentUser.email
          },
          body: JSON.stringify({ password: newPassword })
        });
      } else {
        res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': state.currentUser.role,
            'x-user-name': state.currentUser.name,
            'x-user-email': state.currentUser.email
          },
          body: JSON.stringify({ email: targetEmail, newPassword })
        });
      }

      const json = await res.json();
      if (!res.ok) {
        showToast(json.message || 'Error al cambiar contraseña', 'error');
        return;
      }

      showToast(json.message || '¡Contraseña actualizada correctamente!', 'success');
      closeChangePasswordModal();

      if (targetEmail === state.currentUser.email) {
        showToast('Tu clave ha sido actualizada. Se aplicará en tus próximos inicios de sesión.', 'info');
      }

      if (state.currentUser.role === 'admin') {
        await loadAdminUsers();
      }
    } catch (err) {
      console.error('Error al cambiar contraseña:', err);
      showToast('Error de conexión al actualizar contraseña', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalContent;
      }
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
      <div class="p-4 rounded-xl border ${isSelected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-outline-variant/20 bg-surface-container-lowest hover:border-primary/50'} shadow-sm flex items-center justify-between gap-3 cursor-pointer transition-all hover:shadow-md" onclick="window.civicApp.openModerationFor('${inc.id}')">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-mono text-xs font-bold text-primary">${inc.folio}</span>
            <span class="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-bold text-[10px]">
              Prioridad ${inc.priorityLevel} (${inc.priorityLabel})
            </span>
          </div>
          <h4 class="font-bold text-sm text-on-surface truncate mt-1">${inc.title}</h4>
          <p class="text-xs text-outline truncate">${inc.address}</p>
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
    if (dom.modPriorityLevel) dom.modPriorityLevel.value = String(inc.priorityLevel || '1');
    if (dom.modAssignedTeam) dom.modAssignedTeam.value = inc.assignedTeam || '';
    if (dom.modTitle) dom.modTitle.value = inc.title || '';
    if (dom.modDesc) dom.modDesc.value = inc.description || '';

    renderAdminModerationList();

    // Desplazar siempre al editor de forma consistente (compensando el header fijo)
    if (dom.adminEditPanel) {
      requestAnimationFrame(() => {
        const headerOffset = 72;
        const top = dom.adminEditPanel.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
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
    if (dom.modPriorityLevel) dom.modPriorityLevel.value = '1';
    if (dom.modAssignedTeam) dom.modAssignedTeam.value = '';
    if (dom.modTitle) dom.modTitle.value = '';
    if (dom.modDesc) dom.modDesc.value = '';
    renderAdminModerationList();
  }

  async function loadAdminSettings() {
    try {
      const res = await fetch('/api/admin/settings');
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

    const priorityLevel = parseInt(dom.modPriorityLevel.value, 10);
    const assignedTeam = dom.modAssignedTeam.value.trim();
    const title = dom.modTitle.value.trim();
    const description = dom.modDesc.value.trim();

    try {
      const res = await fetch(`/api/admin/incidents/${id}/moderate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': state.currentUser.role,
          'x-user-name': state.currentUser.name
        },
        body: JSON.stringify({ priorityLevel, assignedTeam, title, description })
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

  async function loadAuditLogs() {
    try {
      const res = await fetch('/api/admin/audit-logs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      state.auditLogs = json.data || [];
      renderAuditLogsTable();
    } catch (err) {
      console.error('Error al cargar logs de auditoría:', err);
    }
  }

  function renderAuditLogsTable() {
    const tbody = dom.auditTableBody;
    if (!tbody) return;

    if (dom.auditStatEvents) dom.auditStatEvents.textContent = `${state.auditLogs.length} logs`;

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
        <td class="py-2.5 px-3 text-outline text-[11px] whitespace-nowrap">${formattedDate}</td>
        <td class="py-2.5 px-3 font-bold text-primary">${log.action}</td>
        <td class="py-2.5 px-3">${log.actor_name}</td>
        <td class="py-2.5 px-3"><span class="px-1.5 py-0.2 rounded bg-surface-container text-[10px] font-bold">${log.actor_role}</span></td>
        <td class="py-2.5 px-3 text-on-surface-variant">${log.target_info || '-'}</td>
      </tr>
      `;
    }).join('');
  }

  // ==========================================
  // Formulario: Wizard de 3 Pasos y Urgencia
  // ==========================================
  function updateFolioPreview() {
    let maxNum = 8950;
    state.incidents.forEach(inc => {
      const match = (inc.id || '').match(/CIV-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum + 1;
    if (dom.formFolioPreview) dom.formFolioPreview.textContent = `#CIV-${nextNum}`;
  }

  function updateFormUrgencyBadge() {
    const role = state.currentUser.role;
    if (!dom.formPriorityBadge) return;

    if (role === 'admin') {
      dom.formPriorityBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span> Prioridad: Crítica (Super Admin)`;
      if (dom.urgencyRoleNote) dom.urgencyRoleNote.textContent = 'Reporte oficial con poder canónico Root';
    } else if (role === 'trabajador') {
      dom.formPriorityBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span> Prioridad: Muy Alta (Funcionario Público)`;
      if (dom.urgencyRoleNote) dom.urgencyRoleNote.textContent = 'Prioridad preferente con despacho directo';
    } else if (role === 'vecino') {
      dom.formPriorityBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-600"></span> Prioridad: Alta (Vecino Verificado)`;
      if (dom.urgencyRoleNote) dom.urgencyRoleNote.textContent = 'Cuenta vecinal acreditada con respuesta < 24h';
    } else {
      dom.formPriorityBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-500"></span> Prioridad: Normal (Invitado / Anónimo)`;
      if (dom.urgencyRoleNote) dom.urgencyRoleNote.textContent = 'Prioridad base estándar de ingreso';
    }
  }

  function setFormStep(step) {
    state.currentFormStep = step;
    document.querySelectorAll('.form-step').forEach(s => {
      const sNum = parseInt(s.getAttribute('data-step'), 10);
      if (sNum === step) {
        s.classList.remove('hidden');
      } else {
        s.classList.add('hidden');
      }
    });

    const labels = {
      1: 'Paso 1: Clasificación & Urgencia',
      2: 'Paso 2: Ubicación & Datos',
      3: 'Paso 3: Evidencia Fotográfica'
    };

    if (dom.stepLabel) dom.stepLabel.textContent = labels[step] || `Paso ${step}`;
    if (dom.stepIndicator) dom.stepIndicator.textContent = `Paso ${step} de 3`;
    if (dom.stepProgressBar) dom.stepProgressBar.style.width = `${(step / 3) * 100}%`;
  }

  // Modal de Comprobante / Éxito al Generar Reporte
  function showReportSuccessModal(incident) {
    const modal = document.getElementById('modal-report-success');
    const folioEl = document.getElementById('success-modal-folio');
    const priorityEl = document.getElementById('success-modal-priority');
    const sectorEl = document.getElementById('success-modal-sector');
    if (!modal) return;

    if (folioEl) folioEl.textContent = incident.folio || incident.id;
    if (priorityEl) priorityEl.textContent = incident.priorityLabel || 'Normal';
    if (sectorEl) sectorEl.textContent = incident.sectorLabel || incident.sector || 'Comuna Central';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function closeReportSuccessModal() {
    const modal = document.getElementById('modal-report-success');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  let uploadedCustomPhotoBase64 = null;

  function handleCustomPhotoSelect(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Por favor selecciona un archivo de imagen válido (JPG, PNG o WEBP)', 'error');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      showToast('La imagen es demasiado grande (máximo 12 MB)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedCustomPhotoBase64 = e.target.result;

      const idleEl = document.getElementById('dropzone-idle');
      const prevEl = document.getElementById('dropzone-preview');
      const imgEl = document.getElementById('custom-photo-img-preview');
      const nameEl = document.getElementById('custom-photo-name');
      const sizeEl = document.getElementById('custom-photo-size');

      if (imgEl) imgEl.src = uploadedCustomPhotoBase64;
      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB`;

      if (idleEl) idleEl.classList.add('hidden');
      if (prevEl) {
        prevEl.classList.remove('hidden');
        prevEl.classList.add('flex');
      }

      document.querySelectorAll('input[name="sample_photo"]').forEach(r => r.checked = false);
      showToast('Foto cargada y lista para adjuntar', 'success');
    };
    reader.readAsDataURL(file);
  }

  function removeCustomPhoto() {
    uploadedCustomPhotoBase64 = null;
    const input = document.getElementById('input-custom-photo');
    if (input) input.value = '';

    const idleEl = document.getElementById('dropzone-idle');
    const prevEl = document.getElementById('dropzone-preview');
    if (idleEl) idleEl.classList.remove('hidden');
    if (prevEl) {
      prevEl.classList.add('hidden');
      prevEl.classList.remove('flex');
    }

    const firstSample = document.querySelector('input[name="sample_photo"]');
    if (firstSample) firstSample.checked = true;
  }

  async function handleFormSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const titleInput = document.getElementById('input-title');
    const addressInput = document.getElementById('input-address');
    const sectorInput = document.getElementById('select-sector');
    const reportedByInput = document.getElementById('input-reportedBy');
    const descInput = document.getElementById('input-desc');

    const title = titleInput ? titleInput.value.trim() : '';
    const address = addressInput ? addressInput.value.trim() : '';
    const sector = sectorInput ? sectorInput.value : 'centro';
    const reportedBy = (reportedByInput && reportedByInput.value.trim()) || state.currentUser.name;
    const description = descInput ? descInput.value.trim() : '';

    const categoryInput = dom.form ? dom.form.querySelector('input[name="category"]:checked') : null;
    const category = categoryInput ? categoryInput.value : 'vialidad';

    const channelInput = dom.form ? dom.form.querySelector('input[name="channel"]:checked') : null;
    const channel = channelInput ? channelInput.value : 'app';

    const urgencyInput = dom.form ? dom.form.querySelector('input[name="urgency"]:checked') : null;
    const urgency = urgencyInput ? urgencyInput.value : 'medium';

    const photoInput = dom.form ? dom.form.querySelector('input[name="sample_photo"]:checked') : null;
    const image = uploadedCustomPhotoBase64 || (photoInput ? photoInput.value : '');

    if (!title || !address) {
      setFormStep(2);
      showToast('Por favor completa el título y la dirección en el Paso 2', 'error');
      if (!title && titleInput) titleInput.focus();
      else if (!address && addressInput) addressInput.focus();
      return;
    }

    const submitBtn = document.getElementById('btn-submit-form');
    const originalBtnContent = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></span>
        <span>Guardando reporte...</span>
      `;
    }

    const payload = {
      title,
      address,
      sector,
      reportedBy,
      description,
      category,
      channel,
      urgency,
      image,
      userRole: state.currentUser.role,
      userName: state.currentUser.name
    };

    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': state.currentUser.role,
          'x-user-name': state.currentUser.name
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      showToast(`¡Reporte ${data.data.folio} registrado correctamente!`, 'success');

      if (dom.form) dom.form.reset();
      removeCustomPhoto();
      setFormStep(1);
      await loadIncidents();

      // Mostrar comprobante oficial de éxito
      showReportSuccessModal(data.data);

    } catch (err) {
      console.error('Error al enviar formulario:', err);
      showToast('Error al registrar incidencia en el servidor. Intenta de nuevo.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnContent;
      }
    }
  }

  // ==========================================
  // Mapa Comunal Interactivo
  // ==========================================
  function renderMapPins() {
    const layer = dom.mapPinsLayer;
    if (!layer) return;

    let pins = state.incidents;
    if (state.selectedSector !== 'all') {
      pins = pins.filter(i => i.sector === state.selectedSector);
    }

    const colors = {
      vialidad: 'bg-amber-500 text-white',
      alumbrado: 'bg-yellow-400 text-slate-900',
      aseo: 'bg-emerald-500 text-white',
      aguas: 'bg-blue-500 text-white',
      areas_verdes: 'bg-green-600 text-white',
      seguridad: 'bg-indigo-600 text-white'
    };

    layer.innerHTML = pins.map(inc => {
      const c = colors[inc.category] || 'bg-primary text-white';
      const x = inc.coordinates?.x || 50;
      const y = inc.coordinates?.y || 50;

      return `
        <div class="map-pin" style="left: ${x}%; top: ${y}%;" data-id="${inc.id}" title="${inc.folio}: ${inc.title}">
          <div class="map-pin-pulse ${c}"></div>
          <div class="w-8 h-8 rounded-full ${c} shadow-lg flex items-center justify-center font-bold text-xs ring-2 ring-white">
            <span class="material-symbols-outlined text-[16px]">${inc.categoryIcon || 'pin_drop'}</span>
          </div>
        </div>
      `;
    }).join('');

    layer.querySelectorAll('.map-pin').forEach(pin => {
      pin.addEventListener('click', () => {
        const id = pin.getAttribute('data-id');
        const inc = state.incidents.find(i => i.id === id);
        if (inc) showMapPreview(inc);
      });
    });
  }

  function showMapPreview(inc) {
    if (!dom.mapIncidentPreview) return;
    dom.previewFolio.textContent = inc.folio;
    dom.previewStatus.textContent = inc.statusLabel;
    dom.previewTitle.textContent = inc.title;
    dom.previewAddress.innerHTML = `<span class="material-symbols-outlined text-[14px]">pin_drop</span><span>${inc.address}</span>`;
    dom.mapIncidentPreview.classList.remove('hidden');

    dom.mapIncidentPreview.onclick = (e) => {
      if (e.target.closest('#btn-close-map-preview')) return;
      openIncidentModal(inc.id);
    };
  }

  // ==========================================
  // Modal de Detalle y Cambio de Estado
  // ==========================================
  function openIncidentModal(id) {
    const incident = state.incidents.find(i => i.id === id);
    if (!incident) return;

    state.activeModalIncident = incident;

    dom.modalFolio.textContent = incident.folio;
    dom.modalTitle.textContent = incident.title;
    dom.modalAddress.innerHTML = `<span class="material-symbols-outlined text-[16px] text-primary">pin_drop</span><span>${incident.address} (${incident.sectorLabel})</span>`;
    dom.modalDesc.textContent = incident.description || 'Sin descripción adicional reportada.';
    dom.modalReportedBy.textContent = `${incident.reportedBy || 'Vecino'} (${incident.reportedByRole || 'invitado'})`;
    dom.modalChannel.textContent = incident.channelLabel || 'Digital';
    dom.modalStatusBadge.textContent = incident.statusLabel;

    if (dom.modalPriorityBadge) {
      dom.modalPriorityBadge.textContent = `Nivel ${incident.priorityLevel}: ${incident.priorityLabel}`;
    }

    if (incident.image) {
      dom.modalImg.src = incident.image;
      dom.modalImg.parentElement.classList.remove('hidden');
    } else {
      dom.modalImg.src = '';
      dom.modalImg.parentElement.classList.add('hidden');
    }

    // Solo personal municipal o super admin pueden cambiar de estado operativo
    if (state.currentUser.role === 'trabajador' || state.currentUser.role === 'admin') {
      dom.modalStatusActionsContainer.classList.remove('hidden');
    } else {
      dom.modalStatusActionsContainer.classList.add('hidden');
    }

    dom.modalIncident.classList.remove('hidden');
    dom.modalIncident.classList.add('flex');
  }

  function closeIncidentModal() {
    dom.modalIncident.classList.add('hidden');
    dom.modalIncident.classList.remove('flex');
    state.activeModalIncident = null;
  }

  async function handleStatusChange(newStatus) {
    if (!state.activeModalIncident) return;
    const id = state.activeModalIncident.id;

    try {
      const res = await fetch(`/api/incidents/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': state.currentUser.role,
          'x-user-name': state.currentUser.name
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(`Estado de ${state.activeModalIncident.folio} actualizado a ${newStatus}`, 'success');
      closeIncidentModal();
      await loadIncidents();
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      showToast('Error al actualizar estado en el servidor', 'error');
    }
  }

  // ==========================================
  // Renderizado de Dashboard KPIs
  // ==========================================
  function renderDashboardStats() {
    if (!state.stats) return;

    const s = state.stats;
    if (dom.kpiTotal) dom.kpiTotal.textContent = s.total;
    if (dom.kpiNew) dom.kpiNew.textContent = s.counts.new;
    if (dom.kpiProgress) dom.kpiProgress.textContent = s.counts.progress;
    if (dom.kpiResolved) dom.kpiResolved.textContent = s.counts.resolved;
    if (dom.kpiRate) dom.kpiRate.textContent = `${s.resolutionRate}%`;

    if (dom.categoriesStatsBars && s.byCategory) {
      const catLabels = {
        vialidad: 'Baches y Calzadas',
        alumbrado: 'Alumbrado Público',
        aseo: 'Aseo Urbano',
        aguas: 'Agua y Alcantarillado',
        areas_verdes: 'Parques y Jardines',
        seguridad: 'Seguridad Ciudadana'
      };

      const total = s.total || 1;
      dom.categoriesStatsBars.innerHTML = Object.entries(s.byCategory).map(([k, count]) => {
        const pct = Math.round((count / total) * 100);
        return `
          <div>
            <div class="flex items-center justify-between text-xs font-semibold mb-1 text-on-surface">
              <span>${catLabels[k] || k}</span>
              <span class="text-outline font-mono">${count} (${pct}%)</span>
            </div>
            <div class="w-full bg-surface-container h-2 rounded-full overflow-hidden">
              <div class="bg-primary h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // ==========================================
  // Cierre de Sesión Seguro (Inmediato y Fiable)
  // ==========================================
  function logout() {
    const previousName = state.currentUser ? state.currentUser.name : 'Usuario';

    // 1. Reestablecer estado local a invitado inmediatamente
    state.currentUser = {
      id: 0,
      name: 'Vecino Invitado',
      email: 'invitado@comuna.cl',
      role: 'invitado',
      rutDni: 'Sin DNI',
      department: 'Comunidad'
    };

    // 2. Cerrar cualquier modal abierto y limpiar credenciales del formulario
    closeAuthModal();
    clearAuthLoginForm();

    // 3. Reconfigurar interfaz y cambiar a la vista de reporte ciudadano
    renderNavForRole('invitado');
    switchView('view-nuevo');

    // 4. Mostrar confirmación visual al usuario
    showToast('Sesión cerrada con éxito. Regresaste a modo invitado público.', 'info');

    // 5. Notificar al servidor en segundo plano (no bloquea al usuario ni da error)
    try {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: previousName })
      }).catch(() => {});
    } catch (e) {}
  }

  // ==========================================
  // Autenticación & Switch Rápido de Roles
  // ==========================================
  async function quickLogin(role) {
    if (role === 'invitado') {
      logout();
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      state.currentUser = json.user;
      closeAuthModal();
      showToast(`Sesión activa: ${state.currentUser.name} (${state.currentUser.role})`, 'success');

      renderNavForRole(state.currentUser.role);
      switchView(ROLE_PERMISSIONS[state.currentUser.role].defaultView);
      await loadIncidents();
    } catch (err) {
      console.error('Error al cambiar de sesión:', err);
      showToast('Error al conectar con el servicio de autenticación', 'error');
    }
  }

  async function handleAuthLoginSubmit(e) {
    e.preventDefault();
    const email = dom.authInputEmail ? dom.authInputEmail.value.trim() : '';
    const password = dom.authInputPassword ? dom.authInputPassword.value.trim() : '';

    if (!email || !password) {
      showToast('Por favor ingresa tu correo/RUT y contraseña', 'error');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const json = await res.json();
      if (!res.ok) {
        showToast(json.message || 'Credenciales inválidas', 'error');
        return;
      }

      state.currentUser = json.user;
      closeAuthModal();
      clearAuthLoginForm();

      const roleLabels = {
        vecino: 'Vecino Ciudadano',
        trabajador: 'Funcionario Municipal',
        admin: 'Super Administrador'
      };
      const roleText = roleLabels[state.currentUser.role] || state.currentUser.role;
      showToast(`¡Bienvenido(a), ${state.currentUser.name}! (${roleText})`, 'success');

      renderNavForRole(state.currentUser.role);
      switchView(ROLE_PERMISSIONS[state.currentUser.role].defaultView);
      await loadIncidents();
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      showToast('Error de conexión con el servidor', 'error');
    }
  }

  function switchAuthView(view) {
    const viewLogin = document.getElementById('auth-view-login');
    const viewRegister = document.getElementById('auth-view-register');
    const title = document.getElementById('auth-modal-title');
    const badge = document.getElementById('auth-modal-badge');
    const icon = document.getElementById('auth-modal-icon');
    const iconContainer = document.getElementById('auth-modal-icon-container');

    if (view === 'register') {
      if (viewLogin) viewLogin.classList.add('hidden');
      if (viewRegister) viewRegister.classList.remove('hidden');
      if (title) title.textContent = 'Registro de Vecino';
      if (badge) badge.textContent = 'Portal Ciudadano • Registro';
      if (icon) icon.textContent = 'how_to_reg';
      if (iconContainer) {
        iconContainer.className = 'w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md';
      }
      const nameInput = document.getElementById('register-input-name');
      if (nameInput) nameInput.focus();
    } else {
      if (viewRegister) viewRegister.classList.add('hidden');
      if (viewLogin) viewLogin.classList.remove('hidden');
      if (title) title.textContent = 'Acceso a CivicCore';
      if (badge) badge.textContent = 'Portal Ciudadano';
      if (icon) icon.textContent = 'account_balance';
      if (iconContainer) {
        iconContainer.className = 'w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-md';
      }
      if (dom.authInputEmail) dom.authInputEmail.focus();
    }
  }

  function openAuthModal() {
    switchAuthView('login');
    if (dom.authInputPassword) dom.authInputPassword.value = '';
    const regPwd = document.getElementById('register-input-password');
    const regConfirm = document.getElementById('register-input-confirm');
    if (regPwd) regPwd.value = '';
    if (regConfirm) regConfirm.value = '';

    dom.modalAuth.classList.remove('hidden');
    dom.modalAuth.classList.add('flex');
    if (dom.authInputEmail) dom.authInputEmail.focus();
  }

  function closeAuthModal() {
    dom.modalAuth.classList.add('hidden');
    dom.modalAuth.classList.remove('flex');
  }

  async function handleAuthRegisterSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const name = document.getElementById('register-input-name')?.value.trim();
    const email = document.getElementById('register-input-email')?.value.trim();
    const rutDni = document.getElementById('register-input-rut')?.value.trim();
    const password = document.getElementById('register-input-password')?.value.trim();
    const confirm = document.getElementById('register-input-confirm')?.value.trim();

    if (!name || !email || !password) {
      showToast('Por favor completa todos los campos obligatorios (*)', 'error');
      return;
    }

    if (!email.includes('@')) {
      showToast('Ingresa un correo electrónico válido', 'error');
      return;
    }

    if (password.length < 4) {
      showToast('La contraseña debe tener al menos 4 caracteres', 'error');
      return;
    }

    if (password !== confirm) {
      showToast('Las contraseñas no coinciden', 'error');
      return;
    }

    const btnSubmit = document.getElementById('btn-submit-register');
    const originalContent = btnSubmit ? btnSubmit.innerHTML : '';
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Creando cuenta de Vecino...';
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, rutDni })
      });

      const json = await res.json();
      if (!res.ok) {
        showToast(json.message || 'Error al registrar vecino', 'error');
        return;
      }

      state.currentUser = json.user;
      closeAuthModal();
      clearAuthLoginForm();

      showToast(`¡Bienvenido(a), ${state.currentUser.name}! Cuenta de Vecino activada.`, 'success');
      renderNavForRole('vecino');
      switchView('view-vecino');
      await loadIncidents();
    } catch (err) {
      console.error('Error al registrar usuario:', err);
      showToast('Error de conexión con el servidor', 'error');
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalContent;
      }
    }
  }

  // ==========================================
  // Integración Oficial Google Identity Services (Cuentas Reales de Google)
  // ==========================================
  let googleAuthClientId = '';

  async function loadGoogleAuthConfig() {
    try {
      const res = await fetch('/api/auth/google/config');
      const data = await res.json();
      if (data && data.clientId) {
        googleAuthClientId = data.clientId.trim();
        initGoogleClientIfReady();
      }
    } catch (err) {
      console.warn('Configuración de Google no disponible aún:', err);
    }
  }

  function initGoogleClientIfReady() {
    if (!googleAuthClientId || !window.google || !window.google.accounts || !window.google.accounts.id) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: googleAuthClientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });

      const containerLogin = document.getElementById('google-login-btn-container');
      const fallbackLogin = document.getElementById('btn-fallback-google-login');
      if (containerLogin) {
        containerLogin.innerHTML = '';
        window.google.accounts.id.renderButton(containerLogin, {
          theme: 'outline',
          size: 'large',
          width: 360,
          text: 'continue_with',
          shape: 'rectangular'
        });
        if (fallbackLogin) fallbackLogin.classList.add('hidden');
      }

      const containerReg = document.getElementById('google-reg-btn-container');
      const fallbackReg = document.getElementById('btn-fallback-google-reg');
      if (containerReg) {
        containerReg.innerHTML = '';
        window.google.accounts.id.renderButton(containerReg, {
          theme: 'outline',
          size: 'large',
          width: 360,
          text: 'signup_with',
          shape: 'rectangular'
        });
        if (fallbackReg) fallbackReg.classList.add('hidden');
      }
    } catch (err) {
      console.error('Error al inicializar Google Identity Services:', err);
    }
  }

  function triggerGoogleLogin() {
    if (googleAuthClientId && window.google && window.google.accounts && window.google.accounts.id) {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.log('Google One Tap no mostrado directamente, reintentando...');
          }
        });
      } catch (err) {
        console.error('Error al solicitar autenticación de Google:', err);
      }
    } else {
      openGoogleConfigModal();
    }
  }

  function openGoogleConfigModal() {
    const modal = document.getElementById('modal-google-config');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      const input = document.getElementById('input-google-client-id');
      if (input) {
        input.value = googleAuthClientId || '';
        input.focus();
      }
    }
  }

  function closeGoogleConfigModal() {
    const modal = document.getElementById('modal-google-config');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  async function saveGoogleClientIdAndLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('input-google-client-id');
    const clientId = input ? input.value.trim() : '';

    if (!clientId) {
      showToast('Por favor ingresa tu Client ID de Google OAuth', 'error');
      return;
    }

    try {
      const res = await fetch('/api/auth/google/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Error al guardar Client ID', 'error');
        return;
      }

      googleAuthClientId = clientId;
      closeGoogleConfigModal();
      showToast('Client ID de Google configurado con éxito', 'success');

      initGoogleClientIfReady();
      setTimeout(() => {
        triggerGoogleLogin();
      }, 400);
    } catch (err) {
      console.error('Error al guardar Google Client ID:', err);
      showToast('Error de conexión con el servidor', 'error');
    }
  }

  async function handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) {
      showToast('No se recibió credencial de Google', 'error');
      return;
    }

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });

      const json = await res.json();
      if (!res.ok) {
        showToast(json.message || 'Error al autenticar con Google', 'error');
        return;
      }

      state.currentUser = json.user;
      closeAuthModal();
      closeGoogleConfigModal();
      clearAuthLoginForm();

      showToast(`¡Bienvenido(a), ${state.currentUser.name}! Autenticado(a) con Google.`, 'success');
      renderNavForRole(state.currentUser.role);
      switchView(ROLE_PERMISSIONS[state.currentUser.role].defaultView);
      await loadIncidents();
    } catch (err) {
      console.error('Error al procesar login de Google:', err);
      showToast('Error de conexión con el servidor', 'error');
    }
  }

  // Borra correo/RUT y contraseña del formulario de inicio de sesión
  function clearAuthLoginForm() {
    if (dom.formAuthLogin) dom.formAuthLogin.reset();
    if (dom.authInputEmail) dom.authInputEmail.value = '';
    if (dom.authInputPassword) {
      dom.authInputPassword.value = '';
      dom.authInputPassword.setAttribute('type', 'password');
    }
  }

  // ==========================================
  // Toasts / Notificaciones Flotantes
  // ==========================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-red-600 text-white',
      info: 'bg-primary text-white'
    };

    toast.className = `px-4 py-3 rounded-2xl shadow-xl font-medium text-xs flex items-center gap-2.5 transform transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto border border-white/20 ${colors[type] || colors.info}`;
    toast.innerHTML = `
      <span class="material-symbols-outlined text-[18px]">${type === 'success' ? 'check_circle' : (type === 'error' ? 'error' : 'info')}</span>
      <span>${message}</span>
    `;

    dom.toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', '-translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  // ==========================================
  // Event Listeners y Enlaces Globales
  // ==========================================
  function initEvents() {
    // Switcher de Roles Superior (si existiese en el DOM)
    if (dom.rolePills && dom.rolePills.length > 0) {
      dom.rolePills.forEach(pill => {
        pill.addEventListener('click', () => {
          const role = pill.getAttribute('data-role');
          quickLogin(role);
        });
      });
    }

    // Accesos a Modal de Auth / Botón de Header (Login / Logout)
    if (dom.btnOpenAuthModal) {
      dom.btnOpenAuthModal.addEventListener('click', () => {
        if (state.currentUser.role === 'invitado') {
          openAuthModal();
        } else {
          logout();
        }
      });
    }
    if (dom.btnCloseAuthModal) dom.btnCloseAuthModal.addEventListener('click', closeAuthModal);
    if (dom.modalAuth) {
      dom.modalAuth.addEventListener('click', (e) => {
        if (e.target === dom.modalAuth) closeAuthModal();
      });
    }
    if (dom.formAuthLogin) dom.formAuthLogin.addEventListener('submit', handleAuthLoginSubmit);

    // Formulario de Registro de Vecino
    const formAuthRegister = document.getElementById('form-auth-register');
    if (formAuthRegister) formAuthRegister.addEventListener('submit', handleAuthRegisterSubmit);


    // Toggle visibilidad de contraseña
    if (dom.btnTogglePassword) {
      dom.btnTogglePassword.addEventListener('click', () => {
        const t = dom.authInputPassword.getAttribute('type') === 'password' ? 'text' : 'password';
        dom.authInputPassword.setAttribute('type', t);
      });
    }

    // Botón Sidebar Nuevo
    if (dom.btnSidebarNuevo) {
      dom.btnSidebarNuevo.addEventListener('click', () => switchView('view-nuevo'));
    }

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

    // Rastreo de Folio en Portal Vecinal
    if (dom.folioTrackerForm) {
      dom.folioTrackerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleFolioTracking();
      });
    }

    // Pasos del Wizard Formulario
    document.querySelectorAll('.btn-step-next').forEach(btn => {
      btn.addEventListener('click', () => {
        if (state.currentFormStep === 2) {
          const title = document.getElementById('input-title')?.value.trim();
          const address = document.getElementById('input-address')?.value.trim();
          if (!title || !address) {
            showToast('Por favor completa el título y la dirección para continuar', 'error');
            if (!title) document.getElementById('input-title')?.focus();
            else document.getElementById('input-address')?.focus();
            return;
          }
        }
        if (state.currentFormStep < 3) setFormStep(state.currentFormStep + 1);
      });
    });

    document.querySelectorAll('.btn-step-prev').forEach(btn => {
      btn.addEventListener('click', () => {
        if (state.currentFormStep > 1) setFormStep(state.currentFormStep - 1);
      });
    });

    if (dom.form) dom.form.addEventListener('submit', handleFormSubmit);

    // Disparador directo del botón de envío final (evita problemas de eventos en móviles)
    const btnSubmitForm = document.getElementById('btn-submit-form');
    if (btnSubmitForm) {
      btnSubmitForm.addEventListener('click', (e) => {
        handleFormSubmit(e);
      });
    }

    // Botones del Modal de Comprobante / Éxito
    const btnSuccessNew = document.getElementById('btn-success-new-report');
    if (btnSuccessNew) {
      btnSuccessNew.addEventListener('click', () => {
        closeReportSuccessModal();
        setFormStep(1);
        switchView('view-nuevo');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    const btnCloseSuccess = document.getElementById('btn-close-success-modal');
    if (btnCloseSuccess) {
      btnCloseSuccess.addEventListener('click', closeReportSuccessModal);
    }

    const modalSuccessEl = document.getElementById('modal-report-success');
    if (modalSuccessEl) {
      modalSuccessEl.addEventListener('click', (e) => {
        if (e.target === modalSuccessEl) closeReportSuccessModal();
      });
    }

    // Filtros de estado en Bandeja
    dom.statusTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        dom.statusTabs.forEach(t => {
          t.className = 'tab-status flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container shadow-sm transition-all';
        });
        tab.className = 'tab-status active flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-on-primary shadow-sm transition-all';
        state.filterStatus = tab.getAttribute('data-status');
        renderIncidentsList();
      });
    });

    // Buscador en vivo
    if (dom.inputSearch) {
      dom.inputSearch.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        if (state.searchQuery) {
          dom.btnClearSearch.classList.remove('hidden');
        } else {
          dom.btnClearSearch.classList.add('hidden');
        }
        renderIncidentsList();
      });
    }

    if (dom.btnClearSearch) {
      dom.btnClearSearch.addEventListener('click', () => {
        dom.inputSearch.value = '';
        state.searchQuery = '';
        dom.btnClearSearch.classList.add('hidden');
        renderIncidentsList();
      });
    }

    if (dom.selectFilterCategory) {
      dom.selectFilterCategory.addEventListener('change', (e) => {
        state.filterCategory = e.target.value;
        renderIncidentsList();
      });
    }

    // Filtros de Sector en Mapa
    dom.mapSectorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.mapSectorBtns.forEach(b => {
          b.className = 'map-sector-btn px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high text-xs font-bold transition-all';
        });
        btn.className = 'map-sector-btn active px-3.5 py-1.5 rounded-full bg-primary text-on-primary text-xs font-bold transition-all shadow-sm';
        state.selectedSector = btn.getAttribute('data-sector');
        renderMapPins();
      });
    });

    if (dom.btnCloseMapPreview) {
      dom.btnCloseMapPreview.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.mapIncidentPreview.classList.add('hidden');
      });
    }

    // Modal de Detalle / Triaje
    if (dom.btnCloseModal) dom.btnCloseModal.addEventListener('click', closeIncidentModal);
    if (dom.modalIncident) {
      dom.modalIncident.addEventListener('click', (e) => {
        if (e.target === dom.modalIncident) closeIncidentModal();
      });
    }

    // Cerrar modales con tecla Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAuthModal();
        closeIncidentModal();
        closeReportSuccessModal();
        closeChangePasswordModal();
      }
    });

    // Eventos del Modal de Cambio de Contraseña
    if (dom.formChangePassword) dom.formChangePassword.addEventListener('submit', handleChangePasswordSubmit);
    if (dom.btnClosePasswordModal) dom.btnClosePasswordModal.addEventListener('click', closeChangePasswordModal);
    if (dom.btnCancelChangePwd) dom.btnCancelChangePwd.addEventListener('click', closeChangePasswordModal);
    if (dom.modalChangePassword) {
      dom.modalChangePassword.addEventListener('click', (e) => {
        if (e.target === dom.modalChangePassword) closeChangePasswordModal();
      });
    }

    if (dom.btnToggleNewPwd) {
      dom.btnToggleNewPwd.addEventListener('click', () => {
        const t = dom.inputNewPassword.getAttribute('type') === 'password' ? 'text' : 'password';
        dom.inputNewPassword.setAttribute('type', t);
      });
    }

    if (dom.btnToggleConfirmPwd) {
      dom.btnToggleConfirmPwd.addEventListener('click', () => {
        const t = dom.inputConfirmPassword.getAttribute('type') === 'password' ? 'text' : 'password';
        dom.inputConfirmPassword.setAttribute('type', t);
      });
    }

    if (dom.currentUserBadge) {
      dom.currentUserBadge.classList.add('cursor-pointer');
      dom.currentUserBadge.setAttribute('title', 'Clic para cambiar tu contraseña');
      dom.currentUserBadge.addEventListener('click', () => {
        if (state.currentUser && state.currentUser.role !== 'invitado') {
          openChangeMyPasswordModal();
        }
      });
    }

    dom.btnChangeStatus.forEach(btn => {
      btn.addEventListener('click', () => {
        const newStatus = btn.getAttribute('data-new-status');
        handleStatusChange(newStatus);
      });
    });

    // Eventos Super Admin
    if (dom.formCreateUser) dom.formCreateUser.addEventListener('submit', handleCreateUserSubmit);
    if (dom.btnRefreshUsers) dom.btnRefreshUsers.addEventListener('click', loadAdminUsers);
    if (dom.formModerateIncident) dom.formModerateIncident.addEventListener('submit', handleModerateSubmit);
    if (dom.btnRefreshAudit) dom.btnRefreshAudit.addEventListener('click', loadAuditLogs);
    if (dom.btnSaveSettings) {
      dom.btnSaveSettings.addEventListener('click', async () => {
        try {
          const municipality = document.getElementById('setting-municipality').value.trim();
          const phone = document.getElementById('setting-phone').value.trim();
          const sla = document.getElementById('setting-sla').value.trim();

          await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-role': state.currentUser.role,
              'x-user-name': state.currentUser.name
            },
            body: JSON.stringify({ key: 'municipality_name', value: municipality })
          });

          await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-role': state.currentUser.role,
              'x-user-name': state.currentUser.name
            },
            body: JSON.stringify({ key: 'emergency_phone', value: phone })
          });

          await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-role': state.currentUser.role,
              'x-user-name': state.currentUser.name
            },
            body: JSON.stringify({ key: 'sla_hours', value: sla })
          });

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

    // Eventos de Carga de Foto Personalizada
    const inputCustomPhoto = document.getElementById('input-custom-photo');
    if (inputCustomPhoto) {
      inputCustomPhoto.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleCustomPhotoSelect(e.target.files[0]);
        }
      });
    }

    const dropzone = document.getElementById('dropzone-custom-photo');
    if (dropzone) {
      ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('border-primary', 'bg-primary/5');
        });
      });
      ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('border-primary', 'bg-primary/5');
        });
      });
      dropzone.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleCustomPhotoSelect(e.dataTransfer.files[0]);
        }
      });
    }

    document.querySelectorAll('input[name="sample_photo"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked && uploadedCustomPhotoBase64) {
          removeCustomPhoto();
        }
      });
    });

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

  // ==========================================
  // Exposición a Window (API de Utilidad Pública)
  // ==========================================
  window.civicApp = {
    switchView,
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
    removeCustomPhoto,
    trackFolioNumber: (id) => handleFolioTracking(id),
    state
  };

  // ==========================================
  // Inicio de la Aplicación
  // ==========================================
  function init() {
    initEvents();
    renderNavForRole(state.currentUser.role);
    switchView(ROLE_PERMISSIONS[state.currentUser.role].defaultView);
    loadIncidents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
