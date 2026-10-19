# Handoff · SDD-0558 · Saldo único por cliente y cabecera del perfil v1

| Campo | Valor |
|---|---|
| Fecha | 2026-10-19; en Caracas, de 08:20 a 09:35 aprox. (UTC 12:20 a 13:35) |
| Task ID / owner | `contabilidad-2026-10-18` / subagente escritor de la sesión Worker «Contabilidad» |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0558-saldo-unico-cabecera` |
| Rama | `codex/sdd-0558-saldo-unico-cabecera`, desde `origin/main` `bb6bb3e4`; con la reserva cherry-pickeada (`a1eae79b`) y `origin/main` `4728a8ca` (la #284, SDD-0559) fusionado sin conflictos (`b11ef862`) |
| SDD | [0558](../../docs/specs/0558-saldo-unico-cliente-cabecera/spec.md), `in-progress` |
| Estado | implementada y validada en lo liviano; **sin push**. La PR va en borrador y **no se fusiona sin aplicar la 0492** (MIGRATE-FIRST) |
| Permisos | Sam autorizó la fase 1 completa: commits selectivos, push de la rama propia y PR en borrador (#286), sin fusionar. No incluye producción ni base de datos: la 0492 la aplica el Director con el OK nominal de Sam, que él le pide directamente nombrando `0492_client_outstanding`. El 2026-10-19 Sam escribió además, textual: «Decirle al director que él es quien puede hacer el merge a main, que yo lo apruebo.»; el Director lo registró a nombre de Sam y lo aplica después del apply y del smoke |

## OBJETIVO ORIGINAL

Tarea 1.3 de la fase 1 del plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`), hallazgos B13 y B15: una sola función SQL del saldo por cliente (`client_outstanding`, migración 0492) usada por la ficha, Conversaciones y el job de Kommo, con Cobranzas bajo la misma regla; la cabecera v1 de la ficha (saldo, vencido, último pago, embarques en curso); el botón «Estado de cuenta» por rol; y (F18) el estado de cuenta del Studio igual al del portal, con razón social y RIF en su PDF. Las decisiones F1 a F18 del encargo mandan sobre el plan.

## COMPLETADO

Commits (todos con `Co-Authored-By: Claude Opus 5.5`), en orden:

