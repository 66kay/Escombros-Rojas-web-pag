import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Resolver __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Configuración de cifrado (ISO 27001 - AES-256)
const ENCRYPTION_KEY = crypto.createHash('sha256').update('mauri-secret-key-13579').digest(); // Clave de 32 bytes
const IV_LENGTH = 16;

// Hash SHA-256 de la contraseña "CLAVE_ADMIN_PLACEHOLDER" (ISO 27001 - Almacenamiento seguro de credenciales)
const ADMIN_PASSKEY_HASH = 'HASH_ROTADO_POR_SEGURIDAD';

// Función para cifrar texto
function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Función para descifrar texto
function decrypt(text) {
  if (!text) return '';
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return '[ERROR DE DESCIFRADO]';
  }
}

// Archivos de almacenamiento
const DB_FILE = path.join(__dirname, 'database.json');
const LOG_FILE = path.join(__dirname, 'security_audit.log');

// Inicializar archivos
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
}

// Helper para registro de Auditoría de Seguridad
function logSecurityEvent(level, message, ip) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] [IP: ${ip}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logEntry);
}

// Middleware de autorización para administradores (ISO 27001 - Hashing de credenciales)
function authorizeAdmin(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const adminKey = req.headers['x-admin-key'];
  
  if (!adminKey) {
    logSecurityEvent('WARN', 'Intento de acceso denegado: Cabecera x-admin-key ausente.', ip);
    return res.status(401).json({ error: 'Acceso no autorizado. Se requiere contraseña.' });
  }

  // Generar hash SHA-256 de la clave recibida
  const incomingHash = crypto.createHash('sha256').update(adminKey).digest('hex');

  if (incomingHash === ADMIN_PASSKEY_HASH) {
    next();
  } else {
    logSecurityEvent('WARN', `Intento de acceso fallido con clave incorrecta.`, ip);
    res.status(401).json({ error: 'Contraseña de administrador incorrecta.' });
  }
}

// Middleware
app.use(cors());
app.use(express.json());

// Sanitización de entradas básicas XSS
function sanitizeInput(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// ==========================================
// ENDPOINTS API
// ==========================================

// Registrar una nueva solicitud
app.post('/api/contact', (e, r) => {
  const ip = e.ip || e.connection.remoteAddress;
  
  try {
    let { nombre, telefono, email, servicio, mensaje, consentimientoIso } = e.body;

    if (!nombre || !telefono || !servicio || !mensaje) {
      logSecurityEvent('WARN', 'Fallo de validación: campos vacíos.', ip);
      return r.status(400).json({ error: 'Todos los campos obligatorios deben ser completados.' });
    }

    nombre = sanitizeInput(nombre);
    servicio = sanitizeInput(servicio);
    mensaje = sanitizeInput(mensaje);

    const encryptedEmail = encrypt(sanitizeInput(email));
    const encryptedPhone = encrypt(sanitizeInput(telefono));

    const dbData = JSON.parse(fs.readFileSync(DB_FILE));

    const newRequest = {
      id: crypto.randomUUID(),
      nombre,
      telefonoCifrado: encryptedPhone,
      emailCifrado: encryptedEmail,
      servicio,
      mensaje,
      fecha: new Date().toISOString(),
      estado: 'Pendiente de Contacto'
    };

    dbData.push(newRequest);
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));

    logSecurityEvent('INFO', `Nueva solicitud recibida. ID: ${newRequest.id}`, ip);

    r.status(201).json({
      success: true,
      message: 'Mensaje de contacto recibido correctamente.'
    });

  } catch (error) {
    logSecurityEvent('ERROR', `Error interno de procesamiento: ${error.message}`, ip);
    r.status(500).json({ error: 'Error del servidor al procesar el mensaje.' });
  }
});

// Obtener solicitudes descifradas (Requiere autorización)
app.get('/api/contact', authorizeAdmin, (e, r) => {
  const ip = e.ip || e.connection.remoteAddress;
  logSecurityEvent('INFO', 'Acceso autorizado al panel de solicitudes descifradas.', ip);

  try {
    const dbData = JSON.parse(fs.readFileSync(DB_FILE));

    const decryptedData = dbData.map(item => ({
      id: item.id,
      nombre: item.nombre,
      telefono: decrypt(item.telefonoCifrado),
      email: decrypt(item.emailCifrado),
      servicio: item.servicio,
      mensaje: item.mensaje,
      fecha: item.fecha,
      estado: item.estado
    }));

    r.json(decryptedData);
  } catch (error) {
    r.status(500).json({ error: 'Error al recuperar los registros del panel.' });
  }
});

// Obtener logs de auditoría (Requiere autorización)
app.get('/api/audit', authorizeAdmin, (e, r) => {
  const ip = e.ip || e.connection.remoteAddress;
  logSecurityEvent('INFO', 'Acceso autorizado a la consola de logs de auditoría.', ip);

  try {
    if (!fs.existsSync(LOG_FILE)) {
      return r.json([]);
    }
    const logContent = fs.readFileSync(LOG_FILE, 'utf8');
    const logLines = logContent.trim().split('\n').slice(-30);
    r.json(logLines);
  } catch (error) {
    r.status(500).json({ error: 'Error al cargar los logs.' });
  }
});

// Servir archivos estáticos del frontend en producción (carpeta dist generada por Vite)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}


app.listen(PORT, () => {
  console.log(`[BACKEND] Servidor base de datos seguro en ejecución en http://localhost:${PORT}`);
  const initIp = '127.0.0.1';
  const timestamp = new Date().toISOString();
  const initLog = `[${timestamp}] [INFO] [IP: ${initIp}] Servidor Express de Base de Datos inicializado de acuerdo a la norma ISO 27001.\n`;
  fs.appendFileSync(LOG_FILE, initLog);
});
