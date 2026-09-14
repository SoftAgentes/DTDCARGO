# 0453 aplicada a producción — 2026-09-14

Tarea: aplicar `0453_portal_helpers_principal_determinista` (SDD-0466) a producción y dejar el
baseline coherente. Ejecutada por el Director (sesión `director-ola-post-bloque-c-20260914`) con
autorización nominal de Sam, textual: «autorizo aplicar 0453_portal_helpers_principal_determinista»,
el 2026-09-14, después del resumen del Director que exponía la deriva del cuerpo de 0198 en producción,
el vínculo activo del Portal con cliente borrado y los locks medidos. Runbook:
`docs/runbooks/aplicar-migraciones-prod.md`.

- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0453-aplicacion-prod-20260914`.
- Rama: `codex/0453-aplicacion-prod-20260914`, desde `origin/main` `4b01ac58`.
- Owner del claim: `director-0453-aplicacion-prod-20260914`.
- Alcance de ESTA rama: sólo el registro en Git (espera retirada, nota en la spec y este documento).
  La aplicación ya ocurrió y se documenta acá.
- Permisos: commits selectivos, publicación de la rama y PR en borrador. Sin merge.

## Resultado

**APLICADA.** Ledger de producción: 457 → 458 filas, con el basename exacto como `name`.

| Ledger | valor |
|---|---|
| `version` | `20260914145345` |
| `name` | `0453_portal_helpers_principal_determinista` |
| sentencias | 1 |
| md5 de `statements` | `bceb07887ca0e4ddbd0c7a638ea645b4` |
| bytes | 25.194 |

El md5 y el tamaño **coinciden con el blob de `main` `4b01ac58`**
(`supabase/migrations/0453_portal_helpers_principal_determinista.sql`, blob `2ca2f68a`, 399 líneas,
sólo LF, con salto final).

## Qué cierra

- `get_user_tenant_id()` devuelve el tenant de la única membresía activa; con cero o con más de una,
  NULL.
- `get_portal_client_markbox()` devuelve el Shipping Mark del único vínculo activo cuyo cliente vive y
  comparte tenant con el vínculo; en otro caso, NULL.
- El trigger de direcciones de entrega exige, cuando hay principal, membresía activa en el tenant del
  cliente o un vínculo activo a ese mismo cliente (`42501` si no); sin principal conserva el sellado de
  0198.

Producción tiene un solo tenant: la frontera es preventiva.

## Evidencia, en orden de ejecución

Todo lo leído fue catálogo, ledger, advisors y tres conteos agregados. **No se leyó ninguna fila de
negocio ni dato personal.** Conector `claude.ai Supabase`, proyecto `xpfuzqombmjmxvprjgmi`.

### 1. Lectura previa repetida (antes)

| Función | Cuerpo normalizado | md5(prosrc) | proconfig | ACL |
|---|---|---|---|---|
| `get_user_tenant_id()` | igual al de 0200 | `6babf6f94a6be61d8aa84b29569e5ed1` | `{search_path=public}` | `{postgres=X/postgres,authenticated=X/postgres}` |
| `get_portal_client_markbox()` | igual al de 0080 | `534992e19130b72253ac4bb7a55ff37d` | `{search_path=public}` | `{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}` |
| `client_delivery_addresses_validate_client()` | forma Cloud de 0198, sin su comentario | `7db6f812a549df579f2d7d0d6cd72298` | `{search_path=public}` | `{postgres=X/postgres,service_role=X/postgres}` |

- Las tres SECURITY DEFINER con dueño `postgres`; las dos helpers estables y la del trigger volátil.
  Idénticas a la primera lectura, hecha en la madrugada del mismo día.
- Triggers de `client_delivery_addresses`: `client_delivery_addresses_touch` (tgtype 19) y
  `client_delivery_addresses_validate_trg` (tgtype 23, habilitado).
- Policies que nombran `get_portal_client_markbox()`: 0. Funciones que la nombran: 0. Policies que
  nombran `get_user_tenant_id()`: 302.
- Conteos agregados: 0 usuarios con más de una membresía activa; 1 vínculo activo con cliente borrado;
  0 vínculos activos con tenant distinto. Iguales a la primera lectura.
- Ledger: 457 filas; la última, `20260913224613 0451_aliados_cadena_mismo_tenant`; 0453 ausente.

### 2. Aplicación

`apply_migration` con `name` = `0453_portal_helpers_principal_determinista` y el contenido íntegro del
archivo de `main`, sin modificar. Respuesta: `{"success": true}` al primer intento. El preflight y el
postflight propios de la migración corren dentro de la misma transacción: cualquier fallo habría
devuelto un error sin cambiar nada.

### 3. Postflight (después)

| Función | md5(prosrc) nuevo | proconfig |
|---|---|---|
| `get_user_tenant_id()` | `5ff0c51c26a49419c34abc78f1d95c37` | `search_path=""` |
| `get_portal_client_markbox()` | `40d7c1204c4976e1c2c207505bfbc7d8` | `search_path=""` |
| `client_delivery_addresses_validate_client()` | `a8ac9ba8b34af0a9c6ce185285852f6e` | `search_path=""` |

- Los tres cuerpos normalizados son exactamente las formas finales de la migración.
- ACL, dueño, SECURITY DEFINER y volatilidad: **idénticos** a los de la lectura previa.
- Triggers: idénticos. Policies y funciones que nombran la helper del Portal: 0 y 0. Policies con la
  helper de tenant: 302, como antes.
- Sin JWT, las dos helpers devuelven NULL.
- Ledger: la fila de arriba; 458 filas.

### 4. Advisors de seguridad

Tres fotos completas, cada una de 102.181 caracteres y leída entera por script: una de control a las
07:00 UTC, sin cambios en la base desde entonces; otra inmediatamente antes de aplicar; otra después.
El campo `observed_at` de cada hallazgo cambia en cada llamada. Excluyéndolo y ordenando los hallazgos
normalizados, **las tres fotos son idénticas** (md5 total `d7097c1a40b934baaa3b42245dbcbd83`); la
igualdad de la foto de control con la de antes valida el método.

| Lint | Nivel | Antes | Después |
|---|---|---:|---:|
| `anon_security_definer_function_executable` | WARN | 22 | 22 |
| `authenticated_security_definer_function_executable` | WARN | 178 | 178 |
| `extension_in_public` | WARN | 1 | 1 |
| `rls_enabled_no_policy` | INFO | 22 | 22 |

Los dos hallazgos que nombran funciones de 0453 (EXECUTE de `authenticated` sobre las dos helpers
SECURITY DEFINER) existían antes y siguen igual: la migración no cambia ACL.

## Baseline

Se retira la espera `0453_portal_helpers_principal_determinista` de `pendingBelowCutoff`, como manda
su propio texto. Quedan `0415`, `0414`, `0422` y `0423` sin cambios, y `cutoff` sigue en 238. Antes de
editar se verificó que `JSON.stringify(…, null, 2)` reproduce el archivo de `main` byte a byte.
`pending-migration-symbol-declarations.json` no tenía declaración para 0453 y no cambia.

## Spec

Nota de aplicación en la sección «Producción» de SDD-0466: ledger, md5, bytes, lectura repetida,
postflight y smoke pendiente. `status` y fechas sin cambios.

## Impacto observado y frontera aceptada

- Nadie tiene más de una membresía activa: el Studio no cambia para nadie.
- El vínculo activo con cliente borrado deja de resolver Shipping Mark por la helper. La app ya lo
  rechazaba (`lib/portal/portal-queries.ts:89-95` y `app/portal/(app)/layout.tsx:39-40`) y ninguna policy
  usa la helper, así que no cambia ninguna lectura visible.
- Origen probable de ese vínculo: `softDeleteClientAction` borra el cliente sin revocar su acceso al
  Portal. Queda fuera de esta tarea; revocarlo en producción es una escritura con autorización propia.

## Validación de esta rama

- PASÓ: catálogo antes y después, ledger, conteos y advisors, arriba.
- PASÓ: identidad del archivo aplicado (md5 y bytes del ledger iguales al blob de `main`).
- PASÓ: `node scripts/build-docs-index.mjs --check` (454 specs), `node scripts/check-numbering.mjs`,
  `node scripts/check-pending-migration-symbols.mjs` (0 ROJO · 0 AMARILLO), JSON válido y
  `git diff --check`.
- NO DISPONIBLE: `node scripts/check-migrations-applied.mjs`, SKIP sin credenciales en este worktree.
- NO EJECUTADO: `corepack pnpm verify`; esta rama sólo retira una espera y agrega documentación.

## Pendientes

- **Smoke de pantalla, lo hace Sam o alguien del equipo:** una sesión del Studio (lista de clientes) y
  una del Portal (Mi perfil › Direcciones y envíos). Nada debería cambiar respecto de ayer.
- Merge de esta PR, con OK de Sam.
- `migrations-applied` con credenciales después del merge.

## Lo que esta aplicación NO autoriza

Ni fusionar #114, ni aplicar `0415`, `0422`, `0423` o `0414`, ni revocar el vínculo del Portal con
cliente borrado. Cada una sigue requiriendo su autorización.
