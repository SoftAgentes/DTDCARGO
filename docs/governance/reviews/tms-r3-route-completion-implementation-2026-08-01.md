# REV-SGE-041 · Cierre R3 gobernado de ruta TMS

| Control | Valor |
|---|---|
| Fecha | 2026-08-01 |
| Spec | SDD-0230 |
| Hallazgo origen | REV-SGE-039 |
| Migración local | `0320_tms_route_completion_governance.sql` |
| Producción | No aplicada |

## Residuo corregido

La transición `en_ruta → completado` dejó de ser una action exportada sin
consumidor UI y cinco escrituras secuenciales cuyos errores se ignoraban. La
tabla de rutas ahora ofrece una confirmación canonical. El RPC resuelve rol
activo y tenant, bloquea ruta, shipment, camión y chofer, valida estados y uso
exclusivo de recursos, y escribe ruta + recursos + shipment + timeline + AUD-01
en una sola transacción.

Un trigger bloquea el `UPDATE` directo a `completado`. La UI muestra ruta,
shipment, camión, chofer y consecuencia, exige motivo, usa presión sostenida y
conserva la misma request ref durante un reintento. Tras el cierre, la ruta y
sus vínculos quedan sellados.

## Evidencia local

- 8/8 pruebas focales del validator y wrapper RPC.
- TypeScript `tsc --noEmit` y ESLint focal verdes.
- UI check liviano: componente canonical, jerarquía de tabla preservada, copy
  directo, estados pending/error y foco seguro; sin tokens, fuentes o patrones
  visuales nuevos.
- 55/55 contratos SQL en PostgreSQL 17 efímero, incluido 0320.
- El contrato 0320 demuestra anti-bypass, rol, membresía, tenant, precondiciones
  de ruta/shipment/recursos, atomicidad, replay, referencia reutilizada,
  timeline con actor, hito terminal y rollback total ante falla de AUD-01.
- Reconstrucción verde: 316 archivos evaluados, 299 migraciones aplicadas desde
  cero, 17 sólo-ledger y aislamiento sobre 219 tablas.
- Docs, 27 políticas, 4 componentes y plugin read-only 7/7 verdes.
- El registry distribuido fue regenerado con el sincronizador oficial; la caché
  instalada no recibió edición manual.
- `git diff --check` verde.

## Alcance que no se amplió

- No se modificaron creación, inicio o cancelación de rutas, GPS, incidencias,
  costos, planificación ni POD final.
- No se aplicó 0320 a Cloud ni se tocó Vercel o `main`.
- Las migraciones 0316–0319 permanecen aisladas y sin aplicar.

## Estado de cobertura

Este slice valida una acción R3 representativa de TMS. No promueve el módulo
completo a `VA`: flota, choferes, creación, inicio, cancelación, incidencias,
GPS y costos conservan su clasificación previa.

## Gate nominal

Aplicar a Producción exige una autorización que nombre exactamente
`0320_tms_route_completion_governance`. Esa autorización no se infiere de la
autorización general de commits ni de los gates 0316–0319.
