# Handoff · SDD-0571 · Tarifa congelada por embarque (4.1 del plan contable)

> **Adopción Codex, 2026-10-20:** el Director asignó el cierre acotado de tres P2
> sobre `b70be5d792ca4ee0417426266301a9e2e7fd9ffc`, después de la pausa explícita
> de la sesión anterior por Sam. Owner escritor: `codex-0571-cierre-01a15a4e`,
> mismo worktree y rama de la tabla. Se comprobaron raíz/rama, árbol limpio,
> respaldo remoto en ese SHA, guard y claim disponible antes de adquirirlo.
> La segunda consulta de procesos no encontró consumidores que nombraran este
> worktree; esa ausencia no sustituye la autorización de adopción.
>
> **Estado del cierre:** VALIDADO LOCALMENTE, ACEPTACIÓN FINAL PENDIENTE. Paginación
> normalizada y vigencia de carga/vista previa pasaron el focal y siete controles
> rojos. **La aceptación final requiere la validación canónica posterior sobre
> la base final.** La preparación respetó los turnos de #304 y #301 (SDD-0569);
> el Director asignó después el turno exclusivo a 0571. No se instalaron dependencias.
> Commit selectivo y push a la misma rama/PR #307 en borrador autorizados después
> del focal. Sin SQL, RBAC, DB, producción, cambios de dependencias ni junction.
> La UI visible del Worker y la revisión independiente del Director pasaron
> con datos sintéticos. El servidor quedó detenido, sin procesos propios,
> y se devolvió expresamente el turno pesado. La actualización del conocimiento
> permanece pendiente para el cierre del Director sobre la integración.
>
> Allowlist de esta adopción: `lib/studio/rate-snapshots/propuesta.ts`,
> `lib/studio/rate-snapshots/__tests__/propuesta.test.ts`,
> `app/studio/(app)/cn/_components/RateSnapshotDrawer.tsx`,
> `app/studio/(app)/cn/_components/RateSnapshotDrawer.test.tsx` (nuevo),
> la spec 0571 y este handoff; `docs/specs/README.md` solo si lo exige el generador;
> los dos diccionarios `warehouse.ts` solo para estados que necesite la reparación.
> La evidencia de la sesión anterior se conserva como histórica, separada del cierre actual.

## Cierre acotado Codex: validación local del 2026-10-20

Cambios preparados sobre el SHA de adopción, validados antes del commit selectivo:

- `propuesta.ts`: clientes en páginas de 50, con orden por `id`, buscando todas las coincidencias exactas normalizadas para detectar ambigüedad; estimados en páginas de 20, con orden por `accepted_at` e `id`, hasta reunir 20 coincidencias exactas válidas o agotar candidatos. No se cambia el resolutor ni la precedencia de fuentes.
- `RateSnapshotDrawer.tsx`: cada carga conserva recepción, servicio y generación; una respuesta anterior se descarta. La vista previa remota conserva la clave de la entrada y su edición; cambiarla oculta inmediatamente el importe previo e impide enviar tanto desde el botón como desde el formulario. La edición distingue A → B → A. Los errores y rechazos de promesas dejan el envío bloqueado hasta una respuesta válida vigente.
- En la lectura de `useT` se observó que devuelve una función nueva por render. Se quitó esa identidad de las dependencias de carga guardando datos de error y traduciéndolos al renderizar en el cajón. **La regresión pasó y el mutante que vuelve a depender del traductor falló por ciclo de render**, con una cota explícita de 100 renders para no bloquear el proceso. No se modifica i18n compartido.
- Mensaje de cálculo pendiente en los diccionarios `warehouse.ts` es-VE y zh-CN, con `aria-busy` en la vista previa. Se conservan los controles, tokens, distribución y permisos existentes.
- `propuesta.test.ts`: cuatro regresiones nuevas, sin quitar las anteriores; 11 casos en total. El doble ejecuta filtros, orden y rangos, con coincidencias exactas detrás de 50/20 parciales y duplicados en páginas distintas.
- `RateSnapshotDrawer.test.tsx`: 14 casos con promesas controladas y temporizadores; montan el campo numérico real y sustituyen las acciones. Cubren debounce, respuestas fuera de orden, A → B → A, fallo y recuperación, cambio de estimado/recepción/servicio, motivo y estabilidad frente a la identidad del traductor. También cruzan respuestas de preview por recepción y servicio. No usan DB.
- La spec incorpora la prueba nueva en su allowlist y los criterios 12–14. `docs:check` confirmó el índice sincronizado; no fue necesario modificar `docs/specs/README.md`.

