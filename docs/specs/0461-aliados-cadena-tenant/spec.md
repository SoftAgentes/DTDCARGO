---
sdd: "0461"
title: "La cadena de aliados no cruza tenants"
status: done
author: "Claude"
created: 2026-09-12
updated: 2026-09-12
supersedes: null
superseded_by: null
related: ["0255", "0269", "0336", "0456"]
confidencialidad: interno
---

# SDD-0461 · La cadena de aliados no cruza tenants

> La base deja de aceptar que un aliado cuelgue de un aliado o de un cliente de otro
> tenant. Así ningún cliente se cotiza con la lista de precios de otra empresa ni lleva
> una insignia con prefijos ajenos, y la RPC de marca del Portal filtra el tenant por su
> cuenta.

## Contexto

Hallazgo de la tarea `aliado-tenant-coherence` (SDD-0456, migración 0450, aplicada en
producción el 2026-09-11), registrado allí como FUERA DE ALCANCE. La 0450 exige el
tenant en `clients.aliado_id`, pero la entidad `aliados` nació en la 0362 con otras dos
FK simples que no comparan tenants:

- `aliados.parent_aliado_id` (0362:69). Un sub-aliado de T1 puede colgar de un aliado
  de T2. Entonces `aliado_prefix_chain` (0362:159-179) compone una insignia con
  prefijos de dos empresas, y `resolve_price_book` (0382:292-328) sube hasta el raíz y
  devuelve su lista sin filtrar `pb.tenant_id`: el cliente de T1 se cotiza con la lista
  de T2.
- `aliados.client_id` (0362:66). `convertirEnAliadoAction`
  (`app/studio/(app)/clientes/actions.ts:880-888` en main) inserta el `clientId` del formulario,
  y la RLS de `aliados` solo mira `aliados.tenant_id`.

Además, `get_portal_brand()` (0401:41-42) resuelve la marca con `a.id = c.aliado_id`
sin comparar tenants. Con la 0450 aplicada ya es coherente por construcción. El
Director acordó el filtro explícito como seguimiento, en una migración posterior y sin
tocar la 0401.

Preflight de producción del Director (2026-09-12, solo agregados, sin leer filas):
3 aliados, 0 con padre, 0 con padre de otro tenant, 3 con `client_id`, 0 con cliente de
otro tenant, 0 clientes con aliado de otro tenant y 1 lista de precios.

## Alcance

- Migración `0451_aliados_cadena_mismo_tenant`:
  - un preflight de conteo por FK, que falla sin DML y reporta solo el conteo;
  - `unique (tenant_id, id)` en `clients` (`clients_tenant_id_id_key`), porque la 0450
    solo creó el de `aliados`;
  - FK compuesta `aliados (tenant_id, parent_aliado_id) → aliados (tenant_id, id)`, que
    reutiliza `aliados_tenant_id_id_key`;
  - FK compuesta `aliados (tenant_id, client_id) → clients (tenant_id, id)`;
  - `get_portal_brand()` redefinida con `and a.tenant_id = c.tenant_id`.
- `createClientAction`: traduce el 23503 de `clients_aliado_mismo_tenant_fkey`.
- Contrato SQL desechable.
- Espera de la 0451 declarada en `pendingBelowCutoff` de `supabase/migrations-baseline.json`.
- Fuera de alcance por el encargo: modificar 0362, 0382, 0401 o 0450; el Portal; aplicar
  en producción.

## Diseño

- **FK compuestas, no triggers**, por la misma razón que en la 0450: Postgres las vigila
  por los dos lados y no quedan funciones vivas que alguien pueda reescribir mal.
- **La semántica de las FK simples de la 0362.** MATCH SIMPLE, que es imprescindible
  para el padre porque `parent_aliado_id` NULL es un aliado raíz. ON DELETE RESTRICT y
  ON UPDATE NO ACTION. Las FK simples se conservan: el embed `clients:client_id (markbox)`
  de `listAliadoOptions` (`lib/studio/aliados/aliado-queries.ts:41`) depende de la de
  `client_id`. La contraprueba en PostgREST da PGRST200 sin ella.
- **Una sola sentencia, con locks antes del preflight** y en el orden de la 0450:
  `aliados` y después `clients`, las dos en ACCESS EXCLUSIVE. `clients` sube de nivel
  frente a la 0450 porque recibe una constraint única. `lock_timeout` de 5 s y
  `statement_timeout` de 60 s.
