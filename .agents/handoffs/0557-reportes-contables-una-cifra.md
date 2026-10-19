# Handoff · SDD-0557 · Reportes contables sin migración: una cifra de ingreso, comprobación, diario completo y cuadre del libro

| Campo | Valor |
|---|---|
| Fecha | 2026-10-19; en Caracas, de 01:15 a 02:05 aprox. (UTC 05:15 a 06:05) |
| Task ID / owner | `contabilidad-2026-10-18` / Worker «Contabilidad»; esta pasada la escribió un subagente escritor de esa Worker |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0557-reportes-una-cifra` |
| Rama | `codex/sdd-0557-reportes-una-cifra`, desde `origin/main` `3f3a52cc` (merge de la #279) |
| SDD | [0557](../../docs/specs/0557-reportes-contables-una-cifra/spec.md), `in-progress`. La reserva entró por cherry-pick (`3030cd03`) |
| Estado | lista para revisión; sin push ni PR |
| Permisos | commits selectivos en la rama propia, sin push. No incluye producción ni base de datos. `pnpm verify` necesita turno del Director |

## OBJETIVO ORIGINAL

Tarea 1.4 del plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`, fase 1; B17 y anexo A, Reportes H02, H04 y H07), sin migración:

- una sola cifra de ingreso para Contabilidad, Dirección, Reportes y el Dashboard;
- balance de comprobación y diario completo en CSV;
- documentos sin asiento y cuadre del subdiario contra el mayor;
- «Cashflow» pasa a «Facturado contra cobrado».

Mandan las decisiones `decisiones-0557.md` (G1 a G14) sobre el plan `3-plan-0557.json`, y las definiciones canónicas de la SDD-0559 (E7).

## COMPLETADO

- **Una regla** (`lib/studio/accounting/ingreso-periodo.ts`, `resumirIngreso`): base sin IVA en USD, facturas `emitida | parcial | pagada | vencida` no borradas, por `issued_at` inclusive. VES sin tasa y CNY van a «sin convertir». `deleted_at` viaja en la fila y la regla lo vuelve a filtrar (G1). Desglose propio/terceros por `fund_class` (G1). El control del mayor es el saldo de **4.5**; el 4.6 y los manuales a 4.x son «otros ingresos del mayor», aparte (G2).
- **Los cuatro consumidores la usan**, con el mismo fixture y el mismo período (2025-03-01 → 2025-03-18, lejos de la fecha real, G11): `ingresoDelPeriodo` (Contabilidad › Reportes, Reportes › Estado de resultados y Dirección) y `financeInvoiceKpis` (Dashboard). Todos dan 2000 USD con 2 sin convertir. El «Ticket promedio» del Dashboard usa la misma base (G12).
- **Contabilidad › Reportes**: Desde/Hasta (G7, DAT-01: con fecha inválida, una sola fecha o rango al revés no calcula y muestra el error citando lo tecleado), tarjeta «Ingreso del período», P&L del período, balance general y **balance de comprobación al corte** (movimientos directos, sin duplicar el rollup) con CSV y el enlace «Diario hasta el corte (CSV)» **sin `desde`** (G6).
- **Libro diario**: totales reales con `countEntries`; «Mostrando N de M» y enlace al diario completo; exportación con Desde/Hasta que valida antes de enviar.
- **Ruta** `GET /api/studio/contabilidad/export?tipo=diario`: sesión, `moduleViewDenial(supabase, "accounting")` antes de leer, 400 con fechas inválidas, lectura completa paginada, CSV con BOM, CRLF, fórmulas neutralizadas por `rowsToCsv` y `private, no-store` (G4, G5). Entra a `GUARDED` del contrato RBAC.
- **Por contabilizar** (`?tab=subdiario`): subdiario contra mayor (clientes contra 1.1.2, con «no comparable» por B2 según E1 de la 0559; proveedores contra 2.1.1 con `billAmountUsd`, G8), documentos sin asiento con motivo y enlace, conteo de anulados con asiento vivo con enlace (G9), CSV.
- **Reportes**: preset «Este mes» (G10); tarjeta de ingreso en el Estado de resultados; la decisión de la vista en `vistaDelEstado` (G11), que también usa el CSV; «Facturado contra cobrado» con `?rep=cashflow` intacto; `TABS_BY_CATEGORY` exportado donde estaba (G12).
- **Dirección**: `finance.ingreso: IngresoPeriodo` (G12), «Utilidad neta · libro» con el margen sobre los ingresos del mayor, «Pídeles».

