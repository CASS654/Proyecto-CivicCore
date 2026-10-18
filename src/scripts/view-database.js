const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'civiccore.db');
const db = new DatabaseSync(DB_PATH);

console.log('\n' + '='.repeat(70));
console.log(' 🗄️  EXPLORADOR DE BASE DE DATOS SQLITE (CivicCore)');
console.log('='.repeat(70));
console.log(` Archivo: ${DB_PATH}\n`);

// 1. Conteo de tablas
const tables = db.prepare(`
  SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
`).all();

console.log('📋 Tablas creadas:');
tables.forEach(t => {
  const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get();
  console.log(`   - ${t.name.padEnd(20)} [${count.c} registros]`);
});

// 2. Registros en tabla incidents
console.log('\n' + '-'.repeat(70));
console.log(' 📍 ÚLTIMAS INCIDENCIAS EN LA BASE DE DATOS:');
console.log('-'.repeat(70));

const rows = db.prepare(`
  SELECT folio, title, category_label, status_label, sector_label, reported_by, created_at
  FROM incidents
  ORDER BY created_at DESC
  LIMIT 10
`).all();

console.table(rows);

// 3. Historial de auditoría
console.log('\n' + '-'.repeat(70));
console.log(' 📝 HISTORIAL DE AUDITORÍA (incident_logs):');
console.log('-'.repeat(70));

const logs = db.prepare(`
  SELECT id, incident_id, action, new_status, created_at
  FROM incident_logs
  ORDER BY id DESC
  LIMIT 5
`).all();

if (logs.length > 0) {
  console.table(logs);
} else {
  console.log('   (Sin cambios de estado registrados aún)');
}

console.log('='.repeat(70) + '\n');
