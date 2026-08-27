import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

// Cargar variables de entorno desde el archivo .env
dotenv.config();

// Resolver __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Confianza en el Proxy Inverso (necesario para obtener la IP real del cliente detrás de Cloudflare, Heroku, Render, etc.)
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Validar que las variables de entorno críticas existan (Evitar fallbacks hardcodeados en producción)
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY === 'mauri-secret-key-13579-default-fallback') {
  console.error('[FATAL] ENCRYPTION_KEY no está definida en las variables de entorno (.env o Render). Por seguridad, el servidor se detendrá.');
  process.exit(1);
}
if (!process.env.ADMIN_PASSKEY_HASH) {
  console.error('[FATAL] ADMIN_PASSKEY_HASH no está definida en las variables de entorno (.env o Render). Por seguridad, el servidor se detendrá.');
  process.exit(1);
}

// Configuración de cifrado (Buenas Prácticas de Seguridad - AES-256)
const rawKey = process.env.ENCRYPTION_KEY;
// Si la clave provista es de 64 caracteres hex (32 bytes), la leemos como buffer hex.
// De lo contrario, le aplicamos hash SHA-256 para garantizar 32 bytes de entropía segura.
let ENCRYPTION_KEY;
if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
  ENCRYPTION_KEY = Buffer.from(rawKey, 'hex');
} else {
  ENCRYPTION_KEY = crypto.createHash('sha256').update(rawKey).digest();
}
const IV_LENGTH = 16;

const ADMIN_PASSKEY_HASH = process.env.ADMIN_PASSKEY_HASH;

// Función para cifrar texto con AES-256-GCM (Buenas Prácticas - Autenticación e Integridad)
function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(12); // IV de 12 bytes recomendado para GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

// Función para descifrar texto
function decrypt(text) {
  if (!text) return '';
  try {
    const parts = text.split(':');
    if (parts.length < 3) {
      // Fallback para registros antiguos creados con aes-256-cbc
      return decryptLegacyCBC(text);
    }
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = Buffer.from(parts[2], 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return '[ERROR DE DESCIFRADO]';
  }
}

// Descifrado heredado para compatibilidad con registros creados con AES-256-CBC
function decryptLegacyCBC(text) {
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return '[ERROR DE DESCIFRADO HEREDADO]';
  }
}

// Archivos de almacenamiento y directorio de persistencia
const DATA_DIR = process.env.DATA_DIR || __dirname;

// Asegurar existencia del directorio de datos de forma recursiva
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'database.json');
const LOG_FILE = path.join(DATA_DIR, 'security_audit.log');
const VISITS_FILE = path.join(DATA_DIR, 'visits.json');

// Inicializar archivos
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(VISITS_FILE)) {
  fs.writeFileSync(VISITS_FILE, JSON.stringify({ totalPageViews: 0, uniqueIPs: [] }, null, 2));
}

// Cola de escritura serializada para evitar condiciones de carrera (bloqueo virtual de BD)
let writeQueue = Promise.resolve();

async function saveDatabase(data) {
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        await fs.promises.writeFile(DB_FILE, JSON.stringify(data, null, 2));
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Almacén de sesiones activas del administrador en memoria (token => tiempo de expiración)
const activeSessions = new Map();

// Limpiar sesiones expiradas periódicamente cada 15 minutos
setInterval(() => {
  const now = Date.now();
  for (const [token, expiresAt] of activeSessions.entries()) {
    if (now > expiresAt) {
      activeSessions.delete(token);
    }
  }
}, 15 * 60 * 1000);

// Control de visitas en memoria y persistente
const activeUsers = new Map();
let lastKnownTotalPageViews = 0;

function loadVisits() {
  try {
    const data = JSON.parse(fs.readFileSync(VISITS_FILE, 'utf8'));
    if (data && typeof data.totalPageViews === 'number') {
      if (data.totalPageViews < lastKnownTotalPageViews) {
        data.totalPageViews = lastKnownTotalPageViews;
      } else {
        lastKnownTotalPageViews = data.totalPageViews;
      }
    }
    return data;
  } catch (e) {
    return { totalPageViews: lastKnownTotalPageViews, uniqueIPs: [] };
  }
}

function saveVisits(data) {
  try {
    if (data && typeof data.totalPageViews === 'number') {
      lastKnownTotalPageViews = Math.max(lastKnownTotalPageViews, data.totalPageViews);
    }
    fs.writeFileSync(VISITS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving visits:', e);
  }
}

// Helper para registro de Auditoría de Seguridad
function logSecurityEvent(level, message, ip) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] [IP: ${ip}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logEntry);
}

