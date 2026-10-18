/**
 * Middleware para rutas no encontradas (404)
 */
function notFoundHandler(req, res, next) {
  if (req.accepts('html')) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>404 - No Encontrado</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
          .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; border: 1px solid #334155; max-width: 450px; }
          h1 { color: #f43f5e; margin: 0 0 1rem; font-size: 3rem; }
          p { color: #94a3b8; margin-bottom: 1.5rem; }
          a { color: #38bdf8; text-decoration: none; font-weight: bold; padding: 0.5rem 1rem; border: 1px solid #38bdf8; border-radius: 0.5rem; display: inline-block; }
          a:hover { background: #38bdf8; color: #0f172a; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>404</h1>
          <p>La ruta <code>${req.originalUrl}</code> no existe en este servidor.</p>
          <a href="/">Volver al Inicio</a>
        </div>
      </body>
      </html>
    `);
  }

  return res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
}

/**
 * Middleware para manejo global de errores (500)
 */
function errorHandler(err, req, res, next) {
  console.error('[Error]', err);

  const statusCode = err.status || 500;
  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message: err.message || 'Error interno del servidor',
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
