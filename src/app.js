const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const { seedDatabase } = require('./database/seed');

// Abre la base (esquema + migraciones) y siembra datos iniciales si está vacía
seedDatabase();

const app = express();

// Confianza en proxies (esencial cuando las peticiones vienen a través del túnel Cloudflare)
app.set('trust proxy', true);

// Registro de peticiones HTTP en consola para ver en vivo cada visita desde Internet
app.use(morgan(':date[iso] :remote-addr :method :url :status - :response-time ms'));

// Middleware de seguridad y parseo de datos
app.use(cors());
// shortcut: el frontend acepta fotos de hasta 12 MB, que en base64 pesan ~16 MB y superan este límite;
// subir el límite a 17mb o bajar el máximo del frontend a 11 MB si aparecen errores 413
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Servir archivos estáticos del frontend desde la carpeta public/
app.use(express.static(config.publicDir));

// Rutas de la aplicación (incluye /api)
app.use(routes);

// Manejadores de errores
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
