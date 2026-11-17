# Handoff — SDD-0646, enmienda D-1 (opción C): el correo del registro por link se comprueba

Fecha: 2026-11-17. Task ID: `sdd-0646-d1-opcion-c-correo-comprobado`.
Owner / sesión escritora: `local-0646-opcion-c` (Worker Claude Code, lanzado por el DG). Sin subagentes.

- **Worktree:** `.claude/worktrees/0646-invitacion-por-link-475356`; `guard` y `claim --owner local-0646-opcion-c` PASARON antes de los commits.
- **Rama:** `claude/0646-opcion-c-correo-bd40d2`, base `1a0085ffa` (main del 2026-11-17).
- **SDD:** enmienda de `docs/specs/0646-invitacion-portal-por-link/spec.md` (sigue `in-progress`). No se creó SDD nueva.
- **Migración:** `0559_registro_link_correo_comprobado` (número asignado por el DG). **NO APLICADA A PRODUCCIÓN.** Espera declarada en `supabase/migrations-baseline.json`.
- **Handoff anterior de la SDD (primera entrega, opción A):** `.agents/handoffs/sdd-0646-invitacion-portal-por-link.md`. Es evidencia fechada; su punto 5 (D-1 opción A y el indicador «entró desde su correo») quedó reemplazado por este documento.

## OBJETIVO ORIGINAL

Sam decidió el 2026-11-17 cambiar la decisión D-1 de la SDD-0646 de la opción A a una opción C: el cliente del sistema anterior sigue entrando directo al completar el formulario del link, pero el correo que escribió no sirve para obtener ni recuperar acceso hasta que su dueño lo comprueba con un enlace de un solo uso que solo comprueba.

Antes de implementar se reportó al DG que el bloqueo solo en la app no alcanzaba. El DG eligió el diseño que se entrega aquí (la cuenta de Auth no lleva el correo hasta que se comprueba) y fijó ocho condiciones; la tabla de abajo las recorre.

## COMPLETADO

- **Migración 0559** (`supabase/migrations/0559_registro_link_correo_comprobado.sql`).
  - Tabla `client_email_checks`: el estado «comprobado» propio (no el `email_confirmed_at` de Auth). Por qué una tabla y no una columna de `client_users`: está en la cabecera de la migración.
  - `portal_registration_link_bind` reemplazado con preflight por md5 del cuerpo de la 0552 (`9dc4862d…`). Acepta la cuenta con dirección interna y sigue aceptando la de la app anterior.
  - RPC del enlace (solo `service_role`), `portal_email_check_prepare` (equipo), `portal_email_sin_comprobar`, trigger de cambio de correo en `clients`, fila «sin comprobar» para las cuentas por link ya creadas, retiro de `portal_registration_link_email_status`.
  - Desarme en `supabase/desarmes/` (leer su cabecera: no devuelve el correo a las cuentas que ya llevan dirección interna).
- **Registro por link** (`app/registro/link/[token]/actions.ts`): la cuenta nace con una dirección interna aleatoria en dominio `.invalid`; la entrada directa se acuña para esa dirección; al correo le sale el enlace de comprobación.
- **Enlace de comprobación** (`app/registro/correo/[token]/`): el GET solo lee; el POST reclama, pasa el correo a la cuenta y marca comprobado. No crea sesión. Un mensaje único para todo lo que no comprueba.
- **Bloqueo en la app (segunda capa):** `/entrar` (misma respuesta y mismas consultas que un correo inexistente), invitación por correo (`sendPortalInviteEmail`, que cubre la ficha, el recordatorio por cron y el reenvío masivo), y `sendEmail` (ningún envío toma la dirección interna). El portal no tiene recuperación de contraseña: la entrada es por enlace.
- **Acceso por WhatsApp (SDD-0253):** `loadAccessTarget` acuña para la cuenta del cliente cuando está sin comprobar. Es la recuperación de estas cuentas.
- **Studio:** «Registros por link» muestra «Correo comprobado / sin comprobar / ese correo ya tiene otra cuenta» con el estado real; botón «Reenviar comprobación»; corregir el correo en la ficha deja la cuenta sin comprobar y avisa.
- **Corrida única** de las cuentas ya creadas: `infra/ops/portal-correo-comprobacion/` (ensayo por defecto, `--aplicar` escribe, sin datos en el repo). **No se corrió.**
- **Spec enmendada:** D-1 a opción C, §4.1 (migración 0559), criterios 9 a 18, tabla de datos personales de la enmienda, límites de las pruebas y allowlist.