## VALIDACIÓN

Todo sobre este worktree, en la rama de la tarea.

| Comprobación | Alcance | Resultado |
|---|---|---|
| `corepack pnpm exec vitest run` sobre accounting, contabilidad, reportes, la ruta, reports, dashboard, dirección, fiscal, los dobles de listados, borrado y los contratos `rbac-api-guard`, `studio-api-auth-guard`, `invoice-read-boundary` y `spec-migration-refs` | 43 archivos | PASÓ: `Test Files  43 passed (43)`, `Tests  608 passed (608)`, exit 0 |
| Mutantes (`mutantes-0557.cjs` en el scratchpad; uno por vez, restaura en `finally`) | 43 mutantes del diff | los 43 MUERTOS, todos con exit 1 y la línea `Tests … failed` (tabla abajo). `git status` después: solo los cambios de la tarea |
| `corepack pnpm typecheck` | repo completo | PASÓ (exit 0; `[tipos-de-ruta] sanos — nada que podar`) |
| `eslint --max-warnings=0` | los 36 archivos `.ts/.tsx/.mjs` tocados | PASÓ (exit 0, sin salida) |
| `node scripts/check-rsc-boundary.mjs` | app, lib | PASÓ: `sin cruces server→client de valores ni client→node: transitivos` |
| `corepack pnpm docs:check` | índice | PASÓ: `índice sincronizado con 544 specs` |
| `corepack pnpm sdd:check` | numeración | PASÓ: `numbering: sin números repetidos` (avisa los choques históricos conocidos) |
| `corepack pnpm governance:check` | cápsula | PASÓ: `28 política(s) aprobada(s) · cápsula vigente` |
| `corepack pnpm components:check` | registro CMP | PASÓ: `CMP-01 válido: 5 fuente(s)` |
| `git diff --check 3f3a52cc HEAD` | diff | PASÓ |
| `git grep -n "monthRevenue +=" -- lib app` | criterio 1 | sin resultados (exit 1) |
| `/ui-check` | ver abajo | OK con ajustes menores, aplicados |
| Comprobación en el navegador | — | NO EJECUTADA: el worktree no tiene `.env.local` (a propósito) y las pantallas necesitan sesión y base. Las pruebas montan los componentes en jsdom |
| `pnpm verify` | — | NO EJECUTADO: necesita turno del Director |

### Mutantes

