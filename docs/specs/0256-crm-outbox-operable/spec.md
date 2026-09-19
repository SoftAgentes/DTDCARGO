---
sdd: "0256"
title: "El CRM se opera desde el ERP: la cola de escritura y los verbos que mueven el embudo"
status: done
author: "Sam (founder) + Claude"
created: 2026-08-13
updated: 2026-09-19
supersedes: null
superseded_by: null
related: ["0043", "0078", "0083", "0084", "0086", "0087", "0157", "0244"]
confidencialidad: interno
---

# SDD-0256 — El CRM se opera desde el ERP

## 1. El problema

El módulo nació como **espejo de sólo lectura** (SDD-0043) y creció a cuatro
pestañas de tarjetas agregadas. Kommo, mientras tanto, se consolidó a un solo
embudo y se le montaron agentes de IA. El resultado: el ERP mostraba un mundo
que ya no existía y **no dejaba hacer nada**. El trabajo real volvía a Kommo.

El criterio de éxito que puso el founder no es técnico: *"que deje de trabajar
en el CRM y trabaje en el ERP"*. La pantalla no compite contra nada — compite
contra una herramienta que el equipo ya domina.

## 2. La regla que ordena todo: el ERP da la orden

El ERP es la fuente de verdad de la identidad del cliente. De ahí salen dos
invariantes que gobiernan el diseño:

**(a) El payload de la cola es el ESTADO DESEADO, no un delta.** Describe cómo
tiene que quedar el trato, no qué campo tocar. Por eso las órdenes se
**fusionan** en vez de pisarse: dos llamadas separadas antes de que drene la
cola tienen que sumar.

**(b) El ERP nunca escribe el espejo** (guardrail 0107). Escribe a Kommo, y
Kommo re-espeja por webhook. Consecuencia visible: entre el clic y la vuelta,
la pantalla sigue mostrando lo viejo. Sin decirlo, el asesor cree que no pasó
nada y vuelve a clickear — de ahí el rótulo **"En camino"**.

## 3. Alcance

### Rebanada A — la cola aguanta que la usen · ✅ en producción

| Pieza | Migración | Qué resuelve |
|---|---|---|
| Fusión del payload por `field_id` | `0364` | Encolar el Shipping Mark y después el nombre pisaba el primero. La fila salía `sent`, sin error |
| Claim con `FOR UPDATE SKIP LOCKED`, estado `processing`, reaper | `0365` | Con un solo cron nunca se solapaba; **con el nudge, dos drenajes eligen las mismas filas**. Con PATCH es inocuo, con POST duplica |
| Fusión de arrays + guarda para lo desconocido | `0366` | `tags_to_add`/`tags_to_delete` son instrucciones incrementales: dos encolados suman. Y una clave array sin estrategia declarada **tira excepción en vez de pisarse en silencio** |

**Por qué la 0366 existe:** la 0364 dejó el aviso escrito en sus líneas 25-28
y nombró el caso. La 0365 metió `patch_tags` en el `CHECK`. La condición del
aviso se cumplió y nadie volvió. La 0366 es esa vuelta — y cambia el mecanismo:
en vez de otro comentario para el próximo, la función falla nombrando la clave.

### Rebanada B — los verbos

| Verbo | Op | Servidor | Pantalla |
|---|---|---|---|
| Mover de etapa | `patch_stage` | ✅ | ✅ tabla (Asesor) **y** tarjeta (Tablero) |
| Reasignar asesor | `patch_owner` | ✅ | ✅ drawer del lead, en las dos vistas |
| Etiquetar | `patch_tags` | ✅ | ✅ drawer del lead |
| Dejar una nota | `add_note` | ✅ | ✅ drawer del lead |
| Crear una tarea | `add_task` | ✅ | ✅ drawer del lead |

Los tres verbos nuevos viven en `_components/LeadDrawer.tsx`, y el botón que lo
abre en `_components/LeadActionsButton.tsx` — client, para que el Tablero (que
es server) lo pueda montar igual que la tabla. Que estén en LAS DOS vistas lo
fija un contrato (`__tests__/stage-control.test.ts`), porque el error de dejar
un verbo en una sola superficie ya se cometió una vez y el diagnóstico fue "el
ERP no escribe al CRM".

**El nudge.** `after(() => admin.functions.invoke("kommo-writeback"))`, el mismo
patrón de `app/registro/actions.ts`. La latencia medida sin él fue **14 min
38 s** (el cron corre cada 15 y la orden entró 23 s después del tick). Un asesor
que mueve una tarjeta y no ve nada en 15 minutos deja de usar la pantalla. No
rompe el modelo de seguridad: el ERP invoca su **propia** edge function, nunca
la API de Kommo — el token sigue en Vault. El cron queda de red.

