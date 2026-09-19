# Handoff 0489 — Pagos a proveedores atómicos en Tesorería

- Fecha: 2026-09-19. Estado de la tarea: **en progreso**. La implementación y
  las pruebas de archivos sueltos están listas. Falta el verify completo, que
  necesita turno del Director, además del reporte, el push y la PR.
- Owner / sesión: `worker-carrera-pago-proveedor-opus5-20260919` (Claude Opus 5,
  Worker, sesión «Hacer atómico el registro de cobros en facturas», que retoma
  por asignación del Director «Director notificación a workers»).
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/carrera-pago-proveedor`.
- Rama: `codex/carrera-pago-proveedor`, desde `origin/main` = `d624ea45`.
- Aislamiento: `harness-worktree start carrera-pago-proveedor`, `claim` y
  `guard` → `Guard OK` antes de editar.
- SDD: [0489](../../docs/specs/0489-carrera-pago-proveedor/spec.md). Reserva
  local con `node scripts/next-number.mjs --reserve carrera-pago-proveedor`
  (`d1d74e2c`, rama `codex/sdd-reserve-0489-carrera-pago-proveedor`, sin
  publicar y sin tocar main), traída por cherry-pick como `37ab5b0b`. El
  inventario confirmó spec siguiente 0489 y migración siguiente **0468**, los
  números que asignó el Director.
- Permisos del encargo:
  - commits en esta rama; un solo push y reporte al Director antes de abrir la
    PR; **no merge**;
  - la 0468 **no se aplica**: queda en `pendingBelowCutoff` con los símbolos
    declarados (gate amarillo) hasta el OK nominal de Sam, según el runbook;
  - de producción, sólo lectura de catálogo;
  - verify completo, vitest completo o la suite SQL, con turno del Director;
    archivos sueltos, libres;
  - el cierre de la 0488 (smoke de Sam) va aparte y no se mezcla con esta rama.

## Objetivo

Fuera de alcance nº 3 de la 0488: la carrera de Tesorería sobre
`supplier_bills.paid_amount` en `lib/studio/treasury/treasury-actions.ts`.
Registrar y anular pagos leía la CxP sin lock y escribía `paid_amount` absoluto
en otro request, la misma pérdida de actualización que tenía Cobranzas.

Se sigue el precedente de la 0467, aprobado por Sam para Cobranzas: RPC atómicas
con la CxP `FOR UPDATE`, pago y anulación en una transacción, auditoría y los
mismos criterios de saldo. Hay que revisar la tolerancia de 0,01 de
`validatePaymentInput` (`lib/studio/treasury/types.ts:464`). Si aparece una
decisión nueva de verdad, se documenta como «pendiente de Sam», con una opción
recomendada. No hay rediseño de UI.

## Qué se hizo

- **Migración `supabase/migrations/0468_pago_proveedor_atomico.sql`**, aditiva:
  - `register_supplier_payment_order(uuid,numeric,uuid,text,date,text,text)`:
    rol accounting/admin, CxP `FOR UPDATE`, estados y saldo estricto, lock
    consultivo `(489, hashtext(tenant))`, `next_payment_order_code`, orden que
    hereda proveedor, moneda y `fx_rate` de la CxP, y `paid_amount` + `status`;
  - `void_supplier_payment_order(uuid,text)`: rol, orden `FOR UPDATE`, CxP
    `FOR UPDATE`, wrapper D2 de la 0294 con el motivo, baja del pagado sin
    revivir una CxP anulada, y devuelve el `journal_entry_id`;
  - las dos son INVOKER, con `search_path` vacío, owner `postgres` y EXECUTE
    sólo para `authenticated`. Traen preflight (tablas, 31 columnas con tipo,
    md5 de las tres dependencias, no existir antes) y postflight (forma y ACL).
- **App:**
  - `lib/studio/treasury/treasury-actions.ts` llama a las dos RPC y traduce
    los códigos (`PAYMENT_ORDER_REJECTIONS`);
  - `lib/studio/treasury/types.ts` aplica la regla estricta;
  - `voidBillFor` y `createBillFor` no cambian.
- **Pruebas:**
  - el contrato `supabase/tests/0468_pago_proveedor_atomico.test.sql`, con la
    0088 real y sin cascarones;
  - el runner de PGlite `lib/studio/__tests__/pago-proveedor-atomico.migration.test.ts`;
  - la carrera `supabase/tests/0468_pago_proveedor_carrera.test.sql`;
  - `lib/studio/treasury/__tests__/treasury-payments.test.ts` (nuevo);
  - la prueba del centavo en `treasury.test.ts`.
- **Espera y gate:**
  - la entrada `0468_pago_proveedor_atomico` en `supabase/migrations-baseline.json`;
  - la declaración `sdd-0489-pago-proveedor-atomico` en
    `supabase/pending-migration-symbol-declarations.json`, con sitios `:318` y
    `:378` y evidencia `:329` y `:384` de `treasury-actions.ts`. **Si cambian
    esas líneas hay que actualizar la declaración**: el gate la valida contra el
    árbol.
- **Spec 0489** completa e índice `docs/specs/README.md` regenerado.

## Decisiones

- **Del Director:** diseño de la 0467, migrate-first, PR con la espera y los
  símbolos declarados (AMARILLO), sin aplicar. No integra hasta el OK nominal de
  Sam para la 0468.
- **Pendiente de Sam: regla de saldo en Tesorería.** Implementé la estricta de
  Cobranzas (recomendada), que es la que ya aplica la pantalla
  (`BillDrawer.tsx:396`). La otra opción es conservar la tolerancia de 0,01
  sólo en Tesorería. **Se decide antes de aplicar la 0468**, porque la regla
  queda en la función. La pregunta y las consecuencias de cada opción están en
  la spec, en «Pendiente de Sam».
- **Una CxP anulada** conserva su estado al anular una orden y sólo baja el
  pagado, como en la 0467. La app vieja no la tocaba. Sólo pasa con datos que
  dejó la carrera vieja: la 0294 anula únicamente con `paid_amount = 0`.
- **Estados rechazados al pagar:** los de la app, `anulada` y `pagada`, más una
  CxP borrada, como en la 0467. No se restringió a `pendiente`/`parcial`, porque
  `status` no tiene CHECK y no leí filas para saber qué valores existen.

## Identidad de la 0468

| Dato | Valor |
|---|---|
| md5 del archivo | `83e8bc9873cbaf8c19329e895f4cbc06` |
| Bytes | 18871, LF (0 CR) |
| Blob git | `d2bba2a2119353c5f579dc5dd3434d65f5649ed1` |
| `md5(prosrc)` tras aplicar (postgres:17 local) | `register_supplier_payment_order` `65d6c9a18b58a0dabafd6de0b03af325` · `void_supplier_payment_order` `79f53ed98b142d87495feccadc7da9cf` |

**Catálogo de producción, sólo lectura, 2026-09-19 a las 19:30 UTC**, con el
conector de Supabase, proyecto `xpfuzqombmjmxvprjgmi`:

- `next_payment_order_code(uuid)`: DEFINER, text, `0e4812685509f756b3c47b117323307a`
  (sin espacios `00228ea7…`);
- `void_supplier_payment_with_audit_reason(uuid,text)`: INVOKER, boolean,
  `f06331df9d2c264d3dac7391f0cd0c12` (sin espacios `3488a63b…`);
- `get_user_tenant_id()`: DEFINER, uuid, `5ff0c51c26a49419c34abc78f1d95c37`
  (sin espacios `4ce5acd0…`);
- las 31 columnas del preflight: ninguna falta ni difiere;
- `register_supplier_payment_order` y `void_supplier_payment_order` no existen;
- ledger, las últimas cuatro: `20260919030533 0466_client_billing_identity`,
  `20260919021949 0467_cobro_factura_atomico`,
  `20260919011316 0462_portal_profile_direct_edit` y
  `20260919010007 0464_reporte_pago_factura_pagada`. La 0468 no está.

## Evidencia (archivos sueltos, sobre los archivos finales)

| Comprobación | Resultado | Cómo |
|---|---|---|
| Contrato con la 0468 | **PASÓ**: `TEST 0468 GREEN: 84 aserciones` | `postgres:17` desechable con `supabase` montado en `/sb:ro`; `psql -U postgres -q -v ON_ERROR_STOP=1 -f /sb/tests/0468_pago_proveedor_atomico.test.sql` |
| Contrato sin la 0468 (control rojo) | **FALLÓ como debe**, en la primera aserción: `existe public.register_supplier_payment_order(…)` | lo mismo con `-v apply_fix=false` |
| Contrato en PGlite | **PASÓ** 10/10: contrato, control rojo y 8 mutantes, cada uno en su aserción | `corepack pnpm exec vitest run lib/studio/__tests__/pago-proveedor-atomico.migration.test.ts --pool=forks --maxWorkers=1 --environment node` |
| Carrera con dblink | **PASÓ**: `TEST 0468 carrera OK: 38 aserciones`. Los 9 controles ANTES reproducen el daño y los 9 DESPUÉS se serializan | `psql … -f /sb/tests/0468_pago_proveedor_carrera.test.sql` en el mismo contenedor |
| Mutantes de la carrera (fuera del repo) | **4/4 caen** en DESPUÉS; el control pasa. Detalle abajo | copia de `supabase/tests` (los dos 0468) y `supabase/migrations` en una carpeta temporal, montada en `/sb`; la 0468 reemplazada por el mutante; `psql -f /sb/tests/0468_pago_proveedor_carrera.test.sql` |
| Locks de la 0468 | ningún lock de relación fuera del catálogo; sólo catálogo y los objetos de las dos funciones | fixture del contrato comprometido en una base propia, `begin; \ir 0468; select … from pg_locks …; rollback` |
| Pruebas unitarias de Tesorería | **PASÓ** 68/68 | `corepack pnpm exec vitest run lib/studio/treasury/__tests__/ --pool=forks --maxWorkers=1 --environment node` |
| Control rojo de las unitarias | **FALLAN 9** contra `treasury-actions.ts` y `types.ts` de `d624ea45`; se restauraron los archivos (sha1 igual) | `git show d624ea45:<archivo>` sobre el worktree, la misma corrida y restauración desde la copia |
| `check-pending-migration-symbols` | **PASÓ**: `0 ROJO · 1 AMARILLO declarado(s)` | `node scripts/check-pending-migration-symbols.mjs` |
| `pnpm typecheck` | **PASÓ** (exit 0) | `corepack pnpm typecheck` |
| eslint de lo tocado | **PASÓ** (exit 0) | `node node_modules/eslint/bin/eslint.js` sobre los 5 archivos TS |
| `docs:check`, `sdd:check`, `governance:check` | **PASÓ** | `corepack pnpm docs:index` y las tres |
| `rsc-boundary`, `feature-constants`, `components:check`, `edge-functions` | **PASÓ** | `node scripts/<check>.mjs` |
| `migrations-applied` | **NO EJECUTADO** (SKIP: el worktree no tiene `.env.local`) | el ledger se comprobó directo en producción, arriba |
| `pnpm verify` completo (lint total, vitest completo, `sql-tests`, `schema-rebuild`, e2e, build) | **NO EJECUTADO**: pido turno al Director | — |

**Carrera, escenario por escenario.** Sale de una copia fuera del repo que
agrega un NOTICE por escenario. Cada cifra es pagado/total; «órd.» es la suma
de las órdenes vigentes.

| # | S1 → S2 | ANTES | DESPUÉS |
|---|---|---|---|
| 1 | pago 300 → pago 200 | 300/1000, órd. 500 | 500/1000; S2 esperó (transactionid) |
| 2 | pago 600 → pago 600 | 600/1000, órd. 1200 | 600/1000; S2 `PAYMENT_EXCEEDS_BALANCE` |
| 3 | anulación de 400 → pago 300 | 0/1000 `pendiente`, órd. 300 | 300/1000 |
| 4 | pago 300 → anulación de 400 | 700/1000, órd. 300 | 300/1000 |
| 5 | anulación de 400 → anulación de 300 | 300/1000, órd. 0 | 0/1000 `pendiente` |
| 6 | pago → pago en otra CxP | S1 muere por `supplier_payments_tenant_id_payment_code_key` | OP-2026-0015 y OP-2026-0016; S2 esperó (advisory) |
| 7 | pago 300 → anulación de la CxP | anulada y revivida `parcial` 300/1000 | «La CxP ya no admite anulación.»; `parcial` 300/1000 |
| 8 | anulación de la CxP → pago 300 | anulada y revivida `parcial` 300/1000 | `PAYMENT_STATE`; `anulada` 0/1000 |
| 9 | asiento → anulación de la orden | la anulación entrega el asiento vacío | entrega el asiento guardado |

**Mutantes de la carrera.** Cada uno reemplaza un único texto de la 0468, que
aparece una sola vez:

- sin `for update;` después de `where b.id = p_bill_id and b.tenant_id = v_tenant`:
  fallan los escenarios 1, 2, 3 y 8;
- sin el de `where b.id = v_payment.bill_id and b.tenant_id = v_tenant`:
  fallan el 4 y el 5;
- sin el de `where sp.id = p_payment_id and sp.tenant_id = v_tenant`: falla
  el 9;
- sin la línea `perform pg_catalog.pg_advisory_xact_lock(489, …)`: falla el 6.

Ningún control ANTES quedó sin reproducir.

## Pendientes de esta tarea

1. Turno del Director para `pnpm verify` completo; registrar cada paso.
2. Volver a buscar colisiones de SDD 0489 y migración 0468 en las ramas remotas
   antes de la PR.
3. Reporte al Director, push único y PR. Sin merge.
4. Decisión de Sam sobre la regla de saldo de Tesorería, antes de aplicar.
5. Después de la PR, con autorización propia: OK nominal de Sam para la 0468 y
   aplicación por el Director según el runbook. Luego, el commit que retira la
   espera y la declaración, la integración y el smoke de Sam en Tesorería:
   registrar un pago parcial y otro que salde una CxP, y anular una orden de
   pago.

## FUERA DE ALCANCE DETECTADO

1. La RLS de `suppliers`, `supplier_bills` y `supplier_payments` sólo filtra por
   tenant (0088:266-282, con 0230). Cualquier miembro del tenant, también el rol
   comercial, puede escribir directo por PostgREST, incluidos `paid_amount` y
   `status`, que no tiene CHECK. Los wrappers `void_supplier_*_with_audit_reason`
   (0294) tampoco exigen rol.
2. `next_bill_code` y `next_supplier_code` (0088) calculan `max+1` sin lock.
   Dos CxP o dos proveedores creados a la vez en el mismo tenant sacan el mismo
   código, y el segundo muere por el unique.
3. Los generadores de la 0088 hacen `lpad(v_max::text, 4, '0')`, que trunca
   desde el 10000: la orden 10000 de un año saldría `OP-AAAA-1000` y chocaría.
4. El asiento del pago sigue fuera de la transacción (SDD-0044). Una anulación
   que llega entre el COMMIT de la RPC y el update de `journal_entry_id` no ve el
   asiento, que queda vivo para una orden anulada. El `FOR UPDATE` de la orden
   sólo cubre el update en curso. Cobranzas tiene la misma ventana con la 0467.

## Impacto documental

- Spec 0489 completa y `docs/specs/README.md` regenerado.
- No cambian runbooks ni reglas.
- Graphify y Obsidian: los publica el Director desde main integrado. Esta
  rama no los toca.
- La 0488 sigue esperando el smoke de Sam. Su cierre (criterio en la spec 0488 y
  handoff) va en una rama aparte, desde main.
