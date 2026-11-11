// Constantes de la app: usuario invitado, permisos por rol y preferencias por defecto.

const GUEST_USER = {
  id: 0,
  name: 'Vecino Invitado',
  email: 'invitado@comuna.cl',
  role: 'invitado',
  rutDni: 'Sin DNI',
  department: 'Comunidad'
};

// Configuración de Vistas Permitidas por Rol
const ROLE_PERMISSIONS = {
  invitado: {
    defaultView: 'view-inicio',
    allowedViews: ['view-inicio', 'view-nuevo'],
    label: 'Invitado',
    icon: 'person',
    badgeClass: 'bg-slate-200 text-slate-800',
    description: 'Acceso público para navegación general y generación de reportes urbanos.'
  },
  vecino: {
    defaultView: 'view-vecino',
    allowedViews: ['view-inicio', 'view-vecino', 'view-nuevo'],
    label: 'Vecino Verificado',
    icon: 'cottage',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    description: 'Portal vecinal acreditado. Seguimiento de folios y prioridad comunal.'
  },
  trabajador: {
    defaultView: 'view-incidencias',
    allowedViews: ['view-inicio', 'view-incidencias', 'view-mapa', 'view-panel', 'view-nuevo'],
    label: 'Funcionario Municipal',
    icon: 'engineering',
    badgeClass: 'bg-blue-100 text-blue-800',
    description: 'Mando operativo municipal: bandeja de triaje, mapa georreferenciado y KPIs.'
  },
  admin: {
    defaultView: 'view-admin-hub',
    allowedViews: ['view-inicio', 'view-admin-hub', 'view-admin-users', 'view-admin-moderation', 'view-admin-audit', 'view-incidencias', 'view-mapa', 'view-panel', 'view-nuevo'],
    label: 'Super Administrador',
    icon: 'shield_person',
    badgeClass: 'bg-red-100 text-red-800',
    description: 'Control del sistema: gobernanza de claves, moderación y trazabilidad CGR.'
  }
};

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
  autoSyncSec: 0,          // 0 | 30 | 60 | 300
  sidebarCollapsed: false  // barra lateral oculta por el usuario (vistas internas en escritorio)
};

export { GUEST_USER, ROLE_PERMISSIONS, DEFAULT_SYSTEM_PREFS };