| SHA | Mensaje |
|---|---|
| `362f7755` | feat(studio): SDD-0558 — 0492 client_outstanding y Cobranzas con la misma regla |
| `47541d0f` | feat(studio): SDD-0558 — Kommo y Conversaciones leen el saldo único |
| `33127c82` | feat(studio): SDD-0558 — cabecera de cuenta v1 en la ficha del cliente |
| `f42a5aa0` | feat(studio): SDD-0558 — estado de cuenta del Studio igual que el del portal |
| `bb2fdc30` | test(studio): SDD-0558 — Cobranzas pasa la fecha de Caracas a la cola y a los recordatorios |
| `ac6f94c6` | chore(db): SDD-0558 — la 0492 queda declarada como espera, MIGRATE-FIRST |
| `ba9968c3` | fix(studio): SDD-0558 — ajustes del /ui-check en la cabecera y las notas |
| `27434c5a` | docs(sdd): SDD-0558 — spec del saldo único por cliente y la cabecera v1 |
| `b11ef862` | Merge remote-tracking branch 'origin/main' (la #284) |
| `b2951249` | docs(sdd): SDD-0558 — cita la definición canónica de la 0559, ya integrada |
| (este) | docs(handoff): SDD-0558 — … |

Lo hecho, por decisión:

- **0492** (`supabase/migrations/0492_client_outstanding.sql`): solo la función, SECURITY DEFINER, STABLE, `search_path` vacío, owner postgres, EXECUTE para `authenticated` y `service_role`. Gate de F1: admin o accounting, o `document_entity_authorized('client', tenant, 'view')`, más `service_role` por `(select auth.role())`. Sin rama «conversaciones». Preflight con el patrón de 0456 y 0471: tablas, tipos, valores de enum, columnas con tipo, `auth.uid()`/`auth.role()`, aborta si ya existe, y los md5 de `get_user_tenant_id`, `current_studio_role`, `document_entity_authorized` y `document_entity_module_contract` con su seguridad, volatilidad y `search_path` (F17). Postflight de forma y ACL.
- **F4** último pago de cualquier factura viva del conjunto de códigos, también la anulada; respaldo `last_payment_at` por factura. **F5** `upper(btrim())` en los dos lados. **F6** vencido por moneda con el tramo más antiguo entre monedas.
- **F2/F9** `lib/studio/client-account.ts` (puro): `ESTADOS_FACTURA_CON_SALDO`, `cuentaParaSaldo`, `coerceClientOutstandingRows` (falla cerrado), `resumirCuentaCliente`, `tieneSaldoAbierto`, `puedeVerSaldoCliente`, `puedeVerEstadoDeCuenta`, `fechaCorta`, `SaldoClienteError`. `client-queries.ts` (I/O): `listClientOutstanding` (lotes de 200; único sitio que nombra la 0492), `countShipmentsInProgress`, `getClientAccountState` (nunca lanza). «En curso» reutiliza `INACTIVE_STATUSES`, ahora exportado.
- **F3** Conversaciones: `getClientContext(supabase, clientId, conversationId)`; 42501 → fachada de 0412; otro fallo → saldo null. Panel por moneda (`SaldoPendienteContexto`) con enlace a la ficha. La 0412 no se toca.
- **F8** Cobranzas: `.in('status', ESTADOS_FACTURA_CON_SALDO)`, `cuentaParaSaldo` en la cola pura y `todayCaracasISO()` por defecto; la pantalla y los recordatorios pasan la fecha de Caracas (también el período de la separación de fondos). No se tocaron `invoice-queries.ts` ni `invoice-types.ts`.
- **Kommo**: el saldo sale de la 0492; tránsito por todos los códigos; inerte si el saldo falla; `soloLecturaKommo` reemplaza al `dryAdmin`.
- **Cabecera v1** (`ClientAccountHeader`) y botón «Estado de cuenta» solo con `invoices`.
- **F18**: `filasParaLedger` conserva las anuladas emitidas; la pantalla muestra `notaPagosEnAnuladas` y `notaSobrepagos` (`donde: "libro"`); el PDF pasa `legalName` y `rif`; la prueba se reescribió.
- **F11**: inventario de lecturas de facturas recalculado sobre `origin/main` (20→19 archivos, 45→44 llamadas); el nombre de la función solo en `client-queries.ts`; declaración de símbolos escrita al final y revalidada.
- **F12** paridad: prueba de propiedad en su propia instancia de PGlite. **F13** tabla completa de definiciones en la spec. **F14** definición canónica de la 0559 citada.

### Casos de prueba movidos al contrato SQL

| Caso de TS | Dónde quedó |
|---|---|
| Kommo «⭐ un BORRADOR no es una deuda» | contrato 0492, «un borrador no es deuda» |
| Kommo «una ANULADA tampoco» | contrato 0492, «una anulada no es deuda» |
| Kommo «un anticipo no cancela la deuda de OTRO cliente» | contrato 0492, «un sobrepago no compensa otra factura» (más estricta: tampoco la de otra factura del mismo cliente) |
| Kommo «suma varias facturas del mismo cliente» | contrato 0492, suma completa de c1 |
| `avisos-sin-eliminados` «una factura eliminada no es saldo» | contrato 0492, «una factura eliminada no es deuda»; el bloque ahora prueba que el job no lee `invoices`, los ids que pide y el inerte |
| Kommo «⭐ el residuo de coma flotante NO enciende el saldo» | **retirado**: el cálculo pasa a `numeric(14,2)` y el defecto no existe |

## DESVÍOS RESPECTO DEL PLAN Y DE LAS DECISIONES

1. **F18, una regla más:** `filasParaLedger` descarta también las anuladas que nunca se emitieron (`esAnuladaSinEmitir`), no solo los borradores. Es lo que hace el portal (`lib/portal/portal-queries.ts`), y el encabezado de F18 es «igual que el del portal».
2. **F11, números:** las decisiones decían 18→17 archivos y 42→41 llamadas; sobre `origin/main` `bb6bb3e4` (con la 0555, 0556, 0557 y 0560) son **20→19 y 45→44**. Se recalculó, como pedía la decisión.
3. **F3, firma:** `getClientContext` recibe `clientId` **y** `conversationId`: el segundo hace falta para caer a la 0412. La prueba de la ruta afirma `(anything, "client-1", "conversation-1")`.
4. **F3, sin la 0492 aplicada** el error es PGRST202 y no 42501: el panel muestra «No se pudo calcular el saldo» en vez de caer a la 0412. Es lo que dice F3 («otra razón → null»); queda declarado en la evidencia de símbolos. Con MIGRATE-FIRST esa ventana no existe.
5. **Cabecera:** grilla `minmax(260px, 1fr)` y no 190 px: medido con la Sora real, a 190 px una cifra de bolívares de 8 dígitos quedaba cortada (`KpiCard` tiene `overflow: hidden`).
6. **Nota de diferencia con el estado de cuenta (F13):** sale solo a quien puede abrirlo (`canViewStatement`); a comercial le hablaría de una pantalla que no ve.
7. **Sin permiso (F2):** los embarques se cuentan con el código vigente y el historial (sin fichas fusionadas), porque sin la 0492 no hay conjunto completo. En la práctica no ocurre: el layout de clientes ya exige `clients`.
8. **Fixture del contrato:** cascarones con los tipos exactos que exige el preflight, en `supabase/tests/_0492_client_outstanding_schema.sql` (lo comparten el contrato y las pruebas de paridad y anti-deriva), en vez de `\ir` de 0077/0079/0195, que arrastran medio esquema.
9. **Paridad (F12):** propiedad con 4 semillas fijas × 70 facturas al azar en vez de una fixture fija chica.
10. **Pruebas que el plan no listaba** y que daban control rojo a cambios sin prueba: la página de Cobranzas y la vista previa de recordatorios con la fecha de Caracas (`hoy-caracas.test.ts`), la pantalla y el PDF del estado de cuenta, y la espera y las huellas del preflight.
11. **Comentario de `lib/studio/pdf/estado-de-cuenta-pdf.tsx`:** decía «Hoy ninguna ruta los pasa»; era falso desde la 0556 y lo es más ahora. Se corrigió solo el comentario.
12. **Hecho del plan que resultó distinto:** la cabecera de la 0412 dice que no requiere tocarla; confirmado. El plan suponía `dryAdmin` en el cron (cierto) y que `ESTADOS_NO_TRANSITO` solo lo usaba Kommo (cierto): se borró y se usa `INACTIVE_STATUSES`.

## VALIDACIÓN

Todo en este worktree y esta rama. Sin `pnpm verify`, sin vitest sin filtro y sin Docker (otra corrida pesada podía estar en curso).

| Comprobación | Alcance | Resultado |
|---|---|---|
| Contrato 0492 en PGlite (script del scratchpad) | `supabase/tests/0492_client_outstanding.test.sql` | PASÓ: `TEST 0492 GREEN: 35 aserciones`. Control rojo (`apply_fix=false`): `ERROR: TEST 0492: existe public.client_outstanding(uuid[])` |
| `vitest run lib/studio/__tests__/client-outstanding.migration.test.ts` | contrato, control rojo, 18 mutantes SQL, espera y huellas, anti-deriva de estados y de permiso, paridad | PASÓ: `Test Files  1 passed (1)`, `Tests  25 passed (25)` |
| Mutantes SQL (dentro de la prueba de migración) | 18, uno por regla: borrador y anulada en la lista, sin piso, sin historial, sin recursión, `current_date`, sin `deleted_at` de factura y de recibo, sin `confirmado`, último pago solo de las que cuentan, igualdad exacta, sin tenant en facturas y en la ficha, sin el filtro de borradas, sin la rama admin/accounting, sin el autorizador, sin `service_role`, sin el tope de 1000 | los 18 MUERTOS, cada uno en la aserción de su regla |
| `vitest run` de las 41 pruebas tocadas o vecinas + `check-migrations-applied.test.mjs`, `check-pending-migration-symbols.test.mjs`, `lib/studio/reports`, `lib/studio/direccion`, `app/api/studio/operativo` | después de fusionar `origin/main` | PASÓ: `Test Files  49 passed (49)`, `Tests  847 passed (847)` |
| Mutantes TS (`scratchpad/s0558/mutantes.cjs`, uno por vez, restaura en `finally`; cuenta solo exit 1 con «Tests … failed») | 34 | los **34 MUERTOS** (lista abajo). `git status` limpio después de cada tanda. La primera tanda dio 5 «VIVO · exit 255 · (sin línea Tests)»: era el shell sin comillas en las rutas con `(app)`; con las rutas entre comillas, los 5 murieron |
| `corepack pnpm typecheck` | repo completo | PASÓ (exit 0) |
| `eslint --max-warnings=0` | los 35 archivos `.ts/.tsx/.mjs` tocados | PASÓ (exit 0) |
| `node scripts/check-rsc-boundary.mjs` | app y lib | PASÓ: `sin cruces server→client de valores ni client→node: transitivos` |
| `node scripts/check-pending-migration-symbols.mjs` | final, con la declaración escrita al final | PASÓ: `0 ROJO · 1 AMARILLO declarado(s)` (antes de declarar: `1 ROJO`, `lib/studio/client-queries.ts:756`) |
| `node scripts/migrations-lock.mjs verificar` | candado | PASÓ: `483 selladas (la mayor: 0491) · 3 espera(s) sin sellar (0422_payment_report_command_boundary, 0423_payment_report_historical_identity, 0492_client_outstanding) · 0 nueva(s) sin sellar · historia comparada contra 4728a8ca9dc9`. **No se tocó `supabase/migrations.lock.json`** |
| `node --test scripts/tests/migrations-lock.node.mjs` | pruebas del candado | PASÓ: `tests 22`, `pass 22`, `fail 0` |
| `node scripts/build-docs-index.mjs` + `corepack pnpm docs:check` | índice | PASÓ: `índice sincronizado con 548 specs` |
| `corepack pnpm sdd:check` | numeración | PASÓ: `numbering: sin números repetidos` (avisa los choques históricos conocidos) |
| `corepack pnpm governance:check` | cápsula | PASÓ: `28 política(s) aprobada(s) · cápsula vigente` |
| `corepack pnpm components:check` | CMP-01 | PASÓ: `CMP-01 válido: 5 fuente(s), agregado reproducible y cero rutas rotas` |
| `git diff --check bb6bb3e4` | diff de la tarea | PASÓ |
| Criterio 1 de la spec | `git grep -n "total_amount" -- lib/studio/kommo-contact-status.ts lib/studio/conversaciones/conversations-queries.ts` | PASÓ: sin coincidencias (exit 1 de grep) |
| `corepack pnpm verify` | completo, sobre `81c66d90`, con el turno que dio el Director; de 2026-10-19 13:36:49Z a 14:00:33Z; Docker encendido; sin otra corrida en paralelo (la Worker solo editaba la 0562) | exit 0, **16 de 17 pasos medidos y en verde**: `harness`, `lint`, `rsc-boundary`, `typecheck`, `edge-functions`, `test` (`Test Files  840 passed | 1 skipped (841)`, `Tests  11947 passed | 1 skipped (11948)`), `docs:check`, `numbering`, `feature-constants`, `components:check`, `governance:check`, `pending-migration-symbols` (`0 ROJO · 1 AMARILLO declarado(s)`: la 0492, con su evidencia en `client-queries.ts:832`, `conversations-queries.ts:365` y `kommo-contact-status.ts:250`), `sql-tests` (incluye `✓ 0492_client_outstanding.test.sql` en PostgreSQL con Docker), `schema-rebuild`, `e2e` (176 passed, 20 skipped, 2 flaky) y `build`. **NO MEDIDO: `migrations-applied`** (sin `.env.local`, a propósito). Las 2 inestables son ajenas al diff y pasaron al reintento: `e2e/auth.spec.ts:81` (la misma de siempre) y `e2e/smoke.spec.ts:97` (redirecciones de la calculadora pública). El registro quedó guardado (`verify-0558.log`) |
| `.test.sql` con Docker (`sql-tests`) | contrato 0492 en PostgreSQL 17 | **NO EJECUTADO**: Docker es corrida pesada; va en el verify |
| `migrations-applied` | ledger de producción | **NO DISPONIBLE** en el worktree (sin `.env.local`, a propósito) |
| Navegador | ficha, panel y estado de cuenta | **NO EJECUTADO**: sin la 0492 en una base de prueba la cabecera solo muestra el error. Va en el smoke posterior |

### Los 34 mutantes TS

1. `buildReceivablesQueue` vuelve a saltar solo la anulada: MUERTO · exit 1 · `Tests  1 failed | 44 passed (45)`
2. lo mismo, contra la paridad en PGlite: MUERTO · exit 1 · `Tests  1 failed | 22 skipped (23)`
3. `receivablesQueue` vuelve a `neq anulada`: MUERTO · exit 1 · `Tests  2 failed | 9 passed (11)`
4. `receivablesQueue` con «hoy» en UTC: MUERTO · exit 1 · `Tests  1 failed | 10 passed (11)`
5. la pantalla de Cobranzas con «hoy» en UTC: MUERTO · exit 1 · `Tests  1 failed | 1 passed (2)`
6. la vista previa de recordatorios con «hoy» en UTC: MUERTO · exit 1 · `Tests  1 failed | 1 passed (2)`
7. Kommo cuenta lo entregado como tránsito: MUERTO · exit 1 · `Tests  2 failed | 17 passed (19)`
8. Kommo atribuye el tránsito solo por el código vigente: MUERTO · exit 1 · `Tests  1 failed | 18 passed (19)`
9. `soloLecturaKommo` neutraliza toda RPC (el `dryAdmin` viejo): MUERTO · exit 1 · `Tests  1 failed | 18 passed (19)`
10. Kommo con la fila semilla como saldo: MUERTO · exit 1 · `Tests  3 failed | 16 passed (19)`
11. la lectura del saldo se traga el error (Kommo escribiría «No»): MUERTO · exit 1 · `Tests  1 failed | 30 passed (31)`
12. la ruta del hilo pasa el id del hilo como cliente: MUERTO · exit 1 · `Tests  1 failed | 8 passed (9)`
13. Conversaciones sin la caída a la fachada de 0412: MUERTO · exit 1 · `Tests  1 failed | 8 passed (9)`
14. Conversaciones publica 0 cuando el saldo falla: MUERTO · exit 1 · `Tests  2 failed | 7 passed (9)`
15. el panel enlaza otra vez a Cobranzas: MUERTO · exit 1 · `Tests  1 failed | 2 passed (3)`
16. el panel muestra solo la primera moneda: MUERTO · exit 1 · `Tests  1 failed | 2 passed (3)`
17. «Estado de cuenta» se pinta siempre: MUERTO · exit 1 · `Tests  1 failed | 1 passed (2)`
18. `puedeVerEstadoDeCuenta` mira clients en vez de invoices: MUERTO · exit 1 · `Tests  1 failed | 32 passed (33)`
19. `puedeVerSaldoCliente` sin la rama accounting: MUERTO · exit 1 · `Tests  1 failed | 32 passed (33)`
20. lo mismo, contra la anti-deriva del permiso en PGlite: MUERTO · exit 1 · `Tests  1 failed | 22 skipped (23)`
21. `resumirCuentaCliente` sin ordenar las monedas: MUERTO · exit 1 · `Tests  1 failed | 32 passed (33)`
22. los días vencidos contra el reloj: MUERTO · exit 1 · `Tests  1 failed | 32 passed (33)`
23. coerce acepta NaN y negativos: MUERTO · exit 1 · `Tests  2 failed | 31 passed (33)`
24. `fechaCorta` con `Date`: MUERTO · exit 1 · `Tests  2 failed | 31 passed (33)`
25. embarques en curso sin el filtro de borrados: MUERTO · exit 1 · `Tests  1 failed | 32 passed (33)`
26. un 42501 de la ficha se muestra como error: MUERTO · exit 1 · `Tests  1 failed | 32 passed (33)`
27. la cabecera toma el tramo de la primera moneda: MUERTO · exit 1 · `Tests  1 failed | 10 passed (11)`
28. «Al día» del saldo con borde vino: MUERTO · exit 1 · `Tests  1 failed | 10 passed (11)`
29. la cabecera sin permiso pinta el saldo: MUERTO · exit 1 · `Tests  1 failed | 10 passed (11)`
30. la nota de diferencia sale a todos: MUERTO · exit 1 · `Tests  1 failed | 10 passed (11)`
31. `filasParaLedger` vuelve a descartar las anuladas: MUERTO · exit 1 · `Tests  3 failed | 5 passed (8)`
32. `filasParaLedger` conserva la anulada sin emitir: MUERTO · exit 1 · `Tests  1 failed | 7 passed (8)`
33. la pantalla sin las notas del portal: MUERTO · exit 1 · `Tests  2 failed | 1 passed (3)`
34. el PDF del Studio sin razón social ni RIF: MUERTO · exit 1 · `Tests  1 failed | 2 passed (3)`

Los mutantes 15, 16, 27 a 30 y 33 se volvieron a correr después de los ajustes del `/ui-check` (`ba9968c3`), con el mismo resultado.

## /ui-check · cabecera, panel de Conversaciones y notas del estado de cuenta

Rúbrica de `.claude/commands/ui-check.md` sobre `ClientAccountHeader.tsx`, `SaldoPendienteContexto.tsx` y la nota de `estado-de-cuenta/page.tsx`.

Hallazgos (4, todos corregidos en `ba9968c3`):

1. ⭐ [alta] `ClientAccountHeader.tsx` — la grilla en `minmax(200px, 1fr)` cortaba montos largos: `KpiCard` tiene `overflow: hidden` y su valor va a 900 30px. **Medido** con Chromium y `lib/font-files/sora-latin-wght.woff2` (900 30px, tabular-nums, −0.02em): «1,234,567.89» 201 px, «12,345,678.90» 220 px, «VES 1,234,567.89» 264 px, «USDT 123,456.78» 261 px, «USD 12,345.00» 224 px, «28 sep 2026» 185 px. Con los 40 px de relleno, la grilla pasa a `minmax(260px, 1fr)`: la cifra de 8 dígitos cabe sola en su renglón con la moneda en el de arriba. En el panel de Conversaciones, «VES 12,345,678.90» a 800 16px mide 157 px y cabe.
2. [media] `ClientAccountHeader.tsx` y `estado-de-cuenta/page.tsx` — borde izquierdo de 3 px como acento (AI slop según la rúbrica). Pasan al patrón de aviso que ya usa la página (`--warning-bg` con borde `--warning`).
3. [baja] espaciados en px sueltos → `var(--s-*)`.
4. [baja] copy: tuteo sin voseo («Recarga la página…», «avísale a soporte…», «Ábrelo en la ficha»), sentence case; una prueba afirma que no aparece voseo.

Contraste medido (WCAG, fórmula de luminancia relativa, contra el color más claro del fondo):

| Texto | Claro | Oscuro |
|---|---|---|
| Vencido, `--danger` sobre la tarjeta | 6.31:1 | 4.47:1 sobre el tope del degradado (#193056) y 5.07:1 abajo; es texto grande (30 px, 900), umbral 3:1 → cumple |
| Valor, `--ink` sobre la tarjeta | 15.80:1 | 11.54:1 |
| Rótulo y línea, `--ink-soft` sobre la tarjeta | 5.11:1 | 6.05:1 |
| Notas, `--ink-soft` sobre `--bg-base` | 5.11:1 | 8.45:1 |
| Aviso de error y nota del estado de cuenta, `--ink` sobre `--warning-bg` | 14.05:1 | 12.71:1 |
| Panel: saldo `--danger` sobre `--bg-surface` | 6.58:1 | 5.07:1 |
| Panel: enlace `--ink-soft` sobre `--bg-surface` | 5.33:1 | 6.86:1 |

Lo que está bien: solo tokens `var(--*)`; reutiliza `KpiCard`; el vencido no depende del color (rótulo y monto); «Al día» sin el borde vino; `section` con nombre accesible y aviso `role="status"`; sin botones nuevos. Veredicto: OK para commit.

## revisar-datos-ve · la cabecera y los consumidores

Checklist de `.claude/skills/revisar-datos-ve/SKILL.md` sobre el cambio. No es asesoría legal.

Inventario del cambio (no hay columnas ni tablas nuevas):

| Dato | Qué es | Finalidad | Quién más lo ve ahora |
|---|---|---|---|
| saldo abierto y vencido por moneda | agregado financiero del cliente (persona natural o empresa) | cobrar a tiempo (decisión 14) | comercial, operaciones y soporte de CUALQUIER cliente del tenant; antes solo finanzas, y la moneda dominante desde un hilo (0412) |
| fecha del último pago | solo la fecha, sin monto ni medio | idem | idem |
| códigos anteriores o fusionados | Shipping Marks retirados (0367) y de fichas fusionadas (0341) | explicar qué suma la cabecera | los mismos roles; el historial ya se veía en el chip de la ficha (0367, SELECT por tenant) |
| «Tiene saldo pendiente: Sí/No» en Kommo | booleano | escalar a un humano (SDD-0256) | Kommo, como hoy |

| Punto | Estado | Evidencia |
|---|---|---|
| 1 · Inventario | CORRECTO | la 0492 devuelve solo agregados: `supabase/migrations/0492_client_outstanding.sql` (RETURNS TABLE, sin ids ni códigos de factura) |
| 2 · Minimización | CORRECTO, con la ampliación declarada | la ampliación a roles no financieros es la decisión 14 de Sam, citada en la spec; el detalle de facturas sigue bajo `invoices` (`puedeVerEstadoDeCuenta`, `lib/studio/client-account.ts`) y el botón «Estado de cuenta» no se pinta sin él (`ClientDetailClient.tsx`) |
| 2 · Códigos anteriores o fusionados visibles | CORRECTO | solo códigos, sin nombres ni datos de la ficha fusionada (`ClientAccountHeader.tsx`, nota «Incluye los códigos…») |
| 8 · Terceros (Kommo) | CORRECTO | el payload no cambia: `buildContactStatusPayload` sigue escribiendo Sí/No (`lib/studio/kommo-contact-status.ts`); el correo de Kommo y los campos no cambian |
| 10 · Decisiones automatizadas | ENCONTRADO (sin cambio de forma) | el agente de IA de Kommo actúa con el Sí/No; ahora el Sí también cuenta facturas de códigos retirados o fusionados y ya no se compensa con un sobrepago de otra factura. Es más exacto, pero sigue sin registro de qué factores produjeron el Sí (como antes) |
| Registros y logs | CORRECTO | el log de la ficha lleva una referencia y el mensaje de PostgREST, sin datos del cliente (`client-queries.ts`, `[saldo-cliente] ref=…`) |
| PDF con razón social y RIF | CORRECTO | son del EMISOR (DTD, persona jurídica), no del cliente; excepción de marca de Sam del 2026-10-18 |
| Comportamiento contra una base real | NO VERIFICABLE | no se ejecutó contra ninguna base real; queda en el smoke posterior |

## PEDIDO DE OK NOMINAL PARA SAM (lo hace el Director)

**Qué se pide:** «OK para aplicar **0492_client_outstanding** a producción».

**Qué hace:** crea una sola función de lectura, `public.client_outstanding(uuid[])`, que da el saldo de un cliente por moneda (abierto, vencido, último pago y sus códigos). No cambia datos, tablas ni permisos de tablas; la deja usar a quien ve clientes (tu decisión 14) y al job de Kommo. La app que la usa es la de esta PR: hasta que la 0492 esté aplicada, la PR no se fusiona.

**Antes de aplicar, el Director mide en producción (solo catálogo, sin filas de negocio):**

```sql
-- 1. Las cuatro huellas que exige el preflight.
select p.oid::regprocedure as funcion,
       md5(replace(p.prosrc, E'\r\n', E'\n')) as md5,
       md5(regexp_replace(p.prosrc, '\s', '', 'g')) as md5_sin_espacios,
       p.prosecdef, p.provolatile, p.proconfig
from pg_proc p
where p.oid in ('public.get_user_tenant_id()'::regprocedure,
                'public.current_studio_role()'::regprocedure,
                'public.document_entity_authorized(text,uuid,text)'::regprocedure,
                'public.document_entity_module_contract(text)'::regprocedure);
-- Esperado: 5ff0c51c… (o 4ce5acd0… sin espacios), t, s, {search_path=""};
--           b7157932… (o df8ba522…), t, s, {search_path=public};
--           4eb9fd08…, t, s, {search_path=""};  9c78c98f…, f, i, {search_path=""}.

-- 2. Que la función no exista todavía.
select to_regprocedure('public.client_outstanding(uuid[])');   -- null

-- 3. Que la función, owner postgres, lea las tablas: dueño y RLS forzada.
select c.relname, pg_get_userbyid(c.relowner) as owner, c.relforcerowsecurity
from pg_class c
where c.oid in ('public.clients'::regclass, 'public.client_markbox_history'::regclass,
                'public.invoices'::regclass, 'public.payment_receipts'::regclass,
                'public.payment_reports'::regclass);
-- Esperado: owner postgres y relforcerowsecurity = f en las cinco (si no, la
-- función DEFINER no vería filas y la cabecera diría 0).
```

Si una huella difiere, la 0492 aborta sola sin cambiar nada; aun así conviene no lanzarla hasta entender el cambio. Opcional, solo con autorización de Sam para la radiografía de la SDD-0559 (conteos, sin montos): cuántos borradores con total > 0 hay, porque dejan de contar en Cobranzas, Dirección y el aging.

**Cómo se aplica:** `infra/ops/migraciones/` según `docs/runbooks/aplicar-migraciones-prod.md`, con name exacto `0492_client_outstanding`. Después, `retirar-espera.mjs --md5` la saca de `pendingBelowCutoff` y de las declaraciones de símbolos y la sella en el candado.

**Smoke posterior (antes de fusionar la PR, con la app de la PR en un entorno de prueba o justo después del despliegue):**

1. Ficha de un cliente con facturas, con un usuario **comercial**: se ven las cuatro tarjetas y NO el botón «Estado de cuenta».
2. La misma ficha con **contabilidad**: las cuatro tarjetas y el botón; en un cliente con una ficha fusionada o un código retirado, la nota «Incluye los códigos anteriores o fusionados…» y la de diferencia con el estado de cuenta.
3. Estado de cuenta de un cliente con una anulada con abono: la anulada en el libro con cargo 0 y la nota «Lo que el cliente ve en su portal y en el PDF»; el PDF con razón social y RIF bajo el membrete.
4. Conversaciones: un hilo con comercial muestra el saldo por moneda y «Ver en la ficha →».
5. `GET /api/cron/kommo-contact-status?dry=1` con `CRON_SECRET`: `ok: true`, ningún tenant con `inerte` que empiece por «saldo:», `encoladas: 0`.
6. Cobranzas: la cola no lista borradores.

## Impacto documental y conocimiento

- Documentos canónicos actualizados: la spec 0558 y `docs/specs/README.md` (índice regenerado).
- `knowledge:status`: exit 0, modo `integrated`, `ok: false` por el estado estructural y los enlaces faltantes ya conocidos (0483); nada nuevo de esta tarea. Cambia la forma del dominio (función SQL nueva, módulo `client-account.ts`, componente de la ficha): Graphify y Archify los recoge el Director desde main integrado. Obsidian: sin cambios.

## PENDIENTES DE ESTA TAREA

1. Push de la rama y PR en **borrador** (no autorizados en este encargo).
2. Hecho: `pnpm verify` con turno del Director, con el contrato 0492 en PostgreSQL con Docker y `schema-rebuild` en verde (ver VALIDACIÓN).
3. OK nominal de Sam y aplicación de la 0492 por el Director (ver arriba), smoke, y recién entonces la fusión.
4. Al aplicar: `retirar-espera.mjs`, y actualizar la prueba «la 0492 espera en pendingBelowCutoff» de `client-outstanding.migration.test.ts`, que la afirma.

## FUERA DE ALCANCE DETECTADO

1. **`computeClientStats`** (`lib/studio/shipment-queries.ts`) cuenta los borradores como envíos activos; otra definición de «en curso».
2. **Más definiciones de «embarque en curso»:** `INACTIVE_STATUSES` del dashboard (`lib/studio/dashboard/dashboard-widget-queries.ts:17`, un `Set` propio), `TERMINAL_SHIPMENT_STATUSES` de Conversaciones (con `arrived_destination` y sin `draft`, `conversations-queries.ts`) y Embarques (`EmbarquesClient.tsx`, carpeta vedada).
3. **«Hoy» en UTC** en `isOverdue` (`lib/studio/invoice-types.ts`, default), en `agingReport` (`lib/studio/reports/queries.ts`) y en Dirección (`lib/studio/direccion/queries.ts`), que pasan su propio `today` a la cola.
4. **Dos helpers de la fecha de Caracas:** `todayCaracasISO` (`lib/studio/bitacora/dates.ts`) y `hoyCaracas` (`lib/studio/rate-types.ts:89`).
5. **Tres copias de la misma lista de estados:** `ESTADOS_FACTURA_CON_SALDO` (esta SDD), `SALE_STATUSES` (`lib/studio/fiscal/queries.ts:193`) y `ESTADOS_DE_INGRESO` (`lib/studio/accounting/ingreso-periodo.ts:69`). Una prueba anti-deriva las ata; conviene unificarlas.
6. **El KPI «Vencido» de Cobranzas** excluye las promesas vigentes (SDD-0041) y no es la misma cifra que el vencido por fecha de la cabecera y del aging.
7. **`invoices.last_payment_at`** no se revierte al anular un recibo (0467) y lo escribe también el crédito de referido (0471): por eso es solo respaldo del «Último pago».
8. **El botón «Etiquetas»** de la ficha se pinta sin mirar el módulo `labels` (`ClientDetailClient.tsx`).
9. **`invoiceKpis` y `financeInvoiceKpis`** mezclan monedas y vencen en UTC (tabla de la spec; destino SDD-0557 o fase 5).
10. **Retirar la fachada `conversation_client_outstanding` (0412)**, con su propia migración, cuando ningún rol la necesite como respaldo.
11. **El estado de cuenta** multimoneda, por todos los códigos y sin tope de 200 (fase 5.2), que cierra la divergencia del criterio 10.
