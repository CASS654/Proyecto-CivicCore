// Centro de configuración: tema, cuenta, preferencias, accesibilidad y sincronización automática.

import { ROLE_PERMISSIONS } from '../config.js';
import { loadIncidents, userHeaders } from '../data.js';
import { renderNavForRole, updateLayout } from '../nav.js';
import { saveSessionUser, state, systemPrefs, saveSystemPrefsToStorage, resetSystemPrefs } from '../state.js';
import { playAlertTone, showToast } from '../ui.js';

const dom = {
  currentUserBadge: document.getElementById('current-user-badge')
};

// ==========================================
// Centro de Configuración del Sistema, Cuenta, Temas y Accesibilidad
// ==========================================

let autoSyncIntervalId = null;

// Casillas de Preferencias/Accesibilidad -> clave en systemPrefs
const PREF_TOGGLES = {
  'pref-toggle-compact': 'compactCards',
  'pref-toggle-contrast': 'highContrast',
  'pref-toggle-motion': 'reduceMotion',
  'pref-toggle-toasts': 'showToasts',
  'pref-toggle-sound': 'soundAlerts'
};

// Grupos de botones -> [atributo data-*, clave en systemPrefs, valor si falta el atributo]
const PREF_BUTTONS = {
  '.pref-theme-btn': ['data-pref-theme', 'theme', 'light'],
  '.pref-accent-btn': ['data-pref-accent', 'accent', 'blue'],
  '.pref-font-btn': ['data-pref-font', 'fontScale', 'normal']
};

function setPref(key, value) {
  systemPrefs[key] = value;
  saveSystemPrefsToStorage();
  applySystemPrefs();
}

function isDarkActive() {
  if (systemPrefs.theme === 'dark') return true;
  if (systemPrefs.theme === 'light') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function switchSettingsTab(tabName) {
  document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    const t = btn.getAttribute('data-settings-tab');
    if (t === tabName) {
      btn.className = 'settings-tab-btn active shrink-0 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-primary text-on-primary shadow-sm transition-all';
    } else {
      btn.className = 'settings-tab-btn shrink-0 px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 text-on-surface-variant hover:bg-surface-container transition-all';
    }
  });

  ['appearance', 'account', 'preferences', 'accessibility'].forEach(panelKey => {
    const panel = document.getElementById(`settings-panel-${panelKey}`);
    if (panel) {
      panel.classList.toggle('hidden', panelKey !== tabName);
    }
  });

  if (tabName === 'account') {
    syncSettingsAccountTab();
  }
}

function syncSettingsAccountTab() {
  const user = state.currentUser || { role: 'invitado', name: 'Vecino Invitado', email: '' };
  const isGuest = user.role === 'invitado';
  const roleConfig = ROLE_PERMISSIONS[user.role] || ROLE_PERMISSIONS.invitado;

  const nameEl = document.getElementById('settings-account-name');
  const roleBadgeEl = document.getElementById('settings-account-role-badge');
  const emailEl = document.getElementById('settings-account-email');
  const iconEl = document.getElementById('settings-account-avatar-icon');
  const guestActions = document.getElementById('settings-account-guest-actions');
  const authActions = document.getElementById('settings-account-auth-actions');
  const guestBlock = document.getElementById('settings-guest-profile-block');
  const authBlock = document.getElementById('settings-authenticated-profile-block');

  if (nameEl) nameEl.textContent = user.name || 'Vecino Invitado';
  if (roleBadgeEl) roleBadgeEl.textContent = roleConfig.label;
  if (emailEl) {
    emailEl.textContent = isGuest ? 'Modo público sin sesión iniciada' : `${user.email || ''} • ${user.department || 'Comunidad'}`;
  }
  if (iconEl) {
    iconEl.textContent = roleConfig.icon;
  }

  if (guestActions) guestActions.classList.toggle('hidden', !isGuest);
  if (authActions) authActions.classList.toggle('hidden', isGuest);
  if (guestBlock) guestBlock.classList.toggle('hidden', !isGuest);
  if (authBlock) authBlock.classList.toggle('hidden', isGuest);

  if (!isGuest) {
    const pName = document.getElementById('settings-profile-name');
    const pEmail = document.getElementById('settings-profile-email');
    const pRut = document.getElementById('settings-profile-rut');
    const pDept = document.getElementById('settings-profile-dept');
    if (pName) pName.value = user.name || '';
    if (pEmail) pEmail.value = user.email || '';
    if (pRut) pRut.value = (user.rutDni && user.rutDni !== 'Sin DNI') ? user.rutDni : '';
    if (pDept) pDept.value = user.department || '';
  } else {
    const repInput = document.getElementById('pref-input-default-reporter');
    if (repInput) repInput.value = systemPrefs.defaultReporter || '';
  }
}

