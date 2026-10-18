const express = require('express');
const os = require('os');
const config = require('../config');
const incidentService = require('../services/incidentService');

const router = express.Router();

// Helper para extraer usuario de la sesión simulada / headers
function getUserFromRequest(req) {
  const role = req.headers['x-user-role'] || req.body.userRole || 'invitado';
  const email = req.headers['x-user-email'] || req.body.userEmail || '';
  const name = req.headers['x-user-name'] || req.body.userName || (
    role === 'admin' ? 'Super Admin Root' :
    role === 'trabajador' ? 'Lic. Elena Morales' :
    role === 'vecino' ? 'Carmen Soto' : 'Vecino Anónimo'
  );
  return { role, name, email };
}

// ==========================================
// Autenticación y Control de Acceso (RBAC)
// ==========================================

/**
 * POST /api/auth/login
 * Soporta login con credenciales reales o selector rápido por rol para demo
 */
router.post('/auth/login', (req, res) => {
  const { email, password, role } = req.body;
  const identifier = email || req.body.username || req.body.rut;
  const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

  // Opción 1: Switch rápido interno (compatibilidad retroactiva)
  if (role && !password && !identifier) {
    const demoUsers = {
      invitado: { id: 0, name: 'Vecino Invitado', email: 'invitado@comuna.cl', role: 'invitado', rutDni: 'Sin DNI', department: 'Comunidad' },
      vecino: { id: 1, name: 'Carmen Soto', email: 'vecino@correo.cl', role: 'vecino', rutDni: '14.283.910-4', department: 'Junta de Vecinos' },
      trabajador: { id: 2, name: 'Lic. Elena Morales', email: 'funcionario@municipio.gov', role: 'trabajador', rutDni: '15.849.204-K', department: 'Central de Mando' },
      admin: { id: 3, name: 'Super Admin Root', email: 'admin@civiccore.gov', role: 'admin', rutDni: '10.555.333-1', department: 'Gobernanza TI' }
    };

    const selected = demoUsers[role] || demoUsers.invitado;
    incidentService.addAuditLog('LOGIN_DEMO', selected.name, selected.role, `Cambio de contexto a ${selected.role}`, clientIp);

    return res.json({
      status: 'success',
      message: `Sesión iniciada como ${selected.name} (${selected.role})`,
      user: selected
    });
  }

  // Opción 2: Inicio de sesión normal con correo/RUT y contraseña (determinación interna de rol)
  if (!identifier || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Debe ingresar correo o RUT y contraseña.'
    });
  }

  const authenticated = incidentService.authenticate(identifier, password);
  if (!authenticated) {
    incidentService.addAuditLog('LOGIN_FALLIDO', identifier, 'desconocido', 'Credenciales incorrectas', clientIp);
    return res.status(401).json({
      status: 'error',
      message: 'Credenciales inválidas o usuario inactivo.'
    });
  }

  incidentService.addAuditLog('LOGIN_EXITOSO', authenticated.name, authenticated.role, 'Autenticación exitosa', clientIp);

  res.json({
    status: 'success',
    message: `Bienvenido(a), ${authenticated.name}`,
    user: authenticated
  });
});

/**
 * POST /api/auth/register
 * Registro público para ciudadanos (Siempre asigna rol 'vecino')
 */
router.post('/auth/register', (req, res) => {
  let { name, email, password, rutDni, department } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Correo electrónico y contraseña son obligatorios.'
    });
  }

  if (password.length < 4) {
    return res.status(400).json({
      status: 'error',
      message: 'La contraseña debe tener al menos 4 caracteres.'
    });
  }

  if (!name || !name.trim()) {
    const raw = email.split('@')[0].replace(/[._-]/g, ' ');
    name = raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  try {
    const user = incidentService.registerVecino({ name, email, password, rutDni, department });
    res.status(201).json({
      status: 'success',
      message: `¡Registro exitoso! Bienvenido(a) al Portal Vecinal, ${user.name}`,
      user: user
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message || 'Error al registrar vecino.'
    });
  }
});

function decodeGoogleJwt(jwt) {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payloadStr);
  } catch (err) {
    console.error('Error al decodificar JWT de Google:', err);
    return null;
  }
}

/**
 * GET /api/auth/google/config
 * Retorna el Client ID configurado para Google Identity Services
 */
router.get('/auth/google/config', (req, res) => {
  const settings = incidentService.getSettings();
  const clientId = process.env.GOOGLE_CLIENT_ID || settings.google_client_id || '';
  res.json({
    status: 'success',
    clientId: (clientId || '').trim(),
    configured: Boolean(clientId && clientId.trim())
  });
});

