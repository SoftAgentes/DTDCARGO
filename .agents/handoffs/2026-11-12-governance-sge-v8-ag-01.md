# Handoff - GOB-SGE-V8-AG-01 (v2) - Gobernanza SGE v8.0 + SGE-AG-01 + contexto oficina

Owner: orca-fc933f12-9d00-424e-905d-ccb04d2b8799 (Worker despachado; Director: orca_session_id:opencode2_1afbbfba_f0b1_4428_80ec_ea961363d076)
Fecha: 2026-11-12. Worktree: Orca/DTDCARGO/governance-sge-v8-ag-01. Rama: governance/sge-v8-ag-01.

## OBJETIVO ORIGINAL
Aplicar SGE v7.0 -> v8.0: README maestro reemplazado, alta SGE-AG-01 v0.2, documento de cambio, contexto maestro de oficina, registro de carpeta, archivo de baselines >90 dias y capsula regenerada. Rama propia, push y PR autorizados por Sam (12/11/2026). SIN merge.

## COMPLETADO
- Precondiciones verificadas: origin/main == main SoftAgentes == main local == 326be27fe04681d9c0e4b18ac290ae7029ec1162; rama inexistente en local y remotos; creada desde ese SHA; guard OK; claim adquirido.
- Contenidos A-D copiados byte a byte desde la transcripcion aprobada (UTF-8 sin BOM, verificados con lector de archivos; un espacio corregido antes del guion largo en README linea 62).
- Detalle E aplicado: exactamente 2 lineas en docs/README.md (fila de tabla y linea del mapa de carpetas).
- Baselines: regla mecanica fecha <= 2026-08-13 excepto BASELINE-2026-08-03-02.md. Movidas 106 de 107 con git mv (renames 100%, sin borrar). CONTEO REAL 106, no 102: inventario real jul-21=10 (esperado 11) y jul-31=9 (esperado 4); aceptado por el Director (msg_2656fcebfae5).
- Bloqueo escalado (msg_8cd5cd6d186c): parser de capsula rechazaba SGE-AG-01 (regex de un solo guion). Sam autorizo opcion 1: ampliar SOLO el regex de la linea 22 de scripts/build-governance-capsule.mjs a codigos multi-segmento (retrocompatible), commit propio + regeneracion. Ejecutado tal cual.
- Capsula regenerada: diff = solo entrada SGE-AG-01 agregada, sourceCommit -> 75f77e61e (commit 7) y generatedAt -> 2026-11-12 (consecuencia inherente: ultima fecha de aprobacion). 28 codigos existentes intactos.

## COMMITS (8, sobre base 326be27fe)
1. 93a5005ae docs(governance): reemplazar README maestro por v8.0 (tiers, delegacion, indice generado, KPIs)
2. 19e8ece5c docs(governance): alta de politica SGE-AG-01 v0.2 - comportamiento de agentes autonomos
3. 3d85993ca docs(governance): registrar cambio 2026-11-12 SGE v8.0 + SGE-AG-01
4. ed8f1a768 docs(oficina): añadir contexto maestro del proyecto de oficina de agentes v1.0
5. a019423c9 docs: registrar carpeta docs/oficina en el indice maestro
6. 9ed9b2782 docs(governance): archivar 106 baselines >90 dias en docs/archive/governance (git mv, sin borrar nada)
7. 75f77e61e chore(governance): aceptar codigos multi-segmento en el parser de la capsula (SGE-AG-01) [autorizado por Sam via Director]
8. 651c4bb90 chore(governance): regenerar capsula con SGE-AG-01 v0.2

## VALIDACION
- docs:check PASO (node scripts/build-docs-index.mjs --check; indice sincronizado con 605 specs; exit 0).
- sdd:check PASO (node scripts/check-numbering.mjs; sin numeros repetidos, exit 0; pausas por choques historicos ya conocidos y aplicados en prod).
- governance:check PASO (node scripts/build-governance-capsule.mjs --check; 29 politicas, capsula vigente, exit 0).
- git status limpio y git diff --exit-code 0 tras generar la capsula.
- pnpm: NO DISPONIBLE en este entorno (comando inexistente); se usaron los fallbacks node autorizados por el encargo.
- pnpm verify: NO EJECUTADO (encargo docs-only; no toca codigo de producto; CI del PR corre el pipeline completo).
- knowledge:status NO DISPONIBLE (Graphify Python no localizado: error exacto en la salida; estado structural/semantic UNAVAILABLE). Impacto documental de esta tarea: nuevos docs/oficina/contexto-oficina.md, README v8.0 y archivo de baselines; derivados Graphify/Archify quedan para el Director al cierre, desde main integrado.
- Prueba real de uso: NO APLICA (cambio documental).