| Comprobación del cierre actual | Estado |
|---|---|
| Raíz, rama, SHA de adopción, árbol inicial limpio, respaldo remoto y guard/claim | PASÓ |
| Lectura del diff y de las secuencias | Realizada; lectura preliminar del Director sin otro defecto observado |
| Focal final: propuesta, cajón, types, acciones y ReceiptRateCell | PASÓ: 62/62, cinco archivos, un worker y sin paralelismo entre archivos; `C:/tmp/worker-0571-cierre-20261020/focal-final.log` |
| Controles rojos/mutantes | PASÓ: 7/7 detectados; detalle debajo. Inyección solo al transformar el código en Vitest; SHA-256 de las cuatro fuentes idéntico antes/después |
| Typecheck | PASÓ: tipos de ruta sanos y `tsc --noEmit` exit 0; `typecheck.log` en la carpeta de evidencia |
| Lint de los seis archivos TS/TSX tocados | PASÓ: exit 0, cero warnings; `lint.log` |
| `docs:check`, numbering y `git diff --check` | PASÓ; 556 specs, 489 migraciones; las colisiones históricas ya exceptuadas permanecen |
| `pnpm verify` sobre la base final | NO EJECUTADO: lo coordina el Director después de las dependencias |
| Revisión visible del Worker | PASÓ en fixture sintética: estados, recuperación, confirmación, ancho móvil, chino, oscuro/solo lectura y teclado. Límites debajo |
| Revisión visible independiente del Director | PASÓ en IAB: 900 conserva la entrada, oculta el importe durante la espera y después muestra $1,800.00; 999 elimina ese resultado, bloquea enviar y conserva el error sintético. Captura `director-error-sintetico.png` |
| Servidor, procesos y turno de pruebas | PASÓ: fixture detenida, 0 procesos propios en `processes-final.json`; turno pesado devuelto expresamente antes del cierre documental |
| Commit/push y estado de la PR | El commit que contiene este cierre se publica selectivamente en la misma rama; SHA exacto y respaldo se registran en la PR y entrega final. PR #307 permanece en borrador |
| Integración, conocimiento compartido, merge, despliegue o SQL0496 | NO EJECUTADO; fuera de este cierre |

Controles rojos reproducibles con `node C:/tmp/worker-0571-cierre-20261020/run-mutants.mjs`, sin modificar archivos del producto:

| Control | Resultado esperado observado |
|---|---|
| `propuesta.ts` original de `b70be5d7` | Cuatro fallos: exacto detrás de 50, duplicado en otra página, exacto detrás de 20 y tope posterior al filtro |
| Preview sin comprobar clave vigente | Falla porque continúa visible el importe $1,600.00 anterior |
| Submit sin exigir `puedeEnviar` | Falla porque el evento del formulario llama a congelar con la preview pendiente, aunque el botón esté deshabilitado |
| Carga sin generación | Fallan los cruces por servicio y recepción: la respuesta anterior desplaza la actual |
| Preview sin descarte de respuesta anterior | Fallan precio y cruces de recepción/servicio: desaparece la preview vigente |
| Preview sin generación de edición | Falla A → B → A por reutilizar el importe anterior |
| Carga dependiente del traductor | Falla por ciclo de render; el código corregido carga una sola vez ante los renders del formulario |

`mutants-summary.json` conserva nombres, errores, exit codes y hashes. El focal inicial pasó 23/23; después se añadieron dos cruces explícitos de preview por recepción/servicio y el focal final pasó 62/62 con las regresiones existentes. No se cambió lógica de producto para acomodar una prueba fallida.

### UI visible y fixture local

Fixture en `http://127.0.0.1:4571/`, iniciable con `node C:/tmp/worker-0571-cierre-20261020/server.mjs`. Archivos temporales fuera del repo. Monta `RateSnapshotDrawer`, `DrawerShell`, `NumericInput`, i18n, `ToastProvider`, CSS y fuentes locales reales; reemplaza únicamente las acciones por datos sintéticos y los adaptadores de navegación de Next. La carga de `.env` está deshabilitada y los imports de Supabase/server-only se rechazan. Ninguna fila, credencial ni sesión de negocio se usó en esta revisión.

