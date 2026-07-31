# Diseño técnico D3 — ciclo comercial

## Decisión

`0291_audit_d3_commercial_cycle` instala cuatro triggers explícitos. Cada
mutación y su evento comparten transacción; no queda una petición
`service_role` posterior ni dos writers para el mismo evento.

La asignación de prealerta se audita en la propia fila que cambia, pero usa el
UUID de la orden como entidad principal. Esto preserva la relación sin copiar
el código o contenido de la prealerta.

## Allowlist exacta

1. migración y prueba `0291`;
2. contrato y prueba TypeScript D3;
3. `lib/studio/renditions/actions-helpers.ts`;
4. `lib/studio/purchase-orders/actions.ts`;
5. `lib/studio/sales-orders/actions.ts`;
6. inventario, diseño, revisión, spec, registro y línea base D3.

## Aceptación

- schema reconstruible;
- cuatro triggers habilitados;
- siete eventos representativos;
- razón controlada en anulación/cancelación, con no conformidad explícita
  mientras el caller legacy no capture el motivo humano;
- payload mínimo;
- fallo del writer revierte la mutación;
- cero INSERT directo al log en los tres callers;
- PostgreSQL desechable termina en rollback.

La captura progresiva del motivo humano requiere un slice R2/R3 separado.
