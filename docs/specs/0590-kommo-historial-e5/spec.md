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

### 9.2 bis La primera corrida incremental es una sonda

Lo pidió el Director General. La primera corrida incremental con el token real sirve para probar el token, el filtro por `updated_at` y el modo incremental con datos reales.

- **No alimenta la carga.** Su paquete se cifra para las llaves de Sam y de emergencia, igual que el de 5.1, así que el servidor tampoco lo puede leer. La carga sale de la extracción completa hasta el corte (§10.1).
- **Lo que deja:** un respaldo nuevo de lo que cambió desde el 30 de octubre. Queda bajo la retención de §6.3: corte + 12 meses.
- **Cómo corre:**
  - el corte se fija justo antes de lanzar y se anota en la evidencia;
  - va con `--pausa 0.5`, unas 2 peticiones por segundo;
  - si la carga del VPS pasa de 8, se para con `systemctl stop kommo-e5-inc1`;
  - el token se borra al terminar.

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

**Cuánto le pide a Kommo la extracción completa** (estimación, **I**). Sale de la corrida de 5.1 (§4.3 y §5): 4.715 conversaciones, 3.577 adjuntos y 96 ventanas de eventos.

| Concepto | Peticiones aproximadas |
|---|---|
| Listas: contactos, leads, empresas, notas y tareas, en páginas de 250 | ≈ 100 |
| Eventos: 96 ventanas × 2 tipos, con alguna página extra | ≈ 250 |
| Conversaciones: el talk y la primera página de mensajes | ≈ 9.500 |
| Adjuntos | ≈ 3.600 |
| Sondeo de huecos | ≈ 250 |
| **Total** | **≈ 13.700** |

- **Ritmo:** con `--pausa 0.5` y lo que tarda Kommo (≈ 0,8 s por petición en 5.1), sale ≈ 1,3 s por petición. Eso da **≈ 0,8 peticiones por segundo de promedio**, lejos del límite de 7 por segundo de Kommo.
- **Duración: ≈ 5 horas.**
- **Horario:** fuera del horario de atención, de noche en Venezuela, entre las 02:00Z y las 10:00Z (22:00 a 06:00 VET).
- **Si la carga del VPS pasa de 8, se para.** Se reanuda con el mismo comando.

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
| E-8 | **`display_id`** | Valor actual de la secuencia `conv_dpid_seq_<cuenta>` frente al `display_id` máximo de la cuenta, y una conversación de prueba creada después | La secuencia queda por encima del máximo, y la conversación nueva no choca |
| E-9 | **Contactos** | `contact_inboxes` sin contacto, conversaciones sin `contact_inbox`, y contactos de la cuenta con el mismo teléfono o correo, antes y después | 0 huérfanos; los repetidos no aumentan, porque se reusa el contacto que ya existe |
| E-10 | **Panel y búsqueda** | Conteo de conversaciones de la bandeja Archivo en el panel, y buscar un mensaje cargado con una marca inventada (en prueba) | El panel muestra lo cargado y la búsqueda lo encuentra. Si no, se reindexa |
| E-11 | **Lo que ya había** | `updated_at` de las conversaciones que existían antes de la carga | 0 cambian |

### 10.5 Puertas

Cada una con el OK de Sam, por separado. Ninguna queda cubierta por el «sí» de hoy:

- el token para extraer;
- leer `clients` para la foto del ERP;
- crear la bandeja «Archivo Kommo»;
- correr el cargador en prueba (5.6);
- correrlo en producción (5.7).

**Actualización, 2026-11-06 ~06:20Z: Sam autorizó E5 con datos reales, hasta producción.** Lo pasó el Director General; lo registra el Subdirector. A la opción «todo, incluida producción», Sam contestó: «Todo, incluida producción». Antes había dicho: «La transferencia debe pasar ya los datos de los clientes».

Cubre las cinco puertas de arriba, con estas condiciones, que son parte del OK:

1. **Ensayo limpio antes de producción:** E-1 a E-5 en su valor. Si algo falla o cambia el riesgo, se para y se le escribe al Director General, que le pregunta a Sam.
2. **Kommo solo se lee:** sin cambiar configuración, agentes ni canales, y sin forzar su límite de pedidos, porque el equipo trabaja ahí. La corrida usa `--pausa 0.5`, unas 2 peticiones por segundo.
3. **Ningún mensaje a clientes:** «Archivo Kommo» no envía nada, y no se contesta Instagram desde Chatwoot.
4. **Los datos no salen del servidor:** nada por chat, PC ni Git, ni nombres en la evidencia. Solo conteos y huellas.
5. **El token lo pega Sam en el VPS,** con `pegar-token.sh` en una ventana tmux.
6. **Producción:** respaldo antes, lectura previa, de a una y conteos después. Antes de cargar se le manda al Director General la evidencia del ensayo, y la carga la hace él o se corre con él.

**No cubre** el borrado físico ni la anonimización a 24 meses en sí.

### 10.6 Qué quedó en código (2026-11-06)

- **`extraer --corte` sin `--base`:** extracción completa hasta el corte. Deja `corte.json`, y el manifiesto lleva `corte`, así que un incremental puede partir de ahí. Mantiene el sondeo de huecos del respaldo completo.
- **`vincular` (5.4):** E.164, llave `phone_last10`, cruce único por teléfono y luego por correo, ambiguos sin vínculo, `otro_telefono` y grupos.
  - Lee la foto del ERP solo desde `/dev/shm` en Linux, y **la borra al leerla**, salvo `--conservar-clientes`.
  - El informe trae las mediciones E-1 y E-2.
- **`preparar-carga` (5.5):** `carga.ndjson` reducido y `carga-informe.json` con conteos. Deja fuera las conversaciones con 403 y los mensajes repetidos.
- **`cargar-archivo-kommo.rb` (5.5, `rails runner` en el contenedor de Chatwoot):**
  - `MODO=crear-bandeja`: canal API sin `webhook_url`, sin asignación automática, saludo ni encuesta, sin miembros. Si ya existe una bandeja API con ese nombre, la devuelve sin tocarla.
  - `MODO=seco|cargar`: el archivo de carga entra por la entrada estándar (`docker exec -i … CARGA=-`), así que los datos no se copian al disco del contenedor. Escribe con `insert_all`, sin callbacks. Rechaza una bandeja con `webhook_url` o de otra cuenta. Reusa el contacto que ya existe por teléfono, por correo (sin distinguir mayúsculas) o por una carga anterior (`identifier = kommo:<grupo>`). Salta lo cargado por `source_id` y `kommo_talk_id`. Inserta en orden de creación, para que los números y los ids sigan el tiempo, y deja `agent_last_seen_at` en la hora de la carga para que lo viejo no salga como no leído.
  - `MODO=seco` no escribe nada, ni consume la secuencia de números de conversación: solo cuenta.
  - La salida son solo conteos: filas de la bandeja antes y después, la secuencia y los trabajos en cola de Sidekiq antes y después. En el servidor, con Sidekiq vivo, la cola solo orienta.
- **`pruebas/prueba-cargador.sh`:** prueba sobre la imagen `chatwoot/chatwoot:v4.19.1-ce`, con Postgres y Redis del compose real y datos inventados (`generar-sintetico.py`, que pasan por `vincular` y `preparar-carga`).
  - **Dónde corre:** en GitHub Actions (`.github/workflows/kommo-historial-cargador.yml`, en cada PR que toque `infra/ops/kommo-historial/**`), por indicación del Director General del 2026-11-06. Sin secretos ni variables del repositorio, sin token y sin pedirle nada a Kommo. No corre en el VPS. En una PC con Docker también corre, y para sola si la memoria libre baja de 3 GB.
  - **Qué mide:** 41 comprobaciones por escenario: los rechazos, el seco, la carga, E-4 y E-5 (0 trabajos en Sidekiq), E-6 a E-11 y la ausencia de datos de personas en la salida del cargador. Dentro de E-10: buscar el Archivo por la persona (E-10d), qué ve un agente sin ser miembro y siendo miembro (E-10e), y qué encola agregarlo (E-10f). E-1 y E-2 son del vínculo, en las pruebas de Python. E-3 (las tarjetas de Studio) se mide en el ensayo con la base de Studio; aquí se ve a través de E-4: sin trabajos de webhook, a Studio no le llega nada.
  - **Corrida real:** un `rails runner` por paso, con la carga por la entrada estándar, igual que en el servidor.
  - **Control y mutantes:** `escenario-mutante.rb` corre el escenario entero en un solo arranque de Rails, cada uno en una cuenta nueva sobre la misma base. M0 (el cargador sin tocar) tiene que pasar las 41. Cada uno de los 24 mutantes rompe una propiedad del cargador y tiene que tumbar su comprobación sin caer por otro camino. Entre esas propiedades: escribir con callbacks, quitar una de las dos guardas, que el seco escriba o consuma números, cargar dos veces, no reusar el contacto por teléfono o por correo, cruzar el contact_inbox o el remitente, el orden de los números, los no leídos, las fechas, guardar los atributos de la conversación como texto (M15) o los del mensaje como objeto (M21), imprimir un nombre, tocar los contactos reusados, perder el texto, el autor o el estado resuelto, dejar las conversaciones sin su persona (M22), crear la bandeja con todos los usuarios como miembros (M23) y con la asignación automática que Chatwoot pone por defecto (M24).
- **Allowlist de 5.4 y 5.5:** `respaldar-historial.py`, `cargar-archivo-kommo.rb`, `pruebas/` de la carpeta (`test_respaldar.py`, `prueba-cargador.sh`, `sonda-cargador.rb`, `escenario-mutante.rb`, `generar-sintetico.py`, `compose.cargador.yml`), el README de la carpeta, `.github/workflows/kommo-historial-cargador.yml`, esta spec y el handoff `0590-e5-extractor.md`. **De 5.6** (§10.10): `ensayo-archivo.sh`, `ensayo-otras-cuentas.sql`, `pruebas/sonda-ensayo.rb` y `pruebas/prueba-ensayo.sh`.

### 10.7 Evidencia