- **Idempotente sin drops**, con postflight de forma exacta para las tres constraints y
  para el filtro de la RPC.
- **La RPC** conserva el cuerpo, la firma, el encabezado y los grants de la 0401, salvo
  la línea del filtro. Con la 0450 el filtro es cinturón y tirantes: si la FK de la 0450
  cayera, la RPC igual no entregaría una marca ajena (medido).
- **TS.** En el insert de `clients` de `createClientAction` solo puede dispararse la FK de
  tenant `clients_aliado_mismo_tenant_fkey` (0450). Las dos FK de la 0451 viven en
  `aliados` y no se revisan al insertar en `clients`. Se traduce con el mensaje de la
  lectura previa del aliado (`actions.ts:145`), así que la regla de negocio no cambia.
  Cualquier otro 23503 conserva el mensaje genérico. PostgREST 16.1 confirma que el
  nombre de la constraint viaja en `message`, igual que en el 23505 vecino.

### Semántica (observada por el contrato en PostgreSQL 17.11)

| Caso | Antes de 0451 | Con 0451 |
|---|---|---|
| Aliado raíz (`parent_aliado_id` NULL) | se acepta | se acepta (MATCH SIMPLE) |
| Sub-aliado de un aliado del mismo tenant, en alta o edición | se acepta | se acepta |
| Sub-aliado de un aliado de otro tenant, en alta o edición | se acepta: insignia mezclada y lista ajena | 23503 `aliados_parent_mismo_tenant_fkey` |
| Aliado con cliente-ancla del mismo tenant | se acepta | se acepta |
| Aliado con cliente-ancla de otro tenant, en alta o al reapuntarlo | se acepta | 23503 `aliados_client_mismo_tenant_fkey` |
| Aliado con `deleted_at` que cuelga de otro tenant | se acepta | 23503 |
| Mover de tenant a un aliado sin mover su ancla | se acepta¹ | 23503 `aliados_client_mismo_tenant_fkey` |
| Mover de tenant al cliente-ancla | se acepta¹ | 23503 `aliados_client_mismo_tenant_fkey` |
| Mover de tenant un sub-aliado con su ancla, sin soltar al padre | se acepta¹ | 23503 `aliados_parent_mismo_tenant_fkey` |
| Mover de tenant un aliado padre con su ancla, teniendo sub-aliados | se acepta¹ | 23503 `aliados_parent_mismo_tenant_fkey` |
| Borrar un aliado con sub-aliado, o un cliente-ancla | 23503 | 23503 |
| Borrar un aliado sin nada, o un cliente de aliado | se acepta | se acepta |
| Borrar el tenant entero (fixture con la cascada de 0006) | se acepta | se acepta |
| `get_portal_brand()` con un vínculo cruzado (FK de la 0450 soltada a propósito) | entrega la marca ajena | cero filas |
| `resolve_price_book` de la cadena legítima, del raíz sin lista y del cliente directo | lista del raíz o de la casa | igual |

¹ Los movimientos se midieron con la 0451. El «antes» se deduce de que ninguna
constraint previa compara tenants en esas columnas; los cruces de alta y edición sí
tienen su RED medido.

### Impacto al aplicar

- Mientras corre, `aliados` y `clients` quedan en ACCESS EXCLUSIVE. Esperan las lecturas
  y escrituras de las dos tablas, incluidas las del Portal (marca y datos del cliente) y
  las del Studio (clientes, aliados y etiquetas).
- La corrida es corta: dos conteos, un índice único sobre `clients` y la validación de
  dos FK sobre las 3 filas de `aliados` del conteo del Director. `statement_timeout` la
  corta a los 60 s.
- Con `lock_timeout` de 5 s, si otra transacción retiene alguna de las tablas la
  migración falla rápido. Mientras espera, las consultas nuevas a esas tablas hacen
  cola detrás de ella, hasta 5 s.
- Conviene aplicarla en horario de baja actividad.

## Allowlist exacta

- `supabase/migrations/0451_aliados_cadena_mismo_tenant.sql`
- `supabase/tests/0451_aliados_cadena_mismo_tenant.test.sql`
- `supabase/migrations-baseline.json`: solo la espera `0451_aliados_cadena_mismo_tenant` en
  `pendingBelowCutoff`.
