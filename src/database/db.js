const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'civiccore.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const SEED_JSON = path.join(__dirname, '..', 'data', 'incidents.json');

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

// Crear directorio data si no existe
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Inicializar conexión SQLite nativa de Node.js
const db = new DatabaseSync(DB_PATH);
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

// ==========================================
// Prioridad por Rol del Creador
// Orden estricto: Admin (4) > Funcionario (3) > Vecino (2) > Invitado (1)
// La urgencia NO cambia el nivel, solo desempata dentro del mismo nivel.
// ==========================================
const ROLE_PRIORITY = {
  admin:      { level: 4, label: 'Crítica (Super Admin)' },
  trabajador: { level: 3, label: 'Muy Alta (Funcionario Estado)' },
  vecino:     { level: 2, label: 'Alta (Vecino Verificado)' },
  invitado:   { level: 1, label: 'Normal (Invitado)' }
};

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
seedUsers();

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
seedSettings();

// Sembrar Incidencias si está vacío
function seedIncidents() {
  const count = db.prepare('SELECT COUNT(*) as total FROM incidents').get();
  if (count.total === 0 && fs.existsSync(SEED_JSON)) {
    try {
      const raw = fs.readFileSync(SEED_JSON, 'utf-8').replace(/^\uFEFF/, '');
      const items = JSON.parse(raw);
      const insertStmt = db.prepare(`
        INSERT INTO incidents (
          id, folio, title, description, category, category_label, category_icon,
          status, status_label, urgency, urgency_label, channel, channel_label,
          address, sector, sector_label, reported_by, reported_by_role, priority_level, priority_label,
          is_verified, assigned_team, image_url, coord_x, coord_y, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?
        )
      `);

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
seedIncidents();

// ==========================================
// Formateo de Filas
// ==========================================

function formatIncidentRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    folio: row.folio,
    title: row.title,
    description: row.description,
    category: row.category,
    categoryLabel: row.category_label,
    categoryIcon: row.category_icon,
    status: row.status,
    statusLabel: row.status_label,
    urgency: row.urgency,
    urgencyLabel: row.urgency_label,
    channel: row.channel,
    channelLabel: row.channel_label,
    address: row.address,
    sector: row.sector,
    sectorLabel: row.sector_label,
    reportedBy: row.reported_by,
    reportedByRole: row.reported_by_role,
    priorityLevel: row.priority_level,
    priorityLabel: row.priority_label,
    isVerified: Boolean(row.is_verified),
    assignedTeam: row.assigned_team,
    image: row.image_url,
    coordinates: { x: row.coord_x, y: row.coord_y },
    moderatedBy: row.moderated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    timeAgo: calculateTimeAgo(row.created_at)
  };
}

function calculateTimeAgo(dateStr) {
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

// ==========================================
// Métodos de Incidencias
// ==========================================

function getAllIncidents(filters = {}) {
  let query = 'SELECT * FROM incidents WHERE 1=1';
  const params = [];

  if (filters.status && filters.status !== 'all') {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters.sector && filters.sector !== 'all') {
    query += ' AND sector = ?';
    params.push(filters.sector);
  }

  if (filters.category && filters.category !== 'all') {
    query += ' AND category = ?';
    params.push(filters.category);
  }

  if (filters.search) {
    query += ' AND (folio LIKE ? OR title LIKE ? OR description LIKE ? OR address LIKE ? OR reported_by LIKE ?)';
    const term = `%${filters.search.trim()}%`;
    params.push(term, term, term, term, term);
  }

  // Ordenar: 1) prioridad por rol (Admin > Funcionario > Vecino > Invitado),
  //          2) urgencia declarada (Urgente > Normal > Baja), 3) más recientes primero
  query += ` ORDER BY priority_level DESC,
    CASE urgency WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 2 END DESC,
    created_at DESC`;

  const stmt = db.prepare(query);
  const rows = stmt.all(...params);
  return rows.map(formatIncidentRow);
}

function getIncidentById(id) {
  if (!id) return null;
  const clean = id.toString().replace('#', '').trim();
  const withPrefix = clean.toUpperCase().startsWith('CIV-') ? clean.toUpperCase() : `CIV-${clean}`;
  const folio = `#${withPrefix}`;

  const stmt = db.prepare('SELECT * FROM incidents WHERE id = ? OR id = ? OR folio = ? OR folio = ?');
  const row = stmt.get(id, withPrefix, folio, `#${clean}`);
  return formatIncidentRow(row);
}

/**
 * Lógica de Asignación de Prioridad según el Rol del Creador
 */
function calculatePriority(role) {
  // El nivel depende SOLO del rol: un reporte urgente de vecino nunca supera a uno de funcionario,
  // y uno urgente de invitado nunca supera a uno de vecino. La urgencia se usa como desempate al ordenar.
  return ROLE_PRIORITY[role] || ROLE_PRIORITY.invitado;
}

function createIncident(data, user = { role: 'invitado', name: 'Vecino Anónimo' }) {
  // Cálculo de siguiente folio garantizando que no existan colisiones con registros existentes
  const allIds = db.prepare("SELECT id FROM incidents WHERE id LIKE 'CIV-%'").all();
  let maxNum = 8950;
  allIds.forEach(row => {
    const m = (row.id || '').match(/CIV-(\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });
  const nextNum = maxNum + 1;
  const id = `CIV-${nextNum}`;
  const folio = `#${id}`;

  const cat = CATEGORY_MAP[data.category] || { label: 'General', icon: 'assignment' };
  const sectorLabel = SECTOR_MAP[data.sector] || 'Comuna Central';
  const now = new Date().toISOString();

  const coords = data.coordinates || {
    x: Math.floor(Math.random() * 60) + 20,
    y: Math.floor(Math.random() * 60) + 20
  };

  const role = user.role || 'invitado';
  const priority = calculatePriority(role);
  const isVerified = (role === 'vecino' || role === 'trabajador' || role === 'admin') ? 1 : 0;

  const insertStmt = db.prepare(`
    INSERT INTO incidents (
      id, folio, title, description, category, category_label, category_icon,
      status, status_label, urgency, urgency_label, channel, channel_label,
      address, sector, sector_label, reported_by, reported_by_role, priority_level, priority_label,
      is_verified, assigned_team, image_url, coord_x, coord_y, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?
    )
  `);

function saveBase64Image(imageData, incidentId) {
  if (!imageData || typeof imageData !== 'string' || !imageData.trim()) {
    return 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80';
  }

  if (imageData.startsWith('data:image/')) {
    try {
      const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const matches = imageData.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        let ext = matches[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        if (ext === 'svg+xml') ext = 'svg';
        const cleanId = incidentId.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
        const filename = `foto-${cleanId}-${Date.now()}.${ext}`;
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));
        return `/uploads/${filename}`;
      }
    } catch (err) {
      console.error('Error al guardar foto subida en disco:', err.message);
    }
  }

  return imageData;
}

  const finalImageUrl = saveBase64Image(data.image, id);

  insertStmt.run(
    id,
    folio,
    data.title || 'Reporte de Incidencia Ciudadana',
    data.description || '',
    data.category || 'vialidad',
    cat.label,
    cat.icon,
    'new',
    STATUS_MAP['new'],
    data.urgency || 'medium',
    data.urgency === 'high' ? 'Urgente' : (data.urgency === 'low' ? 'Baja' : 'Normal'),
    data.channel || 'app',
    data.channel === 'phone' ? 'Llamada Telefónica 1414' : (data.channel === 'inspection' ? 'Inspección en Terreno' : 'Canal Vecinal App'),
    data.address || 'Ubicación no especificada',
    data.sector || 'centro',
    sectorLabel,
    data.reportedBy || user.name || 'Vecino Anónimo',
    role,
    priority.level,
    priority.label,
    isVerified,
    role === 'trabajador' ? 'Cuadrilla Municipal (Despacho Preferente)' : 'Por asignar',
    finalImageUrl,
    coords.x,
    coords.y,
    now,
    now
  );

  // Registrar auditoría
  db.prepare(`
    INSERT INTO incident_logs (incident_id, action, user_name, user_role, new_status, details, created_at)
    VALUES (?, 'CREADO', ?, ?, 'new', ?, ?)
  `).run(id, user.name || 'Invitado', role, `Reporte creado con nivel de prioridad: ${priority.label}`, now);

  return getIncidentById(id);
}

function updateIncidentStatus(id, newStatus, user = { name: 'Operador', role: 'trabajador' }) {
  const current = getIncidentById(id);
  if (!current) return null;

  const now = new Date().toISOString();
  let assignedTeam = current.assignedTeam;

  if (newStatus === 'resolved') {
    assignedTeam = 'Completado por Cuadrilla Municipal';
  } else if (newStatus === 'progress') {
    assignedTeam = 'Cuadrilla Municipal #02 (En terreno)';
  }

  const updateStmt = db.prepare(`
    UPDATE incidents
    SET status = ?, status_label = ?, assigned_team = ?, updated_at = ?
    WHERE id = ? OR folio = ?
  `);

  updateStmt.run(newStatus, STATUS_MAP[newStatus] || newStatus, assignedTeam, now, id, id);

  db.prepare(`
    INSERT INTO incident_logs (incident_id, action, user_name, user_role, previous_status, new_status, details, created_at)
    VALUES (?, 'CAMBIO_ESTADO', ?, ?, ?, ?, 'Cambio de estado operativo', ?)
  `).run(current.id, user.name, user.role, current.status, newStatus, now);

  return getIncidentById(id);
}

/**
 * Moderación de Incidencia (Solo Super Admin)
 */
function moderateIncident(id, { priorityLevel, title, description, assignedTeam, category }, adminUser) {
  const current = getIncidentById(id);
  if (!current) return null;

  const now = new Date().toISOString();
  const pLevel = parseInt(priorityLevel, 10) || current.priorityLevel;
  const pLabels = {
    1: 'Normal (Invitado)',
    2: 'Alta (Vecino Verificado)',
    3: 'Muy Alta (Funcionario Estado)',
    4: 'Crítica (Super Admin)'
  };

  db.prepare(`
    UPDATE incidents
    SET priority_level = ?, priority_label = ?, title = ?, description = ?, assigned_team = ?, moderated_by = ?, updated_at = ?
    WHERE id = ? OR folio = ?
  `).run(pLevel, pLabels[pLevel] || 'Ajustada', title || current.title, description || current.description, assignedTeam || current.assignedTeam, adminUser.name, now, id, id);

  db.prepare(`
    INSERT INTO incident_logs (incident_id, action, user_name, user_role, details, created_at)
    VALUES (?, 'MODERACION_ADMIN', ?, 'admin', ?, ?)
  `).run(current.id, adminUser.name, `Incidencia moderada por Super Admin. Nueva prioridad: ${pLabels[pLevel]}`, now);

  return getIncidentById(id);
}

// ==========================================
// Métodos de Usuarios y Autenticación
// ==========================================

function authenticateUser(identifier, password) {
  if (!identifier || !password) return null;
  const clean = identifier.trim().toLowerCase();
  const user = db.prepare(`
    SELECT * FROM users 
    WHERE (LOWER(email) = ? OR LOWER(rut_dni) = ?) AND status = 'active'
  `).get(clean, clean);
  if (!user) return null;
  if (user.password !== password) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    rutDni: user.rut_dni,
    department: user.department,
    createdAt: user.created_at
  };
}

function getAllUsers() {
  const rows = db.prepare('SELECT id, name, email, role, rut_dni, department, status, created_at FROM users ORDER BY id ASC').all();
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    rutDni: r.rut_dni,
    department: r.department,
    status: r.status,
    createdAt: r.created_at
  }));
}

