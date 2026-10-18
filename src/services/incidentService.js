const db = require('../database/db');

/**
 * IncidentService con persistencia SQL en SQLite (node:sqlite)
 * Soporta los 4 niveles de acceso: Invitado, Vecino, Trabajador y Super Admin.
 */
class IncidentService {
  getAll(filters = {}) {
    return db.getAllIncidents(filters);
  }

  getById(id) {
    return db.getIncidentById(id);
  }

  create(data, user = { role: 'invitado', name: 'Vecino Anónimo' }) {
    return db.createIncident(data, user);
  }

  updateStatus(id, newStatus, user = { role: 'trabajador', name: 'Funcionario Municipal' }) {
    return db.updateIncidentStatus(id, newStatus, user);
  }

  moderate(id, moderationData, adminUser = { role: 'admin', name: 'Super Admin Root' }) {
    return db.moderateIncident(id, moderationData, adminUser);
  }

  getStats() {
    return db.getDatabaseStats();
  }

  // Usuarios y Autenticación
  authenticate(email, password) {
    return db.authenticateUser(email, password);
  }

  getAllUsers() {
    return db.getAllUsers();
  }

  createUser(userData, adminActor = { role: 'admin', name: 'Super Admin Root' }) {
    return db.createUser(userData, adminActor);
  }

  toggleUserStatus(id, status, adminActor = { role: 'admin', name: 'Super Admin Root' }) {
    return db.toggleUserStatus(id, status, adminActor);
  }

  updatePassword(idOrEmail, newPassword, actor = { role: 'admin', name: 'Super Admin Root' }) {
    return db.updateUserPassword(idOrEmail, newPassword, actor);
  }

  updateUserProfile(id, profileData, adminActor = { role: 'admin', name: 'Super Admin Root' }) {
    return db.updateUserProfile(id, profileData, adminActor);
  }

  registerVecino(userData) {
    return db.registerVecino(userData);
  }

  authenticateGoogle(googleData) {
    return db.authenticateGoogleUser(googleData);
  }

  // Auditoría del Sistema
  getAuditLogs() {
    return db.getSystemAuditLogs();
  }

  addAuditLog(action, actorName, actorRole, details, ip = '127.0.0.1') {
    return db.addSystemAuditLog(action, actorName, actorRole, details, ip);
  }

  // Configuración del Sistema
  getSettings() {
    return db.getSystemSettings();
  }

  updateSetting(key, value, adminActor = { role: 'admin', name: 'Super Admin Root' }) {
    return db.updateSystemSetting(key, value, adminActor);
  }
}

module.exports = new IncidentService();