| Comprobación | Resultado |
|---|---|
| `python -I infra/ops/kommo-historial/pruebas/test_respaldar.py` | PASÓ: 49 pruebas, 3 omitidas (`age`, permisos POSIX y tmpfs de Linux) |
| 15 mutantes de 5.4 y 5.5: ambiguo vinculado, sin grupo por cliente, sin grupo por teléfono, llave de menos de 10 dígitos, Venezuela inventada, nunca `otro_telefono`, correo sin normalizar, bots sin «Bot Kommo», asesor con nombre completo, conversaciones sin acceso cargadas, repetidos cargados, completa que ignora el corte, manifiesto sin corte, incremental que no reconoce el corte de una completa, y completa que acepta otro corte | PASÓ: 15 de 15 caen. El de «sin grupo por teléfono» sobrevivía en la primera vuelta porque el cruce por cliente lo tapaba; se agregó el caso de dos contactos sin cliente con el mismo teléfono |
| Los 11 mutantes del 5.3, ajustados al código nuevo | PASÓ: 11 de 11 |
| La foto del ERP en tmpfs | NO EJECUTADO en Windows: la prueba solo corre en Linux |
| Datos inventados de la prueba del cargador → `vincular` → `preparar-carga`, en Windows | PASÓ: 4 personas, 5 conversaciones (1 sin contacto), 8 mensajes (5 entrantes, 3 salientes, 1 con adjunto y sin texto) |
| `prueba-cargador.sh` en la PC | NO EJECUTADO. Turno de Docker concedido a las ~06:32Z; al encender Docker Desktop arrancaron solos los contenedores de otro proyecto y el commit libre cayó de 6.058 a 771 MB antes de levantar el stack. Se cerró Docker Desktop entero, el turno volvió al Director General, y él indicó correrla en GitHub Actions |
| Las comprobaciones de un escenario, sin Docker, sobre salidas falsas | PASÓ: con salidas perfectas pasan todas (39 desde E-10d). Con una fuga, una conversación abierta, un remitente cruzado y una segunda carga que duplica, caen justo F1, E6a, E9a y E7a. Sin salidas caen todas: un archivo que falta no da verde. E-10d cae si una de las tres búsquedas no la encuentra, o si la sonda da error |
| Los textos de los mutantes contra el cargador | PASÓ: los 24 aparecen exactamente una vez cada uno |
| Imágenes y montajes de la prueba frente al VPS (2026-11-06, `docker inspect` y `sha256sum`, solo lectura) | **Chatwoot:** igual, `04895c7b…` en `chatwoot-rails-1`, `chatwoot-sidekiq-1` y el compose de main. **Postgres y Redis:** el compose (el de main y el del VPS) los fija solo por etiqueta; en el VPS corren `pgvector/pgvector@sha256:33198da2…` y `redis@sha256:1a34bdba…`, y la prueba los fija a esos digests en `compose.cargador.yml`. **Compose del VPS** (`6722ce94…`) frente al de main (`d62e648b…`): mismos montajes y mismo entorno; cambian solo comentarios y el orden de un montaje. **Inicializadores:** 3 de 4 iguales; `zz_dtd_proteccion_register.rb` difiere solo en comentarios. **`correo/` y `marca/`:** 22 de 22 iguales. Diferencia conocida: ninguna que toque al cargador |
| Primer run en GitHub Actions (42179426943, `4d37f665b`, digests de producción) | FALLÓ en 3 comprobaciones, las mismas en la corrida real y en M0. Pasaron las otras 35, y los 20 mutantes tumbaron su comprobación. **B2 y E45:** crear la bandeja con los modelos encola 2 trabajos, `EventDispatcherJob` y `ActionCableBroadcastJob`, igual que crearla desde el panel. Qué son, en §10.9: la invalidación de la caché de la cuenta, no `inbox_created`, como se creyó al principio. No es la carga: el seco, las dos cargas y los rechazos dejaron la cola igual (23→23). **E6d:** la premisa estaba mal. Chatwoot guarda `content_attributes` de los mensajes como texto JSON dentro de la columna `json` (su scope `not_forwarded` lee `#>> '{}'`); `insert_all` pasa por los mismos tipos del modelo y guarda igual que Chatwoot (`json_msg=3` eran los 3 salientes). Medidas de ese run: búsqueda de un mensaje de hace 500 días, 0 (E10c); números de conversación en la carga, 1→6 |
| Corrección tras el primer run, con los pedidos del Director General | **Trabajos por clase y evento:** el cargador los informa así; de los argumentos solo toma el nombre del evento, nunca los tokens de los agentes. **B2** exige exactamente los dos de la invalidación de caché; la carga, el seco y la segunda carga exigen «ninguno». **E45** tiene su propia línea base: la cola por clase y evento que deja la creación de la bandeja (`trabajos_despues`) tiene que ser idéntica a la que encuentra la sonda al empezar (`trabajos_actuales`). Sobre salidas falsas, la misma cantidad con un `SendReplyJob` en lugar de un `EventDispatcherJob` tumba E45. **E6d** compara contra dos mensajes de referencia creados con el modelo, y comprueba que `not_forwarded` lee lo cargado. **M21:** guardar los atributos del mensaje como objeto, saltándose el modelo, tiene que tumbar E6d; M15 sigue para los de la conversación, que Chatwoot sí guarda como objeto |
| Run 42182462434 (`777ce8e2e`, 07:51:03Z; log leído con `gh api`) | PASÓ, 0 fallas: B2, E45, E6d (lo cargado y la referencia de Chatwoot dan `"string"`) y M0 en verde. M15 tumba E6d. M21 tumba E6d y también E6c: guardar los atributos del mensaje como objeto rompe la lectura del autor en Chatwoot. Medidas: E10c, el mensaje de hace 500 días, 0 con la ventana de 90 días y 1 con `SEARCH_TIME_RANGE_LIMIT_DAYS=1100`; números de conversación, 1→6. Pero la medida E-10d no midió: `error:NoMethodError`. **Causa:** `SearchService#accessable_inbox_ids` (`search_service.rb:26`) llama a `User#assigned_inboxes` (`user.rb:164-165`), que usa `Current.account`. En una petición lo llenan `application_controller.rb:18` y `ensure_current_account_helper.rb:6` y `:25`; en el `rails runner` estaba en nil. La búsqueda de mensajes no fallaba porque, para un administrador, se salta ese filtro. **Corrección:** la sonda llena `Current` igual que el controlador, en `rails runner` y sin HTTP. E-10d pasa a ser comprobación: con la ventana por defecto, encuentra la conversación del Archivo de hace 500 días por nombre, por teléfono y por número. **M22** (todas las conversaciones al contacto «sin contacto») tiene que tumbarla |
| Pregunta del Director General: ¿con qué rol busca la sonda? | Como administrador, que ve todas las bandejas. Por eso se agregan dos comprobaciones. **E-10e:** con un agente sin rol de administrador, la conversación del Archivo de hace 500 días no aparece por nombre, teléfono ni número sin ser miembro, y sí aparece después de agregarlo. **E-10f:** agregarlo igual que el panel (`Inbox#add_members`) no asigna conversaciones (0 con asignado), no crea notificaciones (0), las 5 siguen resueltas, y no encola nada fuera de la invalidación de caché de la cuenta. **M23** (la bandeja nace con todos los usuarios como miembros) tiene que tumbar E-10e. Sobre salidas falsas: un trabajo de asignación al agregar el miembro tumba E-10f, y el agente que encuentra sin ser miembro tumba E-10e. El run, pendiente |
| Pedido del Director General: asignación automática | Chatwoot crea las bandejas con `enable_auto_assignment` en verdadero, y `InboxMember#add_agent_to_round_robin` mete a cada miembro en la rueda de asignación. El cargador ya creaba el Archivo con `enable_auto_assignment: false`, pero B1 no lo verificaba. Ahora `crear-bandeja` lee de la base la asignación automática, el saludo y la encuesta, y B1 exige los tres apagados. **M24** (la bandeja sin `enable_auto_assignment: false`) tiene que tumbar B1. Sobre salidas falsas, `asignacion_automatica=si` tumba B1 |
| Webhooks de Chatwoot en producción (2026-11-06, `psql` en `chatwoot-postgres-1` dentro de una transacción de solo lectura, con OK del Director General y dentro del OK de Sam para crear la bandeja; sin imprimir la URL) | **1** webhook en total: id 2, cuenta 1, tipo cuenta, host `dtdcargo.com`, sha256 de la URL `45eb7662f7aa`. Eventos: `conversation_created`, `conversation_updated`, `conversation_status_changed` y `message_created`. **Sin `inbox_created`**, y ningún webhook de bandeja |
| `prueba-cargador.sh` en GitHub Actions con la corrección | Pendiente del CI de la PR |

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
- **El cargador no copia datos fuera de tmpfs:** el archivo de carga entra al contenedor por la entrada estándar, y la salida son solo conteos. La prueba F1 busca 13 valores inventados en las 7 salidas del cargador (no ejecutada todavía, §10.7). Los errores de la base se informan solo por su clase, porque su mensaje puede traer valores de la fila.

### 10.9 Lo que la carga cambia a la vista (para decidir antes de producción)

- **Números de conversación (I, se mide en E-8):** Chatwoot numera las conversaciones con una secuencia por cuenta, que un disparador de la base aplica en cada inserción. Cada conversación cargada consume un número, en orden de creación. Después de la carga, las conversaciones nuevas siguen desde ahí: el número salta en tantas como se carguen, unas 4.700 con la base 5.1 (§5.5), o 2.096 si solo se cargan 12 meses. No hay choque ni duplicado, pero se nota. El modo seco no consume números. **El Director General aceptó el salto el 2026-11-06,** porque es interno y no choca, y se lo comunica a Sam. Condición: en la carga de producción se anota aquí el número antes y después (la línea `HECHO secuencia=antes->después` del cargador), para que el equipo no se sorprenda.
- **Quién ve el Archivo (R en el código; se mide en E-10e y E-10f):** la bandeja se crea sin miembros. Un administrador ve y busca en todas las bandejas. Un agente sin ese rol solo en las bandejas de las que es miembro: `SearchService#accessable_inbox_ids` (`search_service.rb:26`) usa `User#assigned_inboxes` (`user.rb:164-165`). Así que, sin miembros, **el equipo de agentes no ve el Archivo ni lo encuentra al buscar.**
  - **Paso de producción, después de la carga:** un administrador agrega a los miembros desde el panel (Configuración → Bandejas → «Archivo Kommo» → Colaboradores), que llama a `Inbox#add_members` (`inbox_members_controller.rb:15` y `:55`). La bandeja no tiene asignación automática y las conversaciones están resueltas. E-10f mide en la prueba que agregar un miembro no asigna conversaciones, no crea notificaciones y no encola más que la invalidación de caché de la cuenta.
  - **Sam decidió (2026-11-06):** «todo el equipo». Se hace con `MODO=miembros` del cargador después de la carga (§10.14).