| # | Regresión | Pruebas | Resultado |
|---|---|---|---|
| M01 | la regla suma `total_amount` (con IVA) | ingreso-periodo | MUERTO · `Tests  8 failed \| 14 passed (22)` |
| M02 | la fecha es `created_at` | ingreso-periodo | MUERTO · `6 failed` |
| M03 | sin filtro de estado en memoria | ingreso-periodo | MUERTO · `6 failed` |
| M04 | VES sin tasa cuenta como convertible | ingreso-periodo | MUERTO · `3 failed` |
| M05 | el extremo «hasta» deja de ser inclusivo | ingreso-periodo | MUERTO · `1 failed` |
| M06 | la regla no filtra borradas en memoria | ingreso-periodo + Dirección | MUERTO · `7 failed` |
| M07 | el control compara contra todas las cuentas 4 | 4 archivos | MUERTO · `4 failed` |
| M08 | DAT-01: el rango inverso pasa en silencio | ingreso-periodo | MUERTO · `1 failed` |
| M09 | comprobación con el rollup | libro-control | MUERTO · `4 failed` |
| M10 | el cruce sin mirar `source` (crédito de referido) | libro-control + queries | MUERTO · `1 failed` |
| M11 | un asiento anulado cuenta como vivo | libro-control + queries | MUERTO · `2 failed` |
| M12 | vínculo en un solo sentido | libro-control | MUERTO · `1 failed` |
| M13 | monto 0 sale como «sin asiento» | libro-control | MUERTO · `1 failed` |
| M14 | el aviso del diario sale siempre | libro-control + diario | MUERTO · `2 failed` |
| M15 | CSV del diario sin neutralizar fórmulas | libro-control + ruta | MUERTO · `2 failed` |
| M16 | el subdiario incluye borradores | libro-control | MUERTO · `1 failed` |
| M17 | el subdiario descarta saldos negativos | libro-control | MUERTO · `1 failed` |
| M18 | proveedores con `invoiceUsdAmount` (CNY → 0) | libro-control | MUERTO · `1 failed` |
| M19 | sin «no comparable» por B2 | libro-control | MUERTO · `1 failed` |
| M20 | `ingresoDelPeriodo` sin `.is(deleted_at)` en SQL | queries | MUERTO · `1 failed` |
| M21 | el diario se lee de una vez (sin paginar) | queries | MUERTO · `2 failed` |
| M22 | el diario sin `.eq(status, asentado)` | queries + ruta | MUERTO · `5 failed` |
| M23 | el cruce sin `.in(source, …)` en SQL | queries | MUERTO · `1 failed` |
| M24 | `countEntries` cuenta borradores como asentados | queries | MUERTO · `1 failed` |
| M25 | la ruta no corta con el gate | ruta | MUERTO · `1 failed` |
| M26 | la ruta no valida fechas | ruta | MUERTO · `2 failed` |
| M27 | la ruta pide `reports` (equivalente en la matriz) | `rbac-api-guard` | MUERTO · `1 failed` (lo mata el contrato AST, G4) |
| M28 | el contador vuelve a `entries.length` | diario | MUERTO · `1 failed` |
| M29 | los asentados sobre la lista de pantalla | diario | MUERTO · `1 failed` |
| M30 | sin el enlace al diario completo | diario | MUERTO · `1 failed` |
| M31 | la exportación con fechas no valida | diario | MUERTO · `1 failed` |
| M32 | el diario de la comprobación lleva `desde` | ReportesTab | MUERTO · `1 failed` |
| M33 | la pestaña vuelve a «Cashflow» | rename | MUERTO · `3 failed` |
| M34 | el eyebrow vacío vuelve a «Cashflow» | rename (AST) | MUERTO · `1 failed` |
| M35 | el slug cambia sin alias | rename | MUERTO · `1 failed` |
| M36 | el CSV conserva `contable-cashflow` | rename + export-csv | MUERTO · `2 failed` |
| M37 | el CSV del P&L con la condición vieja de vacío | export-csv | MUERTO · `1 failed` |
| M38 | `vistaDelEstado` manda al vacío con facturado | types | MUERTO · `2 failed` |
| M39 | sin el preset «Este mes» | types + queries | MUERTO · `2 failed` |
| M40 | Reportes calcula el ingreso sobre otro rango | queries | MUERTO · `1 failed` |
| M41 | Dirección: margen con el facturado | Dirección | MUERTO · `2 failed` |
| M42 | Dashboard usa el reloj en vez de `hoy` | Dashboard | MUERTO · `2 failed` |
| M43 | Dashboard: ticket con otra base | Dashboard | MUERTO · `1 failed` |

Dos mutantes del plan no se pueden matar y se reemplazaron: «`issued_at ?? created_at`» es equivalente (la única factura sin `issued_at` es el borrador, que el estado ya excluye), así que M02 mide `created_at`; y «reports en lugar de accounting» es equivalente en la matriz (G4), así que lo fija el contrato AST (M27). Dos defensas redundantes se quitaron para que su mutante tuviera sentido: el chequeo de `source` repetido en `asientosPorDocumento` y el `continue` duplicado de borradores en `cuadreSubdiario`.

### /ui-check (rúbrica `.claude/commands/ui-check.md`)

🎨 UI-CHECK · Contabilidad (Libro diario, Reportes, Por contabilizar), Reportes › Estado de resultados y Facturado contra cobrado, KPI de Dirección.

Hallazgos (4, todos corregidos antes del commit):

1 ⭐ [alta] `ReportesTab.tsx` · el rótulo «Balance cuadra» de la tarjeta navy usaba `--ink-inv-mute`, que en tema oscuro da **1,07:1** sobre `--bg-sidebar` (era así antes de esta tarea). Pasó a `--ink-side-soft`: 5,82:1 claro y 5,32:1 oscuro.
2 [media] `ReportesTab.tsx` y `LibroDiarioTab.tsx` · los `input type="date"` tenían ancho fijo estimado (160/170 px). Pasaron a `minWidth: 160`; el ancho real lo pone el control nativo y la fila envuelve.
3 [media] `PorContabilizarTab.tsx` · «factura(s)» en la nota. Pasó a singular y plural correctos.
4 [baja] `direccion/page.tsx` · el sub del KPI de ingresos dejó de decir los embarques activos; la tarjeta Operación los sigue mostrando.

