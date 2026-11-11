// Datos iniciales: solo se insertan si la tabla correspondiente está vacía.
const fs = require('fs');
const path = require('path');
const { db } = require('./connection');
const { INSERT_INCIDENT_SQL } = require('./incidents');
const { ROLE_PRIORITY } = require('../domain');

const SEED_JSON = path.join(__dirname, '..', 'data', 'incidents.json');

// Sembrar Usuarios de Demostración
function seedUsers() {
  const count = db.prepare('SELECT COUNT(*) as total FROM users').get();
  if (count.total === 0) {
    console.log('[Base de Datos] Insertando usuarios iniciales para los 4 niveles de acceso...');
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password, role, rut_dni, department, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
    `);

    const now = new Date().toISOString();
    // 1. Nivel Vecino
    insertUser.run('Carmen Soto', 'vecino@correo.cl', 'vecino123', 'vecino', '14.283.910-4', 'Junta de Vecinos Barrio Norte', now);
    // 2. Nivel Trabajador del Estado
    insertUser.run('Lic. Elena Morales', 'funcionario@municipio.gov', 'trabajador123', 'trabajador', '15.849.204-K', 'Central de Mando y Despacho', now);
    // 3. Nivel Super Administrador
    insertUser.run('Super Admin Root', 'admin@civiccore.gov', 'admin123', 'admin', '10.555.333-1', 'Gobernanza y TI Municipal', now);

    console.log('[Base de Datos] ✓ 3 usuarios creados: vecino@correo.cl, funcionario@municipio.gov, admin@civiccore.gov');
  }
}

// Sembrar Configuración Global
function seedSettings() {
  const count = db.prepare('SELECT COUNT(*) as total FROM system_settings').get();
  if (count.total === 0) {
    const insertSetting = db.prepare(`
      INSERT INTO system_settings (key, value, description, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    insertSetting.run('municipality_name', 'Municipalidad de Santiago Centro', 'Nombre oficial de la comuna', now);
    insertSetting.run('emergency_phone', '1414', 'Central de emergencias y llamadas vecinales', now);
    insertSetting.run('sla_hours', '24', 'Tiempo máximo comprometido de respuesta', now);
    insertSetting.run('system_status', 'Operativo Normal', 'Estado de la red comunal', now);
  }
}

// Sembrar Incidencias si está vacío
function seedIncidents() {
  const count = db.prepare('SELECT COUNT(*) as total FROM incidents').get();
  if (count.total === 0 && fs.existsSync(SEED_JSON)) {
    try {
      const raw = fs.readFileSync(SEED_JSON, 'utf-8').replace(/^﻿/, '');
      const items = JSON.parse(raw);
      const insertStmt = db.prepare(INSERT_INCIDENT_SQL);

      items.forEach((item, index) => {
        const priorityLevel = index % 3 === 0 ? 3 : (index % 2 === 0 ? 2 : 1);
        const seedRole = priorityLevel === 3 ? 'trabajador' : (priorityLevel === 2 ? 'vecino' : 'invitado');
        const priorityLabel = ROLE_PRIORITY[seedRole].label;

        insertStmt.run(
          item.id,
          item.folio,
          item.title,
          item.description || '',
          item.category,
          item.categoryLabel,
          item.categoryIcon,
          item.status,
          item.statusLabel,
          item.urgency || 'medium',
          item.urgencyLabel || 'Normal',
          item.channel || 'app',
          item.channelLabel || 'Canal Vecinal App',
          item.address,
          item.sector,
          item.sectorLabel,
          item.reportedBy,
          seedRole,
          priorityLevel,
          priorityLabel,
          item.isVerified ? 1 : 0,
          item.assignedTeam || 'Por asignar',
          item.image || '',
          item.coordinates?.x || 50,
          item.coordinates?.y || 50,
          item.createdAt || new Date().toISOString(),
          new Date().toISOString()
        );
      });
      console.log(`[Base de Datos] ✓ Incidencias iniciales sincronizadas.`);
    } catch (err) {
      console.error('[Base de Datos] Error al sembrar incidencias:', err.message);
    }
  }
}

function seedDatabase() {
  seedUsers();
  seedSettings();
  seedIncidents();
}

module.exports = { seedDatabase };
