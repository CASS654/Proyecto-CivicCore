// Utilidades de interfaz compartidas: escape de HTML, avisos, sonido y título del municipio.

import { systemPrefs } from './state.js';

const dom = {
  toastContainer: document.getElementById('toast-container')
};

// shortcut: protege texto y atributos HTML, pero NO dentro de JS en onclick="...('${id}')", porque el navegador
// decodifica &#39; antes de ejecutarlo; hoy solo se usa ahí con ids CIV-#### del servidor. Pasar a data-id + addEventListener si cambian.
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applyMunicipalitySettings(settings) {
  if (!settings) return;
  if (settings.municipality_name) {
    document.title = `CivicCore | ${settings.municipality_name}`;
  }
}

function playAlertTone(type = 'info', force = false) {
  if (!force && !systemPrefs.soundAlerts) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = type === 'error' ? 320 : (type === 'success' ? 660 : 520);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.17);
  } catch (e) {}
}

// ==========================================
// Toasts / Notificaciones Flotantes
// ==========================================
function showToast(message, type = 'info') {
  playAlertTone(type);
  if (systemPrefs.showToasts === false) return;

  const toast = document.createElement('div');
  const colors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-primary text-on-primary'
  };

  toast.className = `px-4 py-3 rounded-2xl shadow-xl font-medium text-xs flex items-center gap-2.5 transform transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto border border-white/20 ${colors[type] || colors.info}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-[18px]">${type === 'success' ? 'check_circle' : (type === 'error' ? 'error' : 'info')}</span>
    <span>${escapeHtml(message)}</span>
  `;

  dom.toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

export { escapeHtml, applyMunicipalitySettings, playAlertTone, showToast };
