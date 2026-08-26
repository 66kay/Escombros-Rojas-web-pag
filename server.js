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

// Configuración de cifrado (ISO 27001 - AES-256)
const rawKey = process.env.ENCRYPTION_KEY || 'mauri-secret-key-13579-default-fallback';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(rawKey).digest(); // Clave de 32 bytes de forma segura
const IV_LENGTH = 16;

// Hash SHA-256 de la contraseña del Administrador (ISO 27001 - Almacenamiento seguro de credenciales)
const ADMIN_PASSKEY_HASH = process.env.ADMIN_PASSKEY_HASH || 'HASH_ROTADO_POR_SEGURIDAD';

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
const VISITS_FILE = path.join(__dirname, 'visits.json');

// Inicializar archivos
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(VISITS_FILE)) {
  fs.writeFileSync(VISITS_FILE, JSON.stringify({ totalPageViews: 0, uniqueIPs: [] }, null, 2));
}

// Control de visitas en memoria y persistente
const activeUsers = new Map();

function loadVisits() {
  try {
    return JSON.parse(fs.readFileSync(VISITS_FILE, 'utf8'));
  } catch (e) {
    return { totalPageViews: 0, uniqueIPs: [] };
  }
}

function saveVisits(data) {
  try {
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

// ==========================================
// CONFIGURACIÓN DE SEGURIDAD (HELMET, CORS, RATE LIMITS)
// ==========================================

// 1. Cabeceras de seguridad HTTP con Helmet (Configuración personalizada compatible con Google Fonts y Vite Dev)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "/fotosmauri/", "https://*"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      connectSrc: ["'self'", "http://localhost:3000", "ws://localhost:5173", "http://localhost:5173", "ws://127.0.0.1:5173", "http://127.0.0.1:5173", "http://127.0.0.1:3000"]
    }
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
  'https://escombrosamauryrojas.cl',
  'https://www.escombrosamauryrojas.cl'
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    // Permitir si está en la lista blanca o si termina en onrender.com (subdominios de Render)
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.onrender.com')) {
      return callback(null, true);
    }
    
    const msg = 'El control CORS bloquea el acceso desde el origen especificado.';
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
app.post('/api/contact', contactLimiter, (e, r) => {
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

// Eliminar una solicitud por ID (Requiere autorización)
app.delete('/api/contact/:id', authorizeAdmin, (req, res) => {
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

    fs.writeFileSync(DB_FILE, JSON.stringify(filteredData, null, 2));
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

  // Hashing de IP para cumplimiento de privacidad ISO 27001 (anonimización)
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
  const initLog = `[${timestamp}] [INFO] [IP: ${initIp}] Servidor Express de Base de Datos inicializado de acuerdo a la norma ISO 27001.\n`;
  fs.appendFileSync(LOG_FILE, initLog);
});
