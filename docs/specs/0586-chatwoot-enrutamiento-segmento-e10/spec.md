---
sdd: "0586"
title: "Enrutamiento por segmento desde el ERP (etapa E10 del programa SDD-0582)"
status: in-progress
author: "Claude Worker «0582 E10» (Sam)"
created: 2026-10-30
updated: 2026-10-30
supersedes: null
superseded_by: null
related: ["0582", "0585", "0383", "0341", "0367", "0492"]
confidencialidad: interno
---

# SDD-0586 — Enrutamiento por segmento (E10)

> SDD hija de la [SDD-0582](../0582-chatwoot-piloto/spec.md), etapa **E10 «Enrutamiento por segmento»**, pasos 10.1 a 10.6 del [checklist](../0582-chatwoot-piloto/checklist.md). Esta entrega cubre **10.1, 10.2 y 10.3**. 10.4 (web y portal), 10.5 (tickets a los embudos, requiere 6.3) y 10.6 (punta a punta con el número de prueba) amplían esta SDD en su propia rama y PR.
>
> Rama `codex/0582-e10-enrutamiento`, apilada sobre `codex/0582-e2-poc` (SDD-0585, paso 2.3, punta `1cbb29b73`). Migración **0505 NO APLICADA**.
>
> **10.1, 10.2 y 10.3 aceptados** (Sam, 2026-10-30, a la pregunta del Director «¿Aceptas lo entregado: 2.4–2.6, 3.1–3.3, 6.2, 6.3 y 10.1–10.3?»: «Acepto todo»). Aceptar la entrega no aplica la 0505: aplicarla sigue siendo una puerta aparte, con OK nominal de Sam al integrar.

## Contexto

- DTD tendrá dos números de WhatsApp, uno para leads y otro para clientes. **Reparto vigente (Sam, 2026-10-30, comunicado por el Director):** los **clientes** van al número **nuevo** (cuenta «DTD Cargo Clientes») y los **leads nuevos y registrados** se quedan en el número **viejo**, que sigue en Kommo hasta el corte. Esto reemplaza el reparto de la línea base v2 (nuevo para leads, actual para clientes).
- Para E10 solo cambia la configuración, no el código: la redirección de 10.2 corre en la bandeja del número viejo cuando pase a Chatwoot (4.5 / E8), y `WHATSAPP_NUMERO_CLIENTES` lleva el número nuevo. En 10.4 la web no cambia y el portal les muestra a los clientes el número nuevo. Los números van solo en la configuración.
- **La regla de segmentos es de Sam** (0.8, 2026-10-30, por el selector): la carga recibida en China cuenta como cliente; quien pierde su único envío vuelve a lead; el bot responde en **1 mensaje**. Se calcula **siempre en el momento**, sin guardar estado.
- Desde el 2026-10-01 **Meta cobra las respuestas** pasados 1.000 mensajes de servicio gratis al mes por número (v3 de 0582). Cada mensaje del bot cuenta.
- **Chatwoot 4.19.1 no reintenta webhooks de cuenta** (SDD-0585). 2.3 dejó un reintento propio: el evento queda «fallido» si un manejador lanza, y el cron `chatwoot-reintentos` lo retoma con `reprocesarEventosChatwoot` / `chatwoot_tomar_pendientes`. E10 se engancha ahí.

## Decisiones

