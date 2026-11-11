// /api/status y /api/info: diagnóstico del servidor
const express = require('express');
const os = require('os');
const config = require('../config');

const router = express.Router();

// ==========================================
// Endpoints de Diagnóstico y Servidor
// ==========================================

/**
 * GET /api/status
 * Estado de salud y métricas del servidor
 */
router.get('/status', (req, res) => {
  const uptimeSeconds = process.uptime();
  const memory = process.memoryUsage();

  res.json({
    status: 'online',
    appName: config.appName,
    environment: config.env,
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(uptimeSeconds),
      formatted: formatUptime(uptimeSeconds)
    },
    system: {
      nodeVersion: process.version,
      platform: os.platform(),
      hostname: os.hostname(),
      memoryUsedMB: Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100
    },
    client: {
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    }
  });
});

/**
 * GET /api/info
 */
router.get('/info', (req, res) => {
  res.json({
    project: 'CivicCore - Gestión de Incidencias Ciudadanas',
    description: 'Plataforma municipal ciudadana con 4 niveles de acceso (Invitado, Vecino, Trabajador, Super Admin) y ordenamiento por prioridades.',
    port: config.port,
    roles: [
      { id: 'invitado', name: 'Invitado', description: 'Reportes anónimos (prioridad normal), sin acceso a bandejas' },
      { id: 'vecino', name: 'Vecino Ciudadano', description: 'Portal vecinal, seguimiento de folios, prioridad alta para reportes verificados' },
      { id: 'trabajador', name: 'Trabajador del Estado', description: 'Bandeja comunal, mapa interactivo, panel de KPIs, triaje de estados' },
      { id: 'admin', name: 'Super Administrador', description: 'Consola maestra, emisión de claves, moderación directa, auditoría legal' }
    ],
    tunnelTypes: {
      custom: `https://${process.env.LOCALTUNNEL_SUBDOMAIN || 'tarea-santamaria'}.loca.lt`,
      cloudflare: 'https://*.trycloudflare.com'
    }
  });
});

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

module.exports = router;
