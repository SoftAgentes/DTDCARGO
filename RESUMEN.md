# SDD-0111 · Scorecard de proveedores — lane FIEL (f1)

Rama `feat/scorecard-f1`. Gate `node scripts/verify.mjs` → **TODO VERDE**
(lint · rsc-boundary · typecheck · test · docs:check · e2e). El e2e cayó flaky
en el 1er intento y pasó en el retry (warmup del dev server, no regresión).

## Qué implementé, por slice

### Slice A — señales + scorecard (rating derivado por ficha)
- **Migración `supabase/migrations/0236_supplier_scorecard.sql`** (TODO el DDL acá):
  - Tabla `supplier_order_signals` (una fila por OC recibida / señal manual):
    `on_time` + `conforming` booleanos atómicos, `expected_at`/`received_at`
    opcionales para auditar, índice único parcial `(tenant_id, purchase_order_id)`.
  - **VIEW `supplier_scorecard_v`** con `security_invoker = on` (RLS del usuario
    aplica): score + grade A/B/C/D **por FICHA** de `suppliers_cn`, calculada en
    vivo desde señales + reclamos. `grade NULL` cuando `orders_count = 0`
    ("Sin datos", evita el 'D' por división por cero).
  - Helpers `supplier_cn_in_tenant()` + `purchase_order_in_tenant()` (NULL-safe)
    + triggers same-tenant + GRANTS explícitos (antes de policy) + RLS por tenant
    + FK indexes.
- `lib/studio/proveedores/scorecard-types.ts`: `computeScore`/`computeGrade`/
  `computeScorecard`/`gradeBadgeTone` (fórmula **espejo exacto** de la VIEW),
  `validateOrderSignalInput` manual (sin Zod).
- `lib/studio/proveedores/scorecard-queries.ts`: `listSupplierScorecards`,
  `getSupplierScorecard`, `supplierScorecardStats` (KPIs). Degradan a vacío si la
  migración aún no está aplicada (42P01) para no tumbar la página del módulo.
- UI: **tab "Scorecard"** (KPIs + tabla rankeada por grade + detalle con barras
  de puntualidad/calidad/rechazo + captura de señal de recepción).

### Slice B — reclamo al proveedor
- En el MISMO 0236: enums `supplier_claim_kind` (`dano|faltante|calidad|retraso|otro`)
  + `supplier_claim_status` (`abierto|en_revision|resuelto|rechazado`), tabla
  `supplier_claims` (soft delete, `amount_usd` advisory, `offset_id` FK suave sin
  constraint), **RPC `next_supplier_claim_code`** (`RP-YYYY-NNN`, `assert_tenant_match`,
  revoke public/anon), trigger same-tenant + sellado de `resolved_at`.
- Types: máquina de estados (`nextSupplierClaimStatuses`/`canTransitionSupplierClaim`),
  labels/tonos, `validateSupplierClaimInput` manual.
- Queries: `listSupplierClaims` (join nombre proveedor + código OC).
- UI: **tab "Reclamos"** (tabla + `SupplierClaimDrawer` sobre `DrawerShell` con
  stepper de estado + `ActionButton` para avanzar).

### Server actions (`app/studio/(app)/proveedores/scorecard-actions.ts`)
`createOrderSignalAction`, `createSupplierClaimAction`, `updateSupplierClaimAction`,
`advanceSupplierClaimAction` — todas `"use server"` + `moduleEditDenial(supabase,
"suppliers")` llamado de verdad + validación manual + tenant desde `user_tenants`
+ `revalidatePath`. El avance de estado usa update condicional por estado actual
(anti-carrera).

## Decisiones §6 tomadas
- **§6.4 (founder): scorecard POR FICHA** de `suppliers_cn` — la VIEW recorre
  cada fila `suppliers_cn` viva; NO consolida por identidad. Sin maestro de
  proveedores.
- **§6.5 (founder): VISTA EN VIVO** `supplier_scorecard_v` como fuente de verdad.
  Sin tabla snapshot, sin cron.
- **§6.2 (default más simple): default optimista** — `on_time`/`conforming`
  arrancan `true`; el operador los baja al capturar la señal.
- **§6.3: booleano juzgado por el operador**; `expected_at`/`received_at` quedan
  opcionales para auditar. NO se toca 0124.
- **§6.6: `last_grade` NO** (con la VIEW sobra).
- **§6.7/§6.8: pesos y umbrales del Norte tal cual** (on-time 40% · calidad 40% ·
  rechazo 20%; A≥90 B≥82 C≥72 D<72).
- **§6.10: `amount_usd` advisory** (no genera asiento en V1).
- `defect_pct` cuenta los reclamos **vivos** (no borrados, cualquier estado),
  literal al §3 del spec.

## Fórmula (un solo lugar lógico, dos archivos físicos: TS + SQL)
```
score = round(on_time% * 0.40 + calidad% * 0.40 + max(0, 100 - defecto% * 6) * 0.20)
grade = score>=90 A · >=82 B · >=72 C · else D   (orders_count=0 → null "Sin datos")
```
Los tests verifican paridad con la fórmula del Norte sobre los 5 proveedores del
mock: **s1=94/A · s2=94/A · s3=87/B · s4=90/A · s5=79/C**. Nota: el brief pedía
"s5=D", pero por la propia fórmula del Norte s5 (78/85/5.4) da 79 → **C** (es el
peor del mock, pero no cae en D). El test refleja la fórmula canónica, no un
valor forzado.

## Nota de módulo RBAC
El brief menciona `moduleEditDenial(supabase,"proveedores")`. El id real del
módulo que posee `/studio/proveedores` es **`"suppliers"`** (lib/studio/modules.ts,
mismo id que usa `requireModuleView` y el `actions.ts` existente). Usé `"suppliers"`
— pasar un id inexistente denegaría a todos los no-admin (canEditModule fail-closed).

## Archivos
- `supabase/migrations/0236_supplier_scorecard.sql` (nuevo)
- `lib/studio/proveedores/scorecard-types.ts` (nuevo)
- `lib/studio/proveedores/scorecard-queries.ts` (nuevo)
- `lib/studio/__tests__/scorecard-types.test.ts` (nuevo · 22 tests)
- `app/studio/(app)/proveedores/scorecard-actions.ts` (nuevo)
- `app/studio/(app)/proveedores/_components/ScorecardTab.tsx` (nuevo)
- `app/studio/(app)/proveedores/_components/ReclamosTab.tsx` (nuevo)
- `app/studio/(app)/proveedores/_components/SupplierClaimDrawer.tsx` (nuevo)
- `app/studio/(app)/proveedores/_components/ProveedoresClient.tsx` (2 tabs + props)
- `app/studio/(app)/proveedores/page.tsx` (fetch scorecards + claims)

## Cómo lo verifiqué
`node scripts/verify.mjs` → verde. Además: typecheck limpio, 22 tests de la
fórmula/validadores/máquina de estados verdes, lint sin errores (0 en archivos
nuevos), rsc-boundary OK. La migración **NO se aplicó** a prod.