function applySystemPrefs() {
  const root = document.documentElement;
  const dark = isDarkActive();

  root.classList.toggle('dark', dark);
  root.setAttribute('data-accent', systemPrefs.accent || 'blue');
  root.setAttribute('data-font-scale', systemPrefs.fontScale || 'normal');
  root.classList.toggle('cc-compact-cards', !!systemPrefs.compactCards);
  root.classList.toggle('cc-high-contrast', !!systemPrefs.highContrast);
  root.classList.toggle('cc-reduce-motion', !!systemPrefs.reduceMotion);

  // Actualizar icono rápido en el Header
  const quickIcon = document.getElementById('icon-quick-theme');
  if (quickIcon) {
    quickIcon.textContent = dark ? 'light_mode' : 'dark_mode';
    quickIcon.className = `material-symbols-outlined text-[18px] ${dark ? 'text-amber-400' : 'text-on-surface'}`;
  }

  // Actualizar etiqueta e indicadores dentro del modal de Configuración
  const themeLabel = document.getElementById('settings-current-theme-label');
  if (themeLabel) {
    const names = {
      light: 'Modo Claro',
      dark: 'Modo Oscuro',
      system: `Automático (${dark ? 'Oscuro' : 'Claro'})`
    };
    themeLabel.textContent = names[systemPrefs.theme] || 'Modo Claro';
  }

  document.querySelectorAll('.pref-theme-btn').forEach(btn => {
    const val = btn.getAttribute('data-pref-theme');
    if (val === systemPrefs.theme) {
      btn.className = 'pref-theme-btn flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-2xl border-2 border-primary bg-primary/10 shadow-sm transition-all';
    } else {
      btn.className = 'pref-theme-btn flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-2xl border-2 border-outline-variant/30 bg-surface-container-low hover:bg-surface-container transition-all';
    }
  });

  document.querySelectorAll('.pref-accent-btn').forEach(btn => {
    const val = btn.getAttribute('data-pref-accent');
    if (val === systemPrefs.accent) {
      btn.className = 'pref-accent-btn flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 border-primary bg-primary/10 shadow-sm transition-all';
    } else {
      btn.className = 'pref-accent-btn flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 border-outline-variant/30 bg-surface-container-low hover:bg-surface-container transition-all';
    }
  });

  document.querySelectorAll('.pref-font-btn').forEach(btn => {
    const val = btn.getAttribute('data-pref-font');
    const sizeClass = val === 'sm' ? 'text-[11px]' : (val === 'lg' ? 'text-sm' : (val === 'xl' ? 'text-base' : 'text-xs'));
    if (val === systemPrefs.fontScale) {
      btn.className = `pref-font-btn py-2.5 px-2 rounded-xl border-2 border-primary bg-primary text-on-primary font-bold ${sizeClass} shadow-sm transition-all`;
    } else {
      btn.className = `pref-font-btn py-2.5 px-2 rounded-xl border-2 border-outline-variant/30 bg-surface-container-low hover:bg-surface-container font-bold ${sizeClass} text-on-surface transition-all`;
    }
  });

  Object.entries(PREF_TOGGLES).forEach(([id, key]) => {
    const chk = document.getElementById(id);
    // Los avisos quedan activos salvo que se hayan apagado explícitamente
    if (chk) chk.checked = key === 'showToasts' ? systemPrefs.showToasts !== false : !!systemPrefs[key];
  });

  const selSector = document.getElementById('pref-select-default-sector');
  if (selSector) selSector.value = systemPrefs.defaultSector || 'centro';

  const formSector = document.getElementById('select-sector');
  if (formSector && systemPrefs.defaultSector) {
    formSector.value = systemPrefs.defaultSector;
  }

  const reportedByEl = document.getElementById('input-reportedBy');
  if (reportedByEl && state.currentUser.role === 'invitado' && systemPrefs.defaultReporter && !reportedByEl.value) {
    reportedByEl.value = systemPrefs.defaultReporter;
  }

  const selAutoSync = document.getElementById('pref-select-autosync');
  if (selAutoSync) selAutoSync.value = String(systemPrefs.autoSyncSec || 0);

  syncSettingsAccountTab();
  setupAutoSyncTimer();
  updateLayout(); // la barra lateral oculta también es una preferencia (p. ej. al restablecer)
}

function setupAutoSyncTimer() {
  if (autoSyncIntervalId) {
    clearInterval(autoSyncIntervalId);
    autoSyncIntervalId = null;
  }
  const sec = parseInt(systemPrefs.autoSyncSec, 10) || 0;
  if (sec > 0) {
    autoSyncIntervalId = setInterval(() => {
      loadIncidents();
    }, sec * 1000);
  }
}