/**
 * POST /api/auth/google/config
 * Permite configurar o actualizar el Client ID de Google OAuth en caliente
 */
router.post('/auth/google/config', (req, res) => {
  const { clientId } = req.body;
  if (!clientId || !clientId.trim()) {
    return res.status(400).json({
      status: 'error',
      message: 'El Client ID de Google es obligatorio.'
    });
  }

  const cleanClientId = clientId.trim();
  incidentService.updateSetting('google_client_id', cleanClientId, { role: 'admin', name: 'Administrador' });

  res.json({
    status: 'success',
    message: 'Client ID de Google configurado correctamente.',
    clientId: cleanClientId
  });
});

/**
 * POST /api/auth/google
 * Acceso o registro instantáneo con Google (Rol vecino por defecto)
 * Soporta credencial oficial JWT de Google Identity Services
 */
router.post('/auth/google', (req, res) => {
  let { credential, email, name, avatar } = req.body;

  if (credential) {
    const decoded = decodeGoogleJwt(credential);
    if (decoded) {
      email = decoded.email || email;
      name = decoded.name || name;
      avatar = decoded.picture || avatar;
    }
  }

  if (!email) {
    return res.status(400).json({
      status: 'error',
      message: 'No se pudo obtener el correo de la cuenta de Google.'
    });
  }

  try {
    const user = incidentService.authenticateGoogle({ email, name, avatar });
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    incidentService.addAuditLog('LOGIN_GOOGLE', user.name, user.role, `Autenticación Google exitosa para ${email}`, clientIp);

    res.json({
      status: 'success',
      message: `Sesión iniciada con Google como ${user.name}`,
      user: user
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message || 'Error al autenticar con Google.'
    });
  }
});

/**
 * POST /api/auth/logout
 * Registra cierre de sesión de forma segura
 */
router.post('/auth/logout', (req, res) => {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  const userName = req.body?.user || 'Usuario';
  incidentService.addAuditLog('LOGOUT', userName, 'invitado', 'Cierre de sesión', clientIp);
  res.json({
    status: 'success',
    message: 'Sesión finalizada correctamente'
  });
});

/**
 * GET /api/auth/users
 * Lista de usuarios disponibles para testing/demostración
 */
router.get('/auth/users', (req, res) => {
  const users = incidentService.getAllUsers();
  res.json({
    status: 'success',
    data: users
  });
});

// ==========================================
// Endpoints de Incidencias Ciudadanas
// ==========================================

/**
 * GET /api/incidents
 * Listado de incidencias con filtros opcionales (?status=&sector=&category=&search=)
 */
router.get('/incidents', (req, res) => {
  const { status, sector, category, search } = req.query;
  const incidents = incidentService.getAll({ status, sector, category, search });
  res.json({
    status: 'success',
    total: incidents.length,
    data: incidents
  });
});

/**
 * GET /api/incidents/:id
 * Detalle de una incidencia por ID o Folio
 */
router.get('/incidents/:id', (req, res) => {
  const incident = incidentService.getById(req.params.id);
  if (!incident) {
    return res.status(404).json({
      status: 'error',
      message: `No se encontró la incidencia con ID o Folio: ${req.params.id}`
    });
  }
  res.json({
    status: 'success',
    data: incident
  });
});

/**
 * POST /api/incidents
 * Registro de nueva incidencia ciudadana (aplica prioridad según rol)
 */
router.post('/incidents', (req, res) => {
  const { title, description, category, urgency, channel, address, sector, reportedBy, image } = req.body;
  const user = getUserFromRequest(req);

  if (!title || !category || !address) {
    return res.status(400).json({
      status: 'error',
      message: 'Los campos title, category y address son obligatorios.'
    });
  }

  const newIncident = incidentService.create({
    title,
    description,
    category,
    urgency,
    channel,
    address,
    sector,
    reportedBy: reportedBy || user.name,
    image
  }, user);

  res.status(201).json({
    status: 'success',
    message: `Incidencia registrada con prioridad ${newIncident.priorityLabel}`,
    data: newIncident
  });
});

/**
 * PATCH /api/incidents/:id/status
 * Actualización de estado de una incidencia (new, progress, resolved)
 */