// Middleware de autorización para administradores (Validación de tokens de sesión temporales)
function authorizeAdmin(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    logSecurityEvent('WARN', 'Intento de acceso denegado: Token de autorización ausente o inválido.', ip);
    return res.status(401).json({ error: 'Acceso no autorizado. Sesión inválida o expirada.' });
  }

  const now = Date.now();
  if (activeSessions.has(token)) {
    const expiresAt = activeSessions.get(token);
    if (now <= expiresAt) {
      // Renovar sesión: extender por 2 horas desde el último acceso
      activeSessions.set(token, now + 2 * 60 * 60 * 1000);
      return next();
    } else {
      activeSessions.delete(token); // Limpiar expirada
    }
  }

  logSecurityEvent('WARN', 'Intento de acceso denegado: Token de sesión expirado o inexistente.', ip);
  return res.status(401).json({ error: 'Acceso no autorizado. Sesión inválida o expirada.' });
}

// ==========================================
// CONFIGURACIÓN DE SEGURIDAD (HELMET, CORS, RATE LIMITS)
// ==========================================

// Middleware para forzar HTTPS en producción (Detrás del proxy inverso de Render)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// 1. Cabeceras de seguridad HTTP con Helmet (Configuración personalizada compatible con Google Fonts y HSTS)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "http://localhost:3000", "ws://localhost:5173", "http://localhost:5173", "ws://127.0.0.1:5173", "http://127.0.0.1:5173", "http://127.0.0.1:3000"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  crossOriginEmbedderPolicy: false
}));

// 2. Control de CORS restringido a entornos locales de desarrollo y producción
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://escombros-rojas-web-pag.onrender.com',
  'https://escombros-amaury-rojas.onrender.com',
  'https://escombrosamauryrojas.cl',
  'https://www.escombrosamauryrojas.cl'
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    // Permitir solo si el origen está explícitamente en la lista blanca de producción/desarrollo
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    const msg = `El control CORS bloquea el acceso desde el origen especificado: ${origin}`;
    console.warn(`[CORS REJECTED] Origin: ${origin}`);
    return callback(new Error(msg), false);
  }
}));

