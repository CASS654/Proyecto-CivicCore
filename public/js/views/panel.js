// view-panel: KPIs del panel municipal.

import { state } from '../state.js';
import { escapeHtml } from '../ui.js';

const dom = {
  kpiTotal: document.getElementById('kpi-total'),
  kpiNew: document.getElementById('kpi-new'),
  kpiProgress: document.getElementById('kpi-progress'),
  kpiResolved: document.getElementById('kpi-resolved'),
  kpiRate: document.getElementById('kpi-rate'),
  categoriesStatsBars: document.getElementById('categories-stats-bars')
};

// ==========================================
// Renderizado de Dashboard KPIs
// ==========================================
function renderDashboardStats() {
  if (!state.stats) return;

  const s = state.stats;
  if (dom.kpiTotal) dom.kpiTotal.textContent = s.total;
  if (dom.kpiNew) dom.kpiNew.textContent = s.counts.new;
  if (dom.kpiProgress) dom.kpiProgress.textContent = s.counts.progress;
  if (dom.kpiResolved) dom.kpiResolved.textContent = s.counts.resolved;
  if (dom.kpiRate) dom.kpiRate.textContent = `${s.resolutionRate}%`;

  if (dom.categoriesStatsBars && s.byCategory) {
    const catLabels = {
      vialidad: 'Baches y Calzadas',
      alumbrado: 'Alumbrado Público',
      aseo: 'Aseo Urbano',
      aguas: 'Agua y Alcantarillado',
      areas_verdes: 'Parques y Jardines',
      seguridad: 'Seguridad Ciudadana'
    };

    const total = s.total || 1;
    dom.categoriesStatsBars.innerHTML = Object.entries(s.byCategory).map(([k, count]) => {
      const pct = Math.round((count / total) * 100);
      return `
        <div>
          <div class="flex items-center justify-between text-xs font-semibold mb-1 text-on-surface">
            <span>${escapeHtml(catLabels[k] || k)}</span>
            <span class="text-outline font-mono">${count} (${pct}%)</span>
          </div>
          <div class="w-full bg-surface-container h-2 rounded-full overflow-hidden">
            <div class="bg-primary h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}

export { renderDashboardStats };
