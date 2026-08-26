import './style.css';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : '';

// Función para realizar un desplazamiento suave (smooth scroll) manual por software con curva de aceleración
// Ahora corre a 144 FPS estables gracias a la optimización previa de peso y carga de imágenes
function customSmoothScrollTo(targetPosition, duration = 600) {
  const startPosition = window.pageYOffset || document.documentElement.scrollTop;
  const distance = targetPosition - startPosition;
  let startTime = null;

  function animation(currentTime) {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const run = easeInOutQuad(timeElapsed, startPosition, distance, duration);
    window.scrollTo(0, run);
    if (timeElapsed < duration) {
      requestAnimationFrame(animation);
    } else {
      window.scrollTo(0, targetPosition); // Asegurar posición exacta final
    }
  }

  function easeInOutQuad(t, b, c, d) {
    t /= d / 2;
    if (t < 1) return c / 2 * t * t + b;
    t--;
    return -c / 2 * (t * (t - 2) - 1) + b;
  }

  requestAnimationFrame(animation);
}

// Función para sanitizar HTML en el cliente (prevención de XSS - Defensa en Profundidad)
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}


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
      // Reiniciar animación de pulso de realce
      formServiceSelect.classList.remove('pulse-highlight');
      void formServiceSelect.offsetWidth; // Forzar reflow
      formServiceSelect.classList.add('pulse-highlight');
    }
    const contactSection = document.getElementById('contact');
    if (contactSection) {
      const headerOffset = 80;
      const elementPosition = contactSection.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      customSmoothScrollTo(offsetPosition, 450);
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
          <td colspan="7" class="table-empty-msg">No hay solicitudes registradas en la base de datos.</td>
        </tr>
      `;
      return;
    }

    dbEntriesBody.innerHTML = '';
    records.forEach(item => {
      const row = document.createElement('tr');
      const dateStr = new Date(item.fecha).toLocaleString('es-CL');
      
      row.innerHTML = `
        <td><strong>${escapeHTML(dateStr)}</strong></td>
        <td>${escapeHTML(item.nombre)}</td>
        <td>
          <span style="color:#e63946;font-weight:600;">${escapeHTML(item.telefono)}</span>
          <br><small style="color:#64748b;font-size:9px;">[Cifrado AES-256 Descifrado al Vuelo]</small>
        </td>
        <td>
          <span>${item.email ? escapeHTML(item.email) : '—'}</span>
          ${item.email ? `<br><small style="color:#64748b;font-size:9px;">[Cifrado AES-256 Descifrado al Vuelo]</small>` : ''}
        </td>
        <td><span class="calc-vol-badge" style="background-color:#d90429; color:white;">${escapeHTML(item.servicio)}</span></td>
        <td><div style="max-width:260px;white-space:normal;word-break:break-all;">${escapeHTML(item.mensaje)}</div></td>
        <td>
          <button class="btn-delete-record" data-id="${item.id}" style="background-color:#d90429; color:white; border:none; padding:6px 12px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:700; transition:var(--transition-smooth); box-shadow:0 2px 4px rgba(217,4,41,0.2);">
            ❌ Eliminar
          </button>
        </td>
      `;

      // Registrar evento para eliminar registro de forma interactiva
      const deleteBtn = row.querySelector('.btn-delete-record');
      deleteBtn.addEventListener('click', async () => {
        if (confirm(`¿Estás seguro de que deseas eliminar permanentemente la solicitud de "${item.nombre}"?`)) {
          try {
            const deleteRes = await fetch(`${API_BASE_URL}/api/contact/${item.id}`, {
              method: 'DELETE',
              headers: {
                'x-admin-key': key
              }
            });
            if (deleteRes.ok) {
              // Recargar la tabla tras eliminación exitosa
              loadDecryptedRecords(key);
            } else {
              const errData = await deleteRes.json();
              alert(`Error al eliminar: ${errData.error}`);
            }
          } catch (err) {
            alert('Error de red al intentar eliminar el registro.');
          }
        }
      });

      dbEntriesBody.appendChild(row);
    });

  } catch (error) {
    dbEntriesBody.innerHTML = `
      <tr>
        <td colspan="7" class="table-empty-msg" style="color:var(--accent-red);">
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
const linkPrivacyFooter = document.getElementById('footer-link-privacy');
const linkTermsFooter = document.getElementById('footer-link-terms');

const btnClosePrivacy = document.getElementById('btn-close-privacy');
const btnClosePrivacyOk = document.getElementById('btn-close-privacy-ok');
const btnCloseTerms = document.getElementById('btn-close-terms');
const btnCloseTermsOk = document.getElementById('btn-close-terms-ok');

const openPrivacyModal = (e) => {
  e.preventDefault();
  modalPrivacy && modalPrivacy.showModal();
};

const openTermsModal = (e) => {
  e.preventDefault();
  modalTerms && modalTerms.showModal();
};

if (linkPrivacy && modalPrivacy) linkPrivacy.addEventListener('click', openPrivacyModal);
if (linkPrivacyFooter && modalPrivacy) linkPrivacyFooter.addEventListener('click', openPrivacyModal);
if (linkTerms && modalTerms) linkTerms.addEventListener('click', openTermsModal);
if (linkTermsFooter && modalTerms) linkTermsFooter.addEventListener('click', openTermsModal);

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

// ==========================================
// TRANSICIONES DE NAVEGACIÓN FLUIDAS (SMOOTH SCROLL & INDICATOR SLIDER)
// ==========================================
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');
const navIndicator = document.querySelector('.nav-indicator');
const sections = document.querySelectorAll('section[id]');
let isScrollingFromClick = false;

// Función para mover el subrayado deslizante
function moveIndicator(activeLink) {
  if (!navIndicator || !activeLink || !navMenu) return;
  const menuRect = navMenu.getBoundingClientRect();
  const linkRect = activeLink.getBoundingClientRect();
  
  navIndicator.style.width = `${linkRect.width}px`;
  navIndicator.style.left = `${linkRect.left - menuRect.left}px`;
}

// Inicializar posición al cargar y al redimensionar la ventana
function initIndicator() {
  const activeLink = document.querySelector('.nav-link.active') || document.querySelector('.nav-link');
  if (activeLink) {
    moveIndicator(activeLink);
  }
}

window.addEventListener('resize', initIndicator);
setTimeout(initIndicator, 150);

// Configuración de IntersectionObserver para un Scroll Spy ultra-fluido (0 lag)
const observerOptions = {
  root: null,
  rootMargin: '-80px 0px -60% 0px', // Ajuste para navbar fijo y zona de interés del viewport
  threshold: 0
};

const observer = new IntersectionObserver((entries) => {
  if (isScrollingFromClick) return; // Evitar interferencias durante scroll por clic
  
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const sectionId = entry.target.getAttribute('id');
      const activeLink = document.querySelector(`.nav-menu a[href*="${sectionId}"]`);
      if (activeLink) {
        navLinks.forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');
        moveIndicator(activeLink);
      }
    }
  });
}, observerOptions);

