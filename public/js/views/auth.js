// Sesión: login, registro, logout, Google y modal de cambio de contraseña.

import { GUEST_USER, ROLE_PERMISSIONS } from '../config.js';
import { loadIncidents, loadAdminUsers, userHeaders } from '../data.js';
import { switchView, renderNavForRole } from '../nav.js';
import { saveSessionUser, state } from '../state.js';
import { showToast } from '../ui.js';

const dom = {
  modalChangePassword: document.getElementById('modal-change-password'),
  changePwdTargetId: document.getElementById('change-pwd-target-id'),
  changePwdTargetEmail: document.getElementById('change-pwd-target-email'),
  changePwdUserName: document.getElementById('change-pwd-user-name'),
  changePwdUserEmail: document.getElementById('change-pwd-user-email'),
  changePwdTitle: document.getElementById('change-pwd-modal-title'),
  currentPasswordGroup: document.getElementById('current-password-group'),
  inputCurrentPassword: document.getElementById('input-current-password'),
  inputNewPassword: document.getElementById('input-new-password'),
  inputConfirmPassword: document.getElementById('input-confirm-password'),
  authInputEmail: document.getElementById('auth-input-email'),
  authInputPassword: document.getElementById('auth-input-password'),
  modalAuth: document.getElementById('modal-auth'),
  formAuthLogin: document.getElementById('form-auth-login'),
  btnOpenAuthModal: document.getElementById('btn-open-auth-modal'),
  btnCloseAuthModal: document.getElementById('btn-close-auth-modal'),
  btnTogglePassword: document.getElementById('btn-toggle-password'),
  formChangePassword: document.getElementById('form-change-password'),
  btnClosePasswordModal: document.getElementById('btn-close-password-modal'),
  btnCancelChangePwd: document.getElementById('btn-cancel-change-pwd'),
  btnToggleNewPwd: document.getElementById('btn-toggle-new-pwd'),
  btnToggleConfirmPwd: document.getElementById('btn-toggle-confirm-pwd')
};

// ==========================================
// Cambio de Contraseña (Admin & Propia Cuenta)
// ==========================================
function openChangePasswordForUser(userId, userName, userEmail) {
  if (!dom.modalChangePassword) return;

  if (dom.changePwdTargetId) dom.changePwdTargetId.value = userId || '';
  if (dom.changePwdTargetEmail) dom.changePwdTargetEmail.value = userEmail || '';
  if (dom.changePwdUserName) dom.changePwdUserName.textContent = userName || 'Usuario';
  if (dom.changePwdUserEmail) dom.changePwdUserEmail.textContent = userEmail || '';

  const isSelf = state.currentUser && state.currentUser.email === userEmail;
  const isAdminResettingOther = state.currentUser && state.currentUser.role === 'admin' && !isSelf && Boolean(userId);
  if (dom.changePwdTitle) {
    dom.changePwdTitle.textContent = isSelf ? 'Cambiar Mi Contraseña' : `Cambiar Clave: ${userName}`;
  }

  if (dom.currentPasswordGroup) {
    dom.currentPasswordGroup.classList.toggle('hidden', isAdminResettingOther);
  }
  if (dom.inputCurrentPassword) dom.inputCurrentPassword.value = '';
  if (dom.inputNewPassword) dom.inputNewPassword.value = '';
  if (dom.inputConfirmPassword) dom.inputConfirmPassword.value = '';

  dom.modalChangePassword.classList.remove('hidden');
  dom.modalChangePassword.classList.add('flex');
  if (!isAdminResettingOther && dom.inputCurrentPassword) {
    dom.inputCurrentPassword.focus();
  } else if (dom.inputNewPassword) {
    dom.inputNewPassword.focus();
  }
}

