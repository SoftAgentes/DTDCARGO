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

Método: `.claude/skills/revisar-datos-ve/SKILL.md` (tres estados: `ENCONTRADO`, `CORRECTO`, `NO VERIFICABLE`; nada entra sin `archivo:línea`). Marco: Venezuela (CRBV arts. 28 y 60, SC 332/2001, SC 759/2025, Ley Especial contra los Delitos Informáticos arts. 20–22). PIPL solo si el historial llega al equipo de China: hoy no (el respaldo lo descifra solo Sam); si el Archivo Kommo queda visible desde China en 2.7, aplica y se decide allí. **No es asesoría legal.** Los conteos de esta sección se completan con la corrida (§5).

### 6.1 Inventario de datos personales del respaldo

Los titulares: leads y clientes que escribieron a DTD (muchos nunca se registraron en el ERP), terceros nombrados en los mensajes (quien recibe, familiares, proveedores), los **empleados** de DTD que contestaron y los bots.

| Archivo › campo | Qué es | Finalidad declarada | Base de licitud | Retención | Quién más lo ve |
|---|---|---|---|---|---|
| `contactos.ndjson › name, first_name, last_name` | Nombre del lead o cliente | Atención y venta en Kommo; vínculo con el ERP (5.4) | Relación con quien escribe a DTD (precontractual o contractual) | Kommo: indefinida (el sync nunca borra, `docs/legal/privacidad/mapa-de-borrado.md:162`); respaldo: **sin plazo definido → hallazgo** | Kommo · Sam (único que descifra) |
| `contactos.ndjson › custom_fields_values[PHONE, EMAIL]` | Teléfono, correo | Contacto; E.164 y vínculo con `clients` (5.4) | ídem | ídem | ídem |
| `contactos.ndjson › custom_fields_values[otros]`, `leads.ndjson › custom_fields_values` | Campos propios de Kommo (se enumeran por nombre al correr) | **Finalidad no evidente en el código** para los que el ERP no usa (K-11: UTM, `gclid`, `fbclid` que nadie escribe) | — | ídem | ídem |
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
| `informe.json`, `informe.md`, `manifiesto.json`, `respaldo.log` | Conteos, ids, códigos HTTP, hosts, nombres de campo | Evidencia de 5.2 | — | En claro en el VPS y en el repo | Sin datos personales (**CORRECTO**, prueba `pruebas/test_respaldar.py:318-363`) |

### 6.2 Los doce puntos

