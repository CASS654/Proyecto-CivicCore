// Prueba de humo de la API: fija el comportamiento actual para refactorizar sin romperlo.
// Usa una base SQLite temporal (DB_PATH), nunca src/data/civiccore.db.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'civiccore-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
const app = require('../src/app');

const ADMIN = { id: 3, role: 'admin', name: 'Super Admin Root', email: 'admin@civiccore.gov' };
const WORKER = { id: 2, role: 'trabajador', name: 'Lic. Elena Morales', email: 'funcionario@municipio.gov' };
const VECINO = { id: 1, role: 'vecino', name: 'Carmen Soto', email: 'vecino@correo.cl' };

let server;
let base;

before(() => new Promise(resolve => {
  server = app.listen(0, '127.0.0.1', () => {
    base = `http://127.0.0.1:${server.address().port}/api`;
    resolve();
  });
}));

after(() => {
  server.close();
  // shortcut: en Windows SQLite mantiene el archivo abierto y puede no borrarse; queda en la carpeta temporal del sistema
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
});

async function call(method, url, { body, as } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (as) {
    headers['x-user-role'] = as.role;
    headers['x-user-name'] = as.name;
    if (as.email) headers['x-user-email'] = as.email;
    if (as.id) headers['x-user-id'] = String(as.id);
  }
  const res = await fetch(base + url, { method, headers, body: body && JSON.stringify(body) });
  return { status: res.status, json: await res.json() };
}

test('lista las 6 incidencias sembradas ordenadas por prioridad', async () => {
  const { status, json } = await call('GET', '/incidents');
  assert.equal(status, 200);
  assert.equal(json.total, 6);
  const levels = json.data.map(i => i.priorityLevel);
  assert.deepEqual(levels, [...levels].sort((a, b) => b - a));
  assert.equal(json.data[0].reportedByRole, 'trabajador');
});

test('filtra por estado y búsqueda', async () => {
  const all = (await call('GET', '/incidents')).json.data;
  const { json } = await call('GET', '/incidents?status=new');
  assert.equal(json.total, all.filter(i => i.status === 'new').length);
  const one = all[0];
  const found = (await call('GET', `/incidents?search=${encodeURIComponent(one.title)}`)).json.data;
  assert.ok(found.some(i => i.id === one.id));
});

test('detalle por id, por folio sin # y 404', async () => {
  assert.equal((await call('GET', '/incidents/CIV-8942')).json.data.folio, '#CIV-8942');
  assert.equal((await call('GET', '/incidents/8942')).json.data.id, 'CIV-8942');
  const missing = await call('GET', '/incidents/CIV-1');
  assert.equal(missing.status, 404);
  assert.equal(missing.json.status, 'error');
});

test('crear incidencia: prioridad según rol y folio siguiente', async () => {
  const bad = await call('POST', '/incidents', { body: { title: 'Sin dirección', category: 'aseo' } });
  assert.equal(bad.status, 400);

  const guest = await call('POST', '/incidents', {
    body: { title: 'Bache invitado', category: 'vialidad', address: 'Calle 1', sector: 'norte', urgency: 'high', channel: 'phone' }
  });
  assert.equal(guest.status, 201);
  const g = guest.json.data;
  assert.equal(g.id, 'CIV-8951');
  assert.equal(g.folio, '#CIV-8951');
  assert.equal(g.priorityLevel, 1);
  assert.equal(g.priorityLabel, 'Normal (Invitado)');
  assert.equal(g.reportedBy, 'Vecino Anónimo');
  assert.equal(g.urgencyLabel, 'Urgente');
  assert.equal(g.channelLabel, 'Llamada Telefónica 1414');
  assert.equal(g.sectorLabel, 'Sector Norte');
  assert.equal(g.categoryLabel, 'Baches y Calzadas');
  assert.equal(g.isVerified, false);
  assert.equal(g.assignedTeam, 'Por asignar');
  assert.ok(g.coordinates.x >= 20 && g.coordinates.x <= 62);

  const worker = await call('POST', '/incidents', {
    as: WORKER, body: { title: 'Luminaria', category: 'alumbrado', address: 'Calle 2' }
  });
  const w = worker.json.data;
  assert.equal(w.id, 'CIV-8952');
  assert.equal(w.priorityLevel, 3);
  assert.equal(w.priorityLabel, 'Muy Alta (Funcionario Estado)');
  assert.equal(w.assignedTeam, 'Cuadrilla Municipal (Despacho Preferente)');
  assert.equal(w.reportedBy, WORKER.name);
  assert.equal(w.isVerified, true);
  assert.equal(w.sectorLabel, 'Centro Histórico');
});

