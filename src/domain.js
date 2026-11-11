// Reglas de negocio puras: catálogos, prioridades, folios y etiquetas.
// Sin base de datos ni HTTP, para poder probarlas solas.

const CATEGORY_MAP = {
  vialidad: { label: 'Baches y Calzadas', icon: 'construction' },
  aseo: { label: 'Aseo Urbano', icon: 'delete_outline' },
  alumbrado: { label: 'Alumbrado Público', icon: 'lightbulb' },
  aguas: { label: 'Agua y Alcantarillado', icon: 'water_drop' },
  areas_verdes: { label: 'Parques y Jardines', icon: 'park' },
  seguridad: { label: 'Seguridad Ciudadana', icon: 'shield' }
};

const SECTOR_MAP = {
  centro: 'Centro Histórico',
  norte: 'Sector Norte',
  sur: 'Sector Sur',
  oriente: 'Sector Oriente',
  poniente: 'Sector Poniente'
};

const STATUS_MAP = {
  new: 'Nueva / Por Asignar',
  progress: 'En Proceso',
  resolved: 'Resuelta'
};

// Prioridad por rol del creador. Orden estricto: Admin (4) > Funcionario (3) > Vecino (2) > Invitado (1).
// La urgencia NO cambia el nivel, solo desempata dentro del mismo nivel.
const ROLE_PRIORITY = {
  admin:      { level: 4, label: 'Crítica (Super Admin)' },
  trabajador: { level: 3, label: 'Muy Alta (Funcionario Estado)' },
  vecino:     { level: 2, label: 'Alta (Vecino Verificado)' },
  invitado:   { level: 1, label: 'Normal (Invitado)' }
};

// Etiqueta por nivel, para cuando el Super Admin fija el nivel a mano al moderar: { 1: 'Normal (Invitado)', ... }
const PRIORITY_LABEL_BY_LEVEL = Object.fromEntries(Object.values(ROLE_PRIORITY).map(p => [p.level, p.label]));

const FOLIO_BASE = 8950;

function calculatePriority(role) {
  // Un reporte urgente de vecino nunca supera a uno de funcionario; la urgencia solo desempata al ordenar.
  return ROLE_PRIORITY[role] || ROLE_PRIORITY.invitado;
}

// Siguiente número de folio: el mayor CIV-#### existente + 1 (como mínimo FOLIO_BASE + 1)
function nextFolioNumber(ids) {
  let maxNum = FOLIO_BASE;
  ids.forEach(id => {
    const m = (id || '').match(/CIV-(\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });
  return maxNum + 1;
}

// Variantes con las que se busca un id o folio escrito por el usuario ('8942', '#civ-8942', 'CIV-8942')
function incidentIdVariants(id) {
  const clean = id.toString().replace('#', '').trim();
  const withPrefix = clean.toUpperCase().startsWith('CIV-') ? clean.toUpperCase() : `CIV-${clean}`;
  return { clean, withPrefix, folio: `#${withPrefix}` };
}

function urgencyLabel(urgency) {
  return urgency === 'high' ? 'Urgente' : (urgency === 'low' ? 'Baja' : 'Normal');
}

function channelLabel(channel) {
  return channel === 'phone' ? 'Llamada Telefónica 1414' : (channel === 'inspection' ? 'Inspección en Terreno' : 'Canal Vecinal App');
}

function isVerifiedRole(role) {
  return role === 'vecino' || role === 'trabajador' || role === 'admin';
}

function initialTeamForRole(role) {
  return role === 'trabajador' ? 'Cuadrilla Municipal (Despacho Preferente)' : 'Por asignar';
}

function teamForStatus(status, currentTeam) {
  if (status === 'resolved') return 'Completado por Cuadrilla Municipal';
  if (status === 'progress') return 'Cuadrilla Municipal #02 (En terreno)';
  return currentTeam;
}

function generateSectorCoordinates(sector) {
  const ranges = {
    norte:    { xMin: 20, xMax: 62, yMin: 12, yMax: 32 },
    centro:   { xMin: 38, xMax: 62, yMin: 38, yMax: 62 },
    sur:      { xMin: 25, xMax: 72, yMin: 68, yMax: 86 },
    oriente:  { xMin: 66, xMax: 88, yMin: 20, yMax: 75 },
    poniente: { xMin: 12, xMax: 34, yMin: 35, yMax: 75 }
  };
  const r = ranges[sector] || ranges.centro;
  return {
    x: Math.floor(Math.random() * (r.xMax - r.xMin + 1)) + r.xMin,
    y: Math.floor(Math.random() * (r.yMax - r.yMin + 1)) + r.yMin
  };
}

// 'juan.perez' -> 'Juan Perez'
function nameFromEmail(localPart) {
  return localPart.replace(/[._-]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function timeAgo(dateStr) {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Hace unos momentos';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays}d`;
  } catch {
    return 'Hoy';
  }
}

// shortcut: solo lee el payload y NO verifica la firma de Google; cualquiera puede fabricar un token.
// Mejorar verificando con las claves públicas de Google antes de exponer /api/auth/google.
function decodeGoogleJwt(jwt) {
  try {
    if (!jwt || typeof jwt !== 'string') return null;
    const parts = jwt.split('.');
    if (parts.length !== 3 || !parts[2]) return null;
    const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadStr);
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!payload || !validIssuers.includes(payload.iss)) return null;
    if (payload.exp && (payload.exp * 1000) < Date.now()) return null;
    if (payload.email_verified === false) return null;
    return payload;
  } catch (err) {
    console.error('Error al decodificar JWT de Google:', err);
    return null;
  }
}

module.exports = {
  CATEGORY_MAP,
  SECTOR_MAP,
  STATUS_MAP,
  ROLE_PRIORITY,
  PRIORITY_LABEL_BY_LEVEL,
  FOLIO_BASE,
  calculatePriority,
  nextFolioNumber,
  incidentIdVariants,
  urgencyLabel,
  channelLabel,
  isVerifiedRole,
  initialTeamForRole,
  teamForStatus,
  generateSectorCoordinates,
  nameFromEmail,
  timeAgo,
  decodeGoogleJwt
};
