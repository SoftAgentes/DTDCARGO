---
sdd: "0491"
title: "La recepción de bodega China creada en el Studio vuelve a numerarse WR-"
status: in-progress
author: "Sam + Claude Opus 5 (Worker)"
created: 2026-09-19
updated: 2026-09-19
supersedes: null
superseded_by: null
related: ["0016", "0041", "0152", "0443", "0488"]
confidencialidad: interno
---

# SDD-0491 — La recepción de bodega China creada en el Studio vuelve a numerarse WR-

## Contexto

Es el punto 2 del «Fuera de alcance» de la SDD-0488. El Director lo verificó como
bug real en producción y lo asignó el 2026-09-19, porque Sam pidió trabajo
continuo. Los números se reservaron en local: SDD-0491 con
`sdd:next --reserve`, y la migración 0469 con su archivo en la rama.

### El defecto (medido)

`createReceiptAction` (`app/studio/(app)/cn/actions.ts`) pedía el código de la
recepción a `next_receipt_code`. Esa función generaba `WR-YYYY-NNNN` (0008,
0012), pero la 0079 la redefinió para Cobranzas: ahora da `R-YYYY-NNNN` con el
máximo de `payment_receipts`. Desde entonces:

- **Una recepción creada a mano sale con un código de la serie de los cobros.**
  Además, ese código es el que va a recibir el próximo cobro.
- **El código no avanza con las recepciones.** Dos altas seguidas, sin un cobro
  en medio, piden el mismo código, y la segunda choca con
  `unique (tenant_id, receipt_code)` de la 0008. Medido en PGlite con el cuerpo
  real de la función de la 0079: la primera sale `R-2026-0042` y la segunda,
  también `R-2026-0042`, falla con `duplicate key value violates unique constraint
  "warehouse_receipts_cn_tenant_id_receipt_code_key"`. Entre dos cobros, el
  Studio puede crear una sola recepción manual.
- **La huérfana no se puede crear desde el Studio.** Pedía `next_orphan_code`,
  que la 0211 dejó sólo para `service_role` y la 0248 no devolvió («para esos la
  0211 fue correcta»). La acción corre con el cliente del usuario
  (`authenticated`).

Los demás caminos no pasan por esa función. La prealerta (0449) numera `WR-`
por su cuenta, con la tabla tomada. El operario (0045) también numera por su
cuenta, sin lock.

## Decisiones

### Del Director (2026-09-19)

- Un generador de `WR-` propio, con el mismo criterio de serialización que la
  0449, y medido.
- **No renombrar ni tocar `next_receipt_code`:** la usan los cobros
  (`collections-actions.ts`, 0467). Además, el preflight de la 0467 la fija por
  md5.
- **No tocar datos existentes ni leer filas de producción.** La auditoría y la
  corrección de las recepciones con código `R-` quedan propuestas para Sam
  (ver «Release»).
- Migrate-first: la PR se abre con la espera declarada y no se aplica ni se
  integra sin el OK nominal de Sam.

### De diseño, con evidencia

- **El generador es un trigger BEFORE INSERT, no una función aparte.** La acción
  inserta por PostgREST, así que una función que genere el código en otra
  petición (otra transacción) suelta su lock antes del INSERT. Dos altas pedirían
  el mismo número y la segunda fallaría con 23505. El trigger numera en la misma
  transacción del INSERT, como la 0449.
- **El lock es consultivo por tenant (clave 491), no el de tabla de la 0449.**
  Dentro de un trigger, el INSERT ya tiene ROW EXCLUSIVE. Pedir ahí SHARE ROW
  EXCLUSIVE, que choca con el ROW EXCLUSIVE de otra alta, dejaría a dos altas
  simultáneas esperándose una a la otra (deadlock). Con la 0449 las dos
  convivencias quedan serializadas por su lock de tabla, y está medido: su LOCK
  espera al INSERT, o el INSERT espera a su LOCK.
- **SECURITY DEFINER.** El máximo tiene que contar las recepciones borradas,
  porque el unique las incluye, y la RLS del Studio las esconde
  (`deleted_at is null`, 0012). Con SECURITY INVOKER, el Studio numeraría por
  debajo de una borrada; el mutante S2 lo muestra.
- **Sólo actúa si la fila llega sin código** (o con un código en blanco). El
  operario y la prealerta mandan el suyo y no cambian.
- **No trunca pasado 9999:** el padding es de al menos 4 dígitos y se extiende.
  El `lpad(…, 4)` de la 0012, la 0045 y la 0449 trunca (ver «Fuera de alcance»).

## Alcance

### Qué cambia

- **`supabase/migrations/0469_recepcion_codigo_wr.sql`:** la función
  `public.warehouse_receipts_cn_assign_code()` (DEFINER, `search_path` vacío,
  owner postgres, sin EXECUTE para la API) y su trigger BEFORE INSERT en
  `warehouse_receipts_cn`. A la fila sin código le asigna `WR-YYYY-NNNN`, o
  `SIN-CODIGO-NNNN` si es huérfana. Trae preflight (tabla, columnas y unique de
  la 0008) y postflight (forma del trigger y de la función, y ACL).