function createUser(userData, adminActor) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO users (name, email, password, role, rut_dni, department, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
  `);

  stmt.run(
    userData.name,
    userData.email.trim().toLowerCase(),
    userData.password || 'civic123',
    userData.role || 'vecino',
    userData.rutDni || '',
    userData.department || 'Comuna',
    now
  );

  // Registrar auditoría del sistema
  addSystemAuditLog('CREACION_USUARIO', adminActor.name, adminActor.role, `Creación de usuario ${userData.email} (${userData.role})`, '127.0.0.1');

  return db.prepare('SELECT id, name, email, role, rut_dni, department, status, created_at FROM users WHERE email = ?').get(userData.email.trim().toLowerCase());
}

function toggleUserStatus(id, newStatus, adminActor) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return null;
  if (user.role === 'admin' && newStatus === 'suspended') {
    throw new Error('No es posible suspender una cuenta con rol de Super Administrador activo.');
  }

  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(newStatus, id);
  addSystemAuditLog('ESTADO_USUARIO', adminActor.name, adminActor.role, `Usuario ${user.email} cambiado a ${newStatus}`, '127.0.0.1');

  return db.prepare('SELECT id, name, email, role, status FROM users WHERE id = ?').get(id);
}

function updateUserPassword(idOrEmail, newPassword, actor = { name: 'Super Admin Root', role: 'admin' }) {
  if (!idOrEmail || !newPassword) {
    throw new Error('Identificador de usuario y nueva contraseña son obligatorios.');
  }

  let user;
  if (typeof idOrEmail === 'number' || (!isNaN(idOrEmail) && !idOrEmail.toString().includes('@'))) {
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(idOrEmail));
  } else {
    user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(idOrEmail.toString().trim().toLowerCase());
  }

  if (!user) {
    throw new Error('Usuario no encontrado.');
  }

  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword.toString().trim(), user.id);

  addSystemAuditLog(
    'CAMBIO_PASSWORD',
    actor.name || 'Usuario',
    actor.role || 'admin',
    `Contraseña actualizada para ${user.email} (${user.role})`,
    '127.0.0.1'
  );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function updateUserProfile(id, profileData, adminActor = { role: 'admin', name: 'Super Admin Root' }) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id));
  if (!user) throw new Error('Usuario no encontrado.');

  const name = profileData.name !== undefined && profileData.name.trim() !== '' ? profileData.name.trim() : user.name;
  const email = profileData.email !== undefined && profileData.email.trim() !== '' ? profileData.email.trim().toLowerCase() : user.email;
  const department = profileData.department !== undefined ? profileData.department.trim() : user.department;
  const role = profileData.role !== undefined ? profileData.role : user.role;
  const rutDni = profileData.rutDni !== undefined ? profileData.rutDni.trim() : user.rut_dni;

  // Verificar si el correo ya pertenece a otro usuario
  if (email !== user.email) {
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?').get(email, Number(id));
    if (existing) {
      throw new Error(`El correo ${email} ya está registrado por otro usuario.`);
    }
  }

  db.prepare(`
    UPDATE users 
    SET name = ?, email = ?, department = ?, role = ?, rut_dni = ?
    WHERE id = ?
  `).run(name, email, department, role, rutDni, Number(id));

  addSystemAuditLog(
    'EDICION_USUARIO',
    adminActor.name || 'Super Admin',
    adminActor.role || 'admin',
    `Actualización de datos para usuario ${email} (Nombre: ${name}, Rol: ${role})`,
    '127.0.0.1'
  );

  return db.prepare('SELECT id, name, email, role, rut_dni, department, status, created_at FROM users WHERE id = ?').get(Number(id));
}

function registerVecino({ name, email, password, rutDni, department }) {
  if (!email || !password) {
    throw new Error('Correo y contraseña son obligatorios.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
  if (existing) {
    throw new Error('Este correo ya está registrado. Por favor presiona Iniciar Sesión.');
  }

  if (!name || !name.trim()) {
    const raw = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
    name = raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO users (name, email, password, role, rut_dni, department, status, created_at)
    VALUES (?, ?, ?, 'vecino', ?, ?, 'active', ?)
  `);

  const result = stmt.run(
    name.trim(),
    cleanEmail,
    password.trim(),
    rutDni ? rutDni.trim() : '',
    department ? department.trim() : 'Comunidad Vecinal',
    now
  );

  const newId = result.lastInsertRowid;
  addSystemAuditLog('REGISTRO_VECINO', name.trim(), 'vecino', `Registro ciudadano para ${cleanEmail}`, '127.0.0.1');

  return {
    id: Number(newId),
    name: name.trim(),
    email: cleanEmail,
    role: 'vecino',
    rutDni: rutDni ? rutDni.trim() : '',
    department: department ? department.trim() : 'Comunidad Vecinal',
    status: 'active',
    createdAt: now
  };
}

