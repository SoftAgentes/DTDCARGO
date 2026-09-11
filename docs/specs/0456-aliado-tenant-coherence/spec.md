---
sdd: "0456"
title: "Un cliente sólo cuelga de un aliado de su tenant"
status: done
author: "Claude"
created: 2026-09-11
updated: 2026-09-11
supersedes: null
superseded_by: null
related: ["0255", "0269"]
confidencialidad: interno
---

# SDD-0456 · Un cliente sólo cuelga de un aliado de su tenant

> La base deja de aceptar que `clients.aliado_id` apunte a un aliado de otro
> tenant, para que ningún comprobante ni etiqueta salga con la marca de otra empresa.

## Contexto

Hallazgo del lote L01 (SDD-0336, PR #82, rama `codex/c-l01-portal-marca`). La
columna `clients.aliado_id` nació en la migración 0362 con una FK simple a
`aliados (id)` que no compara tenants, y tampoco los comparan los guards de 0362,
0371 y 0372. La marca white-label se resuelve por ese vínculo:
`resolveBrandForClient` (`lib/studio/aliados/brand-resolve.ts:37-53`) en main y la
RPC `get_portal_brand()` de 0401 en la PR #82. Esa marca define el emisor del
comprobante y de las etiquetas (`lib/shared/brand-context.ts:4-7`), así que una
marca equivocada tiene riesgo legal. El Worker de L01 lo reprodujo en Postgres
efímero: un cliente de T1 recibió la marca pública del aliado de T2. El defecto es
anterior a L01.

## Alcance

- Migración `0450_clients_aliado_mismo_tenant`:
  - preflight que falla sin DML si ya existen filas incoherentes y reporta solo el
    conteo;
  - `unique (tenant_id, id)` en `aliados`, solo como destino de la FK;
  - FK compuesta `clients (tenant_id, aliado_id) → aliados (tenant_id, id)`.
- Contrato SQL desechable y espera declarada en `supabase/migrations-baseline.json`.
- Fuera de alcance, por decisión del Director:
  - el filtro explícito `a.tenant_id = c.tenant_id` en `get_portal_brand()`, que
    queda como seguimiento para cuando 0401 esté en main;
  - cambios TS;
  - aplicar la migración en producción.

## Diseño

- **FK compuesta, no trigger.** Postgres la vigila por los dos lados: rechaza
  enlazar un cliente a un aliado ajeno, mover de tenant a un cliente sin soltar su
  aliado y mover de tenant a un aliado con clientes. La 0382 usa trigger en
  `price_books` porque además exige aliado raíz y vivo. Aquí la regla es solo de
  tenant.
- **Se conserva la FK simple de 0362.** PostgREST solo resuelve con FKs de una
  columna el embed por columna `aliados:aliado_id (...)`, que usan
  `brand-resolve.ts:41` y `app/studio/(app)/etiquetas/page.tsx:82`. Verificado con
  PostgREST 16.1: sin la simple, ese embed responde PGRST200 y la marca caería a
  DTD en silencio.
- **Coherencia por construcción.** Con la FK, todo join por `aliado_id` queda
  dentro del tenant, incluidos 0401 y `resolveBrandForClient`. La lectura con
  sesión del Studio ya filtraba por la RLS `aliados by tenant` (0362:146-149).
- **Una sola sentencia, con locks antes del preflight.**
  - Locks, preflight y DDL van en un único bloque `do`.
  - `lock_timeout` de 5 s, como en la 0342 y la 0383.
  - Antes del conteo, y en ese orden: `aliados` en ACCESS EXCLUSIVE y `clients` en
    SHARE ROW EXCLUSIVE.
  - Así, entre el conteo y la FK no se cuela una fila incoherente, y `clients`
    sigue legible mientras se valida la FK.
- **Idempotente sin drops.** Crea solo lo que falta, y un postflight comprueba la
  forma exacta. Si ya existe una constraint con el mismo nombre y otra forma, la
  migración falla.

### Semántica

| Caso | Antes de 0450 | Con 0450 |
|---|---|---|
| Cliente directo (`aliado_id` NULL) | se acepta | se acepta (MATCH SIMPLE) |
| Enlazar o dar de alta con un aliado del mismo tenant | se acepta | se acepta |
| Enlazar o dar de alta con un aliado de otro tenant | se acepta (el hueco) | 23503 |
| Mover de tenant a un cliente con aliado | se acepta | 23503 |
| Mover de tenant a un aliado con clientes | se acepta | 23503 (ON UPDATE NO ACTION) |
| Borrar un aliado con clientes | 23503 (RESTRICT de 0362) | 23503 (RESTRICT) |
| Borrar un aliado sin clientes, o un cliente de aliado | se acepta | se acepta |
| Borrar el tenant entero, en el fixture con la cascada de 0006 | igual antes y después | igual antes y después |
| Cliente con `deleted_at` | la FK lo mira | la FK lo mira: el borrado lógico no exime |

Los SQLSTATE son los que observó el contrato en PostgreSQL 17.11. El caso del
tenant solo compara antes y después dentro del fixture; en producción, la 0268 ya
impide borrar tenants. No se usa `ON DELETE SET NULL`: sin lista de columnas
pondría en NULL también `clients.tenant_id`.

## Allowlist exacta

- `supabase/migrations/0450_clients_aliado_mismo_tenant.sql`
- `supabase/tests/0450_clients_aliado_mismo_tenant.test.sql`
- `supabase/migrations-baseline.json`: solo la espera `0450_clients_aliado_mismo_tenant`.
- Esta spec y `docs/specs/README.md` (generado).
- `.agents/handoffs/aliado-tenant-coherence.md`.

## Aceptación

- [x] RED: sin 0450, el contrato reproduce el cruce de tenants y la marca ajena.
- [x] Análisis estático del archivo: sin DML; `lock_timeout`, locks y preflight
      antes del primer DDL.
- [x] Con filas incoherentes, 0450 falla en el preflight (P0001) y reporta solo el
      conteo.
- [x] Una constraint con el mismo nombre y otra forma hace fallar el postflight.
- [x] Aplicada sobre datos coherentes no modifica filas, y reaplicada deja el
      catálogo idéntico.
- [x] FK compuesta validada, MATCH SIMPLE, ON DELETE RESTRICT y ON UPDATE NO ACTION.
      La FK simple de 0362 sigue viva.
- [x] Los cruces de tenant se rechazan con 23503 de la FK compuesta y los casos
      legítimos se aceptan.
- [x] Los borrados terminan igual antes y después.
- [x] El contrato detecta cada una de las 16 mutaciones de la migración.
- [x] El embed PostgREST `aliados:aliado_id` sigue resolviendo con las dos FK
      (PostgREST 16.1 efímero).
- [x] `check-schema-rebuild`, contratos SQL, `sdd:check`, `docs:check` y
      `check-pending-migration-symbols` en verde; `pnpm verify` registrado paso a
      paso. El e2e falla por el entorno sin Supabase y `migrations-applied` quedó
      sin medir; el detalle está en el handoff.

Que un fallo no deje cambios a medias lo garantiza la transacción de la
migración, porque todo va en un solo `do`. El contrato no lo mide desde adentro.

## Producción

`done` en esta spec no significa aplicada. La migración queda declarada pendiente
en `supabase/migrations-baseline.json`. Aplicarla exige el OK nominal de Sam y el
runbook `docs/runbooks/aplicar-migraciones-prod.md`: de a una, con el name exacto
y en horario de baja actividad. Mientras corre, los locks pausan brevemente las
lecturas de marca y las altas y ediciones de clientes. Antes conviene, con
autorización de Sam, un conteo agregado de solo lectura de las filas incoherentes;
el preflight falla cerrado si existen.

Gobernanza: no conformidad de aislamiento multi-tenant corregida localmente y
verificada en Postgres efímero. Producción sigue NO VERIFICABLE hasta su gate
nominal independiente. No hay cambio visual ni tratamiento nuevo de datos
personales.
