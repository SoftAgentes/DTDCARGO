# Revisión de datos personales · Chatwoot en el VPS (E1) · 2026-10-29

> Skill `revisar-datos-ve`, paso 1.7 del programa [SDD-0582](../../specs/0582-chatwoot-piloto/checklist.md), SDD hija [0583](../../specs/0583-chatwoot-vps-e1/spec.md).
> **Alcance:** la instalación de Chatwoot CE `v4.19.1-ce` (`infra/chatwoot/`) antes de que entre ningún dato real. Canales (E4), historial de Kommo (E5), bot (E7) y borrado de Kommo (E8) tienen su propia revisión.
> Evidencia: código de la imagen fijada por digest (`sha256:04895c7b…`), leído dentro del contenedor, y el ensayo local con datos **sintéticos** (`infra/chatwoot/pruebas/ensayo-local.sh`). No se leyó ningún dato real ni de producción.
> **Esto no es asesoría legal.** Es un inventario técnico y una lista de preguntas para el abogado.

## 1 · Resumen

| Estado | Puntos |
|---|---|
| `ENCONTRADO` y arreglado en E1 | 7 (H1–H6, H11) |
| `ENCONTRADO`, para decidir o arreglar después | 4 (H7–H10) |
| `CORRECTO` | 5 |
| `NO VERIFICABLE` | 5 |

Marcos: **Venezuela** (CRBV arts. 28 y 60, Ley Especial contra los Delitos Informáticos arts. 20–22) aplica siempre. **PIPL** aplica si alguien que atiende en Chatwoot trabaja desde China: hoy es `NO VERIFICABLE` (N1). RGPD solo como referencia.

## 2 · Inventario de datos que Chatwoot va a tratar

Rutas en la imagen (`/app/db/schema.rb`). Las finalidades son las del programa; ningún campo tiene hoy datos.

| Tabla.campo | Qué es | Finalidad | Retención | Quién más lo ve |
|---|---|---|---|---|
| `contacts.name`, `last_name`, `middle_name` (`schema.rb:803`) | nombre del cliente o prospecto | atenderlo | **no definida** (H7) | agentes; respaldos 30 días |
| `contacts.email`, `phone_number`, `identifier` | correo, teléfono (E.164), id del canal | responderle por su canal | no definida | agentes; Meta/correo según canal (E4) |
| `contacts.location`, `country_code`, `additional_attributes`, `custom_attributes` | ciudad, país, empresa, atributos libres | contexto comercial | no definida | agentes |
| `contact_inboxes.source_id` (`schema.rb:788`) | id del contacto en el canal (número de WhatsApp, PSID) | enrutar | no definida | — |
| `messages.content`, `processed_message_content`, `additional_attributes` (`schema.rb:1443`) | **texto libre del cliente**: puede traer documento, dirección, datos de salud o de terceros | la conversación | no definida | agentes; bot (E7) |
| `attachments.coordinates_lat`, `coordinates_long` (`schema.rb:251`) | **geolocalización** (mensajes de ubicación de WhatsApp) — dato sensible para la skill | recogida/entrega | no definida | agentes |
| `attachments` + `active_storage_blobs` (archivos en `/app/storage`) | fotos, audios, documentos (pueden ser de identidad) | la conversación | no definida | agentes; respaldos |
| `notes.content` (`schema.rb:1477`) | notas internas sobre el contacto | seguimiento | no definida | agentes |
| `csat_survey_responses.feedback_message` (`schema.rb:1136`) | opinión del cliente | calidad | no definida | agentes |
| `users.name`, `email` (`schema.rb:1733`) | agentes (Sam y una persona, E0-D2) | acceso | mientras trabajen | — |
| `users.current_sign_in_ip`, `last_sign_in_ip` | **IP de los agentes** (Devise trackable) | seguridad de la sesión | se sobrescribe en cada ingreso | — |
| `audits.audited_changes`, `remote_address` (`schema.rb:267`) | cambios y la IP de quien los hizo | auditoría | no definida | — |
| logs de Rails y Sidekiq (stdout → json-file) | pedidos, trabajos, errores | operación | 10 MB × 5 por contenedor (rotación) | quien tenga el VPS |
| respaldos (`/srv/backups/chatwoot`, B2) | todo lo anterior, cifrado con `age` | recuperación | 7 días local, 30 días B2 | Backblaze (cifrado, sin la clave) |