- **Lo que encola crear la bandeja (R; código de la imagen 4.19.1 de producción, leído en solo lectura, y la prueba):** la bandeja se crea con los modelos, como desde el panel, y eso encola dos trabajos. Ninguno llega a un cliente ni a Studio:
  - **`ActionCableBroadcastJob(account.cache_invalidated)`:** `Inbox` incluye `AccountCacheRevalidator`, que en `after_commit` llama a `account.update_cache_key('inbox')`. Eso despacha `account.cache_invalidated`, y `ActionCableListener#account_cache_invalidated` avisa a los navegadores de agentes y administradores para que recarguen la lista de bandejas. Lleva las llaves de caché, sin datos de personas.
  - **`EventDispatcherJob(account.cache_invalidated)`:** el lado asíncrono del mismo evento. Ninguno de sus diez oyentes (`AsyncDispatcher#listeners`) tiene `account_cache_invalidated`, así que al correr no hace nada. `WebhookListener` tampoco lo tiene: no sale ningún webhook.
  - **`inbox_created` no se emite.** `Inbox#dispatch_create_event` sale si `ENABLE_INBOX_EVENTS` está vacía. En el contenedor de producción está vacía, y no está ni en el compose ni en el `.env` del VPS (se miró solo si existe, no su valor). Aunque se definiera algún día, solo llegaría a los webhooks de cuenta suscritos a `inbox_created`. En producción hay uno solo, el de Studio, y no lo tiene (§10.7, leído el 2026-11-06). Además, su intérprete solo acepta sus cuatro eventos.
  - **Por qué no se crea sin callbacks:** sin la invalidación, la caché de bandejas de la cuenta quedaría vieja, y el Archivo no aparecería en el panel hasta que venciera (72 h, `CacheKeys::CACHE_KEYS_EXPIRY`).
- **Búsqueda (R: código y prueba, E-10c y E-10d):** el buscador de mensajes de Chatwoot no encontró un mensaje cargado de hace 500 días, y sí uno de ayer. **No es un índice, es una ventana de fechas.** Citas de la imagen `chatwoot/chatwoot:v4.19.1-ce@sha256:04895c7b…`, la de producción (`config/app.yml`: `version: '4.19.1'`):
  - `app/services/search_service.rb:109-110`: `message_base_query` arranca con `current_account.messages.where('created_at >= ?', search_window_start)`.
  - `app/services/search_service.rb:194-195`: `search_window_start` es `Limits.search_time_range_limit_days.days.ago`.
  - `lib/limits.rb:17-19`: `ENV.fetch('SEARCH_TIME_RANGE_LIMIT_DAYS', '90').to_i`, con 90 si no es positivo.
  - Las dos rutas de mensajes parten de esa consulta: ILIKE (`:100-103`) y GIN (`:74-75`). La búsqueda avanzada (`:68-69`) pide Elasticsearch y no está en esta instalación (I).
  - **Sin ventana:** conversaciones (`:33-38`: número, nombre, correo, teléfono o identificador del contacto, y asunto del correo) y contactos (`:166-170`). Solo la búsqueda avanzada les pondría ventana (`:40-43`, `:172`).

  Opciones para Sam:
  1. **Buscar el Archivo por la persona y no por el texto:** número, nombre o teléfono encuentran la conversación de cualquier fecha, y adentro se lee todo. Sin cambios. Lo comprueba E-10d, con la ventana por defecto: la del Archivo de hace 500 días aparece por nombre, por teléfono y por número.
  2. **Subir `SEARCH_TIME_RANGE_LIMIT_DAYS`**, por ejemplo a 1.100 días, para que la búsqueda de texto llegue a todo el historial. La prueba mide que con 1.100 encuentra el mensaje de hace 500 días (E-10c). Cuesta un compose con la variable y recrear `rails` en el VPS, porque `docker restart` no toma variables nuevas y el compose del VPS no es el de main: es un paso de despliegue del Director General. Con unos 55 mil mensajes (§5.5), el ILIKE sobre el historial entero es chico. **No medido en el VPS.**
  3. **Buscar desde Studio** sobre su propia copia. Hoy no existe: sería otro trabajo.

  **Sam eligió la 2 (2026-11-06):** «Ampliar la búsqueda». El plan está en §10.14.
- **Reportes (I):** sin callbacks no se crean eventos de reportes, así que tiempos de respuesta y resoluciones no cambian. Los conteos que salen directo de la tabla de conversaciones por fecha de creación sí podrían sumar las del Archivo en sus fechas de Kommo. No medido.

### 10.10 Paso 5.6 — el ensayo, en una copia efímera de la base de Chatwoot

**Decisión.** No hay un Chatwoot de prueba: en el VPS solo existe el de producción, y `dtd-cargo-staging` es el Studio de prueba, sin Chatwoot (medido el 2026-11-06). El Director General aprobó el **plan A** ese día, dentro del OK de Sam («Todo, incluida producción», §10.5): los datos no salen del VPS, viven en tmpfs y se borran. Él le cuenta a Sam que el ensayo es en una copia efímera y no en «prueba».

**Cómo** (`infra/ops/kommo-historial/ensayo-archivo.sh`, como root en el VPS):

1. Arma un stack **efímero** con proyecto fijo `chatwoot-ensayo`, todo en `/dev/shm/cw-ensayo` (0700). Lleva Postgres con PGDATA en tmpfs, Redis sin persistencia y un `runner` de Chatwoot, con los mismos digests de producción. Una sola red, `internal: true`, sin puertos publicados. Las llaves (`SECRET_KEY_BASE` y las de cifrado) son aleatorias, no las de producción. No toca `/srv/chatwoot` ni su compose.
2. Copia la base de producción con `pg_dump` en solo lectura y la restaura en el Postgres del ensayo. El dump se borra en el acto.
3. Corre el cargador real en el orden de producción: foto de antes, bandeja, seco, carga, segunda carga y foto de después. El archivo de carga entra por la entrada estándar.
4. Mide E-1, E-2 y E-4 a E-11 con los datos reales. La sonda (`pruebas/sonda-ensayo.rb`) imprime solo conteos, huellas md5 y «si»/«no». La evidencia (`EVIDENCIA`, 0600) guarda solo líneas `HECHO`.
5. Al terminar, o si algo falla, borra el stack y la carpeta, y anota qué quedó.

**Guardas del Director General**, cada una medida:

| # | Guarda | Cómo se cumple | Comprobación |
|---|---|---|---|
| 1 | Aislamiento | Red propia `internal: true`. Ningún contenedor del ensayo en una red `chatwoot_*`. Nombres `chatwoot-ensayo-*`. Desde el `runner` no resuelven `chatwoot-postgres-1` ni `chatwoot-redis-1`, `postgres` es el del ensayo y no hay salida a `1.1.1.1:443` | A1 a A7. Con una falla no se copia la base |
| 2 | El borrado no toca producción | `down -v` con `-p chatwoot-ensayo` escrito en el guion, solo si el proyecto es ese y no el de producción. `rm -rf` solo de la ruta literal `/dev/shm/cw-ensayo`. Nada se borra si el guion no lo creó: si la carpeta ya existía, se niega y la deja (o se usa `--limpiar`) | La prueba de CI: N1, N2, P1 a P3, L1 y L2 |
| 3 | Inicializadores en solo lectura | Se montan los cuatro de `/srv/chatwoot/rails` y `correo/views` con `:ro`. Qué hace cada uno al arrancar, abajo | — |
| 4 | `pg_dump` en solo lectura | Si hay un rol de login con «lectura» o «readonly» en el nombre, se usa ese rol; en producción no hay ninguno (medido el 2026-11-06). Si no, `PGOPTIONS='-c default_transaction_read_only=on'`; pg_dump además trabaja sobre una foto de solo lectura. Se anotan bytes y sha256 corto, y el dump se borra apenas restaurado. La copia se compara con los conteos de producción de antes y de después del dump, porque producción sigue recibiendo mensajes | D1 a D3 |
| 5 | Carga del VPS | Antes de cada paso, si la carga de 1 minuto pasa de 8, sale con código 3 | N3 en la prueba de CI |
| — | Solo la cuenta del ensayo en la copia (pedido del Director General al aceptar §10.11 punto 2) | Al restaurar y antes de cargar, se borra en la **copia** toda fila con `account_id` distinto de `CUENTA` en cada tabla, la cuenta misma y los restos sin `account_id` que colgaban de ella: `contact_inboxes`, miembros de bandejas y usuarios sin cuenta. Se borra con `session_replication_role = replica`, solo en el Postgres del ensayo. Se anotan las cuentas y filas borradas | O1 (la copia queda con 1 cuenta y 0 filas de otras) y O2 (0 restos). Si falla, no se carga. La prueba de CI tiene dos cuentas en la «producción» y comprueba que esta las conserva (P1, F3) |
| — | **Ese borrado, en tres capas** (Director General: «lo único del guion que en la base equivocada haría daño grave») | **1. Ejecución literal:** el Postgres del ensayo tiene `container_name: chatwoot-ensayo-postgres-1`, y el borrado se corre solo con `docker exec -i chatwoot-ensayo-postgres-1`, con el nombre escrito tal cual. Antes se verifica la etiqueta `com.docker.compose.project=chatwoot-ensayo` y que PGDATA esté en tmpfs (`stat -f` y `HostConfig.Tmpfs`). Si al empezar ya existe un contenedor con ese nombre, el ensayo se niega. **2. Marca de la copia:** al restaurar se crea `public._dtd_ensayo_marca` con un valor aleatorio de ese momento. `ensayo-otras-cuentas.sql` va en una sola transacción que **empieza** por verificar que la tabla existe y tiene ese valor. Si no, `RAISE`: la transacción se deshace antes de leer o borrar nada. Producción nunca tiene esa tabla. **3. Prueba en CI** | O0 (etiqueta y tmpfs), D4 (la marca está en la copia), O1a (el borrado encontró la marca). En CI: N4 corre el mismo `ensayo-otras-cuentas.sql` contra la «producción» simulada sin la marca, y se niega (código distinto de 0, sin imprimir nada, 2 cuentas, sin la tabla de marca); N5 pone un contenedor ajeno llamado `chatwoot-ensayo-postgres-1`, y el ensayo se niega sin tocarlo; P1 y F3 |
| — | Correos | La red no tiene salida y SMTP apunta a `smtp.invalid`. Además se cuentan los correos entregados (`deliver.action_mailer`) en cada paso del cargador y en la sonda, y los trabajos de correo en cola en todo el ensayo | SMTP1, en 0 y 0. En la prueba de CI, F4 |

