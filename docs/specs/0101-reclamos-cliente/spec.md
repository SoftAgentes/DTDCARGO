---
sdd: "0101"
title: "Reclamos y siniestros del cliente — gestión de incidencias de carga (daño / faltante / retraso)"
status: in-progress
author: "Claude Code (session context) + founder"
created: 2026-06-21
updated: 2026-06-21
supersedes: null
superseded_by: null
related: ["0059","0047","0042","0085","0049"]
confidencialidad: interno
---

# SDD-0101 — Reclamos y siniestros del cliente

> Módulo del Studio (**OPERACIÓN · POST-VENTA**) para gestionar las incidencias que el **cliente**
> reporta sobre su carga: **daño, faltante, retraso u otro**. Cada reclamo queda atado a la orden /
> Shipping Mark, sigue un flujo de evaluación → resolución, y registra si el embarque tenía **cobertura
> de seguro**. Implementa el handoff de diseño aprobado del Norte (`docs/design/studio/_norte/reclamos/reclamos.jsx`).

## 0. Por qué — y qué NO es

Hoy el ERP cierra el loop comercial y financiero, pero **no tiene dónde registrar un reclamo del
cliente**. Cuando una carga llega rota, incompleta o tarde, el reclamo se gestiona por WhatsApp y se
pierde la trazabilidad (monto expuesto, cobertura, estado, tiempo de resolución).

**Frontera dura con el lado proveedor (SDD-0059).** Esto **NO es** `supplier_claim_offsets`:

| | `supplier_claim_offsets` (SDD-0059) | `client_claims` (este SDD) |
|---|---|---|
| Sujeto | el **proveedor** chino nos reconoce un ajuste | el **cliente** nos reclama a nosotros |
| Naturaleza | cruce **contable** bilateral DTD↔socio | incidencia **operativa** post-venta |
| Máquina | reclamado → reconocido → pagado_en_china → aplicado_a_cliente → cerrado | reportado → evaluación → aprobado → pagado / resuelto / rechazado |
| Dinero | recupera plata del proveedor | indemnización al cliente (advisory en V1) |

Son entidades distintas. El **puente** entre ambas (cuando el daño es culpa del proveedor y se recupera
vía 0059) es **Slice C** — fuera de este alcance.

## 1. Alcance

### Slice A — núcleo interno (ESTE entregable)

1. Tabla `client_claims` (migración **0152**) — RLS por tenant (equipo), RPC correlativo `next_claim_code`
   (`RC-YYYY-NNN`), trigger de coherencia (cliente/embarque del mismo tenant).
2. `lib/studio/reclamos/{claims-types.ts, claims-queries.ts}` — enums, máquina de estados, KPIs y
   validadores **puros** (sin Zod, patrón del repo).
3. Módulo `/studio/reclamos` — KPIs + filtros + tabla + detalle inline con stepper de 3 fases + drawer
   crear/editar + avance de estado (máquina, con `ActionButton` + trazabilidad visual).
4. Registro en `lib/studio/modules.ts` (grupo OPERACIÓN) y `lib/studio/rbac.ts`.
5. Tests Vitest de los helpers puros (máquina, step, KPIs, validador).

### Slice B — Portal del cliente (ESTE entregable, apilado sobre A)

Migración **0153**: columna `source` (`studio | portal`), policy `SELECT` para el cliente del portal
(`get_portal_client_markbox()`) y `next_claim_code_service` (gemela de `next_claim_code` SIN
`assert_tenant_match`, solo `service_role` — patrón `next_markbox_service`, 0109). El cliente reporta
desde `/portal/reclamos` (tipo + descripción + envío opcional) y ve sus reclamos read-only con su estado y
fase. La creación va por la action del portal con **admin client** que CONTROLA los campos sensibles
(`amount_usd=0`, `insured=false`, `status='reportado'`, `source='portal'`) — el cliente no puede forjar una
indemnización ni saltar la evaluación; el embarque ajeno se ignora. El equipo gestiona el ciclo de vida (A).

### Fuera de alcance (slices futuros — declarados, no implementados)

- **Evidencia/fotos (B2):** el cliente adjunta fotos al reclamo (Storage RLS, `shipment_documents` o
  `documents` con `entity_type='claim'`). Diferido para no meter Storage RLS en esta tanda.
