# L10 — Contexto de correo de Cobranzas y cierre de lectura de `mail_logs` (0410 → 0415)

Fecha: 2026-09-12; ronda 2 de la PR el 2026-09-13. Task ID: `c-l10-recordatorios-cobranzas`.
Owner / sesión escritora: `c-l10-recordatorios-cobranzas-20260912` (Worker asignado por el Director; sin subagentes ni otras sesiones escritoras). Tres rondas en la misma sesión, todas antes del primer push: la 1 importa el lote; la 2 aplica la decisión del Director (opción (a) de normalización y `lock_timeout` propios); la 3 aplica su corrección documental (condición transaccional de `set local` y precedente correcto). Ronda 2 de la PR (2026-09-13): misma sesión y mismo owner, con el claim reclamado de nuevo, después de que el Director aplicó 0410 a producción.
Estado de tarea: lista-para-revision. PR #105 en borrador. **Ya no aplica el bloqueo migrate-first:** `0410_collections_mail_context` fue aplicada a producción el 2026-09-13 con OK nominal de Sam (ledger `20260913184537`), así que la rama dejó de declararla como espera y la PR puede integrarse en el orden normal; `0415_mail_logs_read_rbac` sigue pendiente y va sólo después del smoke de Cobranzas. Release y aplicación de migraciones quedan fuera de esta tarea.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO` (checkout principal en `main`, sin tocar).
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l10-recordatorios-cobranzas`.
Rama: `codex/c-l10-recordatorios-cobranzas`. Base asignada: `origin/main` `42c8839e8e5ccad63e5bff8c05347b95fb720a9b`. Antes del primer commit `origin/main` avanzó a `bca98147672a6255192b62b247ab3f5c44061bb2` (merge de la PR #103) y la rama se actualizó por fast-forward, sin merge commit, rebase ni force: esa fue la base efectiva de la ronda 1 de la PR. En la ronda 2, partiendo de `f555f5eb`, se fusionó `origin/main` `8ec7ebe3d7c3c40163503a9e745c4127871382e6` con el merge `e118f7c0`; sin rebase ni force en ninguna ronda.
Origen de solo lectura: `refs/dtd/pr/21` = `origin/codex/saneamiento-integral` = `ea9952a47f4adf14c48c91e6d0147597beb94aa7` (PR #21, 2026-09-04). Base común con `main`: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`. Commits de origen del lote: `e0c560a6` (SDD-0353) y `fa420f3f` (SDD-0358).
SDD: `docs/specs/0353-collections-mail-context/spec.md` y `docs/specs/0358-mailing-expand-contract-release/spec.md`, con el frontmatter de origen (`status: done`) y nota de importación que registra las desviaciones y la condición de `set local`. Migraciones `0410_collections_mail_context` y `0415_mail_logs_read_rbac`, declaradas pendientes. Sin reserva de número: se conserva la numeración de origen. El barrido de todas las refs locales y remotas, salvo la PR #21, no encontró `supabase/migrations/0410_*`, `0415_*`, `docs/specs/0353-*` ni `0358-*`.
Permisos: commits selectivos; push de la rama a sí misma y PR en borrador contra `main`, autorizados por Sam. Prohibidos: merge, sacar la PR de borrador, deploy, aplicar migraciones, tocar el ruleset, borrar ramas o worktrees y leer filas de negocio.
Aceptación:
- **Ronda 1:** L10 extraído desde #21 con SQL, contratos, specs, código y pruebas; lo que `main` agregó se conserva; una espera por migración con orden, locks y párrafo de autorización; declaración migrate-first; índice regenerado con el script; tres análisis; locks medidos en PostgreSQL 17 efímero encima de todo `main`.
- **Ronda 2:** normalización del email equivalente a `trim()` de JS en ambos lados, con casos infelices y control rojo; `lock_timeout` y `statement_timeout` dentro de 0410 y 0415, con aserción estática y contención medida de nuevo; `corepack pnpm verify` completo sobre `458b3542`, que es la referencia de cierre del código.
- **Ronda 3:** frase literal de la condición transaccional en ambas esperas; cita del precedente corregida a lo que es cierto; validación proporcional sin segundo verify completo; diagnóstico honesto del e2e de la corrida de referencia y revisión de procesos huérfanos.

## OBJETIVO ORIGINAL

Extraer el lote L10 del bloque C desde la PR #21 a esta rama, listo para revisión en una PR borrador contra `main`. Son dos piezas: el contexto de correo de Cobranzas (SDD-0353, migración 0410) y el cierre de lectura de `mail_logs` (SDD-0358, migración 0415). Entran con su SQL, sus specs, su código y sus pruebas.

Ronda 2, por instrucción del Director antes del primer push (no se publicó `8ae4e5e5`):
- Opción (a) de normalización del email en 0410.
- `lock_timeout` y `statement_timeout` dentro de 0410 y 0415.
- Documentación coherente con esos cambios.
- Verify completo.

El EXECUTE para service_role no se toca.

Ronda 3, revisión del Director sobre `458b3542`: acepta la normalización, la matriz con controles negativos y la aserción estática de 0415, y pide una sola corrección documental en el mismo push.
- Agregar a las esperas la condición transaccional de `set local`.
- Corregir la cita del precedente.
- Validar en proporción, sin repetir `verify` sobre la cabeza final.
- Diagnosticar el e2e de la corrida de referencia y revisar procesos huérfanos.

## COMPLETADO

> Lo que sigue describe la **ronda 1 de la PR** (tres iteraciones internas cerradas el 2026-09-12 antes del primer push) y se conserva como evidencia fechada. Quedaron superados por la ronda 2: la espera y la declaración de 0410, que ya no existen porque la migración está aplicada; el bloqueo migrate-first y la primera línea de la PR; la nota de importación de 0353; y la secuencia de release, cuyo paso 1 ya ocurrió. La sección «RONDA 2» manda sobre esos puntos.

### Archivos y relación con el origen

Diff contra `origin/main` `bca98147`: 11 archivos de producto más este handoff.

| Archivo | Relación con el origen | Blob en la rama |
|---|---|---|
| `supabase/migrations/0410_collections_mail_context.sql` | origen `bf4b52b7` más las dos desviaciones: cabecera `:19-26` (su precedente se corrigió en la ronda 3), timeouts `:29-30`, conjunto de blancos `:69-80` y limpieza `:106` y `:122-123`. Preflight, resto del cuerpo, ACL, comentario y postflight se conservan | `e65b0276`, 7186 B |
| `supabase/migrations/0415_mail_logs_read_rbac.sql` | origen `302defac` más cabecera `:6-10` (corregida en la ronda 3) y timeouts `:12-13`; preflight, DDL y postflight idénticos | `1d4c6abb`, 3470 B |
| `supabase/tests/0410_collections_mail_context.test.sql` | origen `374a806f` más: fixture de normalización `:100-170`, aserciones de timeouts de 0410 `:177-202`, comprobación dinámica de 0415 en la rama del cierre `:207-219`, bloque de normalización `:344-405` y total de service_role de 4 a 38 filas `:427-429`. Las demás aserciones no cambian | `7a5e8163`, 21132 B |
| `supabase/tests/0415_mail_logs_read_rbac.test.sql` | origen `32cd86b9` más la aserción estática de 0415 `:5-29` | `2317e414`, 1471 B |
| `lib/studio/collections/recordatorios-queries.ts` | idéntico; `main` tenía el blob de la base común (`bd86f8d3`) | `243d0ce3`, 2644 B |
| `lib/studio/collections/__tests__/recordatorios-queries.test.ts` | idéntico (archivo nuevo) | `ba781b47`, 2560 B |
| `docs/specs/0353-collections-mail-context/spec.md` | origen `e4f59674` más la nota de importación con las desviaciones y la condición de `set local`; frontmatter intacto | — |
| `docs/specs/0358-mailing-expand-contract-release/spec.md` | origen `5fe44c4c` más la nota de importación con las desviaciones y la condición de `set local`; frontmatter intacto | — |
| `docs/specs/README.md` | regenerado con `node scripts/build-docs-index.mjs`: 441 specs, filas 0353 y 0358, ambas fuera de la lista de huecos; las notas no lo cambian | — |
| `supabase/migrations-baseline.json` | esperas de 0410 y 0415; `cutoff 238`, `$doc` y la espera de 0451 idénticos a `main`, comprobado por valor | — |
| `supabase/pending-migration-symbol-declarations.json` | declaración `l10-collections-mail-context-pending-rpc`; `schemaVersion` y `$doc` idénticos a `main` | — |

La identidad de lo importado se comprobó con `git hash-object` (`git restore --source=refs/dtd/pr/21`) y con `git rev-parse HEAD:<ruta>` contra `refs/dtd/pr/21:<ruta>`. Los cuatro SQL se guardan byte a byte (`-text` en `.gitattributes`). Se comprobó con Node que no tienen CR, en el árbol y en los blobs commiteados.

### Ronda 2: normalización del email (opción a) y timeouts

- **Normalización** (`0410:69-80`, `:106` y `:122-123`):
  - `v_blank` reúne los 25 code points que quita `String.prototype.trim()` de JS: TAB, LF, VT, FF, CR, espacio, NBSP, U+1680, U+2000–U+200A, U+2028, U+2029, U+202F, U+205F, U+3000 y BOM. El cliente se limpia con `nullif(pg_catalog.btrim(c.email, v_blank), '')` y la queja con `pg_catalog.lower(pg_catalog.btrim(complaint_log.to_email, v_blank)) = pg_catalog.lower(context.email)`. Un email que queda vacío da `has_email = false`.
  - **Equivalencia:** Node 24.20.0 (Unicode 17.0) recorrió todos los code points de U+0000 a U+10FFFF, y `trim()` quita exactamente esos 25, iguales a la lista del Director. No quita U+0085, U+180E, U+200B ni U+2060.
  - El conjunto se construye con `pg_catalog.chr()` y no con un literal `U&'…'`, para no depender de `standard_conforming_strings`.
- **Timeouts** (`0410:29-30` y `0415:12-13`): `set local lock_timeout = '5s'` y `set local statement_timeout = '60s'` son las primeras sentencias de cada archivo, antes del preflight, que ya toma locks de catálogo. Rigen dentro de la transacción de aplicación (ver ronda 3).
  - **Dependencias revisadas antes del cambio:** se buscaron en todo el repo los nombres de ambos archivos. Sólo aparecen en los documentos de auditoría que describen los blobs de #21, en las dos specs, en el baseline, en las declaraciones y en los dos contratos. No hay huellas `md5` de sus objetos. Ningún preflight, postflight ni contrato dependía de la identidad del archivo ni de la posición de sus sentencias.
- **Contrato 0410:**
  - Tenant C con su accounting (`cccccccc-…`) y casos con nombre: salto de línea al final, tab al inicio, NBSP y BOM a ambos lados, U+3000 al final, email que es sólo un tab y queja con mayúsculas y tab en `to_email`.
  - Matriz de los 25 blancos a ambos lados y como email completo, más tres controles negativos: U+200B, U+0085 y U+180E.
  - El bloque acumula todos los casos que fallan antes de abortar.
  - **Aserción estática:** lee el archivo con `pg_read_file('/sb/migrations/…')`, el patrón de los contratos 0417, 0418, 0422 y 0423. Quita comentarios y exige los dos `set local` antes de la primera sentencia que toma locks o hace DDL.
  - **Aserción dinámica:** tras incluir 0410, su transacción queda en `5s` y `1min`. En la rama del cierre, el contrato anula ambos valores antes de incluir 0415 y comprueba que 0415 los vuelve a fijar.
