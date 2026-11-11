import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterIncidents, countByStatus, homeEfficiencyRate, nextFolioPreview, criticalIncidents,
  normalizeFolio, folioQueryId, findIncident, auditCounts
} from '../public/js/logic.js';

const incidents = [
  { id: 'CIV-8950', folio: '#CIV-8950', status: 'new', category: 'vialidad', title: 'Bache grande', address: 'Av. Matta 100', priorityLevel: 3, urgency: 'medium' },
  { id: 'CIV-8942', folio: '#CIV-8942', status: 'progress', category: 'aseo', title: 'Basura', address: 'Calle Sur', reportedBy: 'Carmen Soto', priorityLevel: 1, urgency: 'high' },
  { id: 'CIV-8939', folio: '#CIV-8939', status: 'resolved', category: 'vialidad', title: 'Semáforo', address: 'Centro', priorityLevel: 4, urgency: 'low' }
];

test('filtro de la bandeja: estado, categoría y texto en varios campos', () => {
  const ids = opts => filterIncidents(incidents, { status: 'all', category: 'all', query: '', ...opts }).map(i => i.id);
  assert.deepEqual(ids({}), ['CIV-8950', 'CIV-8942', 'CIV-8939']);
  assert.deepEqual(ids({ status: 'new' }), ['CIV-8950']);
  assert.deepEqual(ids({ category: 'vialidad', status: 'resolved' }), ['CIV-8939']);
  assert.deepEqual(ids({ query: 'carmen' }), ['CIV-8942']);
  assert.deepEqual(ids({ query: 'MATTA' }), ['CIV-8950']);
});

test('conteo por estado y eficiencia del inicio', () => {
  const counts = countByStatus(incidents);
  assert.deepEqual(counts, { total: 3, new: 1, progress: 1, resolved: 1 });
  assert.equal(homeEfficiencyRate(counts), 50); // (1 + 0.5) / 3
  assert.equal(homeEfficiencyRate(countByStatus([])), 94);
  assert.equal(countByStatus([{ status: 'total' }]).total, 1);
});

test('vista previa del próximo folio', () => {
  assert.equal(nextFolioPreview(incidents), '#CIV-8951');
  assert.equal(nextFolioPreview([]), '#CIV-8951');
  assert.equal(nextFolioPreview([{ id: 'CIV-9100' }, { id: null }]), '#CIV-9101');
});

test('alertas críticas: prioridad >= 3 o urgencia alta, sin resolver', () => {
  assert.deepEqual(criticalIncidents(incidents).map(i => i.id), ['CIV-8950', 'CIV-8942']);
});

test('búsqueda de folio escrita por el usuario', () => {
  assert.equal(normalizeFolio('#civ-8942'), 'CIV-8942');
  assert.equal(folioQueryId('8942'), 'CIV-8942');
  assert.equal(folioQueryId('CIV-8942'), 'CIV-8942');
  assert.equal(findIncident(incidents, 'CIV-8942').title, 'Basura');
  assert.equal(findIncident(incidents, '8939').id, 'CIV-8939'); // coincidencia parcial en el folio
  assert.equal(findIncident(incidents, 'CIV-1'), undefined);
});

test('contadores de la bitácora de auditoría', () => {
  const logs = [
    { action: 'LOGIN_EXITOSO', actor_role: 'vecino' },
    { action: 'ELIMINAR_USUARIO', actor_role: 'trabajador' },
    { action: 'CAMBIO_PASSWORD', actor_role: 'admin' },
    { action: null, actor_role: 'invitado' }
  ];
  // ELIMINAR_USUARIO cuenta en ambos: prefijo administrativo y contiene USUARIO
  assert.deepEqual(auditCounts(logs), { admin: 2, auth: 3 });
});
