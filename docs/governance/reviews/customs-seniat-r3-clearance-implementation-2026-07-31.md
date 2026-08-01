# REV-SGE-038 · Liberación R3 gobernada en Aduana SENIAT

| Control | Valor |
|---|---|
| Fecha | 2026-07-31 |
| Spec | SDD-0228 |
| Hallazgo origen | REV-SGE-037 |
| Migración local | `0318_customs_clearance_governance.sql` |
| Producción | No aplicada |

## Residuo corregido

La transición `pagado → liberado` ya no encadena tres escrituras independientes
ni puede reportar éxito cuando falla el shipment o su timeline. El RPC resuelve
rol activo y tenant, bloquea filing, shipment y documentos, valida el estado y
los seis documentos obligatorios, y escribe filing + shipment + timeline +
AUD-01 en una sola transacción.

Un trigger bloquea el `UPDATE` directo a `liberado`; la action genérica también
lo rechaza. La UI reemplaza el clic irreversible por `ConfirmDialog` con DUA,
shipment, agente, fecha y consecuencia, motivo obligatorio, presión sostenida y
alternativa accesible. La misma request ref se conserva durante un reintento.

## Evidencia local

- 9/9 pruebas focales del validator y wrapper RPC.
- TypeScript `tsc --noEmit` y ESLint focal verdes.
- 53/53 contratos SQL en PostgreSQL 17 efímero, incluido 0318.
- El contrato 0318 demuestra anti-bypass, documentos completos, atomicidad,
  operations/accounting, rol insuficiente, membresía deshabilitada, tenant,
  replay único, referencia reutilizada, contexto no reutilizable, hito terminal,
  estado y shipment incompatibles.
- Reconstrucción verde: 314 archivos evaluados, 297 migraciones aplicadas desde
  cero, 17 sólo-ledger y aislamiento sobre 219 tablas.
- Docs, 27 políticas, 4 componentes y plugin read-only 7/7 verdes.
- `git diff --check` verde.

## Alcance que no se amplió

- No se cambió la carga documental ni se adoptó UPL-01 transversalmente.
- No se modificaron montos, agentes, DUA, arribo ni despacho posterior.
- No se aplicó 0318 a Cloud ni se tocó Vercel o `main`.
- Las migraciones 0316 de Nómina y 0317 de Financiero China permanecen aisladas
  y sin aplicar.

## Estado de cobertura

Este slice valida una acción R3 representativa de Aduana SENIAT. No promueve el
módulo completo a `VA`: alta/edición, checklist, estados intermedios, agentes y
excepciones documentales conservan su clasificación previa.

## Gate nominal

Aplicar a Producción exige una autorización que nombre exactamente
`0318_customs_clearance_governance`. Esa autorización no se infiere de la
autorización general de commits ni de los gates 0316 o 0317.