### Las ocho condiciones del DG

| # | Condición | Dónde quedó |
|---|---|---|
| 1 | Dirección interna en dominio reservado, de un id aleatorio; ningún envío la toma | `nuevoCorreoInterno` (128 bits, `@sin-comprobar.invalid`); `sendEmail` la rechaza; se buscó por valor todo lo que lee el correo desde Auth o desde `client_users`: el portal lee el de la ficha, y los envíos que leen `client_users.email` pasan todos por `sendPortalInviteEmail` → `sendEmail`. **Sin probar contra un Auth real** (ver pendientes). |
| 2 | El correo real solo en nuestra tabla hasta confirmar; choque → genérico, marcado, sin fusionar | `client_email_checks.pending_email`; `portal_email_check_claim` marca `conflict_at`; contrato §L |
| 3 | El chequeo previo «ese correo ya tiene cuenta» se mantiene | `portal_registration_link_complete` no se tocó |
| 4 | `/entrar` con el correo sin comprobar: respuesta idéntica a la de uno inexistente | misma respuesta, mismas consultas y ningún envío (`app/entrar/__tests__/actions.test.ts`). «Idéntica en tiempo» se midió por consultas y envíos, no cronometrando |
| 5 | Corregir el correo vuelve a «sin comprobar» y Auth vuelve a la dirección interna | trigger de la 0559 (contrato §M) + `updateClientAction` (`correo-comprobacion-studio.test.ts`) |
| 6 | Mantener el bloqueo en la app | `correoSinComprobar` en `/entrar` y en la invitación; falla cerrado |
| 7 | Botón «Reenviar comprobación» y corrida única con ensayo | `resendEmailCheckAction`; `pasar-cuentas-a-direccion-interna.mjs` |
| 8 | `service_role` solo en servidor y después del control de rol | orden probado en `correo-comprobacion-studio.test.ts` |

## DECISIONES TOMADAS

1. **«Comprobado» vive en `client_email_checks`**, una fila por cliente registrado por link, atada a la cuenta de Auth que nació del link.
2. **A quién aplica:** solo a esa cuenta, mientras sea el acceso activo del cliente. Si el equipo revoca y vuelve a invitar por correo (SDD-0042), el cliente pasa a ese camino y la regla deja de aplicar: entra desde su correo, y esa es la prueba. Es un límite deliberado; está en la spec.
3. **Cuentas por link ya creadas:** quedan «sin comprobar» al aplicar la 0559. Si el cliente volvió a entrar después, igual queda sin comprobar (la tarea lo pidió así).
4. **El enlace de comprobación vence a los 7 días** y hay uno vivo por cuenta.
5. **La ficha manda:** el correo por comprobar es el de la ficha; «Reenviar comprobación» lo vuelve a leer.
6. **El cliente no puede cambiar su correo desde el portal** (no existe ese camino hoy). «Si el cliente corrige su correo» se cumple por el único camino que hay: el equipo en la ficha. El trigger cubre además cualquier otro camino que escriba `clients.email`.
7. **Textos aprobados que NO cambié:** «Marcar comprobado» y «Comprobado» de la tarjeta. Sí cambié el correo (ahora lleva el enlace) y sumé una línea al mensaje final del registro y los textos de la página nueva.

## DECISIONES QUE NECESITAN A SAM

1. **Aviso dentro del portal** («Tu correo está sin comprobar» + «Reenviar») — propuesto, no hecho.
2. **Renombrar «Marcar comprobado» → «Marcar revisado»:** en la misma tarjeta ahora conviven «Comprobado» (el equipo revisó) y «Correo comprobado».
3. **Vaciar `pending_email` al confirmar** y sumar la tabla al plazo de purga pendiente de la 0552 (tabla de privacidad de la spec, «Borrado y retención»).
4. **Textos nuevos de cara al cliente** para su visto bueno: el correo «Comprueba tu correo», la página `/registro/correo/…` y la línea del mensaje final.

## VALIDACIÓN

Chequeos livianos, sobre el árbol del commit de código:

