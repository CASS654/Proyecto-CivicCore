// view-vecino: portal vecinal y rastreo de folios.

import { findIncidentByFolio } from '../data.js';
import { normalizeFolio } from '../logic.js';
import { state } from '../state.js';
import { escapeHtml, showToast } from '../ui.js';
import { openIncidentModal } from './incidencias.js';

const dom = {
  portalVecinoGreeting: document.getElementById('portal-vecino-greeting'),
  vecinoIncidentsGrid: document.getElementById('vecino-incidents-grid'),
  btnViewTrackedDetail: document.getElementById('btn-view-tracked-detail'),
  trackerResFolio: document.getElementById('tracker-res-folio'),
  trackerResStatus: document.getElementById('tracker-res-status'),
  trackerResPriority: document.getElementById('tracker-res-priority'),
  trackerResTitle: document.getElementById('tracker-res-title'),
  trackerResAddress: document.getElementById('tracker-res-address'),
  vecinoReportCount: document.getElementById('vecino-report-count'),
  folioInput: document.getElementById('folio-input'),
  folioResultBox: document.getElementById('folio-result-box'),
  folioTrackerForm: document.getElementById('folio-tracker-form')
};

// ==========================================
// Nivel 2: Portal Vecinal Ciudadano
// ==========================================
function renderVecinoPortal() {
  if (dom.portalVecinoGreeting) {
    dom.portalVecinoGreeting.textContent = `¡Hola, ${state.currentUser.name}!`;
  }

  const grid = dom.vecinoIncidentsGrid;
  if (!grid) return;

  // Inicializar el botón "Ver Expediente Completo" en la tarjeta por defecto (#CIV-8942 o el primero disponible)
  if (dom.btnViewTrackedDetail && !dom.btnViewTrackedDetail.onclick && state.incidents.length > 0) {
    const defaultTracked = state.incidents.find(i => i.id === 'CIV-8942') || state.incidents[0];
    if (defaultTracked) fillTrackerCard(defaultTracked);
  }

  // Filtrar reportes recientes
  const recent = state.incidents.slice(0, 6);
  if (dom.vecinoReportCount) dom.vecinoReportCount.textContent = `${state.incidents.length} reportes en la comuna`;

  grid.innerHTML = recent.map(inc => `
    <div class="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/20 flex flex-col justify-between gap-3">
      <div>
        <div class="flex items-center justify-between text-xs mb-1.5">
          <span class="font-mono font-bold text-primary">${escapeHtml(inc.folio)}</span>
          <span class="px-2 py-0.5 rounded-full ${inc.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-primary-fixed text-primary'} font-bold text-[10px]">
            ${escapeHtml(inc.statusLabel)}
          </span>
        </div>
        <h4 class="font-bold text-sm text-on-surface line-clamp-2">${escapeHtml(inc.title)}</h4>
        <p class="text-xs text-outline flex items-center gap-1 mt-1 truncate">
          <span class="material-symbols-outlined text-[14px] text-primary shrink-0">pin_drop</span>
          <span class="truncate">${escapeHtml(inc.address)}</span>
        </p>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-outline-variant/10 text-xs">
        <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px]">
          ${escapeHtml(inc.priorityLabel || 'Alta (Vecino)')}
        </span>
        <button onclick="window.civicApp.trackFolioNumber('${escapeHtml(inc.id)}')" class="text-primary font-bold hover:underline flex items-center gap-0.5 text-xs">
          <span>Rastrear</span>
          <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
        </button>
      </div>
    </div>
  `).join('');
}

async function handleFolioTracking(folioInput) {
  const raw = (folioInput || (dom.folioInput ? dom.folioInput.value : '') || '').trim();
  if (!raw) {
    showToast('Ingresa un número de folio para rastrear', 'info');
    return;
  }

  const clean = normalizeFolio(raw);
  const found = await findIncidentByFolio(clean);

  if (!found) {
    showToast(`No se encontró reporte con folio #${clean}`, 'error');
    return;
  }

  if (folioInput && dom.folioInput) {
    dom.folioInput.value = found.folio || `#${found.id}`;
  }

  fillTrackerCard(found);
  if (dom.folioResultBox) {
    dom.folioResultBox.classList.remove('hidden');
    dom.folioResultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  showToast(`Folio ${found.folio} localizado exitosamente`, 'success');
}

// Tarjeta del rastreador: datos del reporte y botón "Ver Expediente Completo"
function fillTrackerCard(inc) {
  if (dom.trackerResFolio) dom.trackerResFolio.textContent = inc.folio;
  if (dom.trackerResStatus) dom.trackerResStatus.textContent = inc.statusLabel;
  if (dom.trackerResPriority) dom.trackerResPriority.textContent = inc.priorityLabel || 'Prioridad Normal';
  if (dom.trackerResTitle) dom.trackerResTitle.textContent = inc.title;
  if (dom.trackerResAddress) {
    dom.trackerResAddress.innerHTML = `<span class="material-symbols-outlined text-[14px] shrink-0">pin_drop</span> <span class="truncate">${escapeHtml(inc.address)} • Cuadrilla: ${escapeHtml(inc.assignedTeam || 'En despacho')}</span>`;
  }
  if (dom.btnViewTrackedDetail) dom.btnViewTrackedDetail.onclick = () => openIncidentModal(inc.id);
}

function init() {
  // Rastreo de Folio en Portal Vecinal
  if (dom.folioTrackerForm) {
    dom.folioTrackerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleFolioTracking();
    });
  }
}

export { renderVecinoPortal, handleFolioTracking, init };
