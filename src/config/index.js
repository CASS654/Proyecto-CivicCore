const path = require('path');
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',
  publicDir: path.join(__dirname, '..', '..', 'public'),
  // Las pruebas apuntan DB_PATH a una base temporal para no tocar los datos reales
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'civiccore.db'),
  appName: process.env.APP_NAME || 'Servidor Web - Tarea Santamaria'};