- `?delay=5000`: permite observar el cálculo pendiente. Precio 999 provoca un error sintético; 900 recupera. LCL tarda 1.600 ms y DDP 200 ms para revisar respuestas cruzadas. `?lang=cn`, `?theme=dark` y `?role=support` habilitan los otros escenarios.
- Observado: 800 → 900 elimina $1,600.00 de inmediato, muestra «Calculando la tarifa…» y bloquea enviar; el error 999 conserva el bloqueo; recuperación a 900 habilita confirmar y la acción sintética muestra tarifa vigente y aviso por $1,800.00.
- A 390 × 844, etiquetas e importes legibles, scroll dentro del cajón y footer fijo. Viewport restaurado al terminar. En chino se observó la nueva traducción de cálculo; oscuro/solo lectura conserva el bloqueo y oculta las vías elevadas.
- Foco inicial en el diálogo, Tab/Shift+Tab dentro, Escape cierra y devuelve el foco al botón de apertura. Cero errores de consola observados. No sustituye cobertura completa de lector de pantalla, navegadores/dispositivos reales ni integración con el backend.
- Capturas locales en la carpeta de evidencia: `ui-inicial.jpg`, `ui-pendiente.jpg`, `ui-error.jpg`, `ui-movil.jpg`, `ui-movil-recuperada.jpg`, `ui-confirmada-sintetica.jpg`, `ui-zh-CN.jpg`, `ui-oscuro-solo-lectura.jpg`. El Director revisó por separado en IAB los estados pendiente, válido ($1,800.00) y error sintético, y guardó `director-error-sintetico.png`.
- La fixture y las pestañas propias de revisión quedaron cerradas. `processes-final.json` registra 0 procesos propios; no se dejó ninguna prueba, compilación ni contenedor ejecutándose por esta tarea. El turno pesado se devolvió al Director antes de completar documentación, commit y push. Graphify, Archify, cobertura semántica y publicación/revisión visible en Obsidian siguen pendientes del Director, separados de la evidencia guardada en esta tarea.
- `/ui-check` del alcance: sin hallazgos nuevos bloqueantes; se reutilizan componentes, fuentes, tokens, labels y estados. **FUERA DE ALCANCE DETECTADO:** las opciones compartidas de servicio siguen en español bajo zh-CN, comportamiento preexistente en `SERVICE_OPTIONS`; requiere una tarea de traducción compartida, no un cambio en este cierre.

Se conservan como límites históricos la ausencia del módulo `cn` en accounting, la fecha UTC del resolutor frente a Caracas y el mínimo mutable del estimado. No se reparan ni se presentan como aprobados por este cierre. La reparación preparada no cambia SQL0496 ni la matriz RBAC.

La evidencia de la sesión anterior continúa a continuación.

| Campo | Valor |
|---|---|
| Fecha | 2026-10-20 |
| Task ID / owner | `fase4-carril-adelantado` / sesión Worker «carril del embarque» (Claude, `claude-peaceful-franklin-a3831e`) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\peaceful-franklin-a3831e` |
| Rama | `claude/peaceful-franklin-a3831e`, sobre la reserva `codex/sdd-reserve-0571` (`37fd5608`, que parte de `origin/main` `eafbd910`) |
| SDD | [0571](../../docs/specs/0571-tarifa-congelada-por-embarque/spec.md), `in-progress`. Número y migración `0496` asignados por el Director el 2026-10-20 (intercambio 0571↔0572 con «Contabilidad»). Reserva con `sdd:next --reserve tarifa-congelada-por-embarque --number 0571 --push` |
| Estado | diseño aprobado por el Director (2026-10-20); revisión de seguridad corregida (9 puntos); `pnpm verify` final pendiente de turno |
| Permisos | Encargo de Sam: commits, push de la rama propia y PR **en borrador**; no fusionar. **No incluye** aplicar la 0496 ni leer producción: la aplica el Director con el OK nominal de Sam |

## OBJETIVO ORIGINAL

La 4.1 del plan (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md` §8, carril adelantado) con la decisión 9: la tarifa por CBM se congela al recibir en Yiwu con el CBM medido allí (500 kg/m³ regla, 1.000 excepción); el orden es estimado aceptado → lista del cliente o aliado → tarifario; el mínimo se cobra. Fila «CBM real · tarifa · a facturar» y alerta «sin tarifa» en Almacén CN.

