# POLÍTICA DE PRIVACIDAD
## PROYECTO: ESCOMBROS AMAURY ROJAS — RETIRO DE ESCOMBROS Y VENTA DE ÁRIDOS
**Última actualización: Agosto 2026**

La presente Política de Privacidad describe cómo **Escombros Amaury Rojas** (en adelante, la "Empresa"), recopila, utiliza, procesa y protege los datos personales de los usuarios (en adelante, el "Usuario") que contactan a la Empresa a través del formulario del sitio web o canales directos, de conformidad con la Ley N° 19.628 sobre Protección de la Vida Privada (Chile) y los lineamientos de la norma internacional **ISO/IEC 27001**.

---

### 1. Responsable del Tratamiento de Datos
* **Nombre Comercial:** Escombros Amaury Rojas
* **Dirección Física:** Av. Clotario Blest 2694, Pedro Aguirre Cerda, Santiago, Región Metropolitana
* **Correo de Contacto:** contacto@escombrosrojas.cl

---

### 2. Datos Personales que Recopilamos
A través del formulario de contacto web recopilamos la siguiente información estrictamente proporcional y necesaria para brindar nuestro servicio:
1. **Nombre Completo:** Para identificar al solicitante y personalizar el trato comercial.
2. **Número de Teléfono Móvil:** Para contactar directamente al cliente, coordinar visitas técnicas y enviar cotizaciones vía WhatsApp.
3. **Correo Electrónico (Opcional):** Para el envío formal de cotizaciones escritas y confirmaciones de servicio.
4. **Mensaje / Detalles del Requerimiento:** Descripción del volumen estimado de escombros, tipo de árido solicitado, accesos o dirección aproximada del terreno.

---

### 3. Finalidad del Tratamiento
Los datos personales proporcionados serán utilizados exclusivamente para los siguientes fines:
* Elaborar presupuestos y cotizaciones de venta de áridos, retiro de escombros, rebaje de terrenos y demoliciones.
* Coordinar la logística, despacho y transporte de camiones tolva al domicilio del cliente.
* Enviar notificaciones relativas a la programación, retrasos por tráfico o estado del servicio en terreno.
* Registrar las operaciones en los registros internos de auditoría de seguridad del sistema.

---

### 4. Seguridad de la Información (ISO/IEC 27001)
La Empresa implementa controles técnicos y organizativos avanzados para salvaguardar la confidencialidad, integridad y disponibilidad de los datos:
* **Cifrado en Reposo (AES-256-CBC):** Los datos personales sensibles (número de teléfono y correo electrónico) son convertidos inmediatamente a un bloque de cifrado simétrico irreversible mediante una clave criptográfica de 256 bits y un vector de inicialización (IV) único por cada registro.
* **Base de Datos Protegida:** La información se almacena físicamente en el archivo `database.json`, ubicado fuera de la carpeta pública del servidor web para evitar accesos o descargas no autorizadas.
* **Logs de Auditoría:** Toda operación de acceso, envío o descifrado se registra de forma acumulativa e inalterable en `security_audit.log`, identificando marcas de tiempo e IPs de origen.
* **Sanitización de Entradas (XSS):** El sistema filtra e inactiva caracteres especiales de scripting para evitar la inyección de código malicioso en el navegador o en la base de datos.

---

### 5. Derechos de los Usuarios (Derechos ARCO)
El Usuario es propietario de sus datos personales y tiene derecho a ejercer el control sobre los mismos. De acuerdo con la legislación vigente, puede solicitar de manera gratuita:
* **Acceso:** Conocer qué datos de su persona están registrados en el sistema.
* **Rectificación:** Modificar datos erróneos, inexactos o incompletos.
* **Cancelación (Eliminación):** Solicitar la eliminación total de sus datos cuando ya no sean necesarios para la cotización o el servicio acordado.
* **Oposición:** Oponerse al uso de sus datos para fines específicos.

Para ejercer cualquiera de estos derechos, el Usuario debe enviar una solicitud formal por escrito al correo electrónico **contacto@escombrosrojas.cl**, detallando su nombre y el número telefónico que desea eliminar o corregir. La Empresa responderá a la solicitud en un plazo máximo de 10 días hábiles.

---

### 6. Consentimiento del Usuario
Al marcar activamente la casilla de verificación en el formulario de contacto web, el Usuario declara haber leído, comprendido y aceptado expresamente los términos de esta Política de Privacidad, otorgando su consentimiento inequívoco para que la Empresa procese y cifre sus datos según los estándares descritos.
