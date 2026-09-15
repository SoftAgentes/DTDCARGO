# 0454 aplicada a producción — 2026-09-15

Tarea: aplicar `0454_borrar_cliente_revoca_portal` (SDD-0467) a producción y dejar el baseline
coherente. La ejecutó el Director con autorización nominal de Sam, en el mismo mensaje que autorizó el
merge de la PR #120. Texto literal del mensaje:

> «autorizo fusionar la #120»
> «autorizo aplicar 0454_borrar_cliente_revoca_portal» (si quieres los conteos agregados, dilo en el mismo mensaje)

El paréntesis es el texto de la plantilla que le propuso el Director, copiado tal cual. No es un
pedido de conteos agregados, así que no se leyó ningún conteo. Runbook:
`docs/runbooks/aplicar-migraciones-prod.md`.

- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0454-aplicacion-prod-20260915`.
- Rama: `codex/0454-aplicacion-prod-20260915`, desde `origin/main` `4d8dee12` (merge de la PR #120).
- Owner del claim: `director-0454-aplicacion-prod-20260915`.
- Alcance de esta rama: solo el registro en Git (espera retirada, nota en la spec y este documento).
  La aplicación ya ocurrió y se documenta aquí.
- Permisos: commits selectivos, publicación de la rama y PR en borrador. Sin merge.

## OBJETIVO ORIGINAL

Que el borrado lógico de un cliente revoque en la base, en el mismo acto, su acceso al Portal
(SDD-0467), aplicando la migración 0454 ya integrada en `main` y dejando evidencia de su identidad,
su lectura previa, su postflight y los advisors de seguridad.

## COMPLETADO

**APLICADA.** El ledger de producción pasó de 458 a 459 filas, con el basename exacto como `name`.

| Ledger | valor |
|---|---|
| `version` | `20260915155857` |
| `name` | `0454_borrar_cliente_revoca_portal` |
| sentencias | 1 |
| md5 de `statements` | `02623202e197dd9ff1e6de90b0340876` |
| bytes | 30.505 |

El md5 y el tamaño **coinciden con el blob de `main` `4d8dee12`**:
`supabase/migrations/0454_borrar_cliente_revoca_portal.sql`, blob `d5b6d16a`, 573 líneas, solo LF y
con salto final. Es el mismo blob que revisó el Director en `c2b04700`.

Qué cierra:

- Un trigger AFTER UPDATE en `clients` hace que, cuando `deleted_at` pasa de NULL a un valor, en la
  misma transacción se revoque todo `client_users` del cliente (`revoked`, `revoked_at`, sin
  `auth_user_id` ni `token`) y todo `portal_access_links` sin revocar. Cubre la acción del Studio,
  `merge_clients` y cualquier UPDATE directo.
- Dos guardas BEFORE rechazan con 23514 vínculos `invited`/`active` o códigos sin revocar sobre un
  cliente inexistente o borrado.
- El backfill revocó lo que ya estaba vigente sobre clientes borrados (ver «Backfill»).

Cronología (UTC): merge de #120 a las 15:55:05; aplicación a las 15:58:57, según la versión del ledger.

### 1. Lectura previa (antes)

Todo lo leído fue catálogo, ledger y advisors. **No se leyó ninguna fila de negocio ni dato
personal**, ni conteos agregados. Conector `claude.ai Supabase`, proyecto `xpfuzqombmjmxvprjgmi`.
Se leyó una vez antes de pedir la autorización y se repitió inmediatamente antes de aplicar, con el
mismo resultado.

| Lo que exige el preflight | Producción |
|---|---|
| Versión (formato de `pg_get_triggerdef`) | PostgreSQL 17.6; el contrato se probó en PostgreSQL 17 |
| RLS evitable por el rol que aplica | `postgres`: `rolsuper` false, `rolbypassrls` true, dueño de las tres tablas |
| Tablas | `clients`, `client_users`, `portal_access_links` con RLS, sin FORCE, dueño `postgres` |
| Columnas que nombran las funciones | todas presentes |
| CHECK de status de `client_users` | `CHECK((status=ANY(ARRAY['invited'::text,'active'::text,'revoked'::text])))`, idéntico a 0080 |
| `merge_clients(uuid,uuid)` | SECURITY DEFINER, md5(prosrc) `1a65fc744a15d060e4a441c8c8270bad`; fragmentos revocar/mudar/retirar en posiciones 2206, 2335 y 6180 (revocar y mudar antes de retirar) |
| `portal_bind_session()` | SECURITY DEFINER, md5(prosrc) `f184110c0dffe943cd02cb973f081881`; los tres fragmentos en 222, 440 y 577 |
| Tipo `portal_invitation` (trigger `audit_d5_client_users` vivo) | `active` |
| Triggers de las tres tablas | 8, ninguno con nombre de 0454 |
| Funciones de 0454 | ausentes |
| Ledger | 458 filas, última `20260914145345`, sin 0454 |

Además, como referencia para el postflight: 4 policies en las tres tablas; ACL de las tres tablas; y
md5 y ACL de `portal_invite_client`, `portal_revoke_client`, `portal_create_access_link` y
`portal_revoke_access_link`.

### 2. Aplicación

`apply_migration` con `name` = `0454_borrar_cliente_revoca_portal` y el contenido íntegro del blob de
`main`, sin modificar. Respuesta: `{"success": true}` al primer intento. El preflight, el backfill y el
postflight propios de la migración corren en la misma transacción: si cualquiera hubiera fallado, no
habría cambiado nada.

### 3. Postflight de catálogo (después)

- `clients_revoke_portal_access()` y `portal_access_require_live_client()` quedaron SECURITY DEFINER,
  volátiles y con `search_path=""`. Su dueño es `postgres`, la ACL `{postgres=X/postgres}`, y
  `has_function_privilege` da false para `anon`, `authenticated` y `service_role`.
- Los tres triggers quedaron habilitados, y su `pg_get_triggerdef` normalizado es exactamente la forma
  esperada:
  - `clients_revoke_portal_on_soft_delete`: AFTER UPDATE ON public.clients, WHEN
    `old.deleted_at IS NULL AND new.deleted_at IS NOT NULL`;
  - `client_users_require_live_client`: BEFORE INSERT OR UPDATE OF status, client_id, WHEN status en
    invited o active;
  - `portal_access_links_require_live_client`: BEFORE INSERT OR UPDATE OF revoked_at, client_id, WHEN
    `revoked_at IS NULL`.
- Los 8 triggers anteriores de las tres tablas siguen iguales y habilitados; en total quedan 11.
- Sin cambios: dueño, RLS, FORCE y ACL de las tres tablas; las 4 policies; el md5 de `merge_clients`
  y `portal_bind_session`; y el md5 y la ACL de las otras cuatro RPC del Portal.
- Ledger: la fila de arriba; 459 filas.

### 4. Advisors de seguridad

Dos fotos completas, cada una de 102.181 caracteres y leída entera por script: una inmediatamente
antes de aplicar y otra después. Se quitó `observed_at` a cualquier profundidad, porque cambia en
cada llamada. Con eso, **las dos fotos son idénticas**: md5 total normalizado
`07ffdb519be2d57607ce4e5a0a91f7ba`. Ningún hallazgo nombra las funciones de 0454. Esta vez no hubo
foto de control; el método quedó validado con una en la aplicación de 0453.

| Lint | Nivel | Antes | Después |
|---|---|---:|---:|
| `anon_security_definer_function_executable` | WARN | 22 | 22 |
| `authenticated_security_definer_function_executable` | WARN | 178 | 178 |
| `extension_in_public` | WARN | 1 | 1 |
| `rls_enabled_no_policy` | INFO | 22 | 22 |

### Backfill

El conector devuelve solo `{"success": true}` y no muestra el NOTICE con los conteos agregados del
backfill. Tampoco se leyeron conteos por separado: no se pidieron. Lo que sí rige desde la aplicación
es el invariante que el postflight de la migración exige dentro de la transacción: cero vínculos
`client_users` vigentes o incompletos y cero códigos cortos sin revocar sobre clientes borrados. Si
hubiera quedado alguno, la aplicación se habría revertido entera. El conteo agregado del 2026-09-14
daba 1 vínculo activo con cliente borrado. Los eventos D5 del backfill, append-only, quedan con actor
`system` y el motivo de la migración.

### Baseline

Sale la espera `0454_borrar_cliente_revoca_portal` de `pendingBelowCutoff`, como manda su propio
texto. Quedan `0415`, `0414`, `0422` y `0423` sin cambios, y `cutoff` sigue en 238. Antes de editar se
verificó que `JSON.stringify(…, null, 2)` reproduce el archivo de `main` byte a byte.
`pending-migration-symbol-declarations.json` no tenía declaración para 0454 y no cambia.

### Spec

La sección «Producción» de SDD-0467 lleva la nota de aplicación: ledger, md5, bytes, lectura previa,
postflight, advisors y backfill. El `status` sigue en `in-progress` hasta el smoke de Sam, y las
fechas no cambian.

## VALIDACIÓN

- PASÓ: catálogo antes y después, ledger y advisors, arriba.
- PASÓ: identidad del archivo aplicado, con md5 y bytes del ledger iguales al blob de `main`.
- PASÓ: en esta rama, `node scripts/build-docs-index.mjs --check`, `node scripts/check-numbering.mjs`,
  `node scripts/check-pending-migration-symbols.mjs`, JSON válido y `git diff --check`. Detalle en la
  PR.
- PASÓ, antes del merge sobre `c2b04700`: los 195 contratos SQL en PostgreSQL efímero, incluido el de
  0454, corridos por el Director sobre una copia exportada; y «Calidad local sin secretos» y Vercel en
  la PR #120.
- Merge `4d8dee12` en `main`: deploy de Vercel en success; «Calidad continua», en la PR de este
  registro.
- NO DISPONIBLE: `node scripts/check-migrations-applied.mjs`, SKIP sin credenciales; el ledger se
  verificó por el conector.
- NO EJECUTADO: `corepack pnpm verify`; esta rama solo retira una espera y agrega documentación.

## COMMITS

- «commit que contiene este documento»: registro de la aplicación de 0454 (baseline, spec y handoff).

## PR / BRANCH

- Rama `codex/0454-aplicacion-prod-20260915` desde `main` `4d8dee12`. PR en borrador contra `main`; su
  URL queda en la descripción de la PR y en el cierre del Director.

## PENDIENTES DE ESTA TAREA

- **Smoke de Sam en producción:** en Studio › Clientes, borrar un cliente de prueba que tenga acceso
  al Portal y comprobar que su tarjeta muestra el acceso revocado y que no puede entrar al Portal. Si
  se usa un cliente real, el borrado es real.
- Merge de la PR de este registro, con OK de Sam.
- `migrations-applied` con credenciales después del merge.

## FUERA DE ALCANCE DETECTADO

- El conector `apply_migration` no muestra los NOTICE. Una migración que reporte conteos por NOTICE
  necesita otra vía para verlos, por ejemplo una consulta agregada autorizada.
- Siguen en pie los hallazgos del Worker (`.agents/handoffs/borrar-cliente-revoca-portal.md`):
  - la confirmación de borrado es inline, no un ConfirmDialog R2;
  - el borrado lógico del cliente no deja evento de auditoría;
  - la fila revocada conserva `email` y fechas sin plazo de retención;
  - la acción no detecta cuando no alcanza ninguna fila;
  - no hay contrato propio de 0080.

## HANDOFF AL DIRECTOR

- Siguiente acción: el smoke de Sam y el merge de esta PR con su OK.
- Worktrees que quedan para limpiar con autorización: este, el del Worker
  (`borrar-cliente-revoca-portal`) y el del rediseño del enlace del proveedor
  (`portal-enlace-proveedor-ux`).
- Lo que esta aplicación NO autoriza: fusionar #114, aplicar `0415`, `0422`, `0423` o `0414`, ni leer
  conteos o filas de negocio. Cada una sigue requiriendo su autorización.
- El claim `director-0454-aplicacion-prod-20260915` se libera al publicar.