- **Slice C — Puente contable + aseguradora:** vínculo opcional a `supplier_claim_offsets` cuando el daño
  es culpa del proveedor; gestión con la aseguradora (certificado, deducible, avería gruesa — ver
  `legal/Brief-Seguro-Operador-ES-ZH.md`); el estado `pagado` crea asiento contable real y se gatea a
  `accounting` (hoy es advisory).
- Nacimiento automático del reclamo desde el despacho/excepción (hook de `shipments.status='exception'`).

## 2. Datos — `client_claims`

```
id                uuid pk
tenant_id         uuid not null → tenants (RLS)
claim_code        text not null         -- RC-YYYY-NNN (next_claim_code), unique(tenant_id, claim_code)
client_id         uuid → clients (on delete set null)
client_markbox    text                  -- snapshot (sobrevive borrado del cliente)
client_name       text                  -- snapshot
shipment_id       uuid → shipments (on delete set null)
shipment_code     text                  -- snapshot S-YYYY-NNNN
container_code    text                  -- DTDU-XXXXXX (texto libre)
claim_type        text not null check (dano|faltante|retraso|otro)
description       text not null
amount_usd        numeric(12,2) not null default 0   -- monto reclamado (retraso puede ser 0)
insured           boolean not null default false      -- ¿embarque cubierto por póliza?
status            text not null default 'reportado' check (reportado|evaluacion|aprobado|pagado|resuelto|rechazado)
resolution_note   text                  -- nota de resolución / motivo de rechazo
evaluated_at      timestamptz           -- hito: entró a evaluación
resolved_at       timestamptz           -- hito: terminal (pagado/resuelto/rechazado)
created_by        uuid → auth.users
created_at / updated_at / deleted_at
```

Denormalización de snapshots (`client_*`, `shipment_code`) = mismo patrón que `shipments` — el listado no
hace joins y los datos sobreviven a un soft-delete del cliente/embarque.

## 3. Máquina de estados (§4)

```
reportado  → evaluacion | rechazado
evaluacion → aprobado | rechazado
aprobado   → pagado | resuelto
pagado     → ∅   (terminal)
resuelto   → ∅   (terminal)
rechazado  → ∅   (terminal)
```

- **Stepper de 3 fases** (Reportado / Evaluación / Resolución), fiel al mock:
  `reportado→1`, `evaluacion|aprobado→2`, `pagado|resuelto|rechazado→3`.
- `evaluated_at` se sella al entrar a `evaluacion`; `resolved_at` al entrar a cualquier estado terminal.
- Transiciones validadas en `lib` (`canTransitionClaim`) y en la action (defensa). El avance dispara
  `ActionButton` + toast + highlight (regla de trazabilidad visual del Studio).

## 4. Seguridad

- RLS por `tenant_id` (equipo) — `using (tenant_id = get_user_tenant_id() and deleted_at is null)`.
- `next_claim_code` = `security definer` con `assert_tenant_match(p_tenant_id)`; `revoke execute … from
  public, anon` + `grant … to authenticated`.
- Trigger `client_claims_check` (security invoker): valida que `client_id`/`shipment_id` pertenezcan al
  mismo tenant; sella `evaluated_at`/`resolved_at` según el estado.
- RBAC (SDD-0085): `reclamos: ["commercial","operations","accounting","support"]`. `support` read-only.
  Las mutaciones pasan por `moduleEditDenial(supabase, "reclamos")`.

## 5. KPIs (mock)

- **Reclamos abiertos** = no terminales (`reportado|evaluacion|aprobado`).
- **Monto expuesto** = Σ `amount_usd` de los abiertos.
- **Con seguro** = `count(insured) / total`.
- **Pagado** = Σ `amount_usd` de los `pagado` (indemnizaciones).

## 6. Validación / pruebas

- `node scripts/verify.mjs` verde + `pnpm build`.
- Vitest: `canTransitionClaim`, `claimStatusStep`, `computeClaimKpis`, `validateClaimInput`.
- `rbac.test.ts` (anti-drift modules↔rbac) sigue verde con la entrada nueva.
- UI/UX review (`ui-ux-designer`) pre-commit.

## 7. Notas de implementación

- Tipos `claim_type`/`status` como **text + check** (no enum) — extensible y sin landmine de cast
  enum↔text en migraciones futuras.
- Valores ASCII en los checks (`dano`, no `daño`); el label con ñ vive en `lib` (`CLAIM_TYPE_META`).
- `amount_usd` llega de Postgres como string → coerción con `num()` en las queries.