**Titulares que no son usuarios (punto 12):** todos los contactos. Son clientes y prospectos que escriben por WhatsApp, Instagram, Facebook o correo y nunca pasaron por un registro de DTD. Hoy los trata Kommo; con Chatwoot pasan a la infraestructura propia.

## 3 · Hallazgos

### Arreglados en E1 (con prueba)

**H1 · El payload del cliente iba al log en cada reintento del bot — ENCONTRADO → arreglado.**
`app/jobs/agent_bots/webhook_job.rb:13` escribe `payload=#{payload.to_json}`: el mensaje, el nombre, el correo y el teléfono del cliente (CW-4). Además, ActiveJob registra los argumentos de cada trabajo y el manejador de errores de Sidekiq 7.3 (`Sidekiq::Config::ERROR_HANDLER`) vuelca el trabajo entero con sus `args`. Por qué importa: los logs no tienen el control de acceso de la base, se copian para diagnosticar y no tienen retención pensada para datos personales (Ley de Delitos Informáticos, art. 20, acceso indebido; CRBV art. 28, control del titular sobre sus datos). **Arreglo:** `infra/chatwoot/rails/zz_dtd_redaccion_logs.rb` apaga `log_arguments`, reemplaza el manejador de Sidekiq por uno sin `args`, filtra `email`, `phone_number`, `content`, `name`, `q`… de los parámetros y pasa cada línea por un filtro de patrones. **Prueba con datos sintéticos y control:** sin el inicializador, la sonda encuentra correo, teléfono, contenido y `payload=` en los logs (A1); con él, cero (C6).

**H2 · El access log de Traefik guardaría correos y teléfonos — ENCONTRADO → arreglado.**
El log JSON de Traefik guarda la ruta con su query. La URL del SSO de Chatwoot es `/app/login?email=<correo>&sso_auth_token=<token>` (medido con la Platform API en el ensayo) y las búsquedas son `…/contacts/search?q=<teléfono>`. **Arreglo:** `observability.accesslogs=false` en los dos routers de Chatwoot (`compose.yml`); el log de Rails, ya filtrado, registra cada pedido. **Prueba:** el host de control (`whoami`) sí aparece en el access log y el de Chatwoot no (C5).

**H3 · Telemetría al hub de Chatwoot — ENCONTRADO → arreglado.**
`lib/chatwoot_hub.rb:88` manda a `hub.2.chatwoot.com` los conteos de cuentas, usuarios, bandejas, conversaciones y mensajes, salvo que exista `DISABLE_TELEMETRY`. **Arreglo:** `DISABLE_TELEMETRY=true`. Lo que sigue saliendo en la consulta de versión: id de instalación, versión, host y edición (`chatwoot_hub.rb:59-67`); ningún dato de contactos.

**H4 · Relay de notificaciones push — ENCONTRADO → arreglado.**
Con `ENABLE_PUSH_RELAY_SERVER` en su valor por defecto (true, `push_notification_service.rb:115`), las notificaciones para la app móvil viajan por `hub.2.chatwoot.com` con su título y cuerpo. **Arreglo:** `ENABLE_PUSH_RELAY_SERVER=false`. El aviso a los agentes lo hace Studio (E2.3).