## COMPLETADO

- **Mapa en solo lectura** de dónde se calcula la tarifa hoy (cotizador, estimados, listas, recepción CN, consolidación, OV, lote 0543): ninguna tabla operativa la congelaba. Está en la spec, § «Lo que hay hoy».
- **Migración 0496** (`fccd1941`): tabla `shipment_rate_snapshots` inmutable por recepción, guardián para todos los roles, chequeo diferido del reemplazo, RPC `congelar_tarifa_recepcion` (DEFINER) que deriva tarifa y mínimo de la fila de origen y clasifica lista propia/pactada/descuento o casa con la regla de `resolveRateForClient`; preflight por md5 de `get_user_tenant_id`, `current_studio_role` y `resolve_price_book`; postflight; espera MIGRATE-FIRST en el baseline.
- **App** (`2e29f752`): columna «Tarifa · a facturar» en Almacén CN, cajón con propuesta, estimado, a mano y Excel (los dos últimos solo admin/contabilidad), historial; «Congelar tarifas pendientes» en lote; textos es-VE y zh-CN; símbolos declarados con su degradación.
- **`/ui-check`**: 4 hallazgos (ancho de la columna medido con el peor monto, contraste del aviso, borde izquierdo, gaps); los tres primeros corregidos antes del commit.

## REVISIÓN DEL DIRECTOR (2026-10-20)

- **Diseño aprobado** con las 7 decisiones, por la delegación de Sam (decisión 9). El servicio en la recepción queda para la 4.2.
- **Previa de producción** (sin filas): `current_studio_role` y `get_user_tenant_id` coinciden con el repo; `resolve_price_book` tiene deriva de comentarios (vivo `4f39f434…` = el de la 0382 sin sus dos líneas `--`). El preflight acepta los dos cuerpos, con prueba y control rojo (`38198401`).
- **Revisión de seguridad sobre `38198401`**, corregida en `fa5f14e2` y `2e94bccc` (detalle en la spec, § «Revisión de seguridad»): vigencia, destino y orden de la decisión 9 en la RPC, con mutantes y paridad del rechazo; vía elevada con la capability `fix_frozen_rate` (la matriz de `cn` no cambia); sin TRUNCATE; `FOR UPDATE` solo al congelar; lote parcial; Shipping Mark con `upper(btrim())`.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| Contrato `0496_tarifa_congelada_por_embarque.test.sql` en PGlite | la migración | PASÓ: «TEST 0496 GREEN: 79 aserciones»; control rojo: «TEST 0496: existe public.shipment_rate_snapshots» |
| `lib/studio/__tests__/tarifa-congelada.migration.test.ts` | contrato, control rojo, 30 mutantes (cada uno muere en su aserción), aborto del preflight, reaplicación, espera | PASÓ: 35/35 (una corrida previa mostró un mutante que moría en otra aserción; se acotó la lectura de commercial y warehouse al tenant A) |
| `lib/studio/rate-snapshots/__tests__/` | tipos (14) y paridad SQL↔`resolveRateForClient` (8 casos + propiedad del descuento, 40 casos con semilla) | PASÓ: 23/23. Mutante a mano (sin la rama «pactada»): muere en «DTD-0042 a Valencia: pactada»; archivo restaurado con `git checkout` y `git diff --quiet` |
| `app/studio/(app)/cn/__tests__/rate-snapshot-actions.test.ts` | acciones, ERR-01, lote, permisos | PASÓ: 13/13 |
| `ReceiptRateCell.test.tsx` + `AlmacenCnClient.test.ts` + `ReceiptRowActions.test.tsx` | UI | PASÓ: 9/9 (la celda, 4/4 después del ajuste del ui-check) |
| `tsc --noEmit` | repo | PASÓ (0 errores) sobre el árbol de `2e29f752` |
| eslint de los archivos tocados | — | PASÓ (0 errores, 0 avisos) |
| `check-pending-migration-symbols` | código alcanzable | PASÓ: «0 ROJO · 1 AMARILLO declarado(s)» |
| `docs:check`, `sdd:check`, `governance:check`, `components:check` | — | PASÓ |
| Contrato en PostgreSQL 17 (Docker, `run-sql-tests`) | — | NO EJECUTADO: es corrida pesada; entra en `pnpm verify` |
| `pnpm verify` sobre `38198401` | completo | INTERRUMPIDO: lo detuve al llegar la revisión de seguridad. Desde `edge-functions` todos los pasos salieron con 3221225794 (0xC0000142, la DLL no inicializó): efecto de la interrupción, no del código; harness, lint, rsc-boundary y typecheck alcanzaron a pasar |
| `pnpm verify` sobre `b6d19138` (16:00Z–16:32Z) | completo | FALLÓ en `test`: `rbac-actions-guard.test.ts`, 5 casos (la vía elevada decidía el candado con un `if`). Pasaron lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols («0 ROJO · 1 AMARILLO»), sql-tests («246 contrato(s)»), schema-rebuild («471 migraciones»), e2e (177 passed, 1 flaky de WebKit) y build. `migrations-applied`: SKIP (sin `.env.local`). Corregido en `2e94bccc` |
| Puntual sobre `2e94bccc` | migración, paridad, propuesta, acciones, celda, `rbac.test.ts`, `rbac-actions-guard.test.ts` | PASÓ: 630/630; tsc y eslint limpios; símbolos 0 ROJO |
| **`pnpm verify` sobre `a81dbbd7`** (= código de `2e94bccc` + este handoff), 16:49:56Z–17:20:04Z | completo | `VERIFY_EXIT=0`: «CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied. No hubo fallos en lo medido (16/17)». Detalle abajo |