| ID | Decisión | Por qué / evidencia |
|---|---|---|
| E10-D1 | **El segmento es una función SQL** `chatwoot_segmento_contacto(tenant, phone_last10)` que devuelve solo `cliente`, `lead_registrado` o `lead_nuevo`. Estable, `security definer`, `search_path` vacío, solo `service_role` | Regla única en el ERP (0582, «Regla de segmentos»). Sin ids, códigos ni nombres en la salida (contrato: «el segmento es un solo texto, sin filas ni ids») |
| E10-D2 | **Cliente** = alguna ficha viva con ese teléfono (exactamente una) con un envío vivo (`deleted_at` nulo, estado distinto de `draft` y `cancelled`) **o** un recibo vivo en China **no huérfano**, con uno de sus códigos: vigente, historial (0367) y los de las fichas fusionadas en ella (0341, hasta 10 saltos). Códigos con `upper(btrim())` | Patrón de `client_outstanding` (`0492_client_outstanding.sql:259-290`) y `resolve_markbox` (0367). Fusionar deja la ficha vieja con `deleted_at` (`0455_borrado_cliente_auditado.sql:146`), así que no vuelve ambiguo el teléfono |
| E10-D3 | **Un recibo en `incidencia` cuenta** como carga recibida | La caja está físicamente en el almacén a nombre del cliente. El estado describe la consolidación (`0008_warehouses_cn.sql:8-12`) y la UI lo usa para registrar un incidente (`app/studio/(app)/cn/actions.ts:603-608`), no para anular la recepción. Lo que anula un recibo es el borrado suave con motivo (0476). **Decisión de esta tarea con evidencia (C + I); Sam puede revertirla** con un cambio de una línea en la 0505 |
| E10-D4 | **Un recibo huérfano no cuenta**, aunque tenga código escrito | La app solo trata como del cliente un recibo con `not is_orphan and client_markbox` (`app/studio/(app)/cn/actions.ts:264`, `lib/studio/dispatch-queries.ts:169`) |
| E10-D5 | **Ambiguo = lead nuevo:** ninguna o más de una ficha viva con ese `phone_last10` | Igual que el cruce de la 0504 y el router de Kommo (0582, V2-5). No se adivina |
| E10-D6 | **Manejador `clasificarContacto` en `MANEJADORES`** de 2.3, no un endpoint nuevo. Solo actúa en mensajes entrantes de la bandeja del número de leads (`CHATWOOT_INBOX_LEADS_ID`) | El checklist pedía «endpoint `clasificar` con secreto»: el webhook de 2.3 ya está firmado con HMAC y anti-replay, así que un endpoint aparte sería superficie pública sin ganancia. El número de clientes nunca se redirige a sí mismo |
| E10-D7 | **Orden: responder → etiqueta → equipo.** La respuesta va primero porque es lo que la persona ve; si después falla la etiqueta, el evento queda fallido y el reintento no vuelve a responder (reserva) | Cada mensaje cuesta (v3). Mutante «etiqueta antes que respuesta» muere |
| E10-D8 | **Una respuesta automática por conversación cada 24 h, nunca dos.** Reserva en `chatwoot_respuestas_bot` con estados `reservada` → `enviada` | `incierta`; un rechazo definitivo (4xx salvo 408) borra la fila y lanza para reintentar. Red, tiempo agotado, 5xx y 408 son **inciertos**: se marca `incierta` y no se repite. Una reserva colgada más de 10 min cuenta como incierta. `en_curso` (otra entrega enviando) **lanza**, para que el evento no quede «procesado» con la redirección pendiente. Una confirmación fallida se reintenta una vez y después lanza, sin reenviar | Un cliente que manda 5 mensajes no recibe 5 redirecciones (cada una cuesta). Ante la duda se prefiere no responder dos veces: la persona igual queda etiquetada y en su equipo para un humano. Revisión de Codex, hallazgos 1 a 3 |
| E10-D9 | **El reproceso lee de Chatwoot** la bandeja, el teléfono, las etiquetas y el equipo (`GET /conversations/{id}`), porque el evento de 2.3 no los guardó a propósito | Reutiliza `reprocesarEventosChatwoot` sin tocar la 0504 ni guardar teléfonos |
| E10-D10 | **Etiquetas `cliente`, `lead-registrado`, `lead-nuevo`**: se reemplaza solo la de segmento y se conservan las demás. El `POST /labels` de Chatwoot reemplaza la lista entera, así que **se releen justo antes de escribir**; la copia del evento solo sirve para saltar la escritura si ya está bien. Equipos por id en configuración | Revisión de Codex, hallazgo 4. Queda una ventana entre leer y escribir: la API de cuenta no tiene «agregar una etiqueta» atómico (NV, 10.6) |
| E10-D11 | **Textos sin IA, en 1 mensaje, con el enlace `wa.me/<número de clientes>?text=…`**. El número va en `WHATSAPP_NUMERO_CLIENTES`, no en el código. **Ninguno afirma que la persona es cliente** | El cruce por `phone_last10` no mira el código de país: un +1 412… y un +58 412… con los mismos 7 dígitos coinciden (revisión de datos, H-1) |
| E10-D12 | **Sin teléfono (usuario con username, 10.3):** no se consulta el ERP; segmento `lead_nuevo`; respuesta neutra **igual para todos** («si ya eres cliente, escríbenos aquí»); se guarda el BSUID si vino | No revela si un número, un código o una persona existen (0582, «Redirección sin IA»). Prueba: «la respuesta neutra es la misma para cualquiera» |
| E10-D13 | **BSUID = `contact_inbox.source_id`** cuando el contacto no trae `phone_number` y el id no es solo dígitos (eso sería un `wa_id`, o sea un teléfono). Forma `^[A-Za-z0-9._:-]{1,128}$`, igual en TS y en el `check` de la tabla | Que Chatwoot 4.19.1 ponga el BSUID ahí es **NV**: se comprueba en 10.6. Si no viene, se responde igual y no se guarda nada |
| E10-D14 | **Sin configuración no hace nada:** falta `CHATWOOT_ROUTER_TOKEN`, la bandeja, un equipo o el número → el manejador sale sin tocar nada y E2 sigue igual. Las variables se cargan **después** de aplicar la 0505 | Si se cargaran antes, la RPC fallaría, el evento quedaría fallido y se descartaría al quinto intento sin dañar nada |
| E10-D15 | **`chatwoot_contactos_bsuid` con RLS por tenant:** el admin del tenant lee los suyos (para vincularlos a una ficha); escribe solo `service_role`. `chatwoot_respuestas_bot` sigue solo de `service_role` | Condición del Director al asignar la 0505 (2026-10-30). Probado con lectura real bajo `authenticated` (revisión de Codex, hallazgo 5) |
| E10-D16 | **Plazos de Sam en SQL:** BSUID a los 365 días sin actividad y registro de respuestas a los 30 días, en `chatwoot_purgar_enrutamiento()` (solo `service_role`), llamada por el cron `chatwoot-reintentos` | Decisiones de Sam del 2026-10-30 (H-2 y H-3). Contrato §4 con un mutante por plazo |
| E10-D17 | **Usuario de servicio: decisión a confirmar al integrar.** El token de `CHATWOOT_ROUTER_TOKEN` puede ser el del mismo usuario de servicio de la 2.5 (`CHATWOOT_SERVICE_USER_ID`, «Servicio DTD Studio»), que la salud de la Bandeja ya excluye de los admins humanos y que las bajas nunca tocan | Nota del Director (2026-10-30). Se confirma en 10.6 junto con el tipo de token que acepta la API (NV) |

