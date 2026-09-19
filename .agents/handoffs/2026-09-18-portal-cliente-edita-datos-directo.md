# Handoff · SDD-0482 — el cliente edita nombre, cédula/RIF y teléfono al instante

| Campo | Valor |
|---|---|
| Fecha | 2026-09-18 · retomada el 2026-09-19 |
| Owner / sesión | Worker Claude `dtdcargo-74` · claim `claude-dtdcargo74-0482`. Hasta el 2026-09-18 era `dtdcargo-63` con el claim `claude-89300310-0482`. |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\portal-cliente-edita-datos-directo` |
| Rama / base | `codex/portal-cliente-edita-datos-directo`, desde `origin/main` `cc15e48c` + cherry-pick de la reserva `2c937d4f`. Merge de `origin/main` `3f810366` en `43c1f627`. |
| SDD | [0482](../../docs/specs/0482-portal-cliente-edita-numero-identidad/spec.md) · `in-progress` |
| Migración | `0462_portal_profile_direct_edit` (asignada por dtdcargo-18) |
| Estado de tarea | Lista para la PR. Rama publicada. |
| Permisos | Sam autorizó publicar la rama y abrir la PR contra `main` (2026-09-19). **No** merge, deploy ni aplicar 0462. |

## Traspaso (2026-09-19)

- Sam autorizó liberar el claim de `dtdcargo-63` y reclamarlo, con evidencia de que esa sesión ya no existe.
- Evidencia:
  - ListAgents no muestra `dtdcargo-63`;
  - el único proceso con la ruta del worktree era el de esta sesión.
- Pasos: `release --owner claude-89300310-0482`, luego `claim --owner claude-dtdcargo74-0482`, y guard OK.
- Push de respaldo de `dfa39828`, tal cual y sin PR.
- Por pedido de dtdcargo-18, merge de `origin/main` `3f810366`:
  - con el driver de main;
  - sin conflictos;
  - `docs:index` regenerado, con el árbol limpio.
- dtdcargo-18 revisó la 0462 y pidió corregir los locks: la cabecera decía «sólo DDL» y no era exacto. Se midió y se corrigió en la cabecera, en la espera del baseline y en la spec.

## Objetivo y decisiones de Sam (literales)

Sam quiere que el cliente edite sus datos sin aprobación. Estas fueron sus respuestas en AskUserQuestion, el 2026-09-18:
- número de documento: «Editar directo, sin aprobación»;
- verificación: «No, se mantiene verificado»;
- duplicado: «Bloquear y avisar al asesor (Recomendado)»;
- nombre y teléfono: «También directos».

Todo va dentro del cupo compartido de 3 cambios. En la primera respuesta descartó el aviso al asesor por cada cambio, así que el asesor sólo se entera de los bloqueos.

## Completado

- **Migración `0462`:**
  - `client_profile_blocked_attempts`, sin el valor intentado.
  - `portal_update_my_profile`: resuelve el cliente por sesión, bloquea la ficha y aplica sólo lo que cambió, sin contar el formato. Cobra el cupo con el trigger de 0445, reemplaza la solicitud pendiente propia y no toca la verificación.
  - Bloquea el documento o el teléfono de otro cliente sin gastar cupo. Límite: 5 bloqueos en 24 h, que frena también los valores libres.
  - Atrapa la carrera con el índice único.
  - Deja la espera declarada en el baseline.
- **Portal:**
  - `updateMyProfileAction` reemplaza a `submitDataChangeRequestAction`: normaliza el documento a su forma canónica según el tipo de cliente y el teléfono a 58 + 10 dígitos, traduce cada resultado y avisa al asesor cuando hay bloqueo.
  - `DataChangeEditor` edita directo con confirmación de 2 pasos. Conserva lo escrito ante un error y ofrece «Editar ahora» cuando hay una solicitud vieja pendiente.
- **Studio:** el historial muestra «Editado por el cliente» (fila aprobada sin revisor).
- **Libro de Ventas:** usa `invoices.client_rif` congelado; antes leía `clients.rif` en vivo.
- **Aviso al asesor:** `notifyBlockedProfileEditToAdmin` manda los Shipping Marks de las dos fichas, nunca el valor intentado.
- **Docs:**
  - spec 0482;
  - SDD-0481 cerrada en `done` tras el smoke de Sam;
  - corrección de los textos de 0446 y 0447, en commit aparte;
  - registro de tratamiento.

## Validación (worktree)

| Comprobación | Resultado |
|---|---|
| Contrato SQL 0462 en PGlite: cadena 0445 → 0462, control rojo, preflight y 7 mutantes SQL | PASÓ 10/10 |
| Libro de Ventas (fiscal + reports) | PASÓ 234/234; control rojo verificado |
| Vitest de perfil, `lib/portal`, clientes del Studio y aviso | PASÓ 946/946 (66 archivos) |
| Mutantes TypeScript (action, UI, validación, historial, aviso) | 10/10 muertos, con control verde previo |
| `pnpm typecheck` | PASÓ |
| ESLint focal | PASÓ (0 errores; se corrigió 1 advertencia en una prueba) |
| Gates: docs, sdd, rsc-boundary, feature-constants, components, governance | PASÓ |
| `pending-migration-symbols` | PASÓ: 0 rojos y 1 amarillo declarado (`sdd-0482-portal-edicion-directa`) para `portal_update_my_profile` y `client_profile_blocked_attempts`. Sin 0462 la action no anuncia éxito ni escribe nada. |
| `docs:check` | PASÓ |
| `pnpm verify` sobre `43c1f627` (2026-09-19, turno de dtdcargo-18) | Exit 1. PASÓ: harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols, sql-tests (201 en postgres:17), schema-rebuild, e2e (167 pasaron, 18 omitidas, 1 intermitente: `attachments-gastos-pilot` en chromium, verde en el reintento) y build. FALLÓ `test` en sus dos pasadas, siempre por tiempo agotado: la 1ª en `PackingListProductsStep` (20 s) e `invoice-read-boundary` (60 s); el reintento en `PackingListProductsStep` y `ClientDrawer.confirm-delete`. NO EJECUTADO: `migrations-applied` (SKIP, el worktree no tiene credenciales). |
| Las tres de `test`, aisladas con `--pool=threads` y la CPU al 34 % | PASÓ: 9/9, 3/3 y 9/9 |
| Focales tras el merge de main (`--pool=threads`, CPU al 100 %) | PASÓ: 70 archivos y 1053 tests |
| Locks de 0462 medidos (2026-09-19) | PostgreSQL 17 en Docker, con el preludio del contrato: `SHARE ROW EXCLUSIVE` sobre `tenants`, `clients` y `auth.users`. El DDL tarda 14 ms. Una lectura de `clients` no espera (1 ms) y un UPDATE espera hasta el COMMIT. Con otra escritura abierta, la migración espera 5,0 s, aborta y no deja nada creado. En PGlite: 42,7 ms y el mismo conjunto de locks. |
| Tras corregir la cabecera y el baseline | PASÓ: contrato PGlite de 0462 (10/10), `docs:check` y pending-migration-symbols |
| sql-tests con Docker | PASÓ dentro de verify. Docker volvió a arrancar el 2026-09-19. |
| Prueba visual | NO EJECUTADO: requiere sesión Portal y la 0462 aplicada |

## Commits

- `99f0c86c`: reserva (cherry-pick).
- `a37bb1dc`: cierre de SDD-0481.
- `d80b37a5`: spec 0482.
- `6d303116`: textos de 0446 y 0447.
- `a5ea2960`: migración 0462.
- `e05978fb`: Libro de Ventas.
- `fe5f390f`: Portal (action, editor, validación, aviso).
- `d84a5d0d`: historial del Studio.
- `dfa39828`: docs, declaración de símbolos y handoff (dtdcargo-63).
- `43c1f627`: merge de `origin/main` `3f810366`.
- Commit que contiene esta versión: locks de 0462 medidos y corregidos en la cabecera, el baseline y la spec, más este handoff (dtdcargo-74).

## Pendientes de esta tarea

1. ~~Avisar a dtdcargo-18 antes de publicar~~: hecho. Él fijó los turnos de merge de main y de verify (2026-09-19).
2. OK nominal de Sam para `0462_portal_profile_direct_edit`. Migrate-first: la aplica dtdcargo-18 antes de integrar.
3. Integración de la PR por dtdcargo-18.
4. Smoke de Sam:
   - cambiar el teléfono: se aplica al instante, baja el cupo y aparece la fila «Editado por el cliente» en el Studio;
   - intentar el documento de otro cliente de prueba: mensaje genérico, aviso al asesor y cupo intacto.
5. SDD 0482 a `done` sólo tras 2 a 4.

## Fuera de alcance detectado

- El historial ampliado con fotos anteriores e intentos bloqueados es SDD-0483.
- La RPC de 0128 (`sales_order_claim_and_invoice`) emite facturas sin congelar el documento; entra en SDD-0487.
- `persons.national_id` no se sincroniza con `clients.rif` (Academia).
- Riesgo de Kommo: un cliente sin `kommo_contact_id` podría adoptar el teléfono de un contacto de Kommo que no es cliente.
- Foto de perfil:
  - Vercel corta las subidas de más de 4,5 MB, aunque la UI promete 8 MB;
  - las fotos HEIC no se ven fuera de Safari;
  - hoy sólo se ve en `/portal/perfil`.
  - Va con SDD-0487, a pedido de Sam.

## Conocimiento

El impacto documental queda en la spec 0482, el registro de tratamiento y las notas de 0439 y 0481. Ninguna fuente del piloto semántico cambió. Graphify y Archify los actualiza el Director tras integrar.

## Handoff al Director

Orden acordado: 0482 → 0483 → 0487. Esta rama toca `perfil/actions.ts`, `DataChangeEditor`, `fiscal/queries.ts` y `change-request-notify.ts`, archivos que también tocará la 0487. Ownership: claim `claude-dtdcargo74-0482`, que libero al abrir la PR. La 0483 sólo tiene su reserva (`codex/sdd-reserve-0483-studio-historial-cambios-cliente`), sin worktree: la 0487 no espera por ella salvo que lo indiques.
