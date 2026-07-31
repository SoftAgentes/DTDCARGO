# Revisión técnica D3 R3 — motivos humanos

| Control | Valor |
|---|---|
| Revisión | REV-AUD-044 |
| SDD | SDD-0188 |
| Migración | `0295_audit_d3_human_reasons` |
| Fecha | 2026-07-31 |
| Resultado | cumplimiento local · Producción pendiente |

## Veredicto

El slice corrige exactamente las dos cancelaciones comerciales identificadas
por REV-AUD-020. Cada UI reusa `ConfirmDialog` canonical con motivo requerido;
el servidor repite la validación y una RPC security-invoker limita la
transacción a la transición vigente.

El trigger D3 sigue siendo el único emisor del evento. El wrapper de SDD-0187
sólo sustituye la frase controlada por el motivo humano validado. No se crea un
segundo evento, no se habilita INSERT directo y no se agrega contenido al
payload.

## Evidencia

- contrato SQL para OC confirmada y OV parcial;
- motivo exacto en `purchase_order_cancelled` y `sales_order_cancelled`;
- estados no elegibles sin mutación;
- motivo corto sin mutación;
- `anon` sin ejecución y fronteras `authenticated` security-invoker;
- fallo forzado del writer revierte la cancelación;
- PostgreSQL efímero termina en rollback.

## Clasificación

| Política | Evidencia | Clasificación |
|---|---|---|
| AUD-01 v1.0 | motivo humano y rollback en la misma transacción | cumplimiento local |
| AVS-01 | `ConfirmDialog` canonical, motivo requerido y error visible | cumplimiento |
| BTN-01 v1.1 | cancelación explícita con confirmación segura | cumplimiento |
| CMP-01 v1.1 | cero componentes nuevos o consumers deprecated | cumplimiento |
| AUD-02 | no cambia lectura, retención ni exportación | no aplica |

Producción permanece fuera de alcance. `0295` exige autorización nominal
individual y no está incluida en la autorización previa de `0270` y
`0289`–`0293`.
