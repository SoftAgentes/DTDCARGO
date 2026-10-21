# Handoff · SDD-0577 · contratos de pruebas Portal/Embarques

Fecha: 2026-10-21. Estado: en-progreso, reserva documental; esperando GO pesado.
Worker: /root/revision_fixtures, adopción explícita como Worker independiente
tras completar la revisión read-only. Se aplican AGENTS y procedimientos actuales
del principal aunque la base Git sea histórica.

## Identidad, alcance y permisos

- Owner: worker-0577-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
- Sesión de referencia: 01a15a4e-ddf0-7d82-8656-d9dc56b58468.
- Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0577-contratos-pruebas-portal-embarques.
- Rama: codex/sdd-0577-contratos-pruebas-portal-embarques.
- Base inicial: eafbd910d1c082c9b416b558f8c3db5847b994a6, limpia al adoptar.
- SDD: docs/specs/0577-contratos-pruebas-portal-embarques/spec.md.
- Contrato externo: C:/tmp/director-traspaso-20261020/0577-contratos-pruebas-asignacion-worker.md,
  SHA-256 cc8e1c968640605bee912e509bcd61dc0b4ff06f3aa50057a5978eaaba72ffa5.
- Preparación leída íntegra: C:/tmp/director-traspaso-20261020/fixtures-portal-embarques-preparacion.md,
  SHA-256 516cebf9696342ba8fc1d76f9081efed1b3405344d2bf62a309149a628099012.
- Director asignó 0577 con inventario/fetch de 497 refs y worktrees. Sin SQL.
- Permitidos: adopción/claim/docs, commits/push propios y entrega PR DRAFT base main.
  Instalación/tests esperan GO; canónica general espera composición C3 y GO nuevo.
- Sin main, merge de PR, deploy, VPS, DB real, PII, secretos, cuentas ni otros Workers.

Allowlist exacta: los dos tests, la spec 0577, docs/specs/README.md generado y este
handoff. Las cinco rutas están enumeradas en la spec. Claim permanece adquirido
hasta handoff/revisión e instrucción explícita del Director. No limpiar recursos
o sesiones ajenas; preservar atribución incierta.

## OBJETIVO ORIGINAL

Corregir exclusivamente el contrato de reintento de borrado y consultas positivas
del caso Portal de archivos/Excel, conservando todos los oráculos y 40 casos.
No modificar producto ni atribuir causa del timeout sin medición.

## COMPLETADO

- Contrato/nota comprobados por SHA-256 y leídos íntegros.
- Root/rama/HEAD/limpio verificados, guard PASÓ, claim adquirido para el owner asignado.
- Ambas preimágenes del árbol propio coinciden con base, 0571
  ba43747a803ea9aec3b8750d1b461d69795834a5 y 0574
  639c8954607ee81f86694390775fae325acadf8a.
- Portal blob ed3ff02b3aee71934f99d447f2bddca85d29ec49;
  borrado blob 72f9509e18ec0fbaeb3a639d41a2e53507d38f7b.
- Merge-base main conocido d410ab2 y 0571 ba43747 comprobado:
  eafbd910d1c082c9b416b558f8c3db5847b994a6.
- Stub SDD e identidad/permisos documentados; índice generado y docs:check PASÓ (556 specs). Tests todavía sin editar.

## VALIDACIÓN

| Comprobación | Estado | Evidencia o límite |
|---|---|---|
| Raíz/rama/base/estado inicial | PASÓ | Worktree y base arriba; árbol limpio |
| node scripts/harness-worktree.mjs guard | PASÓ | Worktree aislado aceptado |
| claim del owner asignado | PASÓ | Claim adquirido |
| Preimágenes base/0571/0574 y árbol propio | PASÓ | Ambos blobs iguales |
| Índice / docs:check de reserva | PASÓ | Script existente, 556 specs; sin dependencias |
| Instalación / original 40 / candidato 40 | NO EJECUTADO | Espera GO pesado; 0574 tiene el turno |
| Lint focal / numeración | NO EJECUTADO | Fase funcional posterior |
| Canónica general corepack pnpm verify | NO EJECUTADO | Composición C3 receptora y GO nuevo |
| Knowledge/Graphify/Archify/preview | NO EJECUTADO | Pendiente de turno; sin paralelo con 0574 |
| UI/SQL/build propios | NO EJECUTADO | Sin cambios de producto/UI/SQL; build incluido en canónica receptora |

