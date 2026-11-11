// view-nuevo: asistente de reporte en 3 pasos, foto, cancelación y comprobante.

import { loadIncidents, userHeaders } from '../data.js';
import { nextFolioPreview } from '../logic.js';
import { switchView } from '../nav.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { applySystemPrefs } from './ajustes.js';

const dom = {
  formFolioPreview: document.getElementById('form-folio-preview'),
  formPriorityBadge: document.getElementById('form-priority-preview-badge'),
  urgencyRoleNote: document.getElementById('urgency-role-note'),
  stepLabel: document.getElementById('step-label'),
  stepIndicator: document.getElementById('step-indicator'),
  stepProgressBar: document.getElementById('step-progress-bar'),
  form: document.getElementById('incident-form')
};

// ==========================================
// Formulario: Wizard de 3 Pasos y Urgencia
// ==========================================
function updateFolioPreview() {
  if (dom.formFolioPreview) dom.formFolioPreview.textContent = nextFolioPreview(state.incidents);
}

function updateFormUrgencyBadge() {
  const role = state.currentUser.role;
  if (!dom.formPriorityBadge) return;

  if (role === 'admin') {
    dom.formPriorityBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span> Prioridad: Crítica (Super Admin)`;
    if (dom.urgencyRoleNote) dom.urgencyRoleNote.textContent = 'Reporte oficial con poder canónico Root';
  } else if (role === 'trabajador') {
    dom.formPriorityBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span> Prioridad: Muy Alta (Funcionario Público)`;
    if (dom.urgencyRoleNote) dom.urgencyRoleNote.textContent = 'Prioridad preferente con despacho directo';
  } else if (role === 'vecino') {
    dom.formPriorityBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-600"></span> Prioridad: Alta (Vecino Verificado)`;
    if (dom.urgencyRoleNote) dom.urgencyRoleNote.textContent = 'Cuenta vecinal acreditada con respuesta < 24h';
  } else {
    dom.formPriorityBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-500"></span> Prioridad: Normal (Invitado / Anónimo)`;
    if (dom.urgencyRoleNote) dom.urgencyRoleNote.textContent = 'Prioridad base estándar de ingreso';
  }
}

function setFormStep(step) {
  state.currentFormStep = step;
  document.querySelectorAll('.form-step').forEach(s => {
    const sNum = parseInt(s.getAttribute('data-step'), 10);
    if (sNum === step) {
      s.classList.remove('hidden');
    } else {
      s.classList.add('hidden');
    }
  });

  const labels = {
    1: 'Paso 1: Clasificación & Urgencia',
    2: 'Paso 2: Ubicación & Datos',
    3: 'Paso 3: Evidencia Fotográfica'
  };

  if (dom.stepLabel) dom.stepLabel.textContent = labels[step] || `Paso ${step}`;
  if (dom.stepIndicator) dom.stepIndicator.textContent = `Paso ${step} de 3`;
  if (dom.stepProgressBar) dom.stepProgressBar.style.width = `${(step / 3) * 100}%`;
}