✅ Lo que está bien: solo tokens `var(--*)`, sin hex ni fuentes nuevas, sin AI slop; texto en tinta y el tono en el icono (SDD-0441); sentence case; tuteo sin voseo («Revisa», «Indica», «Usa», «Pídeles»); tablas semánticas con `<th scope>` dentro de `TableFrame` (scroll propio); montos en mono con `nowrap` y `tabular-nums`; errores con `role="alert"`, `aria-invalid` y `aria-describedby`; un solo primario por bloque.

Contraste **calculado** con la fórmula WCAG sobre los valores de `app/studio/tokens.css`, con los `rgba` mezclados sobre su fondo (`contraste-0557.cjs` del scratchpad; no medido en navegador):

| Par | Claro | Oscuro |
|---|---|---|
| `--ink` sobre `--bg-surface` | 16,49 | 13,08 |
| `--ink-soft` sobre `--bg-surface` | 5,33 | 6,86 |
| `--ink-soft` sobre `--bg-elevated` (cabeceras, etiquetas) | 4,68 | 6,00 |
| `--wine-text` sobre `--bg-surface` (enlaces) | 10,58 | 6,44 |
| `--ink-side-soft` sobre `--bg-sidebar` | 5,82 | 5,32 |
| `--warning` (icono) sobre `--bg-surface` | 3,14 | 7,15 |
| `--success` (icono) sobre `--bg-surface` | 4,33 | 7,71 |

Veredicto: OK para commit (con los ajustes ya aplicados).

### revisar-datos-ve sobre el CSV del diario

Advisory; no es asesoría legal. Estados: ENCONTRADO, CORRECTO o NO VERIFICABLE.

**Inventario de lo que sale en el archivo.**

| Columna | Qué es | Personas | Evidencia |
|---|---|---|---|
| Concepto (`journal_entries.memo`) | texto del asiento | nombre del trabajador en el finiquito; Shipping Mark del referidor; texto libre de los asientos manuales | `lib/studio/accounting/settlement-posting.ts:141`, `lib/studio/accounting/referral-credit-posting.ts:212`, `app/studio/(app)/contabilidad/actions.ts:79` |
| Detalle (`journal_lines.line_memo`) | texto de la línea | texto libre de los asientos manuales | `app/studio/(app)/contabilidad/actions.ts:150` |
| Fecha, asiento, origen, cuenta, debe, haber | datos contables | ninguna | `lib/studio/accounting/libro-control.ts` (`filasDelDiario`) |

Los dos titulares nombrados (trabajadores y referidores) **no son usuarios del sistema** (punto 12). Los datos ya se ven hoy en la pantalla del diario; el cambio los lleva a un archivo.

**Puntos.**

| # | Punto | Estado | Evidencia y nota |
|---|---|---|---|
| 1 | Inventario | CORRECTO | tabla de arriba |
| 2 | Minimización | ENCONTRADO | el archivo lleva el nombre del trabajador porque el concepto lo trae (`settlement-posting.ts:141`); para cuadrar el libro alcanza el código del finiquito. Arreglo propuesto (otra SDD): que el posting del finiquito deje de escribir el nombre en el concepto, o que el CSV lo reemplace por el código. No se hizo acá porque cambia el posting y el texto de la pantalla |
| 5 | Borrado | NO VERIFICABLE | un CSV descargado queda en el equipo de quien lo baja y ningún borrado lo alcanza. Es un destino nuevo del dato (escondite 6, «exports») y hay que contarlo en el mapa de borrado |
| 8 | Terceros | CORRECTO | el archivo no se manda a ningún servicio: lo genera el servidor y lo baja el usuario (`app/api/studio/contabilidad/export/route.ts:65`, `respuestaCsv` con `attachment`) |
| 9 | Transferencia internacional | NO VERIFICABLE | `accounting` no tiene alcance de almacén (`lib/studio/rbac.ts:276-281`); si un usuario accounting está en Yiwu, bajar el archivo es tratamiento en China (PIPL). El repo no dice dónde está cada usuario |
| 12 | Titulares que no son usuarios | ENCONTRADO | trabajadores y referidores no pasaron por ninguna política del Studio. La mitigación es de acceso, no de aviso |
| — | Acceso | CORRECTO | solo accounting y admin, los mismos roles que ven nómina (`lib/studio/rbac.ts:116`, `:130`); gate antes de leer (`route.ts:50`); prueba de 403 para commercial |
| — | Caché | CORRECTO | `Cache-Control: private, no-store` (`lib/studio/export/csv.ts:58`), afirmado en `export.test.ts` |
| — | Inyección de fórmulas | CORRECTO | `rowsToCsv` → `csvCell` neutraliza (`lib/studio/reports/builder-types.ts:235`); prueba con `=HYPERLINK(...)` y mutante M15 |
| — | Rastro de la exportación (AUD-01) | ENCONTRADO | AUD-01 pide un evento por exportación y la ruta no lo deja (tarea sin escritura). Igual que `operativo/export` y `comercial/export`. Queda en FUERA DE ALCANCE |

