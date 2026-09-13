# 0451 aplicada a producción y conteo de la fuga del Portal — 2026-09-13

Tarea: aplicar `0451_aliados_cadena_mismo_tenant` (SDD-0461) a prod, dejar el baseline
coherente y registrar el conteo agregado de la fuga del Portal autorizado el mismo día.
Ejecutada por el Director (sesión `director-cierre-bloque-c-20260912`). Runbook:
`docs/runbooks/aplicar-migraciones-prod.md`.

- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0451-aplicacion-prod-20260913`.
- Rama: `codex/0451-aplicacion-prod-20260913`, desde `origin/main` `76797beb`.
- Alcance de ESTA rama: sólo el registro en Git. La aplicación ya ocurrió y se documenta acá.
- Permisos: commits selectivos, publicación de la rama y PR en borrador. Sin merge.

## Autorización

Sam autorizó por nombre el 2026-09-13 los pendientes enumerados por el Director en la sesión,
que incluían `0451_aliados_cadena_mismo_tenant`, con el texto «te autorizo todos los pendientes
que estén. Voy a salir. Necesito que trabajes en todos los pendientes», inmediatamente después
de dos mensajes del Director que listaban cada migración por su nombre exacto y el orden.
Los cierres finales (`0414`, `0415`, `0422`, `0423`) quedaron excluidos a propósito: su orden
exige antes despliegue y una prueba de pantalla con cuentas reales.

## Resultado

**APLICADA.** Ledger de prod: 456 → 457 filas, con el basename exacto como `name`.

| Ledger | valor |
|---|---|
| `version` | `20260913224613` |
| `name` | `0451_aliados_cadena_mismo_tenant` |
| sentencias | 1 |
| md5 de `statements` | `f080433e7c647a462f240680ea87621d` |
| bytes | 16.477 |

Identidad del archivo en `main` `76797beb`: `md5sum` = `f080433e7c647a462f240680ea87621d`,
`wc -c` = 16.477, 0 CR. Coinciden con el ledger.

Conector: `claude.ai Supabase`, proyecto `xpfuzqombmjmxvprjgmi`, `apply_migration` con name
exacto, `{"success": true}` al primer intento. Ninguna fila de negocio leída.

## Preflight (solo agregados y catálogo)

- Conteos exigidos por la espera, repetidos antes de aplicar: 0 aliados cuyo padre está en
  otro tenant; 0 aliados cuyo cliente-ancla está en otro tenant; 3 aliados en total.
- El preflight interno de la migración repitió los dos conteos dentro de la misma
  transacción, con `aliados` y `clients` en ACCESS EXCLUSIVE y `lock_timeout` 5 s.
- Ninguna de las cuatro constraints existía antes salvo `aliados_tenant_id_id_key` (creada por
  la 0450, aplicada el 2026-09-12).

## Postflight (catálogo, sin filas)

- `clients_tenant_id_id_key` (u), `aliados_tenant_id_id_key` (u),
  `aliados_parent_mismo_tenant_fkey` (f) y `aliados_client_mismo_tenant_fkey` (f): existen y
  `convalidated = true`.
- `get_portal_brand()`: `SECURITY DEFINER`, `search_path=""`, ACL
  `{postgres=X, authenticated=X}`; su cuerpo contiene `a.tenant_id = c.tenant_id`.
- Advisors de seguridad de producción, comparados hallazgo por hallazgo con la foto previa del
  mismo bloque: 0451 no agregó ni quitó ningún hallazgo (`get_portal_brand()` ya figuraba como
  definer ejecutable por authenticated desde la 0401).

## Conteo agregado de la fuga del Portal (autorizado el 2026-09-13)

Consulta de solo agregados, sin filas ni datos personales, sobre `client_users`, `clients` e
`invoices`, más dos conteos de dimensionamiento:

| Conteo | Resultado |
|---|---:|
| Facturas de otro tenant alcanzables por un vínculo activo del Portal | 0 |
| Vínculos activos con cliente borrado | 0 |
| Vínculos activos incoherentes (tenant del vínculo ≠ tenant del cliente) | 0 |
| Usuarios del Portal afectados | 0 |
| Shipping Marks vivos presentes en más de un tenant | 0 |
| Usuarios activos del Portal con un Shipping Mark compartido | 0 |
| Tenants en producción | **1** |
| Usuarios activos del Portal | 205 |

Lectura: la condición que dispara la fuga corregida por SDD-0462 (PR #107) y SDD-0463
(0452) —dos tenants compartiendo un Shipping Mark— no existe en los datos, porque producción
tiene un solo tenant. La exposición **no pudo ocurrir**. Es una cota superior sobre el estado
actual de los datos, no un registro de accesos. Toda la frontera multi-tenant aplicada este
fin de semana (0450, 0451, 0452, 0420, 0407) es preventiva hasta que entre un segundo tenant.

## Baseline

- Retirada la espera `0451_aliados_cadena_mismo_tenant` de `pendingBelowCutoff`. Queda sólo la
  de `0415_mail_logs_read_rbac`. `cutoff` 238 y `$doc` intactos.
- La spec 0461 actualiza su sección «Producción» y la viñeta del alcance.

## Aplicaciones del mismo bloque, registradas en sus propias PR

El mismo 2026-09-13, con la misma autorización, el Director aplicó de a una `0410` (registro en
la ronda 2 de la PR #105, ya fusionada), `0420` y `0421` (ronda 2 de la PR #104) y `0407`,
`0411`, `0412` y `0413` (ronda 4 de la PR #106). Ledger final del día: 457 filas.

## Validación de esta rama

- `node scripts/build-docs-index.mjs --check`, `corepack pnpm sdd:check`,
  `corepack pnpm exec vitest run scripts/check-migrations-applied.test.mjs`,
  `corepack pnpm harness:test`, `corepack pnpm governance:check` y `git diff --check`: ver el
  veredicto en la descripción de la PR.
- `corepack pnpm verify`: NO EJECUTADO, sólo cambian el baseline, una spec y este handoff; no
  hay cambio de producto ni de SQL.

## Pendientes fuera de esta tarea

- Prueba de pantalla de Cobranzas (vista previa de recordatorios con accounting y admin) y,
  después, `0415_mail_logs_read_rbac` con OK nominal.
- Fusión y despliegue de las PR #104 y #106 tras sus rondas; smoke por roles; después
  `0422` → `0423` y `0414`, cada una con OK nominal.
