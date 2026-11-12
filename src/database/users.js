// Consultas de usuarios, autenticación y registro.
const crypto = require('node:crypto');
const { db } = require('./connection');
const { addSystemAuditLog } = require('./system');
const { nameFromEmail } = require('../domain');

const HASH_PREFIX = 'scrypt$';
const KEY_LEN = 64;

function isPasswordHashed(stored) {
  return typeof stored === 'string' && stored.startsWith(HASH_PREFIX);
}

function hashPassword(plain) {
  const raw = String(plain ?? '');
  if (isPasswordHashed(raw)) return raw;
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(raw, salt, KEY_LEN).toString('hex');
  return `${HASH_PREFIX}${salt}$${derived}`;
}

function verifyPassword(plain, stored) {
  if (!plain || !stored) return false;
  const candidate = String(plain);
  if (isPasswordHashed(stored)) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const [, salt, hashHex] = parts;
    try {
      const expected = Buffer.from(hashHex, 'hex');
      const actual = crypto.scryptSync(candidate, salt, expected.length);
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }
  // Compatibilidad con contraseñas en texto plano previas a la migración
  return stored === candidate;
}

function migratePlaintextPasswords() {
  try {
    const rows = db.prepare('SELECT id, password FROM users').all();
    const updateStmt = db.prepare('UPDATE users SET password = ? WHERE id = ?');
    for (const row of rows) {
      if (row.password && !isPasswordHashed(row.password)) {
        updateStmt.run(hashPassword(row.password), row.id);
      }
    }
  } catch (err) {
    console.error('[Base de Datos] Error al migrar contraseñas a hash scrypt:', err.message);
  }
}

function authenticateUser(identifier, password) {
  if (!identifier || !password) return null;
  const clean = identifier.trim().toLowerCase();
  const user = db.prepare(`
    SELECT * FROM users
    WHERE (LOWER(email) = ? OR LOWER(rut_dni) = ?) AND status = 'active'
  `).get(clean, clean);
  if (!user) return null;
  if (!verifyPassword(password, user.password)) return null;

  // Si la contraseña aún estaba en texto plano, actualizarla a hash automáticamente
  if (!isPasswordHashed(user.password)) {
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(password), user.id);
  }

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
    hashPassword(userData.password || 'civic123'),
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

function updateUserPassword(idOrEmail, newPassword, actor, currentPassword = null) {
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

  if (currentPassword !== null && currentPassword !== undefined) {
    if (!verifyPassword(currentPassword.toString().trim(), user.password)) {
      throw new Error('La contraseña actual ingresada es incorrecta.');
    }
  }

  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(newPassword.toString().trim()), user.id);

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

function updateUserProfile(id, profileData, adminActor) {
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
    name = nameFromEmail(cleanEmail.split('@')[0]);
  }

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO users (name, email, password, role, rut_dni, department, status, created_at)
    VALUES (?, ?, ?, 'vecino', ?, ?, 'active', ?)
  `);

  const result = stmt.run(
    name.trim(),
    cleanEmail,
    hashPassword(password.trim()),
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
    if (user.role === 'admin') {
      throw new Error('Las cuentas de Super Administrador requieren autenticación directa con contraseña.');
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

  const randomPwd = hashPassword('google_' + crypto.randomBytes(12).toString('hex'));
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

function deleteUser(id, adminActor) {
  const numId = Number(id);
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(numId);
  if (!user) {
    throw new Error('Usuario no encontrado.');
  }
  if (user.role === 'admin') {
    throw new Error('No es posible eliminar al Administrador Principal del Sistema.');
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(numId);
  addSystemAuditLog('ELIMINAR_USUARIO', adminActor.name || 'Control App', adminActor.role || 'admin', `Usuario ${user.name} (${user.email}) eliminado`, '127.0.0.1');
  return true;
}

function updateUserRole(id, newRole, adminActor) {
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

module.exports = {
  hashPassword,
  verifyPassword,
  isPasswordHashed,
  migratePlaintextPasswords,
  authenticateUser,
  getAllUsers,
  createUser,
  toggleUserStatus,
  updateUserPassword,
  updateUserProfile,
  registerVecino,
  authenticateGoogleUser,
  deleteUser,
  updateUserRole
};
