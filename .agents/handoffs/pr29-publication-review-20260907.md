# PR29: publicación de la corrección revisada de 0448

- Owner: Director, `director-pr29-publication-20260907`.
- Worktree: `<local>/DTD-worktrees/pr29-publication-review-20260907`.
- Rama local: `codex/pr29-publication-review-20260907`.
- PR existente: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/29.
- Destino autorizado: `codex/0448-replay-0223-history`; head observado antes de publicar `4af6aac1223f008ffb58f7e161d601b1317ef243`.
- Base vigente: `74bb52ab9677f96908cc032a15f2364ab9d94716`.
- Candidato importado sin editar producto: `17d58fe44f641c7af7ee6e874b5b56a96fb8f427`, que contiene el fix `1e31b9a31400973e0a25f781b2b539dbdbb8ca44` y la combinación con main.

## Objetivo original y autorización

Sam autorizó preparar, validar y publicar la actualización de la PR29 con la
corrección de 0448 y su prueba. No autoriza merge a main ni aplicar producción.
Se conserva el worktree anterior y su handoff histórico. Este documento registra
la ampliación de permiso; no modifica retroactivamente el encargo del Worker.

## Completado

Se verificaron el diff de migración y regresión, 144 archivos de evidencia sin
divergencias y dos logs canónicos asociados al commit de producto. Los seis
abortos esperados conservan snapshots anteriores. Se creó este worktree propio
con claim; el candidato es descendiente del head remoto y de main vigente.

La corrección reconstruye el CHECK positivo canónico, rechaza objetos homónimos
de otro tipo y comprueba validación. No interpreta ni conserva una expresión
personalizada bajo ese nombre. El release debe inventariar esas personalizaciones
y ejecutar el archivo completo en una transacción, conforme al runbook.

## Validación

Resultados actuales del candidato y recibos externos:
`<local>/DTD-backups/pr29-publication-review-20260907/`.

- Numeración: PASÓ; conserva colisiones históricas ya registradas.
- Índice documental: PASÓ.
- `git diff --check`: PASÓ.
- SQL: PASÓ, 140/140 contratos, exit 0. Rebuild: PASÓ, 381 migraciones aplicadas + 18 solo-ledger, aislamiento de 219 tablas, exit 0. Candidato 17d58fe4; recibo validation.json.
- E2E, build general y ledger productivo: NO EJECUTADOS en esta publicación
  acotada de SQL. No equivale a cierre canónico completo de producto.

## Handoff al Director

Publicar únicamente el candidato validado en la rama de la PR29, sin force push.
Actualizar descripción con SHA final y pruebas actuales. Verificar head remoto
y observar CI. El commit que contiene este documento agrega solo trazabilidad.
Siguen pendientes aprobación de integración, autorización nominal de 0448 para
producción y cobertura aplicable de PR28. No limpiar worktrees ni volúmenes.
