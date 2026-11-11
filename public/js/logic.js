// Lógica pura del frontend (sin DOM ni red), probada en test/logic.test.mjs.

const FOLIO_BASE = 8950; // igual que FOLIO_BASE en src/domain.js

// Bandeja: filtra por estado, categoría y texto libre (folio, título, dirección, categoría o denunciante)
function filterIncidents(incidents, { status, category, query }) {
  const q = (query || '').toLowerCase();
  return incidents.filter(i =>
    (status === 'all' || i.status === status) &&
    (category === 'all' || i.category === category) &&
    (!q || [i.folio, i.title, i.address, i.categoryLabel, i.reportedBy].some(v => (v || '').toLowerCase().includes(q)))
  );
}

function countByStatus(incidents) {
  const counts = { total: incidents.length, new: 0, progress: 0, resolved: 0 };
  incidents.forEach(i => { if (Object.hasOwn(counts, i.status) && i.status !== 'total') counts[i.status]++; });
  return counts;
}

// Eficiencia del inicio: resueltas + la mitad de las en proceso; 94% de vitrina si aún no hay reportes
function homeEfficiencyRate({ total, progress, resolved }) {
  return total > 0 ? Math.round(((resolved + (progress * 0.5)) / total) * 100) : 94;
}

// Vista previa del próximo folio; el definitivo lo asigna el servidor
function nextFolioPreview(incidents) {
  let maxNum = FOLIO_BASE;
  incidents.forEach(inc => {
    const match = (inc.id || '').match(/CIV-(\d+)/i);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  });
  return `#CIV-${maxNum + 1}`;
}

// Alertas del hub: prioridad alta o urgencia alta, sin resolver
function criticalIncidents(incidents) {
  return incidents.filter(i => (i.priorityLevel >= 3 || i.urgency === 'high') && i.status !== 'resolved');
}

// '#civ-8942' -> 'CIV-8942'
function normalizeFolio(raw) {
  return raw.replace('#', '').toUpperCase();
}

// Id para consultar al servidor: '8942' -> 'CIV-8942'
function folioQueryId(clean) {
  return clean.startsWith('CIV-') ? clean : `CIV-${clean}`;
}

function findIncident(incidents, clean) {
  return incidents.find(i => (i.id && i.id.toUpperCase() === clean) || (i.folio && i.folio.toUpperCase().includes(clean)));
}

// Contadores de la bitácora: acciones administrativas y eventos de autenticación
function auditCounts(logs) {
  const adminPrefixes = ['ADMIN_', 'MODERACIÓN', 'CAMBIO_CONFIG', 'ELIMINAR_'];
  const authWords = ['LOGIN', 'LOGOUT', 'PASSWORD', 'CLAVE', 'REGISTRO', 'USUARIO'];
  return {
    admin: logs.filter(l => l.actor_role === 'admin' || (l.action && adminPrefixes.some(p => l.action.startsWith(p)))).length,
    auth: logs.filter(l => l.action && authWords.some(w => l.action.includes(w))).length
  };
}

export {
  filterIncidents, countByStatus, homeEfficiencyRate, nextFolioPreview, criticalIncidents,
  normalizeFolio, folioQueryId, findIncident, auditCounts
};