**Qué hacen los inicializadores al arrancar** (leídos en `infra/chatwoot/rails/`; los del VPS difieren solo en comentarios, §10.7). Ninguno escribe en la base ni sale a la red al arrancar:
- **`zz_dtd_redaccion_logs.rb`:** envuelve el formateador del logger de Rails, y el de Sidekiq solo en un proceso de Sidekiq. Suma `entry` a `filter_parameters`. Escribe una línea de info.
- **`zz_dtd_proteccion_register.rb`:** antepone un módulo a `HTTParty::Request` y al cliente de WhatsApp que bloquea `/register` y `/deregister` hacia Meta. Al arrancar solo registra su estado; en el ensayo, cerrado.
- **`zz_dtd_revocar_sesiones.rb`:** en `to_prepare` define la ruta `POST /platform/api/v1/users/:id/dtd_revocar_sesiones` y antepone una verificación a `RoomChannel`. **No revoca nada al arrancar:** `revocar!` solo se llama desde la acción del controlador (línea 109), ante un POST autenticado. En un `rails runner` no hay peticiones.
- **`zz_dtd_correo.rb`:** antepone las vistas y los asuntos de DTD a `ApplicationMailer`. Solo actúa si se envía un correo. En el ensayo, SMTP apunta a `smtp.invalid` y la red no tiene salida.

**Recursos (I, a partir de lo medido en el VPS el 2026-11-06):** el VPS tiene 8 CPU con carga de 3,6 a 4,0, 24 GB de RAM con 16 GB disponibles, 12 GB de `/dev/shm` y 171 GB de disco libres; la base de Chatwoot pesa 22 MB. El ensayo usa menos de 2 GB de RAM (topes: Postgres 768 MB, Redis 128 MB, runner 1,5 GB y 1 CPU), unos 400 MB de tmpfs, 0 de disco y unos 15 minutos. No toca Kommo.

**E-3 en producción:** los conteos de `crm_tarjetas`, `crm_tareas`, `chatwoot_webhook_events` y `chatwoot_conversations`, antes y después de la carga real, entran en la condición 6 del OK de Sam («conteos después»). Los corre el Director General, solo conteos.

**La cuenta 2 de producción** (medida el 2026-11-06 en solo lectura, sin nombres): es la **cuenta de prueba** de Chatwoot. Lo documenta `docs/runbooks/chatwoot-bandeja.md:75` (decisión de Sam del 2026-11-03: «Prueba usa una segunda cuenta en el mismo Chatwoot, sin datos reales»), la crea `infra/chatwoot/crear-cuenta-prueba.rb`, y las pruebas de punta a punta exigen `CHATWOOT_ACCOUNT_ID=2`. Creada el 2026-11-03, con nombre de prueba, `status` 1 (suspendida), 2 bandejas (API y correo), 14 conversaciones, 9 contactos, 2 usuarios y 0 webhooks. Que no tenga datos reales es por diseño; no se verificó fila por fila. El ensayo no la necesita y la borra de la copia (O1 y O2).

**Adjuntos: primero se decidió `--sin-adjuntos` para la completa** (Director General, 2026-11-06), con el código de ese momento, y el Director General le preguntó a Sam. **Sam pidió los adjuntos** («Con adjuntos», ~14:00Z): la completa va en modo 5.5b (§10.12) si llega a tiempo, y si no, no se corre solo con texto.

**Adjuntos: los datos con que se decidió.**
- **Manifiesto de 5.1:** 3.577 adjuntos y 2.099.458.961 bytes cifrados.
- **La extracción cifra cada adjunto al bajarlo,** para las llaves de Sam y de emergencia (`respaldar-historial.py:757`). Nunca queda en claro en el staging. Por eso, con el código de hoy, el cargador no puede subir adjuntos a Chatwoot, los baje o no la completa.
- **Duración de la completa (I):** con adjuntos, unas 13.700 peticiones y ≈ 5 h. Sin adjuntos, unas 10.100 y ≈ 3,7 h.
- **El respaldo no pierde nada sin ellos:** hasta el 30 de octubre están en 5.1, y la sonda incremental baja los nuevos.
- **Para cargarlos en Chatwoot haría falta un paso 5.5b, con código y prueba propios.** Al bajar cada adjunto, además de cifrarlo para el respaldo, quedaría disponible para el cargador solo durante la ventana, con una llave efímera en `/dev/shm` o en claro en tmpfs. El cargador lo subiría como `Attachment`. Ocupa unos 2,1 GB del almacenamiento de Chatwoot, pide el token otra vez y vuelve a bajar todo de Kommo, cuyos enlaces vencen: en 5.1 ya había 15 con 404.

**Orden hasta producción** (de acuerdo con el Director General):
1. Token de Sam.
2. Sonda incremental (paso 3).
3. Completa hasta el corte: primero entre 02:00 y 10:00Z; desde el cambio de Sam, a las 05:00Z del 2026-11-07 y sin tope de hora (§10.12).
4. Foto del ERP, `vincular` y `preparar-carga`.
5. Este ensayo.
6. Evidencia al Director General.
7. `MODO=seco` en producción.
8. Respaldo.
9. Carga con él, con E-3 y E-8 antes y después.
10. Miembros del Archivo, según decida Sam.

**Prueba del guion** (`pruebas/prueba-ensayo.sh`, en el mismo workflow). Levanta el compose real de `infra/chatwoot` como proyecto `chatwoot`, con datos inventados, como si fuera producción, y corre el ensayo contra él:
- **N1:** si la carpeta ya existe, se niega y no la borra.
- **N2:** si el proyecto de producción se llamara como el del ensayo, se niega.
- **N3:** con la carga por encima del tope, se para antes de crear nada.
- **R1:** el ensayo pasa.
- **P1 a P3:** la «producción» queda sin «Archivo Kommo», con las mismas bandejas, conversaciones (huella) y mensajes, y sus contenedores y volúmenes vivos.
- **L1 y L2:** no queda nada del ensayo, y `--limpiar` no rompe nada.
- **F1 y F2:** la evidencia trae solo líneas `HECHO`, ningún valor inventado de personas, el dump y la limpieza en cero.

Si encuentra un Chatwoot real en el equipo, se niega a correr.

### 10.11 revisar-datos-ve del ensayo

Pedido por el Director General con la aprobación del plan A. Estados de la skill: **ENCONTRADO**, **CORRECTO** o **NO VERIFICABLE**. Esto no es asesoría legal.

**Qué datos mueve el ensayo, dónde y por cuánto tiempo:**

| Qué | Campos | Dónde | Cuánto tiempo |
|---|---|---|---|
| Copia de la base de Chatwoot de producción | Todo lo que guarda Chatwoot de la cuenta: contactos (nombre, teléfono, correo), conversaciones, mensajes y usuarios; las columnas cifradas siguen cifradas con las llaves de producción, que el ensayo no tiene | Dump en `/dev/shm/cw-ensayo/base.dump` (0600) y PGDATA en el tmpfs del contenedor `chatwoot-ensayo-postgres-1` | El dump, segundos: se borra al restaurar. La base, lo que dura el ensayo (≈ 15 min); se borra con el stack |
| Archivo de carga | El de §10.8 | El staging en `/dev/shm`, que entra al contenedor por la entrada estándar sin copiarse | El staging, hasta empaquetar (§10.8) |
| Usuarios temporales del ensayo | Un administrador y un agente con correo `@example.invalid` | Solo en la copia | Con la copia |
| Evidencia | Conteos, huellas md5 recortadas, «si»/«no», bytes y sha256 corto del dump | `EVIDENCIA` (0600), junto al guion en el VPS | Como los informes de 5.1 |

**Resumen:** 0 ENCONTRADO abierto, 5 CORRECTO (uno, corregido), 1 NO VERIFICABLE y 6 sin cambio.

| # | Punto | Estado | Evidencia y comentario |
|---|---|---|---|
| 1 | Inventario | CORRECTO | La tabla de arriba. La copia no agrega campos: es la misma base, en otro contenedor del mismo servidor |
| 2 | Minimización | CORRECTO (corregido) | El ensayo necesita solo la cuenta 1: contactos para E-9, conversaciones y mensajes existentes para E-11, y la secuencia para E-8. **Producción tiene 2 cuentas** (medido el 2026-11-06, en solo lectura): la 2 es la cuenta de prueba (§10.10). `pg_dump` copia tablas enteras, así que el dump la trae. Primero se anotó como ENCONTRADO (menor). El Director General lo aceptó y pidió borrarla de la copia al restaurar y antes de cargar, midiendo que queda en 0: O1 y O2. Queda unos segundos en el dump y en la copia antes de borrarse, en tmpfs y sin salida |
| 3 | Consentimiento | Sin cambio | §6.2 punto 3 |
| 4 | Derechos | Sin cambio | La copia vive 15 minutos y no es una fuente nueva de datos: un pedido de acceso o borrado se atiende en producción |
| 5 | Borrado | CORRECTO | El guion borra el dump al restaurar, y el stack y la carpeta al terminar, también si algo falla (`trap EXIT`). Anota en la evidencia que quedaron 0 contenedores, 0 volúmenes y 0 redes, y la carpeta ausente. La prueba de CI lo comprueba (L1, L2, F2) y comprueba que no toca la base de origen (P1 a P3) |
| 6 | Trazabilidad | Sin cambio | §6.2 punto 6 |
| 7 | Política pública | Sin cambio | La política de privacidad ya cubre a Chatwoot y el VPS de DTD como encargados. El ensayo no agrega terceros |
| 8 | Terceros | CORRECTO | Nadie fuera del VPS. Red `internal: true` sin salida (A7), SMTP a `smtp.invalid`, sin Sidekiq: ningún webhook ni correo sale |
| 9 | Transferencia internacional | Sin cambio | El VPS no cambia |
| 10 | Decisiones automatizadas | Sin cambio | No aplica |
| 11 | Valor probatorio | CORRECTO | La evidencia liga el ensayo al dump por bytes y sha256 corto, y a la carga por los conteos de `carga-informe.json` (E-6) |
| 12 | Titulares que no son usuarios | NO VERIFICABLE | Los clientes que escribieron por Chatwoot y por Kommo están en la copia como en producción. Cuántos, se sabe solo al correrla |

**Fixtures:** la prueba de CI usa solo datos inventados, en una «producción» simulada creada en el runner. No copia nada de producción ni del respaldo.

### 10.12 Paso 5.5b — adjuntos en Chatwoot (programado el 2026-11-06)

