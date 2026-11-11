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
  // Utilidades de Seguridad (Sanitización XSS) y Sesión
  // ==========================================
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const GUEST_USER = {
    id: 0,
    name: 'Vecino Invitado',
    email: 'invitado@comuna.cl',
    role: 'invitado',
    rutDni: 'Sin DNI',
    department: 'Comunidad'
  };

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

  // Configuración de Vistas Permitidas por Rol
  const ROLE_PERMISSIONS = {
    invitado: {
      defaultView: 'view-inicio',
      allowedViews: ['view-inicio', 'view-nuevo'],
      label: 'Invitado',
      badgeClass: 'bg-slate-200 text-slate-800',
      description: 'Acceso público para navegación general y generación de reportes urbanos.'
    },
    vecino: {
      defaultView: 'view-vecino',
      allowedViews: ['view-inicio', 'view-vecino', 'view-nuevo'],
      label: 'Vecino Verificado',
      badgeClass: 'bg-emerald-100 text-emerald-800',
      description: 'Portal vecinal acreditado. Seguimiento de folios y prioridad comunal.'
    },
    trabajador: {
      defaultView: 'view-incidencias',
      allowedViews: ['view-inicio', 'view-incidencias', 'view-mapa', 'view-panel', 'view-nuevo'],
      label: 'Funcionario Municipal',
      badgeClass: 'bg-blue-100 text-blue-800',
      description: 'Mando operativo municipal: bandeja de triaje, mapa georreferenciado y KPIs.'
    },
    admin: {
      defaultView: 'view-admin-hub',
      allowedViews: ['view-inicio', 'view-admin-hub', 'view-admin-users', 'view-admin-moderation', 'view-admin-audit', 'view-incidencias', 'view-mapa', 'view-panel', 'view-nuevo'],
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
    modCategory: document.getElementById('mod-category'),
    modPriorityLevel: document.getElementById('mod-priority-level'),
    modAssignedTeam: document.getElementById('mod-assigned-team'),
    modTitle: document.getElementById('mod-title'),
    modDesc: document.getElementById('mod-desc'),
    adminModerationList: document.getElementById('admin-moderation-list'),
    auditTableBody: document.getElementById('audit-table-body'),
    auditStatEvents: document.getElementById('audit-stat-events'),
    auditStatAdminActions: document.getElementById('audit-stat-admin-actions'),
    auditStatAuthEvents: document.getElementById('audit-stat-auth-events'),
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
    modalCategory: document.getElementById('modal-category'),
    modalUrgency: document.getElementById('modal-urgency'),
    modalAssignedTeam: document.getElementById('modal-assignedTeam'),
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
    currentPasswordGroup: document.getElementById('current-password-group'),
    inputCurrentPassword: document.getElementById('input-current-password'),
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
    if (targetViewId === 'view-inicio') {
      renderHomeStats();
    } else if (targetViewId === 'view-mapa') {
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
      const mainScroll = document.getElementById('main-scroll-container');
      if (mainScroll) mainScroll.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function updateHeaderTitles(viewId) {
    const titles = {
      'view-inicio': { title: 'Portal Cívico Municipal', context: 'Portal Ciudadano' },
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

    document.querySelectorAll('.header-nav-btn').forEach(btn => {
      const target = btn.getAttribute('data-target');
      if (target && target === viewId) {
        btn.className = 'header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-bold bg-primary/10 text-primary transition-all flex items-center gap-1.5 shrink-0';
      } else {
        btn.className = 'header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shrink-0';
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

    // 2. Barra lateral permanentemente oculta; navegación integrada en Header y Barra Móvil
    if (dom.sidebarDesktop) {
      dom.sidebarDesktop.classList.add('hidden', 'lg:hidden');
      dom.sidebarDesktop.classList.remove('lg:flex');
    }

    if (role === 'invitado') {
      if (dom.mobileBottomNav) dom.mobileBottomNav.classList.remove('hidden');
      if (dom.currentUserBadge) {
        dom.currentUserBadge.classList.add('hidden');
        dom.currentUserBadge.classList.remove('flex');
      }
      if (dom.btnAuthText) dom.btnAuthText.textContent = 'Iniciar Sesión';
      if (dom.roleInfoBanner) {
        dom.roleInfoBanner.innerHTML = '';
        dom.roleInfoBanner.classList.add('hidden');
      }
    } else {
      if (dom.mobileBottomNav) dom.mobileBottomNav.classList.remove('hidden');
      if (dom.currentUserBadge) {
        dom.currentUserBadge.classList.remove('hidden');
        dom.currentUserBadge.classList.add('flex');
      }
      if (dom.btnAuthText) dom.btnAuthText.textContent = 'Cerrar Sesión';
      if (dom.roleInfoBanner) {
        dom.roleInfoBanner.innerHTML = '';
        dom.roleInfoBanner.classList.add('hidden');
      }
    }

    // Actualizar botones de navegación rápida en el Header Superior según el rol
    const headerQuickNav = document.getElementById('header-quick-nav');
    if (headerQuickNav) {
      if (role === 'vecino') {
        headerQuickNav.innerHTML = `
          <button data-target="view-vecino" onclick="window.civicApp.switchView('view-vecino')" class="header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shrink-0">
            <span class="material-symbols-outlined text-[16px] text-primary">cottage</span>
            <span>Portal Vecinal</span>
          </button>
          <button data-target="view-nuevo" onclick="window.civicApp.switchView('view-nuevo')" class="header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shrink-0">
            <span class="material-symbols-outlined text-[16px] text-primary">add_circle</span>
            <span>Reportar</span>
          </button>
        `;
      } else if (role === 'trabajador') {
        headerQuickNav.innerHTML = `

          <button data-target="view-incidencias" onclick="window.civicApp.switchView('view-incidencias')" class="header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shrink-0">
            <span class="material-symbols-outlined text-[16px] text-primary">assignment</span>
            <span>Bandeja</span>
          </button>
          <button data-target="view-mapa" onclick="window.civicApp.switchView('view-mapa')" class="header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shrink-0">
            <span class="material-symbols-outlined text-[16px] text-primary">map</span>
            <span>Mapa</span>
          </button>
          <button data-target="view-panel" onclick="window.civicApp.switchView('view-panel')" class="header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shrink-0">
            <span class="material-symbols-outlined text-[16px] text-primary">dashboard</span>
            <span>KPIs</span>
          </button>
          <button data-target="view-nuevo" onclick="window.civicApp.switchView('view-nuevo')" class="header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shrink-0">
            <span class="material-symbols-outlined text-[16px] text-primary">add_circle</span>
            <span>Reportar</span>
          </button>
        `;
      } else if (role === 'admin') {
        headerQuickNav.innerHTML = `
          <button data-target="view-admin-hub" onclick="window.civicApp.switchView('view-admin-hub')" class="header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shrink-0">
            <span class="material-symbols-outlined text-[16px] text-primary">shield_person</span>
            <span>Consola</span>
          </button>
          <button data-target="view-admin-users" onclick="window.civicApp.switchView('view-admin-users')" class="header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shrink-0">
            <span class="material-symbols-outlined text-[16px] text-primary">vpn_key</span>
            <span>Usuarios</span>
          </button>
          <button data-target="view-admin-moderation" onclick="window.civicApp.switchView('view-admin-moderation')" class="header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shrink-0">
            <span class="material-symbols-outlined text-[16px] text-primary">edit_note</span>
            <span>Moderar</span>
          </button>
          <button data-target="view-admin-audit" onclick="window.civicApp.switchView('view-admin-audit')" class="header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shrink-0">
            <span class="material-symbols-outlined text-[16px] text-primary">history_edu</span>
            <span>Auditoría</span>
          </button>
          <button data-target="view-incidencias" onclick="window.civicApp.switchView('view-incidencias')" class="header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shrink-0">
            <span class="material-symbols-outlined text-[16px] text-primary">assignment</span>
            <span>Bandeja</span>
          </button>
        `;
      } else {
        headerQuickNav.innerHTML = `
          <button data-target="view-inicio" onclick="window.civicApp.switchView('view-inicio')" class="header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shrink-0">
            <span class="material-symbols-outlined text-[16px] text-primary">home</span>
            <span>Inicio</span>
          </button>
          <button data-target="view-nuevo" onclick="window.civicApp.switchView('view-nuevo')" class="header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shrink-0">
            <span class="material-symbols-outlined text-[16px] text-primary">add_circle</span>
            <span>Reportar</span>
          </button>
          <button onclick="window.civicApp.scrollToHomeTracker()" class="header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shrink-0">
            <span class="material-symbols-outlined text-[16px] text-primary">search</span>
            <span>Rastrear Folio</span>
          </button>
        `;
      }
      updateActiveNavIndicators(state.currentView);
    }

    // 3. Renderizar Sidebar Desktop
    let sidebarHtml = '';

    if (role === 'invitado') {
      sidebarHtml = `
        <div class="px-3 py-2 text-[10px] font-bold text-outline uppercase tracking-wider">Menú Ciudadano</div>
        <button data-target="view-inicio" class="sidebar-nav-item active w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-xs transition-all text-primary bg-surface-container-high shadow-sm">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[20px]">home</span>
            <span>Inicio Municipal</span>
          </div>
        </button>
        <button data-target="view-nuevo" class="sidebar-nav-item w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[20px]">add_alert</span>
            <span>Generar Reporte</span>
          </div>
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
        <button data-target="view-inicio" class="mobile-nav-btn active flex-1 py-1 flex flex-col items-center justify-center text-primary font-bold">
          <span class="material-symbols-outlined text-[22px]">home</span>
          <span class="text-[10px] mt-0.5">Inicio</span>
        </button>
        <button data-target="view-nuevo" class="mobile-nav-btn flex-1 py-1 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[22px]">add_circle</span>
          <span class="text-[10px] mt-0.5">Reportar</span>
        </button>
        <button onclick="window.civicApp.openAuthModal()" class="mobile-nav-btn flex-1 py-1 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[22px]">login</span>
          <span class="text-[10px] mt-0.5">Acceder</span>
        </button>
      `;
    } else if (role === 'vecino') {
      mobileHtml = `
        <button data-target="view-vecino" class="mobile-nav-btn active flex-1 py-1 flex flex-col items-center justify-center text-primary font-bold">
          <span class="material-symbols-outlined text-[22px]">cottage</span>
          <span class="text-[10px] mt-0.5">Vecinal</span>
        </button>
        <div class="relative -top-3.5 px-2">
          <button onclick="window.civicApp.switchView('view-nuevo')" class="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-all">
            <span class="material-symbols-outlined text-[26px]">add</span>
          </button>
        </div>
        <button onclick="window.civicApp.openChangeMyPasswordModal()" class="mobile-nav-btn flex-1 py-1 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[22px]">key</span>
          <span class="text-[10px] mt-0.5">Mi Clave</span>
        </button>
      `;
    } else if (role === 'trabajador') {
      mobileHtml = `
        <button data-target="view-incidencias" class="mobile-nav-btn active flex-1 py-1 flex flex-col items-center justify-center text-primary font-bold">
          <span class="material-symbols-outlined text-[22px]">assignment</span>
          <span class="text-[10px] mt-0.5">Bandeja</span>
        </button>
        <button data-target="view-mapa" class="mobile-nav-btn flex-1 py-1 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[22px]">map</span>
          <span class="text-[10px] mt-0.5">Mapa</span>
        </button>
        <div class="relative -top-3.5 px-1">
          <button onclick="window.civicApp.switchView('view-nuevo')" class="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-all">
            <span class="material-symbols-outlined text-[26px]">add</span>
          </button>
        </div>
        <button data-target="view-panel" class="mobile-nav-btn flex-1 py-1 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[22px]">dashboard</span>
          <span class="text-[10px] mt-0.5">KPIs</span>
        </button>
        <button onclick="window.civicApp.openChangeMyPasswordModal()" class="mobile-nav-btn flex-1 py-1 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[22px]">key</span>
          <span class="text-[10px] mt-0.5">Clave</span>
        </button>
      `;
    } else if (role === 'admin') {
      mobileHtml = `
        <button data-target="view-admin-hub" class="mobile-nav-btn active flex-1 py-1 flex flex-col items-center justify-center text-primary font-bold">
          <span class="material-symbols-outlined text-[21px]">shield_person</span>
          <span class="text-[10px] mt-0.5">Hub</span>
        </button>
        <button data-target="view-admin-users" class="mobile-nav-btn flex-1 py-1 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[21px]">vpn_key</span>
          <span class="text-[10px] mt-0.5">Claves</span>
        </button>
        <button data-target="view-admin-moderation" class="mobile-nav-btn flex-1 py-1 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[21px]">edit_note</span>
          <span class="text-[10px] mt-0.5">Moderar</span>
        </button>
        <button data-target="view-admin-audit" class="mobile-nav-btn flex-1 py-1 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[21px]">history_edu</span>
          <span class="text-[10px] mt-0.5">Auditoría</span>
        </button>
        <button data-target="view-incidencias" class="mobile-nav-btn flex-1 py-1 flex flex-col items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[21px]">assignment</span>
          <span class="text-[10px] mt-0.5">Bandeja</span>
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
    if (dom.userDisplayName) {
      dom.userDisplayName.textContent = state.currentUser.name;
      dom.userDisplayName.title = state.currentUser.name;
    }

    if (dom.userDisplayRole) {
      dom.userDisplayRole.textContent = state.currentUser.role;
      dom.userDisplayRole.className =
        `hidden xl:inline-block shrink-0 px-1.5 py-0.5 ` +
        `rounded-full font-bold uppercase text-[9px] ` +
        `${roleConfig.badgeClass}`;
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
      renderHomeStats();
      if (state.stats && state.stats.settings) {
        applyMunicipalitySettings(state.stats.settings);
      }
    } catch (err) {
      console.error('Error al cargar métricas:', err);
    }
  }

  function applyMunicipalitySettings(settings) {
    if (!settings) return;
    if (settings.municipality_name) {
      document.title = `CivicCore | ${settings.municipality_name}`;
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
        <div class="col-span-full bg-surface-container-lowest rounded-2xl p-8 sm:p-12 text-center border border-outline-variant/20 shadow-sm">
          <span class="material-symbols-outlined text-5xl text-outline mb-3">search_off</span>
          <h3 class="text-base font-bold text-on-surface">No se encontraron reportes con los filtros seleccionados</h3>
          <p class="text-xs text-outline mt-1 max-w-sm mx-auto">Prueba cambiando el estado operativo o la categoría.</p>
        </div>
      `;
      return;
    }

    // Badges de Estado
    const statusBadges = {
      new: '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary text-[11px] font-bold shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>Nueva</span>',
      progress: '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-secondary text-[11px] font-bold shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>En Terreno</span>',
      resolved: '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-tertiary text-[11px] font-bold shrink-0"><span class="material-symbols-outlined text-[13px]">check</span>Resuelta</span>'
    };

    // Badges de Prioridad (Funcionario > Vecino > Invitado)
    function getPriorityBadge(level, label) {
      if (level >= 4) {
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-wide shadow-sm"><span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>P4 • Crítica</span>`;
      }
      if (level === 3) {
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wide"><span class="material-symbols-outlined text-[11px]">bolt</span>P3 • Muy Alta</span>`;
      }
      if (level === 2) {
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wide"><span class="material-symbols-outlined text-[11px]">verified</span>P2 • Alta (Vecino)</span>`;
      }
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">P1 • Normal</span>`;
    }

    container.innerHTML = filtered.map(incident => `
      <article class="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md border border-outline-variant/20 transition-all flex flex-col justify-between gap-3.5">
        
        <div>
          <!-- Cabecera de Prioridad y Folio -->
          <div class="flex flex-wrap items-center justify-between gap-1.5 mb-2">
            <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span class="font-mono text-xs font-bold text-primary">${escapeHtml(incident.folio)}</span>
              ${getPriorityBadge(incident.priorityLevel, incident.priorityLabel)}
            </div>
            ${statusBadges[incident.status] || ''}
          </div>

          <!-- Título y Miniatura -->
          <div class="flex gap-3 items-start mt-1">
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-bold text-on-surface leading-snug line-clamp-2">${escapeHtml(incident.title)}</h3>
              <p class="text-xs text-outline flex items-center gap-1 mt-1 truncate">
                <span class="material-symbols-outlined text-[14px] shrink-0 text-primary">pin_drop</span>
                <span class="truncate">${escapeHtml(incident.address)}</span>
              </p>
            </div>
            ${incident.image ? `
              <div class="w-14 h-14 rounded-xl overflow-hidden bg-surface-container shrink-0 shadow-sm">
                <img src="${escapeHtml(incident.image)}" alt="Evidencia" class="w-full h-full object-cover">
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Info Cuadrilla y Rol del Denunciante -->
        <div class="p-2.5 rounded-xl bg-surface-container-low text-xs space-y-1">
          <div class="flex items-center justify-between text-on-surface-variant font-medium">
            <span class="flex items-center gap-1.5 truncate">
              <span class="material-symbols-outlined text-[15px] text-primary shrink-0">engineering</span>
              <span class="truncate">${escapeHtml(incident.assignedTeam || 'Sin cuadrilla asignada')}</span>
            </span>
          </div>
          <div class="text-[11px] text-outline flex items-center justify-between gap-2 pt-0.5">
            <span class="truncate">Actor: <strong>${escapeHtml(incident.reportedBy || 'Anónimo')}</strong></span>
            <span class="capitalize text-primary font-bold shrink-0">(${escapeHtml(incident.reportedByRole || 'invitado')})</span>
          </div>
        </div>

        <!-- Botón Ver y Gestionar -->
        <div class="flex items-center justify-between pt-1 border-t border-outline-variant/10">
          <span class="text-[11px] text-outline flex items-center gap-1 truncate">
            <span class="material-symbols-outlined text-[13px] shrink-0">location_city</span>
            <span class="truncate">${escapeHtml(incident.sectorLabel || 'Sector')}</span>
          </span>
          <button class="btn-open-detail flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-container text-primary text-xs font-bold hover:bg-surface-container-high transition-all active:scale-95 shrink-0" data-id="${escapeHtml(incident.id)}">
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

    // Inicializar el botón "Ver Expediente Completo" en la tarjeta por defecto (#CIV-8942 o el primero disponible)
    if (dom.btnViewTrackedDetail && !dom.btnViewTrackedDetail.onclick && state.incidents.length > 0) {
      const defaultTracked = state.incidents.find(i => i.id === 'CIV-8942') || state.incidents[0];
      if (defaultTracked) {
        if (dom.trackerResFolio) dom.trackerResFolio.textContent = defaultTracked.folio;
        if (dom.trackerResStatus) dom.trackerResStatus.textContent = defaultTracked.statusLabel;
        if (dom.trackerResPriority) dom.trackerResPriority.textContent = defaultTracked.priorityLabel || 'Prioridad Normal';
        if (dom.trackerResTitle) dom.trackerResTitle.textContent = defaultTracked.title;
        if (dom.trackerResAddress) {
          dom.trackerResAddress.innerHTML = `<span class="material-symbols-outlined text-[14px] shrink-0">pin_drop</span> <span class="truncate">${escapeHtml(defaultTracked.address)} • Cuadrilla: ${escapeHtml(defaultTracked.assignedTeam || 'En despacho')}</span>`;
        }
        dom.btnViewTrackedDetail.onclick = () => openIncidentModal(defaultTracked.id);
      }
    }

    // Filtrar reportes recientes
    const recent = state.incidents.slice(0, 6);
    if (dom.vecinoReportCount) dom.vecinoReportCount.textContent = `${state.incidents.length} reportes en la comuna`;

    grid.innerHTML = recent.map(inc => `
      <div class="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/20 flex flex-col justify-between gap-3">
        <div>
          <div class="flex items-center justify-between text-xs mb-1.5">
            <span class="font-mono font-bold text-primary">${escapeHtml(inc.folio)}</span>
            <span class="px-2 py-0.5 rounded-full ${inc.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-primary-fixed text-primary'} font-bold text-[10px]">
              ${escapeHtml(inc.statusLabel)}
            </span>
          </div>
          <h4 class="font-bold text-sm text-on-surface line-clamp-2">${escapeHtml(inc.title)}</h4>
          <p class="text-xs text-outline flex items-center gap-1 mt-1 truncate">
            <span class="material-symbols-outlined text-[14px] text-primary shrink-0">pin_drop</span>
            <span class="truncate">${escapeHtml(inc.address)}</span>
          </p>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-outline-variant/10 text-xs">
          <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px]">
            ${escapeHtml(inc.priorityLabel || 'Alta (Vecino)')}
          </span>
          <button onclick="window.civicApp.trackFolioNumber('${escapeHtml(inc.id)}')" class="text-primary font-bold hover:underline flex items-center gap-0.5 text-xs">
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

    if (folioInput && dom.folioInput) {
      dom.folioInput.value = found.folio || `#${found.id}`;
    }

    // Actualizar caja de resultados
    if (dom.trackerResFolio) dom.trackerResFolio.textContent = found.folio;
    if (dom.trackerResStatus) dom.trackerResStatus.textContent = found.statusLabel;
    if (dom.trackerResPriority) dom.trackerResPriority.textContent = found.priorityLabel || 'Prioridad Normal';
    if (dom.trackerResTitle) dom.trackerResTitle.textContent = found.title;
    if (dom.trackerResAddress) dom.trackerResAddress.innerHTML = `<span class="material-symbols-outlined text-[14px] shrink-0">pin_drop</span> <span class="truncate">${escapeHtml(found.address)} • Cuadrilla: ${escapeHtml(found.assignedTeam || 'En despacho')}</span>`;

    if (dom.folioResultBox) {
      dom.folioResultBox.classList.remove('hidden');
      dom.folioResultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
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
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(state.currentUser.id || ''),
          'x-user-email': state.currentUser.email || '',
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
    const isAdminResettingOther = state.currentUser && state.currentUser.role === 'admin' && !isSelf && Boolean(userId);
    if (dom.changePwdTitle) {
      dom.changePwdTitle.textContent = isSelf ? 'Cambiar Mi Contraseña' : `Cambiar Clave: ${userName}`;
    }

    if (dom.currentPasswordGroup) {
      dom.currentPasswordGroup.classList.toggle('hidden', isAdminResettingOther);
    }
    if (dom.inputCurrentPassword) dom.inputCurrentPassword.value = '';
    if (dom.inputNewPassword) dom.inputNewPassword.value = '';
    if (dom.inputConfirmPassword) dom.inputConfirmPassword.value = '';

    dom.modalChangePassword.classList.remove('hidden');
    dom.modalChangePassword.classList.add('flex');
    if (!isAdminResettingOther && dom.inputCurrentPassword) {
      dom.inputCurrentPassword.focus();
    } else if (dom.inputNewPassword) {
      dom.inputNewPassword.focus();
    }
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
    if (dom.inputCurrentPassword) dom.inputCurrentPassword.value = '';
    if (dom.inputNewPassword) dom.inputNewPassword.value = '';
    if (dom.inputConfirmPassword) dom.inputConfirmPassword.value = '';
  }

  async function handleChangePasswordSubmit(e) {
    e.preventDefault();

    const targetId = dom.changePwdTargetId ? dom.changePwdTargetId.value : '';
    const targetEmail = dom.changePwdTargetEmail ? dom.changePwdTargetEmail.value : '';
    const currentPassword = dom.inputCurrentPassword ? dom.inputCurrentPassword.value.trim() : '';
    const newPassword = dom.inputNewPassword ? dom.inputNewPassword.value.trim() : '';
    const confirmPassword = dom.inputConfirmPassword ? dom.inputConfirmPassword.value.trim() : '';

    const isSelf = state.currentUser && state.currentUser.email === targetEmail;
    const isAdminResettingOther = state.currentUser && state.currentUser.role === 'admin' && !isSelf && Boolean(targetId);

    if (!isAdminResettingOther && !currentPassword) {
      showToast('Debes ingresar tu contraseña actual para confirmar el cambio', 'error');
      if (dom.inputCurrentPassword) dom.inputCurrentPassword.focus();
      return;
    }

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
      if (isAdminResettingOther) {
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
          body: JSON.stringify({ email: targetEmail, currentPassword, newPassword })
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
        headers: {
          'x-user-role': state.currentUser.role,
          'x-user-name': state.currentUser.name,
          'x-user-email': state.currentUser.email || ''
        }
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
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': state.currentUser.role,
          'x-user-name': state.currentUser.name
        },
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

  async function loadAuditLogs() {
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: {
          'x-user-role': state.currentUser.role,
          'x-user-name': state.currentUser.name,
          'x-user-email': state.currentUser.email || ''
        }
      });
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
    if (dom.auditStatAdminActions) {
      const adminActionsCount = state.auditLogs.filter(l => l.actor_role === 'admin' || (l.action && (l.action.startsWith('ADMIN_') || l.action.startsWith('MODERACIÓN') || l.action.startsWith('CAMBIO_CONFIG') || l.action.startsWith('ELIMINAR_')))).length;
      dom.auditStatAdminActions.textContent = String(adminActionsCount);
    }
    if (dom.auditStatAuthEvents) {
      const authEventsCount = state.auditLogs.filter(l => l.action && (l.action.includes('LOGIN') || l.action.includes('LOGOUT') || l.action.includes('PASSWORD') || l.action.includes('CLAVE') || l.action.includes('REGISTRO') || l.action.includes('USUARIO'))).length;
      dom.auditStatAuthEvents.textContent = String(authEventsCount);
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


function openCancelIncidentModal() {
  const modal = document.getElementById('modal-cancel-incident');
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  document.getElementById('btn-continue-incident')?.focus();
}

function closeCancelIncidentModal() {
  const modal = document.getElementById('modal-cancel-incident');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
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

    // Si el usuario presiona Enter en los pasos 1 o 2, avanzar de paso en vez de enviar prematuramente
    if (state.currentFormStep === 1) {
      setFormStep(2);
      return;
    }

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

    if (state.currentFormStep === 2) {
      setFormStep(3);
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
      applySystemPrefs();
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
      const x = Number(inc.coordinates?.x) || 50;
      const y = Number(inc.coordinates?.y) || 50;

      return `
        <div class="map-pin" style="left: ${x}%; top: ${y}%;" data-id="${escapeHtml(inc.id)}" title="${escapeHtml(inc.folio)}: ${escapeHtml(inc.title)}">
          <div class="map-pin-pulse ${c}"></div>
          <div class="w-8 h-8 rounded-full ${c} shadow-lg flex items-center justify-center font-bold text-xs ring-2 ring-white">
            <span class="material-symbols-outlined text-[16px]">${escapeHtml(inc.categoryIcon || 'pin_drop')}</span>
          </div>
        </div>
      `;
    }).join('');

    layer.querySelectorAll('.map-pin').forEach(pin => {
      pin.addEventListener('click', () => {
        layer.querySelectorAll('.map-pin.active').forEach(p => p.classList.remove('active'));
        pin.classList.add('active');
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
    dom.previewAddress.innerHTML = `<span class="material-symbols-outlined text-[14px]">pin_drop</span><span>${escapeHtml(inc.address)}</span>`;
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
    dom.modalAddress.innerHTML = `<span class="material-symbols-outlined text-[16px] text-primary">pin_drop</span><span>${escapeHtml(incident.address)} (${escapeHtml(incident.sectorLabel)})</span>`;
    dom.modalDesc.textContent = incident.description || 'Sin descripción adicional reportada.';
    dom.modalReportedBy.textContent = `${incident.reportedBy || 'Vecino'} (${incident.reportedByRole || 'invitado'})`;
    dom.modalChannel.textContent = incident.channelLabel || 'Digital';
    dom.modalStatusBadge.textContent = incident.statusLabel;

    const urgencyLabels = { low: 'Baja', medium: 'Media', high: 'Alta / Crítica' };
    if (dom.modalCategory) dom.modalCategory.textContent = incident.categoryLabel || incident.category || 'General';
    if (dom.modalUrgency) dom.modalUrgency.textContent = urgencyLabels[incident.urgency] || incident.urgency || 'Media';
    if (dom.modalAssignedTeam) dom.modalAssignedTeam.textContent = incident.assignedTeam || 'En despacho';

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

    // Resaltar estado activo en los botones de cambio de estado
    dom.btnChangeStatus.forEach(btn => {
      const btnStatus = btn.getAttribute('data-new-status');
      const isCurrent = btnStatus === incident.status;
      btn.disabled = isCurrent;
      btn.classList.toggle('ring-2', isCurrent);
      btn.classList.toggle('ring-primary', isCurrent);
      btn.classList.toggle('opacity-60', isCurrent);
      btn.classList.toggle('cursor-default', isCurrent);
    });

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
              <span>${escapeHtml(catLabels[k] || k)}</span>
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
    state.currentUser = { ...GUEST_USER };
    saveSessionUser(state.currentUser);

    // 2. Cerrar cualquier modal abierto y limpiar credenciales del formulario
    closeAuthModal();
    clearAuthLoginForm();

    // 3. Reconfigurar interfaz y cambiar a la vista de reporte ciudadano
    renderNavForRole('invitado');
    switchView('view-inicio');

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
      saveSessionUser(state.currentUser);
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
      saveSessionUser(state.currentUser);
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
      saveSessionUser(state.currentUser);
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
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': state.currentUser.role,
          'x-user-name': state.currentUser.name
        },
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
      saveSessionUser(state.currentUser);
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
  // Centro de Configuración del Sistema, Cuenta, Temas y Accesibilidad
  // ==========================================
  const DEFAULT_SYSTEM_PREFS = {
    theme: 'light',          // 'light' | 'dark' | 'system'
    accent: 'blue',          // 'blue' | 'emerald' | 'indigo' | 'amber' | 'slate'
    fontScale: 'normal',     // 'sm' | 'normal' | 'lg' | 'xl'
    compactCards: false,
    highContrast: false,
    reduceMotion: false,
    showToasts: true,
    soundAlerts: false,
    defaultSector: 'centro', // 'centro' | 'norte' | 'sur' | 'oriente' | 'poniente'
    defaultReporter: '',
    autoSyncSec: 0           // 0 | 30 | 60 | 300
  };

  let systemPrefs = loadSystemPrefsFromStorage();
  let autoSyncIntervalId = null;

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

  function isDarkActive() {
    if (systemPrefs.theme === 'dark') return true;
    if (systemPrefs.theme === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function switchSettingsTab(tabName) {
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
      const t = btn.getAttribute('data-settings-tab');
      if (t === tabName) {
        btn.className = 'settings-tab-btn active shrink-0 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-primary text-on-primary shadow-sm transition-all';
      } else {
        btn.className = 'settings-tab-btn shrink-0 px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 text-on-surface-variant hover:bg-surface-container transition-all';
      }
    });

    ['appearance', 'account', 'preferences', 'accessibility'].forEach(panelKey => {
      const panel = document.getElementById(`settings-panel-${panelKey}`);
      if (panel) {
        panel.classList.toggle('hidden', panelKey !== tabName);
      }
    });

    if (tabName === 'account') {
      syncSettingsAccountTab();
    }
  }

  function syncSettingsAccountTab() {
    const user = state.currentUser || { role: 'invitado', name: 'Vecino Invitado', email: '' };
    const isGuest = user.role === 'invitado';
    const roleConfig = ROLE_PERMISSIONS[user.role] || ROLE_PERMISSIONS.invitado;

    const nameEl = document.getElementById('settings-account-name');
    const roleBadgeEl = document.getElementById('settings-account-role-badge');
    const emailEl = document.getElementById('settings-account-email');
    const iconEl = document.getElementById('settings-account-avatar-icon');
    const guestActions = document.getElementById('settings-account-guest-actions');
    const authActions = document.getElementById('settings-account-auth-actions');
    const guestBlock = document.getElementById('settings-guest-profile-block');
    const authBlock = document.getElementById('settings-authenticated-profile-block');

    if (nameEl) nameEl.textContent = user.name || 'Vecino Invitado';
    if (roleBadgeEl) roleBadgeEl.textContent = roleConfig.label;
    if (emailEl) {
      emailEl.textContent = isGuest ? 'Modo público sin sesión iniciada' : `${user.email || ''} • ${user.department || 'Comunidad'}`;
    }
    if (iconEl) {
      iconEl.textContent = user.role === 'admin' ? 'shield_person' : (user.role === 'trabajador' ? 'engineering' : (user.role === 'vecino' ? 'cottage' : 'person'));
    }

    if (guestActions) guestActions.classList.toggle('hidden', !isGuest);
    if (authActions) authActions.classList.toggle('hidden', isGuest);
    if (guestBlock) guestBlock.classList.toggle('hidden', !isGuest);
    if (authBlock) authBlock.classList.toggle('hidden', isGuest);

    if (!isGuest) {
      const pName = document.getElementById('settings-profile-name');
      const pEmail = document.getElementById('settings-profile-email');
      const pRut = document.getElementById('settings-profile-rut');
      const pDept = document.getElementById('settings-profile-dept');
      if (pName) pName.value = user.name || '';
      if (pEmail) pEmail.value = user.email || '';
      if (pRut) pRut.value = (user.rutDni && user.rutDni !== 'Sin DNI') ? user.rutDni : '';
      if (pDept) pDept.value = user.department || '';
    } else {
      const repInput = document.getElementById('pref-input-default-reporter');
      if (repInput) repInput.value = systemPrefs.defaultReporter || '';
    }
  }

  function applySystemPrefs() {
    const root = document.documentElement;
    const dark = isDarkActive();

    root.classList.toggle('dark', dark);
    root.setAttribute('data-accent', systemPrefs.accent || 'blue');
    root.setAttribute('data-font-scale', systemPrefs.fontScale || 'normal');
    root.classList.toggle('cc-compact-cards', !!systemPrefs.compactCards);
    root.classList.toggle('cc-high-contrast', !!systemPrefs.highContrast);
    root.classList.toggle('cc-reduce-motion', !!systemPrefs.reduceMotion);

    // Actualizar icono rápido en el Header
    const quickIcon = document.getElementById('icon-quick-theme');
    if (quickIcon) {
      quickIcon.textContent = dark ? 'light_mode' : 'dark_mode';
      quickIcon.className = `material-symbols-outlined text-[18px] ${dark ? 'text-amber-400' : 'text-on-surface'}`;
    }

    // Actualizar etiqueta e indicadores dentro del modal de Configuración
    const themeLabel = document.getElementById('settings-current-theme-label');
    if (themeLabel) {
      const names = {
        light: 'Modo Claro',
        dark: 'Modo Oscuro',
        system: `Automático (${dark ? 'Oscuro' : 'Claro'})`
      };
      themeLabel.textContent = names[systemPrefs.theme] || 'Modo Claro';
    }

    document.querySelectorAll('.pref-theme-btn').forEach(btn => {
      const val = btn.getAttribute('data-pref-theme');
      if (val === systemPrefs.theme) {
        btn.className = 'pref-theme-btn flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-2xl border-2 border-primary bg-primary/10 shadow-sm transition-all';
      } else {
        btn.className = 'pref-theme-btn flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-2xl border-2 border-outline-variant/30 bg-surface-container-low hover:bg-surface-container transition-all';
      }
    });

    document.querySelectorAll('.pref-accent-btn').forEach(btn => {
      const val = btn.getAttribute('data-pref-accent');
      if (val === systemPrefs.accent) {
        btn.className = 'pref-accent-btn flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 border-primary bg-primary/10 shadow-sm transition-all';
      } else {
        btn.className = 'pref-accent-btn flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 border-outline-variant/30 bg-surface-container-low hover:bg-surface-container transition-all';
      }
    });

    document.querySelectorAll('.pref-font-btn').forEach(btn => {
      const val = btn.getAttribute('data-pref-font');
      const sizeClass = val === 'sm' ? 'text-[11px]' : (val === 'lg' ? 'text-sm' : (val === 'xl' ? 'text-base' : 'text-xs'));
      if (val === systemPrefs.fontScale) {
        btn.className = `pref-font-btn py-2.5 px-2 rounded-xl border-2 border-primary bg-primary text-on-primary font-bold ${sizeClass} shadow-sm transition-all`;
      } else {
        btn.className = `pref-font-btn py-2.5 px-2 rounded-xl border-2 border-outline-variant/30 bg-surface-container-low hover:bg-surface-container font-bold ${sizeClass} text-on-surface transition-all`;
      }
    });

    const chkCompact = document.getElementById('pref-toggle-compact');
    if (chkCompact) chkCompact.checked = !!systemPrefs.compactCards;

    const chkContrast = document.getElementById('pref-toggle-contrast');
    if (chkContrast) chkContrast.checked = !!systemPrefs.highContrast;

    const chkMotion = document.getElementById('pref-toggle-motion');
    if (chkMotion) chkMotion.checked = !!systemPrefs.reduceMotion;

    const chkToasts = document.getElementById('pref-toggle-toasts');
    if (chkToasts) chkToasts.checked = systemPrefs.showToasts !== false;

    const chkSound = document.getElementById('pref-toggle-sound');
    if (chkSound) chkSound.checked = !!systemPrefs.soundAlerts;

    const selSector = document.getElementById('pref-select-default-sector');
    if (selSector) selSector.value = systemPrefs.defaultSector || 'centro';

    const formSector = document.getElementById('select-sector');
    if (formSector && systemPrefs.defaultSector) {
      formSector.value = systemPrefs.defaultSector;
    }

    const reportedByEl = document.getElementById('input-reportedBy');
    if (reportedByEl && state.currentUser.role === 'invitado' && systemPrefs.defaultReporter && !reportedByEl.value) {
      reportedByEl.value = systemPrefs.defaultReporter;
    }

    const selAutoSync = document.getElementById('pref-select-autosync');
    if (selAutoSync) selAutoSync.value = String(systemPrefs.autoSyncSec || 0);

    syncSettingsAccountTab();
    setupAutoSyncTimer();
  }

  function setupAutoSyncTimer() {
    if (autoSyncIntervalId) {
      clearInterval(autoSyncIntervalId);
      autoSyncIntervalId = null;
    }
    const sec = parseInt(systemPrefs.autoSyncSec, 10) || 0;
    if (sec > 0) {
      autoSyncIntervalId = setInterval(() => {
        loadIncidents();
      }, sec * 1000);
    }
  }

  function toggleQuickTheme() {
    const currentlyDark = isDarkActive();
    systemPrefs.theme = currentlyDark ? 'light' : 'dark';
    saveSystemPrefsToStorage();
    applySystemPrefs();
    showToast(systemPrefs.theme === 'dark' ? '🌙 Tema Oscuro activado' : '☀️ Tema Claro activado', 'info');
  }

  function openSystemSettingsModal(initialTab = 'appearance') {
    const modal = document.getElementById('modal-system-settings');
    if (!modal) return;
    applySystemPrefs();
    const tab = (typeof initialTab === 'string' && initialTab) ? initialTab : 'appearance';
    switchSettingsTab(tab);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function closeSystemSettingsModal() {
    const modal = document.getElementById('modal-system-settings');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  function resetSystemSettings() {
    systemPrefs = { ...DEFAULT_SYSTEM_PREFS };
    saveSystemPrefsToStorage();
    applySystemPrefs();
    showToast('Configuraciones restablecidas a sus valores de fábrica', 'success');
  }

  function exportSystemSettings() {
    try {
      const blob = new Blob([JSON.stringify(systemPrefs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'civiccore-ajustes.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Archivo de ajustes descargado correctamente', 'success');
    } catch (e) {
      showToast('No se pudo exportar la configuración', 'error');
    }
  }

  async function handleSettingsProfileSubmit(e) {
    e.preventDefault();
    if (!state.currentUser || state.currentUser.role === 'invitado') return;

    const name = document.getElementById('settings-profile-name')?.value.trim();
    const email = document.getElementById('settings-profile-email')?.value.trim();
    const rutDni = document.getElementById('settings-profile-rut')?.value.trim();
    const department = document.getElementById('settings-profile-dept')?.value.trim();

    if (!name || !email) {
      showToast('El nombre y correo electrónico son obligatorios', 'error');
      return;
    }

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(state.currentUser.id || ''),
          'x-user-email': state.currentUser.email || '',
          'x-user-role': state.currentUser.role,
          'x-user-name': state.currentUser.name
        },
        body: JSON.stringify({
          id: state.currentUser.id,
          name,
          email,
          rutDni: rutDni || 'Sin DNI',
          department: department || 'Comunidad'
        })
      });

      const json = await res.json();
      if (!res.ok) {
        showToast(json.message || 'No se pudieron actualizar tus datos en el servidor', 'error');
        return;
      }

      if (json.data) {
        state.currentUser = { ...state.currentUser, ...json.data };
      } else {
        state.currentUser.name = name;
        state.currentUser.email = email;
        state.currentUser.rutDni = rutDni || 'Sin DNI';
        state.currentUser.department = department || 'Comunidad';
      }

      saveSessionUser(state.currentUser);
      renderNavForRole(state.currentUser.role);
      syncSettingsAccountTab();
      showToast('Tus datos de perfil se han actualizado en la base de datos', 'success');
    } catch (err) {
      console.error('Error al actualizar perfil:', err);
      showToast('Error al guardar tus datos de perfil', 'error');
    }
  }

  async function handleSettingsPasswordSubmit(e) {
    e.preventDefault();
    if (!state.currentUser || state.currentUser.role === 'invitado') {
      showToast('Debes iniciar sesión para cambiar tu contraseña', 'error');
      return;
    }

    const currentPwdEl = document.getElementById('settings-current-pwd');
    const newPwdEl = document.getElementById('settings-new-pwd');
    const confirmPwdEl = document.getElementById('settings-confirm-pwd');
    const currentPassword = currentPwdEl ? currentPwdEl.value.trim() : '';
    const newPassword = newPwdEl ? newPwdEl.value.trim() : '';
    const confirmPassword = confirmPwdEl ? confirmPwdEl.value.trim() : '';

    if (!currentPassword) {
      showToast('Debes ingresar tu contraseña actual', 'error');
      if (currentPwdEl) currentPwdEl.focus();
      return;
    }

    if (newPassword.length < 4) {
      showToast('La contraseña debe tener al menos 4 caracteres', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('Las contraseñas no coinciden', 'error');
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': state.currentUser.role,
          'x-user-name': state.currentUser.name,
          'x-user-email': state.currentUser.email
        },
        body: JSON.stringify({ email: state.currentUser.email, currentPassword, newPassword })
      });

      const json = await res.json();
      if (!res.ok) {
        showToast(json.message || 'No se pudo actualizar la contraseña', 'error');
        return;
      }

      if (currentPwdEl) currentPwdEl.value = '';
      if (newPwdEl) newPwdEl.value = '';
      if (confirmPwdEl) confirmPwdEl.value = '';
      showToast('¡Tu contraseña ha sido actualizada con éxito!', 'success');
    } catch (err) {
      console.error('Error al cambiar contraseña desde ajustes:', err);
      showToast('Error de conexión con el servidor', 'error');
    }
  }

  function playAlertTone(type = 'info', force = false) {
    if (!force && !systemPrefs.soundAlerts) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = type === 'error' ? 320 : (type === 'success' ? 660 : 520);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.17);
    } catch (e) {}
  }

  // ==========================================
  // Toasts / Notificaciones Flotantes
  // ==========================================
  function showToast(message, type = 'info') {
    playAlertTone(type);
    if (systemPrefs.showToasts === false) return;

    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-red-600 text-white',
      info: 'bg-primary text-on-primary'
    };

    toast.className = `px-4 py-3 rounded-2xl shadow-xl font-medium text-xs flex items-center gap-2.5 transform transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto border border-white/20 ${colors[type] || colors.info}`;
    toast.innerHTML = `
      <span class="material-symbols-outlined text-[18px]">${type === 'success' ? 'check_circle' : (type === 'error' ? 'error' : 'info')}</span>
      <span>${escapeHtml(message)}</span>
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

    // Eventos de Tema Rápido y Modal de Configuraciones del Sistema
    const btnQuickTheme = document.getElementById('btn-quick-theme-toggle');
    if (btnQuickTheme) {
      btnQuickTheme.addEventListener('click', toggleQuickTheme);
    }

    const btnOpenSysSettings = document.getElementById('btn-open-system-settings');
    if (btnOpenSysSettings) {
      btnOpenSysSettings.addEventListener('click', () => openSystemSettingsModal('appearance'));
    }

    const btnCloseSysSettings = document.getElementById('btn-close-system-settings');
    if (btnCloseSysSettings) {
      btnCloseSysSettings.addEventListener('click', closeSystemSettingsModal);
    }

    const btnSaveCloseSysSettings = document.getElementById('btn-save-close-system-settings');
    if (btnSaveCloseSysSettings) {
      btnSaveCloseSysSettings.addEventListener('click', () => {
        closeSystemSettingsModal();
        showToast('Configuraciones guardadas y aplicadas', 'success');
      });
    }

    const btnResetSysSettings = document.getElementById('btn-reset-system-settings');
    if (btnResetSysSettings) {
      btnResetSysSettings.addEventListener('click', resetSystemSettings);
    }

    const btnExportPrefs = document.getElementById('btn-export-system-prefs');
    if (btnExportPrefs) {
      btnExportPrefs.addEventListener('click', exportSystemSettings);
    }

    const modalSysSettings = document.getElementById('modal-system-settings');
    if (modalSysSettings) {
      modalSysSettings.addEventListener('click', (e) => {
        if (e.target === modalSysSettings) closeSystemSettingsModal();
      });
    }

    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-settings-tab');
        if (tab) switchSettingsTab(tab);
      });
    });

    const formSettingsProfile = document.getElementById('form-settings-profile');
    if (formSettingsProfile) {
      formSettingsProfile.addEventListener('submit', handleSettingsProfileSubmit);
    }

    const formSettingsPwd = document.getElementById('form-settings-password');
    if (formSettingsPwd) {
      formSettingsPwd.addEventListener('submit', handleSettingsPasswordSubmit);
    }

    const btnToggleSettingsPwd = document.getElementById('btn-toggle-settings-pwd');
    if (btnToggleSettingsPwd) {
      btnToggleSettingsPwd.addEventListener('click', () => {
        const input = document.getElementById('settings-new-pwd');
        if (input) {
          input.setAttribute('type', input.getAttribute('type') === 'password' ? 'text' : 'password');
        }
      });
    }

    const btnSaveDefaultReporter = document.getElementById('btn-save-default-reporter');
    if (btnSaveDefaultReporter) {
      btnSaveDefaultReporter.addEventListener('click', () => {
        const val = document.getElementById('pref-input-default-reporter')?.value.trim() || '';
        systemPrefs.defaultReporter = val;
        saveSystemPrefsToStorage();
        applySystemPrefs();
        showToast(val ? `Alias "${val}" guardado para tus reportes` : 'Alias predeterminado borrado', 'success');
      });
    }

    document.querySelectorAll('.pref-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        systemPrefs.theme = btn.getAttribute('data-pref-theme') || 'light';
        saveSystemPrefsToStorage();
        applySystemPrefs();
      });
    });

    document.querySelectorAll('.pref-accent-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        systemPrefs.accent = btn.getAttribute('data-pref-accent') || 'blue';
        saveSystemPrefsToStorage();
        applySystemPrefs();
      });
    });

    document.querySelectorAll('.pref-font-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        systemPrefs.fontScale = btn.getAttribute('data-pref-font') || 'normal';
        saveSystemPrefsToStorage();
        applySystemPrefs();
      });
    });

    const chkCompact = document.getElementById('pref-toggle-compact');
    if (chkCompact) {
      chkCompact.addEventListener('change', (e) => {
        systemPrefs.compactCards = e.target.checked;
        saveSystemPrefsToStorage();
        applySystemPrefs();
      });
    }

    const chkContrast = document.getElementById('pref-toggle-contrast');
    if (chkContrast) {
      chkContrast.addEventListener('change', (e) => {
        systemPrefs.highContrast = e.target.checked;
        saveSystemPrefsToStorage();
        applySystemPrefs();
      });
    }

    const chkMotion = document.getElementById('pref-toggle-motion');
    if (chkMotion) {
      chkMotion.addEventListener('change', (e) => {
        systemPrefs.reduceMotion = e.target.checked;
        saveSystemPrefsToStorage();
        applySystemPrefs();
      });
    }

    const chkToasts = document.getElementById('pref-toggle-toasts');
    if (chkToasts) {
      chkToasts.addEventListener('change', (e) => {
        systemPrefs.showToasts = e.target.checked;
        saveSystemPrefsToStorage();
        applySystemPrefs();
      });
    }

    const chkSound = document.getElementById('pref-toggle-sound');
    if (chkSound) {
      chkSound.addEventListener('change', (e) => {
        systemPrefs.soundAlerts = e.target.checked;
        saveSystemPrefsToStorage();
        applySystemPrefs();
        if (systemPrefs.soundAlerts) playAlertTone('success', true);
      });
    }

    const btnTestSound = document.getElementById('btn-test-alert-sound');
    if (btnTestSound) {
      btnTestSound.addEventListener('click', () => {
        playAlertTone('success', true);
      });
    }

    const selDefaultSector = document.getElementById('pref-select-default-sector');
    if (selDefaultSector) {
      selDefaultSector.addEventListener('change', (e) => {
        systemPrefs.defaultSector = e.target.value;
        saveSystemPrefsToStorage();
        applySystemPrefs();
      });
    }

    const selAutoSync = document.getElementById('pref-select-autosync');
    if (selAutoSync) {
      selAutoSync.addEventListener('change', (e) => {
        systemPrefs.autoSyncSec = parseInt(e.target.value, 10) || 0;
        saveSystemPrefsToStorage();
        applySystemPrefs();
      });
    }

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (systemPrefs.theme === 'system') applySystemPrefs();
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


    // CC-02: Cancelación del reporte ciudadano
    const btnCancelIncident = document.getElementById('btn-cancel-incident');
    const btnContinueIncident = document.getElementById('btn-continue-incident');
    const btnDiscardIncident = document.getElementById('btn-discard-incident');
    const modalCancelIncident = document.getElementById('modal-cancel-incident');

    if (btnCancelIncident) {
      btnCancelIncident.addEventListener('click', openCancelIncidentModal);
    }

    if (btnContinueIncident) {
      btnContinueIncident.addEventListener('click', closeCancelIncidentModal);
    }

    if (btnDiscardIncident) {
      btnDiscardIncident.addEventListener('click', () => {
        closeCancelIncidentModal();

        // Descartar los datos que todavía no se enviaron
        if (dom.form) dom.form.reset();
        removeCustomPhoto();
        setFormStep(1);

        // Volver al inicio
        switchView('view-inicio');
        showToast('Reporte cancelado. No se guardaron los datos.', 'info');
      });
    }

    if (modalCancelIncident) {
      modalCancelIncident.addEventListener('click', (e) => {
        if (e.target === modalCancelIncident) {
          closeCancelIncidentModal();
        }
      });
    }


    // Botones del Modal de Comprobante / Éxito
    const btnSuccessNew = document.getElementById('btn-success-new-report');
    if (btnSuccessNew) {
      btnSuccessNew.addEventListener('click', () => {
        closeReportSuccessModal();
        setFormStep(1);
        switchView('view-nuevo');
        const mainScroll = document.getElementById('main-scroll-container');
        if (mainScroll) mainScroll.scrollTo({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    const btnCloseSuccess = document.getElementById('btn-close-success-modal');
    if (btnCloseSuccess) {
      btnCloseSuccess.addEventListener('click', () => {
          closeReportSuccessModal();
          switchView('view-inicio');
        });
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
          t.className = 'tab-status shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container shadow-sm transition-all';
        });
        tab.className = 'tab-status active shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-on-primary shadow-sm transition-all';
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
          b.className = 'map-sector-btn shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high text-xs font-bold transition-all';
        });
        btn.className = 'map-sector-btn active shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full bg-primary text-on-primary text-xs font-bold transition-all shadow-sm';
        state.selectedSector = btn.getAttribute('data-sector');
        renderMapPins();
      });
    });

    if (dom.btnCloseMapPreview) {
      dom.btnCloseMapPreview.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.mapIncidentPreview.classList.add('hidden');
        if (dom.mapPinsLayer) {
          dom.mapPinsLayer.querySelectorAll('.map-pin.active').forEach(p => p.classList.remove('active'));
        }
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
        closeSystemSettingsModal();
        closeEditUserModal();
        closeUserActionsMenu();
      }
    });

    const modalEditUser = document.getElementById('modal-edit-user');
    if (modalEditUser) {
      modalEditUser.addEventListener('click', (e) => {
        if (e.target === modalEditUser) closeEditUserModal();
      });
    }

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
      dom.currentUserBadge.setAttribute('title', 'Clic para abrir tu cuenta y cambiar tu contraseña');
      dom.currentUserBadge.addEventListener('click', () => {
        openSystemSettingsModal('account');
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

          applyMunicipalitySettings({
            municipality_name: municipality,
            emergency_phone: phone,
            sla_hours: sla
          });
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

  // ==========================================
  // Funciones de la Página de Inicio (Landing Page)
  // ==========================================
  function renderHomeStats() {
    const totalEl = document.getElementById('home-kpi-total');
    const inProgressEl = document.getElementById('home-kpi-progreso');
    const resolvedEl = document.getElementById('home-kpi-resueltas');
    const rateEl = document.getElementById('home-kpi-eficiencia');

    const total = state.incidents.length;
    const resolved = state.incidents.filter(i => i.status === 'resolved').length;
    const inProgress = state.incidents.filter(i => i.status === 'progress').length;
    const rate = total > 0 ? Math.round(((resolved + (inProgress * 0.5)) / total) * 100) : 94;

    if (totalEl) totalEl.textContent = total > 0 ? String(total) : '0';
    if (inProgressEl) inProgressEl.textContent = total > 0 ? String(inProgress) : '0';
    if (resolvedEl) resolvedEl.textContent = total > 0 ? String(resolved) : '0';
    if (rateEl) rateEl.textContent = `${rate}%`;
  }

  async function handleHomeFolioSearch() {
    const input = document.getElementById('home-folio-input');
    const val = (input ? input.value : '').trim();
    if (!val) {
      showToast('Ingresa un número de folio para rastrear', 'info');
      return;
    }

    const clean = val.replace('#', '').toUpperCase();
    let found = state.incidents.find(i => (i.id && i.id.toUpperCase() === clean) || (i.folio && i.folio.toUpperCase().includes(clean)));

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

    const resultBox = document.getElementById('home-folio-result-box');
    const notFoundBox = document.getElementById('home-folio-not-found');

    if (!found) {
      if (resultBox) resultBox.classList.add('hidden');
      if (notFoundBox) {
        notFoundBox.classList.remove('hidden');
        const notFoundCode = document.getElementById('home-not-found-folio-code');
        if (notFoundCode) notFoundCode.textContent = clean;
      }
      showToast(`No se encontró reporte con folio #${clean}`, 'error');
      return;
    }

    if (notFoundBox) notFoundBox.classList.add('hidden');
    if (resultBox) {
      resultBox.classList.remove('hidden');
      const folioEl = document.getElementById('home-res-folio');
      const titleEl = document.getElementById('home-res-title');
      const addressEl = document.getElementById('home-res-address');
      const dateEl = document.getElementById('home-res-date');
      const statusPill = document.getElementById('home-res-status-pill');

      if (folioEl) folioEl.textContent = found.folio || `#${found.id}`;
      if (titleEl) titleEl.textContent = found.title;
      if (addressEl) addressEl.innerHTML = `<span class="material-symbols-outlined text-[15px] shrink-0">pin_drop</span> <span>${escapeHtml(found.address || 'Comuna Central')} • Cuadrilla: ${escapeHtml(found.assignedTeam || 'En despacho')}</span>`;
      if (dateEl) dateEl.textContent = found.createdAt ? new Date(found.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Reciente';

      if (statusPill) {
        if (found.status === 'resolved') {
          statusPill.className = 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1.5';
          statusPill.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Resuelto';
        } else if (found.status === 'progress') {
          statusPill.className = 'px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 flex items-center gap-1.5';
          statusPill.innerHTML = '<span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> En Cuadrilla / Proceso';
        } else {
          statusPill.className = 'px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1.5';
          statusPill.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500"></span> Pendiente de Triaje';
        }
      }

      const btnViewModal = document.getElementById('home-btn-view-modal');
      if (btnViewModal) {
        btnViewModal.onclick = () => openIncidentModal(found.id);
      }
    }

    showToast(`Folio ${found.folio || found.id} localizado exitosamente`, 'success');
  }

  function scrollToHomeTracker() {
    if (state.currentView !== 'view-inicio') {
      switchView('view-inicio');
    }
    setTimeout(() => {
      document.querySelectorAll('#view-inicio .cc-scroll-item').forEach(item => {
        item.dataset.forceVisible = 'true';
        item.classList.add('cc-scroll-visible');
        item.classList.remove('cc-scroll-hidden');
      });
      const el = document.getElementById('seccion-rastreo-inicio');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = document.getElementById('home-folio-input');
        if (input) input.focus();
      }
    }, 120);
  }

  function reportCategory(categoryValue) {
    switchView('view-nuevo');
    setTimeout(() => {
      setFormStep(1);
      const radio = document.querySelector(`input[name="category"][value="${categoryValue}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const scrollEl = document.getElementById('main-scroll-container');
      if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
    }, 80);
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
    initEvents();
    renderNavForRole(state.currentUser.role);
    switchView(ROLE_PERMISSIONS[state.currentUser.role].defaultView);
    loadIncidents();
    loadGoogleAuthConfig();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();