## PR / BRANCH
- Push: https://github.com/SoftAgentes/DTDCARGO.git governance/sge-v8-ag-01 (URL directa, sin tocar .git/config compartido).
- PR #524 (no draft, base main): https://github.com/SoftAgentes/DTDCARGO/pull/524
- Evidencia completa (log, stat, diff de los 5 archivos, salida de los 3 checks) en comentario: https://github.com/SoftAgentes/DTDCARGO/pull/524#issuecomment-6833967232
- Linea 2 del cuerpo del PR ajustada segun autorizacion (fix menor del parser + capsula regenerada); linea 4 con conteo real 106.

## PENDIENTES DE ESTA TAREA
- Merge del PR #524: requiere aprobacion explicita de Sam (NO autorizado en este encargo; el Director serializa la integracion).
- CI del PR: observar la corrida completa del pipeline (este cambio no toca codigo de producto).

## FUERA DE ALCANCE DETECTADO (anotado, no ejecutado)
- SDD-0626 oficina-runtime: indice generado real, governance:kpi, P0/P1/P2 de la investigacion de tendencias (tope por corrida, identidad no humana operativa, pinning de herramientas, memoria/contexto, clasificacion de datos y PII, ergonomia de aprobacion), inventario de terceros de IA en docs/legal/privacidad/inventario-terceros.md.
- Mover REVs cerrados >90 dias a docs/archive/ (planeado SDD-0626).
- Actualizar referencias historicas docs/governance/BASELINE-* dentro de specs antiguos (las rutas quedaron en docs/archive/governance/).
- docs/archive/README.md no lista la subcarpeta governance/ creada aqui.
- Rediseño de branding BRAND.md en QA (trabajo aparte): NO tocado.
- Capsula: generatedAt quedo 2026-11-12 por fecha de aprobacion de SGE-AG-01 (logica vigente del script); si se desea semanticamente distinto, viaja en SDD-0626.

## CORRECCION 2026-11-12 (task_465cc051b75f) - paquete aprobado por Sam
- Tests: conteo 28 -> 29 en policy-registry.test.mjs (1 asercion) y governance-capsule.test.ts (titulo + 3 aserciones); ningun test enumera la lista de politicas, no se toco otra asercion. Commit 99c0bad4c.
- Renumeracion SDD-0612 -> SDD-0626 (0612 ocupado por 0612-oficina-actividad-discord; oficina-runtime ahora 0626): README.md x6, CAMBIO x3, contexto-oficina.md x5; archivos NO renombrados; handoff actualizado. Commit 85968b531.
- Capsula NO regenerada (contenido parseado sin cambio); governance:check verificado.
- Entorno: pnpm disponible via corepack; pnpm install --frozen-lockfile y vitest de los 2 tests + governance:check en verde local antes del push.
- Push de la rama a URL directa SoftAgentes para disparar CI del PR #524 (sin abrir PR nuevo). Merge lo firma Sam.

## HANDOFF AL DIRECTOR
Tarea completada hasta PR abierto con checks locales en verde y evidencia publicada. No se toco main, no merge, no deploy. Claim del worktree liberado al cierre de escritura; retomar requiere reclamar.

## CIERRE 2026-11-13 (evidencia en main, viaja en el PR #525)
- PR #524 fusionado en main el 2026-11-12 a las 22:01 UTC por Sam (cuenta SoftAgentes). Commit de merge: dcccddee611b674828309aedcec9101863357e7a.
- Este archivo quedó sin commit en el worktree Orca/DTDCARGO/governance-sge-v8-ag-01. Se copia byte a byte (verificado con cmp) en la rama del PR #525 como el «mini-commit de handoff» del encargo del Director (Hermes); solo se agrega esta sección.
- Pendiente que sigue abierto: los puntos de FUERA DE ALCANCE DETECTADO que viajan en la SDD-0626 no se resuelven con este archivo.