- **Contrato 0415:** su propia aserción estática.

### Ronda 3: condición transaccional de `set local` y precedente correcto

- **Precedente, comprobado en los archivos de `main`:**
  - `0342_kommo_contact_link.sql:16-17` y `0383_clients_phone_last10_y_vinculo.sql:33-34` fijan `set lock_timeout` y `set statement_timeout` **de sesión, sin `local`**, al nivel superior y antes de su preflight. Ninguno hace `reset`: rigen también en autocommit, pero el valor queda fijado en la sesión después de la migración. `0342_phone_match_key_relleno.sql` no fija timeouts.
  - `0450_clients_aliado_mismo_tenant.sql:77-78` y `0451_aliados_cadena_mismo_tenant.sql:104-105` fijan `set local` **dentro de su bloque `do $migracion$`**. Ese bloque corre como una sola transacción incluso en autocommit, así que cubre sus locks y su DDL (`0450:44-46` lo dice). Las sentencias que 0451 deja fuera del `do` (comentarios, `get_portal_brand()`, grants y postflight, `:256-329`) sólo quedan cubiertas dentro de la transacción de aplicación.
  - `0410` y `0415` usan `set local` **al nivel superior**, fuera de un `do`: rige dentro de la transacción de aplicación, como la que abre `apply_migration`, y en autocommit no pone ningún tope.
- **Semántica medida en PostgreSQL 17.11 efímero**, con psql en autocommit (`sql/autocommit-set-local.sql`):
  1. `set local lock_timeout = '5s'` al nivel superior da `WARNING: SET LOCAL can only be used in transaction blocks` y `lock_timeout` sigue en `0`.
  2. El mismo `set local` dentro de un bloque `do` rige dentro del bloque (`NOTICE: dentro del do: lock_timeout=5s`) y al terminar vuelve a `0`.
  3. Dentro de `begin … commit` rige (`5s`) y al cerrar la transacción vuelve a `0`.
  4. `set lock_timeout = '5s'` de sesión rige (`5s`) y se queda así hasta `reset`.
- **Correcciones:**
  - Cabeceras de `0410:25-26` y `0415:7-10`: las citas «como en 0342, 0383, 0450 y 0451» (0410) y «Patrón de 0342, 0383, 0450 y 0451» (0415) pasan a «como 0450/0451 pero fuera de un do: rige en la transacción de aplicación», con el mismo número de líneas. El diff de `supabase/migrations` contra `458b3542` son 12 líneas, todas comentario.
  - Esperas de 0410 y 0415: agregan la frase literal del Director, «El tope de lock_timeout/statement_timeout rige solo si se aplica dentro de una transacción, como hace apply_migration; si se aplicara en autocommit, no tiene efecto: usar entonces una sesión con `set lock_timeout`.»
  - Notas de 0353 y 0358: no citaban 0342 ni 0383, pero se les agregó la misma condición y la diferencia con 0450 y 0451.
- **Lo que no cambió:** ninguna sentencia SQL, ni los contratos, ni el código, ni la declaración. El mensaje del commit `d57fda5f` conserva la cita anterior; no se reescribió la historia, para no mover `458b3542`.

### Solapamientos con `main` y resolución

- **`recordatorios-queries.ts`:** el blob de `main` en `42c8839e` y en `bca98147` es el de la base común (`bd86f8d3`). `git log 2a2e81bf..main` no registra cambios en ese archivo. La versión de #21 entra entera y no se pierde nada de `main`.
- **`migrations-baseline.json`:** `main` trae la espera de 0451 de la PR #103. Las esperas de 0410 y 0415 van detrás sin tocar ese valor; la línea de 0451 figura en el diff sólo por la coma que exige el JSON.
- **`pending-migration-symbol-declarations.json`:** vacío en `main`; se agrega un grupo.
- **`docs/specs/README.md`:** regenerado sobre el índice de `main`, que ya incluía 0461 de la PR #103.
- **Conflictos de merge:** ninguno. El test nuevo y las dos specs no existían en `main`, y la actualización a `bca98147` fue fast-forward antes del primer commit.
- **Solape previsible con la PR #104 (L14):** `migrations-baseline.json`, `pending-migration-symbol-declarations.json` y `docs/specs/README.md`, los tres con el driver `dtd-generated-records` de `.gitattributes`. No hay código en común.

### Esperas y declaración

- **Esperas de 0410 y 0415:** conservan el orden obligatorio, los locks medidos y el párrafo literal de autorización (comprobado por texto).
  - Ya dicen que la normalización está corregida en el archivo y que `set local` va al nivel superior de ambas.
  - Llevan la frase literal de la condición transaccional.
  - 0415 conserva la recomendación de baja actividad de correo.
  - La lectura del `relacl` de `mail_logs` sigue antes de 0410.
  - El conteo agregado de emails con blancos distintos del espacio queda como dato informativo, no como condición.
- **Declaración migrate-first:** sin cambios, porque el código no cambió. Sitio real `lib/studio/collections/recordatorios-queries.ts:56` y seis evidencias ancladas: `recordatorios-queries.ts:59`; `app/studio/(app)/cobranzas/actions.ts:280`, `:310` y `:344`; y `app/studio/(app)/cobranzas/_components/RecordatoriosDrawer.tsx:92` y `:96`. Gate: `0 ROJO · 1 AMARILLO`.

### Specs importadas

Cada nota va fechada y sigue el patrón de `docs/specs/0352-bank-reconciliation-rbac/spec.md`: registra el origen y sus commits, el estado real «pendiente de aplicar» y el orden de L10.

- **Fuera de lo importado:** de sus allowlists quedan el checklist `docs/audits/2026-09-02-codex-arranque-checklist.md` y los handoffs `2026-09-02-*`.
- **Fuera de la allowlist:** entran los dos registros de migraciones pendientes, que exigen los gates `migrations-applied` y `pending-migration-symbols`, y este handoff.
- **Desviaciones:** las de la ronda 2, con su motivo y la condición de `set local` de la ronda 3.

Cobertura del diff: los dos TS están en la allowlist de 0353 (L54-55). Las migraciones, los contratos, las specs y el índice están en la de 0353, en la de 0358 o en ambas. No hizo falta ningún archivo fuera de la allowlist asignada.

## RONDA 2 — 2026-09-13 · 0410 aplicada y rama al día con `main`

Misma sesión y mismo owner que la ronda 1 (`c-l10-recordatorios-cobranzas-20260912`), con el claim reclamado de nuevo. Antes de editar: `guard` OK, `git status --porcelain` vacío y `HEAD = f555f5eb5e2d12fd995a0c947bfdc0217a870dcc`, la cabeza publicada. No se creó otra rama ni otro worktree; desde esta sesión no se ejecutó nada contra Supabase. Las tres «rondas» de la sección COMPLETADO fueron iteraciones internas antes del primer push; esta es la segunda ronda de la PR #105.

### Lo que cambió

- **0410 dejó de ser una espera.** `0410_collections_mail_context` fue aplicada a producción el 2026-09-13 por el Director con autorización nominal de Sam, desde el archivo exacto de `f555f5eb`. Evidencia entregada por el Director (recibos fuera de Git en `…/scratchpad/prod-0410/`), copiada tal cual:
  - Ledger de producción: 449 → 450 filas. Fila `20260913184537 | 0410_collections_mail_context | 1 sentencia | md5 e80119c3c381d20c009c7dbd569557f4 | 7186 bytes`.
  - Preflight leído antes (catálogo, sin filas): `mail_logs` con relacl `authenticated=rxtm`, sin INSERT/UPDATE/DELETE/TRUNCATE; policy `mail_logs_tenant_select` presente junto con `mail_logs_no_delete`, `mail_logs_no_insert_authenticated`, `mail_logs_no_update_authenticated` y `service_role_all_mail_logs`; la RPC no existía; helpers `get_user_tenant_id()` y `current_studio_role()` presentes.
  - Postflight leído después: `collections_mail_context(uuid[])` SECURITY DEFINER, STABLE, `search_path=""`, owner postgres, ACL `{postgres=X, service_role=X, authenticated=X}`, `anon` sin EXECUTE, comentario SDD-0353, retorno `TABLE(invoice_id uuid, client_markbox text, has_email boolean, complained boolean, last_reminder_on date)`. relacl y policies de `mail_logs` idénticos a los del preflight.
  - Conteo informativo autorizado (solo agregado): 0 clientes vivos con email con blancos distintos del espacio al borde.
  - Advisors de seguridad de producción antes y después, comparados hallazgo por hallazgo. Antes: `rls_enabled_no_policy` INFO 21 · `extension_in_public` WARN 1 · `anon_security_definer_function_executable` WARN 22 · `authenticated_security_definer_function_executable` WARN 174. Después: idéntico salvo `authenticated_security_definer_function_executable` WARN 175. La única diferencia es UN hallazgo nuevo: `public.collections_mail_context` aparece en `authenticated_security_definer_function_executable`. Es el efecto esperado e intencional: la RPC es SECURITY DEFINER y `authenticated` necesita EXECUTE; el control de rol (accounting|admin) y de tenant va adentro, y `anon` sigue sin EXECUTE (su lint quedó en 22). Ningún otro hallazgo cambió. Es el lint que ya cargan las demás RPC definer del Studio; no es una regresión.
  - Conector: `claude.ai Supabase`, proyecto `xpfuzqombmjmxvprjgmi`, `apply_migration` con name exacto, `{"success": true}` al primer intento. No se leyó ninguna fila de negocio.
  - **Identidad comprobada aquí, en local:** `git show HEAD:supabase/migrations/0410_collections_mail_context.sql | md5sum` da `e80119c3c381d20c009c7dbd569557f4` y `wc -c` da 7186, con 0 CR; es el blob `e65b0276` que la rama lleva desde `be31a98d`. No se consultó producción desde esta sesión.
  - **Lo que esto cierra:** el análisis 1 (MIGRATE-FIRST) ya no bloquea. La RPC existe en la base antes de fusionar el código que la consume, así que `contextoDeEnvio` no puede caer en `PGRST202` en producción. La medición de la ronda 1 sigue valiendo como descripción de lo que pasaría sin la RPC.
