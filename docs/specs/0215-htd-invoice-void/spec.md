---
sdd: "0215"
title: "HTD-01 en anulación de factura R3"
status: done
author: "Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0165", "0174", "0185"]
confidencialidad: interno
---

# SDD-0215 · HTD-01 en anulación de factura R3

## 1. Problema y clasificación

La anulación de una factura cambia un documento financiero a estado `anulada`,
no puede deshacerse desde la UI y exige motivo. MP-01 la clasifica P3/R3. Antes
de este slice el flujo ya tenía diálogo, permiso, validación server-side y
auditoría atómica, pero una pulsación simple completaba la confirmación.

HTD-01 aporta una ventana de compromiso de 1.500 ms solo a este consumidor. No
se aplica a eliminaciones R1/R2 ni a otros diálogos.

## 2. Amenaza y controles preservados

| Riesgo | Control |
|---|---|
| click accidental | presión sostenida cancelable antes de enviar |
| barrera inaccesible | checkbox de consecuencia + botón normal, operable por teclado/lector |
| doble solicitud | guard one-shot en UI, botón pending y rechazo por estado en servidor/RPC |
| permiso revocado | `moduleEditDenial` se evalúa en la Server Action |
| factura pagada/anulada | lectura y guardas server-side; la RPC confirma el estado durable |
| motivo ausente | validación local y `validateAuditReason` en servidor |
| auditoría separada | `void_invoice_with_audit_reason` muta y audita en PostgreSQL |

El progreso HTD representa intención local; `Procesando…` comienza únicamente
después de enviar. Soltar, `pointercancel`, abandonar el control, perder foco,
ocultar la pestaña o cambiar de ventana reinicia sin solicitud.

## 3. Allowlist

- `docs/specs/0215-htd-invoice-void/spec.md`
- `docs/specs/README.md`
- `app/studio/tokens.css`
- `app/studio/_components/ui/ConfirmDialog.tsx`
- `app/studio/_components/ui/ConfirmDialog.test.tsx`
- `app/studio/(app)/facturacion/_components/InvoiceDetailClient.tsx`
- `docs/governance/components/confirm-dialog.json`
- `docs/governance/policies/htd-01.md`
- `docs/governance/README.md`
- `docs/governance/generated/governance-capsule.json`
- `docs/governance/generated/component-registry.json`

Conteo: un componente canónico, un consumidor R3 y un token de duración. Cero
actions, RPC, migraciones, tablas o consumidores legacy adicionales.

## 4. SGE-00

| Principio | Resultado | Evidencia |
|---|---|---|
| 01 claridad | cumple | entidad, consecuencia, motivo y acción nombrados |
| 02 trabajo | cumple | el motivo se conserva durante cancelación/error |
| 03 riesgo | cumple | P3/R3; HTD no sustituye backend |
| 04 auditoría | cumple | RPC auditada existente, cerrada por SDD-0174 |
| 05 autoridad | cumple | permiso, tenant y estado vuelven a validarse |
| 06 contexto | cumple | cambio limitado a Facturación |
| 07 estado real | cumple | holding y pending son estados distintos; one-shot |
| 08 recuperación | cumple | error permanece dentro del diálogo y permite reintento |
| 09 consistencia | cumple | extensión opt-in de `ConfirmDialog` canonical |
| 10 accesibilidad | cumple | checkbox + click, teclado, lector, foco y cancelaciones |
| 11 adaptación | cumple | control cabe en diálogo móvil y no depende de hover |
| 12 autoridad humana IA | no aplica | no interviene IA |

## 5. Pruebas y evidencia

- `ConfirmDialog.test.tsx`: umbral 1.500 ms, cancelación previa, solicitud única
  y alternativa accesible;
- `pnpm components:check`: contrato canonical y rutas verificadas;
- `pnpm governance:check` y `pnpm docs:check`: derivados reproducibles;
- revisión UI: tokens existentes, texto además de color, foco seguro y target
  estándar del botón.

No se creó migración. Producción conserva la RPC ya aplicada; este slice solo
cambia la interacción cliente del consumidor existente.
