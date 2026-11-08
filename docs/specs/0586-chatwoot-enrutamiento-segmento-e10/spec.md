---
sdd: "0586"
title: "Enrutamiento por segmento desde el ERP (etapa E10 del programa SDD-0582)"
status: in-progress
author: "Claude Worker «0582 E10» (Sam)"
created: 2026-10-30
updated: 2026-11-07
supersedes: null
superseded_by: null
related: ["0582", "0585", "0383", "0341", "0367", "0492", "0587", "0056", "0148", "0599", "0590", "0127", "0149"]
confidencialidad: interno
---

# SDD-0586 — Enrutamiento por segmento (E10)

> SDD hija de la [SDD-0582](../0582-chatwoot-piloto/spec.md), etapa **E10 «Enrutamiento por segmento»**, pasos 10.1 a 10.6 del [checklist](../0582-chatwoot-piloto/checklist.md). Esta entrega cubre **10.1, 10.2 y 10.3**. 10.4 (web y portal), 10.5 (tickets a los embudos, requiere 6.3) y 10.6 (punta a punta con el número de prueba) amplían esta SDD en su propia rama y PR.
>
> Rama `codex/0582-e10-enrutamiento`, apilada sobre `codex/0582-e2-poc` (SDD-0585, paso 2.3, punta `1cbb29b73`). Migración **0505 NO APLICADA**.
>
> **10.1, 10.2 y 10.3 aceptados** (Sam, 2026-10-30, a la pregunta del Director «¿Aceptas lo entregado: 2.4–2.6, 3.1–3.3, 6.2, 6.3 y 10.1–10.3?»: «Acepto todo»). Aceptar la entrega no aplica la 0505: aplicarla sigue siendo una puerta aparte, con OK nominal de Sam al integrar.
>
> **10.5, rediseño en borrador** (2026-11-06): sección [«Paso 10.5»](#paso-105--conversaciones-del-portal-en-chatwoot-y-en-los-embudos-rediseño-2026-11-06), al final, con las respuestas de Sam del mismo día. El chat del portal se contesta desde Chatwoot. Sin código ni migración; lo revisa el Director General antes de programarlo.

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
- **10.5 destrabado:** su dependencia, el 6.3, ya está aceptada. Sam lo reafirmó el 2026-10-30 (comunicado por el Director): «Tenemos en el portal del cliente algo que se llama "canales", entonces quiero conectarlo al CRM también. ser como tickets». **Rediseño en borrador el 2026-11-06** («Paso 10.5», al final). Ese día Sam contestó las seis preguntas del primer borrador, y el chat del portal pasa a contestarse desde Chatwoot, con las conversaciones que ya existen cargadas allí. El 2026-11-07 contestó P7, los feriados: opción (a) (§10.5.11). Ese mismo día aprobó los textos públicos T1 a T4 (§10.5.12) y dio el OK del conteo, que corrió el Director General: 24 hilos, 0 archivados y 73 mensajes. También eligió cargar los hilos archivados (§10.5.10). Quedan las puertas (§10.5.20).
- ~~`pnpm verify` y sql-tests con Docker~~: corridos el 2026-10-30 (ver «Verify»).
- ~~Aplicar la 0505~~: aplicada el 2026-11-04 (ver el cierre al final).
- ~~Aplicar la 0519~~: aplicada en prueba y en producción el 2026-11-08 (ver «2026-11-08 · La 0519 aplicada»). La 0520 (PR 1b, #434) también está aplicada en prueba y en producción, con el OK de Sam de cerca de las 02:24Z del 2026-11-08: «Sí, prueba y producción», en respuesta a «¿Autorizas aplicar la 0520, primero en prueba.dtdcargo.com y luego en producción?». Su cierre está en «2026-11-08 · La 0520 aplicada».
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

## 2026-11-08 · La 0519 aplicada en prueba y en producción: cierre

La aplicó el Director General, primero en prueba y después en producción. Lo que antes en esta spec dice que la 0519 está en espera vale para su fecha. Es la ida del chat del portal a Chatwoot (paso 10.5, PR 1a, #424, fusionada el 2026-11-08 a las 00:25:11Z en `caca3438b`).

| Proyecto | COMMIT | `version` del ledger | `created_by` | Filas del ledger después | Evidencia, en `/srv/ops/evidencias/` |
|---|---|---|---|---|---|
| Prueba (`dtd-cargo-staging`) | 2026-11-08T02:09:22Z | `20261108020922` | `servidor-propio:psql:prueba:SDD-0586` | 505 | `apply-0519-dtd-cargo-staging-20261108T020921Z` y `ensayo-0519-dtd-cargo-staging/{antes,despues}.out` |
| Producción (`dtd-cargo`) | 2026-11-08T02:11:18Z | `20261108021118` | `servidor-propio:psql:SDD-0586` | 517 | `apply-0519-dtd-cargo-20261108T021117Z` y `ensayo-0519-dtd-cargo/{antes,despues}.out` |

- **OK literal de Sam,** hacia las 02:05Z del 2026-11-08: «Sí, prueba y producción». Respondía a «¿Autorizas aplicar la 0519, primero en prueba.dtdcargo.com y luego en producción?». Registrado a nombre del Director General; lo comunicó el Subdirector de Chatwoot.
- **Identidad:** blob `02b9d160285f640bdc6b2be63481119584a76f54`, md5 `f613559d5ca34b2932995c8ff051e97e` y 30710 bytes, con los paquetes de `preparar.mjs` sobre `main` en `caca3438b`. El sello del candado lleva sha256 `a04fc76c9e51e6ce11da036319a206983db84fea0685f02cbba1fb835c6143a2` y `ledger` exacta del 2026-11-08. El md5 y los bytes se comprobaron contra el archivo al sellar.
- **Mediciones** (`docs/runbooks/chatwoot-portal-0519-antes.sql` y `-despues.sql`, de la #433):
  - **Antes,** en los dos proyectos, A1 a A5 dieron 0, 0, 23 flags (sin `chatwoot_portal` y con `chatwoot_inbox`), 0 y 1 tenant.
  - **Después,** D1 a D7 dieron lo esperado: la fila del ledger con ese md5, 24 flags con el portal apagado, una fila del flag por tenant y ninguna encendida, las 4 tablas con RLS y solo `service_role`, las 4 RPC definer con `search_path` vacío y solo `service_role`, y la cola en ceros.
- **Smoke sin sesión:** el cron `chatwoot-reintentos` respondió 200 en los dos, las rutas dieron 200 o 307 y el log quedó sin errores. Las imágenes que corren hoy **no** traen el código de la #424, porque la publicación está congelada: el smoke con sesión del runbook queda para cuando se publique.
- **El flag `chatwoot_portal` sigue apagado,** y encenderlo sigue siendo un OK nominal de Sam, con las condiciones de §10.5.9, paso 6.
- **La 0520 (PR 1b, #434) está aplicada en prueba y en producción,** con el OK de Sam de cerca de las 02:24Z del 2026-11-08: «Sí, prueba y producción», en respuesta a «¿Autorizas aplicar la 0520, primero en prueba.dtdcargo.com y luego en producción?». Su cierre está en «2026-11-08 · La 0520 aplicada».
- **Filas del ledger** (runbook de producción §6.3): las midió el Director General a las 02:27Z del 2026-11-08 con un `count` de `supabase_migrations.schema_migrations`. Después de la 0519 había 517 en producción y 505 en prueba. Cuando las midió ya estaba aplicada también la 0520 (02:25:37Z en prueba y 02:26:32Z en producción, con su propio cierre), y había 518 y 506.
- **Lectura de esta nota:** los datos vienen de la evidencia del Director General, comunicada por el Subdirector. Este cierre no consultó tablas de producción.
- **Espera:** salió de `pendingBelowCutoff` y de las declaraciones de símbolos (`retirar-espera.mjs`), y quedó sellada. La cabecera «NO APLICADA A PRODUCCIÓN» de `0519_chatwoot_portal.sql` no se corrige: cambiar el archivo cambiaría el blob y el md5 que ya están en el ledger. La prueba que afirmaba la espera (`lib/studio/__tests__/chatwoot-portal.migration.test.ts`) ahora afirma que salió, con el md5 del sello. Los comentarios condicionales del código («sin la migración…») siguen siendo ciertos para otro entorno y no cambian. La web no cambia ni se publica con este cierre.

## 2026-11-08 · La 0520 aplicada en prueba y en producción: cierre

La aplicó el Director General, primero en prueba y después en producción, con el paquete armado sobre la cabeza `32e858800` de la #434 (migrate-first). Lo que antes en esta spec dice que la 0520 está en espera vale para su fecha. Es la vuelta del chat del portal y destrabar (paso 10.5, PR 1b). La #434 se fusionó después, el 2026-11-08 a las 04:11Z, en `efd7e70f6`, con la cabeza `983f6c5e1`.

| Proyecto | COMMIT | `version` del ledger | `created_by` | Filas del ledger después | Evidencia, en `/srv/ops/evidencias/` |
|---|---|---|---|---|---|
| Prueba (`dtd-cargo-staging`) | 2026-11-08T02:25:37Z | `20261108022537` | `servidor-propio:psql:prueba:SDD-0586` | 506 | `apply-0520-dtd-cargo-staging-20261108T022535Z` |
| Producción (`dtd-cargo`) | 2026-11-08T02:26:32Z | `20261108022632` | `servidor-propio:psql:SDD-0586` | 518 | `apply-0520-dtd-cargo-20261108T022631Z` |

- **OK literal de Sam,** cerca de las 02:24Z del 2026-11-08: «Sí, prueba y producción». Respondía a «¿Autorizas aplicar la 0520, primero en prueba.dtdcargo.com y luego en producción?». Registrado a nombre del Director General; lo comunicó el Subdirector de Chatwoot.
- **Identidad:** blob `29a3bbeaf3b01c85a85961653bffcedd902322e7`, md5 `03bcee54616204644a6981d33ec7764c` y 12500 bytes. El sello del candado lleva sha256 `5814f9a905a03222460c399e70c867b05a04adfa7aa8ba41e0f867f374aeb80a` y `ledger` exacta del 2026-11-08. El blob no cambió al fusionar la #434: en `main` (`efd7e70f6`) sigue siendo `29a3bbea…`.
- **Verificación del script:** salió exacta en los dos proyectos.
- **Permisos medidos por el DG,** en los dos:
  - `chatwoot_portal_respuesta` es solo de `service_role`;
  - `chatwoot_portal_destrabar` es de `authenticated` y de `service_role` (el de `service_role` lo dan los privilegios por defecto de Supabase, y no lo usa);
  - las dos son security definer, con `search_path` vacío.
- **Filas del ledger** (runbook de producción §6.3): las midió el Director General a las 02:27Z con un `count` de `supabase_migrations.schema_migrations`.
- **Web:** respondió 200 o 307, sin errores. Las guardas del VPS corrieron a las 04:11:04Z, al fusionar la #434, y la 0520 está confirmada en el ledger de producción.
- **El flag `chatwoot_portal` sigue apagado.** Encenderlo es un OK nominal de Sam, con las condiciones de §10.5.9, paso 6: T1 a T4 publicados, la 0520 aplicada (ya lo está) y la vía del atascado publicada.
- **Lectura de esta nota:** los datos vienen de la evidencia del Director General, comunicada por el Subdirector. Este cierre no consultó tablas de producción.
- **Espera:** salió de `pendingBelowCutoff` y de las declaraciones de símbolos (`retirar-espera.mjs`), y quedó sellada. Con ella se fue la frase «(la 0519 tampoco está aplicada)» del baseline. La cabecera «NO APLICADA A PRODUCCIÓN» de `0520_chatwoot_portal_vuelta.sql` no se corrige: cambiar el archivo cambiaría el blob y el md5 que ya están en el ledger. La prueba que afirmaba la espera (`lib/studio/__tests__/chatwoot-portal-vuelta.migration.test.ts`) ahora afirma que salió, con el md5 del sello. La web no cambia ni se publica con este cierre.

## Paso 10.5 — Conversaciones del portal en Chatwoot y en los embudos (rediseño, 2026-11-06)

<a id="paso-105--tickets-del-portal-a-los-embudos-diseño-en-borrador-2026-11-06"></a>

> **Rediseño en borrador, con las respuestas de Sam.** El 2026-11-06 Sam contestó en el chat del Director General las seis preguntas de este paso (las 13 a 18 de esa ronda). El Director General las registró literalmente y el Subdirector de Chatwoot encargó rehacer el paso con cada respuesta como decisión cerrada. Sin código de producto, sin migración escrita ni aplicada y sin nada contado en producción. Rama `claude/trusting-kowalevski-525bef`; lo que se cita de `main` es de `7a3cde25d`. Etiquetas: **C** código leído, **D** documentación, **I** inferencia, **NV** no verificado.
>
> **Qué cambió.** El borrador anterior (cabeza `9acf84b60`) dejaba el chat del portal en Studio, con un ticket propio por episodio y la respuesta desde Conversaciones. Sam eligió contestarlo desde Chatwoot (P2) y pasar a Chatwoot las conversaciones que ya existen (P4). Ahora el chat del portal entra a Chatwoot como una bandeja propia, con ida y vuelta al portal, y la tarjeta se ata a esa conversación como en la 6.4. Ya no hay tabla de tickets. Las decisiones del borrador anterior, con su estado, están en §10.5.18: E10-D25 y E10-D26 quedan **reemplazadas**, no borradas.

### 10.5.1 Las respuestas de Sam (decisiones cerradas)

Fuente: registro literal del Director General del 2026-11-06 (notas de su sesión, fuera del repo). P7 es una pregunta nueva de este rediseño: Sam la contestó el 2026-11-07, se la llevó el Director General y la trajo el Subdirector de Chatwoot. Horas en UTC.

| P | Pregunta | Respuesta de Sam | Decisión |
|---|---|---|---|
| P1 | 13 · Qué son los «canales» del portal (19:58Z) | Literal: «En la pregunta número 13, eso se refiere a las conversaciones. Creo que tenemos que atarlo dentro del CRM; adentro del ERP yo lo llamé "Conversaciones". No sé si le cambiamos el nombre adentro del portal y le ponemos "Chat y reclamos" o "Tickets", pero la verdad no me gusta la palabra "reclamos". Si no encontramos otro nombre, mejor dejémoslo como "Conversaciones".» | E10-D32 |
| P2 | 14 · Desde dónde se contesta el chat del portal (20:00Z) | Botón «Desde Chatwoot», la opción (b), que no era la recomendada. Antes de elegir se le dijeron las contras | E10-D33 a E10-D41 |
| P3 | 15 · ¿El cliente ve en el portal el número de su conversación? (20:08Z) | Botón «No por ahora», la recomendada | E10-D44 |
| P4 | 16 · ¿Las conversaciones del portal que ya existen se pasan a Chatwoot? (20:09Z) | Botón «Sí, pasar todas», la opción (b), que no era la recomendada. Antes de elegir se le dijeron las contras | E10-D43 y §10.5.10 |
| P5 | 17 · Un mensaje de fin de semana, ¿vence ese mismo día? (20:28Z, corregida) | Primero, el botón «Sí, ese mismo día». Enseguida, literal: «Las 17 vencen desde el lunes. Cambio.» Vale la segunda | E10-D23 y §10.5.11 |
| P6 | 18 · ¿Agregamos a /privacidad el seguimiento del chat de Soporte? (20:35Z) | Botón «Sí, con el texto nuevo»: un texto nuevo sobre el diseño rehecho, que pasa por revisar-datos-ve y Sam aprueba palabra por palabra antes de publicar. El chat no se conecta al CRM hasta que esté publicado | E10-D42 y §10.5.12 |
| P7 | Feriados: «Además del sábado y el domingo, ¿qué días no cuentan para el plazo del chat del portal?» (2026-11-07) | 03:45Z: «Ninguno». **Anulada:** el Director General le había presentado P7 como «todos los días cuentan, incluidos sábados, domingos y feriados», que no es lo que pregunta la spec. 03:50Z, a «Un feriado entre semana, ¿cuenta como día de trabajo para el plazo del chat del portal?»: «No cuenta». 03:52Z, a «¿Quién mantiene la lista de feriados que no cuentan?»: «Administrador en Studio». Vale la opción (a) | E10-D23 y §10.5.11 |

Tres respuestas de la misma ronda fijan la dirección:

- **Respuesta 1 (19:08Z).** Literal, en parte: «Me interesa trabajar directamente con Chatwoot» y «Solo vamos a enlazar Chatwoot lo mejor posible y con la mejor visualización, tratando de que el usuario no se salga de la aplicación del ERP (para eso se está haciendo)». De Kommo: «déjalo externo hasta que hagamos la migración al 100%». Para la 10.5, el equipo contesta en Chatwoot **dentro del Studio**, en la Bandeja (SDD-0585), y nada de este paso va a Kommo.
- **Respuesta 3 (19:16Z).** «vamos a eliminar a Kommo totalmente de la fórmula». La regla de cliente sigue siendo la de 0.8: «queremos pasarlo a cliente hasta que recibamos su primera carga en China».
- **Respuesta 8 (19:52Z).** La 6.6 guarda el teléfono completo del lead sin ficha (D-6.6-8, opción b). **No toca la 10.5.** Quien escribe por el portal siempre tiene ficha: `portal_post_message` exige un `client_users` activo con su `clients` vivo (`0512_portal_intento_sin_duplicar.sql:112` en adelante, C). Para las tarjetas con ficha, D6 de la SDD-0587 sigue igual: nombre y teléfono viven en `clients`. Además, la 10.5 no le manda a Chatwoot ni el teléfono ni el correo (E10-D35). Usa solo el camino por ficha de la pieza única (E10-D30); qué guarda el camino por teléfono lo decide la 6.6.

### 10.5.2 Lo que ya hay en `main` y se reusa (C)

| Pieza | Dónde | Qué hace hoy | Cómo la usa la 10.5 |
|---|---|---|---|
| Chat del portal | `conversations` y `conversation_messages` (`0106_conversaciones.sql:86-93`); `portal_post_message(text, uuid)` (`0512_portal_intento_sin_duplicar.sql:112`) | Un hilo por cliente, solo texto. Es idempotente por `external_msg_id = 'portal:<cliente>:<intento>'` (`:162`) y reabre un hilo resuelto (`:203`) | **No cambia.** Sigue siendo la fuente de lo que el cliente ve |
| Envío del portal | `sendPortalMessageAction` (`app/portal/(app)/mensajes/actions.ts:72-73`) | Después de guardar, llama sin bloquear al aviso de la SDD-0148 | En el mismo lugar, sin bloquear, pide el envío a Chatwoot (E10-D34) |
| Respuesta desde Studio | `sendReplyAction` (`app/studio/(app)/conversaciones/actions.ts:126` y `:138`); `insertOutboundMessage` (`lib/studio/conversaciones/messages-queries.ts:47`, que pone `unread_count = 0` en `:65`) | Guarda la respuesta y avisa al cliente con `notifyClientReplyPush` | La vuelta desde Chatwoot hace lo mismo (E10-D37). Con el interruptor encendido, Studio deja de responder el portal (E10-D41) |
| Webhook de Chatwoot | `app/api/chatwoot/webhook/route.ts`; `procesarEventoChatwoot` y `MANEJADORES` (`lib/studio/chatwoot/webhook-procesar.ts:128`) | Registra cada evento (0504), corre los manejadores y lo cierra. Un evento fallido se reintenta a 1, 2, 4 y 8 min y se descarta al quinto intento (`chatwoot_tomar_pendientes`, `:204`) | Dos manejadores nuevos, con esos mismos reintentos (E10-D36 y E10-D37) |
| Lectura del evento | `interpretarEvento` (`lib/studio/chatwoot/webhook-events.ts`) | Lleva ids, estado y los últimos 10 dígitos del teléfono: «Nada más cruza este archivo» (`:9`) | No cambia. El texto de una respuesta lo lee solo el manejador del portal (E10-D37) |
| Estado por conversación | `chatwoot_conversations` (0504) | Liga el `client_id` por el teléfono. Si el evento no trae teléfono, conserva el cruce anterior (`0504_chatwoot_eventos.sql:212-214`) | El vínculo del portal escribe el `client_id` una vez, y los eventos siguientes lo conservan |
| Ficha DTD | `pedirFichaDtd` (`app/studio/(app)/bandeja/actions.ts:369`; lee `chatwoot_conversations.client_id` en `:421`) | Muestra el Shipping Mark, los envíos y el saldo según el rol, al lado de la conversación | Sirve igual para el portal, por ese `client_id` (E10-D36) |
| Entrada de leads (6.4) | `entrarLead` y `fuenteDeCanal` (`lib/studio/chatwoot/entrada-leads.ts:86`) | Crea o completa la tarjeta. Un canal API no da fuente (`default`, `:104`) | No cambia: la bandeja del portal tiene su propio manejador (E10-D36) |
| Enrutamiento (10.2) | `clasificarContacto` (`lib/studio/chatwoot/enrutar.ts`); `router-api.ts` (`envioIncierto` en `:26`, espera de 10 s en `:32`) | Etiqueta, equipo y redirección, solo en la bandeja de leads | Se reusan la etiqueta por segmento, el equipo y la API. En el portal no hay redirección ni respuesta automática |
| Agentes vinculados | `chatwoot_agent_links` (0503); `obtenerTokenAgente` (`lib/studio/chatwoot/platform-api.ts:118`) | Traducen un agente de Chatwoot a su usuario de Studio y le piden su token | Autor de la respuesta en el portal (E10-D37) y envío en el modo de respaldo (E10-D40) |
| Bandeja API sin efectos (E5) | SDD-0590 §10.3, §10.4 y §10.10, en la rama `codex/0590-e5-miembros` (PR #395) | Cargador con `insert_all`, sin callbacks y por `source_id`; ensayo en una copia efímera de la base de Chatwoot | La carga de P4 (§10.5.10) |
| Feriados | `operational_calendar` (`0192_operational_calendar.sql:22-32`: país `VE` o `CN`, tipo `holiday` o `fair`); pantalla «Feriados & ferias» del admin (SDD-0127) | Calendario operativo que mantiene el admin | La lista de feriados que no cuentan para «vencida» (P7 = (a), §10.5.11) |
| Cron | `chatwoot-reintentos`, cada 5 min (`infra/dtd-cargo/cron/crontab:26`) | Reintenta eventos y corre las purgas de E2 y E10 | Red de seguridad del envío y de la conciliación (E10-D34 y E10-D40) |

### 10.5.3 Cómo funciona

```
Portal (a la vista, igual que hoy)
  │ portal_post_message → conversation_messages (in)          ← la fuente del portal
  │ después de guardar, sin bloquear: pedir el envío
  ▼
chatwoot_portal_salida (cola) ──► Chatwoot: contacto, conversación y mensaje entrante,
                                  con source_id = dtd:<id del mensaje>
                                        │ webhook de cuenta (message_created, incoming)
                                        ▼
                    entrarPortal: tarjeta por la ficha, etiquetas, equipo y asesor
                    avisarPorPush: aviso al asesor, sin datos de la persona (ya existe)

El equipo responde en la Bandeja (Chatwoot dentro del Studio)
                                        │ webhook (message_created, outgoing)
                                        ▼
                    responderAlPortal → conversation_messages (out) → portal en vivo + push al cliente
```

### 10.5.4 Decisiones

**Nuevas:**

| ID | Decisión | Por qué / evidencia |
|---|---|---|
| E10-D32 | **Nombre: «Conversaciones».** Los «canales» de Sam son el chat de Soporte del portal, «Chat con tu asesor». En el Studio y en el CRM se llama «Conversaciones». La sección de la ficha de la tarjeta se llama «Conversaciones del portal», y la bandeja de Chatwoot también. No se usan «Tickets» ni «reclamos». «Tus casos» (los reclamos) queda fuera | P1. «Reclamos» no se le muestra al cliente: en el portal ese módulo se llama «Tus casos» (comentario de `app/portal/(app)/soporte/page.tsx`). Sam no pidió meterlo al CRM; el Director General se lo dijo para que corrija si no era así |
| E10-D33 | **Reemplaza a E10-D25 y E10-D26.** El chat del portal entra a Chatwoot como **una bandeja propia**, de canal API, llamada «Conversaciones del portal». El equipo lo contesta desde Chatwoot, dentro del Studio (la Bandeja). **Studio sigue siendo la fuente del hilo del portal:** `conversation_messages` guarda todo lo que el cliente ve, y Chatwoot es la mesa de trabajo del equipo | P2 y respuesta 1. El portal lee `conversation_messages` en vivo (`0433_portal_conversation_realtime_principal_tenant.sql`), muestra 90 días (`soporte/page.tsx:209`) y arma los resúmenes mensuales con esos mensajes (`0219_conversation_monthly_digests.sql`). Si la fuente fuera Chatwoot, el portal necesitaría a Chatwoot para mostrar su propio chat |
| E10-D34 | **Ida, de Studio a Chatwoot: una cola, sin trigger.** Cada mensaje del portal que no vino de Chatwoot pasa por la cola `chatwoot_portal_salida`. No la llena un trigger: una función busca los mensajes que faltan por enviar (E10-D24). El envío se pide sin bloquear al guardar el mensaje (`mensajes/actions.ts:72`, al lado del aviso de la SDD-0148), y el cron `chatwoot-reintentos` toma lo que haya quedado. **Orden:** por hilo, según `sent_at` y `id`. Un mensaje no sale mientras quede uno anterior del mismo hilo sin enviar, y cada hilo tiene un solo envío en curso (`for update skip locked` sobre su vínculo). **Idempotencia:** cada mensaje va a Chatwoot con `source_id = dtd:<id del mensaje>`. Ante un error incierto (`envioIncierto`, `router-api.ts:26`), antes de reenviar se leen los últimos mensajes de esa conversación en Chatwoot y se busca ese `source_id`. **Reintentos:** a 1, 2, 4, 8 y 15 min, y después cada 15 min hasta cumplir 24 h. Pasado eso, el mensaje queda «atascado» y sale el aviso de E10-D40 | Es el reintento de la 0504, con más plazo, porque aquí no se pierde nada: el mensaje ya está guardado en Studio. Que Chatwoot 4.19.1 guarde el `source_id` que manda la API y lo devuelva al listar es **NV**; es lo primero que mide la prueba de concepto (PoC-1, §10.5.15) |
| E10-D35 | **El contacto y la conversación en Chatwoot.** Con el primer mensaje de un cliente sin vínculo: (1) Studio genera un identificador al azar y lo guarda; (2) crea el contacto en la bandeja del portal con ese identificador (`dtd-portal:<uuid>`) y el **nombre** tal como lo guarda `portal_post_message`, que es el de la ficha; (3) crea la conversación y guarda el vínculo. **No van a Chatwoot** el teléfono, el correo, la cédula o el RIF, el Shipping Mark ni el `client_id`. Un hilo vivo de Studio es una conversación de Chatwoot; si el hilo se archiva y el cliente vuelve a escribir, es otra | El identificador guardado antes de llamar permite reintentar sin crear dos contactos: si la llamada fue incierta, se busca por ese identificador (NV, PoC-2). El nombre es lo que el agente necesita para saber con quién habla. El resto ya está en la Ficha DTD, que se abre al lado y pide sesión de Studio |
| E10-D36 | **Qué ve el agente y cómo entra la tarjeta: el manejador `entrarPortal`.** Corre con cada mensaje entrante de la bandeja del portal (`message_created`, `incoming`): (1) la tarjeta, con `crm_entrada_portal` (E10-D22); (2) la etiqueta `portal` y la del segmento, con la misma regla de E10 (`etiquetasConSegmento`); (3) el equipo: Clientes si el segmento es `cliente`, Leads si es `lead_registrado`; (4) si la conversación no tiene agente, el asesor de la ficha, cuando está activo y vinculado en `chatwoot_agent_links`. Sin respuesta automática ni redirección. La Ficha DTD muestra el Shipping Mark, los envíos y el saldo según el rol, porque el vínculo dejó el `client_id` en `chatwoot_conversations`. **Miembros de la bandeja:** solo el equipo de Venezuela, nunca un usuario del equipo de China | El portal ya le muestra al cliente quién es su asesor (`getPortalAdvisor`, `soporte/page.tsx`): asignarle la conversación cumple esa promesa. La regla de China sale de `/privacidad`: el equipo de China «No ve tu nombre». Si hoy hay usuarios de China en Chatwoot es **NV** (§10.5.13, punto 9) |
| E10-D37 | **Vuelta, de Chatwoot al portal: el manejador `responderAlPortal`.** Solo toma `message_created` de la bandeja del portal que sea `outgoing`, no privado, ni de actividad ni plantilla, y que no sea el eco de un mensaje nuestro (`source_id` que empieza con `dtd:`). Lo escribe `chatwoot_portal_respuesta` en `conversation_messages` con `direction = 'out'`, idempotente por `external_msg_id = 'chatwoot:<id del mensaje>'` (índice único de `0106_conversaciones.sql:107`) y con la hora de Chatwoot como `sent_at`. **Autor:** el usuario de Studio vinculado al agente (`author_user_id` y su nombre, como la respuesta de hoy). Si el agente no está vinculado, el nombre va vacío y el portal muestra «DTD Cargo», como ya hace (`soporte/page.tsx:234`). Después corren el mismo `notifyClientReplyPush` de hoy y el `unread_count` del hilo a 0, como en `insertOutboundMessage`. **El texto** de la carga del webhook lo lee solo este manejador y solo para esa bandeja: `interpretarEvento` sigue sin llevar texto. En un reproceso, el evento no tiene el texto (la 0504 no lo guarda), así que se relee el mensaje en Chatwoot con el token del servicio (NV, PoC-3). **Si el hilo de Studio está archivado,** no escribe en el portal ni manda el push, y deja en Chatwoot una nota privada, una vez por mensaje (§10.5.10, «Hilos archivados») | El webhook ya está firmado y se reintenta (2.3). Con la hora de Chatwoot, una respuesta que llega tarde por un reintento queda en su lugar del hilo |
| E10-D38 | **Adjuntos: el chat del portal es solo texto.** `conversation_messages` solo tiene `body` (`0106_conversaciones.sql:93`), `portal_post_message` solo recibe texto y la pantalla solo pinta texto. **Ida:** no hay adjuntos que mandar. **Vuelta:** si el agente adjunta un archivo, al portal llega el texto, si lo hay, y el manejador deja en Chatwoot una nota privada, una vez por mensaje: «Este archivo no le llegó al cliente: el chat del portal solo lleva texto. Mándalo por WhatsApp o por correo.» | Mostrar adjuntos en el portal pide almacenamiento nuevo, su revisión de datos y su borrado: queda fuera (§10.5.17) |
| E10-D39 | **El estado.** De Chatwoot al portal, con el evento `conversation_status_changed`, que ya llega: `resolved` pasa a `resuelto`, `open` a `abierto`, y `pending` y `snoozed` a `pendiente`. Del portal a Chatwoot: si el cliente escribe en un hilo resuelto, `portal_post_message` lo reabre en Studio (`0512_portal_intento_sin_duplicar.sql:203`) y el mensaje entrante lo reabre en Chatwoot. Si Chatwoot no lo reabre en una bandeja API, lo reabre el envío (NV, PoC-4). Un hilo archivado en Studio no cambia de estado por Chatwoot (§10.5.10) | El estado lo decide un solo lugar, Chatwoot, donde trabaja el equipo. El portal lo refleja |
| E10-D40 | **Si Chatwoot no responde.** (1) **El portal nunca falla:** el mensaje se guarda en Studio antes de intentar el envío, y el envío no lo espera (E10-D24). (2) La cola reintenta (E10-D34). (3) **Aviso:** si hay mensajes del portal sin llegar a Chatwoot hace más de 15 min, o alguno «atascado», los administradores reciben un push de Studio con **solo números**, por ejemplo «Portal → Chatwoot: 3 mensajes sin llegar», una vez por hora mientras dure. (4) **Modo de respaldo:** apagar el interruptor (E10-D42) devuelve la respuesta del portal a Conversaciones de Studio, como hoy. Al encenderlo otra vez, lo que el equipo escribió desde Studio en ese tiempo sale a Chatwoot como mensaje saliente, con el token del agente vinculado. Así el hilo de Chatwoot queda completo y esas respuestas cuentan como humanas para la D-SA. (5) **Si falla el webhook:** Chatwoot 4.19.1 no reintenta los webhooks de cuenta (comentario de `reprocesarEventosChatwoot`, `webhook-procesar.ts`). El cron compara, en cada hilo vinculado y vivo con actividad en las últimas 24 h, los últimos mensajes salientes de Chatwoot con `conversation_messages`, y escribe los que falten por el mismo `external_msg_id` | El aviso de solo números sigue el patrón de la salud de agentes (SDD-0585, paso 2.5). Que la API de cuenta liste los mensajes de una conversación con su `source_id` y su tipo es NV (PoC-3) |
| E10-D41 | **Un solo lugar para responder.** Con el interruptor encendido, los hilos del portal quedan de solo lectura en Conversaciones de Studio. La caja de respuesta se cambia por «Responder en la Bandeja →», que abre `/studio/bandeja?c=<conversación de Chatwoot>`, y `sendReplyAction` rechaza en el servidor una respuesta a un hilo del portal. Con el interruptor apagado, Studio responde como hoy | Con dos lugares para responder, Chatwoot no vería las respuestas dadas en Studio. El enlace `?c=` a la Bandeja ya existe (`app/studio/(app)/clientes/_components/ChatwootConversacionesCard.tsx`) |
| E10-D42 | **El interruptor `chatwoot_portal`.** Es un flag por tenant de `feature_flag_catalog()` y nace apagado. Esa función se definió por última vez en la 0503 (`0503_chatwoot_bandeja.sql:43`), en `main` y en todas las ramas remotas (medido el 2026-11-06), y se redefine desde ahí. **Encenderlo es un OK nominal de Sam, y no antes de que estén publicados T1 a T4** (P6, §10.5.12): la línea nueva de Soporte en el portal y el `/privacidad` nuevo, con su fecha. Apagado, no se crea nada en Chatwoot, no se manda nada y no corre ningún manejador del portal | P6: el chat no se conecta al CRM hasta que el texto esté publicado. El CRM se alimenta desde Chatwoot, así que la puerta es la misma |
| E10-D43 | **Las conversaciones que ya existen se cargan a Chatwoot** (P4), también las archivadas (decisión 6 b), con el rigor de E5: ensayo en una copia, cero efectos externos, respaldo, conteos y huellas, y OK nominal de Sam antes de producción. Diseño en §10.5.10 | P4. Es el camino del Archivo Kommo de la SDD-0590 |
| E10-D44 | **El portal no muestra número** (P3). El equipo ve el número de la conversación en Chatwoot (`#n`), y `conversations.ref` (`C-AAAA-NNNN`) sigue siendo interno. No hay números de episodio porque ya no hay tickets | P3. Deja sin objeto E10-D28 |
| E10-D45 | **Auditoría.** Sin tabla de tickets, la 10.5 no crea un tipo de auditoría propio: `crm_ticket` queda sin objeto. Los cambios de la tarjeta los audita el trigger de `crm_tarjetas` de la 6.6, con la D-AUD (§10.5.19). Los vínculos y la cola son estado de integración, como `chatwoot_conversations` (0504), y no se auditan. Las respuestas y los cambios de estado que llegan de Chatwoot se escriben en el hilo igual que hoy desde Studio | D-AUD. Hoy, cambiar el estado de un hilo desde Studio no deja evento en `entity_audit_log` (I, no medido): la 10.5 no lo empeora |
| E10-D46 | **Sin ventana de 24 h en el portal.** El portal no es WhatsApp: el equipo puede responder cuando sea, sin plantilla. Para la D-SA, la propuesta a la 0614 es que la bandeja del portal no cuente en las señales 1 y 3 y entre por la señal 2 (§10.5.19) | La D-SA ya dice «En el portal no hay ventana» |

**Vigentes del borrador anterior, adaptadas:**

| ID | Decisión | Por qué / evidencia |
|---|---|---|
| E10-D21 | **El embudo sale del segmento, calculado en el momento.** Quien escribe por el portal tiene ficha, así que es `cliente` (embudo Clientes) o `lead_registrado` (embudo Leads). Lo decide `crm_segmento_tarjetas` (0506), como en el tablero de 6.3, y no se guarda | Sin cambios. Con la respuesta 3, «cliente» sigue siendo quien ya tiene su primera carga recibida en China (0.8) |
| E10-D22 | **La tarjeta, con `crm_entrada_portal`.** La llama `entrarPortal` (E10-D36), como `entrarLead` llama a `crm_entrada_chatwoot` en la 6.4. Ubica la ficha por el vínculo del hilo, no por el teléfono, y usa la pieza única por ficha (E10-D30). Si la ficha no tiene tarjeta, la crea con `fuente = 'portal'` (`0506_crm_modelo.sql:318-320`), etapa de recontacto y el asesor activo de la ficha. Si hay una tarjeta de lead sin ficha cuyo teléfono cruza con esa única ficha, la liga, como el alta web. **Desde «Perdido»,** primero mira el segmento en ese momento (`crm_segmento_cliente`): solo si es lead vuelve a recontacto, con tarea y sin motivo, con la clave `portal:<id del mensaje de Chatwoot>`. A un cliente no se le crea «Volvió a escribir». La regla nueva de recontacto (después de 30 días sin actividad, desde cualquier etapa; respuesta extra de Sam, 19:50Z) es de la 6.6, que la aplica igual aquí y en la 6.4. Con `conversation_updated` no se crea nada: solo se le da asesor a la tarjeta que no lo tiene, como en la 6.4 | Cambio d del Director General y regla de la 6.4. «Registrado / recontacto» pasa a llamarse «Recontacto» (Sam, 21:09Z); ese nombre visible lo cambia la 6.6 |
| E10-D23 | **«Vencida» es de la 10.5 (regla nueva por P5).** Una conversación del portal queda vencida si el primer mensaje del cliente que espera respuesta no la tuvo al terminar su plazo. **El plazo,** en hora de Caracas: si el cliente escribió en un día que cuenta, vence al terminar ese día; si escribió en uno que no cuenta, al terminar el siguiente día que cuenta. **No cuentan** el sábado, el domingo y, según P7, los feriados (§10.5.11). Se calcula en TypeScript al leer, con `conversation_messages`, y no se guarda. **«Sin atender» es otra cosa:** es la D-SA de la 6.6 (§10.5.19), con su umbral de 1 h (respuesta 5) | P5 corregida: «Las 17 vencen desde el lunes». Como no se guarda, cambiar la regla o los feriados no pide migración |
| E10-D24 | **El mensaje del cliente nunca falla por Chatwoot ni por el CRM.** `portal_post_message` no cambia y no hay trigger: el envío y la tarjeta corren después de guardar y fuera de esa transacción | Sin trigger desaparece el riesgo que pedían el bloque `exception` y el barrido de E10-D31 |
| E10-D30 | **Una sola pieza, `crm_tarjeta_ubicar_o_crear`, para los tres usos:** el alta web de la 0513, la 10.5 y el cotizador de la 6.6, con un camino por ficha y otro por teléfono. La 10.5 usa solo el de ficha. `crm_alta_tarjeta_web` se redefine desde su última definición y su contrato se vuelve a correr | D-1 del Director General. La 0614 ya la llama así desde `5dc8500c3` |

### 10.5.5 Qué ve el asesor

- **En la Bandeja** (Chatwoot dentro del Studio):
  - la bandeja «Conversaciones del portal»;
  - el contacto, con el nombre del cliente;
  - las etiquetas `portal` y la del segmento, el equipo y el asesor asignado;
  - la pestaña «Ficha DTD», con el Shipping Mark, los envíos y el saldo según el rol.
- **En el tablero del CRM**, una insignia en la tarjeta:
  - «Portal · sin responder · 3 h»
  - «Portal · respondida»
  - «Portal · vencida»
- **En la ficha de la tarjeta**, la sección «Conversaciones del portal»:

```
Conversaciones del portal
#418 · Abierta · sin responder · vence el lunes
Último mensaje del cliente: sábado 7 de noviembre
[ Abrir en la Bandeja → ]
```

  No muestra el texto de los mensajes: se lee en la Bandeja. Al programar se mira si sirve `ChatwootConversacionesCard.tsx`, la tarjeta «Conversaciones en la Bandeja» de la ficha del cliente, que ya lista número, estado, no leídos y última actividad, sin texto. Iría filtrada a la bandeja del portal.
- **Con la 6.6**, la tarjeta aparece además en su pestaña «Sin atender» si cumple la D-SA. La 10.5 no calcula «sin atender».

### 10.5.6 Modelo de datos y migración (solo descripción)

Una migración nueva, `supabase/migrations/05NN_chatwoot_portal.sql`. **No se escribe ni se aplica en esta tarea.** El número se asigna al arrancar el código (Director General, 2026-11-06). Va primero en prueba y después en producción, con el OK nominal de Sam y el runbook de producción.

**Preflight.** Exige la 0106, la 0503 (`feature_flag_catalog` y `chatwoot_agent_links`), la 0504 (`chatwoot_conversations`), la 0506, la 0512 (`portal_post_message(text, uuid)` y el índice de `external_msg_id`), la 0513 (con `crm_buscar_tarjeta`) y la 0192 (`operational_calendar`, por P7). Antes de redefinir una función se busca su última `create or replace` en todas las migraciones y en todas las ramas.

**Tablas.** Todas con RLS, sin permisos para `anon` ni `authenticated`; solo `service_role`.

1. `chatwoot_portal_contactos`: `tenant_id`; `client_id` (→ `clients`, `on delete cascade`); `identificador uuid`, único; `chatwoot_contact_id bigint`; `chatwoot_source_id text`; `created_at`. Únicos `(tenant_id, client_id)` y `(tenant_id, chatwoot_contact_id)`.
2. `chatwoot_portal_hilos`: `tenant_id`; `conversation_id` (→ `conversations`, `on delete cascade`), único; `chatwoot_conversation_id bigint`; `created_at`. Único `(tenant_id, chatwoot_conversation_id)`.
3. `chatwoot_portal_salida`: `message_id` (→ `conversation_messages`, `on delete cascade`) como clave; `tenant_id`; `conversation_id`; `estado` (`pendiente`, `enviando`, `enviado`, `cargado` o `atascado`); `intentos`; `proximo_at`; `chatwoot_message_id bigint`; `error`, que solo admite un código (`^[a-z0-9_]{1,40}$`); `created_at` y `updated_at`. Índice parcial para lo pendiente.
4. `chatwoot_portal_estado`: una fila por tenant, con `corte timestamptz` (desde cuándo manda la cola; lo anterior lo trae la carga de §10.5.10) y `cargado_at`. Sin corte, la cola no manda nada; en prueba, una carga vacía fija el corte.

**Funciones.** Todas `security definer`, con `search_path = ''` y solo para `service_role`, salvo donde se dice.

1. `chatwoot_portal_tomar(p_limite)`: toma los mensajes del portal posteriores al corte que no vinieron de Chatwoot (sin el prefijo `chatwoot:` en `external_msg_id`) y no tienen fila `enviado` ni `cargado`. Uno por hilo, el más viejo primero. Devuelve el texto, porque el envío lo necesita.
2. `chatwoot_portal_marcar(...)`: cierra un intento, como `enviado` con el id de Chatwoot, o con el código de error y la hora del próximo intento.
3. `chatwoot_portal_vincular(...)`: guarda el contacto y el hilo, y crea la fila de `chatwoot_conversations` con el `client_id`.
4. `chatwoot_portal_respuesta(...)`: la vuelta (E10-D37). Devuelve si insertó, para no avisar dos veces.
5. `chatwoot_portal_estado_hilo(...)`: el estado (E10-D39).
6. `chatwoot_portal_vincular_carga(p_tenant, p_corte, p_filas jsonb)`: el paso 4 de la carga (§10.5.10).
7. `crm_entrada_portal(...)`: la tarjeta (E10-D22).
8. `crm_tarjeta_ubicar_o_crear(...)` y `crm_alta_tarjeta_web` redefinida (E10-D30).
9. `crm_portal_espera(p_tenant)`: por ficha, desde cuándo espera respuesta, que es la hora del primer mensaje del cliente después de la última respuesta del equipo. La usan el tablero y, si la 0614 lo acepta, la señal 2 de la D-SA. Para `authenticated` con `crm_puede_usar()`.
10. `feature_flag_catalog()`, redefinida desde la 0503, con `chatwoot_portal` apagado.

**Postflight** con firmas, permisos y `search_path`, como el de la 0512. **Declaraciones:** `supabase/migrations-baseline.json` y `supabase/pending-migration-symbol-declarations.json`.

### 10.5.7 Permisos y RLS

| Quién | Qué puede |
|---|---|
| `admin` y `commercial` (`crm_puede_usar()`) | Ver la insignia y la sección de la tarjeta, con `crm_portal_espera` y la lectura por tenant de `chatwoot_conversations` (0504) |
| Otros roles del tenant | Nada nuevo |
| Cliente del portal | Nada nuevo. Sigue escribiendo solo con `portal_post_message` y leyendo su hilo (0433) |
| `service_role` | Las tablas nuevas y las funciones de la cola, el vínculo, la vuelta y la carga |
| Agentes de Chatwoot | Lo que Chatwoot les deje ver de la bandeja «Conversaciones del portal»: solo a sus miembros (E10-D36) |

La lectura de `chatwoot_conversations` es por tenant y no mira el rol (0504). Es de antes y no cambia; ahora incluye las conversaciones del portal, sin texto (§10.5.22).

### 10.5.8 Variables nuevas del servidor de Studio

- `CHATWOOT_INBOX_PORTAL_ID`: el id de la bandeja «Conversaciones del portal».
- El token es el del usuario de servicio de E10 (`CHATWOOT_ROUTER_TOKEN`), que tiene que ser miembro de esa bandeja. Los equipos son los de E10 (`CHATWOOT_TEAM_CLIENTES_ID` y `CHATWOOT_TEAM_LEADS_ID`).
- Si falta la bandeja, el token o la cuenta, `chatwootPortalConfig()` da `null` y nada del portal corre, aunque el flag esté encendido.
- Cargarlas es un OK nominal de Sam, como las de E10.

### 10.5.9 Puertas, en orden

1. **La PR de la 10.5,** revisada y fusionada con el flag apagado. Fusionar publica: el texto del portal y el de `/privacidad` salen con esa publicación (§10.5.12).
2. **La migración:** primero en prueba y después en producción (OK nominal).
3. **La bandeja en Chatwoot y las variables** (OK nominal). La bandeja va sin `webhook_url`, sin saludo, sin asignación automática y sin encuesta, como el Archivo Kommo.
4. **Punta a punta en prueba,** con la cuenta 2 de Chatwoot y sin datos reales (§10.5.15).
5. **La carga de las conversaciones que ya existen:** ensayo y después producción, cada una con su puerta (§10.5.10).
6. **Encender `chatwoot_portal`** (OK nominal), solo con T1 a T4 publicados (E10-D42), **con la 0520 aplicada** y con la vía del atascado de la 1b publicada (§10.5.20). Encenderlo sin la 0520 rompe la vuelta: cada respuesta del equipo en la bandeja del portal llama a `chatwoot_portal_respuesta`, que no existe (PGRST202). El evento queda «fallido» y se reintenta a 1, 2, 4 y 8 min, y al quinto intento se descarta (0504): la respuesta no le llega al cliente. Sin la 0520 tampoco existe `chatwoot_portal_destrabar` (hallazgo de la revisión independiente de la #434).

### 10.5.10 La carga de las conversaciones que ya existen (P4)

Es el camino del Archivo Kommo de E5 (SDD-0590 §10.3, §10.4 y §10.10), adaptado a una bandeja que sigue viva. **Va después de publicar el `/privacidad` nuevo,** porque copia a Chatwoot texto y nombres.

**Qué se carga.** Todos los hilos del canal `portal` del tenant de Chatwoot, con todos sus mensajes: los vivos (`deleted_at` nulo), con su estado, y también los archivados (`deleted_at` no nulo). Los archivados se cuentan aparte (C-1).

**Hilos archivados (decisión 6 b).** Sam, 2026-11-07 a las 06:55Z: «Sí, todos». Va contra la recomendación «No cargarlos», y se le avisó antes de elegir. Ese día eran 0 (el conteo, al final de esta sección).

- **Qué es un hilo archivado (C).** Hoy solo lo archiva la fusión de fichas. Si las dos fichas tienen hilo del portal, `merge_clients` archiva el de la ficha fusionada y lo cuelga de la que queda, para no perder el historial (`0361_merge_clients_conserva_kommo_contact.sql:155-170`, su última definición). El portal no lo muestra: lee solo el hilo vivo (`getPortalThread`, `lib/portal/portal-conversation-queries.ts:135`), y `portal_post_message` escribe solo en el vivo (`0512_portal_intento_sin_duplicar.sql:175`). Conversaciones de Studio tampoco lo lista (`lib/studio/conversaciones/conversations-queries.ts:143`). No es que el equipo los saque de la vista, como decía el borrador.
- **Cómo quedan en Chatwoot.** Chatwoot no tiene estado «archivado». La conversación se carga `resolved`, sea cual sea su estado en Studio, en el contacto de la ficha de la que cuelga. Al final lleva una nota de actividad, con la hora en que se archivó: «Hilo archivado en el Studio. El cliente ya no lo ve: lo que se escriba aquí no le llega.» La nota entra como un mensaje más, con `insert_all` y `source_id = dtd:archivado:<id del hilo>`, así que no avisa a nadie ni se duplica (C-3 y C-5). No se usa una etiqueta: el cargador de E5 no escribe etiquetas, y escribirlas sin callbacks (`taggings` y `cached_label_list`) sería trabajo nuevo para 0 hilos de hoy (I).
- **El Studio sigue siendo la fuente.** La carga no cambia en Studio ni el `deleted_at` ni el estado de ningún hilo (C-6). El hilo archivado tiene su vínculo y su fila de `chatwoot_conversations`, como uno vivo, para que la Ficha DTD funcione.
- **Si alguien le responde en Chatwoot a un hilo archivado.** `responderAlPortal` mira el hilo en Studio. Si tiene `deleted_at`, no escribe en `conversation_messages` ni manda el push, porque el cliente no lo vería: el portal lee solo el hilo vivo. Deja en Chatwoot una nota privada, una vez por mensaje: «Este hilo está archivado en el Studio: el cliente no ve esta respuesta. Si tiene otra conversación del portal abierta, escríbele allí; si no, por WhatsApp o por correo.» (texto de la 1b: la revisión independiente de la #434 notó que «su otra conversación» puede no existir; es texto interno de la nota) El evento se cierra como hecho, sin reintentos (E10-D37). Un cambio de estado en Chatwoot tampoco cambia el hilo archivado (E10-D39), y la conciliación no lo toca (E10-D40).
- **Un hilo que se archiva después de la carga** (una fusión con el flag encendido) no cambia solo en Chatwoot. Lo cubre la misma guarda, porque mira el Studio en el momento de la respuesta.

**Cómo, en el VPS, todo en `/dev/shm` (0700) y borrado al terminar:**

1. **Extraer** de la base de Studio, en una transacción de solo lectura, a un ndjson. Lleva: por hilo, su id de Studio, su estado, si está archivado y desde cuándo, y el nombre del cliente; por mensaje, su id, la dirección, el texto, `sent_at` y, si es del equipo, el usuario y su nombre. No lleva teléfono, correo, cédula, RIF ni Shipping Mark.
2. **Preparar la carga:** un contacto por cliente, con un identificador nuevo al azar (E10-D35); una conversación por hilo, con el estado traducido (E10-D39) o, si está archivado, `resolved` y su nota de actividad; y por mensaje, `source_id = dtd:<id del mensaje>`, entrante o saliente, y `created_at` = `sent_at`. El remitente de un saliente es el agente vinculado a su autor y, si no tiene, el usuario de servicio.
3. **Cargar** con el cargador de E5 (Ruby, `rails runner` en el contenedor de Chatwoot), adaptado a esta bandeja. Escribe con `insert_all`, que no corre callbacks: ni webhooks, ni notificaciones, ni `SendReplyJob`, ni eventos de reportes. Salta lo que ya existe por `source_id`, y tiene un modo seco que solo cuenta. Devuelve un archivo de vínculos con **solo ids**: del hilo de Studio a la conversación y el contacto de Chatwoot, y de cada mensaje a su id en Chatwoot.
4. **Vincular en Studio** con `chatwoot_portal_vincular_carga`. Guarda los vínculos, marca como `cargado` cada mensaje cargado, fija el corte de la cola y crea las filas de `chatwoot_conversations` (estado, bandeja y `client_id`), sin eventos. No crea tarjetas, ni tareas, ni avisos. Lo escrito entre la extracción y el encendido del flag sale por la cola, que empieza en el corte.

**Los dos archivos entre la preparación y la carga (10.7, PR 2).** Lo propone el Worker de la 10.5 el 2026-11-08, para que E5 lo confirme antes de escribir código. La frontera la fijó el DG:
- el Worker de la 10.5 hace la migración (`chatwoot_portal_vincular_carga`, la 0523), la extracción y la preparación;
- E5 adapta su cargador y hace el ensayo, en su propia rama;
- los dos trabajan en `infra/ops/portal-historial/` sin compartir archivos, y se comunican solo por estos dos archivos.

Los dos viven en `/dev/shm` (0700) y se borran al terminar. Tienen un objeto JSON por línea, en UTF-8 y con LF. El campo `tipo` dice qué es cada línea, como en `carga.ndjson` de E5. Las fechas van en ISO 8601 con zona (`…Z`). Los ids de Studio son uuid en texto, y los de Chatwoot, enteros entre 1 y 2147483647. Un campo que no aplica va `null`, no se omite.

**`preparado.ndjson`** (de la preparación al cargador). Lleva primero la cabecera, después todos los `contacto`, después todos los `conversacion` y al final todos los `mensaje`. Dentro de cada hilo, los mensajes van en el orden de Studio: `sent_at` y después `id`.

| `tipo` | Campos | Notas |
|---|---|---|
| `cabecera` (1 línea) | `version` (1), `tenant_id`, `cuenta` (la de Chatwoot), `bandeja` (`CHATWOOT_INBOX_PORTAL_ID`), `corte` (5 minutos antes de que empiece la transacción de solo lectura de la extracción; ver el riesgo 2), `contactos`, `conversaciones` y `mensajes` (conteos) | El cargador rechaza el archivo si los conteos no coinciden con las líneas |
| `contacto` (uno por cliente) | `cliente` (`clients.id`), `identificador` (uuid), `nombre` | `identificador`: el que devuelve la reserva `chatwoot_portal_reservar_contactos` (riesgo 1): el guardado, o uno nuevo al azar que se guarda antes de cargar (E10-D35). En Chatwoot es `dtd-portal:<identificador>`, sin teléfono ni correo (C-10). `nombre`: `clients.name` |
| `conversacion` (una por hilo) | `hilo` (`conversations.id`), `cliente`, `estado` (`open`, `pending` o `resolved`), `creada_at`, `archivado_at` y `nota_archivo` | El estado se traduce así: `abierto` → `open`, `pendiente` → `pending` y `resuelto` → `resolved`. Un archivado va `resolved`, con `archivado_at` y una `nota_archivo` (`source_id` `dtd:archivado:<hilo>`, el texto de esta sección y `created_at` igual a `archivado_at`). Si no está archivado, `nota_archivo` va `null` |
| `mensaje` (uno por mensaje) | `hilo`, `mensaje` (`conversation_messages.id`), `source_id` (`dtd:<mensaje>`), `sentido` (`entrante` o `saliente`), `texto`, `created_at` (el `sent_at` de Studio) y `agente` | `agente`: el `chatwoot_user_id` vinculado al autor (`chatwoot_agent_links`), solo en un saliente. Si no tiene vínculo, `null`, y el cargador firma con el usuario de servicio. En un entrante siempre va `null`: lo escribe el contacto |

Qué se extrae: los hilos del canal `portal` del tenant, vivos y archivados, que **todavía no tienen vínculo** en `chatwoot_portal_hilos`; los que ya lo tienen los llevó la cola. Se toman todos sus mensajes, salvo los que vinieron de Chatwoot (`external_msg_id` que empieza con `chatwoot:`). No se llevan teléfono, correo, cédula, RIF ni Shipping Mark.

**`vinculos.ndjson`** (del cargador a la vinculación). Lleva **solo ids**: ni nombres ni textos. Primero la cabecera, después los `contacto`, los `conversacion` y los `mensaje`. Con `MODO=seco` no se escribe.

| `tipo` | Campos | Notas |
|---|---|---|
| `cabecera` (1 línea) | `version` (1), `tenant_id`, `cuenta`, `bandeja` y `corte`, copiados del `preparado.ndjson`; `contactos`, `conversaciones` y `mensajes` (conteos de lo vinculado) | `chatwoot_portal_vincular_carga` rechaza el archivo si `tenant_id`, `bandeja` o `corte` no son los del preparado, o si los conteos no coinciden con las líneas |
| `contacto` | `cliente`, `identificador`, `contacto_id` (`contacts.id`) y `source_id` (el `source_id` del `contact_inbox` en la bandeja del portal) | Si el contacto ya existía, va su id. `source_id` nunca es un teléfono: es el chequeo de `chatwoot_portal_contactos` |
| `conversacion` | `hilo` y `conversacion_id` | `conversacion_id` es el **`display_id`**, el número que usan la API y `chatwoot_portal_hilos`, no el id interno de la fila |
| `mensaje` | `mensaje` (`conversation_messages.id`) y `mensaje_id` (`messages.id` en Chatwoot) | Va uno por mensaje cargado o ya existente por `source_id`. La nota de archivo no va: no es un mensaje de Studio |

**Ejemplos inventados** (uuid y números sintéticos; los nombres y los textos son de muestra):

```
{"tipo":"cabecera","version":1,"tenant_id":"10000000-0000-4000-8000-000000000001","cuenta":1,"bandeja":9,"corte":"2026-11-10T14:00:00Z","contactos":1,"conversaciones":1,"mensajes":2}
{"tipo":"contacto","cliente":"20000000-0000-4000-8000-0000000000a1","identificador":"30000000-0000-4000-8000-0000000000b1","nombre":"Cliente Sintético"}
{"tipo":"conversacion","hilo":"40000000-0000-4000-8000-0000000000c1","cliente":"20000000-0000-4000-8000-0000000000a1","estado":"open","creada_at":"2026-10-01T12:00:00Z","archivado_at":null,"nota_archivo":null}
{"tipo":"mensaje","hilo":"40000000-0000-4000-8000-0000000000c1","mensaje":"50000000-0000-4000-8000-0000000000d1","source_id":"dtd:50000000-0000-4000-8000-0000000000d1","sentido":"entrante","texto":"SINT ¿Llegó mi caja?","created_at":"2026-10-01T12:00:00Z","agente":null}
{"tipo":"mensaje","hilo":"40000000-0000-4000-8000-0000000000c1","mensaje":"50000000-0000-4000-8000-0000000000d2","source_id":"dtd:50000000-0000-4000-8000-0000000000d2","sentido":"saliente","texto":"SINT Sí, llegó el lunes.","created_at":"2026-10-01T12:30:00Z","agente":7}
```

```
{"tipo":"cabecera","version":1,"tenant_id":"10000000-0000-4000-8000-000000000001","cuenta":1,"bandeja":9,"corte":"2026-11-10T14:00:00Z","contactos":1,"conversaciones":1,"mensajes":2}
{"tipo":"contacto","cliente":"20000000-0000-4000-8000-0000000000a1","identificador":"30000000-0000-4000-8000-0000000000b1","contacto_id":501,"source_id":"dtd-portal:30000000-0000-4000-8000-0000000000b1"}
{"tipo":"conversacion","hilo":"40000000-0000-4000-8000-0000000000c1","conversacion_id":1201}
{"tipo":"mensaje","mensaje":"50000000-0000-4000-8000-0000000000d1","mensaje_id":90001}
{"tipo":"mensaje","mensaje":"50000000-0000-4000-8000-0000000000d2","mensaje_id":90002}
```

**El formato quedó cerrado con E5 el 2026-11-08** (comunicado por el Subdirector):
1. **Nombres:** el cargador adopta tal cual `contacto`, `sentido` y los demás nombres de este formato.
2. **`conversacion_id`:** es el `display_id`.
3. **El contacto:** se reconoce por `identifier = dtd-portal:<identificador>`. Si ya tiene un `contact_inbox` en esta bandeja, `vinculos.ndjson` devuelve su `source_id` real, aunque no empiece con `dtd-portal:` (por ejemplo, si lo creó la cola). El chequeo de `chatwoot_portal_contactos` sigue rechazando un `source_id` que sea un teléfono.
4. **`nota_archivo`:** es un objeto `{source_id, texto, created_at}`, o `null`. El cargador la escribe como un mensaje de actividad.
5. **El usuario de servicio:** va en `AGENTE_SERVICIO=<id>`, en el entorno del cargador. El cargador rechaza la carga si ese id no es un usuario de la cuenta. Si un `agente` no nulo no es usuario de la cuenta, falla con `HECHO error=agente_desconocido`, y no firma con el usuario de servicio sin decirlo.
6. **Lo que el cargador rechaza, sin escribir nada:**
   - una `cuenta` o una `bandeja` de la cabecera distintas de las del entorno;
   - conteos que no coinciden con las líneas;
   - un `mensaje` de un hilo que no está en el archivo;
   - una `conversacion` de un cliente sin `contacto`.
7. **La bandeja con `webhook_url` (la guarda G1 del Archivo) se sigue rechazando.** La bandeja «Conversaciones del portal» es de canal API y va sin `webhook_url` (§10.5.9, puerta 3; guion de encendido, §1; PoC-6). El webhook que llega a Studio es el de la cuenta, como en V-4. Si la bandeja tuviera `webhook_url`, sería una bandeja mal configurada, y lo seguro es no cargar.
8. **Los controles de Studio en el ensayo (C-6, C-7 y C-8):** el Worker de la 10.5 escribe las consultas en su propio archivo, `infra/ops/portal-historial/controles-studio.sql`. Son de solo lectura y devuelven solo conteos y huellas md5. E5 las corre desde su ensayo, contra la copia efímera de Studio. No hay archivos compartidos.

**Dos riesgos de la carga y su arreglo** (revisión del Subdirector del 2026-11-08, sobre `4bdc781b4`):

1. **Repetir la carga no duplica contactos ni conversaciones.** Supón que la carga en Chatwoot entra y `chatwoot_portal_vincular_carga` falla, por ejemplo por un corte de red. Al repetir, la extracción vuelve a traer esos hilos, porque siguen sin vínculo. Si la preparación inventara otro identificador al azar, el contacto `dtd-portal:<nuevo>` sería otro, y Chatwoot crearía contactos y conversaciones dobles. Es la regla de la 0519: el identificador se guarda **antes** de llamar a Chatwoot.
   - **(a), obligatoria: la reserva.** La 0523 suma `chatwoot_portal_reservar_contactos(p_tenant_id, p_clientes uuid[])` (solo `service_role`). La preparación la llama **antes** de escribir `preparado.ndjson`. Inserta en `chatwoot_portal_contactos` una fila por cliente que todavía no tiene, con su `identificador` al azar y `chatwoot_contact_id` nulo (`on conflict do nothing`), y devuelve el identificador de cada cliente, nuevo o guardado. Una repetición lee el mismo, así que el cargador encuentra el contacto `dtd-portal:<identificador>` que ya creó y lo reusa. Es una escritura en la base de Studio, y en producción va dentro de la puerta 4, con su OK.
   - **(b), confirmada por E5:** el cargador reconoce una conversación ya cargada por `additional_attributes.dtd_hilo` (el uuid del hilo) y los mensajes por su `source_id`, así que repetir no duplica ni conversaciones ni mensajes. **El contacto solo se mantiene igual si el identificador es estable:** por eso la reserva (a) es obligatoria.
   - **La prueba:** la carga entra, la vinculación falla, se repite todo desde la extracción, y no queda ningún contacto ni conversación doble. Lo miden C-3 y C-10 en el ensayo, y el contrato de la 0523.
2. **Un mensaje que cae entre la foto y el corte entra una sola vez (I).** Supón que el corte fuera la hora exacta en que empieza la transacción de solo lectura. Un mensaje que inserta otra transacción que empezó antes y confirma después tiene un `sent_at` anterior al corte, pero no está en la foto. No lo carga la extracción y tampoco lo manda la cola, que toma solo `sent_at >= corte` (`0519_chatwoot_portal.sql:226`).
   - **El arreglo:** el `corte` de la cabecera va **5 minutos antes** del inicio de la transacción de solo lectura.
   - **Lo que cae en ese margen y está en la foto** se carga y queda `cargado`. La cola salta las filas `enviado` y `cargado` (`0519_chatwoot_portal.sql:228`, comprobado), y `chatwoot_portal_rezagados` tampoco las cuenta (`:476`).
   - **Lo que cae en el margen y no está en la foto** lo manda la cola al encender, porque su `sent_at` es posterior al corte.
   - **Si algo se manda dos veces,** Chatwoot no lo duplica, por el `source_id` `dtd:<mensaje>`.
   - **La prueba:** un mensaje en el margen que está en la foto entra una sola vez y no vuelve a salir por la cola. Otro en el margen que no está en la foto sale una sola vez por la cola. Va en el contrato de la 0523, con `chatwoot_portal_tomar`.

**El ensayo (5.6 de E5, adaptado).** Es una copia efímera de la base de Chatwoot, con el mismo guion y las mismas guardas de `ensayo-archivo.sh`: red interna, tmpfs, `pg_dump` en solo lectura, la marca de la copia y el borrado de las otras cuentas solo en la copia. El paso 4 corre contra una copia efímera de la base de Studio, con las mismas guardas. Todo se mide con conteos y huellas md5, sin datos de personas:

| # | Medición | PASÓ si |
|---|---|---|
| C-1 | Hilos vivos y archivados, mensajes del cliente y del equipo, en Studio | Solo se anotan; son la base de C-2 |
| C-2 | Lo cargado coincide con lo extraído: contactos, conversaciones y mensajes, más una nota por hilo archivado | Iguales |
| C-3 | Cargar dos veces no duplica | 0 filas nuevas |
| C-4 | Webhooks de Chatwoot a Studio durante la carga (log del proxy y trabajos de webhook en Sidekiq) | 0 |
| C-5 | Mensajes a clientes: `SendReplyJob` y trabajos de canal; correos entregados (`deliver.action_mailer`); filas nuevas en `outbox_push_events` de Studio | 0, 0 y 0 |
| C-6 | El portal no cambia: conteo y md5 de los ids de `conversation_messages` y de `conversations`, antes y después | Iguales |
| C-7 | El CRM no cambia: `crm_tarjetas`, `crm_tareas`, `crm_historial_etapas` y `chatwoot_webhook_events` | Iguales |
| C-8 | `chatwoot_conversations`: una fila nueva por hilo cargado, con el `client_id` de su hilo | Una por hilo y 0 distintos |
| C-9 | La secuencia de `display_id` queda por encima del máximo, y una conversación creada después no choca (E-8 de E5) | Sí |
| C-10 | Contactos: uno por cliente, 0 huérfanos y 0 contactos de esta bandeja con teléfono o correo | 1, 0 y 0 |
| C-11 | Lo que ya había en Chatwoot no se toca: `updated_at` de las conversaciones previas (E-11 de E5) | 0 cambian |
| C-12 | El orden: en cada hilo, el orden de Chatwoot por `created_at` es el de Studio por `sent_at` e `id`, sin contar la nota de archivo | 0 diferencias |
| C-13 | Los estados: en los hilos vivos, conteo por estado en Studio frente al de Chatwoot, ya traducido; los archivados, todos `resolved` y con su nota | Iguales |
| C-14 | El panel y la búsqueda muestran lo cargado (E-10 de E5) | Sí; si no, se reindexa |

**Puertas.** Cada una con su OK nominal de Sam; el «Sí, pasar todas» de hoy no cubre ninguna:

1. leer en producción el chat del portal para el ensayo (datos de clientes, que no salen del VPS y viven en tmpfs);
2. crear la bandeja «Conversaciones del portal» (también es la puerta 3 de §10.5.9);
3. correr el ensayo;
4. producción: respaldo de Chatwoot y de Studio antes, lectura previa, de a una y conteos después, con el Director General, que recibe la evidencia del ensayo antes;
5. encender el interruptor.

**Conteo para el Director General.** Contar las conversaciones en producción pide su propio OK, así que aquí no se contó nada. La consulta queda lista y la corre el Director General: es de solo lectura y devuelve solo conteos y fechas, sin texto, nombres ni ids de clientes. Se corre en el contenedor de la base de Studio con `psql -v tenant=<uuid del tenant> -f <archivo>`:

```sql
-- SDD-0586 §10.5.10 · Conteo del chat del portal. SOLO LECTURA.
-- Devuelve conteos y fechas; ni texto, ni nombres, ni ids de clientes.
begin transaction read only;
set local statement_timeout = '30s';

select
  count(*)                                                                as hilos,
  count(*) filter (where c.deleted_at is null)                            as hilos_vivos,
  count(*) filter (where c.deleted_at is not null)                        as hilos_archivados,
  count(*) filter (where c.deleted_at is null and c.status = 'abierto')   as abiertos,
  count(*) filter (where c.deleted_at is null and c.status = 'pendiente') as pendientes,
  count(*) filter (where c.deleted_at is null and c.status = 'resuelto')  as resueltos,
  count(distinct c.client_id)                                             as clientes
from public.conversations c
where c.tenant_id = :'tenant' and c.channel = 'portal';

select
  count(*)                                    as mensajes,
  count(*) filter (where m.direction = 'in')  as del_cliente,
  count(*) filter (where m.direction = 'out') as del_equipo,
  min(m.sent_at)::date                        as primero,
  max(m.sent_at)::date                        as ultimo,
  max(length(m.body))                         as largo_maximo
from public.conversation_messages m
join public.conversations c on c.id = m.conversation_id
where c.tenant_id = :'tenant' and c.channel = 'portal' and c.deleted_at is null;

rollback;
```

**Resultado del conteo (decisión 6).** Sam dio el OK el 2026-11-07, cerca de las 06:40Z (la hora la dio el Director General): «Sí, córrela». El Director General la corrió a las 06:44:45Z en `dtd-cargo-db-1`, con el archivo literal de arriba (md5 `a5da12512b23b4662678e6eb5926c632`, el mismo que da este bloque, de `-- SDD-0586` a `rollback;`), entre `begin transaction read only` y `rollback`. Solo números, sin ids:

| Hilos | Vivos | Archivados | Abiertos | Pendientes | Resueltos | Clientes distintos |
|---|---|---|---|---|---|---|
| 24 | 24 | 0 | 0 | 0 | 24 | 24 |

| Mensajes | Del cliente | Del equipo | Primero | Último | Largo máximo |
|---|---|---|---|---|---|
| 73 | 41 | 32 | 2026-06-09 | 2026-11-06 | 1028 caracteres |

La segunda consulta cuenta solo los mensajes de hilos vivos (`c.deleted_at is null`). Como ese día había 0 archivados, los 73 son el total del chat del portal. El texto de la consulta no se cambia, porque ya se corrió así. La carga vuelve a contar al extraer (C-1): hasta entonces puede haber hilos y mensajes nuevos, y algún hilo archivado por una fusión.

### 10.5.11 El plazo de respuesta: lunes y feriados (P5 y P7)

**La regla (E10-D23), en hora de Caracas:**

| El cliente escribe | Vence al terminar |
|---|---|
| Un día que cuenta (lunes a viernes, sin feriado) | Ese mismo día |
| El sábado o el domingo | El lunes (o el siguiente día que cuente, si el lunes es feriado) |
| Un feriado, según P7 | El siguiente día que cuente |

La calcula una función pura, sin red ni base, con la lista de días que no cuentan. Venezuela no cambia la hora en el año, así que el fin del día es siempre 23:59:59 en `America/Caracas`.

**P7, decisión cerrada: opción (a)** (Sam, 2026-11-07, traída por el Director General; las tres respuestas están en §10.5.1). La pregunta era «Además del sábado y el domingo, ¿qué días no cuentan para el plazo del chat del portal?». **No cuentan el sábado, el domingo ni los feriados de Venezuela que el administrador carga en Studio, en Administración › Feriados & ferias.**

- **La lista** es la que ya existe: `operational_calendar`, país `VE`, tipo `holiday`, sin `deleted_at` (`0192_operational_calendar.sql:22-47`; SDD-0127). Un feriado tiene `end_date` nula y dura un día. Si alguno trae un rango, cuenta cada día del rango (I). Las ferias (`fair`) y los feriados de China no entran.
- **Quién la mantiene:** el administrador de Studio. Cambiar o agregar un feriado no pide código ni migración, porque «vencida» se calcula al leer (E10-D23).
- **Aviso:** si un año no tiene feriados de Venezuela cargados, el CRM se lo avisa al administrador.

| Opción | Qué pasa | Quién la mantiene | Estado |
|---|---|---|---|
| **(a) Los feriados de Venezuela que el administrador carga en Studio, en Administración › Feriados & ferias** | Usa la lista que ya existe (`operational_calendar`, país `VE`, tipo `holiday`; SDD-0127). Si al empezar un año no hay feriados de Venezuela cargados, el CRM se lo avisa al administrador | El administrador de Studio | **Elegida** («No cuenta», 03:50Z; «Administrador en Studio», 03:52Z) |
| (b) Ninguno: solo el sábado y el domingo | Un feriado cuenta como día de trabajo | Nadie | Descartada: Sam contestó que un feriado entre semana «No cuenta» |
| (c) Una lista fija de feriados nacionales, escrita en el sistema | No hay que cargar nada, pero cada cambio del calendario pide un cambio de código | Programación | Descartada: la lista la mantiene el «Administrador en Studio» |

### 10.5.12 Textos públicos aprobados

**Aprobados por Sam palabra por palabra (2026-11-07 04:48Z, traídos por el DG): «Apruebo los cuatro».** Son T1 (la variante de P7 = (a)), T2, T3 y T4, tal como están abajo. Se publican en la PR de la 10.5 (§10.5.16) y en su tanda, con el OK del Director General. Si cambia una sola palabra, se vuelve al Director General antes de publicar. Se escriben sobre `main` en `7a3cde25d`, que ya tiene el texto de la #399.

**T1 · Portal, Soporte** (`app/portal/(app)/soporte/page.tsx:200`). Hoy: `{role} · Te responde en el día`. Con la regla de P5, ya no es cierto para el fin de semana. Con P7 = (a) queda una sola variante.

> `{role} · Te responde en el día hábil`

La variante de la opción (b), `{role} · Te responde en el día, de lunes a viernes`, se descarta con ella.

**T2 · `/privacidad`, fila «Portal del Cliente» de lo que recogemos** (`app/privacidad/page.tsx:80`). Se agrega al final, después de «pagos reportados y comunicaciones con nuestro equipo.»:

> Todos los mensajes del chat de Soporte, con tu nombre, quedan también en nuestro propio sistema de atención, alojado en nuestro servidor, donde nuestro equipo los lee y te responde.

**T3 · `/privacidad`, finalidades** (`app/privacidad/page.tsx:212`). Hoy: «**Gestionar tu cuenta** en el Portal del Cliente.» Queda:

> **Gestionar tu cuenta** en el Portal del Cliente y atender lo que nos escribes por su chat de Soporte: saber si ya eres cliente para que te atienda el equipo que corresponde y darle seguimiento a tu consulta.

**T4 · Fecha.** `UPDATED` (`app/privacidad/page.tsx:43`) pasa al día en que se publique, con un comentario en el código que registre la aprobación de Sam, como los anteriores.

**Lo que no cambia, y por qué:**

- §4, «Con quién compartimos datos». Chatwoot no es un tercero (§10.5.13, punto 8), y la lista ya dice, del proveedor de gestión de clientes: «Estamos pasando esa atención a nuestro propio sistema, alojado en nuestro servidor» (`app/privacidad/page.tsx:278`).
- §6, plazos. El chat del portal sigue el plazo de la cuenta del cliente, y los respaldos de Chatwoot son los 30 días cifrados que la política ya dice.

### 10.5.13 Datos personales (revisar-datos-ve)

Revisión del diseño y del código vigente que toca, con `.claude/skills/revisar-datos-ve/SKILL.md` y sus referencias. Las citas son del código de hoy; lo que depende de código que todavía no existe queda **NO VERIFICABLE** hasta implementarlo. Estados de la skill: **ENCONTRADO**, **CORRECTO** o **NO VERIFICABLE**. Marco: Venezuela (CRBV arts. 28 y 60; SC 332/2001). Esto no es asesoría legal.

**Resumen:** 3 CORRECTO · 5 NO VERIFICABLE · 3 ENCONTRADO (los tres con su arreglo en el diseño) · 1 no aplica · y 1 ENCONTRADO anterior a la 10.5 (Telegram, punto 8).

**¿Chatwoot es un tercero? No, según el repo (D):**

- «Chatwoot CE corre en el mismo servidor de Contabo (fila de arriba): **no es un tercero**, es software propio» (`docs/legal/privacidad/inventario-terceros.md:75`);
- «Chatwoot CE `v4.19.1-ce` en el mismo VPS que la producción de DTD (decisión E0-D1)» (`docs/runbooks/chatwoot-servidor.md:16`);
- los adjuntos se guardan en el disco del servidor: `ACTIVE_STORAGE_SERVICE: local` (`infra/chatwoot/compose.yml:103`).

Contabo es el proveedor del servidor, y ya está en la política como proveedor de alojamiento. Que el VPS siga hoy así no lo medí en esta tarea: es evidencia del repo, no una lectura del servidor.

Salidas de Chatwoot que ya existían y siguen igual (`inventario-terceros.md`):

- **Cloudflare:** «todo el tráfico del panel en claro (conversaciones y adjuntos), como ya pasa con la web y Supabase de DTD» (`:84`). La misma fila anota que falta Cloudflare en la tabla general.
- **Backblaze B2:** respaldos de Chatwoot cifrados con `age`, 30 días.

**Inventario que suma la 10.5:**

| Dato | Dónde | Finalidad | Retención | Quién lo ve |
|---|---|---|---|---|
| Texto de cada mensaje del chat del portal y nombre del cliente | Chatwoot: contacto y mensajes de la bandeja «Conversaciones del portal» | Que el equipo lea y responda (P2) | Hoy, sin plazo propio en Chatwoot (ENCONTRADO, punto 5) | Miembros de la bandeja: solo el equipo de Venezuela (E10-D36) |
| Lo mismo, de las conversaciones que ya existen | Igual, por la carga de §10.5.10; durante la carga, un ndjson en `/dev/shm` del VPS | P4 | El ndjson se borra al terminar; lo cargado, como la fila anterior | Igual; el ndjson, solo root en el VPS |
| Identificador al azar del contacto | Studio (`chatwoot_portal_contactos`) y Chatwoot | Reintentar sin duplicar (E10-D35) | Con la ficha (cascada) | `service_role` |
| Ids de Chatwoot (contacto, conversación, mensaje) | Studio (`chatwoot_portal_contactos`, `chatwoot_portal_hilos` y `chatwoot_portal_salida`) | El vínculo y la cola | Con el hilo y la ficha (cascada) | `service_role` |
| Código de error del envío | `chatwoot_portal_salida.error` | Saber por qué no llegó | Igual | `service_role` |
| Respuesta del equipo, con su autor | `conversation_messages` (ya existía; ahora también llega de Chatwoot) | Que el cliente la vea en el portal | La de hoy | La de hoy |
| Aviso a los administradores | Push de Studio | Enterarse si Chatwoot no recibe (E10-D40) | El del push | Admins; solo números |

**Los doce puntos:**

| # | Punto | Estado | Evidencia y comentario |
|---|---|---|---|
| 1 | Inventario | CORRECTO | La tabla de arriba. Lo que sale de Studio es el nombre y el texto (E10-D35); el teléfono, el correo, la cédula, el RIF, el Shipping Mark y el `client_id` no salen |
| 2 | Minimización | NO VERIFICABLE | Por diseño: el contacto de Chatwoot lleva solo nombre e identificador al azar, y los logs, solo códigos, como hoy (`webhook-events.ts:9`, `entrada-leads.ts`). Se prueba al implementar: la prueba del envío revisa las claves de cada carga que sale a Chatwoot |
| 3 | Consentimiento | NO VERIFICABLE | El cliente escribe al chat para que le respondan; la base de licitud de atenderlo desde otro sistema propio y de darle seguimiento comercial no está en el código. La decide Sam con su asesor |
| 4 | Derechos | ENCONTRADO, con arreglo | El cliente ve su chat en el portal, igual que hoy. **Hallazgo:** pedir el borrado de sus datos tiene que alcanzar la copia de Chatwoot. **Arreglo:** el borrado de la ficha borra en Chatwoot el contacto y sus conversaciones de esta bandeja (API de cuenta), con el vínculo en cascada; los respaldos caen a los 30 días, como dice la política. Fila nueva en `docs/legal/privacidad/mapa-de-borrado.md` |
| 5 | Borrado | ENCONTRADO, con arreglo | Chatwoot no tiene plazo propio para el contenido de las conversaciones (SDD-0587 §14.3, punto 8). Para esta bandeja: el contenido dura lo que dura la ficha, y se borra con ella (punto 4). Se prueba en prueba con un valor único rastreable: se borra la ficha y se busca ese valor en Studio, en Chatwoot y en sus logs. Sin OK, no se prueba en producción |
| 6 | Trazabilidad de solicitudes | NO VERIFICABLE | Igual que en la 6.4: no hay registro de solicitudes de derechos en el código |
| 7 | Política pública | ENCONTRADO, con arreglo | Hoy `/privacidad` no dice que el chat de Soporte se lee y se responde en otro sistema. **Arreglo:** T2 y T3 (§10.5.12), aprobados por Sam y publicados **antes** de encender el flag y antes de la carga (E10-D42) |
| 8 | Terceros | CORRECTO · ENCONTRADO anterior | Chatwoot no es un tercero (arriba). Las salidas que ya existían (Cloudflare y Backblaze) no cambian. **Anterior a la 10.5:** el aviso de la SDD-0148 manda a Telegram el nombre del cliente, su Shipping Mark y hasta 140 caracteres del mensaje (`lib/studio/conversation-inbound-notify.ts:103-112`), y el texto de la #399 dice que la mensajería interna recibe avisos «sin tu nombre ni tus datos de contacto». Con el flag encendido, el aviso al equipo es el push de Chatwoot, sin datos de la persona, así que ese de Telegram sobra para el portal. Apagarlo lo decide el Director General con el Subdirector de SEO (§10.5.20) |
| 9 | Transferencia internacional | NO VERIFICABLE | El servidor está en Estados Unidos, como ya dice la política. **China:** la bandeja solo lleva miembros del equipo de Venezuela (E10-D36), porque la política dice que el equipo de China no ve nombres. Si hoy hay usuarios de China en Chatwoot no se midió: se mira al crear la bandeja |
| 10 | Decisiones automatizadas | CORRECTO | El segmento solo elige el equipo y el tablero: no niega servicio ni le responde al cliente. Sin bot ni IA en esta bandeja |
| 11 | Aceptación electrónica | No aplica | No se registran aceptaciones |
| 12 | Titulares que no son usuarios | NO VERIFICABLE | El texto del chat puede nombrar a otras personas (un proveedor, otro importador). Con la 10.5 ese texto queda también en Chatwoot, con el mismo borrado del punto 4 |

La skill pide una segunda opinión: otro modelo puede revisar este diseño. **Lo que necesita un abogado:** la base de licitud (punto 3) y la redacción final de T2 y T3.

### 10.5.14 Gobernanza ([AGENT-BRIEF](../../governance/AGENT-BRIEF.md))

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 | cumplimiento por diseño | Matriz de abajo |
| AUD-01 | no conformidad pendiente para la tarjeta | Es la misma de la 6.4 (SDD-0587 §16.6): crear una tarjeta no deja evento. La cierra el trigger de `crm_tarjetas` de la 6.6 (SDD-0614 §2.7 d), que va después. Sin tickets, no hay otro evento que auditar (E10-D45) |
| AUD-02 | no aplica | No cambia quién consulta ni exporta la bitácora |
| MP-01 | cumplimiento | No hay borrado ni archivo nuevo desde la pantalla |
| BTN-01 | cumplimiento por diseño | «Abrir en la Bandeja» y «Responder en la Bandeja» son enlaces; no cambian nada |
| A11Y-01 | por verificar al implementar | Insignia con texto y nombre accesible; enlaces alcanzables con teclado |
| VIS-01, VIS-02 | por verificar al implementar | Tokens de `app/studio/tokens.css` y el tono de las tareas vencidas; `/ui-check` |
| LOD-01, ERR-01 | por verificar al implementar | La sección usa los estados de la ficha: cargando, vacío («Sin conversaciones del portal»), error con «Reintentar» y migración sin aplicar |
| TBL-01 | cumplimiento por diseño | Lista corta con paso a la Bandeja |
| DND-01 | no aplica | La tarjeta se arrastra como en 6.3 |
| CMP-01 | por verificar al implementar | Reusa las piezas de la ficha y, si sirve, `ChatwootConversacionesCard` |
| FRM-01 | no aplica | Sin formulario nuevo |

**Matriz SGE-00:**

| Principio | Resultado | Evidencia |
|---|---|---|
| .01 Acción predecible | cumple | Se responde en un solo lugar (E10-D41) |
| .02 No perder trabajo | cumple por diseño | El portal guarda antes de enviar y la cola reintenta (E10-D24, E10-D34); con Chatwoot caído hay aviso y modo de respaldo (E10-D40) |
| .03 El riesgo fija la fricción | cumple | La carga y el encendido llevan cada uno su OK nominal (§10.5.9 y §10.5.10) |
| .04 Auditable | pendiente para la tarjeta | AUD-01 arriba |
| .05 Permisos, tenant y privacidad | cumple por diseño | §10.5.7 y §10.5.13, con pruebas negativas (§10.5.15) |
| .06 Prevenir errores | cumple | Idempotencia por `source_id` y `external_msg_id`, un envío por hilo y orden por hilo (E10-D34, E10-D37) |
| .07 Estado visible y verdadero | cumple por diseño | El «vencido» sigue la promesa del portal (T1), «sin atender» es la D-SA, y el aviso dice si algo no llegó (E10-D40) |
| .08 La frecuencia reduce pasos | cumple | Responder queda a un clic desde la tarjeta, sin salir del Studio |
| .09 Mismo patrón | cumple | Bandeja, Ficha DTD y webhook de siempre |
| .10 Accesible | por verificar al implementar | A11Y-01 |
| .11 Lenguaje | cumple por diseño | «Conversaciones», sin «tickets» ni «reclamos» (E10-D32) |
| .12 IA | no aplica | Sin IA |

### 10.5.15 Pruebas y criterios de aceptación

**Prueba de concepto primero**, en prueba, con la cuenta 2 de Chatwoot y sin datos reales. Cada punto da PASÓ o FALLÓ, y lo que falle cambia el diseño antes de programar:

- **PoC-1:** un mensaje creado por la API de cuenta en una bandeja API guarda el `source_id` que se le manda y lo devuelve al listar.
- **PoC-2:** se puede buscar un contacto por su `identifier`.
- **PoC-3:** listar los mensajes de una conversación da su tipo, si es privado, su `source_id` y sus adjuntos (para el reproceso y la conciliación).
- **PoC-4:** un mensaje entrante por la API en una conversación resuelta la reabre.
- **PoC-5:** la API de cuenta acepta `message_type: incoming` en una bandeja API, con el contacto como remitente, y el webhook lo entrega como `incoming`.
- **PoC-6:** una nota privada creada por la API no le llega a nadie fuera de Chatwoot.

**Contrato SQL** (PGlite, con mutantes y control rojo):

1. el preflight falla sin cada dependencia;
2. RLS en las tablas nuevas, sin permisos para `anon` ni `authenticated`;
3. `chatwoot_portal_tomar`: solo el portal, solo después del corte, sin lo que vino de Chatwoot, uno por hilo, el más viejo primero, y nada de un hilo con un envío en curso;
4. `chatwoot_portal_respuesta`: idempotente, con `unread_count` a 0, la hora que llega y el autor del vínculo;
5. `chatwoot_portal_vincular`: un `chatwoot_registrar_evento` posterior sin teléfono conserva el `client_id`;
6. `crm_entrada_portal`: crea por ficha con `fuente = 'portal'`, liga por teléfono, vuelve de «Perdido» solo si es lead y una sola vez por clave, y no crea con `conversation_updated`;
7. el contrato de la 0513 pasa igual con `crm_alta_tarjeta_web` redefinida;
8. `crm_portal_espera`: el primer mensaje sin respuesta después de la última del equipo, y nada si lo último es del equipo; sin `crm_puede_usar()`, rechazo;
9. `chatwoot_portal_vincular_carga`: marca `cargado`, fija el corte y no escribe en el CRM ni en los eventos; vincula también un hilo archivado sin cambiar su `deleted_at`;
10. el flag nace apagado;
11. el contrato de `portal_post_message` (0512) pasa igual.

**TypeScript:**

- el envío: orden, un envío por hilo, un error incierto busca el `source_id` antes de reenviar, los reintentos, «atascado» y el aviso con solo números; con el flag apagado o sin configuración, nada;
- la carga que sale a Chatwoot lleva solo el nombre y el identificador: sin teléfono, correo, cédula, RIF, Shipping Mark ni `client_id`;
- `entrarPortal`: etiquetas, equipo y asesor; solo la bandeja del portal; logs con solo códigos;
- `responderAlPortal`: deja pasar solo lo saliente, no privado y no propio; la nota del adjunto, una sola vez; el push, una sola vez; el reproceso relee el mensaje; a un hilo archivado no le escribe ni le avisa, y deja su nota una sola vez;
- el estado, traducido;
- «vencida»: viernes 23:59, sábado y domingo al lunes, un feriado de Venezuela entre semana y uno que cae en lunes (P7 = (a)), un feriado borrado o de China que no cuenta, el aviso de un año sin feriados cargados, y el borde de 23:59:59 en `America/Caracas`;
- Conversaciones de Studio en solo lectura con el flag encendido, y `sendReplyAction` que rechaza en el servidor;
- la ruta del webhook nunca registra el texto;
- T1 en la página de Soporte, y T2 y T3 en `/privacidad`.

**Punta a punta en prueba** (cuenta 2): ida, vuelta, estado, tarjeta, Ficha DTD, Chatwoot sin responder (con una URL que no contesta) y la conciliación.

**Criterios de aceptación:**

- [ ] PoC-1 a PoC-6 medidos, y el diseño ajustado a lo que falló.
- [ ] Un mensaje del portal llega a Chatwoot en orden y una sola vez, aunque se reintente.
- [ ] La respuesta del agente llega al portal una sola vez, con su autor y su hora, y el cliente recibe el push de hoy.
- [ ] Una respuesta en Chatwoot a un hilo archivado en Studio no llega al portal ni manda push, y deja su nota privada.
- [ ] El portal nunca falla por Chatwoot, y si Chatwoot no responde hay aviso y modo de respaldo.
- [ ] La tarjeta entra por la ficha, en el embudo de su segmento; desde «Perdido» vuelve solo si es lead.
- [ ] «Vencida» sigue la regla de P5 y P7 = (a): no cuentan el sábado, el domingo ni los feriados de Venezuela que el administrador carga en Studio.
- [x] T1 a T4 aprobados por Sam palabra por palabra (decisión 5) antes de publicarlos. Cumplido el 2026-11-07 a las 04:48Z: «Apruebo los cuatro».
- [ ] Nada sale a Chatwoot fuera del nombre y el texto.
- [ ] El flag nace apagado y no se enciende hasta que T1 a T4 estén publicados en producción (E10-D42). Se comprueba en la web publicada: Soporte del portal muestra T1, y `/privacidad` muestra T2, T3 y la fecha de T4.
- [ ] La carga pasa C-1 a C-14 en el ensayo, antes de producción.
- [ ] `pnpm verify`, `/ui-check` y revisar-datos-ve sobre el código.
- [ ] Aceptación de Sam de las filas de la 10.5.

### 10.5.16 Allowlist exacta (para las PR de implementación)

Son dos PR, en este orden: la del rediseño y los textos (10.5) y la de la carga (fila propia, P4). Si al arrancar alguno de estos archivos cambió, se mide de nuevo antes de tocarlo.

**PR 1 · rediseño y textos.**

Nuevos:

- `supabase/migrations/05NN_chatwoot_portal.sql` y su prueba de contrato en `supabase/tests/`, con el mismo número
- `lib/studio/__tests__/chatwoot-portal.migration.test.ts`
- `lib/studio/chatwoot/portal.ts` (configuración, envío, contacto, conversación y conciliación) y `lib/studio/chatwoot/__tests__/portal.test.ts`
- `lib/studio/chatwoot/portal-manejadores.ts` (`entrarPortal` y `responderAlPortal`) y `lib/studio/chatwoot/__tests__/portal-manejadores.test.ts`
- `lib/studio/crm-portal.ts` (puro: estado, «vencida» con días que no cuentan, texto de la insignia) y `lib/studio/__tests__/crm-portal.test.ts`
- `app/studio/(app)/crm/_components/TarjetaFichaDrawer.test.tsx`

Editados:

- `supabase/migrations-baseline.json` y `supabase/pending-migration-symbol-declarations.json`
- `lib/studio/feature-flags-types.ts` (`chatwoot_portal`)
- `lib/studio/chatwoot/config.ts` (`chatwootPortalConfig`)
- `lib/studio/chatwoot/router-api.ts` (contacto, conversación, mensajes de una conversación, asignar agente) y su prueba
- `lib/studio/chatwoot/webhook-procesar.ts` (los dos manejadores en `MANEJADORES` y sus nombres) y su prueba
- `app/api/chatwoot/webhook/route.ts` (le pasa al contexto lo saliente del portal) y su prueba
- `app/api/cron/chatwoot-reintentos/route.ts` (cola, conciliación y aviso) y su prueba
- `app/portal/(app)/mensajes/actions.ts` (pide el envío sin bloquear) y `app/portal/reintento-no-duplica.test.ts`
- `app/studio/(app)/conversaciones/actions.ts` y `app/studio/(app)/conversaciones/_components/ConversationThread.tsx` (solo lectura con el flag encendido), con `app/studio/(app)/conversaciones/__tests__/send-reply-gate.test.ts`
- `lib/studio/crm-tablero.ts`, `lib/studio/crm-tablero-queries.ts` y sus pruebas
- `lib/studio/crm-ficha.ts`, `app/studio/(app)/crm/tarjeta-actions.ts` y `app/studio/(app)/crm/__tests__/tarjeta-actions-gate.test.ts`
- `app/studio/(app)/crm/_components/CrmTableroKanban.tsx`, su prueba y `app/studio/(app)/crm/_components/TarjetaFichaDrawer.tsx`
- T1: `app/portal/(app)/soporte/page.tsx` (una línea) y su prueba
- T2 a T4: `app/privacidad/page.tsx` y `app/__tests__/privacidad-chat.test.ts`
- `infra/chatwoot/.env.example` y la prueba de variables de infraestructura
- `docs/runbooks/chatwoot-bandeja.md` (la bandeja del portal), `docs/legal/privacidad/mapa-de-borrado.md` (punto 4)
- `docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md`, `docs/specs/0582-chatwoot-piloto/checklist.md`, `docs/specs/README.md` (índice generado) y `.agents/handoffs/0586-e10-5-tickets-portal.md`

**PR 2 · la carga (P4).** Nuevos, junto al cargador de E5 en `infra/ops/kommo-historial/` o en una carpeta hermana `infra/ops/portal-historial/`, lo que el Director General prefiera: la extracción, la preparación, el cargador adaptado, el ensayo y sus pruebas en CI con datos sintéticos.

**No se tocan:** `lib/portal/**`, `components/**`, `lib/studio/conversation-inbound-notify.ts` (salvo que el Director General decida el punto 8 de §10.5.13), `supabase/migrations.lock.json` ni ninguna migración ya aplicada. La revisión lo comprueba con `git diff --stat`.

**Cruce con la 6.6:** comparten archivos y van en serie, primero la 10.5 (§10.5.19).

**PR de textos (T1 a T4, 2026-11-08).** Publica sola los cuatro textos de §10.5.12, copiados palabra por palabra. Es la condición para encender `chatwoot_portal` (E10-D42), y no lleva nada del rediseño. Editados:

- `app/portal/(app)/soporte/page.tsx` (T1, una línea) y su prueba nueva, `app/__tests__/soporte-plazo-respuesta.test.ts`;
- `app/privacidad/page.tsx` (T2, T3 y T4) y `app/__tests__/privacidad-chat.test.ts`;
- `app/__tests__/faq-seguimiento-coherente.test.tsx` y `app/__tests__/privacidad-mensajeria-interna.test.tsx` (solo la fecha, que las dos leen en la página renderizada);
- esta spec (esta lista) y `.agents/handoffs/0586-textos-t1-t4.md`.

La fecha de T4 es el día en que se publique: el Director General la confirma antes de fusionar.

**Partición de la PR 1 (Worker de la ida, 2026-11-07).** La PR 1 se parte en dos, en serie, para que la primera lleve solo la ida, de Studio a Chatwoot (E10-D34, E10-D35 y el aviso de E10-D40). Medido sobre `main` en `7e75f7708`.

- **PR 1a · la ida (esta).** Migración `0519_chatwoot_portal.sql` (número asignado por el Director General el 2026-11-07, comunicado por el Subdirector de Chatwoot; reserva local `refs/dtd/reservations/migraciones/0519`) con las cuatro tablas de §10.5.6, `chatwoot_portal_tomar`, `chatwoot_portal_marcar`, `chatwoot_portal_vincular`, `chatwoot_portal_rezagados` (el aviso, solo números) y `feature_flag_catalog()` con `chatwoot_portal` apagado. El envío en el servidor de Studio, el cron y el pedido sin bloquear del portal. Con el flag apagado, o sin `CHATWOOT_INBOX_PORTAL_ID`, el token o la cuenta, no hace nada. **No toca ninguno de los archivos que comparte con la 6.6** (`TarjetaFichaDrawer.tsx`, `CrmTableroKanban.tsx`, `tarjeta-actions.ts` y `crm-ficha.ts`); solo cruza en `supabase/migrations-baseline.json` y `supabase/pending-migration-symbol-declarations.json`.
- **PR 1b · la vuelta, destrabar y el riesgo del webhook** (alcance aprobado por el Director General el 2026-11-08, comunicado por el Subdirector). Lleva la migración **0520** (`0520_chatwoot_portal_vuelta`), reservada en `codex/migracion-reserve-0520-chatwoot-portal-vuelta` y en `refs/dtd/reservations/migraciones/0520`. Sus cuatro partes:
  - **La vuelta (E10-D37):** el manejador `responderAlPortal`, el texto saliente solo para la bandeja del portal, `chatwoot_portal_respuesta` (idempotente por `chatwoot:<id>` y sin escribir en un hilo archivado), el reproceso que relee el mensaje en Chatwoot, el push al cliente una sola vez, y la nota privada una vez por mensaje (adjunto o hilo archivado), con su propio `source_id`.
  - **Destrabar (§10.5.20):** una RPC, una acción solo para admin y una tarjeta mínima «Portal → Chatwoot» en la Bandeja, con los números y «Reintentar los atascados». Pasa por `/ui-check`. Es texto interno del Studio, no público: no pide aprobación de Sam palabra por palabra.
  - **El riesgo del webhook:** Chatwoot 4.19.1 no entrega a un host sin IP pública, como midió la PoC de la 1a. La salud de agentes revisa el webhook de cuenta y avisa a los admins si falta, si no tiene `message_created` o si su host no tiene IP pública.
  - **PoC en Actions de lo saliente.**

  **La 1b no se fusiona sin la 0520 aplicada en producción, o sin una decisión de Sam sobre `publicar-web.sh aceptar-pendiente`** (regla del Director General del 2026-11-08). **Se cumplió:** la 0520 se aplicó el 2026-11-08 a las 02:26:32Z en producción, y la #434 se fusionó a las 04:11Z (ver «2026-11-08 · La 0520 aplicada»). Fusionar una migración en espera frena la publicación automática (§10 de `aplicar-migraciones-prod.md`), como pasó con la #424.
- **PR 1c · el estado, el CRM y Studio en solo lectura.** Su migración propia, con número aparte, lleva `chatwoot_portal_estado_hilo`, `crm_entrada_portal`, `crm_tarjeta_ubicar_o_crear` y `crm_alta_tarjeta_web` redefinida, y `crm_portal_espera`. Si el modo de respaldo manda también lo que el equipo escribió en Studio (E10-D40, punto 4), redefine `chatwoot_portal_tomar`. Lleva:
  - `entrarPortal`;
  - la conciliación;
  - la reapertura por el envío, si la PoC-4 falla;
  - `crm-portal.ts`, la insignia y la sección de la ficha;
  - Studio en solo lectura;
  - los textos T1 a T4.

  Es la que cruza con la 6.6. El resto de la allowlist de la PR 1, de arriba, es de la 1c.
- **PR 2 · la carga (P4)**, como arriba. `chatwoot_portal_vincular_carga` va con ella o en la migración de la 1b, lo que se integre primero. Hasta entonces, el `corte` de `chatwoot_portal_estado` solo lo escribe `service_role` a mano, y en prueba con una carga vacía.

Lo que cambia respecto de §10.5.6, por la partición:

- La ida solo toma mensajes del cliente (`direction = 'in'`). Lo saliente del modo de respaldo es de la 1b.
- `chatwoot_portal_tomar` recibe también el tenant: la cuenta de Chatwoot es de un solo tenant (`CHATWOOT_TENANT_ID`), y sin él la cola podría mandar mensajes de otro tenant a la cuenta de DTD. Recibe además, opcional, el hilo, para que el portal pida solo el envío de su hilo.
- `chatwoot_portal_salida` lleva una columna más, `verificar`: queda en verdadero después de un intento incierto, y desde ahí cada intento busca primero el `source_id` en Chatwoot. Un envío colgado en `enviando` más de 5 minutos cuenta como incierto.
- El bloqueo por hilo es `for no key update skip locked` sobre la fila de `conversations`, no sobre el vínculo, que todavía no existe con el primer mensaje del hilo. `no key update` no choca con el `for key share` de la clave foránea, así que no frena a `portal_post_message` cuando inserta un mensaje en ese hilo.
- Un mensaje «atascado» detiene su hilo: los siguientes esperan, para no romper el orden. Cómo se destraba uno atascado (a mano con `service_role`, o con una función para el admin) queda **pendiente** para el Director General.
- **La búsqueda del `source_id` pagina** (hallazgo de la revisión independiente de la #424). Después de un intento incierto, ya no se mira solo la primera página de mensajes. Se va hacia atrás con `?before=<id>`, hasta encontrarlo, hasta una página vacía o hasta pasar la hora del mensaje de Studio, con un margen de 5 minutos. Para eso `chatwoot_portal_tomar` devuelve también `enviado_at`. Si en 50 páginas no lo encuentra ni pasa esa hora, es `busqueda_incompleta`: no se reenvía y queda incierto. La PoC lo mide con más mensajes de los que caben en una página.
- **Riesgos conocidos.**
  - **El tope de 25 s por corrida** (`PRESUPUESTO_MS` en `portal.ts`): el cron deja de tomar tandas nuevas pasados 25 s, pero termina la tanda en curso, de hasta 10 mensajes. Cada mensaje hace hasta cuatro llamadas de 10 s, y después de un incierto puede leer hasta 50 páginas de la búsqueda. Una tanda lenta puede pasar del minuto. Lo que quede reclamado sin cerrar se retoma a los 5 minutos como incierto, buscando antes su `source_id`, así que no duplica: solo se demora.
  - **Un admin puede encender `chatwoot_portal` desde el panel de flags.** Encenderlo solo no manda nada. Hace falta, además, que el servidor tenga `CHATWOOT_INBOX_PORTAL_ID`, el token, la cuenta y el tenant (`chatwootPortalConfig()`), y que `chatwoot_portal_estado` tenga un `corte`, que hoy solo escribe `service_role` y después la carga P4. Cargar las variables y fijar el corte son puertas con OK nominal de Sam (§10.5.9). El flag no reemplaza esas puertas; las suma.
- No se mandan los mensajes de una ficha borrada (`clients.deleted_at`). Sí los de un hilo archivado en Studio: el mensaje existe y el equipo tiene que verlo. La guarda de la vuelta para esos hilos es de la 1b (E10-D37).

**PR 1a · allowlist exacta.**

Nuevos:

- `supabase/migrations/0519_chatwoot_portal.sql` y `supabase/tests/0519_chatwoot_portal.test.sql`
- `lib/studio/__tests__/chatwoot-portal.migration.test.ts`
- `lib/studio/chatwoot/portal.ts` (configuración leída aparte, envío, contacto, conversación y aviso) y `lib/studio/chatwoot/__tests__/portal.test.ts`
- `.agents/handoffs/0586-e10-5-ida.md`
- Por decisión del Director General (2026-11-07, comunicada por el Subdirector), el portón de la PoC y de las dos sesiones va en esta misma PR:
  - `.github/workflows/chatwoot-portal-poc.yml`, con dos jobs: `poc` y `carrera`
  - `infra/chatwoot/pruebas/portal/prueba-portal-poc.sh`, `compose.portal-poc.yml`, `sonda-portal-poc.rb`, `carga-webhook-poc.rb`, `receptor-webhook.mjs` y `mutantes-ida.cjs` (el ejecutor de los mutantes del código, que pidió la revisión)
  - `lib/studio/chatwoot/__tests__/portal.poc.test.ts`, que se salta sin la instancia efímera
  - `scripts/__tests__/env-example-contract.test.ts`, que suma `CHATWOOT_POC_` a los interruptores del arnés que no se documentan en `.env.example`, como `SCHEMA_REBUILD_`
  - `supabase/tests/0519_chatwoot_portal_carrera.test.sql`

Editados:

- `supabase/migrations-baseline.json` y `supabase/pending-migration-symbol-declarations.json`
- `lib/studio/feature-flags-types.ts` (`chatwoot_portal` y el efecto nuevo `servidor`), `lib/studio/__tests__/feature-flags-catalog.test.ts` (que un flag `servidor` lo lea de verdad el servidor) y `app/studio/(app)/admin/feature-flags/_components/FeatureFlagsClient.tsx` (el texto del efecto `servidor`; sin él, el panel caería en «oculta del menú»)
- `lib/studio/chatwoot/config.ts` (`chatwootPortalConfig`); no tiene prueba propia, así que sus casos van en `portal.test.ts`
- `lib/studio/chatwoot/router-api.ts` (contacto, conversación y mensajes de una conversación; asignar agente es de la 1b) y `lib/studio/chatwoot/__tests__/router-api.test.ts`
- `app/api/cron/chatwoot-reintentos/route.ts` (la cola y el aviso; la conciliación es de la 1b) y `app/api/cron/chatwoot-reintentos/__tests__/route.test.ts`
- `app/portal/(app)/mensajes/actions.ts` (pide el envío sin bloquear, con `after()`) y `app/portal/reintento-no-duplica.test.ts`
- `.env.example` y `infra/dtd-cargo/.env.example` (`CHATWOOT_INBOX_PORTAL_ID`). Los vigilan `env-example-contract.test.ts` y `scripts/__tests__/infra-env-example.test.ts`, que no cambian. En §10.5.16 decía `infra/chatwoot/.env.example`, pero esa plantilla es la del contenedor de Chatwoot y la variable la lee Studio
- `docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md` y `docs/specs/README.md` (índice generado)

No se tocan en la 1a: `webhook-procesar.ts`, `app/api/chatwoot/webhook/route.ts`, `app/studio/(app)/conversaciones/**`, `app/studio/(app)/crm/**`, `lib/studio/crm-*.ts`, `app/portal/(app)/soporte/page.tsx`, `app/privacidad/page.tsx`, `docs/specs/0582-chatwoot-piloto/checklist.md`, `docs/runbooks/chatwoot-bandeja.md` y `docs/legal/privacidad/mapa-de-borrado.md`, más lo que §10.5.16 ya excluye.

**PR 1a · qué prueba de §10.5.15 cubre.** Del contrato SQL: los puntos 1 (preflight, con la reaplicación y un catálogo que no es el de la 0503), 2, 3, 5 y 10, más el aviso, los reintentos, el «atascado» y un intento viejo que no cierra el nuevo. Los puntos 4, 6 a 9 y 11 son de la 1b y de la PR 2. De TypeScript: el envío (orden, uno por hilo, el incierto que busca el `source_id` antes de reenviar, los reintentos, «atascado» y el aviso con solo números; con el flag apagado o sin configuración, nada) y que a Chatwoot solo salgan el nombre, el identificador y el texto. **PoC y dos sesiones (decisión del Director General, 2026-11-07).** Las PoC-1, PoC-2, PoC-3 y PoC-5 se miden en esta PR, y son el portón para fusionar. Corren en GitHub Actions (`chatwoot-portal-poc.yml`, job `poc`) contra un Chatwoot v4.19.1-ce real y efímero, el del compose de `infra/chatwoot`, con el cliente real de Studio, datos inventados y secretos generados en la corrida. Cada PoC tiene su control, y la ida corre de punta a punta, con un reintento incierto que no duplica. El job `carrera` mide `skip locked` con dos sesiones (dblink, Postgres 17), con sus controles en la misma corrida y un mutante de la 0519 sin `skip locked` que tiene que hacerla caer. La guarda del upsert se mide quitando `skip locked`: la guarda sola, con `skip locked` presente, no se alcanza de forma determinista (handoff, «Dos sesiones»). El resultado de cada corrida va en el handoff. Si `carrera` no sale verde, aplicar la 0519 en producción queda bloqueado, aunque la PR se fusione.

**Lo que la PoC midió contra Chatwoot 4.19.1** (run 42415834528, 2026-11-07):

- **PASÓ:** PoC-1, PoC-2, PoC-3 y PoC-5a, el caso de la paginación y la ida de punta a punta sin duplicar.
- **Un hecho nuevo:** Chatwoot rechaza entregar un webhook a un host sin IP pública («has no public ip addresses»), una protección contra SSRF. En producción no cambia nada, porque la URL del webhook de Studio (2.3) es pública. En el arnés, la PoC-5b mide la carga que Chatwoot arma para el webhook de cuenta (`webhook_data`) en lugar de la entrega.
- **Queda NV** la entrega por red hasta Studio, hasta la punta a punta en prueba (puerta 4 de §10.5.9).

**PR 1b · allowlist exacta** (medida sobre `main` en `caca3438b`, la #424 fusionada).

Nuevos:

- `supabase/migrations/0520_chatwoot_portal_vuelta.sql` y `supabase/tests/0520_chatwoot_portal_vuelta.test.sql`
- `lib/studio/__tests__/chatwoot-portal-vuelta.migration.test.ts` (el contrato en PGlite, con su control rojo y sus mutantes)
- `lib/studio/chatwoot/portal-manejadores.ts` (`responderAlPortal`; `entrarPortal` queda para la 1c) y `lib/studio/chatwoot/__tests__/portal-manejadores.test.ts`
- `lib/studio/chatwoot/webhook-salud.ts` (la salud del webhook de cuenta) y `lib/studio/chatwoot/__tests__/webhook-salud.test.ts`
- `app/studio/(app)/bandeja/_components/PortalChatwoot.tsx` (la tarjeta «Portal → Chatwoot»), con `app/studio/(app)/bandeja/__tests__/PortalChatwoot.test.tsx` y `app/studio/(app)/bandeja/__tests__/destrabar-portal.test.ts`
- `lib/studio/chatwoot/__tests__/portal-vuelta.poc.test.ts` e `infra/chatwoot/pruebas/portal/carga-saliente-poc.rb` (la PoC de lo saliente)
- `infra/chatwoot/pruebas/portal/mutantes-vuelta.cjs` (los 40 mutantes del código de la 1b, con el mismo ejecutor que `mutantes-ida.cjs`)
- `.agents/handoffs/0586-e10-5-1b-vuelta.md`

Editados:

- `supabase/migrations-baseline.json` y `supabase/pending-migration-symbol-declarations.json` (la 0520 en espera hasta su cierre). Al traer `main` con el cierre de la 0519 (#435), la declaración de la 0519 se borró, porque ya estaba aplicada y sellada, y con ella los sitios que la 1b le había sumado en `chatwoot_portal_rezagados` y `chatwoot_portal_hilos`. Quedó solo la de la 0520, que su cierre también retira
- `lib/studio/chatwoot/router-api.ts` (`leerMensaje`, `crearNotaPrivada` y `listarWebhooksCuenta`) y su prueba. «Asignar agente» pasa a la 1c, con `entrarPortal`
- `lib/studio/chatwoot/portal.ts` (`resumenPortal`, los números de la tarjeta)
- `lib/studio/chatwoot/webhook-procesar.ts` (`responderAlPortal` en `MANEJADORES`, su nombre y `ctx.salientePortal`) y `lib/studio/chatwoot/__tests__/aviso-unico-por-evento.test.ts` (la lista de nombres)
- `app/api/chatwoot/webhook/route.ts` (le pasa al contexto lo saliente de la bandeja del portal) y su prueba
- `lib/studio/chatwoot/agentes-salud.ts` y `lib/studio/chatwoot/agentes-ciclo.ts` (las cuatro alertas del webhook y su texto del push), `app/api/cron/chatwoot-agentes/route.ts` y su prueba
- `app/studio/(app)/bandeja/page.tsx`, `_components/BandejaClient.tsx` y `actions.ts` (`destrabarPortal`), con `lib/studio/rbac-actions-guard.test.ts` (el inventario de acciones, 462 → 463)
- `lib/i18n/es-VE/bandeja.ts` y `lib/i18n/zh-CN/bandeja.ts` (la tarjeta y las alertas)
- `docs/runbooks/chatwoot-bandeja.md` (la tarjeta «Portal → Chatwoot», las alertas del webhook y su límite conocido)
- `.github/workflows/chatwoot-portal-poc.yml`, `infra/chatwoot/pruebas/portal/prueba-portal-poc.sh` y `sonda-portal-poc.rb` (la PoC de lo saliente en el mismo job; el webhook del arnés pasa a terminar en `/api/chatwoot/webhook`)
- `docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md` y `docs/specs/README.md` (índice generado)

No se tocan en la 1b: `app/studio/(app)/conversaciones/**`, `app/studio/(app)/crm/**`, `lib/studio/crm-*.ts`, `app/portal/**`, `app/privacidad/page.tsx`, `lib/studio/conversation-reply-push.ts` (se reusa tal cual), `lib/studio/chatwoot/webhook-events.ts` (`interpretarEvento` sigue sin texto), `docs/specs/0582-chatwoot-piloto/checklist.md`, más lo que §10.5.16 ya excluye.

**PR 1b · decisiones del Worker** (I, para la revisión):

- **La vuelta lee el texto de la carga del webhook solo en la bandeja del portal.** La ruta pasa `salientePortal` solo si la conversación es de esa bandeja y el mensaje es saliente; si no, `null`, y el manejador no relee nada. En el reproceso, que no guardó el texto, el manejador mira primero en `chatwoot_portal_hilos` si la conversación es del portal y solo entonces la relee en Chatwoot (`?before=<id + 1>`).
- **Quién firma.** Solo un remitente que la carga marca como usuario (`sender.type = "user"`, o `sender_type = "User"` en la API de cuenta). Un bot o un contacto nunca firman, aunque su id coincida con el de un agente vinculado: los bots tienen otra secuencia de ids. La PoC mide que la carga real de un agente trae ese `type` (V-1).
- **Lo que no va al portal:** lo privado, la actividad, las plantillas, el contenido que no es texto (`input_csat`, tarjetas, formularios) y el eco nuestro (`source_id` que empieza con `dtd:`, también el de las notas).
- **Un saliente sin agente sí va al portal** (hallazgo POSIBLE de la revisión independiente de la #434, que queda como decisión). `esRespuestaDelEquipo` no exige un remitente usuario: si un bot o una automatización de Chatwoot escribe un saliente público de texto en la bandeja del portal, le llega al cliente firmado «DTD Cargo», sin autor (`author_name` vacío). Hoy la bandeja no tiene ni bot ni automatizaciones: va sin saludo, sin asignación automática y sin encuesta (§10.5.9, puerta 3). Si algún día se le pone una, esta decisión se revisa antes.
- **Una ficha borrada** (`clients.deleted_at`) no recibe la respuesta ni el push, y no se deja nota: es un caso que la spec no nombra y que hoy no se da con el flag apagado. Si el Director General quiere una nota también ahí, es una línea más en `responderAlPortal`.
- **La hora** es la de Chatwoot, nunca en el futuro (un reloj adelantado queda en «ahora»), y una respuesta tardía no retrocede el `last_message_at` del hilo. El `unread_count` queda en 0, como pide el punto 4 de §10.5.15, también cuando la respuesta llega tarde.
- **El push primero, la nota después.** Si la nota falla, el evento queda «fallido» y se reintenta; la respuesta ya está escrita, así que el reintento da «duplicado» y no avisa otra vez. Cada nota se busca por su `source_id` (`dtd:nota:archivado:<id>` o `dtd:nota:adjunto:<id>`) antes de crearla. Si la búsqueda no puede decidir (`busqueda_incompleta`), no se crea y se reintenta.
- **Destrabar es para `authenticated`, con el admin comprobado dentro de la RPC** (`is_tenant_admin`, 0386), y el tenant sale de la sesión. Así la acción del Studio no necesita `service_role` y la regla vive en la base. Repite el procedimiento manual de la 0519: a «pendiente» ahora, con `verificar` encendido y un plazo nuevo de 24 h. Conserva los intentos y el último código de error.
- **La salud del webhook** lee la lista con el token del usuario de servicio de E1, que es administrador de la cuenta, pedido por la Platform API como `obtenerTokenAgente`. Reconoce el webhook de Studio por su ruta (`/api/chatwoot/webhook`), no por su host. Resuelve el host con DNS y lo compara con las redes que rechaza la gema `ssrf_filter` de Chatwoot. Si no puede leer la lista, avisa con `webhook_no_medido`, salvo que Chatwoot ya no responda, que es la misma causa. Corre en el cron diario `chatwoot-agentes`, que ya avisa a los admins por push, y al abrir la Bandeja.
  - **Límite conocido** (hallazgo POSIBLE de la revisión independiente de la #434). Como mira la ruta y no el host, un webhook a `/api/chatwoot/webhook` de otro sitio (otro Studio, un entorno de prueba) cuenta como el de Studio. El DNS se resuelve desde el servidor del Studio, no desde la red de Chatwoot: si los dos resuelven distinto (un DNS interno o un host que solo existe en una de las dos redes), la salud puede no coincidir con lo que Chatwoot hace. La entrega real se comprueba en la punta a punta (puerta 4 de §10.5.9). Va también en `docs/runbooks/chatwoot-bandeja.md`.
- **PoC-6** se mide en lo que Studio controla: la nota privada guarda su `source_id`, se encuentra al buscarla, su carga dice `private: true` y la vuelta no la lleva al portal, y la bandeja API no tiene `webhook_url`. Que Chatwoot no la mande por ningún otro canal queda NV: la bandeja del portal no tiene otro.

**PR 1b · qué prueba de §10.5.15 cubre.** Del contrato SQL, el punto 4 (`chatwoot_portal_respuesta`: idempotente, con `unread_count` a 0, la hora que llega y el autor del vínculo), más el hilo archivado, la ficha borrada, otro canal, otro tenant, el flag apagado, la respuesta sin texto, que la ida no tome las respuestas y destrabar (solo el admin del tenant, solo los atascados, verificando y con plazo nuevo). Los puntos 6 a 9 y 11 son de la 1c y de la PR 2. De TypeScript, la línea de `responderAlPortal` entera: deja pasar solo lo saliente, no privado y no propio; la nota del adjunto, una sola vez; el push, una sola vez; el reproceso relee el mensaje; a un hilo archivado no le escribe ni le avisa y deja su nota una sola vez. También que la ruta del webhook nunca registre el texto, y la salud del webhook. **PoC en Actions** (`chatwoot-portal-poc.yml`, job `poc`, el mismo de la 1a): V-1 a V-4 y PoC-6 contra el Chatwoot 4.19.1 efímero. El contrato de la 0520 en Postgres 17 real lo corre `sql-tests.yml`.

**PR 1c · partición** (propuesta del Worker de la 10.5, 2026-11-08). **Decisión del DG del 2026-11-08, ~10:22Z** (comunicada por el Subdirector): sí a todo. Son cuatro piezas, cada una en su rama y su PR desde `main`, sin juntarlas, y la 1c-1 va primero. `assignAction` y `markCaseAction` no se traban. El riesgo residual de PostgREST queda aceptado para la 1c-1, y el trigger va en la migración de la 1c-2. Pedido del DG, comunicado por el Subdirector: en producción no se enciende `chatwoot_portal` hasta tener «Studio en solo lectura para los hilos del portal», y no se le pide a Sam que acepte ese riesgo. Por eso la 1c se parte en cuatro, en este orden, cada una en su rama y su PR desde `main`:

| Pieza | Qué lleva | Migración | Cruza con la 6.6 | Por qué en este lugar |
|---|---|---|---|---|
| **1c-1 · Studio en solo lectura** | E10-D41: la traba en el servidor y en la pantalla (diseño abajo) | No | No | Es lo único que falta para encender en producción, y no necesita apply |
| **1c-1b · El hilo borrado y el enlace con permiso** | Decisión del DG del 2026-11-08, después de la revisión de la #440. `setStatusAction` da «Conversación no encontrada.» con un hilo borrado, y su `update` lleva `deleted_at is null`; antes cambiaba la fila, y en un hilo del portal borrado la traba no corría. «Responder en la Bandeja →» aparece solo con acceso a la Bandeja: el rol (`moduleViewDenial`) y el flag `chatwoot_inbox`. Diseño abajo | No | No | Condición para encender en producción, como la 1c-1. En prueba no se espera |
| **1c-2 · El estado y la conciliación** | E10-D39: `conversation_status_changed` de la bandeja del portal → `chatwoot_portal_estado_hilo`, con la guarda del hilo archivado y el orden por `updated_at`. E10-D40, punto 5: el cron compara, en los hilos vinculados y vivos con actividad en las últimas 24 h, los salientes de Chatwoot con `conversation_messages`, y escribe los que falten con `chatwoot_portal_respuesta` (0520, ya aplicada) | Sí, para el estado. La conciliación reusa la 0520 | No | Es el agujero de confiabilidad más grande: si Studio está caído cuando el agente responde, la respuesta hoy se pierde |
| **1c-3 · El CRM** | E10-D36, D22, D23 y D30: `entrarPortal`, `crm_entrada_portal`, `crm_tarjeta_ubicar_o_crear`, `crm_alta_tarjeta_web` redefinida, `crm_portal_espera`, `crm-portal.ts`, la insignia, la sección de la ficha y «vencida» | Sí | **Sí**: `TarjetaFichaDrawer.tsx`, `CrmTableroKanban.tsx`, `tarjeta-actions.ts` y `crm-ficha.ts`. Esta vez entran, porque la 10.5 va antes que la 6.6 | La más grande. Va sola para no frenar a las otras con su apply |
| **1c-4 · Modo de respaldo** | E10-D40, punto 4: al encender otra vez, lo que el equipo escribió desde Studio con el flag apagado sale a Chatwoot como saliente, con el token del agente vinculado. Redefine `chatwoot_portal_tomar` | Sí | No | Solo importa después de apagar el flag. Con la 1c-1, apagar devuelve Studio a responder como hoy |

- **Cada migración pide su número al Subdirector, y cada PR con migración no se fusiona sin ella aplicada en producción** (la regla de la 1b). Por eso no se juntan: un solo apply grande frenaría todo junto.
- **Si el DG quiere también la traba en la base** (ver «Riesgo residual» de la 1c-1), va en la migración de la 1c-2, para no sumar un apply.
- La carga P4 (PR 2) sigue aparte.

**1c-1 · diseño** (para revisar antes de escribir código):

- **Cuándo un hilo queda en solo lectura:** `conversations.channel = 'portal'`, `chatwoot_portal` encendido para el tenant y `chatwootPortalConfig()` no nula, con ese mismo tenant. Es la misma condición con la que corren la ida y la vuelta. **Si falta la configuración, no se traba:** la ida no manda nada, y Studio es la única vía para responderle al cliente.
- **La lectura del flag, en una pieza propia:** `lib/studio/chatwoot/portal-solo-lectura.ts` lee la fila de `feature_flags` (`key = 'chatwoot_portal'`) con la sesión, que la RLS deja ver por tenant.
  - **Si la lectura falla, traba** el hilo del portal (fail-closed): mejor «no se pudo comprobar, vuelve a intentar» que una respuesta que Chatwoot no ve.
  - Los demás canales no se tocan.
  - `listFeatureFlags` no sirve aquí, porque ante un error cae al valor por defecto, apagado, y dejaría pasar.
- **La traba en el servidor:**
  - `sendReplyAction` ya lee el `channel` del hilo. Después de `moduleEditDenial`, si la traba está activa, devuelve «Este hilo del portal se responde desde la Bandeja de Chatwoot.» y **no inserta ni manda el push**.
  - `setStatusAction` hoy no lee el hilo. Pasa a leer su `channel` con la sesión y rechaza igual. Si esa lectura falla, no escribe: no se sabe si el hilo es del portal (fail-closed). `sendReplyAction` ya cortaba sin hilo.
  - **`assignAction` y `markCaseAction` no se traban** (decisión del DG del 2026-11-08, ~10:22Z): son metadatos internos que el cliente no ve, y que Chatwoot no pisa hasta la 1c-2 y la 1c-3.
- **La pantalla:**
  - La page calcula una vez si la traba está activa en el tenant.
  - El detalle del hilo (`/api/studio/conversaciones/[id]`) suma el número de la conversación en Chatwoot. Lo lee de `chatwoot_portal_hilos`, que es solo de `service_role`, en el servidor y después de comprobar con la sesión que el hilo es del tenant.
  - En un hilo del portal con la traba activa:
    - la caja de respuesta y las respuestas rápidas se cambian por un aviso interno: «Este hilo del portal se responde desde la Bandeja de Chatwoot. El estado también se cambia allá.», con «Responder en la Bandeja →» (`/studio/bandeja?c=<n>`), o sin enlace si todavía no hay conversación;
    - si no se pudo comprobar la traba (fail-closed), el aviso dice «No se pudo comprobar si este hilo del portal se responde desde la Bandeja de Chatwoot. Recarga la página para volver a intentar.»;
    - el selector de estado queda deshabilitado, con su explicación en `aria-describedby` y en `title`;
    - asignar y «caso» siguen como hoy.
  - Con la traba apagada, todo igual.
  - Es texto interno del Studio, sin aprobación de Sam. Pasa por `/ui-check`.
- **Pruebas que fallan antes** (se muestra el rojo sobre `main`):
  - `send-reply-gate.test.ts` suma estos casos:
    - portal con la traba activa: rechaza sin insertar ni avisar;
    - portal con el flag apagado o sin configuración: como hoy;
    - otro canal con la traba activa: como hoy;
    - error al leer el flag: rechaza solo el portal.
  - Una prueba nueva para `setStatusAction`, una para la pieza del flag y una de la pantalla: el aviso, el enlace, el selector deshabilitado y lo que sigue igual. La de la pantalla monta también la page, para probar que la traba llega de la page al hilo.
  - Mutantes del código, con el ejecutor de la vuelta:
    - quitar la traba de cada acción;
    - no mirar el canal;
    - fail-open;
    - ignorar la configuración;
    - mostrar la caja con la traba activa.
- **Allowlist 1c-1:**
  - `app/studio/(app)/conversaciones/actions.ts`, `page.tsx`, `_components/ConversacionesClient.tsx` (le pasa la traba al hilo) y `_components/ConversationThread.tsx`;
  - `app/studio/(app)/conversaciones/__tests__/send-reply-gate.test.ts`, con una prueba nueva para el estado (`set-status-gate.test.ts`) y otra para la pantalla (`thread-solo-lectura.test.tsx`);
  - `app/api/studio/conversaciones/[id]/route.ts` y su prueba (`[id]/__tests__/route.test.ts`);
  - `lib/studio/chatwoot/portal-solo-lectura.ts` y su prueba;
  - el ejecutor de mutantes (`infra/chatwoot/pruebas/portal/mutantes-solo-lectura.cjs`), la spec y su handoff (`.agents/handoffs/0586-e10-5-1c-solo-lectura.md`).
  - Sin migración y sin acciones exportadas nuevas: el inventario del RBAC no cambia.
- **Riesgo residual.** (I) Las policies de la 0106 (`"conversations by tenant"` y `"conversation_messages by tenant"`, FOR ALL por tenant, sin rol) dejan a `authenticated` escribir el hilo y sus mensajes directo por PostgREST, sin pasar por la acción. Es la postura de hoy para las cinco acciones de Conversaciones (lo anota la SDD-0497). Con la 1c-1, la pantalla y las acciones del Studio quedan trabadas, pero un cliente HTTP con la sesión de un usuario del equipo todavía podría insertar un saliente en un hilo del portal. Cerrarlo en la base es un trigger que rechace un `out` de `authenticated` en un hilo del portal con el flag encendido, y pide migración. **Decisión del DG del 2026-11-08, ~10:22Z:** el riesgo queda aceptado para la 1c-1, y el trigger va en la migración de la 1c-2.

**1c-1b · diseño** (decisión del DG del 2026-11-08, comunicada por el Subdirector):

- **El hilo borrado:** `setStatusAction` ya leía el hilo con `deleted_at is null`. Si no lo encuentra (borrado o de otro tenant), devuelve «Conversación no encontrada.» y no escribe, como `sendReplyAction`. El `update` suma `.is("deleted_at", null)`.
- **El enlace con permiso:** la page calcula `moduleViewDenial(supabase, "bandeja")` y `listFeatureFlags`, las dos capas de `bandeja/layout.tsx`, y le pasa `puedeVerBandeja` al hilo por `ConversacionesClient`. Sin acceso, el aviso va sin enlace. El campo `bandeja` del detalle no cambia: es un número entero sin PII (I).
- **`route-auth.test.ts`:** el fixture del detalle lleva `channel: "email"` explícito.
- **Pruebas:** cada cambio con su rojo previo sobre `main` y su mutante (`mutantes-solo-lectura.cjs`). Las pruebas se buscan por importador.
- **Allowlist 1c-1b:**
  - `app/studio/(app)/conversaciones/actions.ts`, `page.tsx`, `_components/ConversacionesClient.tsx` y `_components/ConversationThread.tsx`;
  - `__tests__/set-status-gate.test.ts` y `__tests__/thread-solo-lectura.test.tsx`;
  - `app/api/studio/__tests__/route-auth.test.ts`;
  - `infra/chatwoot/pruebas/portal/mutantes-solo-lectura.cjs`;
  - la spec y los handoffs (`0586-e10-5-1c-1b-borrado.md`, y la línea del de la 1c-1).
  - Sin migración y sin acciones exportadas nuevas.

### 10.5.17 Lo que queda fuera

- «Tus casos» (reclamos), en el CRM o en Chatwoot (P1).
- Adjuntos en el chat del portal, en los dos sentidos (E10-D38).
- Mostrarle al cliente un número (P3).
- Responder dentro de la ficha de la tarjeta: se responde en la Bandeja.
- Kommo, en cualquier sentido (respuestas 1 y 3).
- Bot o IA en esta bandeja (E7).
- Avisos nuevos, salvo el de los administradores con solo números (E10-D40).
- Cambios del portal a la vista, salvo la línea de T1.

### 10.5.18 Historial: las decisiones del borrador anterior

Borrador anterior: cabeza `9acf84b60` de esta rama, con tickets propios en Studio. Así queda cada decisión:

| ID | Decía, en corto | Estado |
|---|---|---|
| E10-D18 | Un ticket es un episodio del hilo del portal | Sin objeto: no hay tickets (P1 y P2). El estado lo lleva la conversación de Chatwoot (E10-D39) |
| E10-D19 | Lo abre un trigger en `conversation_messages`; el portal no cambia | Reemplazada por E10-D34: una cola, sin trigger |
| E10-D20 | El ticket guarda el hilo, no la tarjeta | Reemplazada por E10-D35: el vínculo del hilo con la conversación de Chatwoot |
| E10-D21 | El embudo sale del segmento | Vigente |
| E10-D22 | La tarjeta | Vigente, con otro disparador (E10-D36) |
| E10-D23 | «Vencido» y «sin atender» son dos cosas | Vigente, con la regla nueva de P5 y P7 |
| E10-D24 | El mensaje nunca falla por el CRM | Vigente, ahora sin trigger |
| E10-D25 | Literal: «**El asesor responde donde ya responde: en Conversaciones.** La ficha de la tarjeta lista los tickets y enlaza a `/studio/conversaciones?c=<conversation_id>`. No hay un camino nuevo para escribirle al cliente» | **Reemplazada por E10-D33** (P2: «Desde Chatwoot») |
| E10-D26 | Literal: «**Sin Chatwoot en 10.5.** El chat del portal no se copia a una bandeja de Chatwoot» | **Reemplazada por E10-D33** (P2: «Desde Chatwoot») |
| E10-D27 | Auditoría de los tickets (`crm_ticket_*`) | Sin objeto (E10-D45); la D-AUD sigue valiendo para la tarjeta |
| E10-D28 | Número `C-AAAA-NNNN · #n` | Sin objeto (P3, E10-D44) |
| E10-D29 | Se sella la primera respuesta | Reemplazada: la espera sale de `conversation_messages` (`crm_portal_espera`) |
| E10-D30 | Una sola pieza para ubicar o crear la tarjeta | Vigente |
| E10-D31 | Barrido de lo que el trigger no abrió | Reemplazada por la cola y su aviso (E10-D34 y E10-D40) |

Las seis preguntas del borrador anterior (P1 a P6) ya tienen respuesta (§10.5.1).

### 10.5.19 Coordinación con la 6.6 (PR #401, SDD-0614)

- **Orden:** primero la 10.5 y después la 6.6, en serie (Director General, 2026-11-06). Las dos tocan `TarjetaFichaDrawer.tsx`, `CrmTableroKanban.tsx`, `tarjeta-actions.ts`, `crm-ficha.ts` y las declaraciones de migraciones pendientes. La 6.6 arranca sobre `main` con la 10.5 integrada y mide el cruce con `git merge-tree` antes de publicar.
- **La pieza única:** `crm_tarjeta_ubicar_o_crear` (E10-D30). La SDD-0614 ya la llama así desde `5dc8500c3`, así que ese pendiente queda cerrado.
- **La D-SA y la D-AUD siguen valiendo** y se citan igual abajo. Su texto en la SDD-0614 §2.8 no cambió entre `17dc41cfc` y `5dc8500c3`, la cabeza de la #401 al 2026-11-06: se compararon las dos versiones y salieron iguales.
- **Lo que el rediseño cambia para la 0614** (propuesta; lo decide la 0614, y si lo cambia, esta copia se actualiza igual):
  - **Señal 2 de la D-SA:** ya no hay «ticket abierto del portal» ni `primera_respuesta_at`. Propuesta: «2. **Espera respuesta en el portal:** la conversación del portal de la ficha tiene mensajes del cliente sin respuesta del equipo (`crm_portal_espera`, SDD-0586 §10.5) y pasó el umbral desde el primero de ellos».
  - **Señales 1 y 3:** la bandeja del portal no cuenta en ellas, para no contarla dos veces y porque en el portal no hay ventana (E10-D46).
  - **«Respuesta humana» en el portal:** en lugar de «la primera respuesta del ticket (E10-D29)», un mensaje del equipo en el hilo (`conversation_messages` con `direction = 'out'`), que con el flag encendido llega desde Chatwoot.
  - **D-AUD:** el tipo `crm_ticket` de la 10.5 y su última frase («En la 10.5, el ticket y su evento van juntos…») quedan sin objeto (E10-D45).
- **La respuesta 8 (teléfono completo del lead)** no toca la 10.5 (§10.5.1).
- **Auditoría de la tarjeta:** la cubre el trigger de `crm_tarjetas` de la 6.6 (SDD-0614 §2.7 d), también para las tarjetas del portal.

**Cita literal de la SDD-0614 §2.8** (rama `claude/wizardly-hopper-d89dac`, PR #401; igual en `17dc41cfc` y en `5dc8500c3`):

> **D-SA · Definición de «sin atender»** (única para la alerta, los reportes, el conteo y el aviso)
>
> Una tarjeta está *sin atender* si está viva (no anonimizada, ficha no borrada, etapa no terminal en su tablero del momento) y cumple al menos una de estas señales:
>
> 1. **Espera respuesta en Chatwoot:** `ultimo_entrante_at` no es nulo, `ultima_respuesta_at` es nulo o anterior a él, y pasó el umbral (D-6.6-5) desde `ultimo_entrante_at`.
> 2. **Espera respuesta en el portal:** tiene un ticket abierto del portal (SDD-0586 §10.5) sin `primera_respuesta_at`, y pasó el umbral desde su `abierto_at`.
> 3. **Ventana por cerrar o cerrada**, solo en Chatwoot: la señal 1 y pasaron 20 h desde `ultimo_entrante_at` (por cerrar) o 24 h (cerrada: hace falta plantilla). En el portal no hay ventana.
> 4. **Tarea vencida:** una tarea abierta de la tarjeta con `vence_at` anterior a ahora. Sin fecha no vence.
>
> **Respuesta humana**, en Chatwoot: un mensaje saliente no privado de un agente que no es el usuario de servicio (`chatwootServicioUserId()`, `lib/studio/chatwoot/config.ts:67`), o un eco sin remitente. No lo son una nota privada, un mensaje de actividad, un bot ni la redirección de E10. Sin el id del usuario de servicio configurado, ningún saliente de agente cuenta. En el portal, la primera respuesta del ticket (E10-D29). La calcula **una sola función SQL**, `crm_sin_atender` (§3). El «vencido» del ticket del portal (E10-D23: sin primera respuesta al terminar el día) es otra cosa: es la promesa del portal y sigue siendo de la 10.5.
>
> **D-AUD · Qué lleva la auditoría del CRM** (única para los tipos `crm_*`: `crm_tarjeta` de esta SDD y `crm_ticket` de la 10.5)
>
> - **Entidad:** `entity_id` es el id de la fila del CRM (la tarjeta o el ticket).
> - **Puede llevar:** ids de filas propias del CRM (tarjeta, ticket), ids de usuarios del equipo (dueño, quien cerró), claves de etapa, fuente, motivo de lista, estado, número del episodio y banderas sí o no.
> - **Nunca lleva:** `client_id`, Shipping Mark, nombre, teléfono, correo, contacto de Chatwoot, BSUID, texto libre (notas, tareas, motivo «Otro», mensajes) ni montos. `entity_audit_log` es de solo agregar y sobrevive a la purga de la ficha: nada de lo que guarda puede identificar a la persona después.
> - **Actor:** `user` con `auth.uid()` **solo si ese usuario es miembro activo del tenant de la fila** (`user_tenants`, sin `disabled_at`). Lo que dispara un cliente del portal, el webhook de Chatwoot, un cron o `service_role` lleva `system`, con `actor_id` nulo, nunca el `auth.uid()` del cliente. El origen va en `source`, con los valores que admite la 0267 (`0267_audit_contract_append_only.sql:324-336`): `studio` (el equipo en Studio, incluido el cotizador), `webhook` (Chatwoot), `job` (crons) y `rpc` (portal y alta web de `/registro`).
> - **Misma transacción que el cambio** (AUD-01). En la 10.5, el ticket y su evento van juntos dentro del bloque que nunca rompe el mensaje del cliente (E10-D24).

### 10.5.20 Pendientes

**Para Sam.** Los lleva el Director General; esta tarea no le pregunta nada directamente.

| # | Qué | Opción recomendada |
|---|---|---|
| T1 a T4 | ~~Aprobar los textos públicos palabra por palabra (§10.5.12), en la decisión 5 del Director General~~ **Cumplido** el 2026-11-07 a las 04:48Z: «Apruebo los cuatro» | — |
| Conteo (decisión 6) | ~~El OK para que el Director General corra en producción la consulta de solo lectura de §10.5.10~~ **Decidido** el 2026-11-07, cerca de las 06:40Z: «Sí, córrela». El Director General la corrió a las 06:44:45Z (resultado en §10.5.10) | — |
| Hilos archivados (decisión 6 b) | ~~Confirmar que no se cargan a Chatwoot (§10.5.10)~~ **Decidido** el 2026-11-07 a las 06:55Z: «Sí, todos». Se cargan también, contra la recomendación (§10.5.10, «Hilos archivados») | ~~No cargarlos~~ |
| Puertas | La migración; la bandeja y las variables; cada paso de la carga; encender el flag (§10.5.9 y §10.5.10) | Cada una con su OK nominal, en ese orden |

**Para el Director General:**

- ~~Correr el conteo de §10.5.10, con su propio OK.~~ **Hecho** el 2026-11-07 a las 06:44:45Z, con el OK de Sam (§10.5.10).
- Decidir con el Subdirector de SEO si, con el flag encendido, se apaga el aviso de Telegram del portal (§10.5.13, punto 8).
- Elegir dónde viven los scripts de la carga (PR 2, §10.5.16).
- Llevar a la 0614 la propuesta de §10.5.19.
- ~~Decidir cómo se destraba un mensaje «atascado» de la ida~~ **Decidido** por el Director General el 2026-11-07, comunicado por el Subdirector: la vía para el admin va en la PR 1b. Hasta entonces vale el procedimiento manual de abajo, y **el flag `chatwoot_portal` no se enciende hasta que exista la vía de la 1b**.

**Mensaje atascado: procedimiento manual (PR 1a).** Un mensaje «atascado» detiene su hilo: los siguientes del mismo hilo esperan, para no romper el orden. Lo avisa el push de solo números de E10-D40.

- **Quién lo autoriza:** el Director General, con el OK de Sam, para cada corrida. Lo corre `service_role` sobre la base del tenant, nunca desde una pantalla.
- **Antes:** arreglar la causa con el código de `error` (por ejemplo, el token o la bandeja). Si no, el mensaje vuelve a atascarse en 24 h.
- **Ver lo atascado.** Solo ids, estado, intentos, el código de error y fechas, sin el texto ni el nombre:

  ```sql
  select s.message_id, s.conversation_id, s.intentos, s.error, s.created_at, s.updated_at
  from public.chatwoot_portal_salida s
  where s.tenant_id = :'tenant' and s.estado = 'atascado'
  order by s.created_at;
  ```

- **Reintentarlo, de a uno.** Vuelve a «pendiente» con un plazo nuevo de 24 h y con `verificar` encendido, porque un atascado pudo haber llegado: el próximo intento busca primero su `source_id` y no lo duplica. Toca una sola fila, y solo si sigue atascada:

  ```sql
  update public.chatwoot_portal_salida
  set estado = 'pendiente', proximo_at = now(), verificar = true,
      created_at = now(), updated_at = now()
  where tenant_id = :'tenant' and message_id = :'mensaje' and estado = 'atascado';
  ```

  El cron `chatwoot-reintentos` lo toma en su próxima corrida, cada 5 minutos. El resultado se ve con la misma consulta de arriba (`estado` en `enviado`) o con `chatwoot_portal_rezagados`.
- El checklist 0582 quedó en la #410 (`af50750d3`, en borrador), con la línea base v4: la fila 10.5 reescrita y dos filas nuevas, la 10.7 (aquí, «10.5 b») y la 10.8 (aquí, «10.5 c»). Esta rama deja el checklist igual que en su base (`3d17292a4`), así que la #400 no lo toca y no choca con la #410 en ningún orden de fusión. La reestimación ya está aprobada (§10.5.21).

### 10.5.21 Reestimación (I)

La línea base v3 del checklist 0582 le da a E10 7,25 días, de 115,5 en todo el programa. Fila por fila:

| Fila | Línea base v3 (d) | Ahora (d) | Delta |
|---|---|---|---|
| 10.1 Regla de segmento | 1,5 | 1,5 | 0 |
| 10.2 Clasificar y redirigir | 2 | 2 | 0 |
| 10.3 Sin teléfono (BSUID) | 0,5 | 0,5 | 0 |
| 10.4 Portal: número nuevo | 1 | 1 | 0 |
| **10.5** Conversaciones del portal en Chatwoot y en los embudos (rediseño) | 1,25 | 5 | +3,75 |
| **10.5 b** Carga de las conversaciones que ya existen (P4), fila nueva | — | 2,25 | +2,25 |
| **10.5 c** Textos públicos del portal y `/privacidad`, fila nueva | — | 0,5 | +0,5 |
| 10.6 revisar-datos-ve y punta a punta | 1 | 1 | 0 |
| **E10** | **7,25** | **13,75** | **+6,5** |

Con E10 sola, el programa pasa de 115,5 a 122 días; la 6.6 lleva su propia reestimación. **Queda vencida** la reestimación anterior de la 10.5, de 1,25 a 2 días, que el Director General aceptó el 2026-11-06, y con ella los +2,25 días que la sumaban a la de la 6.6: las respuestas 14 y 16 la cambiaron.

**Aprobada.** Sam, 2026-11-07 a las 03:42Z, traída por el Director General (decisión 1 del paquete): «Sí, 129,5 días». Es la línea base nueva del programa, con la 6.6 y la 10.5: pasa de 115,5 a 129,5 días. La 10.5 (5 días), la 10.5 b (2,25) y la 10.5 c (0,5) entran en ella con las cifras de esta tabla, y esa línea base ya incluía «vencida» con feriados.

**La decisión 6 b no cambia las cifras (I).** Ese día había 0 hilos archivados. Lo nuevo reusa trabajo ya estimado: la nota de archivo es un mensaje más del `insert_all` del cargador (10.5 b), y la guarda de la respuesta usa la nota privada de los adjuntos (E10-D38, en «Vuelta» de la 10.5).

**Desglose de la 10.5 (5 días):**

| Parte | Días |
|---|---|
| Prueba de concepto contra Chatwoot 4.19.1 en la cuenta 2 (PoC-1 a PoC-6) | 0,5 |
| Migración, contrato en PGlite y mutantes | 1,25 |
| Ida: cola, contacto, conversación, orden, idempotencia y reintentos | 1 |
| Vuelta: respuestas, estado, adjuntos y conciliación | 0,75 |
| CRM: tarjeta, insignia, sección de la ficha y «vencida» con feriados | 0,75 |
| Studio en solo lectura y modo de respaldo | 0,25 |
| Cierre: revisar-datos-ve, `/ui-check`, punta a punta en prueba y `pnpm verify` | 0,5 |

**Desglose de la 10.5 b (2,25 días):** extraer y preparar, 0,5; adaptar el cargador de E5 y su archivo de vínculos, 0,75; vincular en Studio, con su contrato, 0,25; ensayo en copias efímeras con C-1 a C-14, 0,5; producción con el Director General y acta, 0,25.

**Desglose de la 10.5 c (0,5 días):** redacción, revisar-datos-ve de los textos, pruebas de las dos páginas y publicación coordinada con el flag.

### 10.5.22 Fuera de alcance detectado (se informa, no se toca)

- **Telegram recibe el nombre y el texto del cliente:** `notifyConversationInbound` manda a Telegram el nombre del cliente, su Shipping Mark y hasta 140 caracteres de cada mensaje del portal (`lib/studio/conversation-inbound-notify.ts:103-112`). El texto de `/privacidad` de la #399 dice que la mensajería interna del equipo recibe avisos «sin tu nombre ni tus datos de contacto». Viene de la SDD-0148 y lo lleva el Director General al Subdirector de SEO. Con el rediseño, ese aviso sobra para el portal cuando el flag esté encendido (§10.5.13, punto 8).
- **La RLS de `conversations` no mira el rol:** «conversations by tenant» (`0106_conversaciones.sql:128`) deja que cualquier usuario del tenant cambie el estado de un hilo llamando directo a la API; solo la acción lo frena con `moduleEditDenial` (`conversaciones/actions.ts:103`). Con el flag encendido, Studio ya no responde el portal, pero esa puerta sigue igual.
- **`chatwoot_conversations` se lee por tenant, sin mirar el rol** (política de la 0504). Con la 10.5 también tendrá las conversaciones del portal, sin texto.
- **Falta Cloudflare en la tabla general de terceros:** lo anota la propia fila de Chatwoot (`docs/legal/privacidad/inventario-terceros.md:84`). Es de antes.
- **Chatwoot no tiene plazo para el contenido de las conversaciones** (SDD-0587 §14.3, punto 8). La 10.5 lo resuelve solo para su bandeja (§10.5.13, punto 5).