- **Registros.** `supabase/migrations-baseline.json` vuelve al blob de `main` (0451 sola, `cutoff: 238`, `$doc` intacto) más la única espera viva de L10, `0415_mail_logs_read_rbac`, actualizada: dice que 0410 quedó aplicada el 2026-09-13 con su ledger e identidad, que el paso siguiente es desplegar esta PR (fusionarla incluida) y verificar la vista previa de recordatorios con accounting y admin, y que 0415 se aplica sólo después de ese smoke; conserva la frase literal de la condición transaccional, el orden de L10 con 0410 marcada como aplicada y el párrafo literal de autorización. `git diff origin/main -- supabase/migrations-baseline.json` son 2 líneas: la coma que gana 0451 y la línea de 0415. `supabase/pending-migration-symbol-declarations.json` es byte a byte el de `main` (`degradations: []`) y ya no aparece en el diff de la PR. Gate: `0 ROJO · 0 AMARILLO`.
- **Notas de las specs.** La de 0353 pasa al patrón de una migración aplicada (`0336` en L01 ronda 2, `0352`): fecha, ledger, identidad del archivo, preflight, postflight, advisors, conteo y registro en este handoff; frontmatter intacto (`status: done`, `updated: 2026-09-02`). En la de 0358 sólo cambió lo que mencionaba a 0410 como pendiente. El índice no cambia por esto.
- **Merge de `origin/main` `8ec7ebe3`** (commit `e118f7c0`, padres `f555f5eb` y `8ec7ebe3`), sin rebase ni force. Trae #107, #108 y #109 (SDD-0462, SDD-0463 y el registro de 0452 aplicada). Se forzó el driver de `main` con el override del punto 4 de la enmienda de retiro unilateral del ADR-0002 (`git -c merge.dtd-generated-records.driver="node \"<driver-de-main>\" %O %A %B %P" merge --no-commit --no-ff origin/main`), con el driver extraído de `origin/main:scripts/merge-generated-records.mjs` a un archivo fuera del repo; el de esta rama era idéntico (md5 `b4563696716d6893d48e619ec0e9eca4` en ambos), porque la rama nació después de las enmiendas del 2026-09-11.
  - `docs/specs/README.md`: `✓ merge semántico`; unión de las filas 0462 y 0463 de `main` con 0353 y 0358 de la rama, 443 specs y 20 huecos. `node scripts/build-docs-index.mjs` después no cambió un byte.
  - `supabase/migrations-baseline.json` y `supabase/pending-migration-symbol-declarations.json`: `main` no los cambió en neto desde la base `bca98147` (la espera de 0452 entró en #107 y #108 y salió en #109), así que Git conservó los de esta rama sin ejecutar el driver. La retirada de 0410 va en el commit siguiente, `4d5e4aac`.
  - **Conflictos: ninguno.** L10 no comparte código con esas PR; los 15 archivos de `main` entraron tal cual.
- **Cuerpo de la PR.** La primera línea deja de ser «No fusionar antes de aplicar y verificar 0410» y pasa a decir el estado real: 0410 aplicada; fusionar y desplegar es el paso 2 del orden; 0415 va después del smoke.

### Diff contra `origin/main` por archivo tras la ronda 2

`git diff origin/main...HEAD --stat` sobre la cabeza de código `db061ca5`, 11 archivos, más este handoff:

| Archivo | Δ | Qué es |
|---|---|---|
| `supabase/migrations/0410_collections_mail_context.sql` | +167 | Migración **aplicada en prod el 2026-09-13**; blob `e65b0276`, idéntico al ledger (md5 `e80119c3…`, 7186 B). Sin cambios desde `f555f5eb`. |
| `supabase/migrations/0415_mail_logs_read_rbac.sql` | +78 | Migración **pendiente**; blob `1d4c6abb`. Sin cambios desde `f555f5eb`. |
| `supabase/tests/0410_collections_mail_context.test.sql` | +439 | Contrato de 0410 con la normalización, la matriz de 25 blancos y las aserciones de timeouts (`7a5e8163`). |
| `supabase/tests/0415_mail_logs_read_rbac.test.sql` | +33 | Contrato de 0415 con su aserción estática (`2317e414`). |
| `lib/studio/collections/recordatorios-queries.ts` | +20 −61 | `contextoDeEnvio` por la RPC; idéntico al origen #21 (`243d0ce3`). |
| `lib/studio/collections/__tests__/recordatorios-queries.test.ts` | +81 | Test nuevo, 3 casos; idéntico al origen (`ba781b47`). |
| `docs/specs/0353-collections-mail-context/spec.md` | +131 | Spec con la nota de importación reescrita: 0410 aplicada, ledger, identidad, preflight, postflight, advisors y conteo. |
| `docs/specs/0358-mailing-expand-contract-release/spec.md` | +128 | Spec con la nota ajustada: 0410 aplicada, 0415 pendiente tras el smoke. |
| `docs/specs/README.md` | +4 −2 | Filas 0353 y 0358 y su retiro de los huecos; el conteo pasa a 443 con las 0462 y 0463 que trae `main`. |
| `supabase/migrations-baseline.json` | +2 −1 | Sólo la espera de 0415 y la coma que gana 0451; `cutoff`, `$doc` y 0451 iguales a `main`. |
| `.agents/handoffs/c-l10-recordatorios-cobranzas.md` | +444 en `db061ca5`; crece con esta ronda | Este documento. |

**Ya no aparece** `supabase/pending-migration-symbol-declarations.json`: quedó igual a `main`. `git diff --check origin/main...HEAD` limpio.

### Validación de la ronda 2

Sobre `db061ca5afd3abef97c304192f9eacc60b9136a9` (el merge más los dos commits de la ronda; el commit del handoff viene después y sólo agrega este documento). Recibos fuera de Git en la carpeta del scratchpad de esta tarea: `r2-precheck-verify.log`, `r2-precheck-verify-2.log`, `r2-merge.log`, `r2-registers.log`, `r2-commits-11-12.log`, `verify-r2-db061ca5.log`, `.meta`, `.exit` y `-clean.log`, `e2e-diagnostico-r2.log` y `orphans-check-r2.log`; scripts `apply-r2-registers.mjs`, `check-waits-r2.mjs`, `apply-spec-notes-r2.mjs`, `run-verify-r2.sh`, `running-verify-check.ps1`, `orphans-check-r2.ps1` y el driver extraído `dtd-merge-driver-main.mjs`. No se copiaron credenciales ni se tocó Supabase.

| Comprobación | Estado y evidencia |
|---|---|
| `claim` / `guard --owner` | PASÓ: claim reclamado de nuevo con el mismo owner; guard revalidado antes del merge, de cada commit, del verify y del push. Árbol limpio y `HEAD = f555f5eb` al empezar |
| Identidad de 0410 contra el ledger | PASÓ: md5 `e80119c3c381d20c009c7dbd569557f4`, 7186 bytes y 0 CR sobre `HEAD:supabase/migrations/0410_collections_mail_context.sql`, iguales a los del ledger `20260913184537`. Comprobación local; no se consultó producción |
| Merge con el driver de `main` (override ADR-0002 §4) | PASÓ: sin conflictos; índice por unión semántica y regenerado sin cambios; baseline y declaraciones no pasaron por el driver porque `main` no los cambió en neto |
| `git diff origin/main -- supabase/migrations-baseline.json` | PASÓ: sólo la coma de 0451 y la línea de 0415; `cutoff 238`, `$doc` y 0451 iguales a `main` |
| `git diff origin/main -- supabase/pending-migration-symbol-declarations.json` | PASÓ: vacío, `degradations: []` |
| `check-waits-r2.mjs` (15 comprobaciones) | PASÓ: claves exactas, ledger e identidad de 0410, paso siguiente, orden de L10, frase literal de la condición transaccional, párrafo literal de autorización, sin MIGRATE-FIRST y sin cita de 0342 ni 0383 |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: `0 ROJO · 0 AMARILLO declarado(s)` |
| `node scripts/build-docs-index.mjs` / `--check` | PASÓ: el índice del driver ya era el canónico (443 specs); `docs:check` sincronizado tras las notas |
| `corepack pnpm sdd:check` | PASÓ: sin números repetidos |
| Frontmatter de 0353 y 0358 | PASÓ: igual al del origen `refs/dtd/pr/21` |
| `git diff --check` | PASÓ, en cada commit y en `origin/main...HEAD` |
| Chequeo previo al verify | PASÓ: sin otro verify, e2e, dev server, vitest o rebuild en la máquina; sin puertos 3100–3799 en escucha; sin contenedores. Repetido dentro del lanzador |
| **`corepack pnpm verify` sobre `db061ca5`** | **FALLÓ, exit 1**, entre las 14:57:39 y las 15:31:13 (−04:00), con HEAD `db061ca5` y árbol limpio al inicio y al final (`verify-r2-db061ca5.meta`). Corrieron de verdad 16 de 17 pasos: 15 PASÓ, `migrations-applied` NO DISPONIBLE y `e2e` FALLÓ, colgado y cortado por el watchdog. Veredicto literal y detalle abajo. No se absuelve ni se presenta como verde |
| `verify` · `migrations-applied` | NO DISPONIBLE: `[SKIP] migrations-applied: sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY`. El ledger real no se midió en este árbol; la evidencia de que 0410 está aplicada es la que entregó el Director, no una consulta hecha aquí. No autoriza copiar credenciales |
| `verify` · `e2e` | **FALLÓ con motivo COLGADO/TIMEOUT**, esta vez en la primera pasada: imprimió 167 de 186 resultados y se quedó 10 min en silencio; el watchdog de SDD-0454 lo cortó, sin reintento. Hasta ahí, 123 aprobadas, 15 omitidas y 29 renglones de fallo: 28 son los 14 ambientales conocidos con su reintento interno y 1 es un flaky de `calculadora-semantic-colors.spec.ts:53:7` que pasó en su reintento. Como validación de acceso o de Supabase el paso es NO DISPONIBLE por falta de configuración, pero el corte no se absuelve: 19 resultados de mobile-safari no se midieron. Detalle en la lista de abajo |
| Procesos tras el verify | PASÓ: ninguno. El watchdog terminó 29 procesos de su propio árbol (raíz PID 6084; chrome-headless-shell ×18, node ×10, cmd ×1) con 0 sobrevivientes. Después (`orphans-check-r2.log`, 15:31): ningún proceso con la ruta del worktree salvo los shells de este chequeo; ningún chrome-headless-shell ni Playwright; ningún `node` del verify (los seis `node.exe` creados a las 15:25:59 son servidores MCP y del runtime de Codex, ajenos y sin tocar); sin puertos 3100–3799 en escucha; sin `next dev`; sin contenedores `dtd_l10_*`. No hubo nada que detener |
| Producción / Supabase | NO EJECUTADO por límite del encargo: la aplicación de 0410 la hizo el Director; desde esta sesión no se abrió conexión, no se aplicó nada y no se leyeron filas |
| `/ui-check` | NO EJECUTADO por no aplicar: la ronda no toca UI |

Detalle por paso de `corepack pnpm verify` sobre `db061ca5` (`verify-r2-db061ca5.log`; Node 24.20.0, pnpm 12.3.4, Docker 29.7.2; 14:57:39 → 15:31:13 −04:00):

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ, 41 pruebas |
| lint | PASÓ, 0 errores y 8 advertencias en archivos que esta PR no toca: `NewPurchaseWizard.test.tsx` (4), `PurchaseStepDetalle.test.tsx` (2), `KommoBoardView.tsx` (1) y `KommoClient.tsx` (1); las mismas de la ronda 1 |
| rsc-boundary | PASÓ, 1599 módulos escaneados |
| typecheck | PASÓ |
| edge-functions | PASÓ, 4 funciones compilan con Deno |
| test | PASÓ, 545 archivos y 6833 pruebas (`main` sumó `portal-invoices-tenant-boundary.test.ts`) |
| docs:check | PASÓ, 443 specs sincronizadas |
| numbering | PASÓ, 443 specs · 440 migraciones; conserva los choques históricos declarados |
| feature-constants | PASÓ, 5 banderas |
| components:check | PASÓ |
| governance:check | PASÓ, 28 políticas aprobadas |
| migrations-applied | NO DISPONIBLE: `[SKIP] migrations-applied: sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY`; no se midió el ledger real |
| pending-migration-symbols | PASÓ, `0 ROJO · 0 AMARILLO declarado(s)` |
| sql-tests | PASÓ, 183 contratos con rollback, incluidos `✓ 0410_collections_mail_context.test.sql`, `✓ 0415_mail_logs_read_rbac.test.sql` y el de 0452 que trae `main` |
| schema-rebuild | PASÓ: inventario de 440; 422 migraciones desde cero y 18 sólo-ledger sin cambio de esquema; aislamiento multi-tenant en 219 tablas con 2 tenants |
| e2e | **FALLÓ: colgado en la primera pasada y cortado por el watchdog de SDD-0454.** Detalle en la lista siguiente |
| build | PASÓ: 160 de 160 páginas estáticas generadas; `[build] build de producción OK`. Los errores de `listPublishedPosts` y `getPublic*` por Supabase sin configurar salen durante la generación estática y no la detienen |

Diagnóstico del e2e, leído del log sin volver a correrlo (`e2e-diagnostico-r2.log`):
- **Arranque:** dev server propio en el puerto 3010; 186 pruebas con 8 workers.
- **Primera pasada, colgada:** no llegó al resumen de Playwright ni al reintento automático. Imprimió 167 de 186 resultados: chromium 68 (sus 67 pruebas más el reintento del flaky), mobile-chrome 67/67 y mobile-safari 32/67. Hasta ahí, 123 aprobadas, 15 omitidas y 29 renglones de fallo.
  - 28 renglones son los 14 ambientales conocidos con su reintento interno: `auth.spec.ts:21`, `:91`, `:98` y `:105` en chromium, mobile-chrome y mobile-safari, y `global-search.spec.ts:22` en chromium y mobile-chrome. Causa registrada por el WebServer: el cliente Supabase sin URL ni clave en `proxy.ts:67` (85 apariciones).
  - 1 renglón es `[chromium] calculadora-semantic-colors.spec.ts:53:7 › … en dark` (L928, 13,2 s), que **pasó en su reintento** (`retry #1`, L969, 12,2 s) y pasó a la primera en mobile-chrome y mobile-safari; en la corrida de la ronda 1 pasó en los tres navegadores. Es un flaky de la calculadora pública, fuera de L10 y de lo que `main` sumó desde la base (#107–#109 tocan facturas del Portal), en una corrida con chromium más lento (las pruebas de `auth` tardaron 36 s frente a 14 s en la ronda 1).
  - El 15.º ambiental de la ronda 1, `global-search.spec.ts:22:7` en mobile-safari, no llegó a imprimirse.
- **Dónde se colgó:** el último resultado fue el 167, `[mobile-safari] gastos-expense-void.spec.ts:99:7`, omitida (L2007). Después, 29 líneas del WebServer con el mismo error de `proxy.ts:67` y 10 minutos de silencio. Es el mismo punto donde se colgó el reintento de la ronda 1, tras `gastos-expense-void.spec.ts:99:7` de mobile-safari. El reporter imprime cada prueba al terminar, así que el log no nombra la que quedó en curso; por el orden de la única pasada completa que hay (ronda 1), la siguiente de mobile-safari es `global-search.spec.ts:22:7`, que falla con ese mismo error. Inferencia reforzada por dos corridas, no un registro.
- **Corte:** `watchdog: raíz PID 6084; 29 proceso(s) del árbol propio terminados (chrome-headless-shell.exe×18, node.exe×10, cmd.exe×1); sobrevivientes: 0.`
- **Relación con L10:** ningún archivo de `e2e/` menciona Cobranzas, recordatorios, Mailing, `mail_logs` ni `collections`; los specs sólo apuntan a `/studio/login`, `dashboard`, `gastos`, `nomina`, `tracking`, `attachments` y `global-search`, y en el log hay 0 menciones de `/studio/cobranzas`, `/studio/mailing` o `recordatorios` fuera de rutas de archivo y de la tabla del build. Nada contradice que L10 no toca UI ni rutas del e2e.

Veredicto literal: `verify: 1 fallo(s) → e2e [COLGADO/TIMEOUT: sin salida durante 10 min; límite de inactividad 10 min (VERIFY_E2E_IDLE_MIN)] CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se absuelve ni se presenta como verde.
- `verify-r2-db061ca5.meta`: inicio 14:57:39, fin 15:31:13 (−04:00), exit 1, HEAD `db061ca5…` al inicio y al final, y 0 líneas de `git status --porcelain` al inicio y al final.
- Recibos: `.log`, `.exit`, `-resumen.log` y `e2e-diagnostico-r2.log`.

### Secuencia de release, actualizada

1. **0410: hecho.** Aplicada el 2026-09-13 (ledger `20260913184537`); espera y declaración retiradas en esta rama.
2. **Fusionar (Director) y desplegar esta PR.** Smoke: la vista previa de recordatorios de Cobranzas con accounting y admin debe mostrar resumen, listas y botón de envío sin la alerta de error, con las señales de spam y último recordatorio que ya mostraba. Lo hace Sam o alguien del equipo con cuentas reales.
3. **0415**, sólo después de ese smoke, con OK nominal de Sam y `docs/runbooks/aplicar-migraciones-prod.md`, en una ventana de bajo tráfico de correo y dentro de una transacción (su `lock_timeout` de 5 s la corta y la revierte si hay contención; se reintenta). Verificar `mail_logs_admin_select`, `authenticated=r` y otra vez la vista previa con accounting. Retirar su espera en una rama propia.

## ANÁLISIS 1 — MIGRATE-FIRST

> **Ronda 2 (2026-09-13):** 0410 ya está aplicada en producción, así que el orden migrate-first se cumplió y este bloqueo dejó de regir. El análisis se conserva como evidencia fechada de lo que pasaría sin la RPC. Las «consecuencias aplicadas» de abajo rigieron hasta la ronda 2: la primera línea de la PR ya dice el estado real, y la declaración y la espera de 0410 se retiraron (ver «RONDA 2»).

**Veredicto: MIGRATE-FIRST. Falla cerrado: lanza, la acción devuelve error y no se envía ningún correo.**

El camino se midió en la ronda 1 con el `contextoDeEnvio` real de esta rama. El cliente fue postgrest-js 2.106.1, el paquete que usa supabase-js en la app, contra PostgREST v16.1 y el esquema de `main` reconstruido en PostgreSQL 17.11:

1. Sin 0410, `supabase.rpc("collections_mail_context", …)` (`recordatorios-queries.ts:56`) devuelve `{ error }` con `PGRST202`: «Could not find the function public.collections_mail_context(p_invoice_ids) in the schema cache». No hay fallback a `mail_logs` ni a `clients.email`.
2. `if (error) throw new Error(error.message)` (`:59`) lanza.
3. `previewRecordatorios` lo captura y devuelve `{ error: "No se pudo calcular la lista de recordatorios." }` (`app/studio/(app)/cobranzas/actions.ts:278-281`). El cajón muestra la alerta y oculta resumen, listas y botón de envío (`RecordatoriosDrawer.tsx:83-96`).
4. `enviarRecordatorios` calcula el contexto (`actions.ts:310`) antes de crear el cliente admin y del bucle de `fireMailEvent` (`:316-338`). Devuelve `{ error: "No se pudieron enviar los recordatorios." }` (`:342-345`) sin enviar nada.
5. Con 0410 aplicada, el mismo código entrega a accounting y admin exactamente las señales que calcula el consumidor de `main`.

**Quién llega a ese camino:** `moduleEditDenial(supabase, "collections")` (`actions.ts:253-254` y `:301-302`) deja pasar a accounting y admin activos. `collections` es módulo de dinero y los overrides no lo abren (`lib/studio/rbac.ts:117`, `:161-170` y `:318-345`), y la RPC exige lo mismo (`0410:82-85`). Medido: commercial y un accounting desactivado reciben 42501 de la RPC, pero la app ya no los deja llegar.

**Las rondas 2 y 3 no cambian el veredicto.** La ronda 2 sólo cambió el cuerpo de la consulta y agregó los timeouts; firma, tipo de retorno, ACL y comentario de la RPC son iguales en el catálogo de la ronda 2, y el `PGRST202` no depende del cuerpo. Por eso el extremo a extremo con PostgREST no se repitió. La ronda 3 sólo cambia texto.

Consecuencias aplicadas:
- La primera línea de la PR dice «No fusionar antes de aplicar y verificar 0410».
- La declaración queda AMARILLO en el gate de símbolos.
- La espera de 0410 lleva el texto MIGRATE-FIRST.

0410 es aditiva y compatible con el código de `main`: la lectura directa de `mail_logs` por rol dio lo mismo antes y después de aplicarla, en ambas rondas de medición. Aplicarla antes de fusionar no cambia el comportamiento vigente.

## ANÁLISIS 2 — LECTORES DE `mail_logs` Y LO QUE ROMPE 0415

Inventario sobre `main` `bca98147`. Se buscó `mail_logs`, los embeds que llegan por `mail_log_id` o `sent_log_id`, y las funciones, vistas y policies SQL. Los resultados de «hoy» y «tras 0415» marcados como medidos salen del contenedor efímero con datos sintéticos y se repitieron en la ronda 2 con los archivos finales.

| # | Lector | Sitio | Cliente | Quién llega | Hoy (policy tenant) | Tras 0415 | ¿Lo cubre 0358? |
|---|---|---|---|---|---|---|---|
| 1 | Recordatorios de Cobranzas, consumidor de `main` | `lib/studio/collections/recordatorios-queries.ts` de `main` (`bd86f8d3`): `:54-58` clientes, `:76-83` quejas, `:93-100` recordatorios; llamado desde `app/studio/(app)/cobranzas/actions.ts:259` y `:310` | sesión (`createClient`, `actions.ts:252` y `:300`) | accounting y admin | lee quejas y recordatorios del tenant (medido) | **accounting recibe 0 filas SIN error** y pierde quejas y último recordatorio (medido en la ronda 1); admin sigue igual. Con esta PR desplegada ya no lee `mail_logs`: usa la RPC | Sí, por el orden 0410 → despliegue → 0415 (decisiones 1-3). La spec lo llama ruptura; lo medido es una falla silenciosa, precisada en la nota |
| 2 | Consola de Mailing, pestaña Logs | `app/studio/(app)/mailing/page.tsx:124-142` | sesión (`:82`) | sólo admin (`link.role !== "admin"` → redirect, `:100-102`) | lee | sigue igual (`mail_logs_admin_select`) | Sí: preserva admin |
| 3 | Reenvío de correo atascado | `app/studio/(app)/mailing/actions.ts:921-925` | sesión (`:908`) | sólo admin: `moduleEditDenial(…, "mailing")` (`:909-910`) y `mailing` es admin-only bloqueado (`lib/studio/rbac.ts:143` y `:173-182`) | lee por id | sigue igual | Sí |
| 4 | `listLogs`, `getLog`, `computeMailKpis` | `lib/studio/mail-queries.ts:166-186`, `:188-199` y `:288-306` | parámetro | **sin llamadores** en `app/`, `lib/` ni `components/` | — | un llamador futuro con sesión no admin recibiría `[]`, `null` o `EMPTY_KPIS` sin error | No aplica: código sin uso (FUERA DE ALCANCE) |
| 5 | Envío (`sendEmail`): insert con `select("id")` y updates | `lib/studio/mail/send-email.ts:152-168` y `:196-247` | service_role (`supabaseAdmin`; los llamadores usan `createAdminClient`, auditado en L08) | procesos | lee y escribe | sigue igual (policy y ACL de service_role) | Sí: service_role conserva el envío |
| 6 | Webhook de Resend | `app/api/webhooks/resend/route.ts:95`, `:103-114` y `:136` | service_role | proceso | lee y actualiza | sigue igual | Sí |
| 7 | Cron mail-health | `lib/studio/mail/mail-health.ts:212-219`, `:239-246` y `:265`, vía `app/api/cron/mail-health/route.ts:78`, `:94`, `:98` y `:120` | service_role | proceso | lee y actualiza | sigue igual | Sí: health checks |
| 8 | Cron portal-cold-reminder (buzones quemados) | `app/api/cron/portal-cold-reminder/route.ts:72` y `:109-113` | service_role | proceso | lee | sigue igual | Sí: uso interno de service_role |
| 9 | Newsletter | `lib/studio/newsletter/sender.ts:221-224`, `:245-248` y `:266` | service_role (`admin`) | proceso | inserta, lee ids y actualiza | sigue igual | Sí |
| 10 | FK hacia `mail_logs` | `0207_mail_scheduled.sql:40` y `0260_newsletter_campaigns.sql:46`; escritores con admin en `app/studio/(app)/mailing/actions.ts:817-848`, `app/api/cron/mail-scheduled/route.ts:52` y `:93` y `lib/studio/newsletter/sender.ts:235` | chequeo de FK del motor | — | sin efecto de RLS | sin efecto | No aplica |
| 11 | Lectura directa por PostgREST de cualquier miembro del Studio | policy `mail_logs_tenant_select` (`0018_mailing.sql:366-368`) | sesión | commercial, operations, warehouse, support, marketing y accounting | **leen todo el historial del tenant** (medido con commercial: 5 de 5 filas) | la pierde todo rol distinto de admin (medido con accounting y commercial: 0 filas) | Sí, intencional (aceptación de 0358 y decisión 5 de 0353) |
| 12 | Funciones, vistas o policies SQL que lean `mail_logs` | ninguna en las migraciones de `main` (sólo tabla, grants, policies, FKs y replays históricos) | — | — | — | — | No aplica |
| 13 | Edge Functions, scripts, móvil y Portal | sin referencias en `supabase/functions/*` ni `scripts/`; el Portal no tiene `user_tenants`, así que `get_user_tenant_id()` es nulo y no lee nada ni antes ni después | — | — | — | — | No aplica |
| 14 | Tablero, «Actividad reciente» | sólo un comentario de plan V2 (`app/studio/(app)/dashboard/_components/RecentActivityCard.tsx:9-10`); la fuente real es `shipment_events` (`lib/studio/dashboard-queries.ts:150`) | — | — | — | — | No aplica (0351 lo anota como deuda futura) |

Conclusión:
- **Pierden acceso con 0415** el consumidor de Cobranzas de `main` para accounting y la lectura directa por PostgREST de todo rol distinto de admin.
- La lectura directa es intencional y está en SDD-0358 (aceptación: «0415 deniega lectura directa a accounting/commercial») y en la decisión 5 de SDD-0353.
- El consumidor anterior está cubierto por el orden obligatorio, pero la spec describe una ruptura («rompía la consulta antigua»). **Lo medido es una falla silenciosa:** RLS devuelve cero filas sin error y la vista previa volvería a proponer escribir a quien marcó spam y a quien se le recordó hace poco. El envío lo haría si el tenant tiene activa la regla `invoice_overdue`. Queda escrito en la nota de 0358, en la espera de 0415 y en la PR.
- **No se rompe ningún lector legítimo que la spec no cubra**, así que no hay decisión pendiente del Director sobre lectores. Sí hay una advertencia operativa: revertir sólo la app después de 0415 reproduce la falla silenciosa, de modo que 0415 no tiene vuelta atrás segura por despliegue.

## ANÁLISIS 3 — DATOS PERSONALES (`revisar-datos-ve`)

Revisión focal sobre la RPC y el cierre de `mail_logs`. No es asesoría legal: lo NO VERIFICABLE requiere revisión humana y, cuando corresponda, de un abogado. Conviene una segunda opinión de otro modelo sobre el mismo diff.

Resumen: 6 CORRECTO · 3 ENCONTRADO · 4 NO VERIFICABLE.

Inventario, limitado a lo que toca este cambio:

| Campo | Qué es | Finalidad | Retención | Quién lo ve |
|---|---|---|---|---|
| `mail_logs.to_email` (`0018_mailing.sql:141`) | dirección del destinatario: clientes, prospectos del estimado web (`lib/studio/mail/mail-rule-engine.ts:39-40`) y equipo interno (`:209-235`); los prospectos son titulares que no son usuarios (punto 12) | registrar envío, entrega y queja | NO VERIFICABLE; MP-01 la clasifica P4 (`docs/governance/policies/mp-01.md:63`) y el mapa de borrado la marca «lleva destinatarios» (`docs/legal/privacidad/mapa-de-borrado.md:186`) | hoy, todo miembro activo del tenant por PostgREST (`0018_mailing.sql:366-368`); tras 0415, admin y service_role; por la RPC no sale |
| `mail_logs.complained_at` (`:155`) | fecha de queja de spam | no volver a escribir | ídem | por la RPC sólo como booleano `complained` |
| `mail_logs.sent_at` y `metadata` (`:150` y `:156`) | cuándo y por qué se envió (`event`, `source_ref`) | ventana entre recordatorios | ídem | por la RPC sólo `last_reminder_on`, fecha UTC |
| `mail_logs.to_name`, `cc`, `bcc`, `subject`, `rendered_variables` (`:142-146`) | nombre, copias, asunto y variables del correo (pueden llevar nombre, factura y montos) | trazabilidad | ídem | no salen por la RPC; tras 0415, sólo admin y service_role |
| `clients.email` | correo del cliente | contacto | NO VERIFICABLE | por la RPC sólo `has_email` |
| `invoices.id`, `client_markbox` | factura y Shipping Mark | cobranza | — | la RPC devuelve el Shipping Mark, que Cobranzas ya tiene en la cola |

Hallazgos:

- **CORRECTO — minimización de la respuesta:**
  - La RPC devuelve cinco columnas, sin email ni metadata (`0410:54-60` y `:113-133`).
  - El contrato rechaza un tipo de retorno que exponga `to_email` o `metadata` (`$catalog_contract$` en `supabase/tests/0410_collections_mail_context.test.sql:225`). El catálogo de la ronda 2 da `TABLE(invoice_id uuid, client_markbox text, has_email boolean, complained boolean, last_reminder_on date)`.
  - `main` traía a memoria del servidor todos los `to_email` con queja del tenant y la metadata de todos los recordatorios (`recordatorios-queries.ts` de `main`, `:76-83` y `:93-100`).
  - Norma: SC 332/2001, finalidad y calidad (`.claude/skills/revisar-datos-ve/references/marco-legal-ve.md:74`); PIPL art. 6 (`marco-legal-cn-pipl.md:46-47`); checklist punto 2 (`checklist-datos-ve.md:40-81`).
- **CORRECTO — identidad y tenant:**
  - No hay parámetro de tenant (`0410:53`). Tenant y rol salen del principal (`:67-68` y `:82-85`) y filtran facturas, clientes y logs (`:99`, `:109`, `:120` y `:128`).
  - Medido con disposiciones infelices: mismo Shipping Mark y mismo código de factura en otro tenant, la misma dirección con queja en otro tenant y un recordatorio de otro tenant con el id de una factura ajena. Ninguno cruzó.
  - Norma: SC 332/2001, seguridad y confidencialidad (`marco-legal-ve.md:77`); PIPL art. 51 (`marco-legal-cn-pipl.md:188`).
- **CORRECTO — EXECUTE y rol:**
  - `revoke all` a public, anon y authenticated, y `grant execute` a authenticated y service_role (`0410:137-140`).
  - Medido: anon recibe 42501 por SQL y por PostgREST, y PUBLIC no tiene EXECUTE. Commercial, accounting desactivado y service_role sin usuario reciben 42501.
- **CORRECTO — límite de volumen:** 1001 ids dan 22023 (`0410:90-93`, medido). Arreglo vacío o nulo devuelve 0 filas (`:87-89`, medido).
- **CORRECTO, corregido en la ronda 2 — la queja de spam no se pierde por blancos al borde del email:**
  - Antes, `btrim` sólo quitaba espacios, mientras `send-email.ts:64` guarda `to_email` con `trim().toLowerCase()` (`:158`). Un email con salto de línea, tab o NBSP al borde perdía la queja.
  - Ahora ambos lados usan el conjunto de `trim()` y `lower` (`0410:69-80`, `:106` y `:122-123`).
  - Medido en el contrato (25 blancos, casos con nombre y controles negativos) y sobre el esquema real: salto de línea, NBSP y queja con mayúsculas y tab dan `complained = true`; un email que es sólo un tab da `has_email = false`; U+200B no se quita.
  - Norma: SC 332/2001, autonomía (consentimiento revocable, `marco-legal-ve.md:72`); checklist punto 3 (`checklist-datos-ve.md:82` y `:102`). La queja es una decisión del destinatario (`lib/studio/collections/recordatorios.ts:28-30`).
- **CORRECTO, por lectura de código y sin medir — email compartido dentro del tenant:** en `main`, el mapa `correoPorMarkbox` se queda con el último cliente que tiene esa dirección (`recordatorios-queries.ts` de `main`, `:60-68`) y sólo ese queda marcado. La RPC evalúa la queja por cada factura y su cliente (`0410:117-124`), así que marca a todos los que comparten la dirección.
- **ENCONTRADO, preexistente y cerrado por esta PR en su orden — exposición del historial de correos:**
  - Hoy cualquier miembro activo del Studio lee `to_email`, asunto, variables y metadata de todo el tenant (`0018_mailing.sql:366-368`; medido con commercial).
  - 0415 lo limita a admin (`0415:46-54`; medido).
  - Norma: SC 332/2001, seguridad y confidencialidad (`marco-legal-ve.md:77`).
- **ENCONTRADO, bajo y sin exposición — EXECUTE inútil para service_role:** `0410:139-140` lo concede, pero la función exige rol de Studio y service_role sin usuario recibe 42501 (medido). Por instrucción del Director no se toca; retirarlo en una migración futura o documentar el motivo.
- **ENCONTRADO, preexistente y fuera de alcance — retención de `mail_logs`:**
  - P4 sin purga (`mp-01.md:63`; `mapa-de-borrado.md:186`).
  - SDD-0358 declara que no cambia retención (línea «MP-01» de su spec).
  - Norma: SC 332/2001, temporalidad (`marco-legal-ve.md:75`).

NO VERIFICABLE:
- El `relacl` real de `mail_logs` en producción. Por patrón se infiere `authenticated=rxtm`, compatible con el postflight de 0410; la lectura de catálogo va antes de aplicar.
- Cuántos `clients.email` vivos tienen hoy blancos distintos del espacio al borde. Ya no cambia el resultado de la RPC; el conteo agregado que Sam puede autorizar es informativo.
- Si hay consumidores fuera de la aplicación que lean `mail_logs` con JWT de un usuario no admin. No se ven en el repo.
- La retención y la base de licitud de `mail_logs`.

Verificación contra datos reales: no ejecutada, sin autorización para producción. Todo se probó en PostgreSQL efímero con identidades y correos ficticios.

## DECISIÓN TOMADA: NORMALIZACIÓN DEL EMAIL

**Opción (a), decidida por el Director el 2026-09-12, aplicada en la ronda 2 y aceptada en su revisión de `458b3542`.** El motivo quedó medido en la ronda 1 con la expresión del origen (`btrim` a secas):

| Valor de `clients.email` | `btrim` del origen lo iguala a `uno@example.test` | `trim()` de JS lo iguala |
|---|---|---|
| `uno@example.test` + salto de línea | no | sí |
| tab + `uno@example.test` | no | sí |
| `uno@example.test` + NBSP | no | sí |
| espacios a ambos lados | sí | sí |
| sólo un tab | quedaba `has_email = true` | queda vacío: «sin correo» |

Con la corrección, contrato y esquema real dan el mismo resultado que `trim()` de JS en los 25 blancos y en los controles negativos (secciones COMPLETADO y VALIDACIÓN). El conteo agregado de emails con esos blancos ya no es condición para aplicar: sólo informa cuántos hay hoy.

## CONTROLES ROJOS

Los contratos nuevos se corrieron contra cada variante de las migraciones en un PostgreSQL 17.11 desechable propio (`dtd_l10_red_5e1f0c2a`, retirado). Los archivos se copiaron en `/sb`, igual que `scripts/run-sql-tests.mjs`. Las variantes las generó `make-variants.mjs`, que aborta si una mutación no ocurre exactamente una vez.

| Variante | Contrato 0410 | Contrato 0415 |
|---|---|---|
| `nueva` (archivos de la ronda 2) | PASÓ, rollback | PASÓ, rollback |
| `0410-normalizacion-del-origen` | rojo: 55 casos. Son 7 con nombre, 24 blancos a ambos lados y 24 emails que son sólo ese blanco; no fallan el espacio común ni los 3 controles negativos | rojo: los mismos 55 |
| `0410-solo-lado-cliente` | rojo: 1 caso, «queja con mayúsculas y tab en to_email» | rojo: el mismo |
| `0410-sin-bom` | rojo: 3 casos, «BOM a ambos lados», «U+FEFF a ambos lados» y «email que es sólo U+FEFF» | rojo: los mismos |
| `0410-origen` | rojo en la aserción estática: sin timeouts | rojo: la misma |
| `0410-timeouts-tras-preflight` | rojo en la aserción estática: posición | rojo: la misma |
| `0410-timeouts-en-comentario` | rojo en la aserción dinámica: `0` y `0` | rojo: la misma |
| `0415-origen` | PASÓ (no incluye 0415) | rojo en la aserción estática de 0415: sin timeouts |
| `0415-timeouts-tras-preflight` | PASÓ | rojo en la aserción estática de 0415: posición |
| `0415-timeouts-en-comentario` | PASÓ | rojo en la aserción dinámica de 0415: `0` y `0` |

`0410-origen` cae primero en la aserción de timeouts porque es la que corre antes. Su normalización queda cubierta por `0410-normalizacion-del-origen`. En la ronda 3 los contratos volvieron a pasar con las cabeceras corregidas: sus aserciones estáticas quitan los comentarios antes de medir.

## ORDEN DE APLICACIÓN Y LOCKS

Medición local y efímera, no de producción, repetida en la ronda 2 con los archivos finales. La ronda 3 no cambia sentencias.
- **Contenedor:** `dtd_l10_r2_5e1f0c2a` (`postgres:17`, 17.11), con los stubs de plataforma del repo.
- **Base:** 419 migraciones de `main` `bca98147` sin L10 ni las 18 sólo-ledger, incluida 0451, aplicadas en 15 s.
- **Aplicación:** cada migración L10 en su propia transacción, leyendo `pg_locks` del propio backend antes del COMMIT.
- **Datos:** los sintéticos de la ronda 1 más un tenant T3 con emails sucios, insertados con `session_replication_role = replica`.
- **Limpieza:** contenedor retirado. El stack ajeno `dtd-pr28-auth-*` no se tocó.

La ronda 1 midió lo mismo con los archivos de origen, en `dtd_l10_locks_5e1f0c2a` y con PostgREST v16.1.

| Paso | Migración | Qué hace | Requiere | Locks retenidos hasta COMMIT (ronda 2) | Timeouts | Compatibilidad |
|---|---|---|---|---|---|---|
| 1 | 0410 | RPC con normalización y ACL de la función | `mail_logs`, `invoices`, `clients`, helpers activos de 0200, policy `mail_logs_tenant_select` (preflight `0410:32-51`) y `authenticated` sin TRUNCATE, que da 0399 (postflight `:145-167`) | ninguno sobre tablas de usuario; 14 de catálogo (AccessShare y RowExclusive) y el objeto `pg_proc` en ShareUpdateExclusive; ~4 ms | **propios, dentro de la transacción: 5 s y 60 s**; medidos en `5s` y `1min` con la sesión en `0` | compatible con `main`: lectura directa idéntica antes y después (medido) |
| 2 | — | **despliegue de esta PR** y verificación de la vista previa con accounting y admin | 0410 aplicada y verificada | — | — | antes de este paso el código nuevo no opera (MIGRATE-FIRST) |
| 3 | 0415 | policy admin y ACL de `authenticated` sólo SELECT | 0410 (preflight `0415:15-44`), policy histórica, ninguna otra policy SELECT o ALL para authenticated o public, y el consumidor nuevo desplegado | **ACCESS EXCLUSIVE sobre `mail_logs`** (más su AccessShare) y el objeto `pg_policy` en AccessExclusive; ~5 ms sin contención | **propios, dentro de la transacción: 5 s y 60 s**; medidos en `5s` y `1min` | rompe **en silencio** el consumidor anterior de Cobranzas |

**Contención de 0415 con el archivo final**, aplicado dentro de una transacción en una sesión **sin** `lock_timeout` propio, con otra sesión que retenía ACCESS SHARE sobre `mail_logs` durante 15 s:
- La migración cortó en `DROP POLICY` (`0415:46`) a los 5,001 s con `canceling statement due to lock timeout`. La transacción entera se revirtió y las cinco policies siguieron intactas.
- Un lector nuevo, también **sin** `lock_timeout`, llegó 1,9 s después de empezar la migración y quedó en cola detrás del ACCESS EXCLUSIVE pendiente. Esperó 3,148 s y terminó normal en cuanto la migración se rindió.

**Referencia de la ronda 1**, con los archivos de origen sin timeouts propios:
- Sin `lock_timeout`, la `DROP POLICY` esperó 9,827 s, hasta que terminó el lector.
- Con `lock_timeout = 3s` de sesión, cortó a los 3,001 s.
- Un lector con `lock_timeout = 2s` cortó a los 2,001 s en la cola.

Riesgos operativos:
- **El tope de lock_timeout/statement_timeout rige solo si se aplica dentro de una transacción, como hace apply_migration; si se aplicara en autocommit, no tiene efecto: usar entonces una sesión con `set lock_timeout`.** A diferencia de 0450 y 0451, que lo fijan dentro de su `do`, aquí va al nivel superior del archivo (ver ronda 3).
- **0415 sigue deteniendo `mail_logs` mientras espera, ahora como máximo 5 s.** Envíos, webhook de Resend, crons y consola de Mailing quedan en cola; por eso se conserva la ventana de baja actividad de correo. Si corta, no deja nada a medias y se reintenta.
- **Postflight de 0410 y ACL real:** si `authenticated` tuviera INSERT, UPDATE o DELETE sobre `mail_logs`, 0410 aborta entera sin crear nada (medido en la ronda 1). Con el patrón capturado en producción para las tablas de Mailing (`rxtm`) pasa. Lectura de catálogo previa en la espera.

## VALIDACIÓN

Recibos fuera de Git en `C:/Users/AKXGEN~1/AppData/Local/Temp/claude/C--Users-AKX-generator-Desktop-Developer-DTDCARGO/a4705ad7-612e-488b-9826-2cd036e3da72/scratchpad/c-l10-recordatorios-cobranzas/`.
- **Ronda 1:**
  - Gates e instalación: `pnpm-install.log`, `vitest-focal.log`, `typecheck.log`, `eslint-focal.log`, `sql-focal.log`, `docs-index.log`, `docs-check.log`, `governance-check.log`, `sdd-check.log` y `pending-symbols.log`.
  - Fases: `base-build.log`, `db-phase1.log`, `phase-pre0410.log`, `phase-pre0410-e2e.log`, `phase-0451.log`, `phase-apply0410.log`, `phase-contention.log`, `phase-apply0415.log` e `isolation.out`.
  - Verify: `verify-r1-8ae4e5e5.log`, `.meta` y `.exit`.
  - Scripts: `build-base.sh`, `run-phases.sh`, `sql/*.sql`, `l10-e2e.mts` y `old-recordatorios-queries.ts` (blob de `main` `bd86f8d3`).
- **Ronda 2:**
  - Logs: `redcontrol.log`, `round2.log`, `isolation-r2.out`, `pending-symbols-r2.log` y `pending-symbols-r2b.log`.
  - Scripts y variantes: `make-variants.mjs`, `run-redcontrol.sh`, `redcontrol/`, `run-round2.sh` y los SQL nuevos de `sql/`.
  - **Verify de referencia:** `verify-h1-458b3542.log`, `.meta`, `.exit` y `-clean.log`, con `summarize-verify.mjs`.
- **Ronda 3:**
  - Logs: `validate-r3.log`, `r3-migrations.diff`, `r3-check-migrations-applied.log`, `r3-check-migrations-applied-vitest.log`, `r3-harness.log`, `r3-docs-check.log`, `r3-sdd-check.log`, `r3-pending-symbols.log`, `e2e-diagnostico.log` y `orphans-check.log`.
  - Scripts: `apply-comment-fixes.mjs`, `apply-waits.mjs`, `check-waits-r3.mjs`, `validate-r3.sh`, `e2e-retry-analysis.mjs`, `orphans-check.ps1` y `sql/autocommit-set-local.sql`.

No se copiaron credenciales ni se tocó Supabase alojado.

| Comprobación | Estado y evidencia |
|---|---|
| `guard` / `claim` / `guard --owner` | PASÓ: claim `c-l10-recordatorios-cobranzas-20260912`; guard revalidado antes de cada escritura en el worktree, de cada commit y del push |
| `corepack pnpm install --frozen-lockfile` | PASÓ en 21,1 s (pnpm 12.3.4); lockfile intacto |
| Identidad frente a #21 | PASÓ: TS y test idénticos; SQL y contratos iguales al origen más las desviaciones; specs iguales al origen más la nota |
| Vitest focal `lib/studio/collections/__tests__/` (ronda 1; el código no cambió después) | PASÓ: 2 archivos, 22 tests |
| `corepack pnpm typecheck` / ESLint focal (ronda 1; sin cambios de TS después) | PASÓ / PASÓ |
| Bytes de los cuatro SQL (rondas 2 y 3, Node) | PASÓ: CR = 0 y fin de línea LF, en el árbol y en los blobs commiteados |
| Contratos 0410 y 0415 de la ronda 2 (variante `nueva`) | PASÓ: ambos con `*_fixture_rolled_back = t` |
| Controles rojos (ronda 2) | PASÓ: las 9 variantes mutadas dan rojo donde deben (tabla «Controles rojos») |
| Base local de la ronda 2: `main` `bca98147` sin L10 | PASÓ: 419 migraciones en 15 s |
| Lectura directa por rol, antes de 0410 / tras 0410 / tras 0415 (ronda 2) | PASÓ: admin 5/5/5 · accounting 5/5/**0** · commercial 5/5/**0** · accounting desactivado 0/0/0 · accounting de T2 2/2/**0** · service_role 11/11/11 (incluye las 4 filas de T3) |
| Matriz de la RPC tras 0410 y tras 0415 (ronda 2) | PASÓ, idéntica en ambas fases y a la ronda 1. Accounting de T1 recibe 5 filas: excluye la factura borrada, las de T2 y la inexistente. DTD-L101 da `has_email`, `complained` y `2026-08-31`. DTD-L102, DTD-L103 y DTD-L104 dan falso. DTD-L105 da `has_email` sin queja, aunque T2 tiene una queja sobre la misma dirección. Admin recibe lo mismo; accounting de T2 sólo sus 2 facturas. Vacío y nulo dan 0; 1001 ids dan 22023; commercial, accounting desactivado, service_role sin usuario y anon dan 42501 |
| Normalización sobre el esquema real, tras 0410 y tras 0415 (ronda 2, tenant T3) | PASÓ: DTD-L301 (salto de línea al final) `t/t`; DTD-L302 (NBSP al inicio) `t/t`; DTD-L303 (sólo tab) `f/f`; DTD-L304 (queja con mayúsculas y tab) `t/t`; DTD-L305 (U+200B, control) `t/f` |
| Timeouts dentro de la transacción (ronda 2) | PASÓ: `SETTINGS_SESION 0/0` y `SETTINGS_TRANSACCION 5s/1min` al aplicar 0410 y al aplicar 0415 |
| Contención de 0415 con el archivo final (ronda 2) | PASÓ: cortó sola a los 5,001 s y revirtió; el lector nuevo sin `lock_timeout` esperó 3,148 s y terminó; policies intactas |
| `_tenant-isolation.assert.sql` tras L10 (ronda 2) | PASÓ (exit 0) |
| Catálogo final (ronda 2) | PASÓ. RPC: SECURITY DEFINER, `STABLE`, `search_path=""`, `proacl {postgres=X, service_role=X, authenticated=X}` y comentario de origen; anon y PUBLIC sin EXECUTE. `mail_logs`: `relacl {postgres=arwdDxtm, service_role=arwdDxtm, authenticated=r}` y policies `mail_logs_admin_select`, `mail_logs_no_delete`, `mail_logs_no_insert_authenticated`, `mail_logs_no_update_authenticated` y `service_role_all_mail_logs` |
| ACL de 0410 con el patrón de producción (`rxtm`) y con INSERT concedido (ronda 1) | PASÓ: con `rxtm` aplica; con INSERT aborta en el postflight («ACL final de mail_logs inválida», exit 3) sin crear la RPC |
| Extremo a extremo con PostgREST v16.1 (ronda 1) | PASÓ. Antes de 0410, el consumidor nuevo lanza `PGRST202`. Tras 0410, da con accounting y admin las mismas señales que el de `main`, y commercial y accounting desactivado lanzan. Tras 0415, el consumidor de `main` con accounting da `marcaronSpam []` y `ultimoRecordatorio []` sin error. **NO EJECUTADO después:** firma, tipo de retorno y ACL no cambiaron (catálogo de la ronda 2) y el camino migrate-first no depende del cuerpo |
| Gates rápidos tras las esperas v3 (ronda 2) | PASÓ: `pending-migration-symbols` `0 ROJO · 1 AMARILLO`; `docs:check` con 441 specs; `sdd:check` sin números repetidos; `governance:check` con 28 políticas; `git diff --check` |
| `corepack pnpm verify` sobre `8ae4e5e5` (ronda 1) | FALLÓ, exit 1, entre las 18:10:39 y las 18:25:45 (−04:00). Detalle: 15 PASÓ; `migrations-applied` NO DISPONIBLE; `e2e` FALLÓ por 15 fallos ambientales en ambas pasadas; build PASÓ. **Superado:** el SQL cambió en la ronda 2 y esa corrida no se usa como cierre |
| **`corepack pnpm verify` sobre `458b3542` (ronda 2), referencia de cierre del código** | **FALLÓ, exit 1**, entre las 18:56:57 y las 19:21:15 (−04:00), con HEAD `458b3542` y árbol limpio al inicio y al final. Corrieron de verdad 16 de 17 pasos: 15 PASÓ, `migrations-applied` NO DISPONIBLE y `e2e` FALLÓ, colgado y cortado por el watchdog. Veredicto literal y detalle abajo |
| Ronda 3 · `git diff 458b3542..HEAD -- supabase/migrations` | PASÓ: 2 archivos, 12 líneas cambiadas (6 y 6), las 12 son comentario; mismo número de líneas (`r3-migrations.diff`) |
| Ronda 3 · contratos 0410 y 0415 sobre `be31a98d` (contenedor propio, PostgreSQL 17.11) | PASÓ: ambos `exit 0` con `*_fixture_rolled_back = t`; sus aserciones estáticas leen los archivos corregidos |
| Ronda 3 · semántica de `SET LOCAL` (`sql/autocommit-set-local.sql`) | medido: WARNING y sin tope al nivel superior en autocommit; rige dentro de un `do`, dentro de una transacción y como `set` de sesión (sección «Ronda 3») |
| Ronda 3 · `node --test scripts/check-migrations-applied.test.mjs` | **FALLÓ por el runner, no por una aserción:** el archivo es un test de Vitest (`import { describe, expect, it } from "vitest"`, `:15`) y bajo `node --test` revienta al cargar, en su primer `describe` (`:35`), dentro de `@vitest/runner` («Cannot read properties of undefined (reading 'config')»), antes de leer datos del repo. Ni el test ni `scripts/check-migrations-applied.mjs` cambian frente a `origin/main` ni frente a `458b3542` |
| Ronda 3 · el mismo test con su runner: `corepack pnpm exec vitest run scripts/check-migrations-applied.test.mjs` | PASÓ: 1 archivo, 22 pruebas. La configuración de Vitest no restringe `include` y sólo excluye `node_modules`, `.next`, `.claude` y `e2e`, así que el archivo también entra en el paso `test` del verify sobre `458b3542` |
| Ronda 3 · `corepack pnpm harness:test` | PASÓ: 87 pruebas |
| Ronda 3 · `node scripts/build-docs-index.mjs --check` / `corepack pnpm sdd:check` | PASÓ: 441 specs sincronizadas / sin números repetidos |
| Ronda 3 · `git diff --check` en `458b3542..HEAD` y en `origin/main...HEAD` | PASÓ |
| Ronda 3 · complementarias | PASÓ: `pending-migration-symbols` `0 ROJO · 1 AMARILLO`; 12 comprobaciones de las esperas (frase literal, orden, párrafo literal, sin cita de 0342 ni 0383; `cutoff`, `$doc` y 0451 iguales a `main`) |
| Procesos huérfanos de la corrida de `458b3542` | PASÓ: ninguno. El watchdog terminó 25 procesos de su propio árbol (chrome-headless-shell ×15, node ×9, cmd ×1) con 0 sobrevivientes. Después no quedaron procesos con la ruta del worktree en la línea de comandos, ni navegadores o `node` creados desde las 18:56, ni puertos en escucha entre 3100 y 3799, ni Playwright o `next dev` en ninguna ruta (`orphans-check.log`); no hubo nada que detener |
| `corepack pnpm verify` sobre la cabeza final | **NO EJECUTADO, por instrucción del Director.** Después de `458b3542` sólo cambian texto: el diff de `supabase/migrations` contra `458b3542` son sólo líneas de comentario (fila de la ronda 3), además de las esperas, las notas de las specs y este handoff. La referencia es `verify-h1-458b3542.meta` (`head=458b3542bcab8e7a262c174f856fcba8dee98692`, árbol limpio al inicio y al final) |
| `/ui-check` | NO EJECUTADO por no aplicar: L10 no toca UI; el cajón de recordatorios no cambia |
| Producción / Supabase alojado | NO EJECUTADO por límite del encargo: no se aplicaron migraciones, no se leyeron filas ni catálogo y no se abrió conexión |

Detalle por paso de `corepack pnpm verify` sobre `458b3542bcab8e7a262c174f856fcba8dee98692` (`verify-h1-458b3542.log`; Node 24.20.0, pnpm 12.3.4, Docker 29.7.2):

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ, 41 pruebas |
| lint | PASÓ, 0 errores y 8 advertencias en archivos que esta PR no toca: `NewPurchaseWizard.test.tsx` (4), `PurchaseStepDetalle.test.tsx` (2), `KommoBoardView.tsx` (1) y `KommoClient.tsx` (1) |
| rsc-boundary | PASÓ, 1599 módulos escaneados |
| typecheck | PASÓ |
| edge-functions | PASÓ, 4 funciones compilan con Deno |
| test | PASÓ, 544 archivos y 6814 pruebas |
| docs:check | PASÓ, 441 specs sincronizadas |
| numbering | PASÓ, 441 specs · 439 migraciones; conserva los choques históricos declarados |
| feature-constants | PASÓ, 5 banderas |
| components:check | PASÓ |
| governance:check | PASÓ, 28 políticas aprobadas |
| migrations-applied | NO DISPONIBLE: SKIP sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; no se midió el ledger real |
| pending-migration-symbols | PASÓ, `0 ROJO · 1 AMARILLO` declarado |
| sql-tests | PASÓ, 182 contratos con rollback, incluidos 0410 y 0415 con la normalización, la matriz y las aserciones de timeouts |
| schema-rebuild | PASÓ: inventario de 439; 421 migraciones desde cero y 18 sólo-ledger sin cambio de esquema; aislamiento multi-tenant en 219 tablas con 2 tenants |
| e2e | **FALLÓ: colgado y cortado por el watchdog de SDD-0454.** Detalle en la lista siguiente |
| build | PASÓ: compilación de producción en 13,5 s y 160 de 160 páginas estáticas generadas; `[build] build de producción OK`. Los errores de `listPublishedPosts` y `getPublic*` por Supabase sin configurar salen durante la generación estática y no la detienen: no son una falla distinta del e2e ambiental |

Diagnóstico del e2e, leído del log sin volver a correrlo (`e2e-diagnostico.log`):
- **Arranque:** dev server propio en el puerto 3122; 186 pruebas con 8 workers.
- **Primera pasada, completa:** los 15 fallos ambientales conocidos, cada uno con su reintento interno: `auth.spec.ts:21`, `:91`, `:98` y `:105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari. Resumen de Playwright: `15 failed`, `18 skipped` y `153 passed (4.1m)`. El WebServer registra la causa: el cliente Supabase sin URL ni clave (`proxy.ts:67`, 192 apariciones en el log).
- **Reintento automático 1/1, colgado:**
  - Imprimió 166 de los 201 resultados que dio la primera pasada: chromium 67/67, mobile-chrome 67/67 y mobile-safari 32/67.
  - Hasta ahí, los mismos fallos ambientales: 123 aprobadas, 15 omitidas y 28 líneas de fallo. Son 14 pruebas con su reintento interno: las 5 ambientales en chromium y en mobile-chrome, y las 4 de `auth.spec.ts` en mobile-safari.
  - El último resultado fue el 166, `[mobile-safari] gastos-expense-void.spec.ts:99:7`, omitida. Después sólo salieron 29 líneas del WebServer con el mismo error de `proxy.ts:67`, y 10 minutos de silencio.
- **Dónde se colgó:** el reporter imprime cada prueba al terminar, así que el log no nombra la que quedó en curso. Por el orden de la primera pasada, la siguiente de mobile-safari era `global-search.spec.ts:22:7`, que falla con ese mismo error. Es una inferencia, no un registro.
- **Corte:** el watchdog terminó 25 procesos de su propio árbol, con 0 sobrevivientes.
- **Relación con L10:** ningún archivo de `e2e/` menciona Cobranzas, recordatorios, Mailing, `mail_logs` ni `collections`. Los specs sólo apuntan a `/studio/login`, `dashboard`, `gastos`, `nomina`, `tracking`, `attachments` y `global-search`; su único import de la app es `lib/studio/audit-queries`. El log no registra navegación a esas rutas: `/studio/cobranzas`, `/studio/mailing` y `recordatorios` aparecen sólo como ruta del worktree en avisos y trazas, en la salida del gate de símbolos y en la tabla de rutas del build. Nada contradice que L10 no toca UI ni rutas del e2e.

Veredicto literal: `verify: 1 fallo(s) → e2e [COLGADO/TIMEOUT: sin salida durante 10 min; límite de inactividad 10 min (VERIFY_E2E_IDLE_MIN)] CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se absuelve ni se presenta como verde.
- `verify-h1-458b3542.meta`: inicio 18:56:57, fin 19:21:15, exit 1, HEAD `458b3542…` al inicio y al final, y 0 líneas de `git status --porcelain` al inicio y al final.
- Recibos: `.log`, `.exit` y `-clean.log`.

## COMMITS

Ronda 1:
- `85c055eb7e40a03b3b9a73807460bc112d2ab99f` — SQL 0410/0415 y contratos, idénticos al origen.
- `e9756273aa1de176a68f809cd20775175e57f1d7` — esperas de 0410 y 0415 en el baseline.
- `93afa5aebdccf4cb8e3b5f361e2a55ae4ab047c3` — `contextoDeEnvio` por la RPC, test nuevo y declaración migrate-first.
- `8ae4e5e5220e66f457a5815660c5f3ddd62b8ef3` — specs 0353 y 0358 con nota e índice regenerado.

Ronda 2:
- `d57fda5f3607cec460445e4d3118d5d3124cc92e` — 0410 normaliza el email como `trim()` de JS; 0410 y 0415 fijan `lock_timeout` y `statement_timeout`; contratos con los casos, la matriz, los controles negativos y las aserciones de timeouts. Su mensaje conserva la cita inexacta del precedente, corregida en la ronda 3.
- `308a5744371b0029717ff470d5008e2e1b223c77` — esperas de 0410 y 0415 al día.
- `458b3542bcab8e7a262c174f856fcba8dee98692` — notas de 0353 y 0358 con las desviaciones. **Referencia de cierre del código: `verify` completo.**

Ronda 3:
- `be31a98d687540ffe411988414da81d75f6720e5` — sólo texto: cabeceras de 0410 y 0415 con el precedente correcto y el mismo número de líneas, frase literal de la condición transaccional en las esperas y la misma precisión en las notas de 0353 y 0358.
- `f555f5eb5e2d12fd995a0c947bfdc0217a870dcc` — este documento en su versión de la ronda 1 de la PR; cabeza publicada el 2026-09-12. Su check `Calidad local sin secretos` pasó en GitHub.

Ronda 2 de la PR (2026-09-13):
- `e118f7c04f82e77955d5b0659c549dfae3079bae` — merge de `origin/main` `8ec7ebe3` con el driver de `main`; índice a 443 specs; sin conflictos.
- `4d5e4aace715ef7d4284e50124c90ea160762709` — 0410 aplicada: sale de `pendingBelowCutoff` y de las declaraciones; la espera de 0415 dice el estado real. Gate `0 ROJO · 0 AMARILLO`.
- `db061ca5afd3abef97c304192f9eacc60b9136a9` — notas de 0353 y 0358 con la aplicación de 0410. **Cabeza de código de la ronda 2: `verify` completo.**
- Commit que contiene esta versión del documento: sólo agrega este handoff. Es la cabeza publicada de la ronda 2; su hash va en el reporte al Director.

El orden deja cada commit intermedio verde para `pending-migration-symbols`: el SQL entra sin esperas, las esperas entran sin código alcanzable y el código entra con su declaración.

## PR / BRANCH

PR #105 en borrador contra `main` desde `codex/c-l10-recordatorios-cobranzas`: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/105. Ronda 1 publicada el 2026-09-12 con `f555f5eb` en un único push normal después de todos los commits; `8ae4e5e5` no se publicó. Ronda 2 publicada el 2026-09-13, también con un único push normal después de todos sus commits; el cuerpo de la PR se actualizó con `gh pr edit` para quitar «No fusionar antes de aplicar y verificar 0410» de la primera línea y poner el estado real. Worktree conservado en la ruta de arriba. Sin merge, deploy ni aplicación de migraciones desde esta sesión.

**Fusionar NO autoriza aplicar 0415. Fusionar y desplegar es el paso 2 del orden de L10; 0415 va sólo después del smoke de la vista previa de recordatorios con accounting y admin.**

## PENDIENTES DE ESTA TAREA

- **`e2e` sin cobertura completa en las dos corridas.** En la ronda 1 la primera pasada terminó con los 15 ambientales y el reintento se colgó; en la ronda 2 se colgó la primera pasada tras 167 de 186 resultados, en el mismo punto de mobile-safari, con los 14 ambientales que alcanzó a medir y un flaky que pasó al reintentar. Hace falta una corrida con configuración de Supabase para tener cobertura real: el CI alojado (`Calidad local sin secretos`) no corre e2e, contratos SQL, rebuild ni `migrations-applied`. No se reintentó: el contrato del watchdog es sin reintento.
- **`migrations-applied` sin medir** en este árbol, por falta de `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; la evidencia de que 0410 está aplicada es la del Director. Ni esto ni lo anterior autorizan copiar credenciales.
- CI alojado (`quality`) del SHA publicado de la ronda 2 y revisión del Director.
- Merge (Director) y despliegue; smoke de la vista previa de recordatorios con accounting y admin (Sam o alguien del equipo, con cuentas reales); después, 0415 con OK nominal de Sam y retiro de su espera en una rama propia.
- Ninguno de implementación o preparación del lote. La decisión de normalización ya está tomada y aplicada.

## FUERA DE ALCANCE DETECTADO

- **Consultas sin llamadores:** `listLogs`, `getLog` y `computeMailKpis` (`lib/studio/mail-queries.ts:166-199` y `:288-306`). Si un día las usa una sesión no admin, tras 0415 devolverán `[]`, `null` o `EMPTY_KPIS` sin error (`:184`, `:197` y `:308`). Conviene retirarlas o documentar que son admin-only.
- **Higiene de permisos de `anon`:** en producción probablemente conserva REFERENCES, TRIGGER y MAINTAIN sobre tablas anteriores a 0399, incluida `mail_logs`. El patrón `anon=xtm` quedó capturado en `.agents/handoffs/0409-aplicacion-prod-20260911.md:32`. 0415 sólo normaliza `authenticated`. Va en su propia tarea; NO VERIFICABLE sin leer el catálogo de producción.
- **EXECUTE de `collections_mail_context` para service_role** sin uso posible (`0410:139-140`; medido 42501). Documentado y sin tocar, por instrucción del Director.
- **Retención de `mail_logs` sin purga:** MP-01 P4 (`docs/governance/policies/mp-01.md:63`; `docs/legal/privacidad/mapa-de-borrado.md:186`).
- **Email compartido en el consumidor de `main`:** con dos clientes del mismo tenant y la misma dirección, sólo el último queda como «marcó spam» (`recordatorios-queries.ts` de `main`, `:67`). L10 lo corrige al desplegarse; mientras tanto sigue en producción. Por lectura de código.
- **`lower()` de PostgreSQL frente a `toLowerCase()` de JS:** coinciden en ASCII. Con letras fuera de ASCII dependen de la colación de la base y de las tablas de Unicode de cada motor. Sólo afectaría a direcciones con mayúsculas no ASCII; sin medir.
- **Timeouts de sesión en 0342 y 0383:** `set lock_timeout` y `set statement_timeout` sin `local` y sin `reset` dejan esos valores fijados en la sesión que aplicó la migración, también para lo que corra después en ella. Ya están aplicadas y no se tocan; es un matiz para futuras migraciones.
- **Mensaje de `d57fda5f`:** conserva la cita «como 0342, 0383, 0450 y 0451». Los archivos, las esperas, las notas y este handoff ya tienen la cita correcta.
- **E2E sin configuración de Supabase:** los 15 fallos ambientales (`auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en tres navegadores) y el cuelgue del reintento, probablemente en `global-search.spec.ts:22:7` de mobile-safari (inferencia por orden). No se atribuyen a L10, que no toca UI ni rutas del e2e.
- **Ocho advertencias de lint** en archivos que esta PR no toca: `NewPurchaseWizard.test.tsx` (4), `PurchaseStepDetalle.test.tsx` (2), `KommoBoardView.tsx` (1) y `KommoClient.tsx` (1).
- **`node --test` no puede correr `scripts/check-migrations-applied.test.mjs`:** es un test de Vitest y revienta al cargar. Su runner es `vitest run` (`pnpm test`); con Vitest pasa (22 pruebas).

## HANDOFF AL DIRECTOR

- **Revisión:** PR en borrador.
  - Las dos desviaciones y sus controles rojos.
  - Esperas y declaración.
  - Tabla de lectores del análisis 2.
  - La ronda 3 sólo cambia texto (diff de migraciones con sólo comentarios). Nada impidió aplicar el punto 2 de la ronda 2.
  - El e2e de la corrida de referencia de la ronda 1 quedó FALLÓ, colgado y cortado por el watchdog; su primera pasada dio sólo los 15 ambientales. El verify de la ronda 2 está en la sección «RONDA 2».
- **Secuencia de release, cada paso con su autorización** (detalle en «RONDA 2 › Secuencia de release, actualizada»):
  1. **0410: hecho** el 2026-09-13 (ledger `20260913184537`). Espera y declaración retiradas en esta rama.
  2. **Fusionar (Director) y desplegar esta PR**; smoke de la vista previa de recordatorios con accounting y admin.
  3. **0415**, sólo después de ese smoke, con OK nominal de Sam, en una ventana de bajo tráfico de correo y dentro de una transacción. Su `lock_timeout` de 5 s la corta y la revierte si hay contención; se reintenta. Verificar `mail_logs_admin_select`, `authenticated=r` y otra vez la vista previa con accounting. Retirar su espera en una rama propia.
- **Conflictos con la PR #104:** baseline, declaraciones e índice, resueltos por el driver `dtd-generated-records`. No hay código compartido.
- **Sesiones consumidoras:** ninguna otra usa este worktree.
  - No quedan contenedores propios (`dtd_l10_*`) ni procesos huérfanos de la corrida de `458b3542` ni de la de `db061ca5` (watchdog con 0 sobrevivientes y chequeo posterior limpio, sin nada que detener).
  - El stack `dtd-pr28-auth-*` y los worktrees y ramas de `aliados-cadena-tenant` y `c-l14-portal-comandos-recibos` no se tocaron.
  - Ownership liberado al cierre con `node scripts/harness-worktree.mjs release --owner c-l10-recordatorios-cobranzas-20260912`, después del commit y del push.
  - Se conservan worktree y rama.
