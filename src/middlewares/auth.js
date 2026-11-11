// shortcut: el usuario sale de cabeceras que envía el navegador, así que cualquiera puede declararse admin.
// Mejorar con sesiones firmadas (cookie o JWT emitido por el servidor) antes de exponerlo en producción.
function getUserFromRequest(req) {
  const role = req.headers['x-user-role'] || req.body?.userRole || 'invitado';
  const email = req.headers['x-user-email'] || req.body?.userEmail || '';
  const id = req.headers['x-user-id'] || req.body?.userId || '';
  const name = req.headers['x-user-name'] || req.body?.userName || (
    role === 'admin' ? 'Super Admin Root' :
    role === 'trabajador' ? 'Lic. Elena Morales' :
    role === 'vecino' ? 'Carmen Soto' : 'Vecino Anónimo'
  );
  return { id, role, name, email };
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

module.exports = { getUserFromRequest, requireAdmin, getClientIp };