**La bandeja de entrada se excluye como destino.** Kommo devuelve
`400 NotSupportedChoice` al mover un lead *hacia* una etapa `type = 1`; esa la
gobierna `unsorted`. Verificado contra producción el 2026-08-12. El filtro vive
en **un solo lugar** (`stageTargets()` en `lib/studio/kommo-types.ts`) porque lo
usan las dos vistas y no puede divergir.

## 4. Decisiones y lo que se dejó afuera

- **Sin arrastrar en el kanban.** Un menú "Mover a…" cubre el mismo verbo con
  una fracción del riesgo. Reevaluar si el asesor lo pide.
- **El verbo va en las DOS vistas.** Salió primero sólo en la tabla y el
  Tablero quedó de sólo lectura. En la práctica fue peor que no tenerlo: el
  kanban es donde uno mueve cosas. Lo fija un contrato
  (`app/studio/(app)/crm/__tests__/stage-control.test.ts`).
- **Nada de POST todavía** (notas, tareas). El drenaje tiene `"PATCH"` literal
  y la clave de idempotencia `<leadId>:<op>` es correcta para PATCH y **rota
  para POST** — dos notas distintas colapsarían en una fila. Es prerrequisito de
  la Fase 5, no un bug vivo.
- **`kommo_updated_at_at_enqueue` sigue sin usarse.** La columna existe desde la
  0136. El chequeo optimista (no pisar al asesor si el lead se movió en Kommo
  desde que se encoló) queda pendiente.

## 5. Verificación

- **Contratos SQL** de las tres migraciones. El de la 0366 carga las migraciones
  **reales** con `\i` en vez de copiar el DDL, y **reproduce la pérdida con la
  0364 antes** de aplicar la 0366: falla si el bug no se reproduce.
- **Validado por mutación**: con la fusión de etiquetas desactivada el contrato
  se pone rojo mostrando que sobrevive sólo la segunda etiqueta. Un test que
  sólo ejercita la versión buena no prueba que la vieja estuviera mal.
- **En producción**, sobre la función pura y sin crear filas en la cola (una fila
  real dispara un PATCH a Kommo): suma, la orden nueva manda, sin residuo, sin
  regresión de la 0364, los dos `enqueue` delegando, permisos sólo
  `service_role`, y la guarda tirando con el nombre de la clave.
- **Pendiente de ojos humanos:** el control del Tablero no se vio en pantalla —
  el Studio pide sesión.

### Concurrencia del claim en la suite SQL (seguimiento del 2026-09-19)

Seguimiento sin número nuevo, asignado por el Director (la sesión «Director
notificación a workers»). La 0365 no se toca.

**Cómo se drena la cola.** La edge function `kommo-writeback` primero suelta las
reservas vencidas (`reap_kommo_writeback_stale`) y después reserva su lote con
`claim_kommo_writeback_batch` (`DRAIN_BATCH` = 100). Cada llamada es una RPC con
su propia transacción. La disparan el cron y el nudge de las acciones del CRM
(`app/studio/(app)/crm/actions.ts:349`), y los dos pueden coincidir.

**En producción** (verificado por el Director el 2026-09-19, leyendo sólo el
catálogo y el código desplegado, sin filas):

- **Cuerpo:** `claim_kommo_writeback_batch(uuid, integer)` tiene `md5(prosrc)`
  `d7bf6554…` (494 bytes). Es DEFINER con `search_path = public` y coincide con
  la 0365 de `main`, su única definición, y con el fixture de la carrera.
- **Ledger:** `20260813095152`, una sentencia, md5 `80935bdb…` y 4.577 bytes. El
  archivo de `main` tiene `7211eed9…` y 8.004 bytes: el texto aplicado no es el
  archivo byte a byte, igual que en la 0361, la 0445, la 0446 y la 0447. El cuerpo
  de la función sí coincide.
- **Edge function `kommo-writeback`, versión 8, activa:** suelta las reservas
  vencidas (10 minutos) y reserva con `p_limit` = 100, cada RPC en su propia
  llamada. Coincide con `main` en las líneas 44, 117 y 131.
- **Cron:** `kommo-writeback-drain-dtd`, `*/15 * * * *`, activo.

**Dos comentarios que no decían lo mismo:**

- la 0365 (líneas 67-69): SKIP LOCKED hace que el segundo drenaje saltee las
  filas del primero «en lugar de esperarlas (y terminar procesándolas también)»;
- su contrato (la cabecera de `0365_kommo_outbox_claim.test.sql`): SKIP LOCKED
  «sólo agrega que el segundo no se quede esperando; la exclusión la da la
  transición de estado».