function authenticateGoogleUser({ email, name, avatar }) {
  if (!email) {
    throw new Error('El correo de Google es obligatorio.');
  }

  const cleanEmail = email.trim().toLowerCase();
  let user = db.prepare('SELECT id, name, email, role, rut_dni, department, status, created_at FROM users WHERE LOWER(email) = ?').get(cleanEmail);

  if (user) {
    if (user.status === 'suspended') {
      throw new Error('Tu cuenta se encuentra suspendida por la administración municipal.');
    }
    addSystemAuditLog('LOGIN_GOOGLE', user.name, user.role, `Inicio de sesión con Google (${cleanEmail})`, '127.0.0.1');
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      rutDni: user.rut_dni,
      department: user.department,
      status: user.status,
      avatar: avatar || null
    };
  }

  // Si no existe, se registra automáticamente como Vecino
  const now = new Date().toISOString();
  const cleanName = (name && name.trim()) ? name.trim() : cleanEmail.split('@')[0];
  const stmt = db.prepare(`
    INSERT INTO users (name, email, password, role, rut_dni, department, status, created_at)
    VALUES (?, ?, ?, 'vecino', 'Google Auth', 'Comunidad Vecinal', 'active', ?)
  `);

  const randomPwd = 'google_' + Math.random().toString(36).substring(2, 10);
  const result = stmt.run(cleanName, cleanEmail, randomPwd, now);
  const newId = result.lastInsertRowid;

  addSystemAuditLog('REGISTRO_GOOGLE_VECINO', cleanName, 'vecino', `Nuevo registro ciudadano vía Google (${cleanEmail})`, '127.0.0.1');

  return {
    id: Number(newId),
    name: cleanName,
    email: cleanEmail,
    role: 'vecino',
    rutDni: 'Google Auth',
    department: 'Comunidad Vecinal',
    status: 'active',
    avatar: avatar || null,
    createdAt: now
  };
}