- `app/studio/(app)/clientes/actions.ts`: solo la rama 23503 de `createClientAction`,
  antes del mensaje genérico (línea 224 antes del cambio).
- `app/studio/(app)/clientes/__tests__/alta-bajo-aliado.test.ts`: solo los dos casos del
  23503 y el punto 6 de la cabecera.
- `docs/specs/0461-aliados-cadena-tenant/spec.md`: esta spec.
- `docs/specs/README.md`: generado por `pnpm docs:index`.
- `.agents/handoffs/aliados-cadena-tenant.md`.

## Aceptación

- [x] FK compuesta del padre que reutiliza `aliados_tenant_id_id_key`, con un preflight
      de conteo que falla cerrado (P0001, solo conteo).
- [x] `clients_tenant_id_id_key`, que la 0450 no había creado, y la FK compuesta del
      cliente-ancla, con su propio preflight.
- [x] `get_portal_brand()` redefinida con `and a.tenant_id = c.tenant_id` en la 0451, sin
      modificar la 0401. Fuera de esa línea es idéntica a la 0401 en cuerpo, encabezado y
      ACL.
- [x] `createClientAction` traduce el 23503 de `clients_aliado_mismo_tenant_fkey` con el
      mensaje de la lectura previa, y otro 23503 conserva el genérico. La prueba está
      versionada en `app/studio/(app)/clientes/__tests__/alta-bajo-aliado.test.ts`, con dos
      casos y control rojo demostrado: sin el `if` nuevo falla, y restaurado pasa 13/13.
- [x] El contrato SQL cubre:
  - los RED de insignia mezclada, lista ajena, ancla ajena y marca ajena;
  - para las dos FK, el rechazo 23503 del cruce y la aceptación del mismo tenant;
  - el estático, sin DML y con el orden de lock_timeout, locks y preflights;
  - los preflights con solo conteo y el drift de las tres constraints;
  - la idempotencia sin cambiar filas y los borrados iguales antes y después.
- [x] Mutaciones: los 27 mutantes quedan en rojo. Un equivalente esperado sobrevive
      (quitar los grants repetidos, porque `create or replace` conserva el ACL).
- [x] PostgREST 16.1 efímero:
  - los selects exactos del código responden byte a byte igual antes y después;
  - los cruces dan 409 · 23503, tanto por la sesión del Studio como por service_role;
  - la contraprueba sin la FK simple da PGRST200.
- [x] `pnpm verify` registrado paso a paso sobre `80b72653` (detalle en el handoff):
      15 de 17 pasos PASARON, incluidos `sql-tests` (180 contratos, con el de la 0451) y
      `schema-rebuild` (419 migraciones desde cero). `e2e` FALLÓ por entorno: los mismos
      15 escenarios de `auth.spec.ts` y `global-search.spec.ts` en las dos pasadas, sin
      configuración Supabase (`proxy.ts:67`). `migrations-applied` quedó NO EJECUTADO por
      falta de credenciales. El gate no está completo.

Que un fallo no deje cambios a medias lo garantiza la transacción de la migración,
porque locks, preflight y DDL van en un solo `do`. El contrato no lo mide desde adentro.

## Producción

`0451_aliados_cadena_mismo_tenant` no está aplicada, y `done` en esta spec no significará
aplicada. Aplicarla exige el OK nominal de Sam y `docs/runbooks/aplicar-migraciones-prod.md`:
de a una, con el name exacto y en horario de baja actividad. Esta rama declara la espera
en `pendingBelowCutoff` de `supabase/migrations-baseline.json`, con el impacto de locks y
los conteos que hay que repetir antes de aplicar, así que `migrations-applied` la exime
con motivo escrito. La espera se retira únicamente tras la aplicación y la verificación
autorizadas.

Gobernanza:

- **No conformidad** de aislamiento multi-tenant, corregida localmente y verificada en
  Postgres y PostgREST efímeros. Producción sigue NO VERIFICABLE hasta aplicar.
- **ERR-01, cumplimiento:** el 23503 se traduce a un copy seguro que ya existía, sin SQL
  ni nombre de constraint.
- Sin cambio visual ni tratamiento nuevo de datos personales.
