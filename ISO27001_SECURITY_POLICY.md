# DOCUMENTACIÓN DE SEGURIDAD - POLÍTICA ISO 27001
## PROYECTO: MAURI — RETIRO DE ESCOMBROS Y VENTA DE ÁRIDOS

Este documento detalla la implementación técnica y los controles de seguridad aplicados a esta plataforma web de acuerdo con el estándar internacional **ISO/IEC 27001** (Sistemas de Gestión de Seguridad de la Información).

---

### 1. CIFRADO DE DATOS EN REPOSO (Control A.10.1 - Criptografía)
Para garantizar la confidencialidad de la información personal de los clientes (PII - Personally Identifiable Information):
* **Algoritmo de cifrado**: Se utiliza el estándar avanzado de cifrado simétrico **AES-256-CBC** (Advanced Encryption Standard con clave de 256 bits y encadenamiento de bloques de cifrado).
* **Campos protegidos**: El número de teléfono (`telefonoCifrado`) y el correo electrónico (`emailCifrado`) son convertidos en bloques cifrados hexadecimales antes de persistirse físicamente en el archivo `database.json`.
* **Vector de inicialización (IV)**: Se genera un IV criptográfico único de 16 bytes mediante entropía aleatoria nativa por cada registro recibido, evitando patrones lógicos de descifrado.

---

### 2. REGISTROS Y MONITOREO DE EVENTOS (Control A.12.4 - Registro y Supervisión)
El sistema genera logs de auditoría estrictos de tipo append-only (solo lectura/escritura acumulativa) en el archivo `security_audit.log`. Se registran las siguientes actividades críticas:
1. **INFO**: Inicializaciones de servidores y cargas del panel de administración (registro de lectura de datos).
2. **WARN**: Fallos en la entrada de datos, intentos de XSS bloqueados, o no aceptación de cláusulas de privacidad.
3. **ERROR**: Fallos internos del sistema.
4. **Metadatos registrados**: Marca de tiempo (ISO 8601 UTC), dirección IP del solicitante, resultado de la validación, y estado criptográfico.

---

### 3. DESARROLLO SEGURO Y PROTECCIÓN XSS (Control A.14.2 - Desarrollo Seguro)
Para evitar ataques de inyección de código de scripts en el navegador (XSS) y manipulación de datos:
* **Sanitización de Entradas**: Tanto el formulario del navegador como el controlador del servidor analizan las cadenas de texto y neutralizan caracteres especiales (`&`, `<`, `>`, `"`, `'`, `/`) convirtiéndolos en entidades HTML seguras.
* **Separación de Entornos**: La base de datos (`database.json`) y el archivo de auditoría (`security_audit.log`) están ubicados en la raíz del backend del servidor, quedando completamente fuera del directorio público de recursos de Vite, impidiendo su descarga o lectura directa por usuarios web.

---

### 4. CONSENTIMIENTO DE TRATAMIENTO DE DATOS (Control A.18 - Cumplimiento)
* **Principio de proporcionalidad**: Solo se capturan los datos indispensables para contactar al usuario.
* **Consentimiento obligatorio**: El formulario no permite el envío a menos que el usuario marque activamente la casilla de consentimiento explícito donde acepta que sus datos serán tratados de manera cifrada bajo la norma ISO 27001.