router.patch('/incidents/:id/status', (req, res) => {
  const { status } = req.body;
  const user = getUserFromRequest(req);

  // Control de Acceso: Solo personal municipal o super admin pueden cambiar estado
  if (user.role !== 'trabajador' && user.role !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Acceso restringido: Solo funcionarios municipales o administradores pueden alterar el estado operativo.'
    });
  }

  if (!['new', 'progress', 'resolved'].includes(status)) {
    return res.status(400).json({
      status: 'error',
      message: 'Estado inválido. Debe ser: new, progress, o resolved.'
    });
  }

  const updated = incidentService.updateStatus(req.params.id, status, user);
  if (!updated) {
    return res.status(404).json({
      status: 'error',
      message: 'Incidencia no encontrada para actualizar.'
    });
  }

  res.json({
    status: 'success',
    message: `Estado actualizado a ${status}`,
    data: updated
  });
});

/**
 * GET /api/stats
 * Estadísticas y KPIs del panel de gestión municipal
 */
router.get('/stats', (req, res) => {
  const stats = incidentService.getStats();
  res.json({
    status: 'success',
    data: stats
  });
});

// ==========================================
// Endpoints Exclusivos para Super Administrador (Nivel 4)
// ==========================================

/**
 * GET /api/admin/users
 * Lista completa de usuarios y credenciales
 */
router.get('/admin/users', (req, res) => {
  const users = incidentService.getAllUsers();
  res.json({
    status: 'success',
    total: users.length,
    data: users
  });
});

/**
 * POST /api/admin/users
 * Crear o emitir credencial para funcionario o vecino
 */
router.post('/admin/users', (req, res) => {
  const { name, email, password, role, rutDni, department } = req.body;
  const adminActor = getUserFromRequest(req);

  if (adminActor.role !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Acceso denegado: Se requiere rol de Super Administrador para emitir credenciales.'
    });
  }

  if (!name || !email) {
    return res.status(400).json({
      status: 'error',
      message: 'El nombre y correo electrónico son obligatorios.'
    });
  }

  try {
    const created = incidentService.createUser({
      name,
      email,
      password: password || 'civic123',
      role: role || 'trabajador',
      rutDni: rutDni || '',
      department: department || 'Municipalidad'
    }, adminActor);

    res.status(201).json({
      status: 'success',
      message: 'Usuario y credencial emitidos con éxito',
      data: created
    });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({
        status: 'error',
        message: 'El correo electrónico ya se encuentra registrado en el sistema.'
      });
    }
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Error al crear usuario'
    });
  }
});

/**
 * PATCH /api/admin/users/:id/status
 * Activar o suspender cuenta de usuario
 */
router.patch('/admin/users/:id/status', (req, res) => {
  const { status } = req.body;
  const adminActor = getUserFromRequest(req);

  if (adminActor.role !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Acceso denegado: Se requiere rol de Super Administrador.'
    });
  }

  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({
      status: 'error',
      message: 'El estado debe ser active o suspended.'
    });
  }

  try {
    const updated = incidentService.toggleUserStatus(req.params.id, status, adminActor);
    if (!updated) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado.'
      });
    }

    res.json({
      status: 'success',
      message: `Estado de usuario actualizado a ${status}`,
      data: updated
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message || 'Error al actualizar estado del usuario.'
    });
  }
});

/**
 * PATCH /api/admin/users/:id/password
 * Modificar la contraseña de un usuario en el padrón
 */
router.patch('/admin/users/:id/password', (req, res) => {
  const { password } = req.body;
  const actor = getUserFromRequest(req);
  const targetId = req.params.id;

  if (actor.role !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Acceso denegado: Se requiere rol de Super Administrador para restablecer contraseñas.'
    });
  }

  if (!password || password.trim().length < 4) {
    return res.status(400).json({
      status: 'error',
      message: 'La contraseña debe tener al menos 4 caracteres.'
    });
  }

  try {
    const updated = incidentService.updatePassword(targetId, password, actor);
    res.json({
      status: 'success',
      message: `Contraseña de ${updated.name} actualizada con éxito`,
      data: updated
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message || 'Error al cambiar contraseña'
    });
  }
});

/**
 * PATCH /api/admin/users/:id
 * Modificar información general del usuario (correo, nombre, rol, departamento, rut)
 */
