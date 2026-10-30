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

## Contexto

- DTD tendrá dos números de WhatsApp: el nuevo, de leads, conectado a Chatwoot, y el actual, solo para clientes (línea base v2 de 0582).
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
| E10-D8 | **Una respuesta automática por conversación cada 24 h**, con reserva en `chatwoot_respuestas_bot`: reservar → enviar → confirmar. Rechazo de Chatwoot (`http_*`) libera la reserva y lanza; resultado incierto (red o tiempo agotado) la deja y no repite. Una reserva sin confirmar vence a los 10 min | Un cliente que manda 5 mensajes no recibe 5 redirecciones. Ante la duda se prefiere no responder dos veces: la persona igual queda etiquetada y en su equipo para un humano |
| E10-D9 | **El reproceso lee de Chatwoot** la bandeja, el teléfono, las etiquetas y el equipo (`GET /conversations/{id}`), porque el evento de 2.3 no los guardó a propósito | Reutiliza `reprocesarEventosChatwoot` sin tocar la 0504 ni guardar teléfonos |
| E10-D10 | **Etiquetas `cliente`, `lead-registrado`, `lead-nuevo`**: se reemplaza solo la de segmento y se conservan las demás (el `POST /labels` de Chatwoot reemplaza la lista entera). Equipos por id en configuración | — |
| E10-D11 | **Textos sin IA, en 1 mensaje, con el enlace `wa.me/<número de clientes>?text=…`**. El número va en `WHATSAPP_NUMERO_CLIENTES`, no en el código. **Ninguno afirma que la persona es cliente** | El cruce por `phone_last10` no mira el código de país: un +1 412… y un +58 412… con los mismos 7 dígitos coinciden (revisión de datos, H-1) |
| E10-D12 | **Sin teléfono (usuario con username, 10.3):** no se consulta el ERP; segmento `lead_nuevo`; respuesta neutra **igual para todos** («si ya eres cliente, escríbenos aquí»); se guarda el BSUID si vino | No revela si un número, un código o una persona existen (0582, «Redirección sin IA»). Prueba: «la respuesta neutra es la misma para cualquiera» |
| E10-D13 | **BSUID = `contact_inbox.source_id`** cuando el contacto no trae `phone_number` y el id no es solo dígitos (eso sería un `wa_id`, o sea un teléfono). Forma `^[A-Za-z0-9._:-]{1,128}$`, igual en TS y en el `check` de la tabla | Que Chatwoot 4.19.1 ponga el BSUID ahí es **NV**: se comprueba en 10.6. Si no viene, se responde igual y no se guarda nada |
| E10-D14 | **Sin configuración no hace nada:** falta `CHATWOOT_ROUTER_TOKEN`, la bandeja, un equipo o el número → el manejador sale sin tocar nada y E2 sigue igual. Las variables se cargan **después** de aplicar la 0505 | Si se cargaran antes, la RPC fallaría, el evento quedaría fallido y se descartaría al quinto intento sin dañar nada |

## Lo que se entrega

| Paso | Pieza | Archivo |
|---|---|---|
| 10.1 | Función de segmento, reserva de respuestas y tabla de BSUID (0505, **NO APLICADA**, declarada en `migrations-baseline.json`) | `supabase/migrations/0505_chatwoot_segmento.sql` |
| 10.1 | Contrato SQL y envoltorio PGlite: 46 aserciones, control rojo, 22 mutantes, reaplicación y preflight | `supabase/tests/0505_chatwoot_segmento.test.sql`, `lib/studio/__tests__/chatwoot-segmento.migration.test.ts` |
| 10.2 | Manejador, reglas puras y cliente HTTP de Chatwoot | `lib/studio/chatwoot/enrutar.ts`, `segmento.ts`, `router-api.ts`; registro en `webhook-procesar.ts`; campos opcionales en `webhook-events.ts` |
| 10.2 | Configuración | `lib/studio/chatwoot/config.ts` (`chatwootRouterConfig`), `.env.example` |
| 10.3 | BSUID y respuesta neutra | los mismos archivos |

## Variables nuevas del servidor de Studio

`CHATWOOT_ROUTER_TOKEN` (secreto), `CHATWOOT_INBOX_LEADS_ID`, `CHATWOOT_TEAM_CLIENTES_ID`, `CHATWOOT_TEAM_LEADS_ID`, `WHATSAPP_NUMERO_CLIENTES`. Las crea E3/infra con OK de Sam, después de aplicar la 0505. En Chatwoot hacen falta además las tres etiquetas, los dos equipos y un usuario de servicio con acceso a la bandeja de leads (su token es `CHATWOOT_ROUTER_TOKEN`). **Qué tipo de token acepta Chatwoot 4.19.1 para etiquetar, asignar equipo y responder (agente o bot) es NV**: se comprueba en 10.6.

## Criterios de aceptación

- [x] 10.1: la función devuelve el segmento correcto en los casos: cliente por envío, cliente solo por recibo en China, registrado, nuevo, ambiguo, código histórico, código de ficha fusionada (uno y dos saltos), borrador, cancelado, envío borrado, recibo borrado, incidencia, huérfano, ficha borrada, otro tenant, teléfono inválido y quien pierde su único envío (contrato 0505).
- [x] 10.1: sin datos personales en la salida y solo `service_role` (contrato, «acceso y datos»).
- [x] 10.1: cada regla tiene un mutante que muere (22), más control rojo, reaplicación y preflight.
- [x] 10.2: al cliente, 1 mensaje sin IA con el enlace `wa.me` al número de configuración; etiqueta y equipo; una vez cada 24 h; los fallos dejan el evento fallido y el reproceso de 2.3 los retoma (`enrutar.test.ts`, 9 mutantes del manejador mueren).
- [x] 10.3: respuesta neutra idéntica para cualquiera sin teléfono y se guarda el BSUID (`enrutar.test.ts`, contrato 0505 §3).
- [x] Logs sin teléfono, BSUID, número ni token (prueba «los avisos de error no llevan…»).
- [ ] `pnpm verify` y sql-tests con Docker: **NO EJECUTADO** (corrida pesada; espera turno del Director).
- [ ] 0505 aplicada: **NO** (requiere OK nominal de Sam y el runbook).
- [ ] Punta a punta con el número de prueba y el BSUID real: **10.6**.

