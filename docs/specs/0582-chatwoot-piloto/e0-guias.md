# Guías de E0 — SDD-0582

Guías para los pasos 0.3 a 0.7 que Sam y la IA hacen juntos. Todo es **solo lectura** en Meta, Kommo, Hostinger, Cloudflare y el VPS. La evidencia va al [registro E0](investigacion-2026-10-29-e0.md).

**Regla de valores:** en Git solo van conteos, sí/no y huellas. Los valores (IDs de Meta, URL de callback, números, correos y capturas) van a la **nota cifrada fuera de Git** descrita abajo.

## Dónde se guardan los valores previos

1. **Nota cifrada:** una nota segura en el gestor de contraseñas de Sam, llamada `DTD · 0582 · valores previos de Meta y Kommo · 2026-10-29`. Si Sam prefiere un archivo, se cifra con `age` para la misma clave pública que ya usan los respaldos (`/srv/ops/backup/age-recipients.txt`, ver `docs/runbooks/backup-restore-servidor.md:62-76`). El archivo `.age` vive fuera del repo.
2. **Huella en Git:** solo el nombre de la nota, la fecha, la cantidad de campos llenos y, si es archivo, el `sha256` del `.age` (nunca del texto plano).
3. **Capturas:** si se toman, van adjuntas a la nota cifrada y no a Git ni al chat.

<a id="03"></a>
## 0.3 — Inventario de Meta (gate bloqueante)