router.patch('/admin/users/:id', (req, res) => {
  const actor = getUserFromRequest(req);
  const targetId = req.params.id;

  if (actor.role !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Acceso denegado: Se requiere rol de Super Administrador para editar usuarios.'
    });
  }

  try {
    const updated = incidentService.updateUserProfile(targetId, req.body, actor);
    res.json({
      status: 'success',
      message: `Datos de ${updated.name} actualizados con éxito`,
      data: updated
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message || 'Error al actualizar datos del usuario'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Cambiar contraseña de la cuenta actualmente conectada
 */
router.post('/auth/change-password', (req, res) => {
  const { email, newPassword } = req.body;
  const actor = getUserFromRequest(req);
  const targetEmail = email || actor.email || (actor.role === 'admin' ? 'admin@civiccore.gov' : '');

  if (!newPassword || newPassword.trim().length < 4) {
    return res.status(400).json({
      status: 'error',
      message: 'La nueva contraseña debe tener al menos 4 caracteres.'
    });
  }

  if (!targetEmail) {
    return res.status(400).json({
      status: 'error',
      message: 'Se requiere el correo del usuario a actualizar.'
    });
  }

  try {
    const updated = incidentService.updatePassword(targetEmail, newPassword, actor);
    res.json({
      status: 'success',
      message: 'Contraseña actualizada con éxito',
      data: updated
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message || 'Error al actualizar la contraseña'
    });
  }
});

/**
 * PATCH /api/admin/incidents/:id/moderate
 * Moderación canónica de incidente: alterar prioridad, título, cuadrilla o descripción
 */
router.patch('/admin/incidents/:id/moderate', (req, res) => {
  const { priorityLevel, title, description, assignedTeam, category } = req.body;
  const adminActor = getUserFromRequest(req);

  if (adminActor.role !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Acceso denegado: Se requiere rol de Super Administrador para moderar incidencias.'
    });
  }

  const updated = incidentService.moderate(req.params.id, {
    priorityLevel,
    title,
    description,
    assignedTeam,
    category
  }, adminActor);

  if (!updated) {
    return res.status(404).json({
      status: 'error',
      message: 'Incidencia no encontrada para moderar.'
    });
  }

  res.json({
    status: 'success',
    message: 'Incidencia moderada exitosamente por Super Administrador',
    data: updated
  });
});

/**
 * GET /api/admin/audit-logs
 * Obtener los registros de auditoría y trazabilidad del sistema (Ley 19.628 / RFC 3161)
 */
router.get('/admin/audit-logs', (req, res) => {
  const logs = incidentService.getAuditLogs();
  res.json({
    status: 'success',
    total: logs.length,
    data: logs
  });
});

/**
 * GET /api/admin/settings
 * Parámetros de gobernanza municipal
 */
router.get('/admin/settings', (req, res) => {
  const settings = incidentService.getSettings();
  res.json({
    status: 'success',
    data: settings
  });
});

/**
 * POST /api/admin/settings
 * Actualizar parámetro de la plataforma
 */
router.post('/admin/settings', (req, res) => {
  const { key, value } = req.body;
  const adminActor = getUserFromRequest(req);

  if (adminActor.role !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Acceso denegado: Se requiere rol de Super Administrador para modificar parámetros.'
    });
  }

  if (!key || value === undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'Debe especificar key y value.'
    });
  }

  const updated = incidentService.updateSetting(key, value, adminActor);
  res.json({
    status: 'success',
    message: `Parámetro ${key} actualizado`,
    data: updated
  });
});

// ==========================================
// Endpoints de Diagnóstico y Servidor
// ==========================================

/**
 * GET /api/status
 * Estado de salud y métricas del servidor
 */
router.get('/status', (req, res) => {
  const uptimeSeconds = process.uptime();
  const memory = process.memoryUsage();

  res.json({
    status: 'online',
    appName: config.appName,
    environment: config.env,
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(uptimeSeconds),
      formatted: formatUptime(uptimeSeconds)
    },
    system: {
      nodeVersion: process.version,
      platform: os.platform(),
      hostname: os.hostname(),
      memoryUsedMB: Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100
    },
    client: {
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    }
  });
});

/**
 * GET /api/info
 */
router.get('/info', (req, res) => {
  res.json({
    project: 'CivicCore - Gestión de Incidencias Ciudadanas',
    description: 'Plataforma municipal ciudadana con 4 niveles de acceso (Invitado, Vecino, Trabajador, Super Admin) y ordenamiento por prioridades.',
    port: config.port,
    roles: [
      { id: 'invitado', name: 'Invitado', description: 'Reportes anónimos (prioridad normal), sin acceso a bandejas' },
      { id: 'vecino', name: 'Vecino Ciudadano', description: 'Portal vecinal, seguimiento de folios, prioridad alta para reportes verificados' },
      { id: 'trabajador', name: 'Trabajador del Estado', description: 'Bandeja comunal, mapa interactivo, panel de KPIs, triaje de estados' },
      { id: 'admin', name: 'Super Administrador', description: 'Consola maestra, emisión de claves, moderación directa, auditoría legal' }
    ],
    tunnelTypes: {
      custom: `https://${process.env.LOCALTUNNEL_SUBDOMAIN || 'tarea-santamaria'}.loca.lt`,
      cloudflare: 'https://*.trycloudflare.com'
    }
  });
});

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

module.exports = router;
