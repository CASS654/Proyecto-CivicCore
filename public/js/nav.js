// Navegación: cambio de vista según permisos, menús por rol, títulos e indicadores activos.

import { ROLE_PERMISSIONS } from './config.js';
import { state, systemPrefs, saveSystemPrefsToStorage } from './state.js';
import { showToast } from './ui.js';

const dom = {
  views: document.querySelectorAll('.view-panel'),
  headerTitle: document.getElementById('header-view-title'),
  headerContextTag: document.getElementById('header-context-tag'),
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
  headerLogo: document.getElementById('header-logo'),
  headerHomeNav: document.getElementById('header-home-nav'),
  headerQuickNav: document.getElementById('header-quick-nav'),
  headerTitleBlock: document.getElementById('header-title-block')
};

// Cada vista registra aquí lo que hace al entrar (ver civiccore.js)
const onEnter = {};

const SIDEBAR_ITEM_ACTIVE = 'sidebar-nav-item active w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-xs transition-all text-primary bg-surface-container-high shadow-sm';
const SIDEBAR_ITEM = 'sidebar-nav-item w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all';

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

const VIEW_TITLES = {
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
  updateLayout();

  // Ocultar todas las vistas y mostrar la activa
  dom.views.forEach(v => v.classList.toggle('hidden', v.id !== targetViewId));

  updateActiveNavIndicators(targetViewId);
  updateHeaderTitles(targetViewId);

  if (onEnter[targetViewId]) onEnter[targetViewId]();

  if (!options.keepScroll) {
    const mainScroll = document.getElementById('main-scroll-container');
    if (mainScroll) mainScroll.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function updateHeaderTitles(viewId) {
  const info = VIEW_TITLES[viewId] || { title: 'CivicCore', context: 'Municipalidad' };
  if (dom.headerTitle) dom.headerTitle.textContent = info.title;
  if (dom.headerContextTag) dom.headerContextTag.textContent = info.context;
}

// Inicio es la portada: sin barra lateral y con la navegación en el header.
// En las demás vistas, en escritorio, la barra lateral salvo que el usuario la haya ocultado.
function updateLayout() {
  const isHome = state.currentView === 'view-inicio';
  const collapsed = !!systemPrefs.sidebarCollapsed;
  const sidebarShown = !isHome && !collapsed;

  if (dom.sidebarDesktop) dom.sidebarDesktop.classList.toggle('lg:flex', sidebarShown);
  if (dom.btnSidebarExpand) {
    dom.btnSidebarExpand.classList.toggle('lg:flex', !isHome && collapsed);
    dom.btnSidebarExpand.setAttribute('aria-expanded', String(sidebarShown));
  }
  if (dom.btnSidebarCollapse) dom.btnSidebarCollapse.setAttribute('aria-expanded', String(sidebarShown));
  // El logo del header sobra cuando la barra lateral (que ya lo muestra) está a la vista
  if (dom.headerLogo) dom.headerLogo.classList.toggle('lg:hidden', sidebarShown);
  if (dom.headerHomeNav) {
    dom.headerHomeNav.classList.toggle('hidden', !isHome);
    dom.headerHomeNav.classList.toggle('flex', isHome);
  }
  if (dom.headerTitleBlock) {
    // Portada: título desde xl, como antes; vistas internas: desde lg, con separador solo si hay logo a la izquierda
    dom.headerTitleBlock.classList.toggle('xl:block', isHome);
    dom.headerTitleBlock.classList.toggle('lg:block', !isHome);
    ['border-l', 'border-outline-variant/30', 'pl-3'].forEach(c => dom.headerTitleBlock.classList.toggle(c, !sidebarShown));
  }
}

function setSidebarCollapsed(collapsed) {
  systemPrefs.sidebarCollapsed = collapsed;
  saveSystemPrefsToStorage();
  updateLayout();
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

// Menú de la barra lateral (escritorio) según el rol
function sidebarMenuHtml(role) {
  if (role === 'vecino') {
    return `
      <div class="px-3 py-2 text-[10px] font-bold text-outline uppercase tracking-wider">Menú Vecinal</div>
      <button data-target="view-vecino" class="${SIDEBAR_ITEM}">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-[20px]">cottage</span>
          <span>Portal Vecinal</span>
        </div>
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      </button>
      <button data-target="view-nuevo" class="${SIDEBAR_ITEM}">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-[20px]">add_alert</span>
          <span>Reportar Incidencia</span>
        </div>
        <span class="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Alta Prioridad</span>
      </button>
    `;
  }
  if (role === 'trabajador') {
    return `
      <div class="px-3 py-2 text-[10px] font-bold text-outline uppercase tracking-wider">Operaciones Municipales</div>
      <button data-target="view-incidencias" class="${SIDEBAR_ITEM}">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-[20px]">assignment</span>
          <span>Bandeja de Reportes</span>
        </div>
        <span id="badge-total-incidencias" class="px-2 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-bold">${state.incidents.length}</span>
      </button>
      <button data-target="view-mapa" class="${SIDEBAR_ITEM}">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-[20px]">map</span>
          <span>Mapa Comunal</span>
        </div>
        <span class="w-2 h-2 rounded-full bg-tertiary-container animate-ping"></span>
      </button>
      <button data-target="view-panel" class="${SIDEBAR_ITEM}">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-[20px]">dashboard</span>
          <span>Panel de Gestión (KPIs)</span>
        </div>
      </button>
    `;
  }
  if (role === 'admin') {
    return `
      <div class="px-3 py-2 text-[10px] font-bold text-outline uppercase tracking-wider">Super Admin Hub</div>
      <button data-target="view-admin-hub" class="${SIDEBAR_ITEM}">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-[20px]">shield_person</span>
          <span>Consola Maestra</span>
        </div>
        <span class="px-1.5 py-0.5 rounded-full bg-error text-on-error text-[9px] font-bold">ROOT</span>
      </button>
      <button data-target="view-admin-users" class="${SIDEBAR_ITEM}">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-[20px]">vpn_key</span>
          <span>Padrón & Claves</span>
        </div>
      </button>
      <button data-target="view-admin-moderation" class="${SIDEBAR_ITEM}">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-[20px]">edit_note</span>
          <span>Edición Canónica</span>
        </div>
      </button>
      <button data-target="view-admin-audit" class="${SIDEBAR_ITEM}">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-[20px]">history_edu</span>
          <span>Auditoría Legal</span>
        </div>
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      </button>
      <div class="pt-3 border-t border-outline-variant/20">
        <div class="px-3 py-1 text-[10px] font-bold text-outline uppercase tracking-wider">Supervisión Comunal</div>
        <button data-target="view-incidencias" class="${SIDEBAR_ITEM}">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[20px]">assignment</span>
            <span>Bandeja General</span>
          </div>
        </button>
      </div>
    `;
  }
  // Invitado: incluye "Rastrear Folio", que antes estaba en los botones del header
  return `
    <div class="px-3 py-2 text-[10px] font-bold text-outline uppercase tracking-wider">Menú Ciudadano</div>
    <button data-target="view-inicio" class="${SIDEBAR_ITEM}">
      <div class="flex items-center gap-2.5">
        <span class="material-symbols-outlined text-[20px]">home</span>
        <span>Inicio Municipal</span>
      </div>
    </button>
    <button data-target="view-nuevo" class="${SIDEBAR_ITEM}">
      <div class="flex items-center gap-2.5">
        <span class="material-symbols-outlined text-[20px]">add_alert</span>
        <span>Generar Reporte</span>
      </div>
    </button>
    <button onclick="window.civicApp.scrollToHomeTracker()" class="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl font-medium text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all">
      <span class="material-symbols-outlined text-[20px]">search</span>
      <span>Rastrear Folio</span>
    </button>
    <button onclick="window.civicApp.openAuthModal()" class="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl font-medium text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all mt-2">
      <span class="material-symbols-outlined text-[20px]">vpn_key</span>
      <span>Acceder con Cuenta</span>
    </button>
  `;
}

// ==========================================
// Renderizado Dinámico de Menús según Rol
// ==========================================
function renderNavForRole(role) {
  const roleConfig = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.invitado;
  const isGuest = role === 'invitado';

  if (dom.mobileBottomNav) dom.mobileBottomNav.classList.remove('hidden');
  if (dom.currentUserBadge) {
    dom.currentUserBadge.classList.toggle('hidden', isGuest);
    dom.currentUserBadge.classList.toggle('flex', !isGuest);
  }
  if (dom.btnAuthText) dom.btnAuthText.textContent = isGuest ? 'Iniciar Sesión' : 'Cerrar Sesión';

  // Botones del header (visibles solo en la portada, ver updateLayout)
  if (dom.headerQuickNav) {
    dom.headerQuickNav.innerHTML = (HEADER_NAV[role] || HEADER_NAV.invitado).map(headerNavButton).join('');
  }

  // Barra lateral de escritorio
  if (dom.sidebarNavMenu) {
    dom.sidebarNavMenu.innerHTML = sidebarMenuHtml(role);
    dom.sidebarNavMenu.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.addEventListener('click', () => switchView(item.getAttribute('data-target')));
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
  if (dom.btnSidebarCollapse) dom.btnSidebarCollapse.addEventListener('click', () => setSidebarCollapsed(true));
  if (dom.btnSidebarExpand) dom.btnSidebarExpand.addEventListener('click', () => setSidebarCollapsed(false));
}

export { onEnter, switchView, renderNavForRole, updateLayout, init };