| Comprobación | Resultado |
|---|---|
| Contrato de la 0559 en PGlite (`correo-comprobado.migration.test.ts`): contrato, control rojo, desarme y 14 mutantes | PASÓ (17/17) |
| Contrato de la 0552 en PGlite (`registro-por-link.migration.test.ts`) | PASÓ |
| Vitest de los archivos tocados y vecinos (registro por link, enlace de comprobación, `/entrar`, invitación, utilidades e inventario, Studio, estado y corrida única, `rbac-actions-guard`, `spec-migration-refs`) | PASÓ, con vitest 4.1.7 (el `node_modules` del worktree es anterior a #650) |
| eslint sobre los archivos tocados | PASÓ |
| `pending-migration-symbols` | PASÓ: 0 rojo, 4 amarillo declarados (uno es el de la 0559) |
| `docs:check`, `sdd:check`, `git diff --check` | PASÓ |
| `/ui-check` | OK con ajustes menores: sin hallazgos de marca; se corrigió un sangrado; la ambigüedad «Comprobado» / «Correo comprobado» va a Sam |
| `pnpm install --frozen-lockfile` en este worktree | PASÓ (vitest 5.1.0, TypeScript 6.0.3; sin cambios en el árbol) |
| `pnpm typecheck` | PASÓ |
| `pnpm test` completo, build y e2e (`pnpm verify`) | NO EJECUTADO en la PC por decisión del DG: el portón es el CI de GitHub sobre la PR |
| Contrato SQL con psql y Docker (`sql-tests`) | NO DISPONIBLE: sin Docker; el mismo contrato corre en PGlite |
| Auth real (crear la cuenta y cambiarle el correo con una dirección `.invalid`) | NO EJECUTADO: Auth está doblado en todas las pruebas |
| Producción | NO TOCADA: ni lecturas ni escrituras |

### Corrida pesada

Turno del DG, acotado a instalar y `typecheck` (2026-11-17): los dos PASARON. Los archivos de prueba
tocados se corrieron antes de instalar, con vitest 4.1.7; con vitest 5.1.0 los corre el CI.

## PENDIENTES DE ESTA TAREA

1. **Probar contra un Auth real, en el entorno de prueba, antes de aplicar la 0559 en producción:** que acepte una dirección `@sin-comprobar.invalid` al crear la cuenta, al acuñar la entrada y al cambiarle el correo, y que el cambio de correo conserve la sesión. Si la rechazara, el registro por link cae en «acceso fallido» (falla seguro) y habría que proponer otro dominio.
2. **Orden de salida:** aplicar la 0559 (OK nominal de Sam) → publicar → corrida única (ensayo, después `--aplicar`, OK nominal de Sam). Hasta la corrida, las cuentas por link ya creadas siguen como antes de la enmienda, salvo que `/entrar` y la invitación ya no les mandan enlace.
3. **Smoke sugerido** (extiende el guion de la primera entrega): registrarse por link → entra directo; pedir enlace en `/entrar` con ese correo → pantalla de siempre y ningún correo; abrir el enlace de comprobación dos veces sin apretar el botón → sigue vivo; confirmar → `/entrar` ya manda el enlace; reusar el enlace → mensaje genérico; corregir el correo en la ficha → «sin comprobar»; acceso por WhatsApp de una cuenta sin comprobar → entra.
4. La revisión independiente la lanza el DG.

## FUERA DE ALCANCE DETECTADO

- **`node_modules` del worktree desactualizado** frente a #650 (vitest 4.1.7, TypeScript 5.9.3).
- **`scripts/buscar-voseo.mjs`** marca dos apariciones en `lib/studio/chatwoot/bot/conocimiento/reglas-duras.ts` (lista de palabras del bot). No es de esta tarea.
- **`/entrar` con dos filas de acceso para el mismo correo:** la búsqueda toma una sola (`limit(1)`). Ya era así. Con una cuenta por link de antes de la corrida única y otro cliente invitado al mismo correo, el bloqueo alcanza a los dos hasta la corrida.
- **Borrado lógico de clientes y copias de datos** (`prev_data`, `submitted_data`, ahora `pending_email`): sigue pendiente la decisión de plazo de la primera entrega.
- El detalle del hallazgo que motivó el diseño está en las notas compartidas del DG (fuera del repo), no aquí.

## IMPACTO DOCUMENTAL

- Actualizado: la spec de la SDD-0646 y este handoff. `infra/ops/portal-correo-comprobacion/README.md` es nuevo.
- No aplica: `docs/runbooks/setup-portal-auth.md` (no cambia la configuración de Auth).
- Propuesta, sin hacer: sumar el smoke del punto 3 al guion de smokes vigente cuando el DG lo integre.

## HANDOFF AL DIRECTOR

- md5 de la migración: se informa en el mensaje de cierre junto con la cabeza de la rama (el archivo no cambia después del commit).
- La PR se abre lista para revisión (no draft), base `main`.
