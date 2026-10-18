const path = require('path');
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',
  publicDir: path.join(__dirname, '..', '..', 'public'),
  appName: process.env.APP_NAME || 'Servidor Web - Tarea Santamaria',
  startTime: new Date()
};