// ==========================================
// Auditoría General y Configuración del Sistema
// ==========================================

function addSystemAuditLog(action, actorName, actorRole, targetInfo, ip = '127.0.0.1') {
  db.prepare(`
    INSERT INTO system_audit_logs (action, actor_name, actor_role, target_info, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(action, actorName, actorRole, targetInfo, ip, new Date().toISOString());
}

function getSystemAuditLogs() {
  return db.prepare('SELECT * FROM system_audit_logs ORDER BY id DESC LIMIT 50').all();
}

function getSystemSettings() {
  const rows = db.prepare('SELECT * FROM system_settings').all();
  const obj = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  return obj;
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
  statusRows.forEach(r => { if (counts.hasOwnProperty(r.status)) counts[r.status] = r.count; });

  const categoryRows = db.prepare('SELECT category, COUNT(*) as count FROM incidents GROUP BY category').all();
  const byCategory = {};
  Object.keys(CATEGORY_MAP).forEach(k => { byCategory[k] = 0; });
  categoryRows.forEach(r => { byCategory[r.category] = r.count; });

  const usersCount = db.prepare('SELECT COUNT(*) as total FROM users').get().total;
  const vecinosCount = db.prepare("SELECT COUNT(*) as total FROM users WHERE role = 'vecino'").get().total;
  const funcionariosCount = db.prepare("SELECT COUNT(*) as total FROM users WHERE role = 'trabajador'").get().total;
  const criticalCount = db.prepare("SELECT COUNT(*) as total FROM incidents WHERE priority_level >= 3 AND status != 'resolved'").get().total;

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
    activeCrews: 8
  };
}

function deleteIncident(id, adminActor = { name: 'Panel de Control', role: 'admin' }) {
  if (!id) return false;
  const clean = id.toString().replace('#', '').trim();
  const inc = db.prepare('SELECT id, folio, title FROM incidents WHERE id = ? OR folio = ? OR id = ?').get(clean, `#${clean}`, id);
  if (!inc) return false;
  db.prepare('DELETE FROM incidents WHERE id = ?').run(inc.id);
  addSystemAuditLog('ELIMINAR_INCIDENCIA', adminActor.name || 'Control App', adminActor.role || 'admin', `Incidencia ${inc.folio} (${inc.title}) eliminada`, '127.0.0.1');
  return true;
}

function deleteUser(id, adminActor = { name: 'Panel de Control', role: 'admin' }) {
  const numId = Number(id);
  if (numId === 1) {
    throw new Error('No es posible eliminar al Administrador Principal del Sistema.');
  }
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(numId);
  if (!user) {
    throw new Error('Usuario no encontrado.');
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(numId);
  addSystemAuditLog('ELIMINAR_USUARIO', adminActor.name || 'Control App', adminActor.role || 'admin', `Usuario ${user.name} (${user.email}) eliminado`, '127.0.0.1');
  return true;
}

function updateUserRole(id, newRole, adminActor = { name: 'Panel de Control', role: 'admin' }) {
  const numId = Number(id);
  const validRoles = ['invitado', 'vecino', 'trabajador', 'admin'];
  if (!validRoles.includes(newRole)) {
    throw new Error(`Rol inválido: ${newRole}`);
  }
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(numId);
  if (!user) throw new Error('Usuario no encontrado.');
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, numId);
  addSystemAuditLog('CAMBIO_ROL', adminActor.name || 'Control App', adminActor.role || 'admin', `Rol de ${user.email} cambiado de ${user.role} a ${newRole}`, '127.0.0.1');
  return db.prepare('SELECT id, name, email, role, status FROM users WHERE id = ?').get(numId);
}

function createDatabaseBackup() {
  const backupsDir = path.join(__dirname, '..', 'data', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const timestamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const backupFileName = `civiccore_backup_${timestamp}.db`;
  const backupPath = path.join(backupsDir, backupFileName);
  fs.copyFileSync(DB_PATH, backupPath);
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
  const backupsDir = path.join(__dirname, '..', 'data', 'backups');
  if (!fs.existsSync(backupsDir)) return [];
  const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.db'));
  return files.map(file => {
    const fullPath = path.join(backupsDir, file);
    const stat = fs.statSync(fullPath);
    return {
      fileName: file,
      sizeKb: (stat.size / 1024).toFixed(1),
      createdAt: stat.mtime.toISOString()
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function restoreDatabaseBackup(fileName) {
  const backupsDir = path.join(__dirname, '..', 'data', 'backups');
  const safeName = path.basename(fileName);
  const backupPath = path.join(backupsDir, safeName);
  if (!fs.existsSync(backupPath)) {
    throw new Error('Archivo de copia de seguridad no encontrado.');
  }
  createDatabaseBackup();
  fs.copyFileSync(backupPath, DB_PATH);
  addSystemAuditLog('RESTORE_DATABASE', 'Control App', 'admin', `Base restaurada desde: ${safeName}`, '127.0.0.1');
  return { success: true, restoredFrom: safeName };
}

function clearSystemAuditLogs() {
  db.prepare('DELETE FROM system_audit_logs').run();
  addSystemAuditLog('LIMPIEZA_LOGS', 'Control App', 'admin', 'Historial de auditoría vaciado por el operador', '127.0.0.1');
  return { success: true };
}

module.exports = {
  db,
  getAllIncidents,
  getIncidentById,
  createIncident,
  updateIncidentStatus,
  moderateIncident,
  deleteIncident,
  authenticateUser,
  getAllUsers,
  createUser,
  deleteUser,
  toggleUserStatus,
  updateUserPassword,
  updateUserProfile,
  updateUserRole,
  registerVecino,
  authenticateGoogleUser,
  getSystemAuditLogs,
  addSystemAuditLog,
  getSystemSettings,
  updateSystemSetting,
  getDatabaseStats,
  createDatabaseBackup,
  listDatabaseBackups,
  restoreDatabaseBackup,
  clearSystemAuditLogs
};
