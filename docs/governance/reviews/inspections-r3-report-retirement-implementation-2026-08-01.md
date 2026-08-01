# REV-SGE-044 · Retiro R3 gobernado de reporte de Inspecciones

| Control | Valor |
|---|---|
| Fecha | 2026-08-01 |
| Spec | SDD-0233 |
| Hallazgo origen | REV-SGE-039 |
| Migración local | `0323_inspection_report_retirement_governance.sql` |
| Producción | No aplicada |

## Residuo corregido

La confirmación inline sin motivo fue reemplazada por una decisión canonical.
El RPC resuelve membresía activa, rol y tenant, bloquea el reporte, valida su
estado esperado y retira el reporte junto con la metadata activa de sus fotos y
AUD-01 en una sola transacción. Cero filas afectadas, carreras y replay ya no se
presentan como éxito nuevo.

Los hard-delete ordinarios quedan revocados. Un trigger bloquea el soft-delete
directo y sella el hito. La UI lo denomina “Retirar del Studio”, exige motivo y
presión sostenida, conserva la request ref y declara que los objetos privados de
Storage no fueron eliminados.

## Disposición de las fotos

El retiro no ejecuta una purga externa ni promete borrado. Las filas activas de
`inspection_report_photos` se retiran junto con el reporte; los objetos del
bucket privado permanecen conservados. AUD-01 registra el conteo y
`physical_objects_deleted=false`. Una política futura de retención/purga de
Storage requiere otro SDD y otro gate nominal.

## Evidencia local

- 6/6 pruebas focales del validator y wrapper RPC.
- TypeScript `tsc --noEmit` y ESLint focal verdes.
- UI check liviano: lenguaje honesto, consecuencia visible, motivo obligatorio,
  presión sostenida, alternativa accesible, foco seguro y tokens existentes.
- 58/58 contratos SQL en PostgreSQL 17 efímero, incluido 0323.
- El contrato 0323 demuestra anti-bypass, revocación de hard-delete, roles,
  membresía, tenant, estado, replay, disposición de Storage y rollback total
  ante falla de AUD-01.
- Reconstrucción verde: 319 archivos evaluados, 302 migraciones aplicadas desde
  cero, 17 sólo-ledger y aislamiento sobre 219 tablas.
- Docs, 27 políticas, cuatro componentes y plugin read-only 7/7 verdes.
- El registry distribuido se regenera con el sincronizador oficial; la caché
  instalada no recibe edición manual.
- `git diff --check` verde.

## Alcance que no se amplió

- No se modificaron upload, retiro individual, redacción, preview, builders,
  impresión, bucket, policies de Storage ni lifecycle externo.
- No se aplicó 0323 a Cloud ni se tocó Vercel o `main`.
- Las migraciones 0316–0322 permanecen aisladas y sin aplicar.

## Estado de cobertura

Este slice valida una decisión R3 representativa de Inspecciones. No promueve el
módulo completo a `VA`: las demás mutaciones conservan su clasificación previa.

## Gate nominal

Aplicar a Producción exige una autorización que nombre exactamente
`0323_inspection_report_retirement_governance`. Esa autorización no se infiere
de la autorización general de commits ni de los gates 0316–0322.
