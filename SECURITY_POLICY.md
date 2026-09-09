# DOCUMENTACIÓN DE SEGURIDAD - POLÍTICA Y BUENAS PRÁCTICAS
## PROYECTO: ESCOMBROS AMAURY ROJAS — RETIRO DE ESCOMBROS Y VENTA DE ÁRIDOS

Este documento detalla la implementación técnica y los controles de seguridad aplicados a esta plataforma web, los cuales están diseñados siguiendo buenas prácticas de seguridad de la información para garantizar la protección de los datos.

---

### 1. CIFRADO DE DATOS EN REPOSO (Buenas Prácticas de Criptografía)
Para garantizar la confidencialidad de la información personal de los clientes:
* **Algoritmo de cifrado**: Se utiliza el estándar avanzado de cifrado simétrico con autenticación **AES-256-GCM** (Advanced Encryption Standard con clave de 256 bits en modo Galois/Counter). Esto no solo cifra la información, sino que valida criptográficamente que no ha sido alterada en el disco.
* **Campos protegidos**: El número de teléfono (`telefonoCifrado`) y el correo electrónico (`emailCifrado`) son convertidos en bloques cifrados hexadecimales con su respectiva etiqueta de autenticación (Auth Tag) antes de persistirse físicamente en el archivo `database.json`.
* **Vector de inicialización (IV)**: Se genera un IV criptográfico único de 12 bytes mediante entropía aleatoria nativa por cada registro recibido, evitando patrones de descifrado y garantizando la unicidad.

---

### 2. REGISTROS Y MONITOREO DE EVENTOS (Supervisión de Seguridad)
El sistema genera logs de auditoría estrictos de tipo append-only (solo lectura/escritura acumulativa) en el archivo `security_audit.log`. Se registran las siguientes actividades críticas:
1. **INFO**: Inicializaciones de servidores y cargas del panel de administración (registro de lectura de datos).
2. **WARN**: Fallos en la entrada de datos, intentos de XSS bloqueados, o no aceptación de cláusulas de privacidad.
3. **ERROR**: Fallos internos del sistema.
4. **Metadatos registrados**: Marca de tiempo (ISO 8601 UTC), dirección IP del solicitante, resultado de la validación, y estado criptográfico.

---

### 3. DESARROLLO SEGURO Y PROTECCIÓN XSS
Para evitar ataques de inyección de código de scripts en el navegador (XSS) y manipulación de datos:
* **Sanitización de Entradas**: Tanto el formulario del navegador como el controlador del servidor analizan las cadenas de texto y neutralizan caracteres especiales (`&`, `<`, `>`, `"`, `'`, `/`) convirtiéndolos en entidades HTML seguras.
* **Separación de Entornos**: La base de datos (`database.json`) y el archivo de auditoría (`security_audit.log`) están ubicados en la raíz del backend del servidor, quedando completamente fuera del directorio público de recursos de Vite, impidiendo su descarga o lectura directa por usuarios web.

---

### 4. CONSENTIMIENTO DE TRATAMIENTO DE DATOS
* **Principio de proporcionalidad**: Solo se capturan los datos indispensables para contactar al usuario.
* **Consentimiento obligatorio**: El formulario no permite el envío a menos que el usuario marque activamente la casilla de consentimiento explícito donde acepta que sus datos serán tratados de manera cifrada y segura bajo las políticas de privacidad y seguridad de la información.
