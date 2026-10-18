const os = require('os');
const app = require('./app');
const config = require('./config');

/**
 * Obtener las direcciones IP locales de la máquina
 */
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Filtrar sólo IPv4 no internas (no 127.0.0.1)
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ interface: name, address: net.address });
      }
    }
  }
  return addresses;
}

// Iniciar la escucha en el puerto y host configurados
const server = app.listen(config.port, config.host, () => {
  const isCloudOrProd = process.env.RENDER || config.env === 'production';

  if (isCloudOrProd) {
    console.log(`[✓] CivicCore activo en puerto ${config.port} | Modo: ${config.env} | Node: ${process.version}`);
    return;
  }

  const localIps = getLocalIpAddresses();

  console.log('\n' + '='.repeat(62));
  console.log(` 🚀  ${config.appName.toUpperCase()}`);
  console.log('='.repeat(62));
  console.log(` [✓] Estado:        Servidor activo y escuchando peticiones`);
  console.log(` [✓] Entorno:       ${config.env}`);
  console.log(` [✓] Puerto:        ${config.port}`);
  console.log(` [✓] Node.js:       ${process.version}`);
  console.log('-'.repeat(62));
  console.log(` 🌐 Acceso Local:`);
  console.log(`     > http://localhost:${config.port}`);
  console.log(`     > http://127.0.0.1:${config.port}`);

  if (localIps.length > 0) {
    console.log(`\n 📶 Acceso en tu misma Red WiFi / LAN:`);
    localIps.forEach(({ interface: iface, address }) => {
      console.log(`     > http://${address}:${config.port} (${iface})`);
    });
  }
  console.log('='.repeat(62) + '\n');
});

// Manejo robusto de errores al iniciar el servidor
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n' + '!'.repeat(62));
    console.error(` [ERROR] El puerto ${config.port} ya está en uso.`);
    console.error('!'.repeat(62));
    console.error(` Ya existe otro proceso escuchando en el puerto ${config.port}.`);
    console.error(` Soluciones:`);
    console.error(`   1. Cierra la otra ventana o proceso que esté usando el puerto ${config.port}.`);
    console.error(`   2. O cambia el puerto en el archivo .env (ejemplo: PORT=3001).`);
    console.error('!'.repeat(62) + '\n');
  } else {
    console.error('\n[ERROR] Ocurrió un error en el servidor:', err.message);
  }
  process.exit(1);
});

// Cierre elegante (Graceful Shutdown)
function shutdown(signal) {
  console.log(`\n[${signal}] Apagando el servidor de forma segura...`);
  server.close(() => {
    console.log('[✓] Servidor detenido correctamente y puerto liberado. ¡Hasta luego!');
    process.exit(0);
  });

  // Forzar apagado si tarda más de 5 segundos
  setTimeout(() => {
    console.error('[!] Tiempo de espera agotado. Forzando cierre.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = server;
