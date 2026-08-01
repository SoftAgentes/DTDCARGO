# Inventario D2 — núcleo financiero

| Control | Valor |
|---|---|
| Gate | D2 |
| Base | `origin/main` · `76af3796` |
| Writers best-effort | 5 archivos, 17 llamadas |
| Tablas de dominio | 7 |
| Resultado | migradas a auditoría transaccional por tabla |

## Ledger

| Tabla | Dominio | Eventos mínimos | Frontera |
|---|---|---|---|
| `accounts` | contabilidad | crear, cambiar, eliminar | trigger de dominio |
| `journal_entries` | contabilidad | crear, asentar, anular, eliminar | trigger de dominio |
| `invoices` | facturación | crear, actualizar, emitir, cobrar, anular, eliminar | trigger de dominio |
| `payment_receipts` | cobranzas | registrar, identificar, anular | trigger de dominio |
| `suppliers` | tesorería | crear, actualizar, eliminar | trigger de dominio |
| `supplier_bills` | CxP | crear, cambiar estado, anular, eliminar | trigger de dominio |
| `supplier_payments` | pagos | registrar, anular | trigger de dominio |

## Clasificación

- `cumplimiento`: las siete tablas poseen un trigger explícito y allowlisted;
- `no aplica`: lecturas, validaciones y generación de códigos sin mutación;
- `excepción`: asientos auxiliares best-effort conservan diagnóstico propio,
  pero sus mutaciones también quedan auditadas por `journal_entries`;
- `no conformidad retirada`: los cinco helpers que insertaban directamente en
  `entity_audit_log` después de la mutación.

No se serializan nombres, contactos, referencias, notas ni montos. Los eventos
destructivos incluyen motivo estable y la identidad usa `auth.uid()` cuando
existe o `system` para procesos internos.
