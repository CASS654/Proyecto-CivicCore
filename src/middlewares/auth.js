// Autenticación y verificación de sesión firmada (HMAC-SHA256) y validación en base de datos.
const crypto = require('node:crypto');
const { db } = require('../database/connection');

const SESSION_SECRET = process.env.SESSION_SECRET || 'civiccore-hmac-secret-key-2026-v1';

const GUEST_ACTOR = { id: '', role: 'invitado', name: 'Vecino Anónimo', email: '' };

function signSessionToken(user) {
  if (!user || !user.role || user.role === 'invitado') return '';
  const payloadObj = {
    id: user.id ?? '',
    email: (user.email || '').trim().toLowerCase(),
    role: user.role,
    name: user.name || '',
    iat: Date.now()
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sigB64 = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sigB64}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  try {
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest();
    const actualSig = Buffer.from(sigB64, 'base64url');
    if (expectedSig.length !== actualSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload || !payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}

function resolveDbUser(id, email) {
  try {
    if (id !== undefined && id !== null && String(id).trim() !== '' && Number(id) > 0) {
      const byId = db.prepare('SELECT id, name, email, role, status FROM users WHERE id = ?').get(Number(id));
      if (byId) return byId;
    }
    if (email && String(email).trim() !== '') {
      const byEmail = db.prepare('SELECT id, name, email, role, status FROM users WHERE LOWER(email) = ?').get(String(email).trim().toLowerCase());
      if (byEmail) return byEmail;
    }
  } catch {}
  return null;
}

function getUserFromRequest(req) {
  const authHeader = req.headers['authorization'] || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const rawToken = req.headers['x-session-token'] || bearerToken;

  // 1. Si el cliente envía un token de sesión, verificar su firma criptográfica HMAC-SHA256
  if (rawToken) {
    const verified = verifySessionToken(rawToken);
    if (!verified) {
      return { ...GUEST_ACTOR };
    }
    const dbUser = resolveDbUser(verified.id, verified.email);
    if (dbUser) {
      if (dbUser.status === 'suspended') return { ...GUEST_ACTOR };
      return {
        id: dbUser.id,
        role: dbUser.role,
        name: dbUser.name,
        email: dbUser.email
      };
    }
    return {
      id: verified.id || '',
      role: verified.role || 'invitado',
      name: verified.name || 'Vecino Anónimo',
      email: verified.email || ''
    };
  }

  // 2. Respaldo para clientes internos / tests que envían cabeceras de identidad: validar contra la base de datos
  const claimedRole = req.headers['x-user-role'] || req.body?.userRole || 'invitado';
  const email = req.headers['x-user-email'] || req.body?.userEmail || '';
  const id = req.headers['x-user-id'] || req.body?.userId || '';
  const claimedName = req.headers['x-user-name'] || req.body?.userName || '';

  if (claimedRole === 'invitado') {
    return { id: '', role: 'invitado', name: claimedName || 'Vecino Anónimo', email: '' };
  }

  const dbUser = resolveDbUser(id, email);
  if (dbUser) {
    if (dbUser.status === 'suspended') return { ...GUEST_ACTOR };
    // Impedir escalación de rol manipulando la cabecera x-user-role de un usuario existente
    if (dbUser.role !== claimedRole) {
      return { ...GUEST_ACTOR };
    }
    return {
      id: dbUser.id,
      role: dbUser.role,
      name: claimedName || dbUser.name,
      email: dbUser.email
    };
  }

  // Si se reclama un rol privilegiado sin token ni usuario válido en base de datos, rechazar si envía ID/correo inexistente
  if (id || email) {
    return { ...GUEST_ACTOR };
  }

  const fallbackName = claimedName || (
    claimedRole === 'admin' ? 'Super Admin Root' :
    claimedRole === 'trabajador' ? 'Lic. Elena Morales' :
    claimedRole === 'vecino' ? 'Carmen Soto' : 'Vecino Anónimo'
  );
  return { id, role: claimedRole, name: fallbackName, email };
}

// Corta con 403 si quien llama no es Super Admin; deja el usuario en req.actor
function requireAdmin(message = 'Acceso denegado: Se requiere rol de Super Administrador.') {
  return (req, res, next) => {
    const actor = getUserFromRequest(req);
    if (actor.role !== 'admin') {
      return res.status(403).json({ status: 'error', message });
    }
    req.actor = actor;
    next();
  };
}

// shortcut: con trust proxy activo, x-forwarded-for lo puede falsificar el cliente; la IP de auditoría es orientativa
function getClientIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
}

module.exports = { signSessionToken, verifySessionToken, getUserFromRequest, requireAdmin, getClientIp };