## Lo que se entrega

| Paso | Pieza | Archivo |
|---|---|---|
| 10.1 | Función de segmento, reserva de respuestas y tabla de BSUID (0505, **NO APLICADA**, declarada en `migrations-baseline.json`) | `supabase/migrations/0505_chatwoot_segmento.sql` |
| 10.1 | Contrato SQL y envoltorio PGlite: 67 aserciones, control rojo, 34 mutantes, reaplicación y preflight | `supabase/tests/0505_chatwoot_segmento.test.sql`, `lib/studio/__tests__/chatwoot-segmento.migration.test.ts` |
| 10.2 | Manejador, reglas puras y cliente HTTP de Chatwoot | `lib/studio/chatwoot/enrutar.ts`, `segmento.ts`, `router-api.ts`; registro en `webhook-procesar.ts`; campos opcionales en `webhook-events.ts` |
| 10.2 | Configuración | `lib/studio/chatwoot/config.ts` (`chatwootRouterConfig`), `.env.example` |
| 10.3 | BSUID y respuesta neutra | los mismos archivos |

## Variables nuevas del servidor de Studio

`CHATWOOT_ROUTER_TOKEN` (secreto), `CHATWOOT_INBOX_LEADS_ID`, `CHATWOOT_TEAM_CLIENTES_ID`, `CHATWOOT_TEAM_LEADS_ID`, `WHATSAPP_NUMERO_CLIENTES`. Las crea E3/infra con OK de Sam, después de aplicar la 0505. En Chatwoot hacen falta además las tres etiquetas, los dos equipos y un usuario de servicio con acceso a la bandeja de leads (su token es `CHATWOOT_ROUTER_TOKEN`). **Qué tipo de token acepta Chatwoot 4.19.1 para etiquetar, asignar equipo y responder (agente o bot) es NV**: se comprueba en 10.6.