**`supabase/tests/0365_outbox_kommo_carrera.test.sql`** corre en el paso
`sql-tests` de `verify` (no en CI). Usa:

- sesiones reales por dblink, que reservan como `service_role`, igual que la edge
  function;
- una barrera por `pg_blocking_pids`, que distingue si el segundo drenaje espera
  al primero o termina sin esperarlo;
- el fixture del contrato 0365, con la 0365 entera encima.

Cada escenario corre primero con el claim reemplazado por una variante (control)
y después con la 0365. Hay 4 filas pendientes por escenario:

| # | Escenario | Control | Con la 0365 |
|---|---|---|---|
| 1 | Dos drenajes a la vez con el lote de la edge function (100) | el claim sin lock: el segundo espera y vuelve a tomar las 4, con `attempts` = 2 (cada una se enviaría dos veces) | el segundo no espera y no toma ninguna; el primero tomó las 4 |
| 2 | Dos drenajes a la vez con un lote de 2 | el claim sin lock: el segundo espera y vuelve a tomar las 2 del primero; las otras 2 quedan pendientes | el segundo no espera y toma las otras 2 |
| 3 | Lo mismo que 2 | el claim con FOR UPDATE a secas: el segundo espera a que el primero confirme y después toma las otras 2, sin repetir ninguna | el segundo no espera |

**Corrección, con lo que se midió** (la 0365 no se toca):

- **Sin lock, la transición de estado no excluye.** El UPDATE del segundo
  drenaje espera la fila del primero y, al re-evaluar, sólo vuelve a comprobar
  `o.id = e.id`, así que la toma otra vez. Lo que excluye es el lock del SELECT,
  que al re-evaluar vuelve a comprobar `status = 'pending'`. La frase del
  contrato, «la exclusión la da la transición de estado», vale en una sola
  sesión, no con dos a la vez.
- **Con FOR UPDATE a secas no hay duplicados.** El segundo espera y después toma
  las libres. La frase de la 0365, «y terminar procesándolas también», no se
  sostiene.
- **Lo que agrega SKIP LOCKED es que el segundo drenaje no espera al primero.**
  Inferencia, no medida: en producción cada reserva es una RPC que confirma
  enseguida, así que con FOR UPDATE a secas la espera duraría lo que tarda el
  primer claim.

**Mutantes, con el runner real y fuera del repo.** Los contratos 0365 y 0377, de
una sola sesión, no detectan ninguno:

| Mutante | Lo que se quita | Escenarios que caen |
|---|---|---|
| M1 | el lock del SELECT del claim | 1, 2 y 3, con filas reservadas dos veces |
| M2 | el SKIP LOCKED (queda FOR UPDATE a secas) | 1, 2 y 3, porque el segundo espera; ninguna fila se repite |

El detalle y el script de los mutantes están en el handoff
`.agents/handoffs/0256-carrera-outbox-0365.md`.

Archivos de este seguimiento:

- supabase/tests/0365_outbox_kommo_carrera.test.sql
- .agents/handoffs/0256-carrera-outbox-0365.md

## 6. Reasignar asesor: RESUELTO — se hace desde los dos lados

`docs/specs/0087-kommo-users-mirror/spec.md:47` listaba, bajo *"Fuera de alcance
(diferido)"*: *"Reasignar leads / round-robin (eso vive en Kommo, no en el
ERP)"*. Esta spec construyó `reassignLeadOwnerAction` de todos modos, y la
contradicción quedó abierta.

**Decisión del founder (2026-08-13): se puede reasignar desde el ERP Y desde
Kommo. Las dos partes.** Esta spec **supersede** esa línea de SDD-0087.

Consecuencias, y por qué no rompen nada:

- El verbo `patch_owner` **se queda** y le toca UI (drawer del lead).
- **No hay bucle.** El ERP encola → Kommo aplica → el webhook re-espeja. El
  invariante que lo sostiene es que **nunca se encola write-back desde un evento
  `update`/`status`** del webhook: `routeNewLeads` sólo actúa en `add`.
- **No hay carrera con el asesor** que reasigne del otro lado. La columna
  `kommo_updated_at_at_enqueue` existe desde la 0136 para exactamente esto —
  si el lead se movió en Kommo desde que se encoló, la orden se marca `skipped`
  con motivo en vez de pisar. **Hoy la columna se guarda y no se lee**; con la
  edición bidireccional confirmada, activar ese chequeo deja de ser opcional y
  pasa a ser prerrequisito de la UI de este verbo.

## 7. Estado

`in-progress`. La rebanada A está completa y en producción (0364, 0365, 0366
aplicadas y verificadas). De la rebanada B falta la UI de dos verbos, uno de
ellos bloqueado por §6.
