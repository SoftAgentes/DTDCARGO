---
sdd: "0590"
title: "Historial de Kommo: respaldo cifrado fuera de Git y medición del volumen (E5 del programa SDD-0582, pasos 5.1 y 5.2)"
status: in-progress
author: "Claude Worker «E5 historial» (Sam)"
created: 2026-10-30
updated: 2026-10-30
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

Pendiente: se llena con la corrida (stamp, bytes, sha256 del paquete, conteo de adjuntos cifrados, duración, códigos HTTP).

## 5. Resultado de 5.2 — volumen

Pendiente: se llena con `informe.md` de la corrida (copia en [`informe-volumen.md`](informe-volumen.md)).

## 6. revisar-datos-ve del inventario

Pendiente.

## 7. Recomendación de alcance

Pendiente.

## 8. Fuera de alcance de esta SDD

- 5.3 a 5.8 (extractor incremental con instante de corte, E.164 y vínculo con el ERP, modo de importación, ensayo, carga en producción y acta): otro OK de Sam.
- Revocar la integración «DTD 0582 historial (solo lectura)» en Kommo: al cerrar E5 (0.6).
- Copiar el `.age` a un remoto (R2/B2) como los otros respaldos: decisión del Director; el script no lo hace.
