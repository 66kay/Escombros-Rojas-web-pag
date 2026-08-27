import './style.css';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : window.location.origin;

// Función para realizar un desplazamiento suave (smooth scroll) manual por software con curva de aceleración
// Optimizada a nivel GPU para lograr 144 FPS combinando con caché de coordenadas
function customSmoothScrollTo(targetPosition, duration = 650) {
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
  const website = document.getElementById('form-website') ? document.getElementById('form-website').value : '';

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

  if (message && message.length < 5) {
    document.getElementById('error-message').textContent = 'El mensaje debe detallar el tipo de servicio o dirección si se ingresa (mínimo 5 caracteres).';
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
        consentimientoIso: consent,
        website: website
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
      const badge = contactSection.querySelector('.section-badge');
      let offsetPosition;
      if (badge) {
        const badgeTop = badge.getBoundingClientRect().top + window.pageYOffset;
        offsetPosition = badgeTop - 135; // 80px cabecera + 55px (aprox 1.5cm) de margen
      } else {
        offsetPosition = contactSection.getBoundingClientRect().top + window.pageYOffset - 80;
      }

      customSmoothScrollTo(offsetPosition, 550);
    }
  });
});


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

// Caché de coordenadas de enlaces para evitar lecturas de diseño síncronas (Layout Thrashing) durante el scroll
let linkCoordinates = {};

function cacheLinkCoordinates() {
  navLinks.forEach(link => {
    const targetId = link.getAttribute('href');
    linkCoordinates[targetId] = {
      width: link.offsetWidth,
      left: link.offsetLeft
    };
  });
}

// Función para mover el subrayado deslizante utilizando la caché de coordenadas de alto rendimiento
function moveIndicator(activeLink) {
  if (!navIndicator || !activeLink) return;
  const targetId = activeLink.getAttribute('href');
  const coords = linkCoordinates[targetId];
  if (coords) {
    navIndicator.style.width = `${coords.width}px`;
    navIndicator.style.left = `${coords.left}px`;
  }
}

// Inicializar posición al cargar y al redimensionar la ventana
function initIndicator() {
  cacheLinkCoordinates();
  const activeLink = document.querySelector('.nav-link.active') || document.querySelector('.nav-link');
  if (activeLink) {
    moveIndicator(activeLink);
  }
}

window.addEventListener('resize', initIndicator);
// Asegurar que las fuentes y dimensiones estén cargadas completamente antes de cachear
window.addEventListener('load', initIndicator);
setTimeout(initIndicator, 200);

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
        let offsetPosition;
        
        if (targetId === '#services') {
          const badge = targetEl.querySelector('.section-badge');
          if (badge) {
            const badgeTop = badge.getBoundingClientRect().top + window.pageYOffset;
            offsetPosition = badgeTop - 115; // 80px cabecera + 35px (aprox 1cm) de margen
          } else {
            offsetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset - 80;
          }
        } else if (targetId === '#contact') {
          const badge = targetEl.querySelector('.section-badge');
          if (badge) {
            const badgeTop = badge.getBoundingClientRect().top + window.pageYOffset;
            offsetPosition = badgeTop - 135; // 80px cabecera + 55px (aprox 1.5cm) de margen
          } else {
            offsetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset - 80;
          }
        } else if (targetId === '#gallery') {
          const badge = targetEl.querySelector('.section-badge');
          if (badge) {
            const badgeTop = badge.getBoundingClientRect().top + window.pageYOffset;
            offsetPosition = badgeTop - 150; // 80px cabecera + 70px (2cm) de margen
          } else {
            offsetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset - 80;
          }
        } else {
          // Presupuesto y otros no se tocan (se alinean a ras: 80px)
          offsetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset - 80;
        }

        // Desactivar temporalmente la actualización automática del scrollspy
        isScrollingFromClick = true;
        
        // Mover indicador inmediatamente para mayor sensación de respuesta
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        moveIndicator(link);
        
        // Desplazamiento animado suave con curva de aceleración personalizada
        customSmoothScrollTo(offsetPosition, 650);
        
        // Reactivar scrollspy después de que termine la animación
        setTimeout(() => {
          isScrollingFromClick = false;
        }, 700);
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

// Variable para almacenar el ID del intervalo de tracking de visitas
let trackingIntervalId = null;

function startTrackingInterval() {
  if (!trackingIntervalId) {
    trackingIntervalId = setInterval(() => trackVisit(false), 30000);
  }
}

function stopTrackingInterval() {
  if (trackingIntervalId) {
    clearInterval(trackingIntervalId);
    trackingIntervalId = null;
  }
}

// Iniciar el intervalo de actualización de visitas recurrentes
startTrackingInterval();

// Pausar el intervalo cuando la pestaña se minimiza/oculta y reanudarlo cuando vuelve a ser activa
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopTrackingInterval();
  } else {
    // Actualizar datos de inmediato tras regresar a la pestaña
    trackVisit(false);
    startTrackingInterval();
  }
});
