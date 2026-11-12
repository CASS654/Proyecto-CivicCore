// Navegación: cambio de vista según permisos, menús por rol, títulos e indicadores activos.

import { ROLE_PERMISSIONS } from './config.js';
import { state, systemPrefs, saveSystemPrefsToStorage } from './state.js';
import { showToast } from './ui.js';

const dom = {
  views: document.querySelectorAll('.view-panel'),
  mobileBottomNav: document.getElementById('mobile-bottom-nav'),
  currentUserBadge: document.getElementById('current-user-badge'),
  btnAuthText: document.getElementById('btn-auth-text'),
  mobileNavContainer: document.getElementById('mobile-bottom-nav-container'),
  userDisplayName: document.getElementById('user-display-name'),
  userDisplayRole: document.getElementById('user-display-role'),
  sidebarNavMenu: document.getElementById('sidebar-nav-menu'),
  sidebarUserName: document.getElementById('sidebar-user-name'),
  sidebarUserRole: document.getElementById('sidebar-user-role'),
  sidebarAvatarIcon: document.getElementById('sidebar-avatar-icon'),
  sidebarBtnChangePassword: document.getElementById('sidebar-btn-change-password'),
  sidebarBtnSettings: document.getElementById('sidebar-btn-system-settings'),
  sidebarDesktop: document.getElementById('sidebar-desktop'),
  btnSidebarCollapse: document.getElementById('btn-sidebar-collapse'),
  btnSidebarExpand: document.getElementById('btn-sidebar-expand'),
  sidebarToggleIcon: document.getElementById('sidebar-toggle-icon'),
  headerLogo: document.getElementById('header-logo'),
  headerTitleBlock: document.getElementById('header-title-block'),
  headerTitle: document.getElementById('header-view-title'),
  headerContextTag: document.getElementById('header-context-tag'),
  headerViewIcon: document.getElementById('header-view-icon'),
  headerHomeNav: document.getElementById('header-home-nav'),
  headerQuickNav: document.getElementById('header-quick-nav')
};

// Metadatos contextuales de cada vista para el bloque de título en el header
const VIEW_META = {
  'view-inicio': { title: 'CivicCore', context: 'Portal Ciudadano', icon: 'account_balance' },
  'view-nuevo': { title: 'Nuevo Reporte Ciudadano', context: 'Atención Vecinal', icon: 'add_alert' },
  'view-vecino': { title: 'Portal de Seguimiento Vecinal', context: 'Espacio Ciudadano', icon: 'cottage' },
  'view-incidencias': { title: 'Bandeja de Reportes', context: 'Operaciones de Campo', icon: 'assignment' },
  'view-mapa': { title: 'Mapa Territorial de Incidencias', context: 'Georreferenciación', icon: 'map' },
  'view-panel': { title: 'Panel de Gestión (KPIs)', context: 'Inteligencia Municipal', icon: 'dashboard' },
  'view-admin-hub': { title: 'Consola Maestra', context: 'Gobernanza TI', icon: 'shield_person' },
  'view-admin-users': { title: 'Padrón de Usuarios y Claves', context: 'Seguridad & Accesos', icon: 'vpn_key' },
  'view-admin-moderation': { title: 'Edición Canónica de Folios', context: 'Moderación Oficial', icon: 'edit_note' },
  'view-admin-audit': { title: 'Bitácora de Auditoría Legal', context: 'Trazabilidad SHA-256', icon: 'history_edu' }
};

// Cada vista registra aquí lo que hace al entrar (ver civiccore.js)
const onEnter = {};

