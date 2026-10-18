// Elementos del DOM
const statusIndicator = document.getElementById('status-indicator');
const serverStatusText = document.getElementById('server-status-text');
const uptimeText = document.getElementById('uptime-text');
const latencyText = document.getElementById('latency-text');
const btnRefresh = document.getElementById('btn-refresh');

const specPort = document.getElementById('spec-port');
const specEnv = document.getElementById('spec-env');
const specNode = document.getElementById('spec-node');
const specMem = document.getElementById('spec-mem');

const clientIp = document.getElementById('client-ip');
const clientNetType = document.getElementById('client-net-type');
const clientBrowser = document.getElementById('client-browser');

const btnTestPing = document.getElementById('btn-test-ping');
const pingResponseBox = document.getElementById('ping-response-box');

const echoForm = document.getElementById('echo-form');
const inputAuthor = document.getElementById('input-author');
const inputMessage = document.getElementById('input-message');
const btnSendMessage = document.getElementById('btn-send-message');
const echoResponseBox = document.getElementById('echo-response-box');

/**
 * Función principal para obtener estado del servidor
 */
async function fetchServerStatus() {
  const startTime = performance.now();

  try {
    const res = await fetch('/api/status', { cache: 'no-store' });
    const latency = Math.round(performance.now() - startTime);

    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

    const data = await res.json();

    // Actualizar barra de estado
    statusIndicator.className = 'status-indicator online';
    serverStatusText.textContent = 'En Línea (Activo)';
    uptimeText.textContent = data.uptime.formatted;
    latencyText.textContent = `${latency} ms`;

    // Actualizar métricas técnicas
    specNode.textContent = data.system.nodeVersion;
    specMem.textContent = `${data.system.memoryUsedMB} MB`;
    specEnv.textContent = data.environment;

    // Actualizar datos del cliente visitante
    const ip = data.client.ip || 'Desconocida';
    clientIp.textContent = ip;

    // Detectar si la visita es local o externa
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      clientNetType.textContent = 'Red Local (LAN / Loopback)';
    } else {
      clientNetType.textContent = 'Internet Pública (Cloudflare Edge)';
    }

    // Navegador simplificado
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) clientBrowser.textContent = 'Android';
    else if (/iphone|ipad/i.test(ua)) clientBrowser.textContent = 'iOS';
    else if (/windows/i.test(ua)) clientBrowser.textContent = 'Windows';
    else if (/mac/i.test(ua)) clientBrowser.textContent = 'macOS';
    else clientBrowser.textContent = 'Navegador Web';

    return data;
  } catch (err) {
    statusIndicator.className = 'status-indicator offline';
    serverStatusText.textContent = 'Desconectado / Error';
    uptimeText.textContent = '--';
    latencyText.textContent = 'Error';
    console.error('Error al conectar con el servidor:', err);
  }
}

/**
 * Prueba de Ping Interactiva
 */
btnTestPing.addEventListener('click', async () => {
  btnTestPing.disabled = true;
  btnTestPing.textContent = '⏳ Ejecutando petición...';
  pingResponseBox.innerHTML = '<span class="placeholder-text">Consultando /api/status...</span>';

  const t0 = performance.now();
  try {
    const res = await fetch('/api/status', { cache: 'no-store' });
    const ms = Math.round(performance.now() - t0);
    const data = await res.json();

    pingResponseBox.innerHTML = `<pre><code>// Respuesta HTTP 200 (${ms} ms)\n${JSON.stringify(data, null, 2)}</code></pre>`;
  } catch (err) {
    pingResponseBox.innerHTML = `<pre style="color: #f87171;"><code>Error al consultar la API: ${err.message}</code></pre>`;
  } finally {
    btnTestPing.disabled = false;
    btnTestPing.textContent = 'Ejecutar Ping a /api/status';
  }
});

/**
 * Formulario de Envío de Mensaje (POST)
 */
echoForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const author = inputAuthor.value.trim();
  const message = inputMessage.value.trim();

  if (!author || !message) return;

  btnSendMessage.disabled = true;
  btnSendMessage.textContent = '⏳ Enviando al servidor...';

  try {
    const res = await fetch('/api/echo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        author,
        message,
        clientTimestamp: new Date().toISOString()
      })
    });

    const data = await res.json();
    echoResponseBox.innerHTML = `<pre><code>// Respuesta del Servidor (HTTP ${res.status}):\n${JSON.stringify(data, null, 2)}</code></pre>`;
    inputMessage.value = '';
  } catch (err) {
    echoResponseBox.innerHTML = `<pre style="color: #f87171;"><code>Error al enviar: ${err.message}</code></pre>`;
  } finally {
    btnSendMessage.disabled = false;
    btnSendMessage.textContent = 'Enviar al Servidor (POST /api/echo)';
  }
});

// Botón refrescar
btnRefresh.addEventListener('click', () => {
  fetchServerStatus();
});

// Carga inicial y actualización periódica cada 10 segundos
fetchServerStatus();
setInterval(fetchServerStatus, 10000);