// Modal de Comprobante / Éxito al Generar Reporte
function showReportSuccessModal(incident) {
  const modal = document.getElementById('modal-report-success');
  const folioEl = document.getElementById('success-modal-folio');
  const priorityEl = document.getElementById('success-modal-priority');
  const sectorEl = document.getElementById('success-modal-sector');
  if (!modal) return;

  if (folioEl) folioEl.textContent = incident.folio || incident.id;
  if (priorityEl) priorityEl.textContent = incident.priorityLabel || 'Normal';
  if (sectorEl) sectorEl.textContent = incident.sectorLabel || incident.sector || 'Comuna Central';

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeReportSuccessModal() {
  const modal = document.getElementById('modal-report-success');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function openCancelIncidentModal() {
  const modal = document.getElementById('modal-cancel-incident');
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  document.getElementById('btn-continue-incident')?.focus();
}

function closeCancelIncidentModal() {
  const modal = document.getElementById('modal-cancel-incident');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

let uploadedCustomPhotoBase64 = null;

function handleCustomPhotoSelect(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Por favor selecciona un archivo de imagen válido (JPG, PNG o WEBP)', 'error');
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    showToast('La imagen es demasiado grande (máximo 12 MB)', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedCustomPhotoBase64 = e.target.result;

    const idleEl = document.getElementById('dropzone-idle');
    const prevEl = document.getElementById('dropzone-preview');
    const imgEl = document.getElementById('custom-photo-img-preview');
    const nameEl = document.getElementById('custom-photo-name');
    const sizeEl = document.getElementById('custom-photo-size');

    if (imgEl) imgEl.src = uploadedCustomPhotoBase64;
    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB`;

    if (idleEl) idleEl.classList.add('hidden');
    if (prevEl) {
      prevEl.classList.remove('hidden');
      prevEl.classList.add('flex');
    }

    document.querySelectorAll('input[name="sample_photo"]').forEach(r => r.checked = false);
    showToast('Foto cargada y lista para adjuntar', 'success');
  };
  reader.readAsDataURL(file);
}

function removeCustomPhoto() {
  uploadedCustomPhotoBase64 = null;
  const input = document.getElementById('input-custom-photo');
  if (input) input.value = '';

  const idleEl = document.getElementById('dropzone-idle');
  const prevEl = document.getElementById('dropzone-preview');
  if (idleEl) idleEl.classList.remove('hidden');
  if (prevEl) {
    prevEl.classList.add('hidden');
    prevEl.classList.remove('flex');
  }

  const firstSample = document.querySelector('input[name="sample_photo"]');
  if (firstSample) firstSample.checked = true;
}

async function handleFormSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  // Si el usuario presiona Enter en los pasos 1 o 2, avanzar de paso en vez de enviar prematuramente
  if (state.currentFormStep === 1) {
    setFormStep(2);
    return;
  }

  const titleInput = document.getElementById('input-title');
  const addressInput = document.getElementById('input-address');
  const sectorInput = document.getElementById('select-sector');
  const reportedByInput = document.getElementById('input-reportedBy');
  const descInput = document.getElementById('input-desc');

  const title = titleInput ? titleInput.value.trim() : '';
  const address = addressInput ? addressInput.value.trim() : '';
  const sector = sectorInput ? sectorInput.value : 'centro';
  const reportedBy = (reportedByInput && reportedByInput.value.trim()) || state.currentUser.name;
  const description = descInput ? descInput.value.trim() : '';

  const categoryInput = dom.form ? dom.form.querySelector('input[name="category"]:checked') : null;
  const category = categoryInput ? categoryInput.value : 'vialidad';

  const channelInput = dom.form ? dom.form.querySelector('input[name="channel"]:checked') : null;
  const channel = channelInput ? channelInput.value : 'app';

  const urgencyInput = dom.form ? dom.form.querySelector('input[name="urgency"]:checked') : null;
  const urgency = urgencyInput ? urgencyInput.value : 'medium';

  const photoInput = dom.form ? dom.form.querySelector('input[name="sample_photo"]:checked') : null;
  const image = uploadedCustomPhotoBase64 || (photoInput ? photoInput.value : '');

  if (!title || !address) {
    setFormStep(2);
    showToast('Por favor completa el título y la dirección en el Paso 2', 'error');
    if (!title && titleInput) titleInput.focus();
    else if (!address && addressInput) addressInput.focus();
    return;
  }

  if (state.currentFormStep === 2) {
    setFormStep(3);
    return;
  }

  const submitBtn = document.getElementById('btn-submit-form');
  const originalBtnContent = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></span>
      <span>Guardando reporte...</span>
    `;
  }

  const payload = {
    title,
    address,
    sector,
    reportedBy,
    description,
    category,
    channel,
    urgency,
    image,
    userRole: state.currentUser.role,
    userName: state.currentUser.name
  };

  try {
    const res = await fetch('/api/incidents', {
      method: 'POST',
      headers: userHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    showToast(`¡Reporte ${data.data.folio} registrado correctamente!`, 'success');

    if (dom.form) dom.form.reset();
    removeCustomPhoto();
    setFormStep(1);
    applySystemPrefs();
    await loadIncidents();

    // Mostrar comprobante oficial de éxito
    showReportSuccessModal(data.data);

  } catch (err) {
    console.error('Error al enviar formulario:', err);
    showToast('Error al registrar incidencia en el servidor. Intenta de nuevo.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnContent;
    }
  }
}

// Al entrar a view-nuevo: folio y prioridad de vista previa, y nombre del denunciante según la sesión
function onEnterNuevo() {
  updateFolioPreview();
  updateFormUrgencyBadge();
  const reportedByEl = document.getElementById('input-reportedBy');
  if (reportedByEl) {
    if (state.currentUser.role !== 'invitado') {
      reportedByEl.placeholder = state.currentUser.name;
      if (!reportedByEl.value) reportedByEl.value = state.currentUser.name;
    } else {
      reportedByEl.placeholder = 'Ej: Carmen Soto (o déjalo en blanco si eres anónimo)';
      if (reportedByEl.value === 'Carmen Soto' || reportedByEl.value === 'Lic. Elena Morales' || reportedByEl.value === 'Super Admin Root') {
        reportedByEl.value = '';
      }
    }
  }
}

function init() {
  // Pasos del Wizard Formulario
  document.querySelectorAll('.btn-step-next').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.currentFormStep === 2) {
        const title = document.getElementById('input-title')?.value.trim();
        const address = document.getElementById('input-address')?.value.trim();
        if (!title || !address) {
          showToast('Por favor completa el título y la dirección para continuar', 'error');
          if (!title) document.getElementById('input-title')?.focus();
          else document.getElementById('input-address')?.focus();
          return;
        }
      }
      if (state.currentFormStep < 3) setFormStep(state.currentFormStep + 1);
    });
  });

  document.querySelectorAll('.btn-step-prev').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.currentFormStep > 1) setFormStep(state.currentFormStep - 1);
    });
  });

  if (dom.form) dom.form.addEventListener('submit', handleFormSubmit);

  // CC-02: Cancelación del reporte ciudadano
  const btnCancelIncident = document.getElementById('btn-cancel-incident');
  const btnContinueIncident = document.getElementById('btn-continue-incident');
  const btnDiscardIncident = document.getElementById('btn-discard-incident');
  const modalCancelIncident = document.getElementById('modal-cancel-incident');

  if (btnCancelIncident) {
    btnCancelIncident.addEventListener('click', openCancelIncidentModal);
  }

  if (btnContinueIncident) {
    btnContinueIncident.addEventListener('click', closeCancelIncidentModal);
  }

  if (btnDiscardIncident) {
    btnDiscardIncident.addEventListener('click', () => {
      closeCancelIncidentModal();

      // Descartar los datos que todavía no se enviaron
      if (dom.form) dom.form.reset();
      removeCustomPhoto();
      setFormStep(1);

      // Volver al inicio
      switchView('view-inicio');
      showToast('Reporte cancelado. No se guardaron los datos.', 'info');
    });
  }

  if (modalCancelIncident) {
    modalCancelIncident.addEventListener('click', (e) => {
      if (e.target === modalCancelIncident) {
        closeCancelIncidentModal();
      }
    });
  }

  // Botones del Modal de Comprobante / Éxito
  const btnSuccessNew = document.getElementById('btn-success-new-report');
  if (btnSuccessNew) {
    btnSuccessNew.addEventListener('click', () => {
      closeReportSuccessModal();
      setFormStep(1);
      switchView('view-nuevo');
      const mainScroll = document.getElementById('main-scroll-container');
      if (mainScroll) mainScroll.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const btnCloseSuccess = document.getElementById('btn-close-success-modal');
  if (btnCloseSuccess) {
    btnCloseSuccess.addEventListener('click', () => {
        closeReportSuccessModal();
        switchView('view-inicio');
      });
  }

  const modalSuccessEl = document.getElementById('modal-report-success');
  if (modalSuccessEl) {
    modalSuccessEl.addEventListener('click', (e) => {
      if (e.target === modalSuccessEl) closeReportSuccessModal();
    });
  }

  // Eventos de Carga de Foto Personalizada
  const inputCustomPhoto = document.getElementById('input-custom-photo');
  if (inputCustomPhoto) {
    inputCustomPhoto.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleCustomPhotoSelect(e.target.files[0]);
      }
    });
  }

  const dropzone = document.getElementById('dropzone-custom-photo');
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('border-primary', 'bg-primary/5');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('border-primary', 'bg-primary/5');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleCustomPhotoSelect(e.dataTransfer.files[0]);
      }
    });
  }

  document.querySelectorAll('input[name="sample_photo"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked && uploadedCustomPhotoBase64) {
        removeCustomPhoto();
      }
    });
  });
}

export { setFormStep, closeReportSuccessModal, removeCustomPhoto, onEnterNuevo, init };