**H5 · Gravatar recibe el MD5 del correo de cada contacto — ENCONTRADO → arreglado.**
`app/models/concerns/avatarable.rb:21-27` encola `Avatar::AvatarFromGravatarJob`, que pide `https://www.gravatar.com/avatar/<md5 del correo>`. Un MD5 de un correo se revierte con una lista de correos: es un dato personal que sale a un tercero (Automattic, EE. UU.) sin finalidad de DTD. **Arreglo:** `DISABLE_GRAVATAR=true` (el trabajo sale antes de pedir nada, `avatar_from_gravatar_job.rb:5`). **Prueba:** valor efectivo `true` (C7).

**H6 · El onboarding de la instalación crea un super admin para el primer visitante — ENCONTRADO → arreglado.**
Una instalación nueva redirige todo a `/installation/onboarding` (`dashboard_controller.rb:60`), donde cualquiera crea una cuenta con `super_admin: true` (`onboarding_controller.rb:8-15`); con la casilla de novedades marcada, además manda empresa, nombre y correo al hub (`:33-37`). Medido en el ensayo: `/app/login` daba 302 a esa pantalla. **Arreglo:** `/installation` va al router que solo admite la tailnet (403 desde internet, C4) y el runbook cierra el onboarding por consola antes del DNS (C4b).

**H11 · Con claves equivocadas, Chatwoot devuelve el sobre cifrado sin avisar — ENCONTRADO → arreglado en la restauración.**
`config/application.rb:80` fija `support_unencrypted_data = true`. Medido en el ensayo (R4): la misma base restaurada con **otras** claves no lanza ningún error; el secreto del webhook se lee como el sobre cifrado (`{"p":…`). Con tokens de WhatsApp o contraseñas IMAP pasaría lo mismo: los canales fallarían sin causa visible. **Arreglo:** `restaurar.sh` cuenta, después de arrancar, cuántas columnas cifradas devuelven un sobre y sale ≠ 0 si hay alguna (R4b). El `.env` viaja en el respaldo (`env.age`) y en el gestor de contraseñas de Sam.

### Para decidir o arreglar después

**H7 · No hay retención definida para conversaciones, contactos ni adjuntos — ENCONTRADO.**
Chatwoot no borra nada solo. El punto 5 de la skill pide un plazo y un camino de borrado. **Arreglo concreto:** decidir con el abogado un plazo (p. ej. N meses desde la última interacción si no es cliente del ERP) y programarlo en E6 o E8 como trabajo de Studio que borre por la API de Chatwoot (`DELETE /api/v1/accounts/{id}/contacts/{id}`), con conteo antes y después y con la nota de que los respaldos lo conservan 30 días más (como ya dice `/privacidad` §6).

**H8 · Correos de notificación a los agentes por Hostinger — ENCONTRADO.**
Chatwoot avisa por correo a los agentes (asignación, mención, mensaje nuevo según `notification_settings.email_flags`). El correo sale por el SMTP de Hostinger y puede llevar el nombre del contacto y un extracto del mensaje. Hostinger ya trata el correo de DTD, pero esto amplía lo que recibe. **Arreglo:** en E2.7, dejar las notificaciones por correo de cada agente en lo mínimo (sin «mensaje nuevo») y usar el aviso de Studio.

**H9 · Cloudflare vería todas las conversaciones si `chat.` va con proxy — ENCONTRADO (decisión de Sam).**
Con la nube naranja, Cloudflare termina TLS y ve cada mensaje y adjunto. **Actualizado el 2026-10-29 tras P2:** el VPS solo acepta tráfico web desde Cloudflare (`cloudflare-origin-firewall`, desde el 2026-10-22), así que sin proxy Chatwoot no es alcanzable. Cloudflare ya trata todo el tráfico de la web y de Supabase de DTD con datos de clientes; con proxy suma el contenido de las conversaciones. **Recomendación (E1-D9 revisada):** con proxy, y declarar a Cloudflare en el inventario de terceros como encargado del tráfico web de todo DTD (hoy esa fila no existe en la tabla 1). Decide Sam.

