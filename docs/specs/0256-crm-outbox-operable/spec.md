---
sdd: "0256"
title: "El CRM se opera desde el ERP: la cola de escritura y los verbos que mueven el embudo"
status: in-progress
author: "Sam (founder) + Claude"
created: 2026-08-13
updated: 2026-08-13
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
| Reasignar asesor | `patch_owner` | ✅ | ⬜ **pendiente** — ver §6 |
| Etiquetar | `patch_tags` | ✅ | ⬜ pendiente (desbloqueado por la 0366) |

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