// Filas del Rail estilo Gemini / Antigravity: 40px exactos de alto (h-10) y bordes redondeados limpios sin sombras desbordadas
const SIDEBAR_ROW = 'cc-focus w-full h-10 flex items-center rounded-xl text-[13px]';
const SIDEBAR_ITEM = `sidebar-nav-item ${SIDEBAR_ROW} font-medium text-on-surface-variant hover:bg-surface-container-high/70 hover:text-on-surface`;
const SIDEBAR_ITEM_ACTIVE = `sidebar-nav-item active ${SIDEBAR_ROW} font-bold text-primary`;
// Acciones sin vista propia (Rastrear Folio, Acceder)
const SIDEBAR_ACTION = `sidebar-nav-action ${SIDEBAR_ROW} font-medium text-on-surface-variant hover:bg-surface-container-high/70 hover:text-on-surface`;
const SIDEBAR_BADGE = 'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold leading-none border';

// Botones del header en la portada (Inicio) por rol: [vista, icono, texto, acción de window.civicApp si no es cambiar de vista]
const HEADER_NAV = {
  invitado: [
    ['view-inicio', 'home', 'Inicio'],
    ['view-nuevo', 'add_circle', 'Reportar'],
    [null, 'search', 'Rastrear Folio', 'scrollToHomeTracker()']
  ],
  vecino: [
    ['view-vecino', 'cottage', 'Portal Vecinal'],
    ['view-nuevo', 'add_circle', 'Reportar']
  ],
  trabajador: [
    ['view-incidencias', 'assignment', 'Bandeja'],
    ['view-mapa', 'map', 'Mapa'],
    ['view-panel', 'dashboard', 'KPIs'],
    ['view-nuevo', 'add_circle', 'Reportar']
  ],
  admin: [
    ['view-admin-hub', 'shield_person', 'Consola'],
    ['view-admin-users', 'vpn_key', 'Usuarios'],
    ['view-admin-moderation', 'edit_note', 'Moderar'],
    ['view-admin-audit', 'history_edu', 'Auditoría'],
    ['view-incidencias', 'assignment', 'Bandeja']
  ]
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
  updateHeaderMeta(targetViewId);
  updateLayout();

  // Ocultar todas las vistas y mostrar la activa
  dom.views.forEach(v => v.classList.toggle('hidden', v.id !== targetViewId));

  updateActiveNavIndicators(targetViewId);

  if (onEnter[targetViewId]) onEnter[targetViewId]();

  if (!options.keepScroll) {
    const mainScroll = document.getElementById('main-scroll-container');
    if (mainScroll) mainScroll.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function updateHeaderMeta(viewId) {
  const meta = VIEW_META[viewId] || VIEW_META['view-inicio'];
  if (dom.headerTitle) dom.headerTitle.textContent = meta.title;
  if (dom.headerContextTag) dom.headerContextTag.textContent = meta.context;
  if (dom.headerViewIcon) dom.headerViewIcon.textContent = meta.icon;
  if (dom.headerTitleBlock) {
    dom.headerTitleBlock.classList.remove('cc-title-swap');
    void dom.headerTitleBlock.offsetWidth;
    dom.headerTitleBlock.classList.add('cc-title-swap');
  }
}

// En la portada (Inicio) la barra lateral no se muestra; en las vistas internas
// funciona como el Navigation Rail de Gemini / Antigravity (268px expandido <-> 68px contraído).
function updateLayout(animateNow = false) {
  const isHome = state.currentView === 'view-inicio';
  const collapsed = !!systemPrefs.sidebarCollapsed;
  const sidebarExpanded = !collapsed;

  document.body.dataset.layout = isHome ? 'home' : 'app';

  if (dom.sidebarDesktop) {
    const prevState = dom.sidebarDesktop.dataset.state;
    const nextState = isHome ? 'hidden' : (sidebarExpanded ? 'open' : 'closed');
    dom.sidebarDesktop.dataset.state = nextState;
    dom.sidebarDesktop.inert = isHome;

    if (animateNow && !isHome && prevState !== nextState && typeof dom.sidebarDesktop.animate === 'function') {
      runSidebarChoreography(sidebarExpanded);
    }
  }

  if (dom.sidebarToggleIcon) {
    dom.sidebarToggleIcon.textContent = sidebarExpanded ? 'left_panel_close' : 'left_panel_open';
  }

  if (dom.btnSidebarCollapse) {
    dom.btnSidebarCollapse.setAttribute('aria-expanded', String(sidebarExpanded));
    dom.btnSidebarCollapse.title = sidebarExpanded ? 'Contraer menú' : 'Expandir menú';
  }
  if (dom.btnSidebarExpand) {
    dom.btnSidebarExpand.setAttribute('aria-expanded', String(sidebarExpanded));
  }
}

// Coreografía Web Animations API (estilo Google Gemini / Antigravity)
function runSidebarChoreography(expanding) {
  const sidebar = dom.sidebarDesktop;
  if (!sidebar) return;

  const easeSpring = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const duration = 420;

  // 1. Animar el ancho del contenedor principal del rail (68px <-> 268px)
  sidebar.animate(
    [
      { width: expanding ? '68px' : '268px' },
      { width: expanding ? '268px' : '68px' }
    ],
    { duration, easing: easeSpring }
  );

  // 2. Animar el bloque de marca superior (se despliega a la izquierda del botón cuando está abierto)
  const brand = sidebar.querySelector('.cc-sidebar-brand');
  if (brand) {
    brand.getAnimations().forEach(a => a.cancel());
    brand.animate(
      [
        { maxWidth: expanding ? '0px' : '190px', opacity: expanding ? 0 : 1, transform: expanding ? 'translateX(-10px)' : 'translateX(0px)' },
        { maxWidth: expanding ? '190px' : '0px', opacity: expanding ? 1 : 0, transform: expanding ? 'translateX(0px)' : 'translateX(-10px)' }
      ],
      { duration, easing: easeSpring }
    );
  }

  // 3. Giro elástico del icono del botón superior (a la derecha al expandir, centrado al contraer)
  if (dom.sidebarToggleIcon) {
    dom.sidebarToggleIcon.animate(
      [
        { transform: 'scale(0.75) rotate(-90deg)', opacity: 0.4 },
        { transform: 'scale(1) rotate(0deg)', opacity: 1 }
      ],
      { duration: 340, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
    );
  }

  // 4. Transformar las píldoras (CTA, filas de navegación y chip de usuario) entre 40px exactos y 240px
  const pills = sidebar.querySelectorAll('.cc-sidebar-cta, .sidebar-nav-item, .sidebar-nav-action, .cc-sidebar-user-card');
  pills.forEach(pill => {
    pill.getAnimations().forEach(a => a.cancel());
    pill.animate(
      [
        { maxWidth: expanding ? '40px' : '240px' },
        { maxWidth: expanding ? '240px' : '40px' }
      ],
      { duration, easing: easeSpring }
    );
  });

  // 4. Revelar u ocultar etiquetas (.cc-rail-reveal) en cascada escalonada
  const reveals = sidebar.querySelectorAll('.cc-rail-reveal');
  reveals.forEach((el, idx) => {
    el.getAnimations().forEach(a => a.cancel());
    if (expanding) {
      el.animate(
        [
          { opacity: 0, transform: 'translateX(-12px)' },
          { opacity: 1, transform: 'translateX(0px)' }
        ],
        {
          duration: 320,
          delay: Math.min(idx * 22, 160),
          easing: easeSpring
        }
      );
    } else {
      el.animate(
        [
          { opacity: 1, transform: 'translateX(0px)' },
          { opacity: 0, transform: 'translateX(-10px)' }
        ],
        {
          duration: 180,
          easing: 'ease-out'
        }
      );
    }
  });
}

function setSidebarCollapsed(collapsed) {
  systemPrefs.sidebarCollapsed = collapsed;
  saveSystemPrefsToStorage();
  updateLayout(true);
}

function toggleSidebar() {
  setSidebarCollapsed(!systemPrefs.sidebarCollapsed);
}

function updateActiveNavIndicators(viewId) {
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    item.className = item.getAttribute('data-target') === viewId ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM;
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
    const isActive = btn.getAttribute('data-target') === viewId;
    btn.classList.toggle('text-primary', isActive);
    btn.classList.toggle('font-bold', isActive);
    btn.classList.toggle('text-on-surface-variant', !isActive);
  });
}

function headerNavButton([target, icon, label, action]) {
  return `
    <button ${target ? `data-target="${target}" ` : ''}onclick="window.civicApp.${action || `switchView('${target}')`}" class="header-nav-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shrink-0">
      <span class="material-symbols-outlined text-[16px] text-primary">${icon}</span>
      <span>${label}</span>
    </button>`;
}

function sidebarGroup(label, extraClass = '') {
  return `<div class="cc-sidebar-group px-2.5 pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-[0.11em] text-outline flex items-center gap-2 ${extraClass}"><span class="cc-rail-reveal">${label}</span></div>`;
}

function sidebarRowContent(icon, label, badge = '') {
  return `
      <span class="cc-nav-icon w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">${icon}</span>
      </span>
      <span class="cc-rail-reveal flex-1 flex items-center justify-between gap-2 pl-2 pr-3 min-w-0">
        <span class="truncate">${label}</span>${badge}
      </span>`;
}

function sidebarItem(target, icon, label, badge = '') {
  return `
    <button type="button" data-target="${target}" data-tooltip="${label}" class="${SIDEBAR_ITEM}">${sidebarRowContent(icon, label, badge)}
    </button>`;
}

function sidebarAction(action, icon, label, extraClass = '') {
  return `
    <button type="button" data-tooltip="${label}" onclick="window.civicApp.${action}" class="${SIDEBAR_ACTION} ${extraClass}">${sidebarRowContent(icon, label)}
    </button>`;
}

// Menú de la barra lateral (escritorio) según el rol
function sidebarMenuHtml(role) {
  if (role === 'vecino') {
    return sidebarGroup('Menú Vecinal') +
      sidebarItem('view-inicio', 'home', 'Inicio Municipal') +
      sidebarItem('view-vecino', 'cottage', 'Portal Vecinal') +
      sidebarItem('view-nuevo', 'add_alert', 'Reportar Incidencia',
        `<span class="${SIDEBAR_BADGE} bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Directo</span>`);
  }
  if (role === 'trabajador') {
    return sidebarGroup('Operaciones') +
      sidebarItem('view-inicio', 'home', 'Inicio Municipal') +
      sidebarItem('view-incidencias', 'assignment', 'Bandeja de Reportes',
        `<span id="badge-total-incidencias" class="${SIDEBAR_BADGE} tabular-nums bg-primary/10 text-primary border-primary/20">${state.incidents.length}</span>`) +
      sidebarItem('view-mapa', 'map', 'Mapa Comunal') +
      sidebarItem('view-panel', 'dashboard', 'Panel de Gestión (KPIs)');
  }
  if (role === 'admin') {
    return sidebarGroup('Gobernanza TI') +
      sidebarItem('view-inicio', 'home', 'Inicio Municipal') +
      sidebarItem('view-admin-hub', 'shield_person', 'Consola Maestra',
        `<span class="${SIDEBAR_BADGE} tracking-wide bg-error/10 text-error border-error/20">ROOT</span>`) +
      sidebarItem('view-admin-users', 'vpn_key', 'Padrón & Claves') +
      sidebarItem('view-admin-moderation', 'edit_note', 'Edición Canónica') +
      sidebarItem('view-admin-audit', 'history_edu', 'Auditoría Legal') +
      sidebarGroup('Supervisión', 'mt-2 pt-3 border-t border-outline-variant/25') +
      sidebarItem('view-incidencias', 'assignment', 'Bandeja General');
  }
  // Invitado
  return sidebarGroup('Explorar') +
    sidebarItem('view-inicio', 'home', 'Inicio Municipal') +
    sidebarItem('view-nuevo', 'add_alert', 'Generar Reporte') +
    sidebarAction('scrollToHomeTracker()', 'search', 'Rastrear Folio') +
    sidebarAction('openAuthModal()', 'login', 'Acceder con Cuenta', 'mt-1 !text-primary font-semibold');
}

// ==========================================
// Renderizado Dinámico de Menús según Rol
// ==========================================
function renderNavForRole(role) {
  const roleConfig = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.invitado;
  const isGuest = role === 'invitado';

  if (dom.mobileBottomNav) dom.mobileBottomNav.classList.remove('hidden');
  if (dom.btnAuthText) dom.btnAuthText.textContent = isGuest ? 'Iniciar Sesión' : 'Cerrar Sesión';

  // Botones del header (visibles solo en la portada, ver updateLayout)
  if (dom.headerQuickNav) {
    dom.headerQuickNav.innerHTML = (HEADER_NAV[role] || HEADER_NAV.invitado).map(headerNavButton).join('');
  }

  // Barra lateral de escritorio
  if (dom.sidebarNavMenu) {
    dom.sidebarNavMenu.innerHTML = sidebarMenuHtml(role);
    dom.sidebarNavMenu.querySelectorAll('.sidebar-nav-item, .sidebar-nav-action, .cc-sidebar-group').forEach((el, idx) => {
      el.style.setProperty('--cc-item-index', idx);
      el.classList.add('cc-sidebar-item-animate');
    });
    dom.sidebarNavMenu.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const iconBox = item.querySelector('.cc-nav-icon');
        if (iconBox && typeof iconBox.animate === 'function') {
          iconBox.animate(
            [
              { transform: 'scale(0.82)' },
              { transform: 'scale(1.16) rotate(-6deg)' },
              { transform: 'scale(1) rotate(0deg)' }
            ],
            { duration: 340, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
          );
        }
        switchView(item.getAttribute('data-target'));
      });
    });
  }
  if (dom.sidebarUserName) dom.sidebarUserName.textContent = state.currentUser.name;
  if (dom.sidebarUserRole) dom.sidebarUserRole.textContent = roleConfig.label;
  if (dom.sidebarAvatarIcon) dom.sidebarAvatarIcon.textContent = roleConfig.icon;
  // "Mi Clave" solo con sesión; sin ella "Ajustes y Tema" ocupa todo el ancho
  if (dom.sidebarBtnChangePassword) dom.sidebarBtnChangePassword.classList.toggle('hidden', isGuest);
  if (dom.sidebarBtnSettings) dom.sidebarBtnSettings.classList.toggle('col-span-full', isGuest);

  // Barra móvil inferior
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
  dom.mobileNavContainer.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      if (target) switchView(target);
    });
  });

  // Widgets de perfil en la cabecera
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

  updateActiveNavIndicators(state.currentView);
}

function init() {
  if (dom.btnSidebarCollapse) dom.btnSidebarCollapse.addEventListener('click', toggleSidebar);
  if (dom.btnSidebarExpand) dom.btnSidebarExpand.addEventListener('click', () => setSidebarCollapsed(false));

  // Al hacer clic en cualquier botón o elemento de la barra lateral cuando está contraída, se abre automáticamente con animación
  if (dom.sidebarDesktop) {
    dom.sidebarDesktop.addEventListener('click', (e) => {
      if (!systemPrefs.sidebarCollapsed) return;
      if (e.target.closest('#btn-sidebar-collapse')) return;
      if (e.target.closest('button, #sidebar-user-chip')) {
        setSidebarCollapsed(false);
      }
    });
  }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (dom.sidebarDesktop) dom.sidebarDesktop.classList.add('is-ready');
  }));
}

export { onEnter, switchView, renderNavForRole, updateLayout, init };
