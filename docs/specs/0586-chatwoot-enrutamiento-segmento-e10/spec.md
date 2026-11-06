---
sdd: "0586"
title: "Enrutamiento por segmento desde el ERP (etapa E10 del programa SDD-0582)"
status: in-progress
author: "Claude Worker «0582 E10» (Sam)"
created: 2026-10-30
updated: 2026-11-06
supersedes: null
superseded_by: null
related: ["0582", "0585", "0383", "0341", "0367", "0492", "0587", "0056", "0148", "0599"]
confidencialidad: interno
---

# SDD-0586 — Enrutamiento por segmento (E10)

> SDD hija de la [SDD-0582](../0582-chatwoot-piloto/spec.md), etapa **E10 «Enrutamiento por segmento»**, pasos 10.1 a 10.6 del [checklist](../0582-chatwoot-piloto/checklist.md). Esta entrega cubre **10.1, 10.2 y 10.3**. 10.4 (web y portal), 10.5 (tickets a los embudos, requiere 6.3) y 10.6 (punta a punta con el número de prueba) amplían esta SDD en su propia rama y PR.
>
> Rama `codex/0582-e10-enrutamiento`, apilada sobre `codex/0582-e2-poc` (SDD-0585, paso 2.3, punta `1cbb29b73`). Migración **0505 NO APLICADA**.
>
> **10.1, 10.2 y 10.3 aceptados** (Sam, 2026-10-30, a la pregunta del Director «¿Aceptas lo entregado: 2.4–2.6, 3.1–3.3, 6.2, 6.3 y 10.1–10.3?»: «Acepto todo»). Aceptar la entrega no aplica la 0505: aplicarla sigue siendo una puerta aparte, con OK nominal de Sam al integrar.
>
> **10.5, diseño en borrador** (2026-11-06): sección [«Paso 10.5»](#paso-105--tickets-del-portal-a-los-embudos-diseño-en-borrador-2026-11-06), al final. Sin código ni migración; lo revisa el Director General antes de programarlo.

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
- **10.5 destrabado:** su dependencia, el 6.3, ya está aceptada. Sam lo reafirmó el 2026-10-30 (comunicado por el Director): «Tenemos en el portal del cliente algo que se llama "canales", entonces quiero conectarlo al CRM también. ser como tickets». **Diseño en borrador el 2026-11-06** («Paso 10.5», al final), con seis preguntas para Sam. El Director General lo revisó el mismo día: sus cuatro decisiones y los cambios pedidos ya están en la sección (§10.5.14 y §10.5.17).
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

## Paso 10.5 — Tickets del portal a los embudos (diseño en borrador, 2026-11-06)

> **Borrador para la revisión del Director General.** Sin código de producto, sin migración escrita ni aplicada y sin preguntarle nada a Sam: sus preguntas están en §10.5.14. Rama `claude/trusting-kowalevski-525bef`, sobre `main` en `3d17292a4`. Etiquetas: **C** código leído, **D** documentación, **I** inferencia, **NV** no verificado.
>
> **Revisión del Director General (2026-11-06, sobre `89fb586cf`, comunicada por el Subdirector de Chatwoot):** «bien encaminado», con cambios menores de texto. Sus cuatro decisiones están en §10.5.14 y los cambios, aplicados en esta versión: (b) un fallo del trigger no pasa sin que nadie se entere (E10-D31); (c) lo que dispara el cliente se audita con actor `system` (E10-D27); (d) desde «Perdido» se mira el segmento antes de volver a recontacto (E10-D22); (f) P6 va después de la #399 y el aviso de Telegram lo lleva el Director General (§10.5.14 y §10.5.16). La coordinación con la 6.6 está en §10.5.17.

### 10.5.1 Lo que pidió Sam y cómo se lee

- Sam, 2026-10-30, comunicado por el Director: «Tenemos en el portal del cliente algo que se llama "canales", entonces quiero conectarlo al CRM también. ser como tickets».
- En el portal no hay ninguna pantalla que se llame «Canales». Lo más cercano (**C**):
  - el **chat con el asesor** de `/portal/soporte`, que en el código es el **«Canal Portal» de Conversaciones** (SDD-0056): `conversations.channel = 'portal'` (`supabase/migrations/0106_conversaciones.sql:31` y `:47`), escrito por `portal_post_message` (`supabase/migrations/0512_portal_intento_sin_duplicar.sql:112`) desde `app/portal/(app)/mensajes/actions.ts`;
  - la tarjeta «Otros canales» de la misma pantalla (`app/portal/(app)/soporte/page.tsx:306-325`), que son solo enlaces a WhatsApp, correo y teléfono;
  - «Tus casos», los reclamos post-venta (`client_claims`, `supabase/migrations/0152_client_claims.sql:18`), que ya tienen número `RC-AAAA-NNN`, estado y módulo propio.
- **Lectura de este diseño (I):** «canales» es el chat del Canal Portal. Es la que ya fijó el programa: la SDD-0582 («Tickets del portal a los embudos») y el contrato de E6 (SDD-0587, §1.2 y la fila «Ticket del portal (`conversations`, canal `portal`)» de §5.1). Los reclamos quedan fuera hasta que Sam diga otra cosa (**P1**).

### 10.5.2 Lo que hay hoy (C)

| Pieza | Dónde | Qué importa para el ticket |
|---|---|---|
| Un hilo por cliente y canal | `conversations` (0106:42-61), único vivo por `(tenant, client, channel)` (0106:67) | Un hilo no es un ticket: es una conversación que sigue. Por eso el ticket es un **episodio** del hilo |
| Estados del hilo | `abierto`, `pendiente`, `resuelto` (0106:34) | El equipo los cambia con `setStatusAction` (`app/studio/(app)/conversaciones/actions.ts:216`) |
| Mensaje del cliente | `portal_post_message(text, uuid)` (0512:112): resuelve la ficha por la sesión, crea o reusa el hilo, inserta el mensaje `in` y reabre el hilo si estaba `resuelto` (0512:203). Un reintento no inserta nada (0512:162-169 y :197) | Un reintento nunca puede abrir otro ticket |
| Firma vieja | `portal_post_message(text)` (0431), que la web anterior usa hasta publicar (0512) | También inserta en `conversation_messages`: el diseño la cubre sin tocarla |
| Respuesta del equipo | `sendReplyAction` (`conversaciones/actions.ts:91`) → `insertOutboundMessage` (`lib/studio/conversaciones/messages-queries.ts:47`), con push al portal | El asesor ya responde ahí |
| Aviso al equipo | `notifyConversationInbound` (`lib/studio/conversation-inbound-notify.ts`): Telegram al asesor o a los admins, con enlace `?c=<id>` | No cambia |
| Quién puede escribir | Soporte está cerrado hasta verificar la identidad (`lib/portal/verify-gate.ts:31`); la página aplica el cierre (`soporte/page.tsx:63-67`) | Quien escribe siempre tiene ficha: siempre hay `client_id` |
| Lo que se le promete al cliente | «Te responde en el día» (`soporte/page.tsx:200`) | El «vencido» del ticket sigue esa promesa (E10-D23, P5) |
| Fusión de fichas | `merge_clients` mueve los hilos a la ficha superviviente y archiva el duplicado (`supabase/migrations/0361_merge_clients_conserva_kommo_contact.sql:157-170`) | El ticket no guarda la tarjeta: la saca de la ficha del hilo (E10-D20) |

### 10.5.3 Decisiones

| ID | Decisión | Por qué / evidencia |
|---|---|---|
| E10-D18 | **Un ticket = un episodio del hilo del Canal Portal.** Lo abre el mensaje del cliente que llega cuando el hilo no tiene ticket abierto; los mensajes siguientes van al mismo; se cierra cuando el equipo marca la conversación `resuelto`. Si el cliente vuelve a escribir, se abre el siguiente | El hilo es uno por cliente (0106:67) y vuelve a `abierto` cuando el cliente escribe (0512:203). Un ticket por mensaje llenaría el tablero de duplicados |
| E10-D19 | **Lo abre la base, no el portal:** un trigger `after insert` en `conversation_messages`, solo con `direction = 'in'` y un hilo `channel = 'portal'`. **El portal no cambia** | Queda en la misma transacción que el mensaje: no se pierde si la acción muere después de guardar, cubre las dos firmas de la RPC y un reintento no lo dispara, porque no inserta. La SDD-0582 ponía el enganche después de `notifyConversationInbound` (V2-8); esa fila solo ubicaba el lugar, y desde la base es más seguro. Ver E10-D24 |
| E10-D20 | **El ticket guarda el hilo, no la tarjeta.** El tablero llega a la tarjeta por `conversations.client_id = crm_tarjetas.client_id` en cada lectura | Igual que el tablero, que tampoco se guarda (SDD-0587 §4.1). Una fusión mueve el hilo a la ficha superviviente (0361:170) y el ticket la sigue sin escribir nada |
| E10-D21 | **El embudo sale del segmento, calculado en el momento.** Quien escribe por el portal tiene ficha, así que es `cliente` (embudo **Clientes**) o `lead_registrado` (embudo **Leads**). Lo decide `crm_segmento_tarjetas` (0506), igual que en el tablero de 6.3, y no se guarda | Regla de 0.8 y SDD-0587 §4.1. Si la persona gana o pierde su único envío, la tarjeta cambia de tablero y su ticket se va con ella |
| E10-D22 | **La tarjeta.** Si la ficha no tiene, se crea con `fuente = 'portal'` (ya admitida, `0506_crm_modelo.sql:318-320`), `etapa_leads = 'registrado_recontacto'` y el asesor activo de la ficha, sin nombre ni teléfono (check de 0506:339). Si hay una tarjeta de lead sin ficha cuyo teléfono cruza con esta única ficha, se liga, como en la alta web. Si la tarjeta está en «Perdido», **primero se mira el segmento en ese momento** (`crm_segmento_cliente`, 0506): solo si es lead vuelve a «Registrado / recontacto» con tarea y sin motivo (`crm_volver_a_recontacto`, `0513_crm_entrada_leads.sql:147`). A un cliente con un envío vivo o carga en China no se le crea «Volvió a escribir» ni se le toca la etapa de Leads: si algún día vuelve a lead, lo mueve el registro del cambio de tablero de la 6.6 (SDD-0614 §2.7 a). A una tarjeta que ya existe no se le cambia la etapa ni la fuente | SDD-0587 §4.3: el lead registrado que escribe entra en «Registrado / recontacto». Para «Perdido», el mismo trato que 6.4, sin la tarea equivocada para un cliente (cambio d del Director General) |
| E10-D23 | **Dos cosas distintas.** (1) **«Vencido» es de la 10.5:** sin primera respuesta al terminar el día, hora de Caracas, en que se abrió el ticket. Se calcula en TypeScript al leer y no se guarda; es lo que dice la insignia. (2) **«Sin atender» no se define aquí:** es la D-SA de la SDD-0614 §2.8, citada igual en §10.5.17. Para el portal es su señal 2: ticket abierto sin `primera_respuesta_at` y pasado el umbral (D-6.6-5) desde `abierto_at`, sin ventana de 24 h. La calcula una sola función SQL de la 6.6, `crm_sin_atender`, con las fechas del ticket | El «vencido» es la promesa del portal, «Te responde en el día» (`soporte/page.tsx:200`); si cuentan los fines de semana es **P5**. Como no se guarda, cambiar la regla no pide migración. Que «sin atender» sea una sola definición es decisión del Director General (2026-11-06), y la D-SA dice que el «vencido» «sigue siendo de la 10.5» |
| E10-D24 | **El mensaje del cliente nunca falla por el CRM.** Lo del ticket corre en un bloque con `exception when others` que solo deja un `warning` con el SQLSTATE, y las funciones de los triggers llevan `lock_timeout = '2s'`. Si algo falla, quedan el mensaje, el contador y el aviso, y el ticket lo abre el barrido de E10-D31 en la corrida siguiente, o el próximo mensaje, lo que pase primero. Lo mismo vale para la respuesta del equipo y el cambio de estado | El mismo principio de 6.4: «un fallo de la tarjeta no rompe ni demora el registro» (SDD-0587 §16.6). El ticket y su evento de auditoría van juntos dentro del bloque: quedan los dos o ninguno (E10-D27) |
| E10-D25 | **El asesor responde donde ya responde: en Conversaciones.** La ficha de la tarjeta lista los tickets y enlaza a `/studio/conversaciones?c=<conversation_id>`. No hay un camino nuevo para escribirle al cliente | El enlace `?c=` ya existe (SDD-0148 #1, `app/studio/(app)/conversaciones/page.tsx:33`). Contrato de E6: Studio no copia el texto de los mensajes (SDD-0587 §3) |
| E10-D26 | **Sin Chatwoot en 10.5.** El chat del portal no se copia a una bandeja de Chatwoot | Es un canal propio de Studio y ya se responde desde Studio. Copiarlo dejaría el texto del cliente en otro almacén y pediría sincronizar en los dos sentidos. Lo decide Sam (**P2**) |
| E10-D27 | **Auditoría (AUD-01), según la D-AUD de la SDD-0614 §2.8** (citada igual en §10.5.17): abrir, resolver y archivar un ticket dejan un evento `crm_ticket_*` en `entity_audit_log`, en la misma transacción que el cambio y dentro del bloque de E10-D24. `entity_id` es el id del ticket; el evento lleva solo estado, cierre, número del episodio y, si lo cerró alguien del equipo, su id. **Lo que dispara el cliente lleva actor `system`, con `actor_id` nulo, y nunca `client_id`**, ni Shipping Mark, nombre, teléfono, texto ni el id de la conversación. **Actor y origen por caso:** abrir, desde el portal → `system`, `source = 'rpc'`; el barrido de E10-D31 → `system`, `job`; resolver en Studio, o archivar al fusionar fichas → `user` con su `auth.uid()` solo si es miembro activo del tenant de la fila, `studio`; si no lo es o no hay sesión → `system` | Patrón de la 0491 (fila en `audit_entity_types` y trigger que llama a `append_audit_event`); actor y origen admiten esos valores (`0267_audit_contract_append_only.sql:312-313` y `:324-336`). Cambio c del Director General y D-AUD de la 6.6. `entity_audit_log` es de solo agregar y sobrevive a la purga de la ficha: nada de lo que guarda puede identificar a la persona después |
| E10-D28 | **Número del ticket:** `C-AAAA-NNNN · #n`, el `ref` del hilo más el número del episodio dentro del hilo | Sin correlativo nuevo por tenant: dos tickets de clientes distintos al mismo tiempo no pueden pelear un número. Un `MAX+1` por tenant chocaría, y con el bloque de E10-D24 ese ticket se perdería |
| E10-D29 | **Primera respuesta:** el primer mensaje `out` del equipo en el hilo marca `primera_respuesta_at` y quién respondió, una sola vez por ticket | Sirve para el «vencido» y para la señal 2 de «sin atender» (E10-D23), y para ver cuánto tardó el equipo. No mueve la tarjeta |
| E10-D30 | **Una sola pieza «ubicar o crear la tarjeta» para los tres usos:** el alta web de la 0513, el ticket del portal de la 10.5 y el «ubicar o crear» del cotizador de la 6.6 (SDD-0614 §2.3, PR #401). La crea la migración de la 10.5, que va primero, con los dos caminos que piden esos usos: por ficha y, para el cotizador sin Shipping Mark, por teléfono. `crm_alta_tarjeta_web` (0513:325) se redefine **desde su última definición** para usarla, sin cambiar su conducta, y su contrato se vuelve a correr. La 6.6 la llama y no escribe otra | Decisión del Director General (D-1, 2026-11-06). Copiar el bloque duplicaría la regla de ligado por teléfono, y SDD-0587 §4.2.1 pide una sola definición. **Antes de reescribir, se busca la última `create or replace` de cada función en todas las migraciones** (regla del repo): al 2026-11-06, `crm_alta_tarjeta_web` solo está definida en la 0513, en `main` y en todas las ramas remotas |
| E10-D31 | **Un fallo del trigger no pasa en silencio.** Además del `warning`: un barrido `crm_tickets_reconciliar()` en el cron `chatwoot-reintentos`, que ya corre cada 5 min (`infra/dtd-cargo/cron/crontab:26`) y ya lleva la purga de E10 (E10-D16). Abre el ticket que falte, marca la primera respuesta que falte y asegura la tarjeta, con las mismas piezas del trigger e idempotente por `primer_mensaje_id`. Cuenta lo que recuperó, y si es más de cero deja un aviso interno con **solo el número**, sin nombre, Shipping Mark ni contacto | Cambio b del Director General. El número del barrido es el contador: si el trigger falla, se ve en ≤5 min sin abrir los logs de Postgres. El aviso sale por el canal de alertas internas vigente al programar, coordinado con los avisos a Discord (SDD-0606) |

### 10.5.4 Qué entra como ticket

| Caso | ¿Abre ticket? |
|---|---|
| Mensaje del cliente en su chat de Soporte, sin ticket abierto en el hilo | **Sí**: el #1 o el siguiente |
| Más mensajes del cliente con el ticket abierto | No: van al mismo |
| El cliente escribe después de que el equipo marcó «Resuelto» | **Sí**, el siguiente (el hilo ya vuelve a `abierto`, 0512:203) |
| Reintento del mismo envío (SDD-0599) | No: la RPC no inserta nada |
| Respuesta del equipo (`out`) | No: marca la primera respuesta del ticket abierto |
| El equipo reabre a mano un hilo resuelto, sin mensaje del cliente | No: solo abre un mensaje del cliente |
| Hilos de otros canales en `conversations` (`whatsapp`, `email`: fases 2 y 3 de SDD-0056) | No |
| Reclamos de «Tus casos» (`client_claims`) | No (**P1**) |
| WhatsApp, Instagram o correo por Chatwoot | No: esos ya entran a los embudos por 6.4 |
| Hilos abiertos antes de publicar | No se cargan hacia atrás: el próximo mensaje abre el ticket (**P4**) |

**Se cierra** cuando el hilo pasa a `resuelto` (cierre `resuelto`) o se archiva (`deleted_at`, como en la fusión: cierre `archivado`). `pendiente` no lo cierra.

### 10.5.5 Qué ve el asesor y cómo responde

**En el tablero** (`/studio/crm`, pestaña Embudos, en Leads o en Clientes según el segmento):

- La tarjeta con un ticket abierto lleva una insignia con texto: «Ticket abierto · sin responder · 3 h», «Ticket abierto · respondido» o «Ticket vencido», esta última en el tono de alerta de las tareas vencidas (E10-D23). El texto dice el estado: el color no es lo único que lo dice (SGE-00.11).
- Cuando la 6.6 esté, la misma tarjeta aparece además en su pestaña «Sin atender» si cumple la señal 2 de la D-SA (E10-D23). La 10.5 no calcula «sin atender».
- Ni el tablero ni la ficha muestran el texto del mensaje (E10-D25).

**En la ficha de la tarjeta** (`TarjetaFichaDrawer`), una sección nueva «Tickets del portal», después de «Quién contesta el chat»:

```text
Tickets del portal (1 abierto)
  C-2026-0012 · #3   Abierto · sin responder · vence hoy a las 23:59
                     Abierto el 6 nov a las 10:42
                     Responder en Conversaciones →
  C-2026-0012 · #2   Resuelto el 2 nov por Ana · primera respuesta a los 40 min
```

- «Responder en Conversaciones» es un enlace a `/studio/conversaciones?c=<id>`, que abre el hilo. Ahí el asesor contesta como siempre (`sendReplyAction`: mensaje al portal y push) y marca «Resuelto» al terminar (`setStatusAction`), lo que cierra el ticket.
- La sección muestra los 10 más recientes; el resto se ve en Conversaciones (TBL-01).
- El aviso de Telegram de SDD-0148 sigue igual: es lo que le avisa al asesor que hay un mensaje.

**Quién lo ve:** el CRM es de `admin` y `commercial` (`lib/studio/rbac.ts:99`, `crm_puede_usar()` en 0506:186-195). Responder es de quien edita Conversaciones: `admin`, `commercial` y `operations` (`rbac.ts:91`; `support` solo lee). Un comercial tiene las dos cosas.

### 10.5.6 Modelo de datos y migración (solo descripción)

Una migración nueva, `supabase/migrations/05NN_crm_tickets_portal.sql`. **No se escribe ni se aplica en esta tarea.** **El número se asigna al arrancar el código** (decisión del Director General, 2026-11-06): ni la 10.5 ni la 6.6 reservan la 0518. Como referencia, al 2026-11-06 ya había de la 0514 a la 0517 en ramas remotas (`claude/gracious-kapitsa-213515`, `claude/discord-consulta-clientes-c50c23` y `codex/0589-e9-estado`). Va con el OK nominal de Sam y el runbook de producción, primero en prueba.

**Preflight:** exige la 0106 (`conversations`, `conversation_messages`), la 0506 (`crm_tarjetas`, `crm_segmento_*`), la 0513 (`crm_volver_a_recontacto`, `crm_alta_tarjeta_web`, `crm_asesor_activo`, `crm_ficha_por_telefono`, `crm_buscar_tarjeta`) y el catálogo de auditoría (`audit_entity_types`, `append_audit_event`). Aborta si ya se aplicó.

**Tabla `crm_tickets`:**

| Columna | Tipo | Regla |
|---|---|---|
| `id` | uuid, pk | — |
| `tenant_id` | uuid, fk `tenants`, cascade | El del hilo |
| `canal` | text, `check (canal = 'portal')` | Deja lugar a otro canal sin renombrar la tabla |
| `conversation_id` | uuid, fk `conversations`, **cascade** | Purgar la ficha borra el hilo (0106:45) y con él sus tickets |
| `numero` | int > 0 | El episodio dentro del hilo; `unique (conversation_id, numero)` |
| `primer_mensaje_id` | uuid, fk `conversation_messages`, `set null`; único cuando no es nulo | Llave de idempotencia al abrir. Con `set null`, borrar un mensaje no borra el ticket |
| `abierto_at` | timestamptz | El `sent_at` del primer mensaje |
| `primera_respuesta_at`, `respondido_por` | timestamptz; uuid fk `auth.users`, `set null` | E10-D29 |
| `cerrado_at`, `cerrado_por`, `cierre` | timestamptz; uuid fk `auth.users`, `set null`; text `check (cierre in ('resuelto', 'archivado'))` | `check ((cerrado_at is null) = (cierre is null))` |
| `created_at` | timestamptz | — |

- Índice único parcial: **un solo ticket abierto por hilo**, `(conversation_id) where cerrado_at is null`.
- Índice `(tenant_id, conversation_id) where cerrado_at is null`, para el tablero.
- **Sin** columnas de texto, nombre, teléfono, correo ni código: el contrato lo comprueba en el catálogo, como el de la 0506.

**Piezas:**

1. **`crm_tarjeta_ubicar_o_crear`**, interna y única para los tres usos (E10-D30). Recibe el tenant, la ficha si la hay, los últimos 10 dígitos si no hay ficha, el nombre visible solo para el lead sin ficha (D6), la fuente y la etapa de Leads de una tarjeta nueva. Devuelve la tarjeta y el resultado: `existente`, `ligada`, `creada` o `ambigua`.
   - **Con ficha** (alta web, portal y cotizador con Shipping Mark): la tarjeta de la ficha; si no hay, liga la del lead sin ficha que cruza por teléfono con esta única ficha (`crm_ficha_por_telefono`, 0513:62); si tampoco, crea una con `on conflict do nothing`.
   - **Sin ficha** (cotizador sin Shipping Mark, SDD-0614 §2.3, punto 2): con una sola ficha para ese teléfono, sigue como con ficha; si no hay ficha, la tarjeta sin ficha de ese teléfono (`crm_buscar_tarjeta`, 0513:117); si no hay ninguna, crea una con nombre visible y últimos 10; con más de una coincidencia, `ambigua` y no toca nada.
   - No mueve etapas ni crea tareas: eso lo decide cada uso (el «Perdido» del alta web, la regla d del portal y el mapeo del cotizador).
2. `crm_alta_tarjeta_web`, redefinida **desde su última definición** (hoy la 0513) para usar la pieza 1 con `web_registro` y «Nuevo», con la misma firma, los mismos grants, los mismos resultados (`creada`, `ligada`, `existente`) y su salida de «Perdido» con la clave `web_registro:<ficha>`. El contrato de la 0513 se vuelve a correr sin cambios. E10-D30.
3. Trigger `crm_tickets_mensaje` (`after insert on conversation_messages`), con función `security definer`, `search_path = ''` y `lock_timeout = '2s'`:
   - mensaje `in` en un hilo vivo del canal `portal`: bloquea la fila del hilo (`for update`, para que dos mensajes del mismo cliente al mismo tiempo no abran dos tickets); asegura la tarjeta con la pieza 1 (`portal`, `registrado_recontacto`); si está en «Perdido» **y el segmento en ese momento no es `cliente`** (`crm_segmento_cliente`), llama a `crm_volver_a_recontacto` con la clave `portal:<message_id>`; actualiza `ultima_actividad_at`; si no hay ticket abierto, inserta el siguiente número y su evento de auditoría con actor `system`, `actor_id` nulo y `source = 'rpc'` (D-AUD);
   - mensaje `out`: marca la primera respuesta del ticket abierto del hilo, si no la tiene;
   - todo dentro del bloque de E10-D24.
4. Trigger `crm_tickets_conversacion` (`after update of status, deleted_at on conversations`): al pasar a `resuelto`, cierre `resuelto` con `cerrado_por = auth.uid()`; al ponerse `deleted_at`, cierre `archivado`. El mismo bloque. Actor del evento, según la D-AUD: `user` con su `auth.uid()` solo si es miembro activo del tenant del ticket, con `source = 'studio'`; si no, `system`. `cerrado_por` sigue la misma regla.
5. **`crm_tickets_reconciliar(p_desde)`**, solo `service_role` (E10-D31). Sobre los hilos vivos del canal `portal` con actividad desde `p_desde` (el cron pasa los últimos 7 días):
   - hilo no resuelto, sin ticket abierto y con un mensaje `in` posterior al cierre de su último ticket (o sin tickets): abre el ticket con el primero de esos mensajes y asegura la tarjeta, con las mismas piezas del trigger;
   - ticket abierto sin primera respuesta y con un `out` posterior a `abierto_at`: la marca;
   - devuelve cuántos tickets abrió y cuántas respuestas marcó. Dos corridas a la vez no duplican nada: la llave es `primer_mensaje_id` y el índice de un abierto por hilo;
   - el ticket que abre lleva su evento con actor `system` y `source = 'job'` (D-AUD).
6. `audit_entity_types`: fila `crm_ticket`, dominio comercial, `introduced_by_ref = 'migration:05NN'`. Eventos `crm_ticket_opened`, `crm_ticket_resolved` y `crm_ticket_archived` (E10-D27).
7. Postflight: tabla, índices, triggers, ACL y fila del catálogo en su lugar.

**En la aplicación:** `reconciliarTicketsPortal` (`lib/studio/crm-tickets-barrido.ts`) llama al barrido desde `app/api/cron/chatwoot-reintentos/route.ts`, junto a la purga de E10; nunca lanza y deja el resultado en la respuesta del cron. Si abrió o marcó algo, manda un aviso interno con solo los dos números: «CRM · el barrido recuperó N tickets del portal que el trigger no abrió. Revisar el log de la base.»

**Lo que la migración no hace:** no cambia `portal_post_message`, ni las columnas de `conversations` o `conversation_messages` (solo les cuelga triggers), ni la RLS de la 0106. No carga tickets hacia atrás (**P4**).

**Declaraciones:** la migración va pendiente en `supabase/migrations-baseline.json`. Como el tablero y la ficha degradan sin la tabla (avisan que falta aplicar la migración, como en 6.3), lleva también su declaración en `supabase/pending-migration-symbol-declarations.json`.

### 10.5.7 Permisos y RLS

| Quién | En `crm_tickets` | Cómo |
|---|---|---|
| `admin` y `commercial` del tenant | Leen los suyos | Política `select` con `tenant_id = get_user_tenant_id() and crm_puede_usar()` (0506:186-195) |
| Los demás roles del equipo (`operations`, `support`, `accounting`, `warehouse`, `marketing`) | Nada | `crm_puede_usar()` da falso. Siguen viendo el hilo en Conversaciones si su rol lo tiene |
| El cliente del portal (`authenticated` sin `user_tenants`) | Nada | `get_user_tenant_id()` le da nulo (`supabase/migrations/0453_portal_helpers_principal_determinista.sql`). Solo dispara el trigger al escribir |
| `anon` | Nada | Sin grant |
| Cualquier `authenticated` | No inserta, no actualiza, no borra | Sin grant de escritura: solo escriben las funciones de los triggers, cuyo dueño es `postgres` |
| `service_role` | Todo | Como el resto de las tablas `crm_*` |
| Funciones internas y de los triggers | Sin `execute` para `anon` ni `authenticated` | `revoke` explícito, como en 0513:420-438 |
| `crm_tickets_reconciliar` | Solo `service_role` | La llama el cron con la llave de servicio; el aviso no lleva datos de personas |

- **Cerrar un ticket** es marcar la conversación como resuelta: en la acción lo frena `moduleEditDenial("conversaciones")` (`conversaciones/actions.ts:216`). La política «conversations by tenant» (0106:128) es por tenant y no mira el rol, así que un usuario del tenant sin el módulo podría cambiar el estado llamando directo a la API. Eso es de antes y está en §10.5.16. El ticket guarda quién lo cerró.
- El trigger no le abre al cliente ningún camino nuevo: escribe donde ya escribía.

### 10.5.8 Datos personales (revisar-datos-ve, acotado a 10.5)

Revisión del diseño y del código vigente que toca, con `.claude/skills/revisar-datos-ve/SKILL.md` y sus referencias. Las citas son del código de hoy; lo que depende de código que todavía no existe queda **NO VERIFICABLE** hasta implementarlo. Estados de la skill: **ENCONTRADO**, **CORRECTO** o **NO VERIFICABLE**. Marco: Venezuela (CRBV arts. 28 y 60; SC 332/2001). Esto no es asesoría legal.

**Resumen:** 4 CORRECTO · 7 NO VERIFICABLE · 1 no aplica · y 1 ENCONTRADO anterior a 10.5 (punto 8, Telegram).

**Inventario que suma 10.5:**

| Dato | Qué es | Finalidad | Retención | Quién lo ve |
|---|---|---|---|---|
| `crm_tickets`: ids, número y fechas | Episodios del chat de un cliente, sin texto | Seguimiento comercial: que ningún mensaje quede sin respuesta y saber cuánto tarda el equipo | Con el hilo: se borra en cascada al purgar la ficha (0106:45) | `admin` y `commercial` del tenant |
| `respondido_por`, `cerrado_por` | Usuario del equipo | Saber quién atendió | Igual; `set null` si se borra el usuario | Igual |
| Tarjeta con `fuente = 'portal'` | La misma de la 0506, sin nombre ni teléfono porque tiene ficha (0506:339) | Embudo | Con la ficha (`on delete cascade` de la 0506) | Igual |
| Evento `crm_ticket_*` en `entity_audit_log` | Lo que permite la D-AUD de la SDD-0614 §2.8: el id del ticket, estado, cierre, número del episodio y el id de quien cerró, si es del equipo. Nunca `client_id`, Shipping Mark, nombre, teléfono ni texto. Actor `system` o el usuario del equipo, nunca el cliente (E10-D27) | AUD-01 | El de la bitácora, de solo agregar: queda tras la purga sin nada que identifique a la persona | Quien lee la bitácora (AUD-02) |
| Aviso del barrido (E10-D31) | Dos números: tickets abiertos y respuestas marcadas | Enterarse de que el trigger falló | El del canal de alertas internas | El equipo que recibe esas alertas |

Lo que ya existía y 10.5 no copia: el texto y el nombre del autor de cada mensaje (`conversation_messages.author_name` y `body`, 0106:91-93).

| # | Punto | Estado | Evidencia y comentario |
|---|---|---|---|
| 1 | Inventario | CORRECTO | La tabla de arriba. Los datos de origen están en 0106:45-50 y 0106:91-93; el diseño no suma texto, nombre, teléfono ni correo (E10-D25, §10.5.6) |
| 2 | Minimización | NO VERIFICABLE | Por diseño, solo ids y fechas, y el tablero no lee el texto. Se comprueba al implementar: el contrato revisa las columnas en el catálogo y la prueba de consultas, que no se pidan `body` ni `author_name` |
| 3 | Consentimiento | NO VERIFICABLE | Igual que en SDD-0587 §14.3: la base de licitud para el seguimiento comercial del chat de un cliente no está en el código. La decide Sam con su asesor |
| 4 | Derechos | NO VERIFICABLE | El cliente ve su chat (`lib/portal/portal-conversation-queries.ts`), no sus tickets, que son datos internos de seguimiento. La destrucción va con la purga de la ficha (cascada); «Anonimizar ahora» es de 6.6 |
| 5 | Borrado | NO VERIFICABLE | Por diseño, en cascada desde `conversations`. Se prueba en PGlite al implementar: purgar la ficha deja sin tickets y solo queda el evento de auditoría. No se prueba contra producción sin OK |
| 6 | Trazabilidad de solicitudes | NO VERIFICABLE | Igual que en 6.4 |
| 7 | Política pública | NO VERIFICABLE | `/privacidad` ya dice del Portal «comunicaciones con nuestro equipo» (`app/privacidad/page.tsx:75-76`) y, entre las finalidades, «Atender tus mensajes por WhatsApp y chat: saber si ya eres cliente para que te atienda el equipo que corresponde, darle seguimiento a tu consulta» (`:195-199`). Que «chat» incluya el del Portal es una lectura. **Propuesta (P6):** sumar a la fila del Portal «y el seguimiento de tus consultas por el chat de Soporte», con texto aprobado por Sam antes de publicar 10.5. **Va después de la #399**, que trae el texto ya aprobado de la mensajería interna y toca el mismo `app/privacidad/page.tsx` |
| 8 | Terceros | CORRECTO · ENCONTRADO anterior | El diseño no envía nada fuera (E10-D26), y el aviso del barrido solo lleva dos números (E10-D31). **Anterior a 10.5:** el aviso de SDD-0148 manda a Telegram el nombre del cliente, su Shipping Mark y un extracto de hasta 140 caracteres del mensaje (`lib/studio/conversation-inbound-notify.ts:103-112`), y el texto ya aprobado de la #399 dice que la mensajería interna recibe avisos «sin tu nombre ni tus datos de contacto». 10.5 no lo amplía. Lo lleva el Director General al Subdirector de SEO (§10.5.16) |
| 9 | Transferencia internacional | CORRECTO | Lo nuevo vive en la base de DTD y no sale. Lo de Telegram es el punto 8 |
| 10 | Decisiones automatizadas | CORRECTO | El segmento solo elige el tablero: no niega servicio ni le responde al cliente. La regla es pública en la SDD-0582 |
| 11 | Aceptación electrónica | No aplica | No se registran aceptaciones |
| 12 | Titulares que no son usuarios | NO VERIFICABLE | El texto del chat puede nombrar a terceros (un proveedor, otro importador). 10.5 no lo copia; lo que ya guarda `conversation_messages` es de SDD-0056 |
| — | Logs y avisos | Por diseño | El `warning` de E10-D24 lleva solo el SQLSTATE y el aviso del barrido, solo dos números; se prueba al implementar |
| — | China (PIPL) | NO VERIFICABLE | El diseño no amplía quién ve. Si un `admin` o un `commercial` trabaja desde China, aplica la PIPL; el código no dice desde dónde trabaja cada usuario |

La skill pide una segunda opinión: otro modelo puede revisar este mismo diseño. **Lo que necesita un abogado:** la base de licitud y la redacción final de P6.

### 10.5.9 Gobernanza ([AGENT-BRIEF](../../governance/AGENT-BRIEF.md))

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 | cumplimiento por diseño | Matriz de abajo |
| AUD-01 | cumplimiento por diseño para el ticket (E10-D27) · **no conformidad pendiente** para la tarjeta que se crea desde el portal | Es la misma de 6.4 (SDD-0587 §16.6): crear una tarjeta no deja evento en `entity_audit_log`. La cierra el trigger de `crm_tarjetas` de la 6.6 (SDD-0614 §2.7 d), que va después de la 10.5; hasta entonces, las tarjetas que crea el portal están en ese pendiente |
| AUD-02 | no aplica | No cambia quién consulta ni exporta la bitácora |
| MP-01 | cumplimiento | No hay borrado ni archivo nuevo desde la pantalla. Cerrar es el «Resuelto» de siempre, y el cliente puede abrir otro escribiendo |
| BTN-01 | cumplimiento por diseño | «Responder en Conversaciones» es un enlace, no un botón que cambie algo |
| A11Y-01 | por verificar al implementar | Insignia con texto y nombre accesible; enlace alcanzable con teclado |
| VIS-01, VIS-02 | por verificar al implementar | Tokens de `app/studio/tokens.css` y el tono de las tareas vencidas; `/ui-check` |
| LOD-01, ERR-01 | por verificar al implementar | La sección usa los estados de la ficha: cargando, vacío («Sin tickets del portal»), error con «Reintentar» y migración sin aplicar |
| TBL-01 | cumplimiento por diseño | Lista con tope de 10 y paso a Conversaciones |
| DND-01 | no aplica | El ticket no se arrastra; la tarjeta sí, como en 6.3 |
| CMP-01 | por verificar al implementar | Reusa las piezas de la ficha; nada nuevo en `components/` |
| FRM-01 | no aplica | Sin formulario nuevo |

**Matriz SGE-00:**

| Principio | Resultado | Evidencia |
|---|---|---|
| .01 Acción predecible | cumple | «Responder» lleva a donde siempre se responde y «Resuelto» cierra, como hoy |
| .02 No perder trabajo | cumple | E10-D24: el mensaje del cliente nunca falla por el CRM, y el barrido recupera el ticket que faltó (E10-D31) |
| .03 El riesgo fija la fricción | no aplica | No hay acción nueva con riesgo |
| .04 Auditable | cumple para el ticket · pendiente para la tarjeta | E10-D27 y AUD-01 arriba |
| .05 Permisos, tenant y privacidad | cumple por diseño | §10.5.7, con pruebas negativas (§10.5.11, punto 12) |
| .06 Prevenir errores | cumple | Un ticket abierto por hilo (índice) y número por hilo (E10-D28) |
| .07 Estado visible y verdadero | cumple por diseño | El «vencido» sigue la promesa del portal, «sin atender» es la definición única de la 6.6 (E10-D23), y un fallo del trigger se ve en el aviso del barrido (E10-D31) |
| .08 La frecuencia reduce pasos | cumple, con nota | Responder queda a un clic desde la tarjeta. Responder dentro de la ficha queda para después (§10.5.13) |
| .09 Mismo patrón | cumple | Insignia como la de las tareas vencidas; enlace `?c=` existente |
| .10 Accesible | por verificar al implementar | A11Y-01 |
| .11 Lenguaje | cumple por diseño | El texto de la insignia dice el estado |
| .12 IA | no aplica | Sin IA |

### 10.5.10 Allowlist exacta (para la PR de implementación)

**Nuevos:**

- `supabase/migrations/05NN_crm_tickets_portal.sql`
- `supabase/tests/05NN_crm_tickets_portal.test.sql`
- `lib/studio/__tests__/crm-tickets.migration.test.ts`
- `lib/studio/crm-tickets.ts` (puro: tipos, estado, «vencido» al terminar el día en `America/Caracas` y texto de la insignia; no calcula «sin atender», que es la `crm_sin_atender` de la 6.6, E10-D23)
- `lib/studio/__tests__/crm-tickets.test.ts`
- `lib/studio/crm-tickets-barrido.ts` (`reconciliarTicketsPortal`: llama al barrido, nunca lanza y manda el aviso con solo los números; E10-D31)
- `lib/studio/__tests__/crm-tickets-barrido.test.ts`
- `app/studio/(app)/crm/_components/TarjetaFichaDrawer.test.tsx`
**Editados:**

- `supabase/migrations-baseline.json` (pendiente)
- `supabase/pending-migration-symbol-declarations.json` (degradación del tablero y la ficha)
- `lib/studio/crm-tablero.ts` (`CrmTarjetaTablero` suma el ticket abierto)
- `lib/studio/crm-tablero-queries.ts` (tickets abiertos por `conversations.client_id`)
- `lib/studio/__tests__/crm-tablero.test.ts`
- `lib/studio/__tests__/crm-tablero-queries.test.ts`
- `lib/studio/crm-ficha.ts` (`CrmFichaTarjeta.tickets`)
- `app/studio/(app)/crm/tarjeta-actions.ts` (`cargarFichaTarjetaAction` lee los tickets con los mismos candados)
- `app/studio/(app)/crm/__tests__/tarjeta-actions-gate.test.ts`
- `app/studio/(app)/crm/_components/CrmTableroKanban.tsx` (insignia)
- `app/studio/(app)/crm/_components/CrmTableroKanban.test.tsx`
- `app/studio/(app)/crm/_components/TarjetaFichaDrawer.tsx` (sección «Tickets del portal»)
- `app/api/cron/chatwoot-reintentos/route.ts` (llama a `reconciliarTicketsPortal` junto a la purga de E10) y `app/api/cron/chatwoot-reintentos/__tests__/route.test.ts`
- `docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md`, `docs/specs/0582-chatwoot-piloto/checklist.md` (fila 10.5), `docs/specs/README.md` (índice generado) y `.agents/handoffs/0586-e10-5-tickets-portal.md`
- Solo si Sam aprueba P6, y **después de que se integre la #399**, que toca los mismos archivos: `app/privacidad/page.tsx` y `app/__tests__/privacidad-chat.test.ts`

**No se tocan**, y la revisión lo comprueba con `git diff --stat`: `app/portal/**`, `lib/portal/**`, `components/**`, `app/studio/(app)/conversaciones/**`, `lib/studio/conversaciones/**`, `lib/studio/conversation-inbound-notify.ts`, `lib/studio/chatwoot/**`, `supabase/migrations.lock.json` y ninguna migración ya aplicada (la función de la 0513 se redefine desde la migración nueva; el archivo 0513 no se edita).

**Cruce con 6.6:** comparten archivos y van en serie, primero la 10.5 (§10.5.17).

### 10.5.11 Pruebas

**Contrato SQL en PGlite** (`05NN_crm_tickets_portal.test.sql`, sobre las migraciones reales hasta la 0513 y la nueva):

1. El primer mensaje `in` del portal abre el ticket #1 con `abierto_at` igual a `sent_at`; el segundo no abre otro.
2. El reintento de la 0512 (mismo identificador) no abre ticket ni toca la tarjeta.
3. La firma vieja `portal_post_message(text)` también abre.
4. «Resuelto» cierra con `cerrado_por`; el siguiente mensaje abre el #2; `pendiente` no cierra; reabrir a mano no abre.
5. El primer `out` marca la primera respuesta; el segundo no la pisa; un `out` sin ticket abierto no hace nada.
6. Un hilo `whatsapp` o `email` en `conversations` no abre ticket.
7. Tarjeta: se crea con `portal` y «Registrado / recontacto», sin nombre ni teléfono; una existente no cambia de etapa ni de fuente; un lead en «Perdido» vuelve con tarea, idempotente por `portal:<message_id>`; **un cliente con envío vivo y «Perdido» guardado en Leads no recibe tarea ni movimiento**; el lead sin ficha con el mismo teléfono se liga.
8. Tablero: con envío vivo, la tarjeta sale en Clientes con su ticket; sin envío, en Leads; si pierde su único envío, vuelve a Leads con el ticket.
9. Fusión con `merge_clients`: el hilo que se mueve lleva sus tickets a la ficha superviviente; el que se archiva cierra el suyo como `archivado`.
10. **Un fallo del CRM no rompe el mensaje:** con la escritura de `crm_tickets` forzada a fallar, quedan el mensaje, el contador y el hilo; no hay ticket ni evento, y el `warning` no lleva datos. Igual para la respuesta del equipo y para «Resuelto». Con la falla quitada, el barrido abre ese ticket con el primer mensaje que quedó sin ticket.
11. Dos mensajes al mismo tiempo del mismo cliente dejan un solo ticket abierto. PGlite tiene una conexión y solo lo simula; la carrera real con `dblink` va en `sql-tests` con Docker.
12. Acceso: el cliente del portal lee 0; `admin` y `commercial` leen los de su tenant; otro tenant, 0; `operations` y `support`, 0; ningún `authenticated` inserta, actualiza ni borra; las funciones no tienen `execute` para `anon` ni `authenticated`.
13. Abrir, resolver y archivar dejan su evento en la misma transacción, con lo que permite la D-AUD y nada de lo que prohíbe: ni `client_id`, ni Shipping Mark, nombre, teléfono, texto o id de la conversación. Abrir desde el portal va con `system`, `actor_id` nulo y `rpc`; el barrido, con `system` y `job`; resolver, con el usuario del equipo y `studio`, y con `system` si ese usuario no es miembro activo del tenant.
14. El catálogo de `crm_tickets` no tiene columnas con datos personales.
15. Purgar la ficha borra hilo y tickets; solo queda el evento de auditoría.
16. Con `crm_alta_tarjeta_web` redefinida, el contrato de la 0513 pasa igual. La pieza única cubre también el camino del cotizador sin ficha: una ficha para el teléfono, ninguna (tarjeta sin ficha existente o nueva) y más de una (`ambigua`, sin tocar nada).
17. Barrido: abre el ticket que falta y marca la primera respuesta que falta; una segunda corrida no hace nada; dos a la vez no duplican; un hilo resuelto o de otro canal no se toca; devuelve los dos números.
18. Control rojo (sin la migración, cae en la primera aserción), reaplicación y preflight que abortan, y un mutante por regla. Como mínimo: sin el filtro de canal, sin el índice de un abierto, sin el bloque de E10-D24, sin el `for update`, sin el cierre al archivar, primera respuesta que se pisa, sin el `check` de cierre, grant de escritura a `authenticated`, política sin `crm_puede_usar()`, auditoría con el `auth.uid()` del cliente como actor, «Perdido» sin mirar el segmento y barrido que abre un ticket que ya existía.

**TypeScript (Vitest):**

- `crm-tickets.test.ts`: «vencido» en el borde de las 23:59 y las 00:00 de Caracas (UTC−4), estados y texto de la insignia. El archivo no calcula «sin atender»: eso es de la `crm_sin_atender` de la 6.6.
- `crm-tickets-barrido.test.ts`: con números en cero no hay aviso; con números mayores, un aviso que no lleva nombre, Shipping Mark, teléfono ni ids de fichas; un error de la base no lanza y queda en el log solo con su código.
- `chatwoot-reintentos/__tests__/route.test.ts`: el cron llama al barrido y su resultado sale en la respuesta, sin cambiar lo que ya hacía.
- `crm-tablero-queries.test.ts`: lee solo tickets abiertos y solo de las fichas de las tarjetas visibles; nunca pide `body` ni `author_name`; sin la tabla, degrada con el aviso de migración.
- `crm-tablero.test.ts`: la tarjeta lleva su ticket al tablero que le toca.
- `CrmTableroKanban.test.tsx`: la insignia se lee como texto y tiene nombre accesible.
- `TarjetaFichaDrawer.test.tsx`: la sección con los tickets, el enlace a `?c=<id>`, el vacío y el error.
- `tarjeta-actions-gate.test.ts`: los tickets llegan solo con el módulo y el rol, y sin texto de mensajes.
- Mutantes a mano: sin el filtro `cerrado_at is null`, barrido que no avisa y sin el candado de rol.
- **El portal sin cambios:** `git diff --stat main -- app/portal lib/portal components` vacío, y las pruebas del portal (`app/portal/reintento-no-duplica.test.ts`, `conservar-lo-escrito.test.tsx` y `la-accion-lanza.test.tsx`) pasan sin tocarlas.

**Cierre:** `pnpm verify` completo, con Docker para `sql-tests`; `pnpm docs:check`, `pnpm sdd:check`, el gate de símbolos pendientes y `/ui-check` de la insignia y la sección. Después, en el entorno de prueba, con la migración aplicada ahí y el OK de Sam, desde una cuenta de prueba del portal: escribir, ver la tarjeta con su ticket, responder, resolver y volver a escribir.

### 10.5.12 Criterios de aceptación

- [ ] Un mensaje del cliente en el chat de Soporte abre un ticket si el hilo no tiene uno abierto; los demás mensajes van al mismo; «Resuelto» lo cierra y el siguiente mensaje abre otro.
- [ ] El ticket aparece en la tarjeta del embudo que marca el segmento en ese momento (Clientes o Leads) y la sigue si cambia de embudo.
- [ ] Si la ficha no tenía tarjeta, se crea con fuente «portal» en «Registrado / recontacto»; si estaba en «Perdido» y es lead, vuelve con tarea; si es cliente, no se le crea tarea.
- [ ] El asesor ve en el tablero si hay un ticket abierto y si está sin responder o vencido (E10-D23), y desde la ficha llega al hilo en Conversaciones con un clic. Las fechas del ticket son las que usa la señal 2 de «sin atender» de la 6.6.
- [ ] La primera respuesta queda registrada una sola vez por ticket.
- [ ] Un fallo del CRM nunca impide guardar el mensaje del cliente ni la respuesta del equipo, y no pasa en silencio: el barrido recupera lo que faltó y avisa con solo los números.
- [ ] Solo `admin` y `commercial` del tenant leen los tickets; el cliente y los demás roles no; nadie los escribe desde la API.
- [ ] Abrir, resolver y archivar dejan su evento de auditoría según la D-AUD: sin datos personales ni `client_id`, y con actor `system` cuando lo dispara el cliente.
- [ ] Una sola pieza «ubicar o crear la tarjeta» sirve al alta web, al portal y al cotizador, y el contrato de la 0513 pasa igual.
- [ ] Ninguna tabla nueva guarda texto, nombre, teléfono ni correo, y purgar la ficha borra sus tickets.
- [ ] El portal no cambia (`git diff --stat` vacío en `app/portal`, `lib/portal` y `components`).
- [ ] Contrato SQL con control rojo, mutantes, reaplicación y preflight; pruebas de TypeScript; `pnpm verify`; `/ui-check`.
- [ ] Migración aplicada: **no** en esta etapa. Con OK nominal de Sam y el runbook, primero en prueba.
- [ ] Aceptación de Sam de la fila 10.5.

### 10.5.13 Lo que queda fuera

- Los reclamos como tickets (**P1**), responder el chat del portal desde Chatwoot (**P2**), mostrarle al cliente el número de ticket (**P3**) y cargar tickets hacia atrás (**P4**).
- Abrir Soporte a quien no ha verificado su identidad: hoy lo cierra SDD-0169 y aquí no cambia.
- Responder dentro de la ficha de la tarjeta, sin pasar a Conversaciones: mejora posterior.
- Avisos nuevos, salvo el del barrido, que solo lleva números (E10-D31). El de Telegram de SDD-0148 sigue igual y lo revisa el Director General con el Subdirector de SEO (§10.5.16).
- Fusionar dos tarjetas de la misma persona (SDD-0587 §16.5) y auditar la creación de tarjetas (6.6).
- 10.4, 10.6, E7, E8 y Meta.
- Escribir o aplicar la migración, tocar producción y fusionar.

### 10.5.14 Pendientes de Sam (10.5)

No se le preguntó nada. Quedan aquí para que el Director las lleve.

| # | Pregunta | Recomendación |
|---|---|---|
| P1 | «En el portal, ¿los "canales" son el chat de Soporte con tu asesor? ¿Los reclamos de "Tus casos" también entran al CRM como tickets?» | Sí al chat. Los reclamos no, por ahora: ya tienen número, estado y su módulo, los atiende operaciones y no son comerciales |
| P2 | «¿El chat del portal se sigue respondiendo desde Studio (Conversaciones) o lo quieres en Chatwoot, junto con WhatsApp?» | Desde Studio, por ahora (E10-D26) |
| P3 | «¿El cliente ve en el portal el número de su ticket?» | No en 10.5: el portal no cambia, y «Tus casos» ya usa los números `RC-` |
| P4 | «Las conversaciones abiertas antes de publicar, ¿se cargan como tickets?» | No: el próximo mensaje abre el ticket |
| P5 | «El portal promete "Te responde en el día". ¿Un mensaje del sábado o del domingo vence ese mismo día o el lunes?» | Que venza ese día, como dice el portal. Si debe ser día hábil, hay que cambiar también el texto del portal. Es la regla del «vencido» de la 10.5 (E10-D23); el umbral de «sin atender» es otra pregunta, de la 6.6 (D-6.6-5) |
| P6 | «En /privacidad, ¿sumamos al Portal "y el seguimiento de tus consultas por el chat de Soporte"?» | Aprobarlo antes de publicar 10.5. **Va después de la #399**, que ya trae el texto aprobado de la mensajería interna y toca el mismo archivo: el texto final se escribe sobre `/privacidad` con la #399 integrada |

**Decisiones del Director General** (2026-11-06, sobre `89fb586cf`, comunicadas por el Subdirector de Chatwoot):

| # | Decisión |
|---|---|
| D-1 | Redefinir, como **una sola pieza para los tres usos**: el alta web de la 0513, la 10.5 y el «ubicar o crear» del cotizador de la 6.6 (#401, SDD-0614). Se parte de la última definición de la función y su contrato se vuelve a correr; antes de reescribirla, se busca su última `create or replace` en todas las migraciones (E10-D30) |
| Número | **Se asigna al arrancar el código.** Ni la 10.5 ni la 6.6 reservan la 0518 (§10.5.6) |
| Reestimación | **Aceptada**, de 1,25 a 2 días. Va a Sam junto con la de la 6.6 (§10.5.15) |
| Orden | **Primero la 10.5 y después la 6.6, en serie** (§10.5.17) |

### 10.5.15 Reestimación (I)

El checklist le da 1,25 días. Con la migración, dos triggers, el barrido, la pieza única para los tres usos, el contrato con mutantes y la parte visual, este diseño estima **2 días**. **El Director General la aceptó el 2026-11-06** y se la lleva a Sam junto con la de la 6.6. El checklist no se cambia hasta que Sam la apruebe.

### 10.5.16 Fuera de alcance detectado (se informa, no se toca)

- **Telegram recibe el nombre y texto del cliente:** `notifyConversationInbound` manda a Telegram el nombre del cliente, su Shipping Mark y un extracto de hasta 140 caracteres del mensaje del portal (`lib/studio/conversation-inbound-notify.ts:103-112`). El texto de `/privacidad` ya aprobado en la #399 dice que la mensajería interna del equipo recibe avisos «sin tu nombre ni tus datos de contacto». Viene de SDD-0148 y se cruza con los avisos a Discord. **Lo lleva el Director General al Subdirector de SEO**; 10.5 no lo toca ni lo amplía.
- **La RLS de `conversations` no mira el rol:** «conversations by tenant» (0106:128) deja que cualquier usuario del tenant cambie el estado de un hilo llamando directo a la API; solo la acción lo frena con `moduleEditDenial`. Es lo mismo que la SDD-0497 anotó para los mensajes (`conversaciones/actions.ts:77-89`). Con 10.5, ese cambio de estado también cierra el ticket, que guarda quién lo cerró.

### 10.5.17 Coordinación con la 6.6 (PR #401, SDD-0614)

- **Orden:** primero la 10.5 y después la 6.6, en serie (Director General, 2026-11-06). Las dos tocan `TarjetaFichaDrawer.tsx`, `CrmTableroKanban.tsx`, `tarjeta-actions.ts`, `crm-ficha.ts` y las declaraciones de migraciones pendientes (`supabase/migrations-baseline.json` y `supabase/pending-migration-symbol-declarations.json`). La 6.6 arranca sobre `main` con la 10.5 integrada y mide el cruce con `git merge-tree` antes de publicar.
- **Lo que la 10.5 crea y la 6.6 usa, sin redefinirlo:** la pieza única `crm_tarjeta_ubicar_o_crear` (E10-D30), incluido el camino por teléfono que pide el cotizador (SDD-0614 §2.3). Si la 6.6 necesita otro parámetro, lo agrega redefiniendo desde la última definición, no con una pieza nueva. **La SDD-0614 §2.8 la llama `crm_tarjeta_de_ficha`**, el nombre de la primera versión de este diseño; el vigente es `crm_tarjeta_ubicar_o_crear`, porque también cubre el camino por teléfono. Falta alinear ese nombre en la 0614.
- **Lo que fija la 6.6 una sola vez y la 10.5 cita:** la D-SA («sin atender») y la D-AUD (qué lleva la auditoría del CRM), cerradas en la SDD-0614 §2.8, rama `claude/wizardly-hopper-d89dac` (PR #401), cabeza `17dc41cfc`. Si cambian, cambian allá y esta copia se actualiza igual. Lo que tomaron de la 10.5: la señal 2 de la D-SA usa las fechas del ticket (E10-D23) y los eventos `crm_ticket_*` siguen la D-AUD (E10-D27). El «vencido» del ticket sigue siendo de la 10.5.
- **Auditoría de la tarjeta:** el trigger de `crm_tarjetas` de la 6.6 (SDD-0614 §2.7 d) cubre también las tarjetas que crea el portal. Hasta que llegue, es la no conformidad pendiente de §10.5.9.

**Cita literal de la SDD-0614 §2.8 en `17dc41cfc`** (no es otra versión: manda la de la 0614):

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
