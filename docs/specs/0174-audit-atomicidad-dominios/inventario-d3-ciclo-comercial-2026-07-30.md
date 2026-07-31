# Inventario D3 — ciclo comercial

| Control | Valor |
|---|---|
| Gate | D3 |
| Writers best-effort | 3 archivos, 13 llamadas |
| Tablas allowlisted | 4 |
| Resultado | writers posteriores retirados |

## Ledger

| Tabla | Evento cubierto | Frontera |
|---|---|---|
| `renditions` | emisión y anulación | trigger D3 |
| `purchase_orders` | alta, edición, transición, recepción/Bill y cancelación | trigger D3 |
| `sales_orders` | alta, conversión, edición, estado, facturación y cancelación | trigger D3 |
| `prealertas` | asignación/desasignación de OV | trigger D3 |

Los eventos incluyen códigos, estado y referencias UUID. Excluyen nombres,
notas y montos. Rendiciones conserva el motivo humano ya requerido por su
acción; cancelaciones usan un motivo operacional estable mientras su UI no
recibe un motivo libre.
