import './style.css';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : '';


// ==========================================
// FORMULARIO DE CONTACTO SEGURO (ENCRIPTADO)
// ==========================================
const form = document.getElementById('secure-contact-form');
const formSubmitBtn = document.getElementById('form-submit-btn');
const successBanner = document.getElementById('form-success-banner');
const successBannerText = document.getElementById('success-banner-text');
const errorBanner = document.getElementById('form-error-banner');
const errorBannerText = document.getElementById('error-banner-text');

// Expresión regular para teléfono móvil (+569 o 9 dígitos)
const PHONE_REGEX = /^(\+?56)?\s?9\s?[0-9]{4}\s?[0-9]{4}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clearErrors() {
  document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
  successBanner.classList.add('hidden');
  errorBanner.classList.add('hidden');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const name = document.getElementById('form-name').value.trim();
  const phone = document.getElementById('form-phone').value.trim();
  const email = document.getElementById('form-email').value.trim();
  const service = document.getElementById('form-service').value;
  const message = document.getElementById('form-message').value.trim();
  const consent = document.getElementById('form-iso-consent').checked;

  let hasErrors = false;

  // Validación de seguridad de entradas
  if (name.length < 3) {
    document.getElementById('error-name').textContent = 'El nombre debe tener al menos 3 caracteres.';
    hasErrors = true;
  }
  
  if (!PHONE_REGEX.test(phone)) {
    document.getElementById('error-phone').textContent = 'Ingresa un número móvil válido (Ej: +56983274339 o 983274339).';
    hasErrors = true;
  }

  if (email && !EMAIL_REGEX.test(email)) {
    document.getElementById('error-email').textContent = 'Ingresa una dirección de correo electrónico válida.';
    hasErrors = true;
  }

  if (!service) {
    document.getElementById('error-service').textContent = 'Selecciona un tipo de servicio de la lista.';
    hasErrors = true;
  }

  if (message.length < 5) {
    document.getElementById('error-message').textContent = 'El mensaje debe detallar el tipo de servicio o dirección.';
    hasErrors = true;
  }

  if (!consent) {
    document.getElementById('error-consent').textContent = 'Debe aceptar los términos de privacidad y tratamiento seguro.';
    hasErrors = true;
  }

  if (hasErrors) {
    errorBanner.classList.remove('hidden');
    errorBannerText.textContent = 'Por favor corrige los fallos de validación en el formulario antes de enviar.';
    return;
  }

  // Enviar al servidor de Base de Datos Real
  try {
    formSubmitBtn.disabled = true;
    formSubmitBtn.textContent = 'Procesando datos de forma segura...';

    const response = await fetch(`${API_BASE_URL}/api/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nombre: name,
        telefono: phone,
        email: email || null,
        servicio: service,
        mensaje: message,
        consentimientoIso: consent
      })
    });

    const data = await response.json();

    if (response.ok) {
      successBanner.classList.remove('hidden');
      successBannerText.textContent = '¡Tu solicitud ha sido enviada con éxito! Nos contactaremos a la brevedad.';
      form.reset();
      
      // Actualizar el panel administrativo si la sesión está abierta
      if (getStoredKey()) {
        fetchDatabaseRecords();
        fetchAuditLogs();
      }
    } else {
      errorBanner.classList.remove('hidden');
      errorBannerText.textContent = data.error || 'Error de procesamiento en el servidor.';
    }

  } catch (error) {
    errorBanner.classList.remove('hidden');
    errorBannerText.textContent = 'Error de conexión con el servidor. Asegúrate de que el backend esté activo.';
  } finally {
    formSubmitBtn.disabled = false;
    formSubmitBtn.textContent = 'Enviar Mensaje de Contacto';
  }
});

// Vincular botones de selección de servicio rápido en tarjetas
const selectServiceBtns = document.querySelectorAll('.btn-select-service');
selectServiceBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const serviceName = btn.getAttribute('data-service');
    const formServiceSelect = document.getElementById('form-service');
    if (formServiceSelect) {
      formServiceSelect.value = serviceName;
    }
    const contactSection = document.getElementById('contact');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  });
});


// ==========================================
// AUTENTICACIÓN Y PANEL ADMINISTRATIVO PRIVADO
// ==========================================
const adminAuthBox = document.getElementById('admin-auth-box');
const adminProtectedContent = document.getElementById('admin-protected-content');
const adminPasskeyInput = document.getElementById('admin-passkey-input');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminLogoutBtn = document.getElementById('admin-logout-btn');
const adminAuthError = document.getElementById('admin-auth-error');

const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const dbEntriesBody = document.getElementById('db-entries-body');
const auditLogsOutput = document.getElementById('audit-logs-output');
const refreshAuditBtn = document.getElementById('refresh-audit-btn');

// Obtener clave almacenada temporalmente
function getStoredKey() {
  return sessionStorage.getItem('adminKey');
}

// Inicializar sesión si ya existe clave
function initAdminSession() {
  const key = getStoredKey();
  if (key) {
    adminAuthBox.classList.add('hidden');
    adminProtectedContent.classList.remove('hidden');
    fetchDatabaseRecords();
    fetchAuditLogs();
  } else {
    adminAuthBox.classList.remove('hidden');
    adminProtectedContent.classList.add('hidden');
  }
}

// Autenticar ante el servidor Express
adminLoginBtn.addEventListener('click', async () => {
  const enteredKey = adminPasskeyInput.value.trim();
  adminAuthError.textContent = '';

  if (!enteredKey) {
    adminAuthError.textContent = 'Ingresa una clave de administración.';
    return;
  }

  try {
    // Probar acceso solicitando logs con la clave provista en los encabezados
    const response = await fetch(`${API_BASE_URL}/api/audit`, {
      headers: {
        'x-admin-key': enteredKey
      }
    });

    if (response.ok) {
      // Clave válida
      sessionStorage.setItem('adminKey', enteredKey);
      adminPasskeyInput.value = '';
      initAdminSession();
    } else {
      const data = await response.json();
      adminAuthError.textContent = data.error || 'Clave de administración incorrecta.';
    }
  } catch (error) {
    adminAuthError.textContent = 'Error de comunicación. ¿El backend está encendido?';
  }
});

// Cerrar sesión
adminLogoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('adminKey');
  initAdminSession();
});

// Soporte para presionar 'Enter' en el campo de contraseña
adminPasskeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    adminLoginBtn.click();
  }
});

// Cambiar de Pestañas
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.getAttribute('data-tab');
    
    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
  });
});

// Cargar registros de la base de datos real (Requiere autorización)
async function fetchDatabaseRecords() {
  const key = getStoredKey();
  if (!key) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/contact`, {
      headers: {
        'x-admin-key': key
      }
    });
    
    if (!response.ok) throw new Error('No autorizado.');
    
    const records = await response.json();
    
    if (records.length === 0) {
      dbEntriesBody.innerHTML = `
        <tr>
          <td colspan="6" class="table-empty-msg">No hay solicitudes registradas en la base de datos.</td>
        </tr>
      `;
      return;
    }

    dbEntriesBody.innerHTML = '';
    records.forEach(item => {
      const row = document.createElement('tr');
      const dateStr = new Date(item.fecha).toLocaleString('es-CL');
      
      row.innerHTML = `
        <td><strong>${dateStr}</strong></td>
        <td>${item.nombre}</td>
        <td>
          <span style="color:#e63946;font-weight:600;">${item.telefono}</span>
          <br><small style="color:#64748b;font-size:9px;">[Cifrado AES-256 Descifrado al Vuelo]</small>
        </td>
        <td>
          <span>${item.email || '—'}</span>
          ${item.email ? `<br><small style="color:#64748b;font-size:9px;">[Cifrado AES-256 Descifrado al Vuelo]</small>` : ''}
        </td>
        <td><span class="calc-vol-badge" style="background-color:#d90429; color:white;">${item.servicio}</span></td>
        <td><div style="max-width:260px;white-space:normal;word-break:break-all;">${item.mensaje}</div></td>
      `;
      dbEntriesBody.appendChild(row);
    });

  } catch (error) {
    dbEntriesBody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty-msg" style="color:var(--accent-red);">
          Error al conectar con la base de datos segura o clave expirada.
        </td>
      </tr>
    `;
  }
}

// Cargar consola de logs de auditoría (Requiere autorización)
async function fetchAuditLogs() {
  const key = getStoredKey();
  if (!key) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/audit`, {
      headers: {
        'x-admin-key': key
      }
    });
    
    if (!response.ok) throw new Error('No autorizado.');
    
    const logs = await response.json();
    
    if (logs.length === 0) {
      auditLogsOutput.textContent = 'Consola limpia. No hay registros de eventos de seguridad registrados.';
      return;
    }

    auditLogsOutput.textContent = logs.join('\n');
    
    const logsConsole = document.querySelector('.logs-console pre');
    if (logsConsole) {
      logsConsole.scrollTop = logsConsole.scrollHeight;
    }

  } catch (error) {
    auditLogsOutput.textContent = 'Error al cargar los registros de auditoría de seguridad. No autorizado.';
  }
}

