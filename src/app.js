const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// Confianza en proxies (esencial cuando las peticiones vienen a través del túnel Cloudflare)
app.set('trust proxy', true);

// Registro de peticiones HTTP en consola para ver en vivo cada visita desde Internet
app.use(morgan(':date[iso] :remote-addr :method :url :status - :response-time ms'));

// Middleware de seguridad y parseo de datos
app.use(cors());
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
