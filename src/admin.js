import './style.css';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://escombros-amaury-rojas.onrender.com';

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
    const response = await fetch(`${API_BASE_URL}/api/audit`, {
      headers: {
        'x-admin-key': enteredKey
      }
    });

    if (response.ok) {
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
              fetchDatabaseRecords();
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
console.log('Escombros Amaury Rojas Admin Dashboard: Inicialización de sesión completada.');
