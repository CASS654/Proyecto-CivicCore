// Conexión SQLite única del proceso: abre la base, aplica el esquema y las migraciones.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { dbPath } = require('../config');
const { ROLE_PRIORITY } = require('../domain');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Crear directorio data si no existe
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Inicializar conexión SQLite nativa de Node.js
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

// Ejecutar esquema
const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
db.exec(schemaSql);

// Función para migrar columnas si la tabla ya existía
function ensureColumns() {
  const tableInfo = db.prepare('PRAGMA table_info(incidents)').all();
  const colNames = tableInfo.map(c => c.name);

  if (!colNames.includes('priority_level')) {
    db.exec("ALTER TABLE incidents ADD COLUMN priority_level INTEGER NOT NULL DEFAULT 1;");
  }
  if (!colNames.includes('priority_label')) {
    db.exec("ALTER TABLE incidents ADD COLUMN priority_label TEXT NOT NULL DEFAULT 'Normal';");
  }
  if (!colNames.includes('reported_by_role')) {
    db.exec("ALTER TABLE incidents ADD COLUMN reported_by_role TEXT NOT NULL DEFAULT 'invitado';");
  }
  if (!colNames.includes('moderated_by')) {
    db.exec("ALTER TABLE incidents ADD COLUMN moderated_by TEXT;");
  }

  // Sanitización automática de textos para evitar caracteres corruptos
  try {
    db.exec(`
      UPDATE incidents SET reported_by = 'Vecino Anónimo' WHERE reported_by LIKE '%An%nimo%' OR reported_by LIKE '%Annimo%';
      UPDATE incidents SET category_label = 'Alumbrado Público' WHERE category = 'alumbrado';
      UPDATE incidents SET category_label = 'Baches y Calzadas' WHERE category = 'vialidad';
      UPDATE incidents SET sector_label = 'Centro Histórico' WHERE sector = 'centro';
    `);
  } catch (e) {}
}
ensureColumns();

// Recalcula la prioridad de reportes existentes que NO hayan sido moderados manualmente por el admin
function migrateRolePriorities() {
  try {
    // Corregir semillas antiguas que decían "Funcionario" pero tenían rol vecino
    db.exec(`
      UPDATE incidents SET reported_by_role = 'trabajador'
      WHERE reported_by_role = 'vecino' AND priority_label = 'Muy Alta (Funcionario)';
    `);

    const update = db.prepare(`
      UPDATE incidents SET priority_level = ?, priority_label = ?
      WHERE moderated_by IS NULL AND reported_by_role = ?
        AND (priority_level != ? OR priority_label != ?)
    `);
    Object.entries(ROLE_PRIORITY).forEach(([role, p]) => {
      update.run(p.level, p.label, role, p.level, p.label);
    });
  } catch (e) {
    console.error('[Base de Datos] Error al recalcular prioridades por rol:', e.message);
  }
}
migrateRolePriorities();

module.exports = { db };