Sam entra a [business.facebook.com](https://business.facebook.com) con su usuario. **No se pulsa** ningún botón de agregar, quitar, conectar, migrar, registrar ni verificar. Si una pantalla pide confirmar algo, se cierra.

| # | Qué mirar | Dónde | Va a Git | Va a la nota cifrada |
|---|---|---|---|---|
| 1 | Portfolio comercial dueño del número | Configuración del negocio → Información del negocio | Sí/no: el portfolio es de DTD | ID del portfolio |
| 2 | Administradores y quién tiene 2FA | Configuración → Usuarios → Personas; Centro de seguridad | N.º de admins; 2FA obligatorio sí/no | Nombres de los admins |
| 3 | Cuentas de WhatsApp (WABA) | Configuración → Cuentas → Cuentas de WhatsApp | N.º de WABA; para cada una: **propiedad** o **compartida** | ID de cada WABA |
| 4 | Socios de cada WABA (Kommo como socio) | La misma pantalla → pestaña Socios | N.º de socios; Kommo sí/no | Nombre e ID del socio |
| 5 | Apps conectadas y usuarios del sistema | Configuración → Integraciones / Usuarios del sistema | N.º de apps y de usuarios del sistema | Nombres e IDs |
| 6 | Números de cada WABA | [WhatsApp Manager](https://business.facebook.com/wa/manage/phone-numbers/) → Números de teléfono | N.º de números; estado, nivel de mensajería y calidad | Phone Number ID y número |
| 7 | Verificación en dos pasos del número | WhatsApp Manager → número → Configuración → Verificación en dos pasos | PIN configurado sí/no | **No** se anota el PIN |
| 8 | Método de pago de WhatsApp | WhatsApp Manager → Configuración de la cuenta → Método de pago | Quién paga: DTD / Kommo / nadie | Últimos 4 dígitos, si es de DTD |
| 9 | Plantillas aprobadas | WhatsApp Manager → Plantillas de mensajes | N.º por estado (aprobada, rechazada, pausada) | Nombres |
| 10 | 2.º número / 2.ª WABA | Pantallas 3 y 6 | Sí/no; ¿se usa? | IDs |
| 11 | Enrutamiento de Messenger e Instagram | Configuración de la página de Facebook → Mensajería avanzada; Instagram → Apps conectadas | Quién es receptor principal (Kommo / Bandeja de Meta / otro) | Nombre de la app |
| 12 | Modelo de cuenta | Pantallas 3 y 4 juntas | «Propiedad de DTD + Kommo socio» u otra combinación | — |
| 13 | Verificación del negocio | Centro de seguridad | Verificado / en curso / no | — |

**Lo que la interfaz no muestra** (registro E0, M-6): las suscripciones de apps por WABA y los overrides de callback. Se leen por API con el token de la app propia de DTD **después de 4.1 y antes de 4.2**:

```text
GET /<WABA_ID>/subscribed_apps          → apps suscritas y override_callback_uri de cada una
GET /<PHONE_NUMBER_ID>?fields=...        → campos del número (el override por número no tiene GET documentado: NV)
```

El resultado va a la nota cifrada; en Git, solo cuántas apps hay y si existe override (sí/no). Sin esta lectura, **4.5 no arranca**.

**El gate 0.3 se aprueba** cuando las 13 filas tienen respuesta, la nota cifrada existe y Sam aprueba la vuelta atrás de abajo.

### Vuelta atrás de 4.5 (restaurar los valores previos)

Se usa si en la convivencia de 4.5 Kommo deja de recibir, se duplica algo o Sam lo pide. Objetivo: Kommo atendiendo solo en **15 minutos o menos**.

1. **Cortar la entrada en Chatwoot sin borrar la bandeja.** Desactivar la bandeja o quitarle el agente. Borrarla no restaura el override anterior (CW-2) y no aporta nada.
2. **Restaurar el override por número** al valor previo de la nota cifrada, con el token de la app de DTD: `POST /<PHONE_NUMBER_ID>` con `webhook_configuration.override_callback_uri` igual al valor previo, o `""` si no había.
3. **Restaurar las suscripciones de la WABA:** si la app de DTD no estaba suscrita antes, `DELETE /<WABA_ID>/subscribed_apps` con su token. Si había un override de WABA, volver a fijarlo con su valor previo.
4. **Comprobar:** un mensaje desde un teléfono de prueba entra en Kommo en menos de 1 minuto y Kommo puede contestarlo. Se anota la hora en el handoff.
5. **Pago:** el método de pago propio se queda; no se toca.
6. **Prohibido durante la vuelta atrás:** `/deregister`, `/register`, borrar el número, Embedded Signup y quitar a Kommo como socio.
7. **Registro:** qué paso se ejecutó, la hora UTC y el resultado, en el handoff de 4.5, sin valores.

Lo que esta vuelta atrás **no** recupera: los mensajes que entraron solo a Chatwoot durante la convivencia. Por eso 4.5 vigila «sin duplicados y sin pérdidas en ambos lados».

<a id="04"></a>
## 0.4 — Inventario de Kommo

Sam entra a Kommo; **no se enciende, apaga, edita ni borra nada**. Lo que el repo ya sabe está en el registro E0 (K-1 a K-12) y se confirma aquí.

### Los 15 Salesbots

Kommo → Configuración → Herramientas de comunicación → Salesbot, y Embudo → Automatizar.

| Bot (id) | Grupo | Activo hoy | Disparador | Temporizador | Efecto | Reemplazo en el plan |
|---|---|---|---|---|---|---|
| 38249 Bienvenida horario oficina | Antiguo | ¿? | Ninguno (2026-08-06) | — | Saludo + menú A–H | Contenido a la base (7.4) |
| 38711 Asignar asesor | Antiguo | ¿? | Ninguno | — | Cambia responsable, Round Robin | No aplica: 1 agente (E0-D2) |
| 38713 Solicitud de datos | Antiguo | ¿? | Ninguno | — | Pide datos y los guarda | No: lo hace el registro web |
| 38251 Carga marítima | Antiguo | ¿? | Ninguno | — | Condiciones del servicio | Base (7.4) |
| 38777 Atención al cliente | Antiguo | ¿? | Ninguno | — | Imagen + cambia etapa | No |
| 38773 Cursos | Antiguo | ¿? | Ninguno | — | Info de cursos | Base (7.4) |
| 38775 Asesorías personalizadas | Antiguo | ¿? | Ninguno | — | Info del servicio | Base (7.4) |
| 38715 Validación de proveedores | Antiguo | ¿? | Ninguno | — | Presencial vs. digital | Base (7.4) |
| 38771 Validación de mercancía | Antiguo | ¿? | Ninguno | — | Almacén vs. fábrica | Base (7.4) |
| 47639 NPS Bot | Antiguo | ¿? | Conversación cerrada | — | Encuesta (nunca corrió) | No |
| 54707 Chat del sitio | Antiguo | ¿? | Ninguno | — | Vacío (nunca corrió) | No |
| Ping 23 h — Leads Entrantes | Ping | ¿? | 23 h tras el último entrante | Siempre | Mensaje al cliente | 6.7 |
| Seguimiento antes de que cierre la ventana de 24 horas | Ping | ¿? | 23 h tras el último entrante | Siempre | Mensaje al cliente (Contacto inicial) | 6.7 |
| Ping 23 h — Recontacto | Ping | ¿? | 23 h tras el último entrante | Siempre | Mensaje al cliente | 6.7 |
| Aviso interno — ventana de 24 h por cerrarse | Ping | ¿? | 23 h tras el último entrante | Siempre | Tarea interna (vence en 1 h) | 6.7 |

Sam llena «Activo hoy» y corrige lo que haya cambiado desde agosto. Si hay más de 15 bots, se agregan filas.

### Otros puntos de 0.4

| # | Qué | Dónde | Va a Git |
|---|---|---|---|
| 1 | Agentes de IA (4) y si «analiza mi contestación» es uno de ellos u otra función | Kommo → IA | Encendido sí/no; dónde vive |
| 2 | Las 3 fuentes de texto que solo están en Kommo | Kommo → IA → Fuentes de conocimiento | Existen sí/no; n.º de caracteres. El texto va a la nota cifrada o a 7.3 |
| 3 | Usuarios y licencias | Configuración → Usuarios | N.º de usuarios y licencias |
| 4 | Plan, renovación y créditos (cierra E0-D5) | Configuración → Facturación | Plan, fecha de renovación, mensual/anual |
| 5 | Integraciones y widgets (nova-kommo, webhook de terceros) | Configuración → Integraciones | N.º; siguen activos sí/no |
| 6 | Canales conectados | Configuración → Herramientas de comunicación | Lista de canales y estado |
| 7 | Backup | Configuración → General → Exportar | Si existe la opción y qué incluye (no se descarga en 0.4: es 5.1) |

### Matriz de paridad de fuentes de leads

| Fuente | Hoy entra por | ¿El ERP depende? | Mañana entra por | Paso |
|---|---|---|---|---|
| WhatsApp API (número principal) | Canal nativo de Kommo | Sí: webhook `leads[add]`/`unsorted[add]` | Bandeja de Chatwoot + lead en el embudo propio | 4.5, 6.4 |
| Instagram DM | Canal nativo de Kommo | Solo espejo (sin teléfono) | Bandeja de Chatwoot | 4.6, 6.4 |
| Messenger | Canal nativo de Kommo | Solo espejo | Bandeja de Chatwoot | 4.4, 6.4 |
| Comentarios de IG y FB | Kommo + respuesta automática de Meta | No | A mano en Meta (fuera del 100 %) | — |
| TikTok | No entra | No | Condicional | 4.7 |
| Correo `info@` | No entra a Kommo | No | Bandeja de correo de Chatwoot | 4.8 |
| Web `/registro` | `kommo-push-client` (ensayo salvo variable) | Sí: escritura | Lead propio en Studio | 6.4, 8.7 |
| Formulario `/api/contact` | No va a Kommo (correo + Telegram) | No | Sin cambio o lead propio | 6.4 |
| Cotizador web | Solo cruce por teléfono con el espejo | Lectura | Embudo propio | 6.6 |
| Chat del sitio (Kommo) | Bot vacío, nunca corrió | No | — | — |
| UTM y atribución | Campos en Kommo que nadie escribe | No | Atribución propia | 6.4 |
| WeChat / 2.ª fuente WhatsApp | Desconectada o con error (2026-06) | No | — | Confirmar en fila 6 |

<a id="05"></a>
## 0.5 — Correo (lo que falta mirar)

Lo medido por DNS ya está en el registro (C-1 a C-6). Falta ver dentro de los paneles:

| # | Qué | Dónde | Va a Git |
|---|---|---|---|
| 1 | Si `info@` es buzón, alias o reenvío, y a dónde va | Hostinger → Correo → Cuentas / Reenvíos | Tipo y destino (rol, no la dirección) |
| 2 | El DKIM de Hostinger | Hostinger → Correo → DNS / Autenticación | Selector y si está publicado en Cloudflare |
| 3 | Dominios de recepción de Resend y webhooks | Resend → Domains, Receiving y Webhooks | Si hay recepción activa; n.º de webhooks y a qué ruta |
| 4 | Remitente vivo de `mail_config` | Lectura de una fila de configuración del ERP | Sin PII, pero es lectura de producción: pide OK aparte si se necesita |

<a id="06"></a>
## 0.6 — Prueba de extracción de Kommo (con OK nominal de lectura de PII)

**Puerta:** OK nominal de Sam para esta operación exacta: *leer por API, desde el VPS, los mensajes de hasta 20 conversaciones de Kommo, sin guardar su texto*.

1. **Token:** el que ya usa el ERP (`kommo_token_dtd_v1` en Vault). Se lee en memoria dentro del VPS y no se imprime (solo su largo).
2. **Alcance:** `GET /api/v4/talks/{id}/messages` exige «External chat history». Si responde 401/403, ese es el resultado: el token actual no alcanza y E5 necesita una integración nueva (escritura en Kommo, OK aparte).
3. **Enumeración:** de dónde salen los `talk_id` (eventos `incoming_chat_message`, el webhook `talk` o los leads) y cuántos hay.
4. **Paginación y límites:** tipo de paginación, tamaño de página, límite de velocidad y fecha más antigua alcanzable.
5. **Muestra:** 20 conversaciones repartidas por canal (WhatsApp, Instagram, Messenger) y antigüedad.
6. **Salida en Git:** solo conteos: mensajes por conversación, tipos de adjunto, rango de fechas, campos presentes (nombres de campo, no valores), errores y tiempos.
7. **Nada en disco:** los cuerpos se descartan en memoria. Si hay que mirar un mensaje concreto, se hace con Sam en pantalla, no en un archivo.
8. **Resultado:** ratifica o reestima E5 (5.2–5.5).

<a id="07"></a>
## 0.7 — Expedientes de trámites largos

Un expediente por trámite. En Git, solo la tabla; las capturas y los números de caso van a la nota cifrada.

| Trámite | Para qué paso | Dueño | Estado | Abierto el | Plazo típico | Siguiente acción |
|---|---|---|---|---|---|---|
| Verificación del negocio en Meta | 4.1, 4.4, 4.6 | Sam | Se lee en 0.3 fila 13 | — | 1–4 semanas | Si no está verificado, Sam la inicia |
| Método de pago propio de WhatsApp | 4.5 | Sam | Se lee en 0.3 fila 8 | — | Inmediato | Sam agrega la tarjeta de DTD en WhatsApp Manager |
| Acceso avanzado de Messenger (App Review) | 4.4 | IA + Sam | No abierto | — | 1–2 semanas | Después de 4.1 |
| Permisos de Instagram (App Review) | 4.6 | IA + Sam | No abierto | — | 1–3 semanas | Después de 4.1 |
| Elegibilidad de TikTok en Venezuela | 4.7 | IA | No abierto | — | Desconocido | Consulta; salida si no hay elegibilidad |

**0.7 se entrega** cuando las dos primeras filas están leídas, el método de pago propio está **comprobado** (T) y cada trámite largo tiene su fecha de apertura o la razón por la que espera.