## Criterios de aceptación

- [x] 10.1: la función devuelve el segmento correcto en los casos: cliente por envío, cliente solo por recibo en China, registrado, nuevo, ambiguo, código histórico, código de ficha fusionada (uno y dos saltos), borrador, cancelado, envío borrado, recibo borrado, incidencia, huérfano, ficha borrada, otro tenant, teléfono inválido y quien pierde su único envío (contrato 0505).
- [x] 10.1: sin datos personales en la salida y solo `service_role` (contrato, «acceso y datos»).
- [x] 10.1: cada regla tiene un mutante que muere (28), más control rojo, reaplicación y preflight.
- [x] 10.2: al cliente, 1 mensaje sin IA con el enlace `wa.me` al número de configuración; etiqueta y equipo; una vez cada 24 h; nunca dos dentro de 24 h, ni ante un resultado incierto; los fallos dejan el evento fallido y el reproceso de 2.3 los retoma (`enrutar.test.ts`, 13 mutantes del manejador mueren).
- [x] 10.3: respuesta neutra idéntica para cualquiera sin teléfono y se guarda el BSUID (`enrutar.test.ts`, contrato 0505 §3).
- [x] Logs sin teléfono, BSUID, número ni token (prueba «los avisos de error no llevan…»).
- [x] `pnpm verify` completo con Docker sobre `a319d4cdc` (2026-10-30, 14:44Z a 16:03Z): **FALLÓ, sin rojos propios después de corregir uno.** Ver «Verify».
- [ ] 0505 aplicada: **NO** (requiere OK nominal de Sam y el runbook).
- [ ] Punta a punta con el número de prueba y el BSUID real: **10.6**.

## Revisión de datos personales (revisar-datos-ve, acotada a este diff)

Inventario técnico, no asesoría legal. Marco: Venezuela (CRBV arts. 28 y 60; SC 332/2001). No hay tratamiento en China en este diff.

**Resumen:** 5 CORRECTO · 3 ENCONTRADO (los tres corregidos: H-1 en el texto, H-2 y H-3 con los plazos de Sam) · 3 NO VERIFICABLE.

### Inventario

