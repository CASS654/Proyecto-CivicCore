// view-incidencias: bandeja con filtros, modal de detalle y cambio de estado.

import { loadIncidents, userHeaders } from '../data.js';
import { countByStatus, filterIncidents } from '../logic.js';
import { state } from '../state.js';
import { escapeHtml, showToast } from '../ui.js';

const dom = {
  incidentsContainer: document.getElementById('incidents-container'),
  tabCountAll: document.getElementById('tab-count-all'),
  tabCountNew: document.getElementById('tab-count-new'),
  tabCountProgress: document.getElementById('tab-count-progress'),
  tabCountResolved: document.getElementById('tab-count-resolved'),
  modalFolio: document.getElementById('modal-folio'),
  modalTitle: document.getElementById('modal-title'),
  modalAddress: document.getElementById('modal-address'),
  modalDesc: document.getElementById('modal-desc'),
  modalReportedBy: document.getElementById('modal-reportedBy'),
  modalChannel: document.getElementById('modal-channel'),
  modalStatusBadge: document.getElementById('modal-status-badge'),
  modalCategory: document.getElementById('modal-category'),
  modalUrgency: document.getElementById('modal-urgency'),
  modalAssignedTeam: document.getElementById('modal-assignedTeam'),
  modalPriorityBadge: document.getElementById('modal-priority-badge'),
  modalImg: document.getElementById('modal-img'),
  btnChangeStatus: document.querySelectorAll('.btn-change-status'),
  modalStatusActionsContainer: document.getElementById('modal-status-actions-container'),
  modalIncident: document.getElementById('modal-incident-detail'),
  statusTabs: document.querySelectorAll('.tab-status'),
  inputSearch: document.getElementById('input-search'),
  btnClearSearch: document.getElementById('btn-clear-search'),
  selectFilterCategory: document.getElementById('select-filter-category'),
  btnCloseModal: document.getElementById('btn-close-modal')
};

// ==========================================
// Nivel 3: Renderizado de Bandeja de Incidencias con Prioridades
// ==========================================
function renderIncidentsList() {
  const container = dom.incidentsContainer;
  if (!container) return;

  const filtered = filterIncidents(state.incidents, {
    status: state.filterStatus,
    category: state.filterCategory,
    query: state.searchQuery
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-surface-container-lowest rounded-2xl p-8 sm:p-12 text-center border border-outline-variant/20 shadow-sm">
        <span class="material-symbols-outlined text-5xl text-outline mb-3">search_off</span>
        <h3 class="text-base font-bold text-on-surface">No se encontraron reportes con los filtros seleccionados</h3>
        <p class="text-xs text-outline mt-1 max-w-sm mx-auto">Prueba cambiando el estado operativo o la categoría.</p>
      </div>
    `;
    return;
  }

  // Badges de Estado
  const statusBadges = {
    new: '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary text-[11px] font-bold shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>Nueva</span>',
    progress: '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-secondary text-[11px] font-bold shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>En Terreno</span>',
    resolved: '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-tertiary text-[11px] font-bold shrink-0"><span class="material-symbols-outlined text-[13px]">check</span>Resuelta</span>'
  };

  // Badges de Prioridad (Funcionario > Vecino > Invitado)
  function getPriorityBadge(level) {
    if (level >= 4) {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-wide shadow-sm"><span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>P4 • Crítica</span>`;
    }
    if (level === 3) {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wide"><span class="material-symbols-outlined text-[11px]">bolt</span>P3 • Muy Alta</span>`;
    }
    if (level === 2) {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wide"><span class="material-symbols-outlined text-[11px]">verified</span>P2 • Alta (Vecino)</span>`;
    }
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">P1 • Normal</span>`;
  }

  container.innerHTML = filtered.map(incident => `
    <article class="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md border border-outline-variant/20 transition-all flex flex-col justify-between gap-3.5">
      
      <div>
        <!-- Cabecera de Prioridad y Folio -->
        <div class="flex flex-wrap items-center justify-between gap-1.5 mb-2">
          <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span class="font-mono text-xs font-bold text-primary">${escapeHtml(incident.folio)}</span>
            ${getPriorityBadge(incident.priorityLevel)}
          </div>
          ${statusBadges[incident.status] || ''}
        </div>

        <!-- Título y Miniatura -->
        <div class="flex gap-3 items-start mt-1">
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-bold text-on-surface leading-snug line-clamp-2">${escapeHtml(incident.title)}</h3>
            <p class="text-xs text-outline flex items-center gap-1 mt-1 truncate">
              <span class="material-symbols-outlined text-[14px] shrink-0 text-primary">pin_drop</span>
              <span class="truncate">${escapeHtml(incident.address)}</span>
            </p>
          </div>
          ${incident.image ? `
            <div class="w-14 h-14 rounded-xl overflow-hidden bg-surface-container shrink-0 shadow-sm">
              <img src="${escapeHtml(incident.image)}" alt="Evidencia" class="w-full h-full object-cover">
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Info Cuadrilla y Rol del Denunciante -->
      <div class="p-2.5 rounded-xl bg-surface-container-low text-xs space-y-1">
        <div class="flex items-center justify-between text-on-surface-variant font-medium">
          <span class="flex items-center gap-1.5 truncate">
            <span class="material-symbols-outlined text-[15px] text-primary shrink-0">engineering</span>
            <span class="truncate">${escapeHtml(incident.assignedTeam || 'Sin cuadrilla asignada')}</span>
          </span>
        </div>
        <div class="text-[11px] text-outline flex items-center justify-between gap-2 pt-0.5">
          <span class="truncate">Actor: <strong>${escapeHtml(incident.reportedBy || 'Anónimo')}</strong></span>
          <span class="capitalize text-primary font-bold shrink-0">(${escapeHtml(incident.reportedByRole || 'invitado')})</span>
        </div>
      </div>

      <!-- Botón Ver y Gestionar -->
      <div class="flex items-center justify-between pt-1 border-t border-outline-variant/10">
        <span class="text-[11px] text-outline flex items-center gap-1 truncate">
          <span class="material-symbols-outlined text-[13px] shrink-0">location_city</span>
          <span class="truncate">${escapeHtml(incident.sectorLabel || 'Sector')}</span>
        </span>
        <button class="btn-open-detail flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-container text-primary text-xs font-bold hover:bg-surface-container-high transition-all active:scale-95 shrink-0" data-id="${escapeHtml(incident.id)}">
          <span>Gestionar Triaje</span>
          <span class="material-symbols-outlined text-[14px]">chevron_right</span>
        </button>
      </div>

    </article>
  `).join('');

  container.querySelectorAll('.btn-open-detail').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openIncidentModal(id);
    });
  });
}

function updateTabCounters() {
  const counts = countByStatus(state.incidents);
  if (dom.tabCountAll) dom.tabCountAll.textContent = counts.total;
  if (dom.tabCountNew) dom.tabCountNew.textContent = counts.new;
  if (dom.tabCountProgress) dom.tabCountProgress.textContent = counts.progress;
  if (dom.tabCountResolved) dom.tabCountResolved.textContent = counts.resolved;

  // Contador del ítem Bandeja en la barra lateral (solo existe para el rol trabajador)
  const badgeTotal = document.getElementById('badge-total-incidencias');
  if (badgeTotal) badgeTotal.textContent = counts.total;
}

// ==========================================
// Modal de Detalle y Cambio de Estado
// ==========================================
function openIncidentModal(id) {
  const incident = state.incidents.find(i => i.id === id);
  if (!incident) return;

  state.activeModalIncident = incident;

  dom.modalFolio.textContent = incident.folio;
  dom.modalTitle.textContent = incident.title;
  dom.modalAddress.innerHTML = `<span class="material-symbols-outlined text-[16px] text-primary">pin_drop</span><span>${escapeHtml(incident.address)} (${escapeHtml(incident.sectorLabel)})</span>`;
  dom.modalDesc.textContent = incident.description || 'Sin descripción adicional reportada.';
  dom.modalReportedBy.textContent = `${incident.reportedBy || 'Vecino'} (${incident.reportedByRole || 'invitado'})`;
  dom.modalChannel.textContent = incident.channelLabel || 'Digital';
  dom.modalStatusBadge.textContent = incident.statusLabel;

  const urgencyLabels = { low: 'Baja', medium: 'Media', high: 'Alta / Crítica' };
  if (dom.modalCategory) dom.modalCategory.textContent = incident.categoryLabel || incident.category || 'General';
  if (dom.modalUrgency) dom.modalUrgency.textContent = urgencyLabels[incident.urgency] || incident.urgency || 'Media';
  if (dom.modalAssignedTeam) dom.modalAssignedTeam.textContent = incident.assignedTeam || 'En despacho';

  if (dom.modalPriorityBadge) {
    dom.modalPriorityBadge.textContent = `Nivel ${incident.priorityLevel}: ${incident.priorityLabel}`;
  }

  if (incident.image) {
    dom.modalImg.src = incident.image;
    dom.modalImg.parentElement.classList.remove('hidden');
  } else {
    dom.modalImg.src = '';
    dom.modalImg.parentElement.classList.add('hidden');
  }

  // Resaltar estado activo en los botones de cambio de estado
  dom.btnChangeStatus.forEach(btn => {
    const btnStatus = btn.getAttribute('data-new-status');
    const isCurrent = btnStatus === incident.status;
    btn.disabled = isCurrent;
    btn.classList.toggle('ring-2', isCurrent);
    btn.classList.toggle('ring-primary', isCurrent);
    btn.classList.toggle('opacity-60', isCurrent);
    btn.classList.toggle('cursor-default', isCurrent);
  });

  // Solo personal municipal o super admin pueden cambiar de estado operativo
  if (state.currentUser.role === 'trabajador' || state.currentUser.role === 'admin') {
    dom.modalStatusActionsContainer.classList.remove('hidden');
  } else {
    dom.modalStatusActionsContainer.classList.add('hidden');
  }

  dom.modalIncident.classList.remove('hidden');
  dom.modalIncident.classList.add('flex');
}

function closeIncidentModal() {
  dom.modalIncident.classList.add('hidden');
  dom.modalIncident.classList.remove('flex');
  state.activeModalIncident = null;
}

async function handleStatusChange(newStatus) {
  if (!state.activeModalIncident) return;
  const id = state.activeModalIncident.id;

  try {
    const res = await fetch(`/api/incidents/${id}/status`, {
      method: 'PATCH',
      headers: userHeaders(),
      body: JSON.stringify({ status: newStatus })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast(`Estado de ${state.activeModalIncident.folio} actualizado a ${newStatus}`, 'success');
    closeIncidentModal();
    await loadIncidents();
  } catch (err) {
    console.error('Error al actualizar estado:', err);
    showToast('Error al actualizar estado en el servidor', 'error');
  }
}

function init() {
  // Filtros de estado en Bandeja
  dom.statusTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      dom.statusTabs.forEach(t => {
        t.className = 'tab-status shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container shadow-sm transition-all';
      });
      tab.className = 'tab-status active shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-on-primary shadow-sm transition-all';
      state.filterStatus = tab.getAttribute('data-status');
      renderIncidentsList();
    });
  });

  // Buscador en vivo
  if (dom.inputSearch) {
    dom.inputSearch.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      if (state.searchQuery) {
        dom.btnClearSearch.classList.remove('hidden');
      } else {
        dom.btnClearSearch.classList.add('hidden');
      }
      renderIncidentsList();
    });
  }

  if (dom.btnClearSearch) {
    dom.btnClearSearch.addEventListener('click', () => {
      dom.inputSearch.value = '';
      state.searchQuery = '';
      dom.btnClearSearch.classList.add('hidden');
      renderIncidentsList();
    });
  }

  if (dom.selectFilterCategory) {
    dom.selectFilterCategory.addEventListener('change', (e) => {
      state.filterCategory = e.target.value;
      renderIncidentsList();
    });
  }

  // Modal de Detalle / Triaje
  if (dom.btnCloseModal) dom.btnCloseModal.addEventListener('click', closeIncidentModal);
  if (dom.modalIncident) {
    dom.modalIncident.addEventListener('click', (e) => {
      if (e.target === dom.modalIncident) closeIncidentModal();
    });
  }

  dom.btnChangeStatus.forEach(btn => {
    btn.addEventListener('click', () => {
      const newStatus = btn.getAttribute('data-new-status');
      handleStatusChange(newStatus);
    });
  });
}

export { renderIncidentsList, updateTabCounters, openIncidentModal, closeIncidentModal, init };