sections.forEach(section => observer.observe(section));

// Clic en los enlaces de navegación
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    const targetId = link.getAttribute('href');
    if (targetId.startsWith('#')) {
      e.preventDefault();
      
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        const headerOffset = 80;
        const elementPosition = targetEl.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        // Desactivar temporalmente la actualización automática del scrollspy
        isScrollingFromClick = true;
        
        // Mover indicador inmediatamente para mayor sensación de respuesta
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        moveIndicator(link);
        
        customSmoothScrollTo(offsetPosition, 500);
        
        // Reactivar scrollspy después de que termine la animación
        setTimeout(() => {
          isScrollingFromClick = false;
        }, 550);
      }
    }
  });
});

// ==========================================
// SEGUIMIENTO DE VISITAS (REAL Y ACUMULADA)
// ==========================================
async function trackVisit(isInitial = false) {
  try {
    const url = `${API_BASE_URL}/api/visits`;
    const method = isInitial ? 'POST' : 'GET';
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    if (response.ok) {
      const data = await response.json();
      updateVisitorUI(data.activeOnline, data.totalPageViews);
    }
  } catch (error) {
    console.error('Error al registrar visita:', error);
  }
}

function updateVisitorUI(active, total) {
  const onlineCounter = document.getElementById('online-counter');
  const totalCounter = document.getElementById('total-counter');
  const onlineCounterFooter = document.getElementById('online-counter-footer');
  const totalCounterFooter = document.getElementById('total-counter-footer');

  if (onlineCounter) onlineCounter.textContent = active;
  if (totalCounter) totalCounter.textContent = total;
  if (onlineCounterFooter) onlineCounterFooter.textContent = active;
  if (totalCounterFooter) totalCounterFooter.textContent = total;
}

// Registrar visita (POST) al cargar la página por primera vez
trackVisit(true);

// Actualizar cantidad de usuarios activos en tiempo real cada 30 segundos usando GET (sin subir contador de visitas)
setInterval(() => trackVisit(false), 30000);
