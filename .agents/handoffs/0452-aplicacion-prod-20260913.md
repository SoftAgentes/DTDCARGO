# 0452 aplicada a producción — 2026-09-13

Tarea: aplicar `0452_portal_invoices_tenant_rls` (SDD-0463) a prod y dejar el
baseline coherente. Ejecutada por el Director (sesión `director-cierre-bloque-c-20260912`)
con autorización nominal de Sam, textual: «autorizo aplicar 0452_portal_invoices_tenant_rls»,
el 2026-09-13. Runbook: `docs/runbooks/aplicar-migraciones-prod.md`.

- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0452-aplicacion-prod-20260913`.
- Rama: `codex/0452-aplicacion-prod-20260913`, desde `origin/main` `a3dbac04`.
- Alcance de ESTA rama: sólo el registro en Git. La aplicación ya ocurrió y se documenta acá.
- Permisos: commits selectivos, publicación de la rama y PR en borrador. Sin merge.

## Resultado

**APLICADA.** Ledger de prod: 448 → 449 filas, con el basename exacto como `name`,
que es lo que exige la regla hacia adelante de `check-migrations-applied.mjs`.

| Ledger | valor |
|---|---|
| `version` | `20260913175856` |
| `name` | `0452_portal_invoices_tenant_rls` |
| sentencias | 1 |
| md5 de `statements` | `85878be79c2bea3922e4a542de6e3b81` |
| bytes | 10.991 |

El md5 y el tamaño **coinciden con el blob de `main` `a3dbac04`**
(`supabase/migrations/0452_portal_invoices_tenant_rls.sql`, 205 líneas, sólo LF).
Es la misma identidad que se exigió en el lote del 2026-09-11.

## Qué cierra

La policy `invoices portal self read` de 0085 comparaba sólo el Shipping Mark, sin
tenant: con el mismo Shipping Mark en dos tenants, un cliente del Portal leía por
PostgREST, con su propio JWT, las facturas del otro tenant (medido en SDD-0462 y
SDD-0463 con datos sintéticos). SDD-0462 (PR #107, en main desde `4c07759c`) lo
cerró en la aplicación; 0452 cierra la consulta directa en la base.

## Evidencia, en orden de ejecución

Todo lo leído fue catálogo (`pg_policies`), ledger (`supabase_migrations`) y
advisors. **No se leyó ninguna fila de negocio ni dato personal.** Conector
`claude.ai Supabase`, proyecto `xpfuzqombmjmxvprjgmi`.

### 1. Preflight (antes)

- `pg_policies` de `public.invoices`: dos policies.
  - `invoices by tenant` · PERMISSIVE · `{authenticated}` · ALL ·
    `(tenant_id = get_user_tenant_id())`, con el mismo `with_check`.
  - `invoices portal self read` · PERMISSIVE · `{authenticated}` · SELECT ·
    `((deleted_at IS NULL) AND (status <> 'borrador'::invoice_status) AND (client_markbox IS NOT NULL) AND (client_markbox = get_portal_client_markbox()))` ·
    sin `with_check`. **Es exactamente la forma de 0085 que la espera anticipaba.**
- Ledger: 448 filas; `0452_portal_invoices_tenant_rls` ausente;
  `0451_aliados_cadena_mismo_tenant` ausente (sigue pendiente). Última versión:
  `20260912022928 0426_public_verify_atomic_reservation`.
- Advisors de seguridad volcados completos (recibo fuera de Git, abajo).

### 2. Aplicación

`apply_migration` con `name` = `0452_portal_invoices_tenant_rls` y el contenido
íntegro del archivo de `main`, sin modificar. Respuesta: `{"success": true}` al
primer intento. La migración es un único bloque `do` con `lock_timeout = '5s'` y
`statement_timeout = '60s'` adentro, `lock table public.invoices in access
exclusive mode`, preflight, reemplazo de la policy y postflight; ningún corte por
lock. El `NOTICE` que emite el bloque no lo devuelve el conector, así que la rama
que tomó se infiere del catálogo posterior.

### 3. Postflight (después)

- `pg_policies` de `public.invoices`: dos policies.
  - `invoices by tenant`: **idéntica** a la del preflight.
  - `invoices portal self read` · PERMISSIVE · `{authenticated}` · SELECT · sin
    `with_check` · `qual`:
    `((deleted_at IS NULL) AND (status <> 'borrador'::invoice_status) AND (client_markbox IS NOT NULL) AND (EXISTS (SELECT 1 FROM (client_users cu JOIN clients c ON (((c.id = cu.client_id) AND (c.tenant_id = cu.tenant_id) AND (c.deleted_at IS NULL)))) WHERE ((cu.auth_user_id = (SELECT auth.uid() AS uid)) AND (cu.status = 'active'::text) AND (cu.tenant_id = invoices.tenant_id) AND (c.markbox = invoices.client_markbox)))))`.
    **Es la forma final**: vínculo `client_users` activo del `auth.uid()`, cliente
    vivo del mismo tenant, tenant de la factura y Shipping Mark. Idéntica a la de
    `0414_invoices_read_rbac` (PR #106), así que L07 converge en cualquier orden.
- Ledger: la fila de arriba.
- Advisors de seguridad, antes y después: **idénticos**, incluidos los hallazgos
  uno por uno (md5 de la lista ordenada `c9937b37f34d9375037e5f1fa9d18fff` en ambos).

| Lint | Nivel | Antes | Después |
|---|---|---|---|
| `rls_enabled_no_policy` | INFO | 21 | 21 |
| `extension_in_public` | WARN | 1 | 1 |
| `anon_security_definer_function_executable` | WARN | 22 | 22 |
| `authenticated_security_definer_function_executable` | WARN | 174 | 174 |

Ninguno de los cuatro menciona `invoices`; son los mismos cuatro que registró el
lote del 2026-09-11, y esta migración no crea funciones ni toca ACL.

## Baseline

Se retira la espera `0452_portal_invoices_tenant_rls` de `pendingBelowCutoff`,
como manda su propio texto («retirar únicamente tras aplicación y verificación
autorizadas»). Queda la de `0451_aliados_cadena_mismo_tenant`, sin cambios, y
`cutoff` sigue en 238. `pending-migration-symbol-declarations.json` no tenía
declaración para 0452 (no es migrate-first) y no cambia.

## Frontera, ya aceptada

Un vínculo activo del Portal cuyo cliente está borrado, o cuyo vínculo y cliente son
de tenants distintos, deja de leer facturas por la base sin ningún mensaje: cero
filas. En la app esos principales ya no leían desde `4c07759c`. Un vínculo coherente
conserva sus facturas.

## Validación de esta rama

- PASÓ: catálogo antes y después, ledger y advisors, arriba.
- PASÓ: identidad del archivo aplicado (md5 y bytes del ledger = blob de `main`).
- Las comprobaciones locales de esta rama (baseline, símbolos, índice, `diff --check`)
  se registran en la descripción de la PR.
- NO EJECUTADO: `corepack pnpm verify`; esta rama sólo retira una espera y agrega
  este registro. `migrations-applied` con credenciales es la comprobación que
  corresponde y queda para quien tenga `.env.local`.

## Pendientes

- **Smoke de pantalla, lo hace Sam o alguien del equipo** (el Director no entra con
  cuentas reales): en el Portal, con un cliente, la lista de facturas y el detalle de
  una; en el Studio, Facturación con un usuario `accounting`. Ninguna de las dos
  debería cambiar respecto de ayer.
- Merge de esta PR, con orden de Sam.
- Recibos fuera de Git: `…/scratchpad/prod-0452/` (`advisors-security-antes.txt`,
  `advisors-security-despues.txt`, `antes.key`, `despues.key`).

## Lo que esta aplicación NO autoriza

Ni fusionar #104, #105 o #106, ni aplicar ninguna otra migración. Cada una sigue
requiriendo el OK nominal de Sam.
