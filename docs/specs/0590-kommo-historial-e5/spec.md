---
sdd: "0590"
title: "Historial de Kommo: respaldo cifrado fuera de Git y medición del volumen (E5 del programa SDD-0582, pasos 5.1 y 5.2)"
status: in-progress
author: "Claude Worker «E5 historial» (Sam)"
created: 2026-10-30
updated: 2026-11-06
supersedes: null
superseded_by: null
related: ["0582", "0043", "0082", "0391", "0535", "0587"]
confidencialidad: interno
---

# SDD-0590 — Historial de Kommo: respaldo y volumen (E5, pasos 5.1 y 5.2)

> **Solo lectura en Kommo y nada en Chatwoot.** Esta SDD cubre los pasos 5.1 y 5.2 de la etapa E5 del programa [SDD-0582](../0582-chatwoot-piloto/spec.md): respaldar el historial completo de Kommo, cifrado y fuera de Git, y medir su volumen para decidir qué se carga en la bandeja «Archivo Kommo». La carga (5.3 a 5.8) lleva otro OK de Sam y otra SDD o una ampliación de esta.

Programa: [SDD-0582](../0582-chatwoot-piloto/spec.md) · checklist: [filas 5.1 y 5.2](../0582-chatwoot-piloto/checklist.md) · prueba de extracción de E0: [0.6, X-1 a X-17](../0582-chatwoot-piloto/investigacion-2026-10-29-e0.md#06--prueba-de-extracción-de-kommo) · inventario de Kommo: [K-1 a K-22](../0582-chatwoot-piloto/investigacion-2026-10-29-e0.md#04--kommo-lo-que-el-repo-ya-sabe).

**Etiquetas de evidencia** (las del programa): **C** código leído en esta tarea, **D** documento o proveedor, **T** medido en la cuenta o el VPS de DTD, **R** probado en runtime, **I** inferencia, **NV** no verificado. Las citas de código son de la rama `codex/0582-e5-historial` (base `6d022e94b`). No se leyó ninguna fila de la base de producción de Studio.

## 1. Autorización y límites

- Sam, 2026-10-30, por el selector (texto que pasó el Director): «¿Qué historial de Kommo pasamos a Chatwoot (bandeja "Archivo Kommo", solo lectura)?» → **«Todo el historial»**; «¿Autorizas leer el historial de Kommo (con datos personales) para medir el volumen y preparar esa carga?» → **«Sí, autorizo la lectura»**.
- Esa autorización cubre **leer y contar**. «Todo» es la preferencia de Sam; esta SDD la mide y el Director la confirma con los números y la revisión de datos (§6).
- Límites: el token de Kommo no se imprime ni pasa por el chat; en el repo y en el handoff van solo conteos y nombres de campo; no se toca Chatwoot, Meta ni la base de producción de Studio; nada pesado sin turno del Director.

## 2. Punto de partida (lo que E0 ya midió)

| Hecho | Fuente | Etiqueta |
|---|---|---|
| Kommo **no tiene exportación ni copia de seguridad de chats** en los ajustes del espacio; avisa que algunas fuentes no guardan los archivos de más de 5 MB si no se descargan a tiempo | K-20 | T |
| El token del ERP (`kommo_token_dtd_v1`) **no alcanza** para `talks/{id}/messages` (403 «Invalid scope»); la integración privada «DTD 0582 historial (solo lectura)», con alcances `crm` y `list_external_messages`, sí (200 en las 20 de la muestra) | X-1, X-2, X-11, X-12 | R |
| Enumeración: los eventos `incoming_chat_message` y `outgoing_chat_message` traen `talk_id` y `origin`; 1.000 eventos (10 páginas de 100) cubren 12,6 días y 220 conversaciones | X-4 | R |
| Volumen: 2.358 entrantes en 30 días (unos 79 al día); historial alcanzable de al menos 2 años; orden de 10⁵ mensajes con los salientes | X-5, X-6, X-8 | R / I |
| Paginación de mensajes: `limit` + `page`; **204** cuando no hay más; `limit=250` trajo la conversación más larga (134) entera | X-15 | R |
| Campos del mensaje: `id`, `chat_id`, `type`, `message_type`, `text`, `created_at`, `sec_created_at`, `delivery_status`, `origin`, `author`, `recipient`, `attachment` (`type`, `file_name`, `link`) | X-13 | R |
| No hubo cabeceras de límite de velocidad ni 429 con 0,25 s entre llamadas | X-9 | R |
| Messenger no apareció en los eventos de los últimos 13 días | X-17 | R |
| El ERP no espeja el contenido de los mensajes | migración 0391 (`kommo_leads` guarda conteos y fechas, `supabase/migrations/0391_*.sql:51-54` según SDD-0587 §1.2) | C |

## 3. Diseño de 5.1 — respaldo cifrado fuera de Git

### 3.1 Dónde y con qué

- **Script:** [`infra/ops/kommo-historial/respaldar-historial.py`](../../../infra/ops/kommo-historial/respaldar-historial.py) (Python 3.12 de serie, sin dependencias) con [README](../../../infra/ops/kommo-historial/README.md) y 17 pruebas en [`pruebas/test_respaldar.py`](../../../infra/ops/kommo-historial/pruebas/test_respaldar.py) contra un servidor falso. Copia en el VPS: `/srv/ops/kommo-historial/` (0700).
- **Destino:** `/srv/backups/kommo/kommo-<stamp>/` en el VPS (0700), al lado de los respaldos de `dtd-cargo` y `chatwoot`. Fuera de Git.
- **Cifrado:** `age -R /srv/ops/backup/age-recipients.txt`: las dos claves públicas de los respaldos (`Sam-2026-10-29` y `Emergencia-2026-10-29`, creadas el 2026-10-29 con `nueva-llave-age-0583.ps1`). La privada vive con Sam (gestor de contraseñas y papel), nunca en el VPS ni en Git.
- **Token:** el de larga duración de la integración «DTD 0582 historial (solo lectura)». Sam lo genera en Kommo y lo pega por una terminal a `/dev/shm/k0582-e5` (0600, solo RAM) con `pegar-token-kommo-e5-0582.ps1` (notas compartidas de la sesión, fuera de Git). El script lo lee del archivo, nunca de argv, y `probar-token` muestra solo largo, alcances, días de vigencia y si entra a la cuenta.

### 3.2 Qué se respalda y cómo

| Qué | Endpoint | Método |
|---|---|---|
| Conversaciones (talks) | `GET /api/v4/talks/{id}` | Ids de los eventos de chat (X-4) más sondeo de ids sin eventos (`--sondear-huecos -1`: cada id entre el mínimo y el máximo que no aparece en los eventos se consulta; si existe, entra al respaldo) |
| Mensajes | `GET /api/v4/talks/{id}/messages?limit=250&page=N` hasta el 204 | X-15; cada mensaje lleva `_talk_id` |
| Eventos de chat | `GET /api/v4/events?filter[type]=…&filter[created_at][from|to]` en ventanas de 30 días desde la creación de la cuenta | Enumeración y fechas |
| Contactos, leads, empresas, no clasificados | `GET /api/v4/contacts?with=leads,customers`, `/leads?with=contacts,loss_reason,source_id`, `/companies`, `/leads/unsorted` (páginas de 250 hasta el 204) | Contacto de cada conversación; leads para 6.5 |
| Notas y tareas | `GET /api/v4/{leads,contacts,companies}/notes`, `/tasks` | Notas (pedido del encargo) |
| Usuarios, embudos, campos, cuenta | `/users`, `/leads/pipelines`, `/*/custom_fields`, `/account` | Autores y etapas para 5.5 |
| Adjuntos | `attachment.link` de cada mensaje | Se descargan a memoria y se cifran **uno por uno** (`adjuntos/<message_id>.<ext>.age`); el token solo se manda a hosts de Kommo; tamaño, sha256, HTTP y host quedan en `adjuntos.ndjson` |

Todo lo demás (NDJSON por entidad, `informe.json`, marcas de reanudación) se empaqueta con `tar | zstd | age` en `kommo-<stamp>-metadatos.tar.zst.age` con su `.sha256` y un `manifiesto.json` (lista de `.age` con bytes y sha256, etiquetas de los destinatarios). El staging en claro vive solo en tmpfs (`/dev/shm/kommo-e5`) y se borra al empaquetar.

### 3.3 Reglas de datos

- Nada en claro en disco; nada de texto, nombres, teléfonos ni enlaces firmados en el log, la pantalla, el informe, el repo ni el chat. La prueba `test_extraccion_informe_y_sin_datos_personales` siembra marcas (texto, nombre, teléfono y firma de un enlace) y comprueba que no salen en `informe.json`, `informe.md` ni el log.
- Solo `GET`. Una petición cada 0,25 s (X-9); 429 y 5xx con espera exponencial; 401/403 paran la corrida.
- Reanudable: entidades y conversaciones marcadas en el staging; repetir el mismo comando sigue donde iba.
- Restauración: la documenta el README (Sam, en su PC, con su llave privada).

## 4. Resultado de 5.1

### 4.1 Token (2026-10-31, ~00:30 CET)

La integración «DTD 0582 historial (solo lectura)» de 0.6 seguía instalada en Kommo; no se creó otra. Con el pedido de Sam («Abre Chrome, ahí está en Kommo, y crea la integración para ayudarle a seguir») se generó desde su Chrome un token de larga duración con caducidad **30.11.2026**. El clic en «Copiar» lo negó el clasificador de la app por ser una credencial: lo copió Sam y lo pegó con `pegar-token-kommo-e5-0582.ps1` a `/dev/shm/k0582-e5`. `probar-token`: JWT de 1035 bytes, alcances `list_external_messages,crm`, 30 días, `account_id` 31589859, `GET /api/v4/account` HTTP 200 y subdominio `dtdcargo` (**R**). Ni el token ni la pestaña de llaves aparecen en capturas, logs ni en este repo.

### 4.2 Ensayo corto (2026-10-30 23:33–23:35 UTC, todo en tmpfs, borrado al terminar) — **R**

`todo --max-talks 20 --max-eventos-ventanas 2 --sondear-huecos 20 --verificar-efimera`, staging y destino en `/dev/shm`:

| Medida | Valor |
|---|---|
| Peticiones | 167: 132 × HTTP 200, 35 × 204, **0 × 429**, 91 s de red |
| Listas completas | 4.237 contactos, 4.201 leads, 14 empresas, 7 no clasificados, 462 notas de leads, 572 de contactos, 0 de empresas, 68 tareas, 5 usuarios; campos: 20 de leads, 9 de contactos, 4 de empresas |
| Eventos (ventana de 2 días) | 48: 33 entrantes y 15 salientes; 9 conversaciones distintas |
| Sondeo de huecos | ids 4051..5057; de 20 ids sin eventos, **20 existen** → los ids de conversación son densos y la enumeración completa necesita el sondeo total (`--sondear-huecos -1`) |
| Conversaciones leídas | 21 (todas HTTP 200): 16 `waba`, 5 `instagram_business`; 1,9–2,1 s por conversación con pausa de 0,25 s |
| Mensajes | 292: 196 entrantes y 96 salientes; `message_type` text 271, picture 18, voice 2, contact 1; autores external 196, internal 93, bot 3; p50 3, p90 21, máx. 139 por conversación; 112 caracteres de texto promedio |
| Adjuntos | 20 de 20 descargados (HTTP 200) desde `drive-g.kommo.com`: 13 jpeg, 5 png, 2 m4a; 2,1 MB en total, 106 KB promedio, 728 KB el mayor |
| Paquete | `metadatos.tar.zst.age` de 402.799 bytes; round-trip con llave efímera: `age=0 tar=0 entradas=41`; 21 archivos cifrados, 2.528.130 bytes; destinatarios `Sam-2026-10-29` y `Emergencia-2026-10-29` (2 claves) |
| Hallazgo | `GET /api/v4/account` devuelve `created_at` igual a la hora de la consulta: la enumeración por ventanas tiene que partir de `--desde` (corrida completa: 2019-01-01). Corregido en el script (`desde()`), con prueba |

### 4.3 Corrida completa

Arrancó el 2026-10-30 23:38 UTC como unidad transitoria `kommo-e5-respaldo` (systemd, `Nice=10`), con `--desde 2019-01-01 --sondear-huecos -1 --pausa 0.15`, staging `/dev/shm/kommo-e5` y destino `/srv/backups/kommo/kommo-20261030T233814Z/`.

**Incidente y reanudación (2026-10-31 01:05–01:17 UTC).** Con 4.350 de 4.715 conversaciones leídas, `GET /api/v4/talks/4718` respondió HTTP 403 «Not enough rights» y el script (1.0.0) lo trató como token vencido: la unidad salió con código 2. Diagnóstico: el token seguía vivo (las conversaciones 4717, 4719, 4720 y 5057 respondían 200) y el 403 era solo de esa conversación, que el usuario de la integración no ve. Dos correcciones, con pruebas (23 en verde en la PC y en el VPS):

1. Un 403 en `/talks/{id}` o `/talks/{id}/messages` se registra (`talks-sin-acceso`, `mensajes-sin-acceso`, fila en el informe) y se sigue; un 401, o un 403 en una lista o en `/account`, sigue siendo fatal.
2. Al reanudar, la versión 1.0.0 recalculaba las ventanas de eventos desde la hora nueva, ninguna coincidía con las marcadas y empezó a bajar las 96 otra vez, duplicando eventos en el staging (se detectó a la tercera ventana). Se paró la unidad, se devolvió `eventos.ndjson` al tamaño exacto que tenía al cerrar esa etapa en la primera corrida (32.421.929 bytes, 54.200 líneas, 54.191 `id` distintos) y se fijó el fin de las ventanas en el staging (`eventos-hasta.txt`, ancla 2026-10-30 23:38:58 UTC); una ventana de cola desde el ancla recoge lo nuevo y los repetidos se descartan por `id` al leer. Quedaron 4 claves de ventana de esa reanudación en `listo-eventos-ventanas` que no coinciden con ninguna ventana del ancla: inertes.

Relanzada a las 01:17 UTC (script 1.1.0): 96 ventanas saltadas, cola con 4 eventos nuevos (54.204 en total, 4.717 conversaciones en los eventos, 342 pendientes) y la 4718 anotada como sin acceso. A la 01:23 UTC terminaron las conversaciones; el sondeo total de huecos (ids 100..5059, 243 ids sin eventos) no encontró ninguna conversación legible nueva: 232 responden 404 y **11 responden 403** (existen, pero el usuario de la integración no las ve). Con la 4718 son **12 conversaciones fuera del alcance del respaldo** por permisos de Kommo, no por el script.

**Segundo corte (02:11 UTC).** Con 2.481 de 3.592 adjuntos cifrados (2.473 × HTTP 200, 8 × 404), un adjunto llegó cortado a mitad del cuerpo (`http.client.IncompleteRead`): esa excepción no es `OSError` y el script no la reintentaba. Corregido en 1.1.1 (`ERRORES_RED` incluye `http.client.HTTPException`, con prueba de reintento y de agotamiento) y relanzada a las 02:13 UTC con 1.111 adjuntos pendientes. Esa reanudación volvió a escribir `huecos-sondeo.json` con 0/0 (nada que sondear); se restauró a mano con los valores del log y de los marcadores (243/243/0/11, con una nota dentro del JSON) antes de que se generara el informe, y el script ya conserva el sondeo real al reanudar.

**Resultado (R).** Terminó el 2026-10-31 02:34:19 UTC. Destino `/srv/backups/kommo/kommo-20261030T233814Z/` (0700, root):

| Archivo | Medida |
|---|---|
| `kommo-20261030T233814Z-metadatos.tar.zst.age` | 7.500.141 bytes; sha256 `c92eef454deee6101a65055a80294bf7285297753d0dcca81c7c3cd921f3fd8a` (igual al `.sha256`, recalculado al cerrar) |
| `adjuntos/<message_id>.<ext>.age` | 3.577 archivos, 2.099.458.961 bytes (2,10 GB) |
| `manifiesto.json` | versión 1.1.1; 3.578 entradas (`archivo`, `bytes`, `sha256`); 2.106.959.102 bytes cifrados; destinatarios `Sam-2026-10-29` y `Emergencia-2026-10-29` (2 claves) |
| `informe.json`, `informe.md` | solo conteos; copia literal en [`informe-volumen.md`](informe-volumen.md) |
| `respaldo.log` | 40 KB: ids, conteos y códigos HTTP; sin datos personales |

Tiempos y red: extracción en tres tramos, 23:38–01:05, 01:17–02:11 y 02:13–02:34 UTC (87 + 54 + 21 min); pausa de 0,15 s más el tiempo de Kommo (≈1,05–1,1 s por conversación o adjunto); **0 × HTTP 429** en todo el log; 2 reintentos de red en el último tramo (uno fue el `IncompleteRead`, que ahora se reintenta). Cobertura: 4.717 conversaciones consultadas (4.715 × 200, 1 × 404, 1 × 403) más 11 con 403 en el sondeo; 3.592 adjuntos referidos, 3.577 descargados y 15 con 404 en Kommo (el enlace ya no existe). Al terminar: staging `/dev/shm/kommo-e5` borrado por el script, token `/dev/shm/k0582-e5` borrado a mano a las 02:35 UTC, unidad recogida (`--collect`). El informe compacto quedó también en el journal del VPS (stdout del script): solo conteos.

**Comprobación independiente del Director (2026-10-31, ~09:35 UTC, solo lecturas).** 3.578 `.age` en el destino (3.577 adjuntos y los metadatos), 2,0G según `du` (los 2.106.959.102 bytes del manifiesto), root 0700/0600; `sha256sum -c` de los metadatos OK; `/dev/shm` sin `kommo-e5`. CI de la PR («Calidad local sin secretos») PASÓ en 27 min 29 s. Aceptación técnica del Director dada; la de Sam, el 2026-10-31 (~10:15 UTC), en el chat del Director: «Acepto los 5 (Recomendado)» (la pregunta cubría 2.7, 2.8, 3.4, 5.1 y 5.2; aceptar no fusiona ni despliega nada hasta el 1 de noviembre).

## 5. Resultado de 5.2 — volumen (R)

Fuente: `informe.md` de la corrida `kommo-20261030T233814Z` (script 1.1.1, 2026-10-31 02:33:40 UTC), copiado literal en [`informe-volumen.md`](informe-volumen.md). Solo conteos, años, valores de enumeración y nombres de campo. Corte: último mensaje 2026-10-31 00:51 UTC; primero 2023-08-23.

### 5.1 Por año y tipo

| Año | Conversaciones creadas | Mensajes | Entrantes / salientes | Contactos creados | Leads creados |
|---|---|---|---|---|---|
| 2023 | 4 | 8 | 2 / 6 | 2 | — |
| 2024 | 1.404 | 15.633 | 8.018 / 7.615 | 1.197 | 1.192 |
| 2025 | 1.276 | 18.759 | 9.333 / 9.426 | 1.200 | 1.190 |
| 2026 (al 31-oct) | 2.031 | 19.787 | 11.401 / 8.386 | 1.838 | 1.819 |
| **Total** | **4.715** | **54.187** | 28.754 / 25.433 | **4.237** | 4.201 |

Los adjuntos no se desglosan por año (el script no lo calcula; sale del paquete descifrado si hace falta).

| Canal (`origin`) | Conversaciones | Mensajes |
|---|---|---|
| `waba` (WhatsApp Business API) | 2.636 | 41.804 |
| `instagram_business` | 1.680 | 9.235 |
| `facebook` | 377 | 2.858 |
| `officialwhatsapp` | 21 | 287 |
| `onlinechat` | 1 | 3 |

### 5.2 Actividad y forma de las conversaciones

| Medida | Valor |
|---|---|
| Conversaciones con actividad en los últimos 12 meses | **2.096 de 4.715 (44 %)** |
| Conversaciones con actividad en los últimos 24 meses | 3.842 (81 %); 873 llevan más de dos años sin mensajes |
| Mensajes en conversaciones activas (12 meses) | 22.217 de 54.187 (41 %) |
| Contactos únicos en las conversaciones | 4.230 (4.261 pares contacto–canal: 31 personas escriben por dos canales) |
| Contactos únicos con actividad (12 meses) | 1.899 (45 %) |
| Estado en Kommo | `in_work` 3.949 · `closed` 766 |
| Mensajes por conversación | p50 6 · p90 25 · p99 99 · máx. 512 · promedio 11,5 |
| Autor | externo 28.719 · interno 13.719 · **bot 11.749 (22 %)** |
| Texto | 51.095 mensajes con texto; 5,97 M caracteres; 117 promedio; 11.853 el mayor |
| Entrega (`delivery_status`) | sent 28.732 · seen 19.860 · delivered 4.848 · error 747 |

### 5.3 Adjuntos

| Medida | Valor |
|---|---|
| Referidos en mensajes | 3.592 (6,6 % de los mensajes); descargados 3.577; 15 con 404 en Kommo |
| Por tipo | picture 2.036 · voice 750 · video 520 · file 266 (218 PDF, 28 XLSX, 4 XLS, 1 DOC, 1 ZIP, 1 MHT) · audio 20 |
| Extensiones más frecuentes | jpeg 1.017 · m4a 743 · jpg 554 · mp4 516 · png 363 · pdf 218 · jpe 110 · ogg 24 |
| Tamaño | 2.097.909.847 bytes (2,10 GB); promedio 586 KB; p50 99 KB; p90 2,66 MB; mayor 46,8 MB |
| Origen | `drive-g.kommo.com` 3.471 · `drive-c.kommo.com` 121 |

### 5.4 Otras entidades

Leads 4.201 · empresas 14 · no clasificados 7 · tareas 68 · usuarios 5 · notas de leads 462 (`common` 434, `ai_result` 27, `geolocation` 1) · notas de contactos 572 (`link_followed` 569, `amomail_message` 2, `geolocation` 1) · notas de empresas 0. Contactos con teléfono **2.567 de 4.237 (61 %)** y con correo 149 (3,5 %): unos 1.670 contactos (Instagram y Facebook, sobre todo) no traen teléfono, lo que acota el vínculo por E.164 de 5.4.

### 5.5 Estimación de carga en Chatwoot (I)

| Medida | Todo | Solo 12 meses de actividad |
|---|---|---|
| Filas | messages 54.187 · conversations 4.717 (4.261 si se juntan por contacto y canal) · contacts 4.230 · attachments 3.577 | messages 22.217 · conversations 2.096 · contacts 1.899 · attachments ≈ 41 % (no se midió) |
| Base de datos | ≈ 67 MB (filas × tamaño típico de `messages`, `conversations`, `contacts`+`contact_inboxes`, `attachments`+`active_storage`; índices y TOAST ×1,6) | ≈ 28 MB |
| Almacenamiento de adjuntos | 1,95 GiB (disco del VPS o S3 compatible; espacio libre no medido aquí) | ≈ 0,8 GiB |
| Tiempo de carga | por API: 3,5 h a 5 peticiones/s o 0,9 h a 20/s · por SQL / `rails runner` en lotes: ≈ 29 min | ≈ 41 % |

Es una estimación, no una medición: la cifra real sale del ensayo en copia (5.6).

### 5.6 Límites de la medición

- **12 conversaciones no legibles** con el usuario de la integración (HTTP 403 «Not enough rights»: la 4718 y 11 ids del sondeo). Existen, pero ni el respaldo ni el Archivo Kommo las tendrán salvo que Sam las abra en Kommo con un usuario con más derechos; ids en `huecos-sondeo.json` y `talks-sin-acceso` dentro del paquete.
- **15 adjuntos con 404**: el enlace ya no existe en Kommo; quedan anotados en `adjuntos.ndjson` con `http: 404`.
- El sondeo total cubrió los ids 100..5059 (243 sin eventos: 232 × 404, 11 × 403, **0 legibles fuera de los eventos**): la enumeración por eventos es completa en ese rango. Los ids 1..99 no se sondearon (el menor id visto en eventos es 100); comprobarlos cuesta 99 peticiones y se hace en 5.3, que vuelve a necesitar el token.
- Los eventos únicos son 54.195 frente a 54.187 mensajes leídos: la diferencia (8) son mensajes de las 12 conversaciones vedadas y de la 404.

## 6. revisar-datos-ve del inventario

Método: `.claude/skills/revisar-datos-ve/SKILL.md` (tres estados: `ENCONTRADO`, `CORRECTO`, `NO VERIFICABLE`; nada entra sin `archivo:línea`). Marco: Venezuela (CRBV arts. 28 y 60, SC 332/2001, SC 759/2025, Ley Especial contra los Delitos Informáticos arts. 20–22). PIPL solo si el historial llega al equipo de China: hoy no (el respaldo lo descifra solo Sam); si el Archivo Kommo queda visible desde China en 2.7, aplica y se decide allí. **No es asesoría legal.** Conteos de la corrida: §5.

### 6.1 Inventario de datos personales del respaldo

Los titulares: leads y clientes que escribieron a DTD (muchos nunca se registraron en el ERP), terceros nombrados en los mensajes (quien recibe, familiares, proveedores), los **empleados** de DTD que contestaron y los bots.

| Archivo › campo | Qué es | Finalidad declarada | Base de licitud | Retención | Quién más lo ve |
|---|---|---|---|---|---|
| `contactos.ndjson › name, first_name, last_name` | Nombre del lead o cliente | Atención y venta en Kommo; vínculo con el ERP (5.4) | Relación con quien escribe a DTD (precontractual o contractual) | Kommo: indefinida (el sync nunca borra, `docs/legal/privacidad/mapa-de-borrado.md:162`); respaldo: **sin plazo definido → hallazgo** | Kommo · Sam (único que descifra) |
| `contactos.ndjson › custom_fields_values[PHONE, EMAIL]` | Teléfono, correo | Contacto; E.164 y vínculo con `clients` (5.4) | ídem | ídem | ídem |
| `contactos.ndjson › custom_fields_values[otros]`, `leads.ndjson › custom_fields_values` | Campos propios de Kommo: 20 de leads, 9 de contactos y 4 de empresas (definiciones en `campos-*.ndjson` dentro del paquete; el informe no lista sus nombres) | **Finalidad no evidente en el código** para los que el ERP no usa (K-11: UTM, `gclid`, `fbclid` que nadie escribe) | — | ídem | ídem |
| `talks.ndjson › contact_id, chat_id, entity_id, _embedded.contacts/leads` | Vínculo conversación ↔ contacto ↔ lead | Cargar el Archivo Kommo con el contacto correcto | ídem | ídem | ídem |
| `mensajes.ndjson › text` | Texto libre de cada mensaje | Historial de atención (Archivo Kommo) | ídem | ídem | 🔴 texto libre: puede traer cédula, dirección, pagos o salud; se trata como **dato sensible potencial** |
| `mensajes.ndjson › author.name, recipient.name, author.user_id` | Quién escribió: el cliente o el asesor | Autoría en el Archivo (5.5) | ídem · relación laboral para los asesores | ídem | Incluye **empleados** (punto 12) |
| `mensajes.ndjson › author.avatar_url, recipient.avatar_url` | Foto de perfil | **Finalidad no evidente**: el Archivo no la necesita | — | ídem | No se carga en 5.5 |
| `mensajes.ndjson › attachment.{type,file_name,link}` + `adjuntos/<id>.<ext>.age` | Archivos enviados: fotos, PDF, audio, video | Parte de la conversación | ídem | ídem | 🔴 pueden ser cédulas, pasaportes, facturas o **rostros** (biométrico potencial; PIPL art. 28 si llegara a China) |
| `leads.ndjson › name, price, tags, _embedded.contacts` | Lead, valor y etiquetas | 6.5 (leads, etapas y mapeo de IDs) | ídem | ídem | ídem |
| `notas-*.ndjson › params.*`, `tareas.ndjson › text` | Notas, llamadas y tareas | Contexto del historial | ídem | ídem | Texto libre |
| `usuarios.ndjson › name, email, lang` | **Empleados** de DTD en Kommo | Autores del Archivo | Relación laboral | ídem | Titulares que no son usuarios del ERP (punto 12) |
| `eventos.ndjson`, `talks-indice.json`, `huecos-sondeo.json` | Ids, fechas, origen | Enumeración | — | ídem | Sin datos personales directos |
| `cuenta.json`, `embudos.json`, `campos-*.ndjson` | Cuenta, etapas y definiciones de campos | Contexto | — | ídem | No personales (ids de usuario) |
| `informe.json`, `informe.md`, `manifiesto.json`, `respaldo.log` | Conteos, ids, códigos HTTP, hosts, nombres de campo | Evidencia de 5.2 | — | En claro en el VPS y en el repo | Sin datos personales (**CORRECTO**, prueba `pruebas/test_respaldar.py:382-437`; el informe real se revisó a ojo: 0 teléfonos, correos o enlaces) |

Volumen de la corrida (§5): 4.237 contactos (2.567 con teléfono, 149 con correo), 4.715 conversaciones de 4.230 personas, 54.187 mensajes (51.095 con texto; 11.749 escritos por bots), 3.577 adjuntos cifrados (2.036 fotos, 750 notas de voz, 520 videos, 266 archivos, 20 audios), 462 + 572 notas, 68 tareas y 5 usuarios de DTD.

### 6.2 Los doce puntos

| # | Punto | Estado | Evidencia y arreglo |
|---|---|---|---|
| 1 | Inventario | `ENCONTRADO` | La tabla 6.1. Campos sin finalidad: `avatar_url` y los campos propios de Kommo que el ERP no usa. **Arreglo:** 5.5 carga solo `text`, `type`, `created_at`, `author.type/name` y adjuntos; nada de `avatar_url` ni campos sin uso. Campos reales de la corrida (nombres): conversación `account_id, chat_id, contact_id, created_at, entity_id, entity_type, is_in_work, is_read, origin, rate, source_id, status, talk_id, updated_at`; mensaje `attachment, author, chat_id, created_at, delivery_status, id, message_type, origin, recipient, sec_created_at, text, type`; contacto `account_id, closest_task_at, created_at, created_by, custom_fields_values, first_name, group_id, id, is_deleted, is_unsorted, last_name, name, responsible_user_id, updated_at, updated_by` |
| 2 | Minimización y proporcionalidad | `CORRECTO` en el script · `ENCONTRADO` en el alcance | El respaldo toma **todo** a propósito: Kommo no exporta chats (K-20) y E8 cancela la licencia; sin respaldo el historial se pierde. La minimización va en la carga (5.5) y en la retención (6.3). En el script: el log y el informe no llevan valores (`respaldar-historial.py:162` y prueba `:382-437`); el token solo viaja a hosts de Kommo (`:60`, `:275`; prueba `:328`); nada en claro en disco (`:330` staging 0700 en tmpfs, `:636` adjuntos cifrados desde memoria, `:713` borra el staging); archivo del token 0600 obligatorio (`:115`) |
| 3 | Consentimiento con evidencia | `NO VERIFICABLE` | El consentimiento de quien escribió a DTD por WhatsApp o Instagram no consta en el repo: la base es la relación con el titular. Mover el historial a un archivo de solo lectura propio no es un fin nuevo, pero no hay consentimiento separado y la política pública no nombra el CRM (genérica por decisión: `docs/legal/DTDCARGO_Politicas_Digitales_v3_para_abogada.md:33`). Lo revisa la abogada |
| 4 | Derechos como caminos reales | `ENCONTRADO` | `app/privacidad/page.tsx:296-303` promete que las consultas que no derivan en servicio «se eliminan o anonimizan» y que lo eliminado «desaparece de los respaldos» a los 30 días. Un paquete `.age` inmutable con todo el historial no deja borrar a una persona sin reconstruirlo. **Arreglo:** retención fija (6.3) y procedimiento de borrado por persona: descifrar en tmpfs, quitar sus filas y adjuntos, volver a empaquetar (`empaquetar --conservar-staging` ya lo permite) |
| 5 | El borrado que borra de verdad | `ENCONTRADO` | Escondite n.º 6 («exports y respaldos») nuevo: `/srv/backups/kommo/kommo-<stamp>/` y el 2.º respaldo de 8.5. El espejo de Kommo ya era «el hallazgo más serio del mapa» (`docs/legal/privacidad/mapa-de-borrado.md:140-170`). `CORRECTO`: staging borrado al empaquetar (`:713`; comprobado tras la corrida: `/dev/shm` sin `kommo-e5`), nada en `/tmp`, log sin PII. **Arreglo:** fila nueva en el mapa §F (6.4) |
| 6 | Trazabilidad de las solicitudes | `NO VERIFICABLE` | No se revisó en esta tarea; no cambia con ella |
| 7 | Política pública de tratamiento | `ENCONTRADO` | La política dice «copias de respaldo … 30 días» (`app/privacidad/page.tsx:302`) y «consultas que no derivan en servicio … se eliminan o anonimizan» (`:296`). Un Archivo Kommo con conversaciones de leads que nunca contrataron y sin plazo contradice las dos frases. **Arreglo:** fijar plazos coherentes (6.3) o actualizar la política; E1 ya prevé una nota sobre `/privacidad` (fila 1.7; `docs/legal/privacidad/revision-chatwoot-e1-2026-10-29.md` en la rama de E1, NV en main) |
| 8 | Inventario de terceros | `CORRECTO` · `NO VERIFICABLE` | Ningún tercero nuevo: Kommo ya tiene los datos (`docs/legal/privacidad/inventario-terceros.md:40`, política y contrato ❓) y el VPS es el de DTD en Contabo (`:44`). El script no manda datos a nadie más (`:60`, `:275`). La copia a R2/B2 no se hace aquí; si el Director la pide, cae en la evaluación ya hecha para los respaldos (`docs/legal/privacidad/evaluacion-proveedor-respaldo-externo.md`) |
| 9 | Transferencia internacional | `NO VERIFICABLE` | Dónde aloja Kommo (❓ en el inventario). El respaldo queda en EE. UU. (Contabo US East), como dice la política (`app/privacidad/page.tsx:267-270`). El equipo de China no accede al respaldo. Si el Archivo Kommo se ve desde China (2.7 / 5.5), aplica PIPL arts. 38–40 y 28 (rostros) |
| 10 | Decisiones automatizadas | no aplica | Los 15 Salesbots y los 4 agentes de IA están apagados (K-13, K-14); el respaldo no decide nada |
| 11 | Valor probatorio | no aplica | No hay aceptación electrónica. `.sha256` y `manifiesto.json` prueban integridad del paquete, no autoría ni fecha certificada |
| 12 | Titulares que no son usuarios | `ENCONTRADO` | Leads que nunca se registraron, terceros nombrados en los mensajes y los **empleados** (`usuarios.ndjson › name, email`; `mensajes.ndjson › author.name`). Ninguno pasó por la política del Portal. **Arreglo:** retención acotada (6.3, decidida por Sam el 2026-10-31); 5.5 muestra al asesor por **nombre de pila** (Sam, 2026-10-31: «Nombre de pila (Recomendado)»); un aviso a la persona que atiende de que su nombre queda en el Archivo |

### 6.3 Retención decidida (Sam, 2026-10-31; se aplica en 5.4–5.7 y 8.6, no en esta SDD)

| Copia | Propuesta | Decisión (Sam, 2026-10-31) | Por qué |
|---|---|---|---|
| Respaldo `.age` de 5.1 (y el de 8.5) | Conservar hasta que se firme el acta final (8.6) y se verifique la carga; después **borrar**, salvo que Sam lo conserve como archivo frío con fecha de borrado escrita (por ejemplo 12 meses tras el corte, por reclamos) | **«12 meses tras el corte (Recomendado)»**: archivo frío con fecha de borrado escrita, corte + 12 meses; la fecha concreta se escribe cuando se fije el corte (E8) | SC 332/2001 (temporalidad) y la promesa de 30 días de la política |
| Archivo Kommo en Chatwoot, conversaciones de **clientes** (con servicio) | Mientras la relación esté activa y lo que exija la ley, como la política | Sin cambio: como la política (no se preguntó) | `app/privacidad/page.tsx:290-300` |
| Archivo Kommo, conversaciones de **leads sin servicio** | Plazo fijo desde el último mensaje (por ejemplo 24 meses) y borrado o anonimización | **«Anonimizar a los 24 meses (Recomendado)»**: 24 meses desde el último mensaje; depende del vínculo con el ERP de 5.4 | «se eliminan o anonimizan» (`:296`); SC 759/2025 (derecho al olvido) |

Decisiones de Sam del 2026-10-31 (~09:40 UTC), dadas en el chat del Director y copiadas literales por él: 1. Respaldo `.age`: **«12 meses tras el corte (Recomendado)»** → archivo frío con fecha de borrado escrita: corte + 12 meses. 2. Leads sin servicio en el Archivo Kommo: **«Anonimizar a los 24 meses (Recomendado)»** → 24 meses desde el último mensaje; depende del vínculo con el ERP de 5.4. 3. Asesor en el Archivo: **«Nombre de pila (Recomendado)»**. 4. Bots: **«Sí, como «Bot Kommo» (Recomendado)»**. Decisiones del Director (misma fecha): el `.age` no se copia a R2/B2 por ahora (se revisa con el 2.º respaldo de 8.5); la revocación de la integración queda para el cierre de E5, después de 5.3; con esto la política `/privacidad` no cambia y la fila 1.7 de E1 sigue como está.

### 6.4 Documentos canónicos que cambian

- `docs/legal/privacidad/mapa-de-borrado.md` §F: fila nueva para el respaldo del historial de Kommo (en esta PR, con el stamp y el volumen de la corrida).
- `docs/legal/privacidad/registro-tratamiento.md`: no tiene filas para las conversaciones (texto y adjuntos); propuesta, no se edita aquí.
- `docs/legal/privacidad/inventario-terceros.md:40` (Kommo): sin tercero nuevo; anotar que desde 5.1 existe copia propia cifrada.

Pide una segunda opinión: otro modelo sobre el mismo inventario. Esta revisión no es asesoría legal: produce un inventario técnico y preguntas para la abogada.

## 7. Recomendación de alcance

**Recomendación: cargar todo lo legible (4.715 conversaciones, 54.187 mensajes, 3.577 adjuntos) en la bandeja «Archivo Kommo», como pidió Sam, con una regla de retención escrita antes de 5.7.** Razones:

1. **Cabe y es barato.** ≈ 67 MB de base y 2 GB de adjuntos; menos de una hora por API en lotes o media hora por SQL (§5.5). Acotar a 12 meses ahorraría ≈ 40 MB y ≈ 1,2 GB: nada que justifique perder historial.
2. **Lo que se recorta por fecha no es lo que la política manda recortar.** La política pública promete borrar o anonimizar las *consultas que no derivan en servicio* (`app/privacidad/page.tsx:296`), no las conversaciones viejas: una conversación de 2024 con un cliente que sigue embarcando es historial contractual; una de 2026 con un lead que nunca compró es lo que hay que acotar. Separar unas de otras necesita el vínculo con el ERP (5.4, por E.164), que todavía no existe. Cortar hoy por fecha (24 meses → 3.842 conversaciones, 81 %) dejaría fuera 873 conversaciones de 2024, muchas de clientes, y seguiría cargando leads sin servicio de 2025 y 2026.
3. **La licencia de Kommo termina (E8) y Kommo no exporta chats (K-20):** lo que no se cargue y no quede en el respaldo se pierde. El respaldo `.age` de 5.1 ya protege el conjunto completo; el Archivo decide qué se *ve*.
4. **El 56 % de las conversaciones lleva un año sin actividad y el 22 % de los mensajes los escribió un bot:** el Archivo será sobre todo consulta ocasional. Conviene que 5.5 cargue la bandeja plegada (cerrada, solo lectura, sin notificaciones) para que no estorbe en el trabajo diario.

Condiciones que acompañan al «todo» (decididas el 2026-10-31 por Sam y el Director, §6.3; se aplican en 5.4–5.7 y 8.6, no en esta SDD):

- **Retención** (§6.3, decidido por Sam el 2026-10-31): conversaciones de contactos que 5.4 no vincule a un cliente del ERP → **anonimizar a los 24 meses** desde el último mensaje; las de clientes, mientras dure la relación y lo que exija la ley. La política `/privacidad` no cambia (Director): la fila 1.7 de E1 sigue como está.
- **Lo que no se carga en 5.5:** `author.avatar_url` y campos propios de Kommo que el ERP no usa. Los 11.749 mensajes de bots **sí se cargan, como «Bot Kommo»** (Sam, 2026-10-31), para no romper el hilo. Nombre del asesor: **de pila** (Sam, 2026-10-31; §6.2, punto 12).
- **Fuera del Archivo por fuerza:** las 12 conversaciones con 403 y los 15 adjuntos con 404 (§5.6). Si alguna importa, Sam la abre en Kommo antes de E8.
- **El respaldo `.age`** se conserva como archivo frío con fecha de borrado escrita: **corte + 12 meses** (Sam, 2026-10-31; §6.3); la fecha concreta se escribe cuando se fije el corte (E8). Copiarlo a R2/B2: **no por ahora** (Director, 2026-10-31); se decide junto con el 2.º respaldo de 8.5.

Alternativa acotada, si Sam cambia de idea: 24 meses de actividad (3.842 conversaciones, 81 %) es el único corte por fecha que no deja fuera a casi ningún cliente de 2025–2026; 12 meses (2.096, 44 %) pierde 2024 y 2025 enteros y no se recomienda.

## 8. Fuera de alcance de esta SDD

- 5.3 a 5.8 (extractor incremental con instante de corte, E.164 y vínculo con el ERP, modo de importación, ensayo, carga en producción y acta): otro OK de Sam.
- Revocar la integración «DTD 0582 historial (solo lectura)» en Kommo: al cerrar E5 (0.6), después de 5.3 (Director, 2026-10-31).
- Copiar el `.age` a un remoto (R2/B2) como los otros respaldos: **no por ahora** (Director, 2026-10-31), se decide junto con el 2.º respaldo de 8.5; el script no lo hace.

## 9. Paso 5.3 — extractor incremental con instante de corte (2026-11-06)

**Encargo.** Sam preguntó en el chat del Subdirector, el 2026-11-06 ~06:05Z: «¿Podemos ir trabajando con el resto del historial de Kommo?». Se avisó al Director General con esas palabras. Esta parte es solo código y pruebas en local: **no usa el token, no llama a Kommo y no toca el VPS ni producción.** Correrlo contra Kommo, de prueba o de verdad, sigue pidiendo que Sam pegue el token y dé su OK.

### 9.1 Qué hace

`respaldar-historial.py` 1.2.0 suma un modo incremental a `extraer` y `todo`, con `--base <carpeta de un respaldo anterior> --corte <instante UTC ya pasado>`. Detalle de uso en el [README](../../../infra/ops/kommo-historial/README.md#incremental-hasta-un-instante-de-corte-53).

- **Desde:** el corte de la base, o su stamp si fue completa, menos `--solape-horas` (24 por defecto). Solo lee el `manifiesto.json` de la base: no descifra nada.
- **Hasta:** el corte, fijo. Los eventos se piden hasta ahí, sin ventana de cola, y los mensajes posteriores no entran.
- **Qué baja:**
  - las listas que cambian, por `filter[updated_at]`: contactos, leads, empresas, notas y tareas;
  - las chicas, enteras;
  - las conversaciones con eventos en la ventana, con sus mensajes hasta el corte;
  - los adjuntos de mensajes desde el inicio.

  No sondea huecos.
- **Idempotente:** `incremental.json` fija base, inicio y corte en el staging. Repetir el comando no vuelve a pedir nada, y otro corte, otra base o una corrida completa sobre ese staging es un error.
- **Encadenable:** el manifiesto del paquete lleva `incremental` con base, inicio y corte, y sirve de `--base` del siguiente.
- **Igual que 5.1:** staging en tmpfs, paquete `age` para las claves de respaldos, log y manifiesto sin datos de personas.

### 9.2 Lo que no está comprobado

- **NO VERIFICADO contra la cuenta:** que Kommo acepte `filter[updated_at][from|to]` en `/leads/notes`, `/contacts/notes`, `/companies/notes` y `/tasks`. En contactos, leads y empresas lo trae la documentación (**D**). Se mide en la primera corrida con token, que es una puerta de Sam. Si alguna lista lo ignora, baja entera y la carga quita repetidos por id: más tráfico, mismo resultado.
- **Mensajes editados o borrados en Kommo después de la base,** en conversaciones sin eventos nuevos, no se vuelven a pedir. Es inferencia que en un chat de WhatsApp o Instagram eso no pasa.

### 9.3 Allowlist

- `infra/ops/kommo-historial/respaldar-historial.py` (1.1.1 → 1.2.0) y `infra/ops/kommo-historial/pruebas/test_respaldar.py`
- `infra/ops/kommo-historial/README.md`
- esta sección y `.agents/handoffs/0590-e5-extractor.md`

### 9.4 Evidencia

| Comprobación | Resultado |
|---|---|
| `python -I infra/ops/kommo-historial/pruebas/test_respaldar.py`, en Windows con Python 3.14 | PASÓ: 36 pruebas, 2 omitidas (`age` y permisos POSIX). Son las 24 de 5.1 y 12 nuevas |
| 11 mutantes del modo incremental: mensajes después del corte, listas sin `updated_at`, corte en el futuro, otro corte en el mismo staging, adjuntos ya respaldados, sin solape, eventos que no paran en el corte, sondeo de huecos, manifiesto sin la base, cadena que no parte del corte anterior, y staging incremental usado para una corrida completa | PASÓ: 11 de 11 caen por la prueba esperada, con el control en verde antes y después. El del sondeo sobrevivía en la primera vuelta porque la prueba lo apagaba sola; se corrigió |
| Corrida contra Kommo | NO EJECUTADO: pide el token y el OK de Sam |
| `pnpm verify` | NO EJECUTADO: el cambio es un script de ops en Python y sus pruebas, que `verify` no corre |

**Arreglo de paso en las pruebas:** el archivo de destinatarios de prueba se escribía sin `encoding`, así que en Windows el «·» salía en cp1252 y no se podía leer. En el VPS no pasaba.

### 9.5 revisar-datos-ve de 5.3

Lo pidió el Director General antes de cerrar 5.3. Estados de la skill: **ENCONTRADO**, **CORRECTO** o **NO VERIFICABLE**. Esto no es asesoría legal.

**Qué guarda el extractor incremental, dónde y por cuánto tiempo:**

| Qué | Campos | Dónde | Cuánto tiempo |
|---|---|---|---|
| Los mismos NDJSON de 5.1, solo con lo que cambió entre el inicio y el corte | Los de §6.1, sin campos nuevos: contactos, leads, empresas, notas y tareas que cambiaron; conversaciones con eventos en la ventana y sus mensajes hasta el corte; usuarios, embudos y campos enteros | Staging en tmpfs (`/dev/shm`, carpeta 0700), y después el paquete `kommo-<stamp>-metadatos.tar.zst.age` en `/srv/backups/kommo/kommo-<stamp>/` | Staging: hasta empaquetar, que lo borra (`empaquetar`, `shutil.rmtree`). Paquete: como el de 5.1, corte + 12 meses (§6.3), con la fecha concreta que se escribe en E8 |
| Adjuntos de mensajes desde el inicio | Archivo cifrado y, en `adjuntos.ndjson`, id del mensaje, tipo, extensión, host, código HTTP, bytes y sha256 | `adjuntos/<message_id>.<ext>.age`, junto al paquete | Igual que el paquete |
| Plan de la corrida | `base_stamp`, `base_sha256_paquete`, `desde`, `corte`, `solape_segundos` y versión. Sin datos de personas | `incremental.json` en el staging y el bloque `incremental` de `manifiesto.json`, en claro junto al paquete | El staging, hasta empaquetar; el manifiesto, mientras viva el paquete |
| Mensajes que quedaron fuera por el corte | Id de la conversación y cuántos mensajes. Sin texto ni autor | `mensajes-despues-del-corte` en el staging, dentro del paquete | Igual que el paquete |
| Log | Ids, conteos, códigos HTTP y fechas | `--log`, en claro | Como el de 5.1 |

**Resumen:** 0 ENCONTRADO nuevo, 5 CORRECTO, 1 NO VERIFICABLE y 6 sin cambio frente a §6.2.

| # | Punto | Estado | Evidencia y comentario |
|---|---|---|---|
| 1 | Inventario | CORRECTO | La tabla de arriba: ningún campo nuevo frente a §6.1. `incremental.json` y `mensajes-despues-del-corte` no traen datos de personas |
| 2 | Minimización | CORRECTO | Pide menos que 5.1: solo listas con `updated_at` en la ventana (`LISTAS_INCREMENTALES`), solo conversaciones con eventos en la ventana, nada después del corte (`en_corte`) y solo adjuntos nuevos. Las pruebas `test_listas_que_cambian_se_piden_por_updated_at`, `test_ningun_mensaje_posterior_al_corte_entra` y `test_adjuntos_solo_de_mensajes_desde_el_inicio` lo fijan, con su mutante |
| 3 | Consentimiento | Sin cambio | §6.2 punto 3 |
| 4 | Derechos | Sin cambio | §6.2 punto 4: cada paquete incremental es otro `.age` inmutable, igual que el de 5.1. El borrado por persona tiene que recorrer la base y todos los incrementales |
| 5 | Borrado | CORRECTO | El staging se borra al empaquetar, como en 5.1. Cada incremental suma una carpeta en `/srv/backups/kommo/` con la misma retención (§6.3): la fila de `mapa-de-borrado.md` §F tiene que nombrarlas cuando existan |
| 6 | Trazabilidad | Sin cambio | §6.2 punto 6 |
| 7 | Política pública | Sin cambio | §6.2 punto 7 |
| 8 | Terceros | CORRECTO | Mismo destino: el VPS de DTD. El token solo viaja a hosts de Kommo, sin cambio frente a 5.1 |
| 9 | Transferencia internacional | Sin cambio | §6.2 punto 9 |
| 10 | Decisiones automatizadas | Sin cambio | No aplica |
| 11 | Valor probatorio | CORRECTO | El manifiesto liga cada incremental a su base por stamp y sha256 del paquete (`bloque_incremental`): se puede reconstruir el orden de las cargas |
| 12 | Titulares que no son usuarios | NO VERIFICABLE | Los mismos de §6.2 punto 12. Cuántos entran en el incremental se sabe solo al correrlo con token |

**Fixtures:** las pruebas usan solo datos inventados, marcados para comprobar que no se filtran (`TEXTO-SECRETO-XK93`, «Nombre Inventado Zq», `+584129998877`). No copian nada del respaldo cifrado ni de producción.

**Puertas:** el «sí» de Sam del 2026-11-06 cubre el código y las pruebas en local. Correr contra Kommo, leer `clients`, crear la bandeja, el ensayo y la carga esperan su OK, uno por uno.

## 10. Pasos 5.4 y 5.5 — vínculo con el ERP y carga sin efectos (diseño, 2026-11-06)

**Encargo.** Mismo «sí» de Sam del 2026-11-06, solo para código y pruebas en local con datos sintéticos. El Director General pidió que la spec diga qué tiene que medir el ensayo (§10.4). **Nada con datos reales** hasta que él pase la respuesta literal de Sam sobre el orden: corte con token, cruce con el ERP en el servidor, ensayo en prueba y carga en producción con respaldo.

### 10.1 De dónde sale lo que se carga

Los paquetes `.age` están cifrados para las claves de Sam y de emergencia, y ninguna de las dos privadas está en el VPS. **El servidor no puede leer la base de 5.1.** Por eso la carga trabaja sobre un staging en claro en tmpfs, que sale de una **extracción completa hasta el corte**, hecha en el mismo servidor y en la misma ventana:

1. `extraer --corte <instante>` sin `--base`: completo, con el corte fijo. Se conserva el staging.
2. `vincular` (5.4) sobre ese staging, con la foto mínima del ERP.
3. `preparar-carga` (5.5): arma el archivo de carga, ya reducido.
4. El cargador de Rails escribe en Chatwoot (5.5).
5. `empaquetar`: cifra el staging y lo borra, como siempre.

El modo incremental de 5.3 queda para el segundo respaldo de 8.5 y para ponerse al día entre ensayos.

### 10.2 Paso 5.4 — E.164, vínculo con el ERP y deduplicación

- **E.164:** se quitan los separadores. Con `+` o `00` delante, se conserva el código de país si quedan entre 8 y 15 dígitos. Sin código de país, solo se completan los patrones venezolanos: `0` y 10 dígitos, `58` y 10 dígitos, o 10 dígitos que empiezan por `2` o `4`. Lo demás queda sin E.164, con motivo: no se inventa un país.
- **Llave de cruce:** la misma del ERP, `phone_last10`: los últimos 10 dígitos, o nada si hay menos (0363 y 0383). El correo, en minúsculas y sin espacios.
- **Foto del ERP:** un NDJSON en tmpfs con solo `client_id`, sus `phone_last10` y sus correos normalizados. Sin nombres ni documentos. Sacarla es leer `clients` en producción: es una puerta de Sam.
- **Cruce:**
  1. Por teléfono: si hay un solo cliente con esa llave, el contacto queda vinculado.
  2. Si hay dos o más, queda **ambiguo** y no se vincula, igual que el enrutador.
  3. Si no hay ninguno, se prueba por correo con la misma regla.
  4. Si no, queda sin vínculo.
- **El mismo cliente con otro teléfono:** si el contacto se vincula por correo y su teléfono no está entre los del cliente, queda marcado `otro_telefono`.
- **Deduplicación:** los contactos de Kommo con la misma llave, o vinculados al mismo cliente, forman un grupo. El grupo es la persona que se carga una sola vez, y su id es el menor id de Kommo del grupo.
- **Salida:**
  - `vinculos.ndjson`, que lleva teléfonos: va al staging y sale cifrado con el paquete;
  - `vinculo-informe.json`, solo con conteos.

### 10.3 Paso 5.5 — modo de importación sin efectos y bandeja «Archivo Kommo»

- **Bandeja:** canal API de Chatwoot, sin `webhook_url`, sin saludo, sin asignación automática y sin encuesta. Crearla es escribir en Chatwoot: puerta de Sam.
- **Por qué canal API:** en Studio, `fuenteDeCanal` (`lib/studio/chatwoot/entrada-leads.ts`) devuelve `null` para un canal que no es WhatsApp, Instagram, Messenger ni correo. Así que una bandeja API no crea tarjetas aunque llegue un evento. Pero un evento sí pasaría por `chatwoot_registrar_evento` y dejaría la conversación vieja en la bandeja de Studio. **No basta con eso: el cargador no tiene que disparar eventos.**
- **`preparar-carga` (Python):** del staging y `vinculos.ndjson` arma `carga.ndjson`, ya reducido. Lleva:
  - una persona por grupo;
  - una conversación por conversación de Kommo, cerrada;
  - por mensaje, solo `text`, entrante o saliente, `created_at` y el autor: el cliente, el asesor por **nombre de pila** o «Bot Kommo».

  Los adjuntos van por referencia a su `.age`. No lleva `avatar_url` ni campos propios de Kommo sin uso (§6.2, punto 1). Cada mensaje lleva `source_id = kommo:<id>`, y cada conversación y persona su id de Kommo, para que cargar dos veces no duplique.
- **Cargador (Ruby, `rails runner` en el contenedor de Chatwoot):**
  - escribe con `insert_all`, que **no corre callbacks de ActiveRecord**: ni webhooks, ni notificaciones, ni `SendReplyJob`, ni eventos de reportes;
  - salta lo que ya existe por `source_id`;
  - tiene un modo seco que solo cuenta.

  Correrlo es otra puerta de Sam.

### 10.4 Qué tiene que medir el ensayo (5.6)

Pedido del Director General. Cada medición da un conteo y PASÓ o FALLÓ. Todo con conteos, sin datos de personas.

| # | Medición | Cómo se cuenta | PASÓ si |
|---|---|---|---|
| E-1 | **Duplicados contra el ERP: E.164** | `vinculo-informe.json`: clientes del ERP que quedaron en dos grupos distintos | 0 |
| E-2 | **Duplicados contra el ERP: el mismo cliente con otro teléfono** | `vinculo-informe.json`: vinculados por correo con `otro_telefono` y en el mismo grupo que su cliente; contactos ambiguos cargados como vinculados | Todos en un solo grupo; 0 ambiguos vinculados |
| E-3 | **Tarjetas del CRM** | En la base de Studio de prueba, antes y después de cargar: `crm_tarjetas`, `crm_tareas`, `chatwoot_webhook_events` y `chatwoot_conversations` de la bandeja Archivo | Las cuatro no cambian |
| E-4 | **Webhook de Chatwoot** | Peticiones al webhook de Studio en el log del proxy y trabajos de webhook en Sidekiq durante la carga | 0 |
| E-5 | **Mensajes a clientes** | Trabajos `SendReplyJob` y de envío de canal en Sidekiq durante la carga; mensajes nuevos fuera de la bandeja Archivo | 0 y 0 |
| E-6 | **Lo cargado coincide con lo extraído** | Personas, conversaciones y mensajes en Chatwoot frente a `carga.ndjson` | Iguales |
| E-7 | **Cargar dos veces no duplica** | Segunda corrida del cargador | 0 filas nuevas |

### 10.5 Puertas

Cada una con el OK de Sam, por separado. Ninguna queda cubierta por el «sí» de hoy:

- el token para extraer;
- leer `clients` para la foto del ERP;
- crear la bandeja «Archivo Kommo»;
- correr el cargador en prueba (5.6);
- correrlo en producción (5.7).

### 10.6 Qué quedó en código (2026-11-06)

- **`extraer --corte` sin `--base`:** extracción completa hasta el corte. Deja `corte.json`, y el manifiesto lleva `corte`, así que un incremental puede partir de ahí. Mantiene el sondeo de huecos del respaldo completo.
- **`vincular` (5.4):** E.164, llave `phone_last10`, cruce único por teléfono y luego por correo, ambiguos sin vínculo, `otro_telefono` y grupos.
  - Lee la foto del ERP solo desde `/dev/shm` en Linux, y **la borra al leerla**, salvo `--conservar-clientes`.
  - El informe trae las mediciones E-1 y E-2.
- **`preparar-carga` (5.5):** `carga.ndjson` reducido y `carga-informe.json` con conteos. Deja fuera las conversaciones con 403 y los mensajes repetidos.
- **Pendiente:** el cargador de Rails con `insert_all` y su prueba sobre la imagen `chatwoot/chatwoot:v4.19.1-ce` con Postgres local, que mide E-3 a E-7 con datos inventados. Necesita Docker, así que pide turno al Director General.

### 10.7 Evidencia

| Comprobación | Resultado |
|---|---|
| `python -I infra/ops/kommo-historial/pruebas/test_respaldar.py` | PASÓ: 49 pruebas, 3 omitidas (`age`, permisos POSIX y tmpfs de Linux) |
| 15 mutantes de 5.4 y 5.5: ambiguo vinculado, sin grupo por cliente, sin grupo por teléfono, llave de menos de 10 dígitos, Venezuela inventada, nunca `otro_telefono`, correo sin normalizar, bots sin «Bot Kommo», asesor con nombre completo, conversaciones sin acceso cargadas, repetidos cargados, completa que ignora el corte, manifiesto sin corte, incremental que no reconoce el corte de una completa, y completa que acepta otro corte | PASÓ: 15 de 15 caen. El de «sin grupo por teléfono» sobrevivía en la primera vuelta porque el cruce por cliente lo tapaba; se agregó el caso de dos contactos sin cliente con el mismo teléfono |
| Los 11 mutantes del 5.3, ajustados al código nuevo | PASÓ: 11 de 11 |
| La foto del ERP en tmpfs | NO EJECUTADO en Windows: la prueba solo corre en Linux |
| Cargador y E-3 a E-7 | NO EJECUTADO: pide Docker y turno |

### 10.8 revisar-datos-ve de 5.4 y 5.5

| Qué | Campos | Dónde | Cuánto tiempo |
|---|---|---|---|
| Foto del ERP | `client_id`, `phone_last10` y correos. Sin nombres ni documentos | Un NDJSON en `/dev/shm`, fuera del staging | Hasta que `vincular` la lee: se borra ahí mismo. **No va al paquete de Kommo** |
| `vinculos.ndjson` | E.164, llaves, correos, cliente del ERP, motivo y grupo | Staging en tmpfs y, al empaquetar, dentro del `.age` | Staging hasta empaquetar; el paquete, corte + 12 meses (§6.3) |
| `carga.ndjson` | Nombre del contacto, teléfono E.164, correo, cliente del ERP; texto, sentido, fecha y autor de cada mensaje; referencia al `.age` del adjunto | Igual | Igual |
| `vinculo-informe.json` y `carga-informe.json` | Solo conteos | Staging y paquete | Igual |

- **Minimización (CORRECTO):**
  - la foto del ERP es solo la llave y el correo, y se borra al leerla;
  - la carga no lleva `avatar_url`, ni campos propios de Kommo, ni enlaces firmados;
  - el asesor va por nombre de pila.

  Lo fijan `test_la_carga_no_lleva_avatar_ni_enlaces_firmados_y_el_informe_solo_cuenta` y `test_vincular_borra_la_foto_del_erp_y_deja_solo_conteos_a_la_vista`.
- **Exactitud del vínculo (CORRECTO):** un teléfono con dos clientes no se vincula, igual que el enrutador (0383). El correo solo vincula si da un único cliente.
- **Titulares que no son usuarios (sin cambio):** §6.2, punto 12.
- **Fixtures:** solo inventados, con dominio `ejemplo.test` y marcas de prueba. Nada del respaldo ni de producción.
