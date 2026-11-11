// Consultas de incidencias, guardado de fotos subidas y conversión de filas a objetos de la API.
const fs = require('fs');
const path = require('path');
const { db } = require('./connection');
const { addSystemAuditLog } = require('./system');
const {
  CATEGORY_MAP, SECTOR_MAP, STATUS_MAP, PRIORITY_LABEL_BY_LEVEL,
  calculatePriority, nextFolioNumber, incidentIdVariants, urgencyLabel, channelLabel,
  isVerifiedRole, initialTeamForRole, teamForStatus, generateSectorCoordinates, timeAgo
} = require('../domain');

// Usado también por seed.js: un solo lugar con el orden de las 27 columnas
const INSERT_INCIDENT_SQL = `
  INSERT INTO incidents (
    id, folio, title, description, category, category_label, category_icon,
    status, status_label, urgency, urgency_label, channel, channel_label,
    address, sector, sector_label, reported_by, reported_by_role, priority_level, priority_label,
    is_verified, assigned_team, image_url, coord_x, coord_y, created_at, updated_at
  ) VALUES (${Array(27).fill('?').join(', ')})
`;

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
    timeAgo: timeAgo(row.created_at)
  };
}

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
  const { clean, withPrefix, folio } = incidentIdVariants(id);

  const stmt = db.prepare('SELECT * FROM incidents WHERE id = ? OR id = ? OR folio = ? OR folio = ?');
  const row = stmt.get(id, withPrefix, folio, `#${clean}`);
  return formatIncidentRow(row);
}

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
        // shortcut: acepta SVG, que puede llevar scripts y se sirve desde este mismo dominio; limitar a jpg/png/webp si se abre al público
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

function createIncident(data, user) {
  // Cálculo de siguiente folio garantizando que no existan colisiones con registros existentes
  const allIds = db.prepare("SELECT id FROM incidents WHERE id LIKE 'CIV-%'").all();
  const id = `CIV-${nextFolioNumber(allIds.map(row => row.id))}`;
  const folio = `#${id}`;

  const cat = CATEGORY_MAP[data.category] || { label: 'General', icon: 'assignment' };
  const sectorKey = data.sector || 'centro';
  const sectorLabel = SECTOR_MAP[sectorKey] || 'Comuna Central';
  const now = new Date().toISOString();

  const coords = (data.coordinates && typeof data.coordinates.x === 'number' && typeof data.coordinates.y === 'number')
    ? data.coordinates
    : generateSectorCoordinates(sectorKey);

  const role = user.role || 'invitado';
  const priority = calculatePriority(role);
  const isVerified = isVerifiedRole(role) ? 1 : 0;

  const insertStmt = db.prepare(INSERT_INCIDENT_SQL);

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
    urgencyLabel(data.urgency),
    data.channel || 'app',
    channelLabel(data.channel),
    data.address || 'Ubicación no especificada',
    data.sector || 'centro',
    sectorLabel,
    data.reportedBy || user.name || 'Vecino Anónimo',
    role,
    priority.level,
    priority.label,
    isVerified,
    initialTeamForRole(role),
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

function updateIncidentStatus(id, newStatus, user) {
  const current = getIncidentById(id);
  if (!current) return null;

  const now = new Date().toISOString();
  const assignedTeam = teamForStatus(newStatus, current.assignedTeam);

  const updateStmt = db.prepare(`
    UPDATE incidents
    SET status = ?, status_label = ?, assigned_team = ?, updated_at = ?
    WHERE id = ?
  `);

  updateStmt.run(newStatus, STATUS_MAP[newStatus] || newStatus, assignedTeam, now, current.id);

  db.prepare(`
    INSERT INTO incident_logs (incident_id, action, user_name, user_role, previous_status, new_status, details, created_at)
    VALUES (?, 'CAMBIO_ESTADO', ?, ?, ?, ?, 'Cambio de estado operativo', ?)
  `).run(current.id, user.name, user.role, current.status, newStatus, now);

  return getIncidentById(current.id);
}

/**
 * Moderación de Incidencia (Solo Super Admin)
 */
function moderateIncident(id, { priorityLevel, title, description, assignedTeam, category }, adminUser) {
  const current = getIncidentById(id);
  if (!current) return null;

  const now = new Date().toISOString();
  const pLevel = parseInt(priorityLevel, 10) || current.priorityLevel;

  const finalCategory = (category && CATEGORY_MAP[category]) ? category : current.category;
  const finalCategoryLabel = CATEGORY_MAP[finalCategory]?.label || current.categoryLabel;
  const finalCategoryIcon = CATEGORY_MAP[finalCategory]?.icon || current.categoryIcon;

  db.prepare(`
    UPDATE incidents
    SET priority_level = ?, priority_label = ?, title = ?, description = ?, assigned_team = ?,
        category = ?, category_label = ?, category_icon = ?, moderated_by = ?, updated_at = ?
    WHERE id = ?
  `).run(
    pLevel,
    PRIORITY_LABEL_BY_LEVEL[pLevel] || 'Ajustada',
    title || current.title,
    description !== undefined ? description : current.description,
    assignedTeam || current.assignedTeam,
    finalCategory,
    finalCategoryLabel,
    finalCategoryIcon,
    adminUser.name,
    now,
    current.id
  );

  db.prepare(`
    INSERT INTO incident_logs (incident_id, action, user_name, user_role, details, created_at)
    VALUES (?, 'MODERACION_ADMIN', ?, 'admin', ?, ?)
  `).run(current.id, adminUser.name, `Incidencia moderada por Super Admin. Nueva prioridad: ${PRIORITY_LABEL_BY_LEVEL[pLevel]}`, now);

  return getIncidentById(current.id);
}

function deleteIncident(id, adminActor) {
  if (!id) return false;
  const clean = id.toString().replace('#', '').trim();
  const inc = db.prepare('SELECT id, folio, title FROM incidents WHERE id = ? OR folio = ? OR id = ?').get(clean, `#${clean}`, id);
  if (!inc) return false;
  db.prepare('DELETE FROM incidents WHERE id = ?').run(inc.id);
  addSystemAuditLog('ELIMINAR_INCIDENCIA', adminActor.name || 'Control App', adminActor.role || 'admin', `Incidencia ${inc.folio} (${inc.title}) eliminada`, '127.0.0.1');
  return true;
}

module.exports = {
  INSERT_INCIDENT_SQL,
  getAllIncidents,
  getIncidentById,
  createIncident,
  updateIncidentStatus,
  moderateIncident,
  deleteIncident
};
