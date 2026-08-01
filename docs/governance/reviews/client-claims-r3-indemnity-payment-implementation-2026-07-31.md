# REV-SGE-040 · Pago R3 gobernado de indemnización en Reclamos

| Control | Valor |
|---|---|
| Fecha | 2026-07-31 |
| Spec | SDD-0229 |
| Hallazgo origen | REV-SGE-039 |
| Migración local | `0319_claim_indemnity_payment_governance.sql` |
| Producción | No aplicada |

## Residuo corregido

La transición `aprobado → pagado` ya no marca primero el reclamo para intentar
después un asiento contable best effort. El RPC resuelve rol activo y tenant,
bloquea el reclamo y su resolución financiera, valida monto, medio, fecha,
período y cuentas, y escribe reclamo + asiento balanceado + AUD-01 en una sola
transacción.

Un trigger bloquea el `UPDATE` directo a `pagado`; la action genérica también lo
rechaza. La UI reemplaza el clic irreversible por `ConfirmDialog` con reclamo,
cliente, monto, medio, fecha y consecuencia, motivo obligatorio, presión
sostenida y alternativa accesible. La misma request ref se conserva durante un
reintento. Tras el pago, el reclamo y la resolución financiera quedan sellados.

## Evidencia local

- 10/10 pruebas focales del validator y wrapper RPC.
- TypeScript `tsc --noEmit` y ESLint focal verdes.
- 54/54 contratos SQL en PostgreSQL 17 efímero, incluido 0319.
- El contrato 0319 demuestra anti-bypass, rol, membresía, tenant, monto, estado,
  medio, período, cuentas, asiento balanceado, replay, referencia reutilizada,
  sellado y rollback total ante falla de AUD-01.
- Reconstrucción verde: 315 archivos evaluados, 298 migraciones aplicadas desde
  cero, 17 sólo-ledger y aislamiento sobre 219 tablas.
- Docs, 27 políticas, 4 componentes y plugin read-only 7/7 verdes.
- El registry distribuido fue regenerado con el sincronizador oficial; la caché
  instalada no recibió edición manual.
- `git diff --check` verde.

## Alcance que no se amplió

- No se modificaron recepción, evaluación, aprobación, evidencia, recuperos o
  portal de Reclamos.
- No se adoptó UPL-01 ni otra política transversal.
- No se aplicó 0319 a Cloud ni se tocó Vercel o `main`.
- Las migraciones 0316 de Nómina, 0317 de Financiero China y 0318 de Aduana
  SENIAT permanecen aisladas y sin aplicar.

## Estado de cobertura

Este slice valida una acción R3 representativa de Reclamos. No promueve el
módulo completo a `VA`: alta, edición, evaluación, aprobación, evidencias,
recuperos y otras transiciones conservan su clasificación previa.

## Gate nominal

Aplicar a Producción exige una autorización que nombre exactamente
`0319_claim_indemnity_payment_governance`. Esa autorización no se infiere de la
autorización general de commits ni de los gates 0316, 0317 o 0318.