**H10 · Geolocalización y texto libre — ENCONTRADO (justificar).**
Chatwoot guarda la ubicación que el cliente mande por WhatsApp (`attachments.coordinates_*`) y cualquier cosa que escriba. No hay forma de no recibirlo. La justificación por escrito (punto 2) es la recogida y entrega de carga; hay que decirlo en la política (§5) y aplicar H7.

### Correcto

- **C1 · Respaldos cifrados y fuera del host.** `respaldo.sh` cifra con `age` antes de que nada toque el disco en claro (dump en `/dev/shm`, adjuntos por tubería), sube a B2 y retiene 30 días; la clave privada no vive en el servidor. Probado (R1, R1b, R2, R3).
- **C2 · Columnas cifradas.** Tokens de canales, contraseñas IMAP/SMTP, secretos de webhooks y 2FA van cifrados con Active Record Encryption (`config/application.rb:75-84`); el ensayo comprueba que el secreto queda cifrado en la base (R0) y que sin las claves no se recupera (R4; ver H11).
- **C3 · Sin geolocalización por IP.** Sin `IP_LOOKUP_API_KEY` no se descarga MaxMind ni se geolocaliza a nadie (`app/services/geocoder/setup_service.rb:7-10`).
- **C4 · Logs con tope.** json-file de 10 MB × 5 por contenedor (`compose.yml`, `x-logging`).
- **C5 · Registro cerrado.** Sin altas públicas: valor efectivo `false` y `POST /api/v1/accounts` → 404 (C2 del ensayo). Las cuentas las crea la Platform API (1.4), que solo ve las cuentas que ella creó (401 sobre otra, medido).

## 4 · No verificable

- **N1 · Dónde trabaja la persona que atiende.** Si es del equipo de China, aplica la PIPL (consentimiento separado para la transferencia, art. 39). Preguntar a Sam antes de E2.7.
- **N2 · El borrado de un contacto borra de verdad.** El código de Chatwoot borra conversaciones y mensajes en cascada, pero no se probó con un valor rastreable buscado en tablas, `audits`, logs, Redis y respaldos. Se propone hacerlo en E2.6 (revisar-datos-ve de Studio) con datos sintéticos.
- **N3 · La IP real de los agentes con Tailscale.** Que Traefik vea la `100.x` sin NAT se comprueba al instalar Tailscale (puerta P3).
- **N4 · Contrato con Backblaze** para los respaldos (cifrados): el mismo pendiente que en el inventario de terceros de DTD.
- **N5 · Lo que manda Meta a Chatwoot** (E4): webhooks y campos por canal.

## 5 · Nota sobre `/privacidad`

Para E1 **no hace falta cambiar** la página: Chatwoot corre en el mismo servidor (EE. UU., Contabo Inc.) que ya declara §5, los respaldos cifrados en otro proveedor también son los que declara §6, y con H3, H4, H5 y H9 resueltos no entra ningún tercero nuevo.

**Antes de E4** (cuando entren conversaciones reales), la página tiene que decir, en lenguaje simple y para que lo revise el abogado:
1. que DTD atiende por WhatsApp, Instagram, Facebook y correo con una herramienta propia alojada en sus servidores (finalidad: atención y cotización);
2. cuánto tiempo guarda las conversaciones (H7);
3. que puede recibir la ubicación que el cliente envíe (H10).
Antes de E7: que un asistente automático sugiere o da respuestas, y qué proveedor de IA ve los mensajes. El texto lo redacta el abogado; la regla de la skill es no prometer nada que el sistema no haga.

## 6 · Fuera de alcance (abogado)

La base de licitud para tratar los datos de prospectos que escriben por redes, el plazo de H7, el texto de `/privacidad` y los contratos con Backblaze, Hostinger y Meta.

---

Este reporte no es asesoría legal. Se sugiere que otro modelo revise el mismo alcance: un modelo no encuentra sus propios puntos ciegos.