Detalle del verify final, copiado de su salida:

| Paso | Resultado |
|---|---|
| harness | PASÓ |
| lint | PASÓ |
| rsc-boundary | PASÓ |
| typecheck | PASÓ |
| edge-functions | PASÓ (4 funciones) |
| test | PASÓ: `Test Files 856 passed \| 1 skipped (857)`, `Tests 12242 passed \| 1 skipped (12243)` |
| docs:check | PASÓ |
| numbering | PASÓ |
| feature-constants | PASÓ (6 banderas) |
| components:check | PASÓ |
| governance:check | PASÓ |
| migrations-applied | NO DISPONIBLE: SKIP, el worktree no tiene `.env.local`. La 0496 es MIGRATE-FIRST y la aplica el Director |
| pending-migration-symbols | PASÓ: «0 ROJO · 1 AMARILLO declarado(s)» (la 0496) |
| sql-tests | PASÓ: «246 contrato(s) de SQL verificado(s)», con `0496_tarifa_congelada_por_embarque.test.sql` |
| schema-rebuild | PASÓ: «471 migraciones aplicadas desde cero» |
| e2e | PASÓ con aviso: `176 passed (11.7m)`, 2 flaky ajenos (`auth.spec.ts:81`, el token inválido de Acceso, el mismo de otras corridas; `company-photo-carousel.spec.ts:93`, evidencia visual), proceso ≠0 por el worker de WebKit en Windows |
| build | PASÓ |

Las corridas puntuales usaron el `node_modules` de main por junction (`node node_modules/vitest/vitest.mjs`, nunca `pnpm exec`). Se quita con `cmd /c rmdir` antes de borrar el worktree.

## COMMITS

- `37fd5608` reserva SDD-0571.
- `fccd1941` migración 0496, contrato, PGlite, espera y spec.
- `2e29f752` app del Almacén CN, pruebas, textos y símbolos.
- El commit que contiene este documento.

## PR / BRANCH

Rama `claude/peaceful-franklin-a3831e`, base `main`. PR en borrador: ver la PR de esta rama.

## PAUSA ORDENADA (2026-10-20, ~17:20Z)

