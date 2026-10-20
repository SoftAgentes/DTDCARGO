# Handoff · SDD-0575 · Decisiones de diseño de asientos sin fallos silenciosos

Fecha: 2026-10-20. Estado de esta subtarea documental: lista para revisión. La SDD permanece en `draft`.

## Adopción y ownership

- Owner: `codex-0575-decisiones-01a15a4e`, subagente documental del Director Codex.
- Worktree: `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0575-asientos-sin-fallos-silenciosos`.
- Rama: `codex/sdd-0575-asientos-sin-fallos-silenciosos`.
- HEAD recibido: `3f5b7bdc88794ea1d1cff3d001cdc0224cb78fda`.
- Se adopta explícitamente AGENTS y el procedimiento Director/Worker vigente al retomar este trabajo preexistente. Se conservan rama, worktree y commit de diseño, sin trasladar ni reemplazar cambios.
- El Director informó que las sesiones Claude están pausadas por mandato actual de Sam y comprobó disponibilidad del árbol. Esta sesión repitió raíz, rama, HEAD y estado limpio, comprobó `guard` y adquirió el claim antes de editar. La ausencia de claim no se usó por sí sola como prueba de disponibilidad.
- Fuente de autorización: asignación documental del Director del 2026-10-20 bajo la delegación actual de Sam. Autoriza decisiones documentadas, comprobaciones ligeras, commit selectivo y push a esta misma rama; no autoriza producto, nuevas PR, merge, producción ni actualización global de conocimiento.

## OBJETIVO ORIGINAL

Registrar las cinco decisiones delegadas de la SDD-0575, reconciliar el diseño y corregir la clasificación de los casos de la radiografía del 18 de octubre, preservando los pendientes previos a implementar.

Allowlist exacta de esta subtarea:

- `docs/specs/0575-asientos-sin-fallos-silenciosos/spec.md`.
- `docs/specs/README.md`, únicamente mediante su generador.
- `.agents/handoffs/0575-asientos-sin-fallos-silenciosos.md`.

## COMPLETADO

- Decisiones registradas: RPC atómica por documento que falle cerrado; período cerrado bloquea salvo excepción gobernada por la 0566; sección dentro de «Por contabilizar»; tres PR secuenciales; gasto incluido desde el contrato de la RPC en la 0575-a.
- Se mantiene pendiente el número de migración hasta el inventario y la reserva del Director.
- Se mantienen pendientes los contratos verificables y la allowlist exacta por cada PR antes de implementar. El registro no declara aprobada ni terminada la implementación.
- Corregida la clasificación: los casos de la radiografía del 2026-10-18 son datos de prueba. Se contrastó el §9 de `docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md` en `origin/main` `8e9e0f505322cd57b3230cce6b16b45b5554cb8a`, sin modificar ese documento. Su reparación o borrado conserva autorización propia.
- Requisito de diseño identificado: el motivo de un fallo debe permanecer consultable sin dejar cabeceras, líneas o vínculos parciales. Un rollback total que abarque el registro del intento también lo borraría. El mecanismo queda pendiente de contrato y prueba; esta subtarea no lo implementa.

## VALIDACIÓN

Sobre el diff documental respecto del HEAD recibido:

| Comprobación | Resultado |
|---|---|
| Raíz, rama, HEAD, árbol inicial limpio y `node scripts/harness-worktree.mjs guard` | PASÓ |
| `node scripts/harness-worktree.mjs claim --owner codex-0575-decisiones-01a15a4e` | PASÓ |
| Regeneración del índice mediante `node scripts/build-docs-index.mjs` | PASÓ: 556 specs y 19 huecos; el índice generado no cambió |
| `git diff --check` | PASÓ |
| `node scripts/build-docs-index.mjs --check` (`docs:check`) | PASÓ: índice sincronizado con 556 specs |
| `node scripts/check-numbering.mjs` (`sdd:check` / numbering) | PASÓ: 556 specs y 488 migraciones; conserva 11 excepciones históricas del gate, sin nuevos números repetidos |
| Pruebas de producto, SQL, e2e, build y `verify` | NO EJECUTADO: el diff solo documenta decisiones; la SDD-0572 conserva el turno de máquina |
| Producción y radiografía nueva | NO EJECUTADO: fuera de autorización |

## COMMITS

El commit que contiene este documento registra el cierre documental. El Director recibe su SHA final y la comprobación remota en el handoff de la conversación, sin crear commits recursivos para insertar el propio hash.

## PR / BRANCH

- Rama propia conservada: `codex/sdd-0575-asientos-sin-fallos-silenciosos`.
- Push autorizado únicamente a esa misma rama remota.
- No se abre PR en esta subtarea. La revisión e integración corresponden al Director.

## PENDIENTES DE ESTA TAREA

- El contenido y las comprobaciones documentales están completos. El SHA final, el respaldo remoto y la liberación del claim se confirman al Director tras ejecutar el cierre, sin autorizar pasos adicionales.

Pendientes de la futura implementación de la SDD:

- Número de migración inventariado y reservado por el Director.
- Contratos y allowlists exactas de 0575-a, 0575-b y 0575-c.
- Resolver y probar la persistencia del motivo frente al rollback.
- Revalidar SHA y contratos de las dependencias 0557, 0559, 0566, 0572 y 0573.
- Encargos de implementación y permisos específicos de integración/producción.

## FUERA DE ALCANCE DETECTADO

- Las referencias técnicas heredadas del diseño no se reauditan contra producto en esta subtarea; deberán revalidarse sobre la base de cada PR.
- No se examinan, reparan ni borran datos existentes. La condición de datos de prueba no autoriza su modificación.

## HANDOFF AL DIRECTOR

Revisar las decisiones documentadas y cerrar número, contratos y allowlists antes de asignar implementación. El orden registrado es 0575-a → 0575-b → 0575-c. La escritura termina con el commit y push autorizados; después se libera el claim de esta sesión y se conserva el worktree. El resultado de numbering es local y no acredita el estado de aplicación de migraciones en producción.

Impacto documental: fuente canónica actualizada en la SDD-0575 y este handoff; índice regenerado según la comprobación anterior. Integración en main pendiente. Graphify estructural, cobertura semántica, Archify, exportación compartida y revisión visible en Obsidian: **NO EJECUTADO**, fuera de esta subtarea documental y del turno de máquina; quedan separados del guardado de estas decisiones.