function openChangeMyPasswordModal() {
  if (!state.currentUser || state.currentUser.role === 'invitado') {
    showToast('Debes iniciar sesión para cambiar tu contraseña', 'info');
    openAuthModal();
    return;
  }

  const currentId = state.currentUser.id || '';
  const currentName = state.currentUser.name || 'Mi Cuenta';
  const currentEmail = state.currentUser.email || '';

  openChangePasswordForUser(currentId, currentName, currentEmail);
}

function closeChangePasswordModal() {
  if (!dom.modalChangePassword) return;
  dom.modalChangePassword.classList.add('hidden');
  dom.modalChangePassword.classList.remove('flex');
  if (dom.inputCurrentPassword) dom.inputCurrentPassword.value = '';
  if (dom.inputNewPassword) dom.inputNewPassword.value = '';
  if (dom.inputConfirmPassword) dom.inputConfirmPassword.value = '';
}

async function handleChangePasswordSubmit(e) {
  e.preventDefault();

  const targetId = dom.changePwdTargetId ? dom.changePwdTargetId.value : '';
  const targetEmail = dom.changePwdTargetEmail ? dom.changePwdTargetEmail.value : '';
  const currentPassword = dom.inputCurrentPassword ? dom.inputCurrentPassword.value.trim() : '';
  const newPassword = dom.inputNewPassword ? dom.inputNewPassword.value.trim() : '';
  const confirmPassword = dom.inputConfirmPassword ? dom.inputConfirmPassword.value.trim() : '';

  const isSelf = state.currentUser && state.currentUser.email === targetEmail;
  const isAdminResettingOther = state.currentUser && state.currentUser.role === 'admin' && !isSelf && Boolean(targetId);

  if (!isAdminResettingOther && !currentPassword) {
    showToast('Debes ingresar tu contraseña actual para confirmar el cambio', 'error');
    if (dom.inputCurrentPassword) dom.inputCurrentPassword.focus();
    return;
  }

  if (!newPassword || newPassword.length < 4) {
    showToast('La nueva contraseña debe tener al menos 4 caracteres', 'error');
    if (dom.inputNewPassword) dom.inputNewPassword.focus();
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('Las contraseñas no coinciden. Por favor verifícalas.', 'error');
    if (dom.inputConfirmPassword) dom.inputConfirmPassword.focus();
    return;
  }

  const submitBtn = document.getElementById('btn-submit-change-pwd');
  const originalContent = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></span>
      <span>Guardando...</span>
    `;
  }

  try {
    let res;
    if (isAdminResettingOther) {
      res = await fetch(`/api/admin/users/${targetId}/password`, {
        method: 'PATCH',
        headers: userHeaders(),
        body: JSON.stringify({ password: newPassword })
      });
    } else {
      res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: userHeaders(),
        body: JSON.stringify({ email: targetEmail, currentPassword, newPassword })
      });
    }

    const json = await res.json();
    if (!res.ok) {
      showToast(json.message || 'Error al cambiar contraseña', 'error');
      return;
    }

    showToast(json.message || '¡Contraseña actualizada correctamente!', 'success');
    closeChangePasswordModal();

    if (targetEmail === state.currentUser.email) {
      showToast('Tu clave ha sido actualizada. Se aplicará en tus próximos inicios de sesión.', 'info');
    }

    if (state.currentUser.role === 'admin') {
      await loadAdminUsers();
    }
  } catch (err) {
    console.error('Error al cambiar contraseña:', err);
    showToast('Error de conexión al actualizar contraseña', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalContent;
    }
  }
}

// ==========================================
// Cierre de Sesión Seguro (Inmediato y Fiable)
// ==========================================
function logout() {
  const previousName = state.currentUser ? state.currentUser.name : 'Usuario';

  // 1. Reestablecer estado local a invitado inmediatamente
  state.currentUser = { ...GUEST_USER };
  saveSessionUser(state.currentUser);

  // 2. Cerrar cualquier modal abierto y limpiar credenciales del formulario
  closeAuthModal();
  clearAuthLoginForm();

  // 3. Reconfigurar interfaz y cambiar a la vista de reporte ciudadano
  renderNavForRole('invitado');
  switchView('view-inicio');

  // 4. Mostrar confirmación visual al usuario
  showToast('Sesión cerrada con éxito. Regresaste a modo invitado público.', 'info');

  // 5. Notificar al servidor en segundo plano (no bloquea al usuario ni da error)
  try {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: previousName })
    }).catch(() => {});
  } catch (e) {}
}

// ==========================================
// Autenticación & Switch Rápido de Roles
// ==========================================
async function quickLogin(role) {
  if (role === 'invitado') {
    logout();
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    state.currentUser = json.user;
    saveSessionUser(state.currentUser);
    closeAuthModal();
    showToast(`Sesión activa: ${state.currentUser.name} (${state.currentUser.role})`, 'success');

    renderNavForRole(state.currentUser.role);
    switchView(ROLE_PERMISSIONS[state.currentUser.role].defaultView);
    await loadIncidents();
  } catch (err) {
    console.error('Error al cambiar de sesión:', err);
    showToast('Error al conectar con el servicio de autenticación', 'error');
  }
}

async function handleAuthLoginSubmit(e) {
  e.preventDefault();
  const email = dom.authInputEmail ? dom.authInputEmail.value.trim() : '';
  const password = dom.authInputPassword ? dom.authInputPassword.value.trim() : '';

  if (!email || !password) {
    showToast('Por favor ingresa tu correo/RUT y contraseña', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const json = await res.json();
    if (!res.ok) {
      showToast(json.message || 'Credenciales inválidas', 'error');
      return;
    }

    state.currentUser = json.user;
    saveSessionUser(state.currentUser);
    closeAuthModal();
    clearAuthLoginForm();

    const roleLabels = {
      vecino: 'Vecino Ciudadano',
      trabajador: 'Funcionario Municipal',
      admin: 'Super Administrador'
    };
    const roleText = roleLabels[state.currentUser.role] || state.currentUser.role;
    showToast(`¡Bienvenido(a), ${state.currentUser.name}! (${roleText})`, 'success');

    renderNavForRole(state.currentUser.role);
    switchView(ROLE_PERMISSIONS[state.currentUser.role].defaultView);
    await loadIncidents();
  } catch (err) {
    console.error('Error al iniciar sesión:', err);
    showToast('Error de conexión con el servidor', 'error');
  }
}

function switchAuthView(view) {
  const viewLogin = document.getElementById('auth-view-login');
  const viewRegister = document.getElementById('auth-view-register');
  const title = document.getElementById('auth-modal-title');
  const badge = document.getElementById('auth-modal-badge');
  const icon = document.getElementById('auth-modal-icon');
  const iconContainer = document.getElementById('auth-modal-icon-container');

  if (view === 'register') {
    if (viewLogin) viewLogin.classList.add('hidden');
    if (viewRegister) viewRegister.classList.remove('hidden');
    if (title) title.textContent = 'Registro de Vecino';
    if (badge) badge.textContent = 'Portal Ciudadano • Registro';
    if (icon) icon.textContent = 'how_to_reg';
    if (iconContainer) {
      iconContainer.className = 'w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md';
    }
    const nameInput = document.getElementById('register-input-name');
    if (nameInput) nameInput.focus();
  } else {
    if (viewRegister) viewRegister.classList.add('hidden');
    if (viewLogin) viewLogin.classList.remove('hidden');
    if (title) title.textContent = 'Acceso a CivicCore';
    if (badge) badge.textContent = 'Portal Ciudadano';
    if (icon) icon.textContent = 'account_balance';
    if (iconContainer) {
      iconContainer.className = 'w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-md';
    }
    if (dom.authInputEmail) dom.authInputEmail.focus();
  }
}

function openAuthModal() {
  switchAuthView('login');
  if (dom.authInputPassword) dom.authInputPassword.value = '';
  const regPwd = document.getElementById('register-input-password');
  const regConfirm = document.getElementById('register-input-confirm');
  if (regPwd) regPwd.value = '';
  if (regConfirm) regConfirm.value = '';

  dom.modalAuth.classList.remove('hidden');
  dom.modalAuth.classList.add('flex');
  if (dom.authInputEmail) dom.authInputEmail.focus();
}

function closeAuthModal() {
  dom.modalAuth.classList.add('hidden');
  dom.modalAuth.classList.remove('flex');
}

async function handleAuthRegisterSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const name = document.getElementById('register-input-name')?.value.trim();
  const email = document.getElementById('register-input-email')?.value.trim();
  const rutDni = document.getElementById('register-input-rut')?.value.trim();
  const password = document.getElementById('register-input-password')?.value.trim();
  const confirm = document.getElementById('register-input-confirm')?.value.trim();

  if (!name || !email || !password) {
    showToast('Por favor completa todos los campos obligatorios (*)', 'error');
    return;
  }

  if (!email.includes('@')) {
    showToast('Ingresa un correo electrónico válido', 'error');
    return;
  }

  if (password.length < 4) {
    showToast('La contraseña debe tener al menos 4 caracteres', 'error');
    return;
  }

  if (password !== confirm) {
    showToast('Las contraseñas no coinciden', 'error');
    return;
  }

  const btnSubmit = document.getElementById('btn-submit-register');
  const originalContent = btnSubmit ? btnSubmit.innerHTML : '';
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Creando cuenta de Vecino...';
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, rutDni })
    });

    const json = await res.json();
    if (!res.ok) {
      showToast(json.message || 'Error al registrar vecino', 'error');
      return;
    }

    state.currentUser = json.user;
    saveSessionUser(state.currentUser);
    closeAuthModal();
    clearAuthLoginForm();

    showToast(`¡Bienvenido(a), ${state.currentUser.name}! Cuenta de Vecino activada.`, 'success');
    renderNavForRole('vecino');
    switchView('view-vecino');
    await loadIncidents();
  } catch (err) {
    console.error('Error al registrar usuario:', err);
    showToast('Error de conexión con el servidor', 'error');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalContent;
    }
  }
}


// ==========================================
// Integración Oficial Google Identity Services (Cuentas Reales de Google)
// shortcut: solo funciona si index.html carga https://accounts.google.com/gsi/client (hoy no lo carga),
// y /api/auth/google no verifica la firma del token; verificarla en el servidor antes de cargar ese script.
// ==========================================
let googleAuthClientId = '';

async function loadGoogleAuthConfig() {
  try {
    const res = await fetch('/api/auth/google/config');
    const data = await res.json();
    if (data && data.clientId) {
      googleAuthClientId = data.clientId.trim();
      initGoogleClientIfReady();
    }
  } catch (err) {
    console.warn('Configuración de Google no disponible aún:', err);
  }
}

function initGoogleClientIfReady() {
  if (!googleAuthClientId || !window.google || !window.google.accounts || !window.google.accounts.id) {
    return;
  }

  try {
    window.google.accounts.id.initialize({
      client_id: googleAuthClientId,
      callback: handleGoogleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true
    });

    const containerLogin = document.getElementById('google-login-btn-container');
    if (containerLogin) {
      containerLogin.innerHTML = '';
      window.google.accounts.id.renderButton(containerLogin, {
        theme: 'outline',
        size: 'large',
        width: 360,
        text: 'continue_with',
        shape: 'rectangular'
      });
    }

    const containerReg = document.getElementById('google-reg-btn-container');
    if (containerReg) {
      containerReg.innerHTML = '';
      window.google.accounts.id.renderButton(containerReg, {
        theme: 'outline',
        size: 'large',
        width: 360,
        text: 'signup_with',
        shape: 'rectangular'
      });
    }
  } catch (err) {
    console.error('Error al inicializar Google Identity Services:', err);
  }
}

async function handleGoogleCredentialResponse(response) {
  if (!response || !response.credential) {
    showToast('No se recibió credencial de Google', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });

    const json = await res.json();
    if (!res.ok) {
      showToast(json.message || 'Error al autenticar con Google', 'error');
      return;
    }

    state.currentUser = json.user;
    saveSessionUser(state.currentUser);
    closeAuthModal();
    clearAuthLoginForm();

    showToast(`¡Bienvenido(a), ${state.currentUser.name}! Autenticado(a) con Google.`, 'success');
    renderNavForRole(state.currentUser.role);
    switchView(ROLE_PERMISSIONS[state.currentUser.role].defaultView);
    await loadIncidents();
  } catch (err) {
    console.error('Error al procesar login de Google:', err);
    showToast('Error de conexión con el servidor', 'error');
  }
}

// Borra correo/RUT y contraseña del formulario de inicio de sesión
function clearAuthLoginForm() {
  if (dom.formAuthLogin) dom.formAuthLogin.reset();
  if (dom.authInputEmail) dom.authInputEmail.value = '';
  if (dom.authInputPassword) {
    dom.authInputPassword.value = '';
    dom.authInputPassword.setAttribute('type', 'password');
  }
}

function init() {
  // Accesos a Modal de Auth / Botón de Header (Login / Logout)
  if (dom.btnOpenAuthModal) {
    dom.btnOpenAuthModal.addEventListener('click', () => {
      if (state.currentUser.role === 'invitado') {
        openAuthModal();
      } else {
        logout();
      }
    });
  }
  if (dom.btnCloseAuthModal) dom.btnCloseAuthModal.addEventListener('click', closeAuthModal);
  if (dom.modalAuth) {
    dom.modalAuth.addEventListener('click', (e) => {
      if (e.target === dom.modalAuth) closeAuthModal();
    });
  }
  if (dom.formAuthLogin) dom.formAuthLogin.addEventListener('submit', handleAuthLoginSubmit);

  // Formulario de Registro de Vecino
  const formAuthRegister = document.getElementById('form-auth-register');
  if (formAuthRegister) formAuthRegister.addEventListener('submit', handleAuthRegisterSubmit);


  // Toggle visibilidad de contraseña
  if (dom.btnTogglePassword) {
    dom.btnTogglePassword.addEventListener('click', () => {
      const t = dom.authInputPassword.getAttribute('type') === 'password' ? 'text' : 'password';
      dom.authInputPassword.setAttribute('type', t);
    });
  }

  // Eventos del Modal de Cambio de Contraseña
  if (dom.formChangePassword) dom.formChangePassword.addEventListener('submit', handleChangePasswordSubmit);
  if (dom.btnClosePasswordModal) dom.btnClosePasswordModal.addEventListener('click', closeChangePasswordModal);
  if (dom.btnCancelChangePwd) dom.btnCancelChangePwd.addEventListener('click', closeChangePasswordModal);
  if (dom.modalChangePassword) {
    dom.modalChangePassword.addEventListener('click', (e) => {
      if (e.target === dom.modalChangePassword) closeChangePasswordModal();
    });
  }

  if (dom.btnToggleNewPwd) {
    dom.btnToggleNewPwd.addEventListener('click', () => {
      const t = dom.inputNewPassword.getAttribute('type') === 'password' ? 'text' : 'password';
      dom.inputNewPassword.setAttribute('type', t);
    });
  }

  if (dom.btnToggleConfirmPwd) {
    dom.btnToggleConfirmPwd.addEventListener('click', () => {
      const t = dom.inputConfirmPassword.getAttribute('type') === 'password' ? 'text' : 'password';
      dom.inputConfirmPassword.setAttribute('type', t);
    });
  }
}

export { openChangePasswordForUser, openChangeMyPasswordModal, closeChangePasswordModal, logout, quickLogin, switchAuthView, openAuthModal, closeAuthModal, loadGoogleAuthConfig, init };
