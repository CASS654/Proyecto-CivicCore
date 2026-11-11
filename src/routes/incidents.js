// /api/incidents/* y /api/stats: incidencias ciudadanas y KPIs
const express = require('express');
const incidentsDb = require('../database/incidents');
const systemDb = require('../database/system');
const { getUserFromRequest } = require('../middlewares/auth');

const router = express.Router();

// ==========================================
// Endpoints de Incidencias Ciudadanas
// ==========================================

/**
 * GET /api/incidents
 * Listado de incidencias con filtros opcionales (?status=&sector=&category=&search=)
 */
router.get('/incidents', (req, res) => {
  const { status, sector, category, search } = req.query;
  const incidents = incidentsDb.getAllIncidents({ status, sector, category, search });
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
  const incident = incidentsDb.getIncidentById(req.params.id);
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

  const newIncident = incidentsDb.createIncident({
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

  const updated = incidentsDb.updateIncidentStatus(req.params.id, status, user);
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
  const stats = systemDb.getDatabaseStats();
  res.json({
    status: 'success',
    data: stats
  });
});

module.exports = router;
