// /api/auth/*: login, registro, Google, logout, perfil y cambio de contraseña
const express = require('express');
const usersDb = require('../database/users');
const systemDb = require('../database/system');
const { decodeGoogleJwt, nameFromEmail } = require('../domain');
const { getUserFromRequest, requireAdmin, getClientIp } = require('../middlewares/auth');

const router = express.Router();

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
  const clientIp = getClientIp(req);

  // Opción 1: Switch rápido interno (compatibilidad retroactiva)
  // shortcut: entrega una sesión de cualquier rol, admin incluido, sin contraseña; desactivar fuera de demos
  if (role && !password && !identifier) {
    const demoUsers = {
      invitado: { id: 0, name: 'Vecino Invitado', email: 'invitado@comuna.cl', role: 'invitado', rutDni: 'Sin DNI', department: 'Comunidad' },
      vecino: { id: 1, name: 'Carmen Soto', email: 'vecino@correo.cl', role: 'vecino', rutDni: '14.283.910-4', department: 'Junta de Vecinos' },
      trabajador: { id: 2, name: 'Lic. Elena Morales', email: 'funcionario@municipio.gov', role: 'trabajador', rutDni: '15.849.204-K', department: 'Central de Mando' },
      admin: { id: 3, name: 'Super Admin Root', email: 'admin@civiccore.gov', role: 'admin', rutDni: '10.555.333-1', department: 'Gobernanza TI' }
    };

    const selected = demoUsers[role] || demoUsers.invitado;
    systemDb.addSystemAuditLog('LOGIN_DEMO', selected.name, selected.role, `Cambio de contexto a ${selected.role}`, clientIp);

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

  const authenticated = usersDb.authenticateUser(identifier, password);
  if (!authenticated) {
    systemDb.addSystemAuditLog('LOGIN_FALLIDO', identifier, 'desconocido', 'Credenciales incorrectas', clientIp);
    return res.status(401).json({
      status: 'error',
      message: 'Credenciales inválidas o usuario inactivo.'
    });
  }

  systemDb.addSystemAuditLog('LOGIN_EXITOSO', authenticated.name, authenticated.role, 'Autenticación exitosa', clientIp);

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
    name = nameFromEmail(email.split('@')[0]);
  }

  try {
    const user = usersDb.registerVecino({ name, email, password, rutDni, department });
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

/**
 * GET /api/auth/google/config
 * Retorna el Client ID configurado para Google Identity Services
 */
router.get('/auth/google/config', (req, res) => {
  const settings = systemDb.getSystemSettings();
  const clientId = process.env.GOOGLE_CLIENT_ID || settings.google_client_id || '';
  res.json({
    status: 'success',
    clientId: (clientId || '').trim(),
    configured: Boolean(clientId && clientId.trim())
  });
});

/**
 * POST /api/auth/google/config
 * Permite configurar o actualizar el Client ID de Google OAuth en caliente (Solo Super Admin)
 */
router.post('/auth/google/config', requireAdmin('Acceso denegado: Se requiere rol de Super Administrador para configurar Google OAuth.'), (req, res) => {
  const actor = req.actor;
  const { clientId } = req.body;
  if (!clientId || !clientId.trim()) {
    return res.status(400).json({
      status: 'error',
      message: 'El Client ID de Google es obligatorio.'
    });
  }

  const cleanClientId = clientId.trim();
  systemDb.updateSystemSetting('google_client_id', cleanClientId, actor);

  res.json({
    status: 'success',
    message: 'Client ID de Google configurado correctamente.',
    clientId: cleanClientId
  });
});

/**
 * POST /api/auth/google
 * Acceso o registro instantáneo con Google (Rol vecino por defecto)
 * Exige credencial JWT válida de Google Identity Services
 */
router.post('/auth/google', (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({
      status: 'error',
      message: 'Se requiere una credencial firmada válida de Google Identity Services.'
    });
  }

  const decoded = decodeGoogleJwt(credential);
  if (!decoded || !decoded.email) {
    return res.status(401).json({
      status: 'error',
      message: 'Token de Google inválido, expirado o sin verificación de correo.'
    });
  }

  const email = decoded.email;
  const name = decoded.name || '';
  const avatar = decoded.picture || null;

  try {
    const user = usersDb.authenticateGoogleUser({ email, name, avatar });
    const clientIp = getClientIp(req);
    systemDb.addSystemAuditLog('LOGIN_GOOGLE', user.name, user.role, `Autenticación Google exitosa para ${email}`, clientIp);

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
  const clientIp = getClientIp(req);
  const userName = req.body?.user || 'Usuario';
  systemDb.addSystemAuditLog('LOGOUT', userName, 'invitado', 'Cierre de sesión', clientIp);
  res.json({
    status: 'success',
    message: 'Sesión finalizada correctamente'
  });
});

/**
 * GET /api/auth/users
 * Lista de usuarios disponibles (restringido a Super Administrador)
 */
router.get('/auth/users', requireAdmin(), (req, res) => {
  const users = usersDb.getAllUsers();
  res.json({
    status: 'success',
    data: users
  });
});

/**
 * PATCH /api/auth/profile
 * Actualizar perfil propio del usuario autenticado (sin cambio de rol)
 */
router.patch('/auth/profile', (req, res) => {
  const actor = getUserFromRequest(req);
  if (actor.role === 'invitado') {
    return res.status(403).json({
      status: 'error',
      message: 'Debes iniciar sesión para actualizar tu perfil.'
    });
  }

  const allUsers = usersDb.getAllUsers();
  const targetId = req.body.id || actor.id;
  let targetUser = targetId ? allUsers.find(u => String(u.id) === String(targetId)) : null;
  if (!targetUser && actor.email) {
    targetUser = allUsers.find(u => u.email.toLowerCase() === actor.email.toLowerCase());
  }

  if (!targetUser) {
    return res.status(404).json({
      status: 'error',
      message: 'Cuenta de usuario no encontrada.'
    });
  }

  try {
    const updated = usersDb.updateUserProfile(targetUser.id, {
      name: req.body.name,
      email: req.body.email,
      rutDni: req.body.rutDni,
      department: req.body.department,
      role: targetUser.role
    }, actor);

    res.json({
      status: 'success',
      message: 'Datos de perfil actualizados con éxito',
      data: updated
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message || 'Error al actualizar perfil'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Cambiar contraseña de la cuenta actualmente conectada (requiere contraseña actual)
 */
router.post('/auth/change-password', (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  const actor = getUserFromRequest(req);

  if (actor.role === 'invitado') {
    return res.status(403).json({
      status: 'error',
      message: 'Debes iniciar sesión para cambiar tu contraseña.'
    });
  }

  const targetEmail = email || actor.email || (actor.role === 'admin' ? 'admin@civiccore.gov' : '');

  if (!currentPassword || !currentPassword.toString().trim()) {
    return res.status(400).json({
      status: 'error',
      message: 'Debes ingresar tu contraseña actual para confirmar el cambio.'
    });
  }

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

  if (actor.role !== 'admin' && actor.email && actor.email.toLowerCase() !== targetEmail.toLowerCase()) {
    return res.status(403).json({
      status: 'error',
      message: 'Solo puedes modificar la contraseña de tu propia cuenta.'
    });
  }

  try {
    const updated = usersDb.updateUserPassword(targetEmail, newPassword, actor, currentPassword);
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

module.exports = router;