**Sam dijo «Con adjuntos»** (2026-11-06, ~14:00Z, transmitido por el Director General). La completa va con adjuntos en este modo, en una sola bajada, si la 5.5b está en verde en CI y revisada por el Director General antes de las 03:30Z del 2026-11-07. La completa arranca a las 05:00Z, la 1:00 a. m. en Caracas, sin tope de hora: Sam cambió la hora a las ~14:25Z del 2026-11-06, y antes eran las 02:00Z con plazo a las 00:30Z. Si no llega, se cancelan `kommo-e5-completa.timer` y `kommo-e5-vigia.timer`, no se corre solo con texto, el token se borra con su timer y la completa se reprograma otra noche, con Sam pegando el token otra vez. Lo que sigue es el diseño de antes de la respuesta; lo que quedó en código está al final de esta sección.

**Por qué hace falta un paso propio.** Hoy la extracción cifra cada adjunto al bajarlo, para las llaves de Sam y de emergencia (`respaldar-historial.py:757`), y nunca queda en claro en el servidor. El cargador no puede leerlos.

**Diseño:**

1. **Extracción** (`respaldar-historial.py`), con una opción nueva, `--adjuntos-para-carga`, que solo se acepta junto a `--corte` y con el staging en `/dev/shm`:
   - cada adjunto se sigue cifrando para el respaldo, igual que hoy;
   - además, sus bytes se escriben en claro en `<staging>/adjuntos-carga/<message_id>.<ext>` (0600), con el mismo tope por archivo (`--tope-adjunto-mb`);
   - `adjuntos.ndjson` suma `archivo_carga`, y `preparar-carga` pasa a cada mensaje `tipo`, `ext`, `content_type`, `bytes` y `sha256` del adjunto.

   Inferencia: en claro y en tmpfs tiene la misma protección que los textos, que ya están en claro en el mismo staging. Una llave efímera viviría en el mismo tmpfs y no agregaría nada. `empaquetar` borra el staging entero al terminar, como hoy.
2. **Carga** (`cargar-archivo-kommo.rb`), después de insertar los mensajes y solo para los mensajes nuevos de esa corrida, así que la segunda corrida no duplica:
   - el archivo se sube al almacenamiento de Chatwoot (`ActiveStorage::Blob.create_and_upload!`, servicio `local`, el volumen de `storage`);
   - las filas de `attachments` y `active_storage_attachments` se insertan con `insert_all`, sin callbacks.
   - Mapeo de tipos de Kommo a los de Chatwoot: picture → image, voice y audio → audio, video → video, file → file.
   - El archivo entra a Chatwoot por la entrada estándar del contenedor o por un montaje de solo lectura del tmpfs, nunca copiado a su disco.
3. **Ensayo:** la copia efímera también recibe los archivos, en un tmpfs de `storage` de unos 3 GB, y se mide además:
   - adjuntos y blobs cargados frente a `carga-informe.json`;
   - sha256 de una muestra frente a `adjuntos.ndjson`;
   - 0 duplicados en la segunda corrida;
   - qué trabajos encola. Inferencia: `ActiveStorage::AnalyzeJob` se encola solo si el adjunto pasa por los callbacks; con `insert_all` no. Se mide.
4. **Prueba en CI:** adjuntos inventados (una imagen chica, un audio, un PDF), con mutantes: adjunto en el mensaje equivocado, duplicado en la segunda corrida, archivo que no llega al almacenamiento y tipo mal mapeado.

**Costos (I):**
- La completa pasa de unas 3,7 h a unas 5 h, con unos 2,1 GB más de bajada desde Kommo.
- Unos 2,1 GB en `/dev/shm` durante la ventana, de 12 GB.
- Unos 2,1 GB más en el almacenamiento de Chatwoot, en el disco del VPS (171 GB libres), que entran en su respaldo.
- Los enlaces de Kommo vencen: en 5.1 ya había 15 con 404 de 3.592.

**Datos personales:** fotos, audios y documentos de clientes. En claro solo en tmpfs, durante la ventana. Después quedan en el almacenamiento de Chatwoot, con la retención de Chatwoot, igual que los adjuntos que hoy llegan por WhatsApp e Instagram. revisar-datos-ve se hace con el código, si Sam dice que sí.

#### Qué quedó en código (2026-11-06, PR #394)

1. **Extractor 1.3.0.** `extraer --adjuntos-para-carga`:
   - se niega sin `--corte`, junto a `--sin-adjuntos` o con el staging fuera de `/dev/shm` (`validar_adjuntos_para_carga`, lo primero de `cmd_extraer`);
   - cada adjunto se sigue cifrando a `<destino>/adjuntos/<id>.<ext>.age`, en disco, como hoy. Además se escribe en claro en `<staging>/adjuntos-carga/<id>.<ext>` con 0600, y `adjuntos.ndjson` suma `archivo_carga`;
   - `empaquetar` no mete `adjuntos-carga` en el paquete (`comando_tar` la excluye) y la borra con el staging;
   - `preparar-carga` pasa a cada mensaje `{archivo, archivo_carga, tipo, ext, content_type, bytes, sha256}` y cuenta `con_adjunto_para_carga` y `bytes_adjuntos_para_carga` en `carga-informe.json`;
   - `flujo-adjuntos --staging` manda una línea JSON por adjunto, `{source_id, tipo, ext, content_type, bytes, sha256, b64}`, por la salida estándar. Antes comprueba bytes y sha256 de cada copia contra `carga.ndjson`. El informe (`adjuntos`, `faltan`, `no_coinciden`) va por la salida de error.
2. **Cargador, `MODO=adjuntos` y `adjuntos-seco`.** Lee el flujo por la entrada estándar: el adjunto nunca se copia al disco del contenedor, y solo queda en el almacenamiento de Chatwoot. Para cada línea:
   - busca el mensaje del Archivo por `source_id` dentro de la bandeja, y salta los que ya tienen adjunto. No es «solo los mensajes nuevos de esa corrida», como decía el diseño: es por mensaje, así que repetirlo después de un corte completa lo que falte sin duplicar;
   - vuelve a comprobar bytes y sha256;
   - sube con `ActiveStorage::Blob.create_and_upload!(…, identify: false)`;
   - en una transacción, inserta `attachments` y `active_storage_attachments` con `insert_all`. Sin callbacks no hay `AnalyzeJob`, `MirrorJob` ni variantes;
   - si la escritura falla, purga el blob y cuenta `adjuntos_fallidos`.

   La salida trae conteos, blobs antes y después, y los trabajos nuevos por clase.
3. **Ensayo.** El almacenamiento de la copia es un volumen tmpfs del proyecto del ensayo, `almacenamiento`, de 3 GB, montado en `/app/storage` del runner. A8 comprueba que es tmpfs, y el borrado lo quita con el proyecto. Un volumen tmpfs se desmonta, y pierde lo que tiene, cuando para el último contenedor que lo usa, y cada paso del runner es un `run --rm`. Por eso un contenedor mínimo del ensayo, `chatwoot-ensayo-almacen-1`, en la red aislada y sin puertos, lo mantiene montado mientras dura el ensayo. Sin él, AD3 dio `FileNotFoundError` en CI. Primero fue un bind de `/dev/shm/cw-ensayo/storage`, pero ActiveStorage deja ahí carpetas de root que el borrado sin root no puede quitar; lo vio la prueba de CI, en L1 y F2. Las páginas de un tmpfs se le cargan al cgroup de quien las escribe, así que el runner pasa de `mem_limit` 1536m a 4g: si no, los ~2,1 GB de adjuntos lo llevarían al OOM. Esto no se ve con los 314 bytes de CI, y es inferencia hasta el ensayo real. Con `STAGING`, después de las dos cargas de mensajes, corre dos veces `flujo-adjuntos | MODO=adjuntos` y mide:
   - **AD1:** cargados frente a `con_adjunto_para_carga` y bytes frente a `bytes_adjuntos_para_carga`, con 0 trabajos nuevos;
   - **AD2:** 0 en la segunda corrida;
   - **AD3:** íntegros frente al checksum del blob y sin huérfanos: ni blobs sin adjunto ni archivos sin blob desde el inicio del ensayo.

   Sin `STAGING` o sin adjuntos para carga, AD1 a AD3 quedan NO EJECUTADO.
4. **Prueba en CI** (`prueba-cargador.sh`, sobre la imagen real de Chatwoot). Usa tres adjuntos inventados: una imagen PNG de 2×2, un PDF mínimo y un OGG, en total 317 bytes.
   - **D2 a D4:** el extractor deja 3 para carga y el flujo los manda con su huella.
   - **AD1 a AD3:** igual que en el ensayo, en cada escenario.
   - **AD4:** con el servicio `rails` de la prueba levantado, un agente miembro del Archivo pide los mensajes por `/api/v1/…/messages` y baja cada `data_url`, siguiendo las redirecciones de ActiveStorage, con el MD5 igual al del blob. A un agente que no es miembro no le responde 200.
   - **AD5:** el panel recibe la miniatura de la imagen (`thumb_url`, una variante que se genera al primer pedido). Lo que se encola al servir es solo de ActiveStorage; se anota la lista por clase.
   - **Mutantes:** M25, adjunto al mensaje equivocado; M26, no salta los que ya tienen adjunto; M27, el archivo no queda en el almacenamiento; M28, tipo mal mapeado; M29, adjunto con los callbacks de ActiveStorage.
5. **Pruebas de Python** (`PruebasAdjuntosParaCarga`):
   - la copia en claro con 0600 y su huella;
   - sin la opción no hay copia;
   - las tres validaciones;
   - el tar sin las copias;
   - `preparar-carga` y `flujo-adjuntos`, también con un archivo cambiado del mismo largo.

   Mutantes del extractor, a mano: sin la exclusión del tar, el flujo sin comprobar la huella y la copia sin anotar caen. El de permisos 0644 cae solo en Linux, porque Windows no tiene modos POSIX.

