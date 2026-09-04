# Documentos sin transacción · SDD-0412 / 0444 · evidencia local

Fecha: 2026-09-04

Alcance: acciones del Hub, helper documental, bucket y PostgreSQL desechable

Fuera de alcance: Cloud, datos reales, push, `main`, despliegue y limpieza

## Hallazgos reproducidos

1. `addDocumentVersion` no llamaba `moduleEditDenial("documents")`; un denial
   simulado no detenía subida, lectura ni RPC y la acción devolvía éxito.
2. `none` caía en el fallback abierto del autorizador, por lo que Soporte
   obtenía edición aunque la aplicación lo define como sólo lectura.
3. El bucket extrae el tipo del segundo segmento del path; un valor inventado
   también caía en el fallback y permitía crear objetos huérfanos.

## Correctivo preparado

La acción de versionado ahora aplica el guard inmediatamente después de crear el
cliente de usuario y antes de cualquier otro efecto. 0444 añade
`none → documents`, conserva el valor vacío como compatibilidad explícita para
paths legados sin segundo segmento y cambia el caso desconocido a fail-closed.

El preflight exige que `document_entity_type` contenga exactamente los 12 tipos
auditados. Cuatro tipos financieros mantienen el candado Contabilidad/Admin y
los otros ocho quedan en el mapa central; un tipo futuro obliga a crear otro
slice antes de aplicar la migración.

## Evidencia ejecutada

- RED aplicación: 1/13 falla porque el denial no se consulta y la acción termina
  con `{ ok: true }`; GREEN focal: 13/13.
- RED SQL: Soporte edita `none` y Operaciones inserta un path inventado.
- GREEN SQL: Soporte lee `none` y legado pero no escribe; Operaciones conserva
  CRUD válido; el path inventado, tenant ajeno y acción desconocida fallan.
- Regresión: Bitácora, Naviera, Proveedores y tipos financieros.
- SQL completo: 186/186 contratos con rollback total.
- Rebuild: 441 migraciones inventariadas, 423 aplicadas desde cero, 18
  sólo-ledger, 219 tablas y dos tenants del arnés.
- Suite unitaria completa: 7.299/7.299 en 577 archivos.
- TypeScript y lint: correctos.
- Numeración revalidada contra 15 refs: spec 0412 y migración 0444 libres.

## Estado y límites

- Local: **CORRECTO**; los 12 tipos documentales conocidos están clasificados.
- Producción: **NO VERIFICABLE**; 0444 no se aplicó ni se consultaron objetos o
  datos reales.
- Checklist original: 58/106 (54,7 %); se cierra la casilla amplia de RBAC por
  slices, no se inventan casillas por cada entidad.
- Migraciones locales preparadas: 44 (0401–0444), tomando 0400 como último
  ledger alojado verificado previamente.
