# REV-SGE-043 · Autorización R3 gobernada de consolidación Naviera

| Control | Valor |
|---|---|
| Fecha | 2026-08-01 |
| Spec | SDD-0232 |
| Hallazgo origen | REV-SGE-039 |
| Migración local | `0322_naviera_consolidation_authorization_governance.sql` |
| Producción | No aplicada |

## Residuo corregido

“Autorizar” dejó de ejecutar una mutación R3 en el primer clic. El RPC resuelve
membresía activa, rol y tenant, bloquea la solicitud, valida el estado y reserva
el correlativo dentro de la misma transacción que persiste actor, timestamp y
AUD-01. Una carrera ya no puede devolver éxito con cero filas ni dejar un
correlativo quemado.

Un trigger bloquea el `UPDATE` directo y sella la evidencia de autorización.
La UI usa `ConfirmDialog` canonical con motivo, presión sostenida, foco seguro,
pending/error y request ref estable para reintento. El push al operario sigue
siendo best-effort y no se confunde con la verdad persistida.

## Evidencia local

- 8/8 pruebas focales de action, validator, wrapper, replay y errores públicos.
- TypeScript `tsc --noEmit` y ESLint focal verdes.
- UI check liviano: consecuencia y correlativo visibles, motivo obligatorio,
  presión sostenida, alternativa accesible, foco seguro y tokens existentes.
- 57/57 contratos SQL en PostgreSQL 17 efímero, incluido 0322.
- El contrato 0322 demuestra anti-bypass, roles, membresía, tenant, estado,
  replay, referencia reutilizada, evidencia inmutable y rollback ante falla de
  AUD-01.
- Reconstrucción verde: 318 archivos evaluados, 301 migraciones aplicadas desde
  cero, 17 sólo-ledger y aislamiento sobre 219 tablas.
- Docs, 27 políticas, cuatro componentes y plugin read-only 7/7 verdes.
- El registry distribuido se regenera con el sincronizador oficial; la caché
  instalada no recibe edición manual.
- `git diff --check` verde.

## Alcance que no se amplió

- No se modificaron rechazo, estiba, cierre, bookings, sailings, tracking
  marítimo, Storage ni PWA.
- No se aplicó 0322 a Cloud ni se tocó Vercel o `main`.
- Las migraciones 0316–0321 permanecen aisladas y sin aplicar.

## Estado de cobertura

Este slice valida una decisión R3 representativa de Naviera. No promueve el
módulo completo a `VA`: las demás mutaciones conservan su clasificación previa.

## Gate nominal

Aplicar a Producción exige una autorización que nombre exactamente
`0322_naviera_consolidation_authorization_governance`. Esa autorización no se
infiere de la autorización general de commits ni de los gates 0316–0321.