- **`createReceiptAction`:** inserta sin `receipt_code` y lee el que asigna la
  base (`.select("id, receipt_code")`). Ya no llama a `next_receipt_code` ni a
  `next_orphan_code`. Así se arreglan también las huérfanas del Studio.

### Qué no cambia

- `next_receipt_code`, `next_orphan_code` y los cobros.
- El camino del operario (0045) y el de la prealerta (0449).
- Las filas existentes.
- La UI: `NewReceiptDrawer` sigue mostrando `createdReceiptCode`.

### Allowlist exacta

- `supabase/migrations/0469_recepcion_codigo_wr.sql` (nueva)
- `supabase/tests/0469_recepcion_codigo_wr.test.sql` (nuevo)
- `supabase/tests/0469_recepcion_codigo_wr_carrera.test.sql` (nuevo)
- `supabase/migrations-baseline.json` (sólo la espera de la 0469)
- `app/studio/(app)/cn/actions.ts` (sólo `createReceiptAction` y la cabecera
  del módulo)
- `app/studio/(app)/cn/__tests__/create-receipt-code.test.ts` (nuevo)
- `docs/specs/0491-recepcion-codigo-wr/spec.md` y `docs/specs/README.md`
  (regenerado)
- `.agents/handoffs/0491-recepcion-codigo-wr.md`

## Aceptación

1. **El contrato SQL pasa con la 0469 y falla sin ella** (control rojo: con
   `-v apply_fix=false`, NOT NULL en `receipt_code`). Cubre:
   - la serie WR- compartida con la prealerta real;
   - que cuentan las borradas;
   - la serie SIN-CODIGO- de las huérfanas;
   - que respeta el código que llega y numera el que viene en blanco;
   - que la serie es por tenant y por año;
   - que no trunca pasado 9999;
   - la forma y la ACL de la función y del trigger.
2. **La carrera con sesiones reales:**
   - dos altas del Studio a la vez (y dos huérfanas) salen con números
     consecutivos, y `b` espera en el lock consultivo. El control, sin el lock,
     falla con 23505;
   - con la prealerta, en los dos órdenes, espera el lock de tabla y la serie
     sigue;
   - en tenants distintos no hay espera.
3. **Mutantes de la 0469 fuera del repo:** cada uno cae en su aserción.
4. **vitest de la acción:**
   - no llama a `next_receipt_code` ni a `next_orphan_code`;
   - inserta sin `receipt_code`;
   - devuelve y audita el código de la base.

   Control rojo contra el código anterior, y un mutante que lee sólo `id`.
5. `pnpm verify` completo, con la espera declarada.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.05 (permisos y tenant en el servidor) | **cumplimiento** | El código lo asigna la base, por tenant. La acción sigue pasando por la RLS del usuario, y la función de trigger no se expone a la API. |
| SGE-00.06 (prevenir antes de informar) | **cumplimiento** | Dos altas a la vez ya no chocan: se serializan. Antes la segunda fallaba con un error de base. |
| AUD-01 (auditoría de mutaciones) | **cumplimiento** | Sin cambio: el evento `received` nombra el código real asignado. |
| MP-01 (permanencia) | **cumplimiento** | No se borra ni se reescribe nada. Los códigos R- existentes quedan a decisión de Sam. |
| SGE-00.07 / BTN-01 (UI) | **no aplica** | No cambian pantallas ni botones. |

## Release

- **Orden: MIGRATE-FIRST.** Se aplica la 0469 y después se integra la PR. Esta
  app inserta sin código: sin el trigger, la columna NOT NULL rechaza el alta. El
  gate de símbolos pendientes no lo detecta, porque la dependencia es de
  comportamiento (ningún símbolo nuevo se nombra desde TypeScript). Por eso la
  espera lo dice.
- **Aplicar exige el OK de Sam nombrando la 0469**, con el runbook de
  producción. Con la app de hoy el trigger no cambia nada, porque siempre manda
  el código.
- **Paso propuesto para Sam, NO ejecutado: auditar y corregir las recepciones
  con código R-.** Sería una consulta de sólo lectura en producción (por ejemplo
  `receipt_code like 'R-%'` sobre `warehouse_receipts_cn`) para saber cuántas
  son y desde cuándo. Si decide corregirlas, se haría con una migración aparte
  que les asigne `WR-` con la misma regla, sin tocar las etiquetas ya impresas
  sin avisar. Nada de esto se hizo ni se leyó.

## Evidencia

PENDIENTE: el `verify` completo, en el turno del Director. Lo demás va en el
handoff.

## Fuera de alcance detectado

1. **El operario (0045) numera `WR-` sin lock.** Dos recepciones del operario a
   la vez, o una del operario con una del Studio, pueden pedir el mismo número;
   el unique las frena con 23505. Si el operario dejara el código en blanco, el
   trigger de la 0469 lo serializaría. Eso cambia `create_receipt_as_operario`:
   decisión aparte.
2. **`lpad(…, 4)` trunca pasado 9999** en la 0012, la 0045 y la 0449 (y en
   `next_receipt_code` de la 0079, cuyo comentario dice lo contrario). Pasado
   9999 en un año, repetiría números. La 0469 no lo tiene.
3. **La clave de traducción `cn_code_generation_failed`** (`lib/i18n`) queda sin
   uso: la acción ya no genera el código aparte. Se conserva para no tocar tres
   archivos más.