El Director ordenó pausar: a Sam se le acaba el saldo de Claude y **Codex continúa**. Estado al pausar:
- **SDD-0571 / PR #307:** rama `claude/peaceful-franklin-a3831e`, cabeza = el commit que contiene esta sección. Diseño aprobado; revisión de seguridad: puntos 1 a 8 corregidos (`38198401`, `fa5f14e2`, `2e94bccc`), el 9 en FUERA DE ALCANCE; verify final sin fallos en lo medido (16/17). La PR sigue en borrador.
- **SDD-0574 (4.5):** rama `codex/sdd-0574-embarques-sin-facturar` (`18edcd81`), empujada sin PR, apilada sobre esta. Contabilidad confirmó (2026-10-20) que la 0572 y la 0573 no cambian las columnas, los estados ni el sentido de borrador y anulada que lee; con la 0573 una factura con cobros vivos ya no se anula, sin efecto en el reporte. Verify pendiente.
- **4.2:** no empezada; pedir al Director SDD y migración.
- El CI de GitHub sigue bloqueado por facturación (dos corridas de «Calidad local sin secretos» sin arrancar).

## PENDIENTES DE ESTA TAREA

**Actualización, 2026-11-03:** la 0496 está aplicada, en lote con la 0497. Cierre del runbook §6 en `.agents/handoffs/0571-0573-cierre-0496-0497.md`. Lo que sigue es de antes de eso.

1. ~~`pnpm verify`~~ hecho sobre `a81dbbd7` (16/17, sin fallos). ~~Revisión de diseño y seguridad~~ hechas y corregidas. ~~Previa de los md5~~ hecha (deriva de `resolve_price_book` aceptada).
2. Que el Director confirme la cabeza de la #307 y cierre la revisión de seguridad sobre ella.
3. OK nominal de Sam nombrando `0496_tarifa_congelada_por_embarque`, aplicación por el runbook (MIGRATE-FIRST) y smoke en Almacén CN; recién después, fusionar la #307. El CI de GitHub, al regularizar la facturación: `gh run rerun` de «Calidad local sin secretos».
4. Pendiente de decisión (no bloquea): congelar sola al recibir (falta el servicio en la recepción), cobro del exceso de peso por contenedor, importador del Excel de Yiwu cuando llegue el archivo.

## FUERA DE ALCANCE DETECTADO

- **Con destino a la SDD de RBAC multitenant** (punto 9 de la revisión del Director): `current_studio_role()` (0200) toma `limit 1` de las membresías activas sin atarse al tenant de la sesión; y `warehouse_scope` (SDD-0139) se aplica solo en la app, no en la base.
- `findRateInBook` filtra la vigencia con la fecha UTC (`new Date().toISOString()`) y la RPC con la de Caracas: entre las 20:00 y las 24:00 de Venezuela la app puede descartar una tarifa que vence ese día y la base aceptarla. Hoy no cambia la propuesta (la app elige primero).

- `lib/studio/price-books/price-book-types.ts:95` `aplicarDescuento` redondea con `Math.round(n*100)/100` en coma flotante; la base redondea en `numeric`. La propiedad de 40 casos no encontró diferencia, pero en un borde exacto (`x.xx5`) podrían diferir un centavo. Hoy es solo visual en el cotizador; la tarifa congelada usa la de la base.
- El rol `accounting` puede congelar por la RPC pero no ve el módulo `cn` (`lib/studio/rbac.ts`, matriz `cn`). Si Sam quiere que la contadora corrija tarifas desde la pantalla, es un cambio de la matriz (decisión 15 cubre lecturas de otros módulos).
- `quotes` no guarda mínimo: un estimado aceptado toma el `min_charge` de su `rate_used_id`.

## IMPACTO DOCUMENTAL Y CONOCIMIENTO

- Documento canónico actualizado: la spec 0571 e índice `docs/specs/README.md`.
- Graphify/Archify: NO EJECUTADO en este worktree (sin cambios en fuentes del piloto semántico); `knowledge:status` corrido, modo integrado. El Director publica desde main al integrar.

## HANDOFF AL DIRECTOR

- Siguiente acción: turno de `verify`, revisión de la spec y previa de los md5. Después la 4.5 («Embarques sin facturar»), que lee `shipment_rate_snapshots`: conviene que la 0496 esté al menos aprobada en diseño.
- Contratos compartidos: tabla nueva y RPC nueva; toca `AlmacenCnClient.tsx`, `cn/page.tsx` y los diccionarios `warehouse.ts`. No toca `lib/studio/accounting`, `invoices`, recibos ni tasas.
- Ownership: claim de `claude-peaceful-franklin-a3831e` vigente mientras siga la tarea (4.5 y 4.2 vienen en esta misma sesión).
