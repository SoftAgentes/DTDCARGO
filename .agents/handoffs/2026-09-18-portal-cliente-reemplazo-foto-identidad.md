# Handoff · SDD-0481 — el cliente cambia su foto de cédula/RIF desde el Portal

| Campo | Valor |
|---|---|
| Fecha | 2026-09-18 |
| Owner / sesión | Worker Claude · claim `claude-89300310` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\portal-cliente-editar-documento-identidad` |
| Rama / base | `codex/portal-cliente-editar-documento-identidad` desde `origin/main` `b43a39a5` |
| SDD | [0481](../../docs/specs/0481-portal-cliente-reemplazo-foto-identidad/spec.md) · `in-progress` (reserva local `efc16ccc`, rama `codex/sdd-reserve-0481-portal-cliente-reemplazo-foto-identidad`, sin publicar) |
| Migración | `0461_identity_photo_replacement_enable` (siguiente libre según `pnpm sdd:next`, 150 refs + worktrees) |
| Estado de tarea | lista-para-revision (PR #145 marcada lista; se integra después de aplicar 0461) |
| Permisos del encargo | `$WORKER` con el objetivo: commits locales. Después, Sam en el chat (2026-09-18): «publica la rama y abre la PR». **No** autoriza merge, deploy ni aplicar 0461. |

## Objetivo

Sam: *«el usuario tiene que poder editar la foto que subió de su cédula o de su
RIF. Están subiendo por error fotos que no son y ya no las pueden cambiar […]
hasta tres cambios».*

## Qué encontré

- El cupo de 3 cambios (0445), la primera foto gratis y la invalidación de la
  verificación (0446) **ya estaban en producción**. Lo que bloqueaba era 0447
  (gate de privacidad, aplicado y activo) más la UI, que con foto sólo mostraba «Ver».
- Lectura de catálogo en producción (sin filas de negocio): gate 0447 enganchado
  y `tgenabled = O`; `portal_set_identity_photo` con `md5(prosrc)`
  `057aea5c2260562e99c757533aad55a6`, **idéntico** al cuerpo 0446 del repo
  (medido en PGlite); EXECUTE sólo `authenticated`. El preflight de 0461 pasaría.

## Decisiones de Sam (2026-09-18)

Respuestas literales a AskUserQuestion en esta sesión, después de que
dtdcargo-18 frenara el merge directo:

- Orden: «Migración primero (Recomendado)». Es el OK nominal para
  `0461_identity_photo_replacement_enable`; la aplica dtdcargo-18 en su ventana,
  detrás de la 0460, y después integra la #145 en su turno de la cola.
- Foto anterior: «Conservarla (Recomendado)».

Antes de eso, Sam había pedido «márcala lista y haz el merge». La PR se marcó
como lista; el único intento de merge falló por usar un SHA corto en
`--match-head-commit` y no tuvo efecto. No se reintentó: dtdcargo-18 pidió
frenar porque el botón fallaría hasta aplicar 0461 y el merge rompería su cola
(#137 → #144 → #146).

## Retención elegida

La foto sustituida **se conserva** como versión (objeto en `client-docs`, ruta
sólo en el ledger sin grants), como diseñó 0445. Motivo: MP-01 (aprobada) §9
fija «no purgar; conservar» hasta la purga gobernada, §10 prohíbe hard-delete sin
P0 y MP-D6 pide versionar la evidencia que sustentó una decisión. El cupo acota
el inventario a 3 versiones por cliente.

Alternativa evaluada y **no** aplicada: borrar la anterior al confirmar el
reemplazo. Minimiza PII (la foto equivocada puede ser de un tercero), pero es
una excepción a MP-01. La implementé y probé (13 mutantes muertos) antes de
revertirla; el parche quedó fuera del repo, en el scratchpad de la sesión
(`variante-borrar-al-reemplazar.patch`). Sam eligió conservar: no se aplica.

## Completado

- `0461`: retira trigger y función de 0447; comenta `previous_storage_path`;
  preflight exige gate 0447 y cuerpo 0446; `set local lock_timeout 5s`.
- Contrato `supabase/tests/0461_…test.sql`: 10 contratos (catálogo/grants,
  primera gratis, 3 reemplazos y el 4.º rechazado, invalidación de verificación,
  versión en ledger, auditoría sin rutas, cupo compartido con solicitud
  pendiente, aislamiento entre clientes).
- `lib/portal/__tests__/identity-photo-replacement.migration.test.ts`: corre ese
  contrato en PGlite (CI lo cubre sin Docker) + control rojo sin 0461 + los dos
  preflights (sin 0446; aplicada dos veces).
- `supabase/migrations-baseline.json`: espera `0461` con orden, locks y smoke.
- Action: con foto existente consulta el cupo **antes de subir**; agotado o
  ilegible → mensaje y cero upload. Rechazo del gate (app antes que 0461) →
  retira sólo el objeto nuevo y avisa. No borra la anterior.
- UI: «Cambiar foto» con confirmación de 2 pasos (costo en cambios, el asesor
  revisa la nueva), singular/plural, sin cupo o cupo ilegible → soporte;
  primera carga sin confirmación. `/ui-check`: éxito pasó de `status-success`
  (4,33:1, bajo AA) a `grey-700`; `aria-controls` sólo con panel montado.
- Docs: spec 0481, nota en SDD-0439 punto 4, directiva de fotos, mapa de
  borrado y registro de tratamiento.

## Validación (worktree, HEAD `05ac636d` salvo indicación)

| Comprobación | Resultado |
|---|---|
| Vitest `app/portal/(app)/perfil` + `lib/portal/__tests__` | PASÓ 836/836 (antes del ajuste ui-check); tras el ajuste `perfil` 78/78 |
| Contrato SQL 0461 en PGlite (Vitest) | PASÓ 4/4, con control rojo que FALLA sin 0461 |
| Contratos 0445, 0446 y 0447 en PGlite | PASÓ (sin regresión histórica) |
| Mutantes (9, variante conservar) | 0 sobrevivientes; control verde previo con el mismo comando |
| `pnpm typecheck` · ESLint focal | PASÓ |
| `docs:check` · `sdd:check` · pending-migration-symbols · rsc-boundary · feature-constants · `components:check` · `governance:check` | PASÓ |
| `sql-tests` con Docker | NO DISPONIBLE: «Docker Desktop is unable to start». Cubierto por PGlite arriba. |
| `pnpm verify` sobre `05ac636d` | exit 1 · 14 de 17 pasos medidos. PASÓ: harness (178/178), lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols, build y e2e (152 pasaron, 1 intermitente ajeno en `calculadora-semantic-colors.spec.ts:58`, 15 casos omitidos sin Supabase público). FALLÓ: test, 7806/7808 en el reintento, con un único rojo en `app/p/[token]/PackingListProductsStep.test.tsx` (timeout de 20 s con la CPU al 100 % y 38 procesos node de otras sesiones). NO DISPONIBLE: sql-tests y schema-rebuild («Docker Desktop is unable to start»), migrations-applied (worktree sin credenciales, a propósito). |
| Reproducción aislada del rojo de `test` | PASÓ 41/41 sobre `05ac636d`: `PackingListProductsStep`, `supplier-flow` y `ClientDrawer.confirm-delete` (los tres rojos del primer intento). Ninguno de esos archivos está en el diff de la rama. |
| Merge de `origin/main` `a48d304f` → `502ea1b2` | Limpio. Sólo trae infraestructura e2e/verify (SDD-0479), handoffs y specs 0357/0358/0470/0479. Tras el merge PASÓ: docs:check (466 specs), sdd:check, pending-migration-symbols, typecheck y Vitest focal 85/85 (perfil + migración PGlite + cupo). |
| Prueba visual en navegador | NO EJECUTADO: el Portal exige sesión y Supabase; no hay entorno con credenciales en el worktree. Queda para el smoke post-release. |
| Preflight contra catálogo de producción | PASÓ (sólo metadatos; ver arriba) |
| Aplicación de 0461 (dtdcargo-18) | PASÓ: aplicada el 2026-09-18 por dtdcargo-18 con OK nominal de Sam: ledger `20260918174236` · `0461_identity_photo_replacement_enable`, 1 sentencia, md5 `1ff8d84a5e1b3c24c235ce53b9ece1f4` y 4893 bytes idénticos al blob `2c1fab83`. Postflight: 0447 retirada, RPC con el mismo md5 y EXECUTE sólo `authenticated`, ledger sin grants, comentario `SDD-0481:`, mismo número de filas; advisors con la misma huella. Verificado también por esta sesión leyendo ledger y catálogo. |
| Merge de `origin/main` `1d80c18a` (turno en la cola de dtdcargo-18) | Con el driver de main; `docs:index` regenerado sin diferencias. Espera 0461 retirada del baseline; quedan 0422 y 0423. La cabecera del `.sql` no se tocó (identidad md5 contra el ledger). |

## Commits

- `efc16ccc` reserva SDD-0481.
- `2a0362fc` migración 0461, contrato SQL, prueba PGlite y espera en baseline.
- `e8761954` action + UI + pruebas del Portal.
- `05ac636d` spec, nota 0439 y documentos de privacidad.
- Commit que contiene este documento: handoff.

## PR / branch

Rama `codex/portal-cliente-editar-documento-identidad` publicada con
`git push -u origin <rama>:<rama>`; PR https://github.com/hailuwaycom-sketch/DTDCARGO/pull/145
contra `main`. Se abrió en draft porque sql-tests y schema-rebuild no se midieron con
Docker (el contrato nuevo sí corrió en PGlite) y falta la prueba visual. Por orden de Sam
se marcó lista. El CI de `5f1359a7` quedó verde: «Calidad local sin secretos» en 17m27s,
más Vercel y Vercel Preview Comments.

## Pendientes de esta tarea

1. ✅ 0461 aplicada y verificada (ver Validación). Su espera salió del baseline
   en esta rama, por indicación de dtdcargo-18.
2. dtdcargo-18 integra la #145 en su turno de la cola (despliega a
   producción por Vercel).
3. Smoke con cuenta Portal autorizada: cambiar la foto, contador baja uno,
   verificación vuelve a pendiente en el Studio con la foto nueva.
4. SDD pasa a `done` sólo después de 2 y 3.

## Fuera de alcance detectado

- Purga a 30 días con hold de versiones sustituidas y gate regional VE/CN de
  `client-docs` (controles 1, 2, 4 y 5 de la directiva). SDD propio.
- La policy de Storage de 0091 deja leer `client-docs` a cualquier miembro del
  tenant (preexistente).
- `docs/legal/privacidad/README.md:16` todavía dice «0447 pendiente de
  autorización/aplicación Cloud»; 0447 ya está aplicada.
- La ref de reserva `codex/sdd-reserve-0481-portal-cliente-reemplazo-foto-identidad` sigue sólo local; la spec 0481 viaja en esta rama/PR. Director decide si publica o descarta la ref.

## Conocimiento

- Impacto documental: spec 0481 nueva; 0439, directiva de fotos, mapa de borrado
  y registro de tratamiento actualizados en esta rama. Ninguna fuente del
  piloto semántico (16) cambió.
- `pnpm knowledge:status` (05ac636d): structural INVALID (worktree nuevo sin
  `graphify-out/graph.json`), semántica 0/1093 verificada en este árbol, Archify
  PENDING (`ARCHIFY_RUNTIME_MISSING`), Obsidian en revisión `30a9f890`.
  `graphify update .` se lanzó en el worktree antes de publicar; su resultado no
  forma parte de esta rama (`graphify-out/` es derivado ignorado). Archify no se
  construyó: falta su runtime 2.16.0 en `graphify-out/archify-package`.
  Pendientes para el Director tras integrar: estructura Graphify, Archify y
  `knowledge:publish` desde main comprobado. Sin recibo semántico: ninguna
  fuente del piloto cambió.
- Propuesta (no regla): recomiendo guardar en `docs/runbooks/codex-engineering.md`
  que un contrato `.test.sql` se puede correr en PGlite inlineando `\ir`, porque
  deja CI y máquinas sin Docker con evidencia real de la migración. Evidencia:
  `lib/portal/__tests__/identity-photo-replacement.migration.test.ts`. Estado:
  propuesto. Siguiente acción: Director decide.

## Handoff al Director

Revisar la decisión de retención con Sam antes del merge (conservar vs. excepción
de borrado). El orden entre merge y 0461 es indistinto. No hay contratos
compartidos nuevos: la RPC y el ledger no cambian. `main` avanzó a `507c62d0`
durante la tarea y se trajo con merge (`502ea1b2`, base `a48d304f`); sin
conflictos. Ownership: claim `claude-89300310` liberado al cerrar esta sesión
de escritura; worktree y rama se conservan.