6. **La completa programada** (`completa.sh`, ahora en Git junto a `vigia-carga.sh`, que no cambia):
   - corre `extraer` con `--adjuntos-para-carga`, sin `--sin-adjuntos`;
   - **la guarda del token cambia** (Director General, 2026-11-06). Antes miraba que tuviera menos de 24 h. Ahora pide que exista, tenga 600 y más de 200 bytes, y que `kommo-e5-token-caduca.timer` siga activo y esperando su disparo: `is-active` da `active` y `SubState` da `waiting`, sea `OnCalendar` o `--on-active`. Si el timer no está o ya disparó, sale con 11. Medido con systemd 255: un timer que ya disparó queda descargado o `inactive`, también con `RemainAfterElapse=yes`, y mientras corre su borrado queda `active/running`. Una primera versión miraba el próximo disparo en tiempo real; eso habría rechazado un borrado vigente con `--on-active`, como el primero (`OnActiveSec=1d`). Lo atrapó la prueba y quedó como mutante MC8. La vida del token la fija un solo plazo, el del timer, y una reanudación después de las 24 h ya no se niega mientras el timer siga;
   - **guarda nueva:** si el extractor desplegado no entiende `--adjuntos-para-carga`, sale con 13 sin pedirle nada a Kommo y sin tocar el token. Sin esta guarda, un despliegue a medias haría fallar `extraer` por la opción y borraría el token sin haber bajado nada.

   La prueba es `pruebas/prueba-completa.sh`, en CI con systemd de verdad, con un token, timers y un extractor falsos:
   - G1 a G13: el caso normal; sin timer; el timer ya disparado (descargado, con `RemainAfterElapse=yes` y con su borrado corriendo); un borrado con `--on-active`, que vale; los permisos; el tamaño; sin token; la carga; TERM a mitad; `extraer` que falla; el extractor viejo;
   - F1: el token no aparece en ninguna salida;
   - M0 y ocho mutantes: la guarda vieja de 24 h, sin mirar el subestado, mirar el próximo disparo en tiempo real, vuelve `--sin-adjuntos`, no para el timer, borra el token al pararla, sin la guarda 13, y la ayuda leída con `| grep -q` bajo `pipefail`.
