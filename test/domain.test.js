const { test } = require('node:test');
const assert = require('node:assert/strict');
const d = require('../src/domain');

test('la prioridad depende solo del rol', () => {
  assert.equal(d.calculatePriority('admin').level, 4);
  assert.equal(d.calculatePriority('vecino').level, 2);
  assert.equal(d.calculatePriority('desconocido').level, 1);
  assert.equal(d.calculatePriority(undefined).label, 'Normal (Invitado)');
  assert.deepEqual(d.PRIORITY_LABEL_BY_LEVEL, {
    1: 'Normal (Invitado)', 2: 'Alta (Vecino Verificado)', 3: 'Muy Alta (Funcionario Estado)', 4: 'Crítica (Super Admin)'
  });
});

test('siguiente folio: mayor CIV-#### + 1, nunca bajo la base', () => {
  assert.equal(d.nextFolioNumber([]), d.FOLIO_BASE + 1);
  assert.equal(d.nextFolioNumber(['CIV-10', 'civ-9000', null, 'X-9999']), 9001);
});

test('variantes de id para buscar por folio escrito a mano', () => {
  assert.deepEqual(d.incidentIdVariants('#civ-8942'), { clean: 'civ-8942', withPrefix: 'CIV-8942', folio: '#CIV-8942' });
  assert.equal(d.incidentIdVariants(' 8942 ').withPrefix, 'CIV-8942');
});

test('etiquetas, cuadrillas y verificación', () => {
  assert.equal(d.urgencyLabel('high'), 'Urgente');
  assert.equal(d.urgencyLabel(undefined), 'Normal');
  assert.equal(d.channelLabel('inspection'), 'Inspección en Terreno');
  assert.equal(d.isVerifiedRole('invitado'), false);
  assert.equal(d.teamForStatus('new', 'Equipo A'), 'Equipo A');
  assert.equal(d.teamForStatus('resolved', 'Equipo A'), 'Completado por Cuadrilla Municipal');
});

test('coordenadas dentro del rango del sector', () => {
  for (let i = 0; i < 50; i++) {
    const { x, y } = d.generateSectorCoordinates('oriente');
    assert.ok(x >= 66 && x <= 88 && y >= 20 && y <= 75);
  }
});

test('nombre desde el correo y tiempo transcurrido', () => {
  assert.equal(d.nameFromEmail('juan.perez_soto'), 'Juan Perez Soto');
  assert.equal(d.timeAgo(new Date().toISOString()), 'Hace unos momentos');
  assert.equal(d.timeAgo(new Date(Date.now() - 3 * 3600e3).toISOString()), 'Hace 3h');
});

test('JWT de Google: rechaza formato, emisor, expiración y correo no verificado', () => {
  const jwt = payload => `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.firma`;
  const ok = { iss: 'accounts.google.com', email: 'a@b.cl', exp: Date.now() / 1000 + 60 };
  assert.equal(d.decodeGoogleJwt(jwt(ok)).email, 'a@b.cl');
  assert.equal(d.decodeGoogleJwt('a.b'), null);
  assert.equal(d.decodeGoogleJwt(jwt({ ...ok, iss: 'evil.com' })), null);
  assert.equal(d.decodeGoogleJwt(jwt({ ...ok, exp: 1 })), null);
  assert.equal(d.decodeGoogleJwt(jwt({ ...ok, email_verified: false })), null);
});
