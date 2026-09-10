# 0428 aplicada a producción — 2026-09-10

Tarea: aplicar `0428_portal_quotes_principal_tenant` (SDD-0380). Ejecutada por el Director con
autorización nominal de Sam («aplica la 0428 también»), conforme a
`docs/runbooks/aplicar-migraciones-prod.md`.

## Resultado

**APLICADA.** Ledger de prod: 413 → 414, con el basename exacto.
Una sola sentencia efectiva: `alter policy "quotes portal self read" on public.quotes`.

## El agujero que cierra, visto en la expresión que había

Expresión **anterior** en producción:

```sql
(deleted_at IS NULL) AND (client_markbox IS NOT NULL)
AND (client_markbox = get_portal_client_markbox())
```

**Coincidía solo por `client_markbox`, sin comprobar el tenant.** La otra policy de la tabla,
`quotes by tenant`, sí acota por tenant, pero ambas son PERMISSIVE y se suman con OR; para un
usuario de Portal `get_user_tenant_id()` no lo cubre, así que la lectura quedaba decidida por
la segunda. Dos inquilinos con el mismo markbox habrían compartido cotizaciones.

Expresión **nueva**: exige que exista un `client_users` activo del usuario cuyo cliente
comparta markbox **y tenant** con la cotización.

## Vuelta atrás

Un `alter policy` no deja restore en ningún archivo: la expresión previa solo existía en la
base. Se capturó **antes** de aplicar y queda aquí, que es el único artefacto de reversión:

```sql
alter policy "quotes portal self read" on public.quotes
  using (deleted_at is null and client_markbox is not null
         and client_markbox = get_portal_client_markbox());
```

## Medición previa: cero regresión de acceso

| | |
|---|---|
| cotizaciones vivas con markbox | 14 |
| usuarios de Portal activos | 195 |
| **tenants con cotizaciones** | **1** |
| alcanzables bajo la regla **vieja** | **7** |
| alcanzables bajo la regla **nueva** | **7** |

Idéntico. Ningún usuario pierde acceso a nada. Con un solo tenant con cotizaciones la fuga aún
no era explotable: **se cierra antes de que la multi-tenencia la vuelva real**, que es el
momento correcto para cerrarla.

## Verificación posterior, contra el OBJETO

| comprobación | resultado |
|---|---|
| la expresión nueva incluye `cu.tenant_id = quotes.tenant_id` | **sí** |
| forma de la policy | `SELECT / PERMISSIVE / {authenticated}` — conservada |
| policies en la tabla | 2, sin cambio |
| `quotes by tenant` | intacta |
| ledger | 413 → **414**, basename exacto |

El preflight de la migración exige un inventario exacto de las dos policies y aborta ante
cualquier deriva; se comprobó que coincidía antes de escribir.

## Este cambio

Saca `0428_portal_quotes_principal_tenant` de `pendingBelowCutoff`. Pendientes declarados:
**13 → 12**. **El `cutoff` no se toca**, sigue en 238.

## PENDIENTES DE ESTA TAREA

Ninguno de aplicación.