| Dato | Qué es | Finalidad | Retención | Quién lo ve |
|---|---|---|---|---|
| `phone_last10` (parámetro de `chatwoot_segmento_contacto`) | Últimos 10 dígitos del teléfono del contacto | Calcular el segmento | **No se guarda**: entra a la función y no se persiste (`0505_chatwoot_segmento.sql`, §1) | Nadie: no sale en logs |
| Segmento (salida) | `cliente` / `lead_registrado` / `lead_nuevo` | Etiqueta, equipo y redirección | Vive como etiqueta en Chatwoot (VPS propio) | Agentes de Chatwoot |
| `chatwoot_respuestas_bot` | Id de conversación, tipo de respuesta y dos fechas | No responder dos veces (costo de Meta) | **30 días** desde el envío (Sam, H-3) | Solo `service_role` |
| `chatwoot_contactos_bsuid.bsuid` | ID de usuario de WhatsApp por portafolio (seudónimo de una persona) | Vincular después a una ficha a quien escribe sin teléfono | **1 año sin actividad** (Sam, H-2) | El admin de su tenant (RLS); escribe solo `service_role` |
| Texto de la respuesta del bot | Enlace `wa.me` al número de clientes | Redirigir | Lo guarda Chatwoot y lo transporta Meta | La persona, agentes, Meta |

### Hallazgos

- **H-1 · ENCONTRADO · corregido en esta tarea.** El cruce por `phone_last10` no distingue código de país (`0504_chatwoot_eventos.sql`, cruce; `0505`, §1): un número extranjero puede coincidir con el de un cliente venezolano y recibir la redirección. La primera versión del texto decía «Como ya eres cliente», lo que revelaba a un tercero que ese número está asociado a un cliente (CRBV art. 60, confidencialidad). **Arreglo aplicado:** el texto ya no afirma la condición de cliente (`lib/studio/chatwoot/segmento.ts`, `respuestaPara`) y una prueba lo fija. **Pendiente (fuera de E10):** cruzar también por código de país exige normalizar `clients.phone` a E.164, que hoy se guarda en formatos mixtos (fixture de la 0504); es decisión del dueño del cruce (0383/0504).
- **H-2 · ENCONTRADO · decidido por Sam y corregido.** `chatwoot_contactos_bsuid` no tenía plazo de conservación (SC 332/2001, temporalidad). **Sam decidió el 2026-10-30, por el selector:** «Cuando alguien escribe sin mostrar su teléfono, Meta nos da un código anónimo (BSUID). ¿Cuánto tiempo lo guardamos si esa persona no vuelve a escribir?» → «1 año» (se había propuesto 180 días). **Arreglo:** `chatwoot_purgar_enrutamiento()` (0505, §4) borra el BSUID con más de 365 días sin actividad (`ultima_vez_at`); la llama el cron `chatwoot-reintentos` cada 5 min.
- **H-3 · ENCONTRADO · decidido por Sam y corregido.** `chatwoot_respuestas_bot` crecía sin purga. No guarda datos personales directos (id de conversación y fechas), pero el id apunta a una conversación de Chatwoot. **Sam decidió el 2026-10-30, por el selector:** «Studio guarda un registro de las respuestas automáticas del bot para no repetirlas. ¿Cuánto tiempo guardamos ese registro?» → «30 días (Recomendado)». **Arreglo:** la misma función borra las filas con más de 30 días desde el envío (o desde la reserva si no salió). Como 30 días > 24 h, la purga nunca habilita una segunda respuesta dentro de la ventana.
- **CORRECTO:** la salida de la función es un texto sin ids ni códigos (contrato «el segmento es un solo texto…»); las tablas nuevas no tienen columnas de teléfono, texto, nombre, correo ni código (contrato); un BSUID de solo dígitos (un teléfono) se rechaza en la base y en TS; los logs del manejador solo llevan códigos de error (`enrutar.ts`; prueba de logs); los fixtures son sintéticos (555, `VE.555…`).

### No verificable

- **NV-1.** Si la política de privacidad pública informa que el ERP clasifica a quien escribe y lo redirige (CRBV art. 28, «conocer el uso y su finalidad»). Es una decisión automática con efecto menor (un mensaje y una etiqueta; un humano sigue atendiendo). La regla está versionada en la 0505.
- **NV-2.** Que Chatwoot 4.19.1 entregue el BSUID en `contact_inbox.source_id` (10.6).
- **NV-3.** El mapa de borrado de una persona: al purgar un cliente o atender una solicitud de destrucción (CRBV art. 28) hay que incluir `chatwoot_contactos_bsuid`, `chatwoot_respuestas_bot` y la conversación en Chatwoot. No hay camino de borrado desde Studio para estas tablas (solo `service_role`).