7. **Corregido en el ensayo** (encontrado en la primera corrida de CI de la #394): `inf()` se definía después de usarse para `ADJ_ESPERADOS`. El ensayo de CI pasaba sin cargar ningún adjunto, con AD1 a AD3 en NO EJECUTADO, y esa línea no se veía en el resumen. Ahora:
   - `inf()` se define antes de usarse;
   - un informe sin el conteo de adjuntos da AD0 como falla;
   - `prueba-ensayo.sh` exige R2: AD1 a AD3 presentes y pasando, con los 3 adjuntos inventados.

8. **El vigía, con guardas de memoria** (Director General, 2026-11-06), y **la carga contada como sostenida** (propuesta, a revisar por él):
   - `vigia-carga.sh` para la unidad, con TERM (`completa.sh` sale con 143 y el token queda), si `/dev/shm` pasa de 5.120 MB usados, si `MemAvailable` baja de 6.144 MB o si alguna medida no se puede leer. Los ~2,1 GB de adjuntos en claro son una estimación: si salen más del doble, cambia el riesgo, y la condición de Sam es parar y preguntar;
   - **la carga.** Con `sar` del VPS, entre las 05:00 y las 11:00Z, en lecturas de 10 minutos: la de 1 minuto pasó de 8 en 6 de 36 lecturas el 2026-11-02, en 5 de 35 el 03, en 0 el 04 y el 05 y en unas 2 el 06. La de 5 minutos, en 0 o 1 por noche. El 2026-11-01, una incidencia llegó a 173. A las 16:01Z del 06 había 3 lecturas sobre 8 en 2 minutos, con un pico de 8,66. El vigía de hoy mira cada 30 s la de 1 minuto sola, así que pararía casi seguro una completa de 5 h. Propuesta: el vigía y `completa.sh` paran o no arrancan si la de 5 minutos pasa de 8 o la de 1 minuto pasa de 16, el doble. Ese es el pico grave;
   - **pruebas:** `pruebas/prueba-vigia.sh`, en CI con systemd de verdad. La carga y `MemAvailable` se inyectan con `VIGIA_*`, y `/dev/shm` se mide de verdad con `df`, con un archivo de relleno.
     - V1: control. V2: carga sostenida. V7: un pico tolerado. V8: un pico grave. V3: memoria. V4: `/dev/shm`. V5: una medida ilegible. V6: la unidad no arranca.
     - M0 y los mutantes MV1 a MV6, entre ellos MV5, la carga de 1 minuto sola.
     - En `completa.sh`, G8 pasa a una carga alta, G14 es un pico tolerado, y el mutante MC9 es la guarda de 1 minuto de antes.

**Memoria del VPS durante la ventana** (medido el 2026-11-06 a las 14:21Z): 24.031 MB de RAM, con 15.852 disponibles; `/dev/shm` de 12.016 MB, casi vacío; `/` con 174 GB libres; la base de Chatwoot ocupa 77 MB y su almacenamiento 6 MB. Los `.age` van a disco. En tmpfs quedan los textos, unos 2,1 GB de copias en claro y, durante el ensayo, otros 2,1 GB del almacenamiento de la copia más su PGDATA. En el pico, unos 4,5 GB (I).

**Evidencia:** en la PR #394 y en el handoff `0590-e5-estado.md`.

### 10.13 Kommo solo se lee: prueba y emisor del token (2026-11-06)

**El alcance `crm` del token permite escribir** en Kommo. El Director General lo revisó: el extractor (`7795fdc34c65260f`) tiene una sola llamada de red, `urllib.request.Request(..., method="GET")`, que se abre con `self.abrir(req, timeout=…)`. La condición 2 del OK de Sam («Kommo solo se lee») queda ahora fijada por una prueba (`PruebasSoloLectura`, en `pruebas/test_respaldar.py`):

- **`test_el_extractor_solo_hace_get`:** recorre el AST del extractor. Cada `Request` tiene que llevar `method="GET"` explícito y sin `data`, y cada apertura tiene que ir sin cuerpo. No puede haber conexiones HTTP a mano (`HTTPConnection`, `HTTPSConnection`, `putrequest`), ni importar `requests`, `httpx`, `aiohttp`, `urllib3` o `socket`, ni pasar `POST`, `PUT`, `PATCH` o `DELETE` como argumento. **Piso:** exactamente 1 `Request` y 1 apertura. Si el extractor cambiara de forma de llamar, la prueba cae en vez de no mirar nada.
- **`test_mutantes_de_escritura_caen`:** 6 mutantes en memoria, y cada uno tiene que ser detectado: `POST`, sin `method`, con `data`, la apertura con cuerpo, una conexión a mano con `PUT` y una segunda llamada.
- **Mutante sobre el archivo real:** una copia del extractor con `method="POST"` tumba `test_el_extractor_solo_hace_get`.

**El emisor del token.** `probar-token` decía «iss coincide con dtdcargo.kommo.com: no». Se midió el 2026-11-06, mirando solo el host de los claims y sin imprimir el token: **el token de larga duración no trae `iss`** (el claim no existe), y `aud` es un identificador de la integración, no un host. La comparación era contra un texto vacío. En la 1.2.1, `describir_emisor` dice «iss: no viene en el token», y si viene, lo compara con la cuenta. La cuenta se sigue comprobando con `GET /api/v4/account`: HTTP 200 y el subdominio. Pruebas: `test_emisor_ausente_no_dice_que_no_coincide` y `test_emisor_presente_se_compara_con_la_cuenta`. **No se redespliega por ahora** (Director General): el VPS sigue con la 1.2.0, que extrae igual; solo cambia ese mensaje.

| Comprobación | Resultado |
|---|---|
| `python -I infra/ops/kommo-historial/pruebas/test_respaldar.py` (Windows) | PASÓ: 54 pruebas, 3 omitidas |
| Copia del extractor con `method="POST"` | Cae `test_el_extractor_solo_hace_get` (y la de mutantes, porque el texto a mutar ya no está) |

### 10.14 Miembros del Archivo y búsqueda ampliada (Sam, 2026-11-06)

**Sam, relayado por el Director General hacia las 15:00Z:** «No, todo el equipo, no hay problema. Ampliar la búsqueda.»

#### Miembros: todo el equipo

- **Cuántos (medido el 2026-11-06 a las ~15:05Z, solo un conteo en solo lectura de `account_users` de la cuenta 1 de producción):** 2 usuarios, los 2 administradores y 0 agentes. Un administrador ya ve y busca en todas las bandejas, así que hoy agregarlos no cambia lo que ven. Los deja como miembros por si algún día pasan a agentes. **Un usuario que entre después no queda como miembro solo:** hay que agregarlo desde el panel, o repetir `MODO=miembros`, que solo agrega a los que falten.
- **Cómo:** después de la carga, `MODO=miembros CUENTA=1 BANDEJA=<id>` del cargador agrega a todos los usuarios de la cuenta que todavía no son miembros, con `Inbox#add_members`, como el panel. `MODO=miembros-seco` solo cuenta. Si la bandeja tuviera asignación automática, se niega. No quita a nadie.
- **Prueba en CI** (`prueba-cargador.sh`):
  - MI1: el seco no agrega ni encola;
  - MI2: todos los usuarios quedan como miembros, sin notificaciones ni asignaciones, y solo se encola la invalidación de caché;
  - MI3: la segunda vez no agrega a nadie;
  - mutantes, cada uno en una bandeja propia: MI-M1, el seco agrega; MI-M2, no salta a los que ya son miembros; MI-M3, solo los administradores.
- **Ensayo:** `MODO=miembros` en la copia, después de la sonda `despues`, porque E45b compara la cola con la de la creación de la bandeja, con MI1 a MI3. **E10g mide E-10e con un usuario real**: el de menor id entre los agentes y, si no hay agentes, entre los administradores. Con un agente: no encuentra la conversación más vieja del Archivo antes de ser miembro, y sí después. Con un administrador, la encuentra antes y después y queda como miembro. En producción hay 0 agentes, así que el ensayo real mide el caso del administrador. El caso del agente lo cubren el agente temporal (E10e) y la prueba de CI, donde la «producción» simulada tiene un agente.

#### Búsqueda: `SEARCH_TIME_RANGE_LIMIT_DAYS`

**Plan aparte. No se ejecuta sin el Director General.** Va en la ventana de la carga, para que el panel se caiga una sola vez.

**Valor.** El mensaje más viejo del respaldo 5.1 es del 2023-08-23 (§5, «primero 2023-08-23»).
- Hasta el 2026-11-06 son **1.171 días**: pasa de 1.100.
- Primero se propusieron 1.540: los 1.171 días más un año de margen.
- **El Director General decidió 3.650** (2026-11-06), dentro del «Ampliar la búsqueda» de Sam. La ventana corre con el tiempo: con 1.540, el 2027-11-10 los mensajes más viejos habrían salido de la búsqueda de texto sin que nadie se enterara, y alguien tendría que acordarse de revisarlo. Con 3.650, el mensaje del 2023-08-23 sale el 2033-08-20.
- **El rendimiento es el mismo:** hoy las dos ventanas cubren exactamente las mismas filas, porque todo el historial cae dentro de los 1.171 días.

Por la persona o el número, la conversación se sigue encontrando sin ventana (E-10d). **Decide el Director General con Sam.**

**Dónde la lee Chatwoot** (imagen 4.19.1 de producción, leída en solo lectura el 2026-11-06):
- `lib/limits.rb:17-20`: `ENV.fetch('SEARCH_TIME_RANGE_LIMIT_DAYS', '90').to_i`; si no es positivo, 90. No tiene tope;
- `app/services/search_service.rb:194-195`: la ventana de la búsqueda de mensajes;
- `app/views/layouts/vueapp.html.erb:62`: `searchTimeRangeLimitDays`, que el panel usa para decir cuántos días mira.

Las dos lecturas son del proceso web. **Sidekiq no la necesita:** ningún trabajo busca. Como el compose la pasa también a sidekiq, la tomará cuando se recree por otra razón, sin efecto.

**Rendimiento.** El ensayo corre la búsqueda de mensajes dos veces, con todo el Archivo cargado: con 90 días y con `BUSQUEDA_DIAS` (por defecto 3.650).
- **BQ1:** con 90 días no aparece el mensaje con texto más viejo del Archivo; con 3.650, sí.
- **BQ2, la puerta del Director General:** con 3.650 días, la búsqueda sin coincidencias, que recorre toda la ventana, no puede pasar de 1.000 ms. Si pasa, el ensayo falla y se le avisa antes de tocar el VPS.
- **MEDIDA BQ:** mensajes de la cuenta dentro de la ventana, la mediana de 3 en ms de la primera página para una palabra de ese mensaje, y lo mismo para una consulta sin coincidencias, que recorre la ventana entera. También si la cuenta usa la búsqueda GIN (`search_with_gin`) y cuántos índices GIN sobre `content` hay.

La palabra es la menos frecuente de la cuenta entre las de ese mensaje y nunca se imprime. **En CI solo se prueba con datos inventados. Los tiempos reales salen del ensayo.**

**Cómo llegan las variables a rails en el VPS** (leído el 2026-11-06, solo nombres; `/srv/chatwoot/compose.yml` con sha256 `6722ce94fde5948a`):
- sin `env_file`;
- las variables entran una por una en `x-entorno` (`&entorno`): 39 claves, 23 interpoladas desde el `.env` y 16 literales;
- `x-chatwoot` las hereda (`environment: *entorno`), y de ahí `prepare`, `rails` y `sidekiq` (`<<: *chatwoot`);
- `SEARCH_TIME_RANGE_LIMIT_DAYS` no está;
- la última clave es `SMTP_OPENSSL_VERIFY_MODE`, igual que en `infra/chatwoot/compose.yml` de main.

**Pasos en el VPS, con el Director General, en la ventana de la carga:**
1. **Antes:** BQ1 del ensayo en PASÓ y tiempos aceptables para el Director General; `date -u`; carga del VPS de 8 o menos; `cd /srv/chatwoot && sha256sum compose.yml`, que tiene que dar `6722ce94fde5948a`. Si cambió, se para.
2. **Respaldo:**
   - `S=$(date -u +%Y%m%dT%H%M%SZ); cp -p compose.yml compose.yml.antes-busqueda-$S`;
   - `umask 077; docker logs chatwoot-rails-1 >/srv/backups/chatwoot/rails-antes-busqueda-$S.log 2>&1`. El log ya sale redactado por `zz_dtd_redaccion_logs.rb`, y queda con 0600 en el VPS.
3. **Agregar la variable**, con las mismas tres líneas de la #396 (dos de comentario y la variable), debajo de `SMTP_OPENSSL_VERIFY_MODE` en `x-entorno`:
   - la variable: `  SEARCH_TIME_RANGE_LIMIT_DAYS: ${CHATWOOT_SEARCH_TIME_RANGE_LIMIT_DAYS:-3650}`;
   - validar con `docker compose config --quiet`, que no imprime nada;
   - leer solo esta clave: `docker compose config --format json | python3 -I -c 'import json,sys; print(json.load(sys.stdin)["services"]["rails"]["environment"].get("SEARCH_TIME_RANGE_LIMIT_DAYS"))'`, que tiene que dar `3650`. El `.env` no se toca.
4. **Recrear solo rails:** `docker compose up -d --no-deps --force-recreate rails`, con el compose del propio VPS. Nunca `up` del stack entero. Se anota la hora: el panel se cae entre 1 y 2 minutos.
5. **Esperar healthy:** `until [ "$(docker inspect -f '{{.State.Health.Status}}' chatwoot-rails-1)" = healthy ]; do sleep 5; done`, con un tope de 5 minutos. Si no llega, se vuelve atrás.
6. **Comprobar, solo sobre rails** (las S del [runbook de versiones](../../runbooks/chatwoot-versiones.md), con `docker logs chatwoot-rails-1 --since <hora del paso 4>` y `docker exec chatwoot-rails-1`):
   - `docker exec chatwoot-rails-1 printenv SEARCH_TIME_RANGE_LIMIT_DAYS` da `3650`, y `bundle exec rails runner 'p Limits.search_time_range_limit_days'` da `3650`;
   - S2: «protección de /register activa: 1 » da 1 y «modo cerrado» da 0;
   - S3: el candado por comportamiento;
   - S4: «redacción de logs activa» da 1 o más;
   - S5: redacción por comportamiento, con 0 apariciones del correo de sonda;
   - S6: «revocación de sesiones activa» da 1 o más, y «revocar sesiones: faltan» da 0;
   - S7: revocación por comportamiento;
   - S1, S8 y S9: la versión, el registro cerrado y las cabeceras, igual que antes;
   - **la búsqueda encuentra un mensaje viejo:** un `rails runner` que busca, como un administrador de la cuenta 1, la palabra menos frecuente del mensaje con texto más viejo del Archivo, igual que `FASE=busqueda` del ensayo. Imprime solo «si» o «no» y los ms.
7. **Volver atrás**, si algo de 5 o 6 falla:
   - `cp -p compose.yml.antes-busqueda-$S compose.yml && docker compose up -d --no-deps --force-recreate rails`;
   - esperar healthy;
   - `printenv SEARCH_TIME_RANGE_LIMIT_DAYS` vacío y `Limits` en 90;
   - repetir S2 a S7.

   Sin la variable, todo vuelve a ser como hoy: el cambio no toca datos.

**Repositorio:** la misma línea en `infra/chatwoot/compose.yml` y `CHATWOOT_SEARCH_TIME_RANGE_LIMIT_DAYS=3650` en `.env.example`, en la PR #396 contra main, para que main y el VPS no se separen más. Con el `.env.example`, `docker compose config` da `3650` en rails, sidekiq y prepare. El default del compose es el que vale. El `.env` del VPS no necesita la línea; si un día se quiere otro valor, se pone ahí.

### 10.15 Memoria del cargador en producción (Director General, 2026-11-06)

**El riesgo.** En producción, el cargador corre con `docker exec … chatwoot-rails-1`, en el mismo cgroup que el panel.
- El límite de `chatwoot-rails-1` es de 1.536 MiB, y Puma ya usa unos 383 MiB (Director General).
- El runner del ensayo pasó a 4g (§10.12), así que ya no reproduce ese límite. Vale también para `MODO=cargar`, el de los textos.
- Antes, una línea de un adjunto de 200 MB costaba unas 3,5 veces su tamaño: la línea, el `strip`, la cadena del JSON y el decode.
- Un OOM ahí puede tumbar el panel.

**En código (PR #395):**
1. **`rss_pico_kb`:** el cargador imprime el pico de memoria del proceso (`VmHWM` de `/proc/self/status`) en todos los modos. MEM1 lo comprueba en CI, con el mutante MEM-M1, y también en el ensayo, que anota el pico de cada paso en la evidencia.
2. **`bytes_adjunto_max`:** el extractor 1.3.1 lo agrega a `carga-informe.json`. Lo cubren la prueba de Python y D3.
3. **Menos memoria por línea:**
   - `each_line(chomp: true)`, sin la copia del `strip`;
   - la línea se suelta apenas se parsea, el base64 apenas se decodifica y los bytes apenas se suben;
   - con un adjunto de más de 8 MB, se llama al GC antes de decodificar y al terminar.

   **No hay prueba de memoria en CI:** con 314 bytes no se ve, y un umbral de RSS en CI sería inestable. El pico real lo mide el ensayo.
4. **Puerta en producción, antes de cada modo:** `rss_pico_kb` de ese modo en el ensayo, más el uso actual de `chatwoot-rails-1` (`docker stats --no-stream`), más 300 MB, tiene que quedar por debajo de 1.536 MiB. Si no queda, no se corre dentro de `chatwoot-rails-1`, y se le propone al Director General otra vía: un contenedor aparte con su propio límite, o los adjuntos grandes por separado.
5. **Evidencia de adjuntos en producción:**
   - `adjuntos_fallidos`, `adjuntos_no_coinciden` y `adjuntos_sin_mensaje`, en 0;
   - `blobs_kommo a->b`, con b−a igual a `adjuntos_nuevos`. Solo cuenta los blobs `kommo-*`: con tráfico vivo, el total de blobs también suma los de WhatsApp e Instagram que lleguen mientras corre. `blobs a->b` queda como referencia;
   - **`blobs_huerfanos_nuevos`**, en 0: los blobs `kommo-*` creados desde el inicio de la corrida que no tienen adjunto. Un OOM entre la subida y el insert dejaría uno, y repetir la corrida no lo limpia.

   AD1 exige las tres cosas, en CI y en el ensayo. **El caso en que el contador da más de 0 no está probado en CI:** haría falta romper el proceso entre la subida y el insert. Lo cubre por otro camino AD3, que busca huérfanos desde la sonda.

**El almacenamiento del ensayo se dimensiona con los adjuntos** (Director General, 2026-11-06). El vigía de la completa deja llegar hasta 5 GB a `/dev/shm`, así que un almacenamiento fijo de 3 GB podía quedarse corto y tumbar AD1. La guarda 6 de `ensayo-archivo.sh` calcula, antes de crear nada y desde `carga-informe.json`:
- **el almacenamiento:** `bytes_adjuntos_para_carga` × 1,3 más 512 MB;
- **el `mem_limit` del runner:** el almacenamiento, más 2.048 MB para Rails, más tres veces `bytes_adjunto_max`;
- **la memoria necesaria:** el runner, más 1.024 MB para Postgres y Redis, más 2.048 MB de margen.

Si `MemAvailable` no alcanza, sale con 3 y lo dice (MEM0), sin crear nada. Lo prueba N6, con un `/proc/meminfo` inventado. Con unos 2,1 GB de adjuntos salen unos 3,1 GB de almacenamiento, un runner de ~5,7 GB y ~8,8 GB necesarios (I), contra los 15,8 GB que se midieron hoy.

### 10.16 La corrida real: completa, 5.4, ensayo (5.6) y carga en producción (5.7), 2026-11-07

Corrió el Subdirector de Chatwoot, con el Director General al lado en cada puerta. Todo dentro del OK de Sam («Todo, incluida producción», 2026-11-06) y sus seis condiciones. Las horas son UTC, medidas en el VPS. La evidencia está en el VPS, fuera de Git, y solo trae conteos y huellas.

**Huellas que corrieron** (sha256, 16 caracteres):
- Extractor 1.3.0 en la completa: `f576cb2767f1a3ea`.
- Extractor 1.3.1 desde la 5.4: `a9fbc324d10eefe6`.
- `completa.sh`: `86422805c3ed5f55`.
- `vigia-carga.sh`: `79ad8944c359a755`.
- `cargar-archivo-kommo.rb`: `b86c0eed4b5a95fa`.
- `ensayo-archivo.sh`: `c0fb3d336a135ca1`.
- `pruebas/sonda-ensayo.rb`: `5b08e3e2f333847a`.
- `ensayo-otras-cuentas.sql`: `fc0dd444c22c2d6a`.

#### Completa hasta el corte `2026-11-07T05:00:00Z`

- **Corrida 1:** de 05:00:01Z a 06:06:26Z. El vigía la paró por «carga sostenida 8.34 (5 minutos) por encima de 8», con `codigo=143`. Iba en 1850 de 4780 conversaciones.
- **Corrida 2:** reanudó a las 06:40:01Z, con la 1.3.0 y el mismo `CORTE`, por orden del Director General. Terminó a las 09:26:52Z con `extraer_codigo=0`, `codigo=0`, `token=borrado` y la unidad `inactive`.
- **Resultado:**
  - 54.753 eventos y 4780 conversaciones.
  - 3654 adjuntos en el índice: 3639 bajados y 15 con 404 de los servidores de Kommo (`drive-g` 12 y `drive-c` 3; 11 `picture` y 4 `file`, en 10 conversaciones).
  - Huecos: 244 sondeados, ninguno existe y 12 con 403.
  - Peticiones: 9730 (200 = 9470, 404 = 248, 403 = 12, red = 7). De los 248 con 404, 232 son huecos y 15 adjuntos; 1 queda sin atribuir, porque el extractor no registra los 404 (I).

#### 5.4, de 09:33:41Z a 09:33:46Z

- Un solo tenant y la foto del ERP con 704 clientes. Se borró después de leerla.
- **`vincular`:** 4303 contactos, 4258 grupos y 241 clientes vinculados. **E-1 = 0, E-2 = 0**, y 1 ambiguo sin vincular.
- **`preparar-carga`:**
  - 4780 conversaciones y 54.737 mensajes: 29.099 entrantes, 25.638 salientes, 11.714 de bot y 3148 sin texto.
  - 4258 personas.
  - 3639 adjuntos para carga, con 2.134.541.464 bytes; el más grande, 46.839.781.

#### Ensayo (5.6), cuatro intentos

| Intento | Hora | Cómo terminó |
|---|---|---|
| 1 | 09:34:21Z | Lo paró la guarda de 1 min con 9,67 (> 8), antes de la carga-2 |
| 2 | 09:44:34Z | Lo paró la guarda de 1 min con 8,92, antes de la carga-1 |
| 3 | 09:57:53Z | Con `TOPE_CARGA=16`, cambio de guarda del Director General solo para el ensayo. Lo paró el vigía de 5 min con 8,08 (> 8), en la carga-2 |
| 4 | 10:10:55Z → 10:34:31Z | **Completo**: «terminó sola, sin que el vigía la parara» |

- **Guardas del intento 4**, también del Director General, de las ~10:10Z: el vigía corta con 10 a 5 min y 16 a 1 min, y cada 30 s revisa la salud de `dtd-cargo-web-1`, `chatwoot-rails-1`, `chatwoot-sidekiq-1` y `chatwoot-postgres-1`, más el `curl` a la web y a `/api`. La ventana de ejecución iba hasta las 12:30Z.
- **Limpieza:** en los cuatro intentos quedó en 0. En el 3 hizo falta `--limpiar`, porque quedaron un volumen y una red.
- **Intento 4, 32 PASÓ:**
  - A1–A8, D1–D4 y O0–O2;
  - P1, B1, B2, S1, C1 y C2;
  - E45a/b, E6/E6b, E7 (la carga-2 no deja nada nuevo), E8a/b, E9a/b, E10f y E11;
  - AD1–AD3: 3639 adjuntos y 2.134.541.464 bytes, sin duplicar y sin huérfanos;
  - SMTP1, E1, E2, MI1–MI3, BQ2 (12 ms con 3650 días) y MEM1.
- **4 FALLÓ, de la sonda.** El Director General los aceptó como limitaciones de la sonda:
  - **E10d, E10e y E10g:** por nombre la encuentran en los tres casos, y el agente que no es miembro no la ve. Por número, no. La sonda busca el `display_id` de la conversación más vieja del Archivo, la 21 (`sonda-ensayo.rb:186-189`). Chatwoot busca con `ILIKE '%21%'`, ordena por `created_at DESC` y pagina de a 15 (`search_service.rb:32-47`). Con 4800 conversaciones, la más vieja queda al final.
  - **BQ1:** dio `sin_palabra`. El mensaje con texto más viejo del Archivo no tiene ninguna palabra de 5 letras o más (`sonda-ensayo.rb:327-328`). BQ1 no quedó medido.
- **Memoria (`rss_pico_kb`):** el máximo fue 622.616 KB, en adjuntos-2. La puerta de §10.15 da 608 + 406 + 300 = 1314 MiB, por debajo de 1536.

#### Carga en producción (5.7), de 10:59:02Z a 11:29:40Z

- **Puertas del Director General:**
  - el sí, a las 10:40Z;
  - el respaldo `chatwoot-20261107T103842Z`: sha256 de las tres piezas iguales al manifiesto, y B2 «0 differences found»;
  - E-3 «antes», a las 10:39:31Z: `crm_tarjetas=8 crm_tareas=0 chatwoot_webhook_events=22 chatwoot_conversations=7`.
- **Lectura previa** (10:41:47Z), cuenta 1: 19 contactos, 20 conversaciones, 58 mensajes, 5 bandejas, Archivo = 0, 37 blobs (0 `kommo-%`) y **2 usuarios, los 2 administradores**. Coincide con la copia del ensayo.
- **Guardas:**
  - antes de cada modo, la puerta de memoria de §10.15;
  - si la carga pasa de 8 a 5 min o de 16 a 1 min, se pausa hasta que baje de 5 a 1 min y de 6 a 5 min, sin forzar;
  - el vigía de producción cada 30 s, igual que en el ensayo;
  - después de cada modo, los conteos exactos de la bandeja contra el ensayo: cualquier diferencia, para.
- **Resultado:** el vigía dio «terminó sola». En sus 74 lecturas, web y `/api` respondieron 200 y los cuatro contenedores estuvieron `healthy`.

| Modo | Lo que salió (igual que el ensayo) |
|---|---|
| crear-bandeja | **Bandeja 8**, sin `webhook_url`, sin asignación automática ni miembros; `trabajos_nuevos=ninguno` |
| seco | 4258 / 4780 / 54.737, 4257 nuevas y 1 reusada, 0 omitidos; no escribe; secuencia de 20 a 20 |
| cargar | Lo mismo, escrito; secuencia de 20 a 4800; en la bandeja, 4780 conversaciones, 54.737 mensajes, 4258 contact_inboxes y 4258 contactos |
| adjuntos-seco | 3639 adjuntos y 2.134.541.464 bytes; no sube nada |
| adjuntos | 3639 subidos y 2.134.541.464 bytes; `blobs_kommo` de 0 a 3639; 0 huérfanos, 0 fallidos, 0 que no coinciden y 0 sin mensaje |
| miembros-seco / miembros | 2 nuevos (`usuarios_cuenta=2`, los 2 administradores; en el ensayo eran 4 por los usuarios temporales de la sonda); 0 notificaciones y 0 asignadas |
| empaquetar | 3640 archivos cifrados, con 2.146.760.842 bytes y 2 destinatarios; el staging quedó borrado |

- **En todos los modos de carga:** `trabajos_nuevos=ninguno` y 0 correos.
- **Pausa por carga:** de 11:11:33Z (8,31 / 8,39) a 11:28:25Z, antes de miembros-seco.
- **Picos:** la carga de 5 min llegó a 8,89, y `chatwoot-rails-1` a 861 MiB de 1536.
- **E-3 «después»**, del Director General a las 11:32:22Z: **8 / 0 / 22 / 7, igual que antes.** La carga no disparó nada hacia el Studio.

#### Quedó fuera del Archivo (FUERA DE ALCANCE DETECTADO)

- **12 conversaciones de Kommo con 403:** 118, 134, 138, 364, 3746, 3747, 3761, 3764, 3834, 3927, 3928 y 4718. Existen, pero el usuario de la integración no las ve.
  - No tienen eventos, mensajes ni adjuntos bajados.
  - Recuperarlas pide darle acceso en Kommo y otro token, y eso lo decide Sam.
- **15 adjuntos con 404:** Kommo ya no los tiene.

#### Hallazgos para una PR aparte (no se corrigen en esta)

1. **`ensayo-archivo.sh`:** después de un TERM, el `trap limpiar EXIT` (`:133`) sale con 0. La unidad queda en `Result=success` y puede dejar el volumen `chatwoot-ensayo_almacenamiento` y la red. El veredicto hay que sacarlo del vigía, no de `ExecMainStatus`.
2. **`pruebas/sonda-ensayo.rb`:** con datos reales, no mide la búsqueda por número ni BQ1. Hay que buscar por `display_id` exacto y elegir el primer mensaje que tenga una palabra apta.
3. **El guion de la carga no corre `informe` antes de `empaquetar`.** Por eso no quedó `informe.json` con `talks.sin_acceso_403`, que escribe `informe()` (`respaldar-historial.py:1440`), y `manifiesto.json` no lo trae. Los ids siguen en los archivos del staging que van dentro del paquete cifrado de metadatos (I: no se puede comprobar sin la llave de Sam).