Fuera de alcance de esta revisión (abogado): la base de licitud de tratar los nombres de trabajadores en libros contables, y el plazo de conservación de los libros.

## Impacto documental y conocimiento

- Documentos canónicos actualizados: la spec 0557 y `docs/specs/README.md` (índice regenerado).
- Desactualizado y no tocado: `docs/architecture/contabilidad-qbo-online.md` (no menciona la comprobación, Por contabilizar ni la exportación) y el Norte (`reports.jsx` dice «Facturado vs cobrado»; la UI dice «contra», que es la redacción del plan aprobado).
- `knowledge:status`: exit 0, modo `integrated`, `ok: false` por motivos globales ya conocidos (estructural INVALID con 4.875 pendientes, semántico INVALID, Archify PENDING por `ARCHIFY_RUNTIME_MISSING`, publicación `MAIN_REQUIRED`). Nada propio de esta rama. Graphify y Archify los actualiza el Director desde main integrado.
- `origin/main` avanzó a `6c3f0a9f` (#280, SDD-0556, y #281) después de crear la rama. `git merge-tree` con el código commiteado no da conflictos; el índice de specs sí va a chocar (0556 suma su fila): se regenera al mergear.

## PENDIENTES DE ESTA TAREA

1. `pnpm verify` con turno del Director.
2. Mergear `origin/main` en la rama antes de la PR y regenerar el índice (`node scripts/build-docs-index.mjs`).
3. Push y PR cuando lo autorice el encargo. No lleva migración.
4. Nota para Sam (va también en la PR): Dirección y el Dashboard ahora muestran el facturado aunque el mayor esté en 0. Antes Dirección mostraba 0 (el mayor está vacío) y el Dashboard el total con IVA y sin convertir moneda. Contabilidad › Reportes pasa de acumulado a período (por defecto, el mes en curso). Mientras exista B3, la diferencia con el mayor no va a ser cero: es la señal, no un error de la pantalla.
5. Las preguntas abiertas de la spec (cifra oficial, B10, diario con anulados, anuladas entre períodos) para Sam y la contadora.

## FUERA DE ALCANCE DETECTADO

1. **AUD-01 en las exportaciones CSV**: ni esta ruta ni `operativo/export` ni `comercial/export` dejan un evento de auditoría. Necesita una SDD con escritura (y quizá RPC).
2. **El concepto del finiquito lleva el nombre del trabajador** (`lib/studio/accounting/settlement-posting.ts:141`). Para el libro alcanza el código; se ve en pantalla y ahora en el CSV.
3. **«Facturado YTD» de `invoiceKpis`** (`lib/studio/invoice-queries.ts`, de la SDD-0555): `total_amount` con IVA, sin convertir, por `issued_at ?? created_at`. Hay que rotularlo o unificarlo.
4. **Libro de ventas y Posición de IVA por `created_at`** (`lib/studio/fiscal/queries.ts`, `lib/studio/reports/queries.ts`): el criterio lo decide la contadora.
5. **Borradores con saldo en `receivablesQueue`** (Cobranzas H07): va con la SDD-0558. Por eso el subdiario de clientes no coincide con «Por cobrar».
6. **H03 y H08**: «Por cobrar» sin normalizar y dos conversiones a USD distintas.
7. **El rótulo «Balance cuadra» en tema oscuro** estaba en 1,07:1 desde antes; quedó corregido acá solo en esa tarjeta. Otros usos de `--ink-inv-mute` sobre fondos navy no se revisaron.
8. **Las pestañas de Contabilidad** son botones sin `role="tab"` ni flechas (A11Y-01 §11), como antes; no cambia en esta tarea.