test('cambio de estado: solo personal municipal', async () => {
  assert.equal((await call('PATCH', '/incidents/CIV-8951/status', { body: { status: 'progress' } })).status, 403);
  assert.equal((await call('PATCH', '/incidents/CIV-8951/status', { as: WORKER, body: { status: 'nope' } })).status, 400);
  assert.equal((await call('PATCH', '/incidents/CIV-1/status', { as: WORKER, body: { status: 'progress' } })).status, 404);
  const ok = await call('PATCH', '/incidents/CIV-8951/status', { as: WORKER, body: { status: 'progress' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.data.statusLabel, 'En Proceso');
  assert.equal(ok.json.data.assignedTeam, 'Cuadrilla Municipal #02 (En terreno)');
});

test('estadísticas', async () => {
  const { json } = await call('GET', '/stats');
  const s = json.data;
  assert.equal(s.total, 8);
  assert.equal(s.counts.new + s.counts.progress + s.counts.resolved, 8);
  assert.equal(s.byCategory.seguridad, 0);
  assert.equal(s.usersCount, 3);
  assert.equal(s.settings.municipality_name, 'Municipalidad de Santiago Centro');
  assert.equal(s.resolutionRate, Math.round((s.counts.resolved / 8) * 100));
});

test('login: credenciales, errores y selector demo', async () => {
  const ok = await call('POST', '/auth/login', { body: { email: 'ADMIN@civiccore.gov', password: 'admin123' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.user.role, 'admin');
  assert.equal(ok.json.user.rutDni, '10.555.333-1');
  assert.equal((await call('POST', '/auth/login', { body: { email: 'admin@civiccore.gov', password: 'x' } })).status, 401);
  assert.equal((await call('POST', '/auth/login', { body: { email: 'admin@civiccore.gov' } })).status, 400);
  const byRut = await call('POST', '/auth/login', { body: { email: '14.283.910-4', password: 'vecino123' } });
  assert.equal(byRut.json.user.email, VECINO.email);
  const demo = await call('POST', '/auth/login', { body: { role: 'vecino' } });
  assert.equal(demo.json.user.name, 'Carmen Soto');
});

test('registro de vecino', async () => {
  assert.equal((await call('POST', '/auth/register', { body: { email: 'a@b.cl', password: '123' } })).status, 400);
  const reg = await call('POST', '/auth/register', { body: { email: 'juan.perez@correo.cl', password: '1234' } });
  assert.equal(reg.status, 201);
  assert.equal(reg.json.user.name, 'Juan Perez');
  assert.equal(reg.json.user.role, 'vecino');
  assert.equal(reg.json.user.department, 'Comunidad Vecinal');
  const dup = await call('POST', '/auth/register', { body: { email: 'JUAN.PEREZ@correo.cl', password: '1234' } });
  assert.equal(dup.status, 400);
});

test('google: credencial obligatoria y token inválido', async () => {
  assert.equal((await call('POST', '/auth/google', { body: {} })).status, 400);
  assert.equal((await call('POST', '/auth/google', { body: { credential: 'a.b' } })).status, 401);
  const cfg = await call('GET', '/auth/google/config');
  assert.equal(cfg.status, 200);
  assert.equal((await call('POST', '/auth/google/config', { as: VECINO, body: { clientId: 'x' } })).status, 403);
});

test('logout responde éxito', async () => {
  assert.equal((await call('POST', '/auth/logout', { body: { user: 'Carmen Soto' } })).json.status, 'success');
});

test('administración de usuarios', async () => {
  assert.equal((await call('GET', '/admin/users', { as: VECINO })).status, 403);
  assert.equal((await call('GET', '/auth/users', { as: VECINO })).status, 403);
  const list = await call('GET', '/admin/users', { as: ADMIN });
  assert.equal(list.json.total, 4);

  assert.equal((await call('POST', '/admin/users', { as: ADMIN, body: { name: 'Sin correo' } })).status, 400);
  const created = await call('POST', '/admin/users', {
    as: ADMIN, body: { name: 'Pedro Gómez', email: 'Pedro@Muni.cl', role: 'trabajador' }
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.data.email, 'pedro@muni.cl');
  const dup = await call('POST', '/admin/users', { as: ADMIN, body: { name: 'X', email: 'pedro@muni.cl' } });
  assert.equal(dup.status, 400);
  const pedroId = created.json.data.id;

  assert.equal((await call('PATCH', `/admin/users/${ADMIN.id}/status`, { as: ADMIN, body: { status: 'suspended' } })).status, 400);
  assert.equal((await call('PATCH', `/admin/users/${pedroId}/status`, { as: ADMIN, body: { status: 'raro' } })).status, 400);
  const susp = await call('PATCH', `/admin/users/${pedroId}/status`, { as: ADMIN, body: { status: 'suspended' } });
  assert.equal(susp.json.data.status, 'suspended');
  const login = await call('POST', '/auth/login', { body: { email: 'pedro@muni.cl', password: 'civic123' } });
  assert.equal(login.status, 401);
  await call('PATCH', `/admin/users/${pedroId}/status`, { as: ADMIN, body: { status: 'active' } });

  assert.equal((await call('PATCH', `/admin/users/${pedroId}/password`, { as: ADMIN, body: { password: '12' } })).status, 400);
  const pwd = await call('PATCH', `/admin/users/${pedroId}/password`, { as: ADMIN, body: { password: 'nueva1' } });
  assert.equal(pwd.status, 200);
  assert.equal((await call('POST', '/auth/login', { body: { email: 'pedro@muni.cl', password: 'nueva1' } })).status, 200);

  const role = await call('PATCH', `/admin/users/${pedroId}/role`, { as: ADMIN, body: { role: 'vecino' } });
  assert.equal(role.json.data.role, 'vecino');
  assert.equal((await call('PATCH', `/admin/users/${pedroId}/role`, { as: ADMIN, body: { role: 'jefe' } })).status, 400);

  assert.equal((await call('DELETE', `/admin/users/${ADMIN.id}`, { as: ADMIN })).status, 400);
  assert.equal((await call('DELETE', `/admin/users/${pedroId}`, { as: ADMIN })).status, 200);
  assert.equal((await call('DELETE', `/admin/users/${pedroId}`, { as: ADMIN })).status, 400);
});

test('edición de perfil: vecino no puede cambiar su rol ni editar a otros', async () => {
  const other = await call('PATCH', `/admin/users/${WORKER.id}`, { as: VECINO, body: { name: 'Hack' } });
  assert.equal(other.status, 403);
  const self = await call('PATCH', `/admin/users/${VECINO.id}`, { as: VECINO, body: { name: 'Carmen S.', role: 'admin' } });
  assert.equal(self.status, 200);
  assert.equal(self.json.data.role, 'vecino');
  assert.equal(self.json.data.name, 'Carmen S.');

  assert.equal((await call('PATCH', '/auth/profile', { body: { name: 'x' } })).status, 403);
  const prof = await call('PATCH', '/auth/profile', { as: VECINO, body: { id: VECINO.id, name: 'Carmen Soto', email: VECINO.email } });
  assert.equal(prof.status, 200);
  assert.equal(prof.json.data.role, 'vecino');

  const taken = await call('PATCH', `/admin/users/${VECINO.id}`, { as: ADMIN, body: { email: ADMIN.email } });
  assert.equal(taken.status, 400);
});

test('cambio de contraseña propia', async () => {
  assert.equal((await call('POST', '/auth/change-password', { body: {} })).status, 403);
  const wrong = await call('POST', '/auth/change-password', {
    as: VECINO, body: { email: VECINO.email, currentPassword: 'mala', newPassword: 'nueva123' }
  });
  assert.equal(wrong.status, 400);
  const other = await call('POST', '/auth/change-password', {
    as: VECINO, body: { email: ADMIN.email, currentPassword: 'admin123', newPassword: 'nueva123' }
  });
  assert.equal(other.status, 403);
  const ok = await call('POST', '/auth/change-password', {
    as: VECINO, body: { email: VECINO.email, currentPassword: 'vecino123', newPassword: 'nueva123' }
  });
  assert.equal(ok.status, 200);
  assert.equal((await call('POST', '/auth/login', { body: { email: VECINO.email, password: 'nueva123' } })).status, 200);
});

test('moderación y borrado de incidencias', async () => {
  assert.equal((await call('PATCH', '/admin/incidents/CIV-8951/moderate', { as: WORKER, body: {} })).status, 403);
  const mod = await call('PATCH', '/admin/incidents/CIV-8951/moderate', {
    as: ADMIN, body: { priorityLevel: '4', title: 'Bache moderado', category: 'seguridad', assignedTeam: 'Equipo A' }
  });
  assert.equal(mod.status, 200);
  const m = mod.json.data;
  assert.equal(m.priorityLevel, 4);
  assert.equal(m.priorityLabel, 'Crítica (Super Admin)');
  assert.equal(m.title, 'Bache moderado');
  assert.equal(m.categoryLabel, 'Seguridad Ciudadana');
  assert.equal(m.categoryIcon, 'shield');
  assert.equal(m.moderatedBy, ADMIN.name);
  assert.equal(m.description, '');
  assert.equal((await call('PATCH', '/admin/incidents/CIV-1/moderate', { as: ADMIN, body: {} })).status, 404);

  assert.equal((await call('DELETE', '/admin/incidents/CIV-8952', { as: WORKER })).status, 403);
  assert.equal((await call('DELETE', '/admin/incidents/CIV-8952', { as: ADMIN })).status, 200);
  assert.equal((await call('GET', '/incidents/CIV-8952')).status, 404);
});

test('auditoría y parámetros', async () => {
  assert.equal((await call('GET', '/admin/audit-logs', { as: VECINO })).status, 403);
  const logs = (await call('GET', '/admin/audit-logs', { as: ADMIN })).json.data;
  const actions = logs.map(l => l.action);
  for (const a of ['LOGIN_EXITOSO', 'LOGIN_FALLIDO', 'LOGIN_DEMO', 'REGISTRO_VECINO', 'CREACION_USUARIO', 'CAMBIO_PASSWORD', 'LOGOUT']) {
    assert.ok(actions.includes(a), `falta ${a}`);
  }

  assert.equal((await call('GET', '/admin/settings', { as: VECINO })).status, 403);
  assert.equal((await call('POST', '/admin/settings', { as: ADMIN, body: { key: 'sla_hours' } })).status, 400);
  const upd = await call('POST', '/admin/settings', { as: ADMIN, body: { key: 'sla_hours', value: '48' } });
  assert.equal(upd.json.data.sla_hours, '48');
  assert.equal((await call('GET', '/admin/settings', { as: ADMIN })).json.data.sla_hours, '48');

  const cleared = await call('DELETE', '/admin/audit-logs', { as: ADMIN });
  assert.equal(cleared.status, 200);
  const after = (await call('GET', '/admin/audit-logs', { as: ADMIN })).json.data;
  assert.deepEqual(after.map(l => l.action), ['LIMPIEZA_LOGS']);
});

test('copias de seguridad en la carpeta de la base temporal', async () => {
  assert.equal((await call('GET', '/admin/backups', { as: VECINO })).status, 403);
  const created = await call('POST', '/admin/backups', { as: ADMIN });
  assert.equal(created.status, 201);
  assert.ok(fs.existsSync(path.join(tmp, 'backups', created.json.data.fileName)));
  const list = await call('GET', '/admin/backups', { as: ADMIN });
  assert.equal(list.json.total, 1);
  const missing = await call('POST', '/admin/backups/restore', { as: ADMIN, body: { fileName: 'no-existe.db' } });
  assert.equal(missing.status, 400);
});

test('diagnóstico y rutas inexistentes', async () => {
  assert.equal((await call('GET', '/status')).json.status, 'online');
  assert.equal((await call('GET', '/info')).json.roles.length, 4);
  const res = await fetch(base + '/no-existe', { headers: { Accept: 'application/json' } });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).statusCode, 404);
});

test('seguridad: contraseñas encriptadas con hash scrypt y bloqueo de falsificación de sesión', async () => {
  const { db } = require('../src/database/connection');
  const { isPasswordHashed } = require('../src/database/users');

  // 1. Ninguna contraseña en la tabla users debe estar en texto plano
  const rows = db.prepare('SELECT email, password FROM users').all();
  assert.ok(rows.length >= 3);
  for (const r of rows) {
    assert.ok(isPasswordHashed(r.password), `La contraseña de ${r.email} no está hasheada con scrypt`);
    assert.ok(!r.password.includes('admin123') && !r.password.includes('vecino123'));
  }

  // 2. El login entrega un sessionToken firmado con HMAC-SHA256
  const login = await call('POST', '/auth/login', { body: { email: ADMIN.email, password: 'admin123' } });
  assert.equal(login.status, 200);
  assert.ok(login.json.user.sessionToken && login.json.user.sessionToken.includes('.'));

  // 3. Un token alterado es rechazado (403 en ruta de admin)
  const tamperedRes = await fetch(base + '/admin/users', {
    headers: {
      'Content-Type': 'application/json',
      'x-session-token': login.json.user.sessionToken + 'tampered',
      'x-user-role': 'admin'
    }
  });
  assert.equal(tamperedRes.status, 403);

  // 4. Un vecino no puede escalar a admin falsificando la cabecera x-user-role
  const spoofedRes = await fetch(base + '/admin/users', {
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': String(VECINO.id),
      'x-user-email': VECINO.email,
      'x-user-role': 'admin'
    }
  });
  assert.equal(spoofedRes.status, 403);
});
