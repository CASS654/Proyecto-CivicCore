// /api/admin/*: usuarios, moderación, auditoría, copias de seguridad y parámetros (Super Admin)
const express = require('express');
const usersDb = require('../database/users');
const incidentsDb = require('../database/incidents');
const systemDb = require('../database/system');
const { signSessionToken, getUserFromRequest, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// ==========================================
// Endpoints Exclusivos para Super Administrador (Nivel 4)
// ==========================================

/**
 * GET /api/admin/users
 * Lista completa de usuarios y credenciales (restringido a Super Administrador)
 */
router.get('/admin/users', requireAdmin(), (req, res) => {
  const users = usersDb.getAllUsers();
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
router.post('/admin/users', requireAdmin('Acceso denegado: Se requiere rol de Super Administrador para emitir credenciales.'), (req, res) => {
  const { name, email, password, role, rutDni, department } = req.body;
  const adminActor = req.actor;

  if (!name || !email) {
    return res.status(400).json({
      status: 'error',
      message: 'El nombre y correo electrónico son obligatorios.'
    });
  }

  try {
    const created = usersDb.createUser({
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
router.patch('/admin/users/:id/status', requireAdmin(), (req, res) => {
  const { status } = req.body;
  const adminActor = req.actor;

  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({
      status: 'error',
      message: 'El estado debe ser active o suspended.'
    });
  }

  try {
    const updated = usersDb.toggleUserStatus(req.params.id, status, adminActor);
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
router.patch('/admin/users/:id/password', requireAdmin('Acceso denegado: Se requiere rol de Super Administrador para restablecer contraseñas.'), (req, res) => {
  const { password } = req.body;
  const actor = req.actor;
  const targetId = req.params.id;

  if (!password || password.trim().length < 4) {
    return res.status(400).json({
      status: 'error',
      message: 'La contraseña debe tener al menos 4 caracteres.'
    });
  }

  try {
    const updated = usersDb.updateUserPassword(targetId, password, actor);
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
 * Soporta auto-edición segura de perfil sin escalación de privilegios
 */
router.patch('/admin/users/:id', (req, res) => {
  const actor = getUserFromRequest(req);
  const targetId = req.params.id;

  if (actor.role === 'invitado') {
    return res.status(403).json({
      status: 'error',
      message: 'Acceso denegado: Debes iniciar sesión para editar un perfil.'
    });
  }

  let profilePayload = { ...req.body };

  if (actor.role !== 'admin') {
    const allUsers = usersDb.getAllUsers();
    const targetUser = allUsers.find(u => String(u.id) === String(targetId));
    if (!targetUser) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado.'
      });
    }
    const isSelfById = actor.id && String(actor.id) === String(targetUser.id);
    const isSelfByEmail = actor.email && actor.email.toLowerCase() === targetUser.email.toLowerCase();
    const isSelfByRoleDemo = !actor.email && actor.role === targetUser.role;
    if (!isSelfById && !isSelfByEmail && !isSelfByRoleDemo) {
      return res.status(403).json({
        status: 'error',
        message: 'Acceso denegado: Solo puedes editar tus propios datos personales.'
      });
    }
    // Bloquear cambio de rol en auto-edición
    profilePayload.role = targetUser.role;
  }

  try {
    const updated = usersDb.updateUserProfile(targetId, profilePayload, actor);
    res.json({
      status: 'success',
      message: `Datos de ${updated.name} actualizados con éxito`,
      data: { ...updated, sessionToken: signSessionToken(updated) }
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message || 'Error al actualizar datos del usuario'
    });
  }
});

/**
 * PATCH /api/admin/incidents/:id/moderate
 * Moderación canónica de incidente: alterar prioridad, título, cuadrilla o descripción
 */
router.patch('/admin/incidents/:id/moderate', requireAdmin('Acceso denegado: Se requiere rol de Super Administrador para moderar incidencias.'), (req, res) => {
  const { priorityLevel, title, description, assignedTeam, category } = req.body;
  const adminActor = req.actor;

  const updated = incidentsDb.moderateIncident(req.params.id, {
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
router.get('/admin/audit-logs', requireAdmin(), (req, res) => {
  const logs = systemDb.getSystemAuditLogs();
  res.json({
    status: 'success',
    total: logs.length,
    data: logs
  });
});

/**
 * DELETE /api/admin/audit-logs
 * Vaciar el historial de auditoría del sistema (Solo Super Admin)
 */
router.delete('/admin/audit-logs', requireAdmin(), (req, res) => {
  const result = systemDb.clearSystemAuditLogs();
  res.json({
    status: 'success',
    message: 'Bitácora de auditoría vaciada correctamente',
    data: result
  });
});

/**
 * DELETE /api/admin/incidents/:id
 * Eliminar una incidencia (Solo Super Admin)
 */
router.delete('/admin/incidents/:id', requireAdmin(), (req, res) => {
  const actor = req.actor;
  const deleted = incidentsDb.deleteIncident(req.params.id, actor);
  if (!deleted) {
    return res.status(404).json({
      status: 'error',
      message: 'Incidencia no encontrada.'
    });
  }
  res.json({
    status: 'success',
    message: 'Incidencia eliminada correctamente'
  });
});

/**
 * DELETE /api/admin/users/:id
 * Eliminar una cuenta de usuario (Solo Super Admin)
 */
router.delete('/admin/users/:id', requireAdmin(), (req, res) => {
  const actor = req.actor;
  try {
    usersDb.deleteUser(req.params.id, actor);
    res.json({
      status: 'success',
      message: 'Usuario eliminado correctamente'
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message || 'Error al eliminar usuario'
    });
  }
});

/**
 * PATCH /api/admin/users/:id/role
 * Cambiar rol de usuario (Solo Super Admin)
 */
router.patch('/admin/users/:id/role', requireAdmin(), (req, res) => {
  const actor = req.actor;
  try {
    const updated = usersDb.updateUserRole(req.params.id, req.body.role, actor);
    res.json({
      status: 'success',
      message: 'Rol de usuario actualizado correctamente',
      data: updated
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message || 'Error al cambiar rol'
    });
  }
});

/**
 * GET /api/admin/backups
 * Listar copias de seguridad de la base de datos SQLite
 */
router.get('/admin/backups', requireAdmin(), (req, res) => {
  const backups = systemDb.listDatabaseBackups();
  res.json({
    status: 'success',
    total: backups.length,
    data: backups
  });
});

/**
 * POST /api/admin/backups
 * Crear copia de seguridad de la base de datos SQLite
 */
router.post('/admin/backups', requireAdmin(), (req, res) => {
  try {
    const backup = systemDb.createDatabaseBackup();
    res.status(201).json({
      status: 'success',
      message: `Copia de seguridad creada: ${backup.fileName}`,
      data: backup
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Error al crear copia de seguridad'
    });
  }
});

/**
 * POST /api/admin/backups/restore
 * Restaurar copia de seguridad de la base de datos SQLite
 */
router.post('/admin/backups/restore', requireAdmin(), (req, res) => {
  try {
    const result = systemDb.restoreDatabaseBackup(req.body.fileName);
    res.json({
      status: 'success',
      message: `Base de datos restaurada desde ${result.restoredFrom}`,
      data: result
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message || 'Error al restaurar copia de seguridad'
    });
  }
});

/**
 * GET /api/admin/settings
 * Parámetros de gobernanza municipal (restringido a Super Administrador)
 */
router.get('/admin/settings', requireAdmin(), (req, res) => {
  const settings = systemDb.getSystemSettings();
  res.json({
    status: 'success',
    data: settings
  });
});

/**
 * POST /api/admin/settings
 * Actualizar parámetro de la plataforma
 */
router.post('/admin/settings', requireAdmin('Acceso denegado: Se requiere rol de Super Administrador para modificar parámetros.'), (req, res) => {
  const { key, value } = req.body;
  const adminActor = req.actor;

  if (!key || value === undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'Debe especificar key y value.'
    });
  }

  const updated = systemDb.updateSystemSetting(key, value, adminActor);
  res.json({
    status: 'success',
    message: `Parámetro ${key} actualizado`,
    data: updated
  });
});

module.exports = router;