Preflight ligero: Node del PATH v24.20.0 (C:/Program Files/nodejs/node.exe).
pnpm del PATH es un envoltorio fallback del runtime Codex que usa su propio Node.
No se ha invocado ese pnpm ni Corepack para instalar o materializar gestores;
la versión efectiva de gestor/runtime se comprobará con GO. package.json no
declara packageManager. No hay node_modules en el worktree al adoptar.
No hay pre-commit hook en la ruta Git resuelta ni core.hooksPath configurado.

Plan de instalación con GO, sin ejecutarlo aún:

    corepack pnpm install --frozen-lockfile --ignore-scripts --store-dir node_modules/.pnpm-store-0577

Store propia dentro de node_modules, ignorada por la regla existente /node_modules;
no se cambia ignore global/local, no se copia node_modules ajeno y la store se preserva.

Comando focal previsto, mismo para original y candidato salvo nombre exclusivo
del archivo de salida; ambas pruebas completas, 2 workers y retry 0:

    corepack pnpm test "app/p/[token]/supplier-flow.test.tsx" "app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.borrado.test.tsx" --maxWorkers=2 --retry=0 --reporter=default --reporter=json --outputFile="C:/tmp/director-traspaso-20261020/0577-fixtures-validation/original-01.vitest.json"

Guardar también log nativo exclusivo y resultado por caso/40 nombres únicos.
El original se ejecuta antes de editar tests. Si pasa, registrar PASÓ sin fabricar
una falla. El candidato conserva el mismo entorno y comando; perfil, si hace
falta, explícitamente separado y fuera del parche. No certificar mejora temporal
sin señal consistente; máximo dos pares adicionales justificados.

Firmas originales de títulos it, UTF-8 unidos por LF y LF final:
Portal 23 = a302d42af39bbc139f826442502812806fec36f65023f305c2930de01ff84eb5;
Embarques 17 = 66a9d5dded14c60a21d4570ebe0a073c322e41381702bdc12b99dd3aa4375f39.
La firma estática no sustituye los casos descubiertos/ejecutados por Vitest.

## COMMITS

Reserva: commit que contiene este documento. SHA y respaldo remoto se informan al
Director tras el push; no se crea una recursión de commits para insertar su propio hash.
No hay commits de implementación de tests en este checkpoint.

## PR / BRANCH

Rama propia indicada arriba; reserva documental en el commit que contiene este handoff. El recibo de push se confirma al Director tras el commit.
PR DRAFT base main pendiente de checkpoint funcional/revisión.
No se realizó integración ni despliegue.

## PENDIENTES DE ESTA TAREA

- Confirmar al Director SHA y respaldo remoto del commit selectivo de reserva.
- GO del Director para dependencias y original 40 sin instrumentar.
- Reparación mínima, candidato con los mismos 40 y revisión de todos los oráculos.
- Lint focal, numeración, documentación final, ciclo de conocimiento con turno.
- Checkpoint inmutable para Director/peer, PR DRAFT y aceptación de composición C3
  con canónica general y GO nuevo. No se declara cerrado antes de esa evidencia.

## FUERA DE ALCANCE DETECTADO

Historial C3 de env-example-contract; resultado final de recetas C3 ajenas;
producto/revisión de 0574; cualquier error ajeno de producto/config/runner.
Ninguno se absorbe silenciosamente en 0577. Gobernanza de UI/acciones nuevas:
no aplica, solo se reparan contratos existentes sin cambiar experiencia o datos reales.

## HANDOFF AL DIRECTOR

Devolver reserva/preflight y esperar GO pesado. El owner conserva el claim.
No se instaló, ejecutó test/status pesado/knowledge ni editó producto/tests.
La reserva mantiene preimágenes comunes y no transporta producto de C2.

Impacto documental: nueva spec 0577, índice generado y este handoff dentro de la rama.
Guardado/integración, estructura Graphify, cobertura semántica, Archify y preview
Obsidian se informarán por separado; por ahora están pendientes por turno y sin
publicación compartida. No se escribió memoria. El índice de esta base histórica muestra 0569-0576 como huecos locales; no significa que estén libres. Al componer se regenera conservando las specs de la rama receptora.