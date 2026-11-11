// view-mapa: pines por sector y vista previa.

import { state } from '../state.js';
import { escapeHtml } from '../ui.js';
import { openIncidentModal } from './incidencias.js';

const dom = {
  mapPinsLayer: document.getElementById('map-pins-layer'),
  mapIncidentPreview: document.getElementById('map-incident-preview'),
  previewFolio: document.getElementById('preview-folio'),
  previewStatus: document.getElementById('preview-status'),
  previewTitle: document.getElementById('preview-title'),
  previewAddress: document.getElementById('preview-address'),
  mapSectorBtns: document.querySelectorAll('.map-sector-btn'),
  btnCloseMapPreview: document.getElementById('btn-close-map-preview')
};

// ==========================================
// Mapa Comunal Interactivo
// ==========================================
function renderMapPins() {
  const layer = dom.mapPinsLayer;
  if (!layer) return;

  let pins = state.incidents;
  if (state.selectedSector !== 'all') {
    pins = pins.filter(i => i.sector === state.selectedSector);
  }

  const colors = {
    vialidad: 'bg-amber-500 text-white',
    alumbrado: 'bg-yellow-400 text-slate-900',
    aseo: 'bg-emerald-500 text-white',
    aguas: 'bg-blue-500 text-white',
    areas_verdes: 'bg-green-600 text-white',
    seguridad: 'bg-indigo-600 text-white'
  };

  layer.innerHTML = pins.map(inc => {
    const c = colors[inc.category] || 'bg-primary text-white';
    const x = Number(inc.coordinates?.x) || 50;
    const y = Number(inc.coordinates?.y) || 50;

    return `
      <div class="map-pin" style="left: ${x}%; top: ${y}%;" data-id="${escapeHtml(inc.id)}" title="${escapeHtml(inc.folio)}: ${escapeHtml(inc.title)}">
        <div class="map-pin-pulse ${c}"></div>
        <div class="w-8 h-8 rounded-full ${c} shadow-lg flex items-center justify-center font-bold text-xs ring-2 ring-white">
          <span class="material-symbols-outlined text-[16px]">${escapeHtml(inc.categoryIcon || 'pin_drop')}</span>
        </div>
      </div>
    `;
  }).join('');

  layer.querySelectorAll('.map-pin').forEach(pin => {
    pin.addEventListener('click', () => {
      layer.querySelectorAll('.map-pin.active').forEach(p => p.classList.remove('active'));
      pin.classList.add('active');
      const id = pin.getAttribute('data-id');
      const inc = state.incidents.find(i => i.id === id);
      if (inc) showMapPreview(inc);
    });
  });
}

function showMapPreview(inc) {
  if (!dom.mapIncidentPreview) return;
  dom.previewFolio.textContent = inc.folio;
  dom.previewStatus.textContent = inc.statusLabel;
  dom.previewTitle.textContent = inc.title;
  dom.previewAddress.innerHTML = `<span class="material-symbols-outlined text-[14px]">pin_drop</span><span>${escapeHtml(inc.address)}</span>`;
  dom.mapIncidentPreview.classList.remove('hidden');

  dom.mapIncidentPreview.onclick = (e) => {
    if (e.target.closest('#btn-close-map-preview')) return;
    openIncidentModal(inc.id);
  };
}

function init() {
  // Filtros de Sector en Mapa
  dom.mapSectorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.mapSectorBtns.forEach(b => {
        b.className = 'map-sector-btn shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high text-xs font-bold transition-all';
      });
      btn.className = 'map-sector-btn active shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full bg-primary text-on-primary text-xs font-bold transition-all shadow-sm';
      state.selectedSector = btn.getAttribute('data-sector');
      renderMapPins();
    });
  });

  if (dom.btnCloseMapPreview) {
    dom.btnCloseMapPreview.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.mapIncidentPreview.classList.add('hidden');
      if (dom.mapPinsLayer) {
        dom.mapPinsLayer.querySelectorAll('.map-pin.active').forEach(p => p.classList.remove('active'));
      }
    });
  }
}

export { renderMapPins, init };