**Fuera de alcance:** redacción de la política y base de licitud para tratar el BSUID; eso es de un abogado.

## Verify (2026-10-30)

`pnpm verify` completo con Docker sobre `a319d4cdc`, con turno del Director, de 14:44Z a 16:03Z. Exit 1.

| Comprobación | Estado | Detalle |
|---|---|---|
| harness, lint, rsc-boundary, typecheck, edge-functions | PASÓ | — |
| test | FALLÓ | 3 rojos. **Propio, corregido:** `infra-env-example` (las cinco variables del enrutamiento faltaban en `infra/dtd-cargo/.env.example`), aislado 3/3 PASÓ. **Por carga, fuera del diff:** `entorno-prueba-scripts` (SDD-0540, 600 s) y `pglite-limpio` (SDD-0570, 60 s); aislados 10/10 PASÓ. 13 566 pruebas PASÓ |
| docs:check, numbering, feature-constants, components:check, governance:check | PASÓ | — |
| migrations-applied | NO DISPONIBLE | Sin `.env.local` en el worktree (no se copian secretos) |
| pending-migration-symbols | PASÓ | 0 ROJO · 6 AMARILLO declarados, la 0505 incluida |
| sql-tests | FALLÓ | **0503, 0504 y 0505 PASÓ** en PostgreSQL 17. Heredados de SDD-0573: 0497, 0497 carrera y 0467 carrera (cae en el preflight de la 0497) |
| schema-rebuild | PASÓ | — |
| e2e | FALLÓ | Heredado: Shipping Mark (`sin-scroll-horizontal`, el mismo rojo de E2). Flakys de la web pública y del login en el primer intento; nada de Chatwoot ni de Studio |
| build | PASÓ | — |

## Revisión de Codex (2026-10-30)

Revisión estática de los commits `c1d174908` a `3bb3c2e5e`, sin ejecutar nada. Cinco hallazgos, todos corregidos en `d4d5e18a2` con prueba y mutante:

| # | Gravedad | Hallazgo | Corrección |
|---|---|---|---|
| 1 | Alta | Con una reserva en curso, el reproceso cerraba el evento como procesado y la redirección se podía perder | `en_curso` lanza; el evento sigue fallido hasta resolverse |
| 2 | Alta | Si fallaba la confirmación de un envío exitoso, la reserva vencía a los 10 min y se reenviaba | Estados durables; una colgada cuenta como incierta; la confirmación se reintenta y luego lanza, sin reenviar |
| 3 | Alta | Un 5xx se tomaba como «no salió» | 5xx, 408 y red son inciertos (`envioIncierto`) |
| 4 | Media | Las etiquetas se escribían desde la copia del webhook y podían borrar una puesta después | Se releen antes de escribir; queda la ventana NV de la API |
| 5 | Baja | El mutante de lectura de BSUID solo probaba el GRANT | Lectura real bajo `authenticated` y mutantes de la política |

Segunda pasada de Codex sobre `d4d5e18a2` (estática, sin ejecutar nada): los 5 hallazgos y la RLS por tenant del BSUID quedan **CERRADOS**, sin defectos nuevos. Queda reconocida la ventana entre leer y escribir etiquetas (hallazgo 4), que es una limitación de la API y no una regresión.

## Pendientes de esta SDD