function toggleQuickTheme() {
  const currentlyDark = isDarkActive();
  systemPrefs.theme = currentlyDark ? 'light' : 'dark';
  saveSystemPrefsToStorage();
  applySystemPrefs();
  showToast(systemPrefs.theme === 'dark' ? '🌙 Tema Oscuro activado' : '☀️ Tema Claro activado', 'info');
}

function openSystemSettingsModal(initialTab = 'appearance') {
  const modal = document.getElementById('modal-system-settings');
  if (!modal) return;
  applySystemPrefs();
  const tab = (typeof initialTab === 'string' && initialTab) ? initialTab : 'appearance';
  switchSettingsTab(tab);
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeSystemSettingsModal() {
  const modal = document.getElementById('modal-system-settings');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function resetSystemSettings() {
  resetSystemPrefs();
  saveSystemPrefsToStorage();
  applySystemPrefs();
  showToast('Configuraciones restablecidas a sus valores de fábrica', 'success');
}

function exportSystemSettings() {
  try {
    const blob = new Blob([JSON.stringify(systemPrefs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'civiccore-ajustes.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Archivo de ajustes descargado correctamente', 'success');
  } catch (e) {
    showToast('No se pudo exportar la configuración', 'error');
  }
}

async function handleSettingsProfileSubmit(e) {
  e.preventDefault();
  if (!state.currentUser || state.currentUser.role === 'invitado') return;

  const name = document.getElementById('settings-profile-name')?.value.trim();
  const email = document.getElementById('settings-profile-email')?.value.trim();
  const rutDni = document.getElementById('settings-profile-rut')?.value.trim();
  const department = document.getElementById('settings-profile-dept')?.value.trim();

  if (!name || !email) {
    showToast('El nombre y correo electrónico son obligatorios', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: userHeaders(),
      body: JSON.stringify({
        id: state.currentUser.id,
        name,
        email,
        rutDni: rutDni || 'Sin DNI',
        department: department || 'Comunidad'
      })
    });

    const json = await res.json();
    if (!res.ok) {
      showToast(json.message || 'No se pudieron actualizar tus datos en el servidor', 'error');
      return;
    }

    if (json.data) {
      state.currentUser = { ...state.currentUser, ...json.data };
    } else {
      state.currentUser.name = name;
      state.currentUser.email = email;
      state.currentUser.rutDni = rutDni || 'Sin DNI';
      state.currentUser.department = department || 'Comunidad';
    }

    saveSessionUser(state.currentUser);
    renderNavForRole(state.currentUser.role);
    syncSettingsAccountTab();
    showToast('Tus datos de perfil se han actualizado en la base de datos', 'success');
  } catch (err) {
    console.error('Error al actualizar perfil:', err);
    showToast('Error al guardar tus datos de perfil', 'error');
  }
}

async function handleSettingsPasswordSubmit(e) {
  e.preventDefault();
  if (!state.currentUser || state.currentUser.role === 'invitado') {
    showToast('Debes iniciar sesión para cambiar tu contraseña', 'error');
    return;
  }

  const currentPwdEl = document.getElementById('settings-current-pwd');
  const newPwdEl = document.getElementById('settings-new-pwd');
  const confirmPwdEl = document.getElementById('settings-confirm-pwd');
  const currentPassword = currentPwdEl ? currentPwdEl.value.trim() : '';
  const newPassword = newPwdEl ? newPwdEl.value.trim() : '';
  const confirmPassword = confirmPwdEl ? confirmPwdEl.value.trim() : '';

  if (!currentPassword) {
    showToast('Debes ingresar tu contraseña actual', 'error');
    if (currentPwdEl) currentPwdEl.focus();
    return;
  }

  if (newPassword.length < 4) {
    showToast('La contraseña debe tener al menos 4 caracteres', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('Las contraseñas no coinciden', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: userHeaders(),
      body: JSON.stringify({ email: state.currentUser.email, currentPassword, newPassword })
    });

    const json = await res.json();
    if (!res.ok) {
      showToast(json.message || 'No se pudo actualizar la contraseña', 'error');
      return;
    }

    if (currentPwdEl) currentPwdEl.value = '';
    if (newPwdEl) newPwdEl.value = '';
    if (confirmPwdEl) confirmPwdEl.value = '';
    showToast('¡Tu contraseña ha sido actualizada con éxito!', 'success');
  } catch (err) {
    console.error('Error al cambiar contraseña desde ajustes:', err);
    showToast('Error de conexión con el servidor', 'error');
  }
}

function init() {
  // Eventos de Tema Rápido y Modal de Configuraciones del Sistema
  const btnQuickTheme = document.getElementById('btn-quick-theme-toggle');
  if (btnQuickTheme) {
    btnQuickTheme.addEventListener('click', toggleQuickTheme);
  }

  const btnOpenSysSettings = document.getElementById('btn-open-system-settings');
  if (btnOpenSysSettings) {
    btnOpenSysSettings.addEventListener('click', () => openSystemSettingsModal('appearance'));
  }

  const btnCloseSysSettings = document.getElementById('btn-close-system-settings');
  if (btnCloseSysSettings) {
    btnCloseSysSettings.addEventListener('click', closeSystemSettingsModal);
  }

  const btnSaveCloseSysSettings = document.getElementById('btn-save-close-system-settings');
  if (btnSaveCloseSysSettings) {
    btnSaveCloseSysSettings.addEventListener('click', () => {
      closeSystemSettingsModal();
      showToast('Configuraciones guardadas y aplicadas', 'success');
    });
  }

  const btnResetSysSettings = document.getElementById('btn-reset-system-settings');
  if (btnResetSysSettings) {
    btnResetSysSettings.addEventListener('click', resetSystemSettings);
  }

  const btnExportPrefs = document.getElementById('btn-export-system-prefs');
  if (btnExportPrefs) {
    btnExportPrefs.addEventListener('click', exportSystemSettings);
  }

  const modalSysSettings = document.getElementById('modal-system-settings');
  if (modalSysSettings) {
    modalSysSettings.addEventListener('click', (e) => {
      if (e.target === modalSysSettings) closeSystemSettingsModal();
    });
  }

  document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-settings-tab');
      if (tab) switchSettingsTab(tab);
    });
  });

  const formSettingsProfile = document.getElementById('form-settings-profile');
  if (formSettingsProfile) {
    formSettingsProfile.addEventListener('submit', handleSettingsProfileSubmit);
  }

  const formSettingsPwd = document.getElementById('form-settings-password');
  if (formSettingsPwd) {
    formSettingsPwd.addEventListener('submit', handleSettingsPasswordSubmit);
  }

  const btnToggleSettingsPwd = document.getElementById('btn-toggle-settings-pwd');
  if (btnToggleSettingsPwd) {
    btnToggleSettingsPwd.addEventListener('click', () => {
      const input = document.getElementById('settings-new-pwd');
      if (input) {
        input.setAttribute('type', input.getAttribute('type') === 'password' ? 'text' : 'password');
      }
    });
  }

  const btnSaveDefaultReporter = document.getElementById('btn-save-default-reporter');
  if (btnSaveDefaultReporter) {
    btnSaveDefaultReporter.addEventListener('click', () => {
      const val = document.getElementById('pref-input-default-reporter')?.value.trim() || '';
      systemPrefs.defaultReporter = val;
      saveSystemPrefsToStorage();
      applySystemPrefs();
      showToast(val ? `Alias "${val}" guardado para tus reportes` : 'Alias predeterminado borrado', 'success');
    });
  }

  Object.entries(PREF_BUTTONS).forEach(([selector, [attr, key, fallback]]) => {
    document.querySelectorAll(selector).forEach(btn => {
      btn.addEventListener('click', () => setPref(key, btn.getAttribute(attr) || fallback));
    });
  });

  Object.entries(PREF_TOGGLES).forEach(([id, key]) => {
    const chk = document.getElementById(id);
    if (!chk) return;
    chk.addEventListener('change', (e) => {
      setPref(key, e.target.checked);
      if (key === 'soundAlerts' && systemPrefs.soundAlerts) playAlertTone('success', true);
    });
  });

  const btnTestSound = document.getElementById('btn-test-alert-sound');
  if (btnTestSound) {
    btnTestSound.addEventListener('click', () => {
      playAlertTone('success', true);
    });
  }

  document.getElementById('pref-select-default-sector')?.addEventListener('change', (e) => setPref('defaultSector', e.target.value));
  document.getElementById('pref-select-autosync')?.addEventListener('change', (e) => setPref('autoSyncSec', parseInt(e.target.value, 10) || 0));

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (systemPrefs.theme === 'system') applySystemPrefs();
    });
  }

  if (dom.currentUserBadge) {
    dom.currentUserBadge.classList.add('cursor-pointer');
    dom.currentUserBadge.setAttribute('title', 'Clic para abrir tu cuenta y cambiar tu contraseña');
    dom.currentUserBadge.addEventListener('click', () => {
      openSystemSettingsModal('account');
    });
  }
}

export { applySystemPrefs, toggleQuickTheme, openSystemSettingsModal, closeSystemSettingsModal, init };