// 3. Limitadores de frecuencia de peticiones (Rate Limiting)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // Límite de 200 peticiones por ventana por IP
  message: { error: 'Demasiadas solicitudes desde esta IP, por favor intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 solicitudes de contacto por IP cada 15 minutos (anti-spam)
  message: { error: 'Has excedido el límite de envíos de contacto. Por favor, espera 15 minutos antes de volver a intentarlo.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const visitsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 15, // Máximo 15 peticiones por minuto para el contador
  message: { error: 'Abuso de consultas de visitas detectado.' },
  standardHeaders: false,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 intentos por IP cada 15 minutos
  message: { error: 'Demasiados intentos de inicio de sesión fallidos. Por favor, espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar limitador global
app.use(globalLimiter);

// Parsear JSON
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
app.post('/api/contact', contactLimiter, async (e, r) => {
  const ip = e.ip || e.connection.remoteAddress;
  
  try {
    let { nombre, telefono, email, servicio, mensaje, consentimientoIso, website } = e.body;

    // Control Honeypot: si el bot llenó el campo oculto, simulamos éxito sin guardar
    if (website) {
      logSecurityEvent('INFO', 'Intento de spam bloqueado por honeypot.', ip);
      return r.status(201).json({
        success: true,
        message: 'Mensaje de contacto recibido correctamente.'
      });
    }

    if (!nombre || !telefono || !servicio) {
      logSecurityEvent('WARN', 'Fallo de validación: campos obligatorios vacíos.', ip);
      return r.status(400).json({ error: 'Todos los campos obligatorios deben ser completados.' });
    }

    nombre = sanitizeInput(nombre);
    servicio = sanitizeInput(servicio);
    mensaje = sanitizeInput(mensaje || '');

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
    await saveDatabase(dbData);

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

// Endpoint de Login de Administración (Generación de Tokens de sesión temporales)
app.post('/api/login', loginLimiter, (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const { password } = req.body;

  if (!password) {
    logSecurityEvent('WARN', 'Intento de login fallido: Contraseña ausente.', ip);
    return res.status(400).json({ error: 'Contraseña requerida.' });
  }

  // Generar hash SHA-256 de la clave recibida
  const incomingHash = crypto.createHash('sha256').update(password).digest('hex');

  // Asegurar compatibilidad si se guardó en env la contraseña en texto plano en vez del hash SHA-256
  let expectedHash = ADMIN_PASSKEY_HASH;
  if (ADMIN_PASSKEY_HASH.length !== 64 || !/^[0-9a-fA-F]+$/.test(ADMIN_PASSKEY_HASH)) {
    expectedHash = crypto.createHash('sha256').update(ADMIN_PASSKEY_HASH).digest('hex');
  }

  if (incomingHash === expectedHash) {
    // Generar token criptográfico aleatorio de sesión
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // 2 horas de duración
    activeSessions.set(token, expiresAt);

    logSecurityEvent('INFO', 'Sesión de administración iniciada con éxito.', ip);
    res.json({ success: true, token });
  } else {
    logSecurityEvent('WARN', 'Intento de login fallido: Contraseña incorrecta.', ip);
    res.status(401).json({ error: 'Contraseña de administrador incorrecta.' });
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

// Eliminar una solicitud por ID (Requiere autorización)
app.delete('/api/contact/:id', authorizeAdmin, async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const requestId = req.params.id;

  try {
    const dbData = JSON.parse(fs.readFileSync(DB_FILE));
    const initialLength = dbData.length;
    const filteredData = dbData.filter(item => item.id !== requestId);

    if (filteredData.length === initialLength) {
      logSecurityEvent('WARN', `Intento de eliminar ID inexistente: ${requestId}`, ip);
      return res.status(404).json({ error: 'La solicitud no existe.' });
    }

    await saveDatabase(filteredData);
    logSecurityEvent('INFO', `Solicitud eliminada correctamente. ID: ${requestId}`, ip);

    res.json({ success: true, message: 'Solicitud eliminada correctamente.' });
  } catch (error) {
    logSecurityEvent('ERROR', `Error al eliminar solicitud ${requestId}: ${error.message}`, ip);
    res.status(500).json({ error: 'Error interno al intentar eliminar la solicitud.' });
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

// Registrar visitas reales y acumuladas (Se llama al cargar la página)
app.post('/api/visits', visitsLimiter, (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  // 1. Actualizar usuarios activos (IP -> timestamp)
  activeUsers.set(clientIp, now);

  // Limpiar usuarios inactivos (> 2 minutos)
  for (const [ip, time] of activeUsers.entries()) {
    if (now - time > 120000) {
      activeUsers.delete(ip);
    }
  }

  // 2. Cargar y actualizar visitas totales y únicas
  const visitsData = loadVisits();
  visitsData.totalPageViews = (visitsData.totalPageViews || 0) + 1;

  // Hashing de IP para resguardar la privacidad del usuario (anonimización)
  const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex');
  if (!visitsData.uniqueIPs.includes(ipHash)) {
    visitsData.uniqueIPs.push(ipHash);
  }

  saveVisits(visitsData);

  res.json({
    activeOnline: activeUsers.size,
    totalPageViews: visitsData.totalPageViews,
    totalUniqueVisitors: visitsData.uniqueIPs.length
  });
});

// Obtener estado actual de visitas sin registrar una nueva vista (Se llama para polling)
app.get('/api/visits', visitsLimiter, (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  // Mantener al usuario actual en la lista de activos
  activeUsers.set(clientIp, now);

  // Limpiar usuarios inactivos (> 2 minutos)
  for (const [ip, time] of activeUsers.entries()) {
    if (now - time > 120000) {
      activeUsers.delete(ip);
    }
  }

  const visitsData = loadVisits();

  res.json({
    activeOnline: activeUsers.size,
    totalPageViews: visitsData.totalPageViews,
    totalUniqueVisitors: visitsData.uniqueIPs.length
  });
});

// Servir archivos estáticos del frontend en producción (carpeta dist generada por Vite)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}


app.listen(PORT, () => {
  console.log(`[BACKEND] Servidor base de datos seguro en ejecución en http://localhost:${PORT}`);
  const initIp = '127.0.0.1';
  const timestamp = new Date().toISOString();
  const initLog = `[${timestamp}] [INFO] [IP: ${initIp}] Servidor Express de Base de Datos inicializado de acuerdo a buenas prácticas de seguridad.\n`;
  fs.appendFileSync(LOG_FILE, initLog);
});
