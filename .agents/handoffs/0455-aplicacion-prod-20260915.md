# 0455 aplicada a producción — 2026-09-15

Tarea: aplicar `0455_borrado_cliente_auditado` (SDD-0469) a producción en orden migrate-first, fusionar
la PR #122 inmediatamente después y dejar el baseline y las declaraciones de símbolos coherentes. La
ejecutó el Director con autorización nominal de Sam. Texto literal del mensaje:

> autorizo aplicar 0455_borrado_cliente_auditado»
> «autorizo fusionar la #122»: la fusiono después de aplicar la migración.

La segunda frase del mensaje es la plantilla del Director copiada. No pide conteos agregados y no se
leyó ninguno. Runbook: `docs/runbooks/aplicar-migraciones-prod.md`.

- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0455-aplicacion-prod-20260915`.
- Rama: `codex/0455-aplicacion-prod-20260915`, desde `origin/main` `42f80bea` (merge de la PR #122).
- Owner del claim: `director-0455-aplicacion-prod-20260915`.
- Alcance de esta rama: solo el registro en Git. Retira la espera del baseline y la declaración de
  símbolos, agrega la nota en la spec y este documento.
- Permisos: commits selectivos, publicación de la rama y PR en borrador. Sin merge.

## OBJETIVO ORIGINAL

Que el borrado lógico de un cliente deje un evento de auditoría atómico con la mutación, y que el
Studio borre por la RPC que detecta cero filas (SDD-0469). El orden exige aplicar primero la migración
0455, fusionar la PR #122 dentro de las 24 h siguientes y registrar la evidencia.

## COMPLETADO

**APLICADA Y FUSIONADA.** El ledger de producción pasó de 459 a 460 filas, con el basename exacto como
`name`.

| Ledger | valor |
|---|---|
| `version` | `20260915183459` |
| `name` | `0455_borrado_cliente_auditado` |
| sentencias | 1 |
| md5 de `statements` | `a4b7398aac442b5279fc2b35930011fc` |
| bytes | 23.394 |

El md5 y el tamaño **coinciden con el blob que revisó el Director** en `4ea05e47`:
`supabase/migrations/0455_borrado_cliente_auditado.sql`, blob `354e3c98`, 455 líneas, solo LF y con
salto final. Es el mismo blob que quedó en `main` con el merge `42f80bea`.

Cronología (UTC):
- aplicación: 18:34:59, según la versión del ledger;
- merge de #122: 18:35:53.

Entre las dos pasó menos de un minuto: no hubo ventana con la migración aplicada y sin su archivo en
`main`, ni con el código nuevo desplegado sin la migración.

Qué cierra:
- El trigger AFTER UPDATE `clients_audit_soft_delete` escribe en la misma transacción un evento
  `client_deleted` cuando `deleted_at` pasa de NULL a un valor, o `client_merged` cuando el mismo UPDATE
  fija `merged_into_client_id`.
  - El evento lleva tenant, actor, antes/después de `deleted_at` y `merged_into_client_id`, y motivo.
  - Si el evento no se puede escribir, no hay borrado ni revocación del Portal.
- La RPC `soft_delete_client_with_audit_reason(uuid, text)` es SECURITY INVOKER: recibe un motivo
  opcional y devuelve `false` si no alcanzó ninguna fila.
- El Studio desplegado desde `42f80bea` borra por esa RPC con un ConfirmDialog R2.

### 1. Lectura previa (antes)

Todo lo leído fue catálogo, ledger y advisors. **No se leyó ninguna fila de negocio ni dato
personal**, ni conteos. Conector `claude.ai Supabase`, proyecto `xpfuzqombmjmxvprjgmi`.

La lectura se hizo dos veces, con el mismo resultado: una antes de pedir la autorización y otra
inmediatamente antes de aplicar. Siguió la lista completa que dejó la revisión de #122.

| Lo que exige el preflight | Producción |
|---|---|
| Versión y rol que aplica | PostgreSQL 17.6; `postgres` con `rolsuper` false y `rolbypassrls` true; existen `anon`, `authenticated` y `service_role` |
| `clients` | RLS activa, sin FORCE, dueño `postgres`; columnas `id`, `tenant_id`, `deleted_at` y `merged_into_client_id` |
| `append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)` | Resuelve; SECURITY DEFINER, `search_path=""`, dueño `postgres`, ACL `{postgres=X/postgres,service_role=X/postgres}`, ejecutable por el rol que aplica |
| Tipo de entidad `client` | `active` |
| Trigger de 0454 | `clients_revoke_portal_on_soft_delete` habilitado, con la definición exacta que exige 0455 |
| Triggers de `clients` | 7, todos del repo; las funciones con `search_path` propio |
| `merge_clients(uuid,uuid)` | SECURITY DEFINER, md5(prosrc) `1a65fc744a15d060e4a441c8c8270bad`; el UPDATE único de retiro en la posición 6130 y el fragmento prohibido ausente |
| Objetos de 0455 | ausentes |
| Ledger | 459 filas, última `20260915155857`, sin 0455 |

### 2. Aplicación

`apply_migration` con `name` = `0455_borrado_cliente_auditado` y el contenido íntegro del blob revisado,
sin modificar. Respuesta: `{"success": true}` al primer intento. El preflight y el postflight de la
migración corren en la misma transacción.

### 3. Postflight de catálogo (después)

- `clients_audit_soft_delete()`: SECURITY DEFINER, volátil, `trigger`, `search_path=""`, dueño
  `postgres`, ACL `{postgres=X/postgres}`; ningún rol de la API lo ejecuta.
- `soft_delete_client_with_audit_reason(uuid,text)`: SECURITY INVOKER, volátil, `boolean`,
  `search_path=""`, dueño `postgres`, ACL `{postgres=X/postgres,authenticated=X/postgres}`. La ejecuta
  `authenticated` y no `anon` ni `service_role`.
- Trigger `clients_audit_soft_delete` habilitado, con la definición esperada: AFTER UPDATE ON
  public.clients, WHEN `old.deleted_at IS NULL AND new.deleted_at IS NOT NULL`.
- Sin cambios respecto de la lectura previa:
  - los otros 7 triggers de `clients`, con el mismo md5 de su definición;
  - la ACL, la RLS y las policies de `clients`;
  - el md5 y la ACL de `append_audit_event`;
  - el md5 de `merge_clients`;
  - el md5 y la ACL de las funciones de 0454;
  - el tipo `client` activo.
- Ledger: la fila de arriba, con 460 filas.

### 4. Advisors de seguridad

Dos fotos completas, de 102.181 caracteres cada una y leídas enteras por script: una inmediatamente
antes de aplicar y otra después. Sin `observed_at` a cualquier profundidad, **las dos son
idénticas**: md5 total normalizado `07ffdb519be2d57607ce4e5a0a91f7ba`, 223 entradas en 4 lints. Es el
mismo md5 de las dos fotos de la aplicación de 0454, que sirve de control. Ningún hallazgo nombra las
funciones de 0455. Por lint: 22 `anon_security_definer_function_executable`, 178
`authenticated_security_definer_function_executable`, 1 `extension_in_public` y 22
`rls_enabled_no_policy`, antes y después.

### Baseline y declaraciones

- `supabase/migrations-baseline.json`: sale la espera `0455_borrado_cliente_auditado`. Quedan `0415`,
  `0414`, `0422` y `0423` sin cambios, y `cutoff` sigue en 238. Antes de editar se verificó que
  `JSON.stringify(…, null, 2)` reproduce el archivo de `main` byte a byte.
- `supabase/pending-migration-symbol-declarations.json`: sale la degradación
  `sdd-0469-borrado-cliente-auditado`, porque la RPC ya existe en producción. El archivo vuelve a su
  contenido anterior a la PR #122, que solo había agregado esa entrada.

### Spec

La sección «Producción» de SDD-0469 lleva la nota de aplicación. El `status` sigue en `in-progress`
hasta el smoke de Sam.

## VALIDACIÓN

- PASÓ: catálogo antes y después, ledger y advisors, arriba.
- PASÓ: identidad del archivo aplicado (md5 y bytes del ledger iguales al blob revisado y de `main`).
- PASÓ, en esta rama: `node scripts/build-docs-index.mjs --check`, `node scripts/check-numbering.mjs`,
  `node scripts/check-pending-migration-symbols.mjs`, JSON válido y `git diff --check`. El detalle está
  en la PR.
- PASÓ, antes del merge sobre `4ea05e47`:
  - los 196 contratos SQL de la revisión del Director;
  - el control rojo de 0455;
  - «Calidad local sin secretos» y Vercel en la PR #122.
- Merge `42f80bea`: su deploy y su «Calidad continua» se registran en la PR de este registro.
- NO DISPONIBLE: `node scripts/check-migrations-applied.mjs`, SKIP sin credenciales; el ledger se
  verificó por el conector.
- NO EJECUTADO: `corepack pnpm verify`; esta rama solo retira una espera y una declaración, y agrega
  documentación.

## COMMITS

- «commit que contiene este documento»: registro de la aplicación de 0455 (baseline, declaraciones,
  spec y handoff).

## PR / BRANCH

- Rama `codex/0455-aplicacion-prod-20260915` desde `main` `42f80bea`, con PR en borrador contra `main`.

## PENDIENTES DE ESTA TAREA

- **Smoke de Sam en producción:** en Studio › Clientes, borrar un cliente de prueba una vez con motivo
  y otra sin motivo. En Administración › Auditoría, comprobar el evento `client_deleted` con su
  operador y su motivo o el motivo por defecto. Comprobar también que su acceso al Portal queda
  revocado. Si se usa un cliente real, el borrado es real.
- Merge de la PR de este registro, con OK de Sam.
- `migrations-applied` con credenciales después del merge.

## FUERA DE ALCANCE DETECTADO

- **Alta, confirmado en el catálogo de producción:** `authenticated` tiene DELETE y UPDATE sobre
  `clients`, y la única policy de escritura («clients by tenant», para todo comando) solo exige tenant.
  - Cualquier miembro del equipo del Studio, con cualquier rol, puede borrar físicamente un cliente por
    PostgREST: sin evento y con cascadas.
  - También puede editar cualquier columna sin pasar por la matriz de roles.
  - Desde 0455, poner `deleted_at` directo queda auditado, pero no se impide.
  - Se propuso la SDD-0471.
- **Menor:** un UPDATE directo que fije `merged_into_client_id` y `deleted_at` a la vez queda como
  `client_merged`. El actor queda registrado; va con la SDD-0471.
- **Menor:** el largo del motivo se mide en unidades UTF-16 en TS y en caracteres en SQL.
- **Menor, preexistente:** el botón de ConfirmDialog en `pending` no tiene `aria-busy` (BTN-01 §5).
- La retención de 30 días de los datos de un vínculo del Portal revocado, que Sam decidió el
  2026-09-15, sigue pendiente como tarea propia.

## HANDOFF AL DIRECTOR

- Siguiente acción: el smoke de Sam y el merge de esta PR con su OK.
- La PR #123 (SDD-0470) tiene que traer `main` y regenerar el índice de specs; ya se le avisó al
  Worker.
- Worktrees que quedan para limpiar con autorización: este y el del Worker de SDD-0469
  (`borrado-cliente-auditado`).
- Lo que esta aplicación NO autoriza: aplicar `0415`, `0414`, `0422` o `0423`, fusionar #114, ni leer
  filas de negocio o conteos.
- El claim `director-0455-aplicacion-prod-20260915` se libera al publicar.
