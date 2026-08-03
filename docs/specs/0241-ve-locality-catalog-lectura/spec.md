---
sdd: "0241"
title: "El catálogo de localidades VE quedó ilegible: RLS encendida sin política"
status: done
author: "Sam (founder) + Claude"
created: 2026-08-03
updated: 2026-08-03
supersedes: null
superseded_by: null
related: ["0024", "0085"]
confidencialidad: interna
---

# SDD-0241 · El catálogo de localidades VE quedó ilegible

## 1. El problema

`/studio/admin/rutas` no deja dar de alta una ciudad. El cascade
Estado → Municipio → Ciudad → CP de `CityDrawer` aparece vacío.

La causa está en la base, no en el código:

```
ve_locality_catalog · relrowsecurity = true · políticas = 0 · filas = 98
grants de authenticated: SELECT ✅
```

**RLS encendida + cero políticas = nadie ve nada.** El GRANT sigue ahí, pero
sin una política que lo deje pasar, `authenticated` lee **cero filas** de las
98 que existen. `listVeLocalities`
([`lib/studio/dispatch-routes-queries.ts:92`](../../../lib/studio/dispatch-routes-queries.ts))
devuelve vacío y el drawer no tiene qué ofrecer.

## 2. De dónde salió

`0024_dispatch_core.sql` creó la tabla **explícitamente sin RLS**. Su propio
comentario lo dice:

```sql
-- 1. ve_locality_catalog (PÚBLICO · sin RLS · solo lectura)
...
grant select on public.ve_locality_catalog to anon, authenticated;
```

Y es lo correcto: es un catálogo inmutable de referencia —24 estados, 98
ciudades, códigos postales de IPOSTEL— sin `tenant_id` y sin dato de nadie.

**Ninguna migración del repo la enciende.** Se activó a mano en producción,
casi con seguridad respondiendo al aviso `rls_enabled_no_policy` del advisor
de Supabase. Ese es el patrón que hay que reconocer:

> El advisor dice "esta tabla no tiene RLS". Le prendés RLS. El aviso se
> apaga. Y acabás de **negar todo el acceso** sin que nada falle: no hay
> error, no hay log, sólo una lista vacía. El arreglo se ve más seguro y el
> módulo se rompe en silencio.

## 3. Alcance: es UNA tabla, no diecinueve

El advisor reporta **19** tablas con `rls_enabled_no_policy`. Medidas contra
los GRANT reales, **18 no son un bug**:

| | Tablas | Estado |
|---|---|---|
| `anon`/`authenticated` **con** SELECT | `ve_locality_catalog` | 🔴 **rota** — 98 filas invisibles |
| `anon`/`authenticated` **sin** SELECT | las otras 18 (`entity_audit_log`, `audit_*`, `ocean_rates`, `*_throttle`, `operario_pin_attempts`…) | ✅ correcto — sólo `service_role`, que bypassea RLS |

En esas 18, RLS-sin-política es defensa en profundidad deliberada: sin GRANT
ya no se llega, y la RLS es el segundo cerrojo. El aviso del advisor es `INFO`
justamente por eso.

## 4. Decisión

**Escribir la política de lectura. No apagar RLS.**

Apagar RLS también devolvería el acceso — y reabriría el aviso que originó
todo esto, dejando el mismo pie para que alguien lo vuelva a "arreglar" igual.
La política explícita deja las dos cosas bien: el acceso funciona y **la
intención queda escrita** en vez de vivir en la ausencia de RLS.

Que la tabla sea legible por cualquiera no es un descuido: es su propósito.

La migración **también enciende RLS**, aunque el repo diga que la tabla no la
tiene. Así un schema reconstruido desde cero queda igual que producción en vez
de divergir — que es lo único que hace útil al paso `schema-rebuild`.

**Sigue siendo de sólo lectura.** Sin políticas de INSERT/UPDATE/DELETE y con
el GRANT limitado a SELECT, el catálogo permanece inmutable para
`authenticated`. Se siembra por migración.

## 5. Alcance

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0338_ve_locality_catalog_read_policy.sql` | `enable row level security` + política de SELECT para `anon`/`authenticated` |
| `supabase/tests/0338_ve_locality_catalog_read_policy.test.sql` | contrato |

## 6. Verificación

El contrato **no comprueba que la política exista** —eso sería comprobar la
cura, no la enfermedad— sino que **las filas se leen desde el rol real**, con
`set role`. Un test que mirara `pg_policies` seguiría verde ante una política
cuyo `using` no matchea nada.

Cuatro casos: RLS quedó activa (apagarla no cuenta como cura) · `authenticated`
lee · `anon` lee · sigue siendo **inmutable** para `authenticated` (si alguien
lo "arregla" con `for all using (true)`, se pone rojo).

Mutación: quitar la política → *"authenticated ve 0 fila(s), esperaba 2 · el
cascade Estado→Municipio→Ciudad→CP de /studio/admin/rutas queda vacío"*.

## 7. Aplicación a producción · ✅ 2026-08-03

Aplicada con OK del founder, de a una, por
[`docs/runbooks/aplicar-migraciones-prod.md`](../../runbooks/aplicar-migraciones-prod.md).
`name` en el ledger = `0338_ve_locality_catalog_read_policy` (basename exacto).

Verificado **contra el objeto**, y lo primero es lo único que prueba la cura:

| Comprobación | Antes | Después |
|---|---|---|
| **Filas que ve `authenticated`** (`set role`) | **0** de 98 | **98** de 98 |
| RLS activa | sí | **sí** (la cura no fue apagarla) |
| Políticas | 0 | 1 |
| Comandos que cubre la política | — | `SELECT` únicamente |
| GRANTs de escritura a `authenticated` | 0 | **0** (sigue inmutable) |
| Paso `migrations-applied` del gate | 🔴 | verde |

`/studio/admin/rutas` vuelve a ofrecer el cascade Estado → Municipio → Ciudad →
CP: son las mismas 98 filas que ya estaban en la tabla y que nadie podía ver.
