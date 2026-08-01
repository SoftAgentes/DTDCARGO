# Revisión técnica D2 R3 — motivos humanos

| Control | Valor |
|---|---|
| Revisión | REV-AUD-043 |
| SDD | SDD-0187 |
| Migración | `0294_audit_d2_human_reasons` |
| Fecha | 2026-07-31 |
| Resultado | cumplimiento local · Producción pendiente |

## Veredicto

El slice corrige exactamente las cinco anulaciones financieras identificadas
por REV-AUD-019. Cada UI reusa `ConfirmDialog` canonical con motivo requerido;
el servidor repite la validación y una RPC security-invoker limita la
transacción a la mutación esperada.

El trigger D2 sigue siendo el único emisor del evento. El wrapper del writer
conserva su firma y ACL, y sólo sustituye la frase controlada cuando la
transacción contiene un motivo humano validado. No se crea un segundo evento,
no se habilita INSERT directo y no se agrega contenido al payload.

## Evidencia

- contrato Vitest positivo, corto, vacío y mayor a 1000 caracteres;
- test SQL con las cinco operaciones y los cinco motivos exactos;
- `anon` sin ejecución y fronteras `authenticated` security-invoker;
- motivo inválido deja la factura intacta;
- fallo forzado del writer revierte la anulación;
- PostgreSQL efímero termina en rollback.

## Clasificación

| Política | Evidencia | Clasificación |
|---|---|---|
| AUD-01 v1.0 | motivo humano y rollback en la misma transacción | cumplimiento local |
| AVS-01 | `ConfirmDialog` canonical, motivo requerido y error visible | cumplimiento |
| BTN-01 v1.1 | acción destructiva explícita y confirmación segura | cumplimiento |
| CMP-01 v1.1 | cero componentes nuevos o consumers deprecated | cumplimiento |
| AUD-02 | no cambia lectura, retención ni exportación | no aplica |

Producción permanece fuera de alcance. `0294` exige autorización nominal
individual y no está incluida en la autorización previa de `0270` y
`0289`–`0293`.