## Revisión de datos personales (revisar-datos-ve, acotada a este diff)

Inventario técnico, no asesoría legal. Marco: Venezuela (CRBV arts. 28 y 60; SC 332/2001). No hay tratamiento en China en este diff.

**Resumen:** 5 CORRECTO · 3 ENCONTRADO · 3 NO VERIFICABLE.

### Inventario

| Dato | Qué es | Finalidad | Retención | Quién lo ve |
|---|---|---|---|---|
| `phone_last10` (parámetro de `chatwoot_segmento_contacto`) | Últimos 10 dígitos del teléfono del contacto | Calcular el segmento | **No se guarda**: entra a la función y no se persiste (`0505_chatwoot_segmento.sql`, §1) | Nadie: no sale en logs |
| Segmento (salida) | `cliente` / `lead_registrado` / `lead_nuevo` | Etiqueta, equipo y redirección | Vive como etiqueta en Chatwoot (VPS propio) | Agentes de Chatwoot |
| `chatwoot_respuestas_bot` | Id de conversación, tipo de respuesta y dos fechas | No responder dos veces (costo de Meta) | **Sin purga** (H-3) | Solo `service_role` |
| `chatwoot_contactos_bsuid.bsuid` | ID de usuario de WhatsApp por portafolio (seudónimo de una persona) | Vincular después a una ficha a quien escribe sin teléfono | **Sin definir** (H-2) | Solo `service_role` |
| Texto de la respuesta del bot | Enlace `wa.me` al número de clientes | Redirigir | Lo guarda Chatwoot y lo transporta Meta | La persona, agentes, Meta |

### Hallazgos

- **H-1 · ENCONTRADO · corregido en esta tarea.** El cruce por `phone_last10` no distingue código de país (`0504_chatwoot_eventos.sql`, cruce; `0505`, §1): un número extranjero puede coincidir con el de un cliente venezolano y recibir la redirección. La primera versión del texto decía «Como ya eres cliente», lo que revelaba a un tercero que ese número está asociado a un cliente (CRBV art. 60, confidencialidad). **Arreglo aplicado:** el texto ya no afirma la condición de cliente (`lib/studio/chatwoot/segmento.ts`, `respuestaPara`) y una prueba lo fija. **Pendiente (fuera de E10):** cruzar también por código de país exige normalizar `clients.phone` a E.164, que hoy se guarda en formatos mixtos (fixture de la 0504); es decisión del dueño del cruce (0383/0504).
- **H-2 · ENCONTRADO · decisión de Sam.** `chatwoot_contactos_bsuid` no tiene plazo de conservación. SC 332/2001 exige temporalidad. **Propuesta:** borrar la fila a los 180 días sin actividad (`ultima_vez_at`) si no se vinculó a una ficha, con un cron como `chatwoot-reintentos`. No se implementa sin la decisión.
- **H-3 · ENCONTRADO · menor.** `chatwoot_respuestas_bot` crece sin purga. No guarda datos personales directos (id de conversación y fechas), pero el id apunta a una conversación de Chatwoot. **Propuesta:** borrar filas con más de 30 días en el mismo cron.
- **CORRECTO:** la salida de la función es un texto sin ids ni códigos (contrato «el segmento es un solo texto…»); las tablas nuevas no tienen columnas de teléfono, texto, nombre, correo ni código (contrato); un BSUID de solo dígitos (un teléfono) se rechaza en la base y en TS; los logs del manejador solo llevan códigos de error (`enrutar.ts`; prueba de logs); los fixtures son sintéticos (555, `VE.555…`).

### No verificable

- **NV-1.** Si la política de privacidad pública informa que el ERP clasifica a quien escribe y lo redirige (CRBV art. 28, «conocer el uso y su finalidad»). Es una decisión automática con efecto menor (un mensaje y una etiqueta; un humano sigue atendiendo). La regla está versionada en la 0505.
- **NV-2.** Que Chatwoot 4.19.1 entregue el BSUID en `contact_inbox.source_id` (10.6).
- **NV-3.** El mapa de borrado de una persona: al purgar un cliente o atender una solicitud de destrucción (CRBV art. 28) hay que incluir `chatwoot_contactos_bsuid`, `chatwoot_respuestas_bot` y la conversación en Chatwoot. No hay camino de borrado desde Studio para estas tablas (solo `service_role`).

**Fuera de alcance:** redacción de la política y base de licitud para tratar el BSUID; eso es de un abogado.

## Pendientes de esta SDD

- 10.4, 10.5 y 10.6 (ver checklist).
- `pnpm verify` y sql-tests con Docker con turno del Director.
- Decisión de Sam sobre la retención del BSUID (H-2) y la purga de `chatwoot_respuestas_bot` (H-3).
- Número de migración: se usó **0505**, el siguiente libre según `pnpm sdd:next` del 2026-10-30; se pidió confirmación al Director.