refreshAuditBtn.addEventListener('click', fetchAuditLogs);

// Inicializar vistas al arrancar
initAdminSession();
console.log('Escombros Amaury Rojas Web App: Inicialización de sesión completada.');

// ==========================================
// MODALES DE CUMPLIMIENTO (PRIVACIDAD Y TÉRMINOS)
// ==========================================
const modalPrivacy = document.getElementById('modal-privacy-policy');
const modalTerms = document.getElementById('modal-terms-conditions');

const linkPrivacy = document.getElementById('link-privacy-policy');
const linkTerms = document.getElementById('link-terms-conditions');

const btnClosePrivacy = document.getElementById('btn-close-privacy');
const btnClosePrivacyOk = document.getElementById('btn-close-privacy-ok');
const btnCloseTerms = document.getElementById('btn-close-terms');
const btnCloseTermsOk = document.getElementById('btn-close-terms-ok');

if (linkPrivacy && modalPrivacy) {
  linkPrivacy.addEventListener('click', (e) => {
    e.preventDefault();
    modalPrivacy.showModal();
  });
}

if (linkTerms && modalTerms) {
  linkTerms.addEventListener('click', (e) => {
    e.preventDefault();
    modalTerms.showModal();
  });
}

const closePrivacy = () => modalPrivacy && modalPrivacy.close();
const closeTerms = () => modalTerms && modalTerms.close();

if (btnClosePrivacy) btnClosePrivacy.addEventListener('click', closePrivacy);
if (btnClosePrivacyOk) btnClosePrivacyOk.addEventListener('click', closePrivacy);
if (btnCloseTerms) btnCloseTerms.addEventListener('click', closeTerms);
if (btnCloseTermsOk) btnCloseTermsOk.addEventListener('click', closeTerms);

// Cerrar al hacer clic fuera del modal (en el backdrop)
[modalPrivacy, modalTerms].forEach(modal => {
  if (modal) {
    modal.addEventListener('click', (e) => {
      const rect = modal.getBoundingClientRect();
      const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
      if (!isInDialog) {
        modal.close();
      }
    });
  }
});
