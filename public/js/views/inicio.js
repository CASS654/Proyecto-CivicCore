// view-inicio: KPIs públicos, rastreo de folio, accesos rápidos y efecto de scroll.

import { findIncidentByFolio } from '../data.js';
import { countByStatus, homeEfficiencyRate, normalizeFolio } from '../logic.js';
import { switchView } from '../nav.js';
import { state } from '../state.js';
import { escapeHtml, showToast } from '../ui.js';
import { openIncidentModal } from './incidencias.js';
import { setFormStep } from './nuevo.js';

// ==========================================
// Funciones de la Página de Inicio (Landing Page)
// ==========================================
function renderHomeStats() {
  const totalEl = document.getElementById('home-kpi-total');
  const inProgressEl = document.getElementById('home-kpi-progreso');
  const resolvedEl = document.getElementById('home-kpi-resueltas');
  const rateEl = document.getElementById('home-kpi-eficiencia');

  const counts = countByStatus(state.incidents);
  if (totalEl) totalEl.textContent = String(counts.total);
  if (inProgressEl) inProgressEl.textContent = String(counts.progress);
  if (resolvedEl) resolvedEl.textContent = String(counts.resolved);
  if (rateEl) rateEl.textContent = `${homeEfficiencyRate(counts)}%`;
}

async function handleHomeFolioSearch() {
  const input = document.getElementById('home-folio-input');
  const val = (input ? input.value : '').trim();
  if (!val) {
    showToast('Ingresa un número de folio para rastrear', 'info');
    return;
  }

  const clean = normalizeFolio(val);
  const found = await findIncidentByFolio(clean);

  const resultBox = document.getElementById('home-folio-result-box');
  const notFoundBox = document.getElementById('home-folio-not-found');

  if (!found) {
    if (resultBox) resultBox.classList.add('hidden');
    if (notFoundBox) {
      notFoundBox.classList.remove('hidden');
      const notFoundCode = document.getElementById('home-not-found-folio-code');
      if (notFoundCode) notFoundCode.textContent = clean;
    }
    showToast(`No se encontró reporte con folio #${clean}`, 'error');
    return;
  }

  if (notFoundBox) notFoundBox.classList.add('hidden');
  if (resultBox) {
    resultBox.classList.remove('hidden');
    const folioEl = document.getElementById('home-res-folio');
    const titleEl = document.getElementById('home-res-title');
    const addressEl = document.getElementById('home-res-address');
    const dateEl = document.getElementById('home-res-date');
    const statusPill = document.getElementById('home-res-status-pill');

    if (folioEl) folioEl.textContent = found.folio || `#${found.id}`;
    if (titleEl) titleEl.textContent = found.title;
    if (addressEl) addressEl.innerHTML = `<span class="material-symbols-outlined text-[15px] shrink-0">pin_drop</span> <span>${escapeHtml(found.address || 'Comuna Central')} • Cuadrilla: ${escapeHtml(found.assignedTeam || 'En despacho')}</span>`;
    if (dateEl) dateEl.textContent = found.createdAt ? new Date(found.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Reciente';

    if (statusPill) {
      if (found.status === 'resolved') {
        statusPill.className = 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1.5';
        statusPill.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Resuelto';
      } else if (found.status === 'progress') {
        statusPill.className = 'px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 flex items-center gap-1.5';
        statusPill.innerHTML = '<span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> En Cuadrilla / Proceso';
      } else {
        statusPill.className = 'px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1.5';
        statusPill.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500"></span> Pendiente de Triaje';
      }
    }

    const btnViewModal = document.getElementById('home-btn-view-modal');
    if (btnViewModal) {
      btnViewModal.onclick = () => openIncidentModal(found.id);
    }
  }

  showToast(`Folio ${found.folio || found.id} localizado exitosamente`, 'success');
}

function scrollToHomeTracker() {
  if (state.currentView !== 'view-inicio') {
    switchView('view-inicio');
  }
  setTimeout(() => {
    document.querySelectorAll('#view-inicio .cc-scroll-item').forEach(item => {
      item.dataset.forceVisible = 'true';
      item.classList.add('cc-scroll-visible');
      item.classList.remove('cc-scroll-hidden');
    });
    const el = document.getElementById('seccion-rastreo-inicio');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = document.getElementById('home-folio-input');
      if (input) input.focus();
    }
  }, 120);
}

function reportCategory(categoryValue) {
  switchView('view-nuevo');
  setTimeout(() => {
    setFormStep(1);
    const radio = document.querySelector(`input[name="category"][value="${categoryValue}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const scrollEl = document.getElementById('main-scroll-container');
    if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
  }, 80);
}

// Efecto de scroll del inicio: achica el título y revela las tarjetas (antes estaba en línea en index.html)
function initScrollEffects() {
  const scrollContainer = document.getElementById('main-scroll-container');
  const heroTitle = document.getElementById('hero-main-title');
  const heroSubtitle = document.getElementById('hero-subtitle-text');
  const scrollItems = document.querySelectorAll('#view-inicio .cc-scroll-item');

  function onScrollUpdate() {
    if (!scrollContainer || !heroTitle) return;
    const scrollTop = scrollContainer.scrollTop || window.scrollY || 0;
    const maxScroll = 280;
    const progress = Math.min(Math.max(scrollTop / maxScroll, 0), 1);
    const scale = 1 - (progress * 0.44);
    const translateY = progress * 12;
    const marginBottom = -(progress * 95);
    heroTitle.style.transform = 'translate3d(0, ' + translateY.toFixed(1) + 'px, 0) scale(' + scale.toFixed(3) + ')';
    heroTitle.style.marginBottom = marginBottom.toFixed(1) + 'px';

    if (heroSubtitle) {
      const subScale = 1 - (progress * 0.1);
      heroSubtitle.style.transform = 'scale(' + subScale.toFixed(3) + ')';
      heroSubtitle.style.opacity = String(1 - (progress * 0.25));
    }

    const viewportH = scrollContainer.clientHeight || window.innerHeight;
    const canScrollEnough = (scrollContainer.scrollHeight - viewportH) > 60;

    scrollItems.forEach((el) => {
      if (el.dataset.forceVisible === 'true' || !canScrollEnough) {
        el.classList.add('cc-scroll-visible');
        el.classList.remove('cc-scroll-hidden');
        return;
      }
      const rect = el.getBoundingClientRect();
      if (scrollTop >= 20 || rect.top < viewportH * 0.88) {
        if (rect.top < viewportH * 0.94) {
          el.classList.add('cc-scroll-visible');
          el.classList.remove('cc-scroll-hidden');
        }
      } else {
        el.classList.add('cc-scroll-hidden');
        el.classList.remove('cc-scroll-visible');
      }
    });
  }

  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', onScrollUpdate, { passive: true });
  }
  window.addEventListener('scroll', onScrollUpdate, { passive: true });
  window.addEventListener('resize', onScrollUpdate, { passive: true });
  requestAnimationFrame(onScrollUpdate);
}

function init() {
  initScrollEffects();
}

export { renderHomeStats, handleHomeFolioSearch, scrollToHomeTracker, reportCategory, init };