- 10.4, 10.5 y 10.6 (ver checklist); se programan después de integrar a `main`.
- **10.5 destrabado:** su dependencia, el 6.3, ya está aceptada. Sam lo reafirmó el 2026-10-30 (comunicado por el Director): «Tenemos en el portal del cliente algo que se llama "canales", entonces quiero conectarlo al CRM también. ser como tickets».
- ~~`pnpm verify` y sql-tests con Docker~~: corridos el 2026-10-30 (ver «Verify»).
- ~~Aplicar la 0505~~: aplicada el 2026-11-04 (ver el cierre al final).
- ~~Número de migración~~: el Director confirmó la **0505** (2026-10-30), comprobada en todas las ramas, remotas y worktrees.

## 2026-11-04 · La 0505 aplicada en producción: cierre del runbook §6

Aplicadas hoy por el Director General. Lo que antes en esta spec dice que no están aplicadas es de su fecha.

| Migración | COMMIT | `version` del ledger | md5 y bytes | Filas del ledger | PR | Evidencia, en `/srv/ops/evidencias/` | Sello en el candado, `ledger` exacta |
|---|---|---|---|---|---|---|---|
| `0505_chatwoot_segmento` | 2026-11-04T04:33:06.329Z | `20261104043306` | `6d26a4f8ac027c0fa981abe2676491a4`, 18170 | 508 | #335 | `apply-0505-dtd-cargo-20261104T043304Z` | `28147026c69de141b5abaa58706ed7ce82adf2992a5c80dce7ec46d639d59168` |

- **OK literal de Sam:** «Doy el mandato», en el chat del Director General, a «¿Das el mandato para terminar las fases 2, 3 y 4 sin detenerme?», 2026-11-03 ~20:10Z. Punto 2 del texto que vio: «Aplicar, primero en prueba y luego en dtd-cargo, de a una y con lectura previa». Registrado a nombre del Director General; el texto íntegro está en `AUTORIZACION.txt` de cada evidencia.
- **Ensayo en prueba:** las seis aplicadas de a una el 2026-11-04 sobre `5fbb25045`. Sobre la imagen de `56cb9f6d5`, sin cambio de blobs, `prueba-punta-a-punta.sh` dio 48 PASÓ y `prueba-reproceso.sh` 35 PASÓ, con 0 fallas. Evidencia en `/srv/ops/evidencias/chatwoot-e2e-prueba/`. Lo que depende de un WhatsApp real se prueba al publicar (`docs/runbooks/chatwoot-bandeja.md`).
- **Respaldo previo:** no se tomó uno antes de este apply. Fue una omisión del Director General, no una decisión. El más reciente es `dtd-cargo-20261103T170055Z`, unas 11,5 horas antes, el que tomó para la 0510 y la 0511. Él lo acepta porque las seis son objetos nuevos y aditivos y la marcha atrás no depende de restaurar. El automático corre a las 06:00Z y la publicación lleva el suyo.
- **Merge:** #335, 2026-11-04T07:34:38Z, `268861aa4`, por el Director General.
- **Publicación:** va en la imagen de `fe35eb2d1`, publicada en `dtd-cargo` el 2026-11-04 a las 12:41:54Z por el Director General; la hora es la que él reportó. El enrutamiento sigue sin clasificar hasta el corte: `CHATWOOT_INBOX_LEADS_ID`, `CHATWOOT_TEAM_LEADS_ID` y `WHATSAPP_NUMERO_CLIENTES` quedan sin escribir.
- **Lectura de esta nota:** los datos salen de `IDENTIDAD.txt` y `registro.txt` de cada evidencia. Este cierre no consultó tablas de producción. El md5 y los bytes se comprobaron contra el archivo al sellar.
- **Espera:** salieron de `pendingBelowCutoff` y de las declaraciones de símbolos. Su cabecera «NO APLICADA A PRODUCCIÓN» no se corrige: la identidad se prueba por md5. Las pruebas que afirmaban la espera ahora afirman que salió. Los comentarios condicionales del código («sin la 0506…») siguen siendo ciertos para otro entorno y no cambian. La web no cambia ni se publica con este cierre.
