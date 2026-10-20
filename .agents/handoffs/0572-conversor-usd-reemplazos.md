# Handoff · SDD-0572 · Los 13 conversores a USD pasan a uno solo, que falla cerrado (0572-a)

| Campo | Valor |
|---|---|
| Fecha | 2026-10-20 |
| Task ID / owner | `0572-a-cierre-20261020` / `codex-0572-01a15a4e-ddf0`, subagente Worker del Director Codex |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0572-conversor-usd-reemplazos` |
| Rama | `codex/sdd-0572-conversor-usd-reemplazos`, apilada sobre la #301 (`3d0c9028`, mezclada en `9c864da5`) |
| SDD | [0572](../../docs/specs/0572-conversor-usd-reemplazos/spec.md), diseño aprobado por el Director el 2026-10-20 |
| Estado | 0572-a implementada (reglas A a F); cierre parcial, pendiente de corregir y recibir la dependencia #301. HEAD recibido `4f24a1db09704b1d34cd6073589c95dc84c22ccd`, ya publicado en la rama remota, árbol limpio al adoptar |
| Permisos | Adopción autorizada por Sam al pausar Claude y continuar en los mismos worktrees. Director concedió turno exclusivo para typecheck, eslint, `pnpm verify` y mutantes en serie, además de commits selectivos y push a esta misma rama. PR únicamente después de confirmación del Director de que #301 entró en main. **Sin merge, deploy, migraciones, datos de negocio ni 0572-b.** |

## Adopción del 2026-10-20

- Se adopta expresamente la metodología vigente AGENTS → Worker → runbook, preservando la implementación recibida y sus pruebas.
- Director liberó el claim previo `contabilidad-2026-10-18`; el nuevo Worker adquirió `codex-0572-01a15a4e-ddf0` y validó `guard --owner`.
- Rama y raíz verificadas antes de escribir. `node_modules` es un directorio local, sin junction; no se copiaron secretos.
- No había procesos pesados activos al iniciar. Las comprobaciones se ejecutan una tras otra con el turno asignado.
- Se conserva la decisión delegada del Director: las facturas locales sin tasa también bloquean la rendición porque restan de su saldo. El aviso debe explicar qué falta.
- Los resultados anteriores del Worker «Contabilidad» se preservan como evidencia histórica; las comprobaciones de este cierre se registran por separado.
- Director autorizó ampliar la allowlist únicamente con el índice generado `docs/specs/README.md` y los fixtures consumidores `TesoreriaClient.cxp-saldada.test.tsx` y `reports/__tests__/export-csv.test.ts`.
- Durante la revisión de #301, Director detectó una confusión entre `source=manual` de la tabla de tasas y el override manual del documento. Ordenó terminar reparaciones, typecheck, lint y pruebas focales, publicar este avance y liberar el turno. `verify` y mutantes todavía no habían comenzado: se difieren hasta recibir la dependencia corregida.

## OBJETIVO ORIGINAL

La 2.1 del plan contable, segunda parte: reemplazar las 13 implementaciones de conversión a USD y las tasas fijas del código por el conversor canónico de la 0569, fallando cerrado.

## COMPLETADO

- Reglas A a F, según la tabla *Implementación* de la spec.
- La regla G se difiere a la 2.3. El asiento de venta sigue al nominal (B2); convertir solo el subdiario de clientes abriría una diferencia falsa.
- Las pruebas que fijaban lo de antes se reescribieron. Hay pruebas nuevas para los asientos sin tasa, gastos y pagos, y la previa de la rendición.
- Cierre Codex: se restauraron las implementaciones de `formatDate`, `formatNumber` y `formatCurrency` que se habían eliminado accidentalmente junto al conversor duplicado. Frente a la base, `format.ts` solo elimina ese conversor.
- Se completaron fixtures con los nuevos contadores obligatorios, sin hacerlos opcionales ni debilitar aserciones.
- Se agregaron tres casos de mezcla de monedas/redondeo y dos de bloqueo por factura local sin tasa (servidor y drawer).
- Se retiró el import de tipo `ExpenseCurrency` que quedó sin uso después de eliminar el conversor de gastos.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Pruebas puntuales heredadas, un archivo a la vez (`node node_modules/vitest/vitest.mjs run <archivo>`) | PASÓ según el handoff recibido en 31 archivos (detalle abajo); no se repitieron todos en este cierre parcial |
| Pruebas focales Codex | PASÓ: 6 archivos, 71 pruebas; gastos/pagos 10, emit/void 10, costing/ui 17, EmitDrawer 3, TesoreriaClient 9 y export-csv 22 |
| `corepack pnpm typecheck` inicial | FALLÓ: tres formateadores eliminados y fixtures sin los nuevos contadores; defectos propios reparados |
| `corepack pnpm typecheck` después de la reparación | PASÓ: exit 0, después de restaurar formatos y completar los fixtures |
| eslint sobre los archivos TS/TSX del diff | PASÓ: 52 archivos, cero errores y una advertencia propia; se retiró el import de tipo sin uso y el lint puntual posterior PASÓ sin advertencias |
| `docs:check` | PASÓ: 557 specs, índice sincronizado |
| Allowlist / `git diff --check` | PASÓ: 55 rutas contra la base `3d0c9028`, todas autorizadas, sin errores de whitespace |
| `knowledge:status --preview` (entrada Node directa) | PASÓ la inspección, exit 0; Graphify 0.9.61 estructural INVALID por grafo ausente/vacío, semántica 0/16 piloto y 0/1323 global, Archify PENDING por runtime ausente y Obsidian PENDING. No equivale a publicación ni a cobertura aprobada |
| `pnpm verify` / build / E2E | NO EJECUTADO en este cierre por instrucción del Director: esperar la dependencia #301 corregida |
| Mutantes de app | NO EJECUTADO por la misma instrucción; pendientes los cinco `missing-fx-rate`, `emitRenditionFor` (cobros y factura local), CNY del validador y `resolveDisplayRate` |

Alcance de esta ronda: base `3d0c9028`, implementación recibida `4f24a1db` más el commit que contiene este documento. Las correcciones no cambian la procedencia de las tasas de #301. Logs locales, fuera de Git: `C:\tmp\director-traspaso-20261020\0572-codex-validation\`. No se usaron variables de Supabase ni `.env.local`, ni datos de negocio.

Recibos: `targeted-corrections.log` (71/71), `typecheck.log` (fallo inicial), `typecheck-corrected.log` (PASÓ), `eslint-diff-direct.log` (52 archivos), `eslint-final-import.log` (PASÓ), `knowledge-status.log` (capas pendientes). El primer intento de eslint con `corepack pnpm exec` no llegó a ejecutarlo: el wrapper `.cmd` de Windows no preservó las rutas con `(app)`; se usó la entrada Node directa. La única edición de fuente posterior al typecheck fue retirar un import de tipo sin uso; no cambió lógica ni contratos. Estas comprobaciones no tuvieron SKIPs; el gate canónico todavía no se ejecutó.

### Evidencia histórica del Worker anterior

Pruebas puntuales que pasaron:

- **Conversión y cobros:** `payment` 46, `treasury` 57, `partner-finance/types` 54, `alerts` 7, `fidelizacion/types` 38.
- **Costing:** `costing/queries` 18, `costing/ui` 17, `costing/types` 28.
- **Reportes:** `reports/types` 45, `reports/queries` 28.
- **Ingreso del período y libro de control:** `ingreso-periodo` 38, `libro-control` 42, `libro-control-queries` 34.
- **Dashboard y Dirección:** `dashboard-kpi-queries` 8, `direccion/queries` 39.
- **Pantallas:** `reportes-tab` 9, `estado-gerencial-mezclado` 2, `pantallas-muestran-la-denegacion` 9, `TesoreriaClient.cxp-saldada` 9.
- **Cobros sin identificar y cobranza:** `payment-receipts-0068` 31, `collections-identify` 22, `recordatorios` 19.
- **Exportación:** `operativo-csv` 15.
- **Rendiciones:** `renditions` 35, `emit-void` 9.
- **CxP y pagos a proveedores:** `cxp-congela-la-tasa` 4, `treasury-payments` 11.
- **Nuevas:** `asiento-sin-tasa` 5, `gastos-y-pagos-en-usd-0572` 7, `EmitDrawer.sin-tasa` 2.

## Impacto documental y conocimiento

- La spec 0572 trae la implementación, la allowlist y lo que queda abierto.
- No cambia reglas de AGENTS.
- El cambio de comportamiento visible para Sam está en *Qué cambia para Sam, pantalla por pantalla*.
- Índice regenerado con la spec en `in-progress`; 0572-b y G permanecen diferidas.
- Graphify 0.9.61 estructural: `knowledge:status --preview` informa INVALID porque no existe `graphify-out/graph.json` en este worktree. Actualización y recibo pendientes del cierre posterior a la corrección de #301.
- Semántica: ninguno de los documentos modificados pertenece al piloto canónico de 16 fuentes. La inspección informa 0/16 piloto y 0/1323 global (1307 pendientes fuera del piloto); no se afirma cobertura semántica nueva ni global.
- Archify 2.16.0: construcción y `knowledge:visual:check` NO EJECUTADOS en esta entrega parcial; no hay JSON/evidencia visual local generados.
- Obsidian: preview y revisión visible NO EJECUTADAS; publicación compartida NO EJECUTADA, reservada al Director desde main integrado comprobado.
- Revisión `/ui-check` de código: usa componentes y tokens existentes; los avisos y el bloqueo son explícitos. Observaciones advisory para la retoma: el nuevo aviso de Rendiciones usa cuerpo rojo (`EmitDrawer.tsx`, aviso `rendicion-sin-tasa`) y el aviso operativo de Reportes usa `padding: "7px 12px"` fuera de la escala de 4 px. Revisar texto neutro con estado localizado y tokens de espaciado. Revisión visual con navegador, contraste medido, móvil y zoom NO EJECUTADOS. La revisión visual no se infiere de las pruebas de componentes.

## PENDIENTES DE ESTA TAREA

1. Recibir la corrección de #301 y volver a comprobar el contrato de procedencia de las tasas. No abrir PR hasta confirmación del Director de su integración.
2. Ejecutar `pnpm verify`, sus comprobaciones aplicables y los mutantes con un nuevo turno de máquina; conservar los SKIPs explícitos.
3. Comprobar un hallazgo preliminar de esta revisión: `topAndWorst` de Costing todavía filtra solo `revenue > 0`. Una fila con revenue parcial y `facturasSinTasa > 0` podría aparecer entre los mejores/peores del Overview aunque el Ranking ya la rotule «Sin tasa». Hace falta fixture antes de certificar la regla A.
4. Completar revisión visual local con fixtures de Costing, Rendiciones, Reportes, Dirección y Financiero China.
5. Completar las capas locales de Graphify, Archify y preview de Obsidian con sus estados separados.

## FUERA DE ALCANCE DETECTADO (para el Director)

- **Cobro aplicado a una factura sin tasa:** hereda la tasa de la factura (RPC 0467). Sin tasa, queda sin asiento, en «Por contabilizar». La pantalla de «asentar pendientes» es de la 2.2.
- **«Gastos hoy» usa la hora del servidor** (`expense-queries.ts`, `setHours(0, 0, 0, 0)`), no la de Caracas. Va en la SDD de la hora de Caracas.
- **Las sumas multimoneda con «$» sin convertir** van en la SDD de KPIs multimoneda (decisión 5).
- **0572-b:** SQL de 0404 y 0411 diferido a otro encargo, con número del Director y autorización nominal de Sam. No es un cambio pendiente que este Worker deba implementar.

## COMMITS

- `4f24a1db09704b1d34cd6073589c95dc84c22ccd`: implementación recibida, ya publicada al adoptar.
- Commit que contiene este documento: reparaciones de formatos y fixtures, cinco pruebas adicionales y handoff de cierre parcial.

## PR / BRANCH

- Rama: `codex/sdd-0572-conversor-usd-reemplazos`, publicada a sí misma.
- No se abre PR en esta entrega: espera #301 corregida e integrada por el Director.
- Worktree conservado; no merge, deploy ni migraciones.

## HANDOFF AL DIRECTOR

- Retomar después de la corrección de #301 con el SHA de esta entrega y un nuevo turno exclusivo de verificación.
- La publicación del avance no certifica aceptación completa ni preparación para merge.
- El protocolo de esta entrega termina con la liberación de `codex-0572-01a15a4e-ddf0` después de confirmar el push; el informe al Director conserva el recibo efectivo. No se deja ningún proceso de verificación a cargo de otra sesión ni se elimina el worktree.
