# REV-SGE-049 · Renumeración de colisiones e integración de 0330 y 0331

| Control | Valor |
|---|---|
| Fecha | 2026-08-01 |
| Base Git | `origin/main@03aae813` |
| Rama | `feat/sdd-0236-transportistas` |
| Specs | SDD-0236 (ex-0231) · Motor F0 |
| Proyecto | `xpfuzqombmjmxvprjgmi` |
| Resultado | Dos colisiones resueltas · dos migraciones aplicadas · merge a `main` |

## Alcance de la renumeración

El barrido de colisiones sobre **todas** las ramas (locales y remotas) devolvió
cuatro de spec y once de migración. La mayoría **no son colisiones accionables**:

| Caso | Veredicto |
|---|---|
| SDD-0172 asistente nueva compra | Ya en `main` como **0173**; rama 286 commits atrás, con un commit "SOLO-PREVIEW". No se toca. |
| SDD-0184 audit-retention | Ya en `main` como **0186**; rama 164 atrás. No se toca. |
| SDD-0068 registro-correos-aviso | Ya en `main` como **0161**; ramas 519 y 553 atrás. No se toca. |
| Migraciones 0020, 0057, 0058, 0124, 0243, 0247, 0261, 0268, 0277, 0297 | Históricas y **aplicadas en Producción bajo ambos nombres**. Renombrar un archivo que ya está en el ledger rompería `migrations-applied`. No se tocan. |

Sólo dos eran colisiones vivas sobre trabajo sin integrar.

### 1. SDD-0231 duplicada

`0231-transportistas-y-tarifario` chocaba con `0231-almacen-ve-entrega-manual-gobernada`
(ya en `main`, migración 0321). Ambas specs se crearon el 2026-08-01 con **27
segundos de diferencia**, en ventanas que no se veían.

Renumerada a **SDD-0236** y migración **0330**. Se actualizaron front-matter,
título, cabecera de la migración, cabecera de la prueba contractual, comentarios
de tablas y funciones, y las referencias en `lib/studio/freight-carriers/`,
`carrier-actions.ts` y `TransportistasPanel.tsx`. Cero referencias a `0231` o
`0315` sobreviven en el conjunto renumerado.

### 2. Migración 0254 duplicada

`0254_seed_received_ve_rule` (Motor F0, rama de 446 commits atrás) chocaba con
`0254_fix_public_ocean_rate_casing`, **ya aplicada en Producción**. Renumerada a
**0331**.

Se verificó que **no estaba superada**: `main` ya dispara `received_ve` (fan-out
de SDD-0156 desde `warehouse-receipt-ve-queries.ts`), pero antes de esta
migración las reglas default en Producción eran `consolidated`, `eta_set` y cinco
`status:*` — ninguna `received_ve`. Ese fan-out era un no-op silencioso.

Los números se eligieron verificando **todas las ramas**, no sólo `origin/main`:
0325–0329 están tomadas por `codex/audit-hardening-20260801` y 0316 por
`codex/governance-final-100`.

## Orden de despliegue: migración ANTES que código

Ambas se aplicaron **antes** del merge, por decisión explícita y por la lección
de REV-SGE-048:

- **0330** — `app/studio/(app)/admin/page.tsx` llama `listFreightCarriers` y
  `listAllTariffs` al renderizar. Sin las tablas, `/studio/admin` falla al
  cargar.
- **0331** — el commit **retira** el mail `shipment_arrived`. Sin la regla
  sembrada, el arribo a Venezuela habría quedado sin ningún aviso al cliente. El
  modo de falla es peor que el de 0317–0324: no lanza error, **se calla**.

## Migraciones aplicadas

| Migración | SHA-256 del archivo |
|---|---|
| `0330_freight_carriers_tariffs` | `B8D8F6C2ED9D1348902AF902F33CFD56F6EDA08B6F5034908095B85D0EA76CE1` |
| `0331_seed_received_ve_rule` | `E4FF6118AF8D0E9CC9FA378A12DD6AF2317EA91A4A4ED9910D63CC12AD751557` |

## Postflight metadata-only

**0330** — RLS activa en `freight_carriers` y `carrier_tariffs`; ocho policies;
cuatro índices (incluidos los dos únicos parciales: un predeterminado por tenant
y una tarifa viva por ciudad); el FK compuesto
`carrier_tariffs_carrier_same_tenant` garantiza que una tarifa no pueda apuntar a
un transportista de otro tenant. `public_carrier_tariffs(uuid)` es ejecutable por
`anon`, y **`anon` no tiene SELECT sobre ninguna de las dos tablas**: el costo,
el nombre del transportista y su RIF quedan fuera del alcance público. Esa es la
propiedad de seguridad de la migración y tiene prueba contractual.

**0331** — una regla default `received_ve` por tenant, con
`email / event / offset 0 / visible_in_portal / activa`. Idempotente por el
índice parcial `client_notif_rules_default_uniq`.

`node scripts/check-migrations-applied.mjs`: **321 archivos · 330 en el ledger ·
OK**, con 0017 y 0257 como esperas declaradas.

## Gates ejecutados sobre la rama

`docs:check`, `typecheck`, `lint`, Vitest (**372 archivos, 4484 pruebas**),
`schema-rebuild` (**321 migraciones, 304 aplicadas desde cero, 17 sólo-ledger,
aislamiento multi-tenant sobre 219 tablas y dos tenants reales**),
`governance:check` (27 políticas) y `components:check` (CMP-01) — todos verdes.
El contrato SQL nuevo `0330_freight_carriers_tariffs.test.sql` pasa.

## No conformidad abierta (pre-existente, ajena a este cambio)

`node scripts/run-sql-tests.mjs` sobre **`main` limpio en `03aae813`** deja
**siete contratos en rojo**: `0261_audit_entity_catalog_validate` y
`0271`–`0276` (reparaciones de ledger de SDD-0118). Fallan con
`SDD-0118 … drift` / `postcondición falló` sobre migraciones históricas.

- Verificado que **no lo causa esta rama**: el diff contra `origin/main` sólo
  **agrega** tres archivos (0330, 0331 y la prueba de 0330) y no modifica
  ninguna migración existente. La rama deja seis en rojo, uno menos que `main`.
- Descartado el diagnóstico de fin de línea: `git check-attr` confirma `text:
  unset` y el blob coincide byte a byte con el disco en las migraciones que el
  ledger hashea.
- REV-SGE-046 declaró "58/58 contratos" verdes sobre un árbol SQL idéntico, así
  que la discrepancia queda **abierta y sin explicar**. Requiere investigación
  propia; no se silencia ni se da por buena.