| # | Punto | Estado | Evidencia y arreglo |
|---|---|---|---|
| 1 | Inventario | `ENCONTRADO` | La tabla 6.1. Campos sin finalidad: `avatar_url` y los campos propios de Kommo que el ERP no usa. **Arreglo:** 5.5 carga solo `text`, `type`, `created_at`, `author.type/name` y adjuntos; nada de `avatar_url` ni campos sin uso. La lista de campos reales se completa con la corrida (§5, «Campos presentes») |
| 2 | Minimización y proporcionalidad | `CORRECTO` en el script · `ENCONTRADO` en el alcance | El respaldo toma **todo** a propósito: Kommo no exporta chats (K-20) y E8 cancela la licencia; sin respaldo el historial se pierde. La minimización va en la carga (5.5) y en la retención (6.3). En el script: el log y el informe no llevan valores (`respaldar-historial.py:157` y prueba `:318-363`); el token solo viaja a hosts de Kommo (`:58`, `:262`; prueba `:264`); nada en claro en disco (`:314` staging 0700 en tmpfs, `:566` adjuntos cifrados desde memoria, `:642` borra el staging); archivo del token 0600 obligatorio (`:109`) |
| 3 | Consentimiento con evidencia | `NO VERIFICABLE` | El consentimiento de quien escribió a DTD por WhatsApp o Instagram no consta en el repo: la base es la relación con el titular. Mover el historial a un archivo de solo lectura propio no es un fin nuevo, pero no hay consentimiento separado y la política pública no nombra el CRM (genérica por decisión: `docs/legal/DTDCARGO_Politicas_Digitales_v3_para_abogada.md:33`). Lo revisa la abogada |
| 4 | Derechos como caminos reales | `ENCONTRADO` | `app/privacidad/page.tsx:296-303` promete que las consultas que no derivan en servicio «se eliminan o anonimizan» y que lo eliminado «desaparece de los respaldos» a los 30 días. Un paquete `.age` inmutable con todo el historial no deja borrar a una persona sin reconstruirlo. **Arreglo:** retención fija (6.3) y procedimiento de borrado por persona: descifrar en tmpfs, quitar sus filas y adjuntos, volver a empaquetar (`empaquetar --conservar-staging` ya lo permite) |
| 5 | El borrado que borra de verdad | `ENCONTRADO` | Escondite n.º 6 («exports y respaldos») nuevo: `/srv/backups/kommo/kommo-<stamp>/` y el 2.º respaldo de 8.5. El espejo de Kommo ya era «el hallazgo más serio del mapa» (`docs/legal/privacidad/mapa-de-borrado.md:140-170`). `CORRECTO`: staging borrado al empaquetar (`:642`), nada en `/tmp`, log sin PII. **Arreglo:** fila nueva en el mapa §F (6.4) |
| 6 | Trazabilidad de las solicitudes | `NO VERIFICABLE` | No se revisó en esta tarea; no cambia con ella |
| 7 | Política pública de tratamiento | `ENCONTRADO` | La política dice «copias de respaldo … 30 días» (`app/privacidad/page.tsx:302`) y «consultas que no derivan en servicio … se eliminan o anonimizan» (`:296`). Un Archivo Kommo con conversaciones de leads que nunca contrataron y sin plazo contradice las dos frases. **Arreglo:** fijar plazos coherentes (6.3) o actualizar la política; E1 ya prevé una nota sobre `/privacidad` (fila 1.7; `docs/legal/privacidad/revision-chatwoot-e1-2026-10-29.md` en la rama de E1, NV en main) |
| 8 | Inventario de terceros | `CORRECTO` · `NO VERIFICABLE` | Ningún tercero nuevo: Kommo ya tiene los datos (`docs/legal/privacidad/inventario-terceros.md:40`, política y contrato ❓) y el VPS es el de DTD en Contabo (`:44`). El script no manda datos a nadie más (`:58`, `:262`). La copia a R2/B2 no se hace aquí; si el Director la pide, cae en la evaluación ya hecha para los respaldos (`docs/legal/privacidad/evaluacion-proveedor-respaldo-externo.md`) |
| 9 | Transferencia internacional | `NO VERIFICABLE` | Dónde aloja Kommo (❓ en el inventario). El respaldo queda en EE. UU. (Contabo US East), como dice la política (`app/privacidad/page.tsx:267-270`). El equipo de China no accede al respaldo. Si el Archivo Kommo se ve desde China (2.7 / 5.5), aplica PIPL arts. 38–40 y 28 (rostros) |
| 10 | Decisiones automatizadas | no aplica | Los 15 Salesbots y los 4 agentes de IA están apagados (K-13, K-14); el respaldo no decide nada |
| 11 | Valor probatorio | no aplica | No hay aceptación electrónica. `.sha256` y `manifiesto.json` prueban integridad del paquete, no autoría ni fecha certificada |
| 12 | Titulares que no son usuarios | `ENCONTRADO` | Leads que nunca se registraron, terceros nombrados en los mensajes y los **empleados** (`usuarios.ndjson › name, email`; `mensajes.ndjson › author.name`). Ninguno pasó por la política del Portal. **Arreglo:** retención acotada (6.3); que 5.5 muestre al asesor como «DTD Cargo» o por nombre de pila (decisión de Sam); un aviso a la persona que atiende de que su nombre queda en el Archivo |

### 6.3 Retención propuesta (decisión de Sam con el Director; no se aplica en esta SDD)

| Copia | Propuesta | Por qué |
|---|---|---|
| Respaldo `.age` de 5.1 (y el de 8.5) | Conservar hasta que se firme el acta final (8.6) y se verifique la carga; después **borrar**, salvo que Sam lo conserve como archivo frío con fecha de borrado escrita (por ejemplo 12 meses tras el corte, por reclamos) | SC 332/2001 (temporalidad) y la promesa de 30 días de la política |
| Archivo Kommo en Chatwoot, conversaciones de **clientes** (con servicio) | Mientras la relación esté activa y lo que exija la ley, como la política | `app/privacidad/page.tsx:290-300` |
| Archivo Kommo, conversaciones de **leads sin servicio** | Plazo fijo desde el último mensaje (por ejemplo 24 meses) y borrado o anonimización | «se eliminan o anonimizan» (`:296`); SC 759/2025 (derecho al olvido) |

### 6.4 Documentos canónicos que cambian

- `docs/legal/privacidad/mapa-de-borrado.md` §F: fila nueva para el respaldo del historial de Kommo (se agrega en esta PR con el stamp de la corrida).
- `docs/legal/privacidad/registro-tratamiento.md`: no tiene filas para las conversaciones (texto y adjuntos); propuesta, no se edita aquí.
- `docs/legal/privacidad/inventario-terceros.md:40` (Kommo): sin tercero nuevo; anotar que desde 5.1 existe copia propia cifrada.

Pide una segunda opinión: otro modelo sobre el mismo inventario. Esta revisión no es asesoría legal: produce un inventario técnico y preguntas para la abogada.

## 7. Recomendación de alcance

Pendiente.

## 8. Fuera de alcance de esta SDD

- 5.3 a 5.8 (extractor incremental con instante de corte, E.164 y vínculo con el ERP, modo de importación, ensayo, carga en producción y acta): otro OK de Sam.
- Revocar la integración «DTD 0582 historial (solo lectura)» en Kommo: al cerrar E5 (0.6).
- Copiar el `.age` a un remoto (R2/B2) como los otros respaldos: decisión del Director; el script no lo hace.
