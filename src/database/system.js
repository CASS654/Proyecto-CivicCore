// Auditoría general, parámetros del sitio, estadísticas y copias de seguridad.
const fs = require('fs');
const path = require('path');
const { db } = require('./connection');
const { dbPath } = require('../config');
const { CATEGORY_MAP } = require('../domain');

const BACKUPS_DIR = path.join(path.dirname(dbPath), 'backups');

function addSystemAuditLog(action, actorName, actorRole, targetInfo, ip = '127.0.0.1') {
  db.prepare(`
    INSERT INTO system_audit_logs (action, actor_name, actor_role, target_info, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(action, actorName, actorRole, targetInfo, ip, new Date().toISOString());
}

// shortcut: devuelve solo los 50 eventos más recientes (el contador "N logs" del panel tope en 50); paginar si se necesita el historial completo
function getSystemAuditLogs() {
  return db.prepare('SELECT * FROM system_audit_logs ORDER BY id DESC LIMIT 50').all();
}

function clearSystemAuditLogs() {
  db.prepare('DELETE FROM system_audit_logs').run();
  addSystemAuditLog('LIMPIEZA_LOGS', 'Control App', 'admin', 'Historial de auditoría vaciado por el operador', '127.0.0.1');
  return { success: true };
}

function getSystemSettings() {
  const rows = db.prepare('SELECT * FROM system_settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function updateSystemSetting(key, value, adminActor) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, now);

  addSystemAuditLog('CONFIGURACION_SITIO', adminActor.name, adminActor.role, `Parámetro modificado: ${key} = ${value}`, '127.0.0.1');
  return getSystemSettings();
}

function getDatabaseStats() {
  const total = db.prepare('SELECT COUNT(*) as total FROM incidents').get().total;

  const statusRows = db.prepare('SELECT status, COUNT(*) as count FROM incidents GROUP BY status').all();
  const counts = { new: 0, progress: 0, resolved: 0 };
  statusRows.forEach(r => { if (Object.hasOwn(counts, r.status)) counts[r.status] = r.count; });

  const categoryRows = db.prepare('SELECT category, COUNT(*) as count FROM incidents GROUP BY category').all();
  const byCategory = {};
  Object.keys(CATEGORY_MAP).forEach(k => { byCategory[k] = 0; });
  categoryRows.forEach(r => { byCategory[r.category] = r.count; });

  const usersCount = db.prepare('SELECT COUNT(*) as total FROM users').get().total;
  const vecinosCount = db.prepare("SELECT COUNT(*) as total FROM users WHERE role = 'vecino'").get().total;
  const funcionariosCount = db.prepare("SELECT COUNT(*) as total FROM users WHERE role = 'trabajador'").get().total;
  const criticalCount = db.prepare("SELECT COUNT(*) as total FROM incidents WHERE priority_level >= 3 AND status != 'resolved'").get().total;

  const sysSettings = getSystemSettings();

  return {
    total,
    counts,
    byCategory,
    usersCount,
    vecinosCount,
    funcionariosCount,
    criticalCount,
    resolutionRate: total > 0 ? Math.round((counts.resolved / total) * 100) : 0,
    databaseEngine: 'SQLite 3 (node:sqlite nativo)',
    databaseFile: 'src/data/civiccore.db',
    activeShift: 'Turno AM Activo (08:00 - 16:00)',
    activeCrews: 8,
    settings: {
      municipality_name: sysSettings.municipality_name || 'Municipalidad de Santiago Centro',
      emergency_phone: sysSettings.emergency_phone || '1414',
      sla_hours: sysSettings.sla_hours || '24',
      system_status: sysSettings.system_status || 'Operativo Normal'
    }
  };
}

function createDatabaseBackup() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const timestamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const backupFileName = `civiccore_backup_${timestamp}.db`;
  const backupPath = path.join(BACKUPS_DIR, backupFileName);
  fs.copyFileSync(dbPath, backupPath);
  const stat = fs.statSync(backupPath);
  addSystemAuditLog('BACKUP_DATABASE', 'Control App', 'admin', `Copia creada: ${backupFileName} (${(stat.size / 1024).toFixed(1)} KB)`, '127.0.0.1');
  return {
    fileName: backupFileName,
    path: backupPath,
    sizeKb: (stat.size / 1024).toFixed(1),
    createdAt: d.toISOString()
  };
}

function listDatabaseBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.db'));
  return files.map(file => {
    const fullPath = path.join(BACKUPS_DIR, file);
    const stat = fs.statSync(fullPath);
    return {
      fileName: file,
      sizeKb: (stat.size / 1024).toFixed(1),
      createdAt: stat.mtime.toISOString()
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// shortcut: copia el archivo encima de la base con la conexión abierta; en Windows puede fallar (EBUSY)
// o dejar datos inconsistentes. Mejorar cerrando y reabriendo la conexión, o con la API de backup de SQLite.
function restoreDatabaseBackup(fileName) {
  const safeName = path.basename(fileName);
  const backupPath = path.join(BACKUPS_DIR, safeName);
  if (!fs.existsSync(backupPath)) {
    throw new Error('Archivo de copia de seguridad no encontrado.');
  }
  createDatabaseBackup();
  fs.copyFileSync(backupPath, dbPath);
  addSystemAuditLog('RESTORE_DATABASE', 'Control App', 'admin', `Base restaurada desde: ${safeName}`, '127.0.0.1');
  return { success: true, restoredFrom: safeName };
}

module.exports = {
  addSystemAuditLog,
  getSystemAuditLogs,
  clearSystemAuditLogs,
  getSystemSettings,
  updateSystemSetting,
  getDatabaseStats,
  createDatabaseBackup,
  listDatabaseBackups,
  restoreDatabaseBackup
};
