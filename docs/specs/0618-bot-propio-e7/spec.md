---
sdd: "0618"
title: "dtd-bot: el bot propio de Chatwoot, apagado de nacimiento (E7 del programa SDD-0582, pasos 7.3 a 7.11)"
status: draft
author: "Claude Worker «E7 bot» (Sam)"
created: 2026-11-08
updated: 2026-11-08
supersedes: null
superseded_by: null
related: ["0582", "0585", "0586", "0587", "0588", "0590", "0062"]
confidencialidad: interno
---

# SDD-0618 — `dtd-bot`, el bot propio (E7)

> **Todo nace apagado.** Esta SDD diseña la etapa E7 del programa [SDD-0582](../0582-chatwoot-piloto/spec.md) y la parte en PR chicas. Ninguna PR de esta SDD enciende el bot, llama a un modelo pagado ni escribe en Kommo, en Meta o en el Chatwoot vivo. Lo que pide un OK nominal de Sam está en §9.

Programa: [SDD-0582](../0582-chatwoot-piloto/spec.md) · checklist: [filas 7.1 a 7.11](../0582-chatwoot-piloto/checklist.md) · decisión F del programa · IA-01: [política](../../governance/policies/ia-01.md) · kit de Basdonax y frenos: [análisis v3](../0582-chatwoot-piloto/spec.md#qué-adoptamos-del-kit-y-qué-no).

**Etiquetas de evidencia** (las del programa): **C** código leído en esta tarea, **D** documento o proveedor, **T** medido en la cuenta o el VPS, **R** probado en runtime, **I** inferencia, **NV** no verificado. Base: `main` `3c14715ad`.

## 1. Qué pidió Sam y qué está decidido

| Decisión | Fuente | Etiqueta |
|---|---|---|
| «bot propio contestando solo», gastando lo menos posible; un botón de encendido y apagado y la «respuesta sugerida por la IA», que la persona copia o ignora | SDD-0582, respuestas 4 y 8 | Decisión |
| El bot arranca en **Sugerir**. «Contesta solo» exige la excepción IA-01 acotada (7.2) | SDD-0582, Gobernanza | Decisión |
| Responde en **1 mensaje** por turno | 0.8, S08-3 (2026-10-30) | Decisión |
| Frenos con estado durable, «resolver» calla al bot, «solo el primer mensaje» y **falla cerrada** | v3, P2 y P3 | Decisión |
| «Analiza mi contestación» vive en la IA de Kommo y se respalda en 7.3 | E0-D4 | Decisión; ubicación **NV** (K-15: ninguna función se llama así) |
| Kommo tiene 3 fuentes de texto que viven solo allá: Datos clave, Productos y servicios, Descripción del negocio | K-6, K-16; `docs/runbooks/kommo-reconfig.md:79-83` | T (2026-10-29), NV hoy |

### 1.1 Dos contradicciones que tiene que cerrar Sam (no las cierra esta SDD)

1. **Proveedor.** La decisión F dice «Gemini de pago y GLM por API de respaldo». La fila 3.4 registra, el 2026-10-30, «Solo GLM» y que «E7 usa el mismo proveedor y el mismo tope». Esta SDD **no elige**: el motor es una interfaz con un doble, y el proveedor real sale de 7.5 con OK de Sam.
2. **Tope de gasto.** E0-D3 dice **US$25 al mes** para el bot; la fila 3.4 dice **US$50 al mes** compartidos con el análisis de versiones. El tope es configurable y, mientras Sam no decida, el código usa el **menor (US$25)**: con la duda, falla cerrada.

## 2. Dónde vive `dtd-bot` (decisión de diseño)

**Dentro del Studio, en dos piezas, sin un servicio nuevo con datos propios.** **I**, sobre **C** de lo que ya existe:

1. **Entrada: un manejador más del webhook.** `app/api/chatwoot/webhook/route.ts` ya verifica la firma, registra el evento con idempotencia (0504) y corre `MANEJADORES` antes de responder (`lib/studio/chatwoot/webhook-procesar.ts:136`). `encolarTurnoBot` se suma a esa lista y escribe el **turno** en la base **antes del 2xx**. Si la escritura falla, el evento queda «fallido» y lo reintenta el cron `chatwoot-reintentos` (E2-D26). Así la cola es durable sin inventar otro camino.
2. **Proceso: un trabajador `dtd-bot` en el VPS.** El cron de Vercel corre cada 5 minutos (`vercel.json:82`), y juntar ráfagas pide segundos (8 s de inactividad, 24 s como máximo). Por eso el turno lo atiende un proceso largo, con la misma imagen del Studio y otro punto de entrada (`node scripts/dtd-bot.mjs`, sin puerto), que sondea la cola cada 2 s. **Nace sin desplegar**: instalarlo en el VPS es una puerta aparte (§9).
3. **Watchdog: el cron que ya existe.** `chatwoot-reintentos` revisa el latido del trabajador y los turnos vencidos. Si el trabajador no late hace más de 2 minutos, o un turno pasó su plazo sin cerrarse, el turno pasa a humano con aviso en el Studio. Nunca se envía tarde.

**Bandejas donde nunca habla.** El bot solo actúa en las bandejas donde Sam lo encienda (fila en `chatwoot_bot_bandejas` con un modo distinto de Apagado). Quedan excluidas, aunque alguien les ponga un modo:

- la bandeja del **portal** (SDD-0586): la base corta por conversación, porque `chatwoot_bot_encolar` no crea turno en un hilo de `chatwoot_portal_hilos` (0519), y el código la descarta antes por `CHATWOOT_INBOX_PORTAL_ID`;
- la bandeja de **Instagram** y el **Archivo Kommo** (SDD-0590), **desde el arranque**: ninguna tabla dice cuál es cuál y sus ids cambian según el entorno (en prueba el portal es la bandeja 9 de la cuenta 2; en producción el Archivo es la 8), así que llegan **por variable de entorno, como el portal**: `CHATWOOT_INBOX_INSTAGRAM_ID` y `CHATWOOT_INBOX_ARCHIVO_ID`, leídas en `lib/studio/chatwoot/config.ts` junto a `CHATWOOT_INBOX_PORTAL_ID`. La migración no siembra números: quedaría atada a un entorno y en el otro se equivocaría sin avisar. Encender el bot en Instagram es una puerta aparte (§9).
- `chatwoot_bot_bandejas_excluidas` queda como **lista extra** que llena un admin: una bandeja excluida no se puede encender y no encola.

**Falla cerrada de la exclusión:** si falta o es inválida cualquiera de las tres variables (`CHATWOOT_INBOX_PORTAL_ID`, `CHATWOOT_INBOX_INSTAGRAM_ID`, `CHATWOOT_INBOX_ARCHIVO_ID`), o si la lista de excluidas no se puede leer, **el bot no encola nada** en ninguna bandeja. Una línea `X=` vacía cuenta como faltante: llega como texto vacío, no como ausente.

Regla pedida por el Subdirector de Chatwoot y por el DG el 2026-11-08.

**Cruce con E10.** El webhook de la 0504 es el mismo que usa el portal (E10), cuyas piezas tocan `router-api.ts`, `portal-manejadores.ts` y la ruta. Por eso el manejador vive en un módulo propio (`lib/studio/chatwoot/bot/`) y su registro en `MANEJADORES` es una o dos líneas. Antes de abrir la PR que lo registra (E, §7) se mide con `git merge-tree` contra las ramas abiertas de E10 y se le avisa al Subdirector qué archivos se comparten; si hay choque, se serializa con E10.

**El texto de los mensajes no se guarda.** La cola guarda ids, fechas y estado. El trabajador lee la conversación de la API de Chatwoot al generar, con el token de servicio, y no la copia a la base ni a los logs (v3 rechaza los 200 caracteres del kit). **I** sobre revisar-datos-ve.

## 3. Ciclo de un turno

```
mensaje entrante (webhook) ── filtro de autor ──► encolarTurnoBot ──► turno «pendiente»
                                                     (antes del 2xx)       listo_desde = último + 8 s
                                                                          límite = primero + 24 s
dtd-bot (cada 2 s) ── toma con lease (SKIP LOCKED) ──► «tomado»
   ├─ comprobación previa #1 (modo, horario, frenos, presupuesto)  ── falla ─► «humano» + aviso
   ├─ lee la conversación de Chatwoot, recorta la entrada a 2.000
   ├─ motor (doble en pruebas) ─► costo anotado por llamada
   ├─ reglas duras sobre la salida, recorte a 4.096 ── falla ─► «humano» + aviso
   ├─ comprobación previa #2, justo antes de enviar:
   │     modo releído, ¿escribió una persona?, ¿se resolvió?, ¿llegó otro mensaje?, presupuesto
   └─ según el modo: Sugerir → nota privada (7.8) · Contesta solo → 1 mensaje · Apagado → nada
```

### 3.1 Estados del turno

`pendiente` → `tomado` → uno de: `sugerido`, `enviado`, `humano` (pase a humano, con motivo), `cancelado` (lo invalidó una persona, un «resolver» o un modo Apagado). No hay un estado «descartado»: lo que vence pasa a `humano` con su motivo, `lease_vencido` (el trabajador lo tomó y no cerró a tiempo) o `sin_trabajador` (nadie lo tomó antes del límite más la gracia), como hace `chatwoot_bot_vigilar` en la 0522. Un solo turno abierto por conversación (índice único parcial). Un mensaje nuevo del cliente **extiende** el turno abierto (`listo_desde`), sin pasar del límite de 24 s.

### 3.2 Falla cerrada (regla)

Ante cualquier duda, `dtd-bot` **no envía** y pasa a humano con aviso en el Studio: el modo no se pudo leer, Chatwoot no respondió, el motor tardó más de su timeout o respondió algo inválido, una regla dura falló, el presupuesto no se pudo sumar, el lease venció o el formato del mensaje no es texto (foto, audio, PDF o desconocido, hasta que 7.5 apruebe un proveedor). Es lo contrario del kit, que contesta igual si no logra consultar a Chatwoot (v3, V3-6).

### 3.3 Frenos con estado durable (7.6)

| Freno | Valor por defecto | Dónde vive el estado |
|---|---|---|
| Juntar ráfagas | 8 s de inactividad, 24 s como máximo (configurable) | `listo_desde` y `limite_at` del turno |
| Tope por conversación | N respuestas del bot en 24 h (por defecto 6), después humano | conteo de turnos `enviado`/`sugerido` de la conversación |
| Recorte de entrada | 2.000 caracteres | función pura, antes del motor |
| Recorte de salida | 4.096 caracteres | función pura, antes de la regla dura |
| Presupuesto | US$25 al mes (§1.1), corte duro | suma de `chatwoot_bot_llamadas.costo_usd` del mes |
| 1 mensaje por turno | fijo (0.8) | el turno se cierra al primer envío |

Todo sobrevive un reinicio: el estado está en la base, no en memoria (7.9 lo prueba reiniciando a mitad de camino).

### 3.4 Filtro de autor y dirección

Solo abre o extiende un turno un mensaje **entrante** (`message_type` 0), **no privado**, de un **contacto**, en una bandeja con modo distinto de Apagado. Nunca lo abren un saliente, una nota privada, un mensaje de un agente, del propio bot ni de actividad: así no hay bucles (el eco de un saliente también crea evento: memoria «evento de Chatwoot no prueba un entrante»). **Invalidación:** un saliente de una persona en esa conversación cancela el turno abierto; un `conversation_status_changed` a `resolved` también, y con «resolver calla al bot» la conversación queda callada hasta que el cliente la reabra.

### 3.5 Reglas duras (7.4)

Las reglas duras **no** son instrucciones al modelo: son comprobaciones deterministas sobre la salida, en código, que bloquean el envío. Primer juego, sacado de la base v7 y de los runbooks de Kommo (**C**):

Sobre la **salida** del motor (`comprobarSalida`; si una falla, la respuesta no sale y el turno pasa a humano):

| Regla | Qué bloquea | Fuente |
|---|---|---|
| `direccion_completa` | la dirección completa de recepción (detalle de cargo, código postal, contacto de bodega); la de referencia de la #4 sí sale | FAQ #4 y #28; `kommo-reconfig.md:73-76` |
| `termino_retirado` | «DDP» como nombre, «Financiamiento 100 %», «prepago», «opera desde 2008», «fundada en 2008/2010» | FAQ «Cambio 2026-08-03» |
| `anos_fijos` | un total fijo de años de experiencia | `kommo-reconfig.md:378` |
| `monto` | **cualquier** cifra con moneda: el bot no cotiza; los números salen de la calculadora | FAQ #2, notas internas |
| `estado_de_carga` | afirmar dónde está una carga o cuándo llega | SDD-0579 (seguimiento en construcción) |
| `pide_dato_sensible` | pedir cédula, RIF, pasaporte, contraseña, tarjeta o datos bancarios por chat | revisar-datos-ve |
| `documento_de_identidad` | repetir un número de cédula o RIF | revisar-datos-ve |
| `enlace_no_permitido` | dominios o correos fuera de `dtdcargo.com`, `wa.me`, `api.whatsapp.com` y las redes de DTD | FAQ #12 y #20 |
| `telefono_no_permitido` | cualquier teléfono que no sea de DTD (`CONTACT` de `lib/design-tokens.ts`) | revisar-datos-ve |

Sobre la **entrada** del cliente (`disparadoresDeEntrada`; pasa a humano sin llamar al motor): pedir una persona, y cambiar el destinatario del envío por chat (`agentes-ia-configuracion.md:85-99`, el hallazgo del Reenganche). Las réplicas (FAQ 25-bis) quedan en la base, no en una regla dura: no hay forma determinista de reconocerlas en la salida.

**Contrato:** las 34 fichas aprobadas de la v7 pasan las reglas (no son más estrictas que lo que Sam aprobó), y cada regla tiene casos rojos inventados.

La base canónica va en el repo **solo** si no trae PII ni datos de clientes (§5).

## 4. Modos (7.7) y respuesta sugerida (7.8)

- **Por bandeja:** Apagado (por defecto) / Sugerir / Contesta solo, más horario, «resolver calla al bot» y «solo el primer mensaje». Se guardan en `chatwoot_bot_bandejas`.
- **Contesta solo** no se puede elegir mientras la excepción IA-01 (7.2) no esté aprobada: la base lo rechaza con un **trigger** sobre `chatwoot_bot_bandejas` que busca una excepción vigente en `chatwoot_bot_excepciones` (un `CHECK` no puede consultar otra tabla); revocar o borrar la excepción baja la bandeja a Sugerir, y la acción del Studio lo vuelve a comprobar.
  - **Dos escrituras a la vez** (revisión del DG de la #459): la guarda lee la excepción con `for share`. En READ COMMITTED hay dos órdenes y los dos terminan sin «Contesta solo» huérfano: (1) si otra transacción revoca, borra o le saca la bandeja a la excepción primero, el `for share` del encendido espera, vuelve a evaluar el where sobre la fila nueva, no la encuentra y el encendido falla; (2) si el encendido llega primero, el update o el delete de la otra esperan a que confirme, y después su trigger recalcula y baja la bandeja a Sugerir. Medido con dos sesiones por dblink en `supabase/tests/0522_chatwoot_bot_carrera.test.sql`.
  - **Nadie tiene TRUNCATE** en las tablas del bot: se saltaría los triggers de fila. El postflight de la 0522 lo comprueba.
- **Sugerir** deja una **nota privada** en la conversación de Chatwoot y la muestra en la Ficha DTD con un botón Copiar (7.8). La persona la copia o la ignora; el bot nunca envía en ese modo.
- **Interruptor general:** flag `chatwoot_bot` (apagado por defecto, en `lib/studio/feature-flags-types.ts`). Con el flag apagado, `encolarTurnoBot` no escribe nada.

## 5. 7.3 y 7.4: el conocimiento

### 5.1 7.3 — respaldo de Kommo (solo lectura)

- **Qué:** las 3 fuentes de texto que viven solo en Kommo, las Pautas de los 4 agentes (si difieren de `docs/marketing/agentes-ia-configuracion.md`) y «analiza mi contestación».
- **Cómo:** Kommo no expone las fuentes de IA por la API pública (**NV**; los Salesbots tampoco, K-3). El camino es leerlas en la interfaz con la sesión de Sam, sin tocar ningún botón de edición, y guardarlas con `age -R age-recipients.txt` en `/srv/backups/kommo/conocimiento-<stamp>/`, con las mismas dos claves públicas de E5 (SDD-0590 §3.1). Fuera de Git; en el repo van solo la huella sha256 y los nombres.
- **Necesita a Sam:** dónde está «analiza mi contestación» (Sam lo ubica; K-15 no lo encontró) y su sesión de Kommo para leer. Sin eso, 7.3 queda en espera y se sigue con 7.4.

### 5.2 7.4 — base canónica con reglas duras

- **Fuentes en el repo, sin PII** (**C**): `docs/specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md` (33 secciones), los textos de los 4 agentes (`docs/marketing/agentes-ia-configuracion.md:263-666`) y el menú A–H de los Salesbots (`docs/runbooks/kommo-salesbots-inventario.md:63-82`).
- **Forma:** `lib/studio/chatwoot/bot/conocimiento/base.json` **se genera** con `scripts/bot-conocimiento.mjs` desde la v7 (una sola fuente; `--check` falla si quedó atrás). Toma las 33 secciones y la 25-bis de los bloques A a F: 34 fichas con id, grupo, título, preguntas, texto y fuente. Quita las notas internas y corta el «Paso 2» de la #28 (dirección completa con el teléfono y el nombre del contacto de bodega), que se cambia por «si insiste, pasa a una persona». `reglas-duras.ts` tiene las comprobaciones de §3.5.
- **Prueba de contrato:** el JSON está al día; cada ficha cita su fuente; ninguna trae notas internas, teléfonos que no sean de DTD, correos fuera de `dtdcargo.com` ni números de cédula o RIF.
- **Después:** los textos de los 4 agentes y el menú A–H entran como «pautas» del bot en la PR de 7.6 b, que es la que arma el prompt.
- **Las 3 fuentes de Kommo** entran después de 7.3, solo si su revisión con revisar-datos-ve da «sin PII».

## 6. Datos (migración 0522)

| Tabla | Qué guarda | Qué no guarda |
|---|---|---|
| `chatwoot_bot_bandejas` | tenant, `inbox_id`, modo (`apagado` por defecto), horario, opciones | texto |
| `chatwoot_bot_turnos` | tenant, `conversation_id`, `inbox_id`, estado, fechas (`primer_mensaje_at`, `listo_desde`, `limite_at`), `ultimo_mensaje_id`, `lease_hasta`, intentos, motivo | texto, nombre, teléfono |
| `chatwoot_bot_llamadas` | turno, proveedor, modelo, tokens de entrada y salida, costo en USD, resultado, duración | prompt, respuesta |
| `chatwoot_bot_latidos` | id del trabajador, último latido | — |

Además, `chatwoot_bot_excepciones` (la excepción IA-01, vacía al nacer) y `chatwoot_bot_bandejas_excluidas` (§2).

RPC con `security definer` y `search_path` fijo, solo `service_role`: `chatwoot_bot_encolar`, `chatwoot_bot_tomar` (`FOR UPDATE SKIP LOCKED`, con lease), `chatwoot_bot_cerrar`, `chatwoot_bot_invalidar`, `chatwoot_bot_vigilar`, `chatwoot_bot_latir`, `chatwoot_bot_anotar_llamada`, `chatwoot_bot_gasto_mes` y `chatwoot_bot_purgar`. RLS en las seis tablas; el admin del tenant lee. Contrato `.test.sql` en Postgres con Docker (paso «Contratos SQL» de Actions) y contrato `.test.ts` en PGlite. Purga: turnos cerrados y llamadas a los 90 días, en el cron de reintentos, como la 0508.

**Migrate-first:** la 0522 se aplica en prueba y en producción antes de fusionar su PR, desde la cabeza aprobada, con un OK nominal de Sam para cada una.

## 7. Plan de PR (cada una desde `main`, en borrador)

| # | Pieza | Filas | Toca | Migración | OK de Sam |
|---|---|---|---|---|---|
| A | Esta SDD, sin código | — | `docs/specs/0618-bot-propio-e7/spec.md`, índice | no | no |
| B | 7.3: guion de respaldo cifrado y su prueba | 7.3 | `infra/ops/kommo-conocimiento/` | no | **sesión de Kommo y ubicación de «analiza mi contestación»** |
| C | 7.4: base canónica y reglas duras, puras | 7.4 | `lib/studio/chatwoot/bot/conocimiento/**` | no | no |
| D | 7.6 a: núcleo puro (frenos, filtro de autor, comprobación previa, falla cerrada, costo, interfaz del motor con doble) | 7.6 | `lib/studio/chatwoot/bot/*.ts` y sus pruebas | no | no |
| E | 7.6 b: tablas, RPC, manejador `encolarTurnoBot`, trabajador y watchdog; flag `chatwoot_bot` apagado; PoC en Actions con Chatwoot efímero y datos inventados | 7.6, 7.9 | migración nueva, `webhook-procesar.ts` (lista de manejadores), cron de reintentos, `scripts/dtd-bot.mjs`, workflow nuevo | **sí** | aplicar la migración |
| F | 7.7: modos desde el Studio | 7.7 | página nueva en Administración › Chatwoot, acciones | quizás (si E no la cubre) | no (sin encender) |
| G | 7.8: nota privada y Copiar en la Ficha DTD | 7.8 | Dashboard App «Ficha DTD» | no | no (sin encender) |

Ramas al 2026-11-08: A en `claude/objective-bohr-fd58df`; C en `codex/e7-bot-conocimiento`; D en `codex/e7-bot-nucleo`. La migración de E es la **0522** (`0522_chatwoot_bot.sql`), asignada por el DG; la 0521 es de la 1c-2 de E10, que va primero.

E y F pasan por `/ui-check` si tienen pantalla.

### 7.1 Allowlist exacta

Cada PR toca solo estos archivos. Una pieza que necesite otro lo agrega aquí antes, en su propia PR.

| PR | Archivos |
|---|---|
| A (#447) | `docs/specs/0618-bot-propio-e7/spec.md`, `docs/specs/README.md` (índice generado), `.agents/handoffs/0618-bot-propio-e7.md` |
| C (#448) | `scripts/bot-conocimiento.mjs`, `lib/studio/chatwoot/bot/conocimiento/base.json`, `lib/studio/chatwoot/bot/conocimiento/reglas-duras.ts`, `lib/studio/chatwoot/bot/conocimiento/__tests__/base.test.ts`, `lib/studio/chatwoot/bot/conocimiento/__tests__/reglas-duras.test.ts` |
| D (#449) | `lib/studio/chatwoot/bot/autor.ts`, `lib/studio/chatwoot/bot/frenos.ts`, `lib/studio/chatwoot/bot/decidir.ts`, `lib/studio/chatwoot/bot/motor.ts` y sus cuatro pruebas en `lib/studio/chatwoot/bot/__tests__/` (`autor`, `frenos`, `decidir`, `motor`, `.test.ts`) |
| E1 (0522) | `supabase/migrations/0522_chatwoot_bot.sql`, `supabase/tests/0522_chatwoot_bot.test.sql`, `supabase/tests/0522_chatwoot_bot_carrera.test.sql`, `lib/studio/__tests__/chatwoot-bot.migration.test.ts`, `supabase/migrations-baseline.json` (solo la espera de la 0522), `.agents/handoffs/0618-bot-propio-e7.md`, `docs/specs/0618-bot-propio-e7/spec.md` (solo §3.1, §4 y esta fila, por la revisión del DG) |
| E2 (manejador, trabajador, watchdog, PoC) | se fija en esta tabla antes de abrirla; incluye una o dos líneas de `lib/studio/chatwoot/webhook-procesar.ts` (lista de manejadores) y de `lib/studio/chatwoot/config.ts` (las dos variables nuevas), con `merge-tree` contra E10 (§2) |

7.5, 7.10 y 7.11 no tienen PR hasta tener OK.

**Archivos que no toca:** los de E10 (`lib/studio/chatwoot/portal*`, `app/studio/(app)/conversaciones/**`, `app/api/studio/conversaciones/**`) y los del CRM (`TarjetaFichaDrawer`, `CrmTableroKanban`, `tarjeta-actions`, `crm-ficha`). La lista de `MANEJADORES` de `webhook-procesar.ts` es compartida: E la toca en una línea y se avisa al Subdirector antes.

## 8. Pruebas

- Unitarias de cada función pura (frenos, filtro de autor, comprobación previa, reglas duras, recortes y costo). En C y D se escribieron junto con el código y no se vieron en rojo antes de él: los mutantes hacen ese papel (§11). Desde las correcciones de la revisión del DG, cada arreglo lleva su prueba vista en rojo contra la cabeza anterior y su mutante.
- Mutantes sobre las guardas de falla cerrada: cada `return "humano"` y cada comparación del freno.
- Contrato de la 0522: el `.test.sql` corre en Postgres con Docker (paso «Contratos SQL» de `sql-tests.yml`) y el `.test.ts` en PGlite, con control rojo y mutantes.
- **Exclusión por variable (E2):** prueba en rojo primero de que, sin `CHATWOOT_INBOX_INSTAGRAM_ID`, sin `CHATWOOT_INBOX_ARCHIVO_ID`, sin `CHATWOOT_INBOX_PORTAL_ID`, con una de ellas vacía (`X=`) o no numérica, o con la lectura de `chatwoot_bot_bandejas_excluidas` fallando, `encolarTurnoBot` no llama a `chatwoot_bot_encolar`; y de que un mensaje en la bandeja de Instagram o del Archivo no encola aunque la bandeja tenga modo. Mutantes: quitar cada variable del chequeo, tratar `X=` como presente y seguir cuando la lectura de la lista falla; cada uno tiene que caer.
- PoC en GitHub Actions, copiando el patrón de `chatwoot-portal-poc.yml`: Chatwoot 4.19.1 efímero, bandeja API inventada, contacto inventado, motor doble. Demuestra entrada → turno → nota privada, invalidación por una persona y caída del trabajador a mitad del turno.
- 7.9 (inyección, cancelación, doble ejecución, fallback, apagar mientras genera, caída tras el acuse, nota propia que vuelve, reinicio con frenos a mitad y formato no admitido) se escribe sobre la PoC de E.
- **Nunca** una llamada a un modelo real en las pruebas.

## 9. Puertas que esta SDD no abre

Cada una con su OK nominal de Sam, que pide el Director General:

- **7.1:** cuentas de pago, retención y DPA del proveedor.
- **7.2:** la excepción IA-01 acotada (bandejas, tipos de respuesta, herramientas, datos, prohibiciones, tope, responsable, revocación y suspensión).
- **7.5:** la prueba de modelos con proveedores reales y cualquier llamada a un modelo pagado.
- Aplicar la 0522 en prueba y en producción antes de fusionar su PR, con un OK nominal de Sam para cada una (migrate-first, §6).
- Instalar el trabajador `dtd-bot` en el VPS.
- Encender el flag `chatwoot_bot` o poner una bandeja en Sugerir o Contesta solo.
- Sacar la bandeja de **Instagram** de la lista de excluidas: decisión aparte, con su propio OK.
- Leer Kommo con la sesión de Sam (7.3); escribir en Kommo, en Meta o en el Chatwoot vivo, nunca.
- 7.11 (modo sombra sobre tráfico real) espera 7 días en 8.1.

## 10. revisar-datos-ve (primer paso)

| Dato | Dónde | Medida |
|---|---|---|
| Texto de los mensajes | Chatwoot; viaja al motor | No se guarda en Studio; se recorta a 2.000; no va a logs; el proveedor necesita retención y DPA (7.1) |
| Nombre y teléfono del contacto | Chatwoot | No se manda al motor salvo que la regla lo pida; nunca se guarda en las tablas del bot |
| Números de documento que escribe el cliente | el mensaje entrante | Se **enmascaran** antes de mandar la entrada al motor (cédula, RIF y pasaporte → «[documento]»; teléfonos que no son de DTD → «[teléfono]»), en la PR E. Recomendación del DG, 2026-11-08 |
| Correo que pide la ficha 27 (lista de espera del aéreo) | la base v7 | Se revisa con revisar-datos-ve en la PR E: el bot no debería pedir el correo por chat sin finalidad y retención escritas |
| Costo y tokens | `chatwoot_bot_llamadas` | Sin contenido; purga a 90 días |
| Conocimiento de Kommo | respaldo `age` en el VPS | Fuera de Git; al repo solo con revisión «sin PII» |

La revisión completa de los doce puntos se hace en la PR E, que es la que mueve datos.

## 11. Evidencia de C y D (2026-11-08, en la PC con turno del Subdirector)

| Pieza | Comprobación | Resultado |
|---|---|---|
| D | vitest `--maxWorkers=1`, `lib/studio/chatwoot/bot/__tests__` | PASÓ, 4 archivos, 117 pruebas |
| D | 6 mutantes (lease, nota privada, presupuesto, foto incompleta, timeout, tope de la ráfaga) | 6 de 6 muertos |
| C | vitest `--maxWorkers=1`, `lib/studio/chatwoot/bot/conocimiento/__tests__` | PASÓ, 2 archivos, 128 pruebas; antes, un rojo propio de la prueba (leía la huella sha256 como teléfono), corregido |
| C | 6 mutantes (contacto de bodega, Paso 2, montos, dominios, notas internas, patrones) | 6 de 6 muertos |
| C y D | `tsc --noEmit` y `eslint` de lo tocado | PASÓ |
| C y D | `pnpm verify`, build, contenedores | NO EJECUTADO (portón = CI de GitHub) |

Las pruebas se escribieron junto con el código y no se vieron en rojo antes de él: los mutantes hacen ese papel.

## 12. Fuera de alcance

- Fotos, audios y PDF (pasan a humano hasta 7.5).
- Herramientas que lean el ERP (estado de carga, cotización): I0 de IA-01, pero piden su propia SDD con permisos y tenant.
- n8n (descartado en la v2).
- La redirección sin IA de E10 (10.2), que ya existe.
