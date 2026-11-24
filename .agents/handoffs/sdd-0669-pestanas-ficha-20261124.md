# SDD-0669 · Reparación de pestañas

Owner: `codex-sdd-0669-tabs-ficha-20261124`.
Sesión: `orca_session_id:46aead10-9518-46de-a8a1-ff17f22d2c35`.
Task: `task_e58170f22efc`. Dispatch: `ctx_f51eeedb9a05`.
Ruta: `C:/Users/AKX generator/Desktop/Developer/Orca/DTDCARGO/sdd-0669-pestanas-ficha-20261124`.
Rama: `SoftAgentes/sdd-0669-pestanas-ficha-20261124`.
Base: `8580490f8d95872a407ab83ab9acb6b1b265a451`.

## OBJETIVO ORIGINAL

Restablecer cuatro paneles de la ficha con History API y permisos existentes.
Edición, pruebas, commits y publicación de rama/PR autorizados; sin merge,
deploy, consultas de identidad ni escrituras de datos.

## COMPLETADO

Cambio a estado externo `null` para permitir sincronización de Next.
Regresión reactiva sin `rerender` manual; cuatro paneles, teclado, foco del
enlace rápido, árbol interno, parámetros, estado montado y selección por URL.

Lectura de `app/studio/(app)/clientes/[markbox]/page.tsx`: Historial de envíos,
`DocsPanel` / `TodosLosAdjuntos` y tarjetas `AdvisorAssignCard` /
`IdentityVerificationCard` presentes. No se editó page ni layout.

## VALIDACIÓN

- Guard y claim: PASÓ.
- Instalación congelada: PASÓ, `corepack pnpm install --frozen-lockfile`, pnpm
  11.19.0; Next 16.4.6. Lockfile sin cambios.
- Regresión en base: FALLÓ como se esperaba al restaurar únicamente la llamada
  anterior a `replaceState`; 6 fallos de panel visible y 15 casos verdes en
  `ficha-pestanas.test.tsx` (21 casos). Log local:
  `%TEMP%/sdd-0669-regresion-base.log`. El archivo de producto se restauró en `finally`.
- Corrección: PASÓ, 3 archivos y 73 pruebas, 22.83 s, exit 0. Comando:
  `node node_modules/vitest/vitest.mjs run "app/studio/(app)/clientes/__tests__/ficha-pestanas.test.tsx" "app/studio/(app)/clientes/__tests__/ficha-cliente-page.test.tsx" "lib/studio/__tests__/ficha-cliente.test.ts" --maxWorkers=1`.
- ESLint de ambos archivos de código: PASÓ, exit 0.
- `docs:check`, `governance:check`, `components:check`, `sdd:check` y
  `git diff --check`: PASÓ. Numeración conserva excepciones históricas aplicadas.
- `pnpm verify` local: NO EJECUTADO; Director lo delega al CI de la PR.
- Implementación instalada de Next: VERIFICADA en
  `node_modules/next/dist/client/components/app-router.js:302-313`, retorno temprano
  con `__NA` / `_N`; estado externo copia el árbol antes de avisar al router.
- GUI y navegación real: NO EJECUTADO; el doble reproduce el contrato de History,
  no ejecuta Next real. Remontar desde la URL no es una recarga de navegador.
  El arnés general existente requiere entorno de prueba y lecturas dobladas de
  la página; no hay una ruta focal de ficha aislada con fixtures en la allowlist.
  No se añadieron rutas ni se levantó un servidor; la aceptación GUI queda pendiente.

Gobernanza: Studio / Clientes; riesgo R2 (navegación). A11Y-01 v1.1 y BTN-01
v1.3: cumplimiento en código del contrato tab/panel, controles nativos y foco;
gate focal automático pasó. Contraste, zoom y lector: NO VERIFICADO en esta
reparación sin cambios de presentación. Privacidad: no aplica a captura o
movimiento de datos; fixtures ficticios, sin consultas externas de identidad.

## COMMITS

`73ece07ef` — corrección, regresión y documentación de SDD-0669.
El commit posterior solo cierra este handoff con PR y pendientes de CI.

## PR / BRANCH

[PR #808](https://github.com/SoftAgentes/DTDCARGO/pull/808), base `main`, rama
propia publicada. Se marca lista tras publicar este handoff para activar
Quality en su cabeza final; SHA y corrida exactos se reportan al Director
mediante el despacho. No se fusiona ni se despliega.

## PENDIENTES DE ESTA TAREA

Quality global queda en CI de #808 para seguimiento del Director; no se declara
verde antes de su resultado. Claim se libera al finalizar la escritura.
PC liberada y avisada al Director mediante
`msg_b6c4d4cbec02`, después de cerrar pruebas y ESLint.

## FUERA DE ALCANCE DETECTADO

Accesos y tarjetas compartidas de Clientes: reservados al Worker 0715.
El validador del plugin instalado 0.1.2 falla con
`policy-registry.json está desactualizado`; su registro derivado lista BTN-01
v1.1 mientras la política normativa del repo es v1.3. Cápsula canónica vigente
(29 políticas), validación de componentes y docs pasan; no se modificó el plugin.

## HANDOFF AL DIRECTOR

Priorizar cierre y asignar turno. Impacto documental: spec ampliada con alcance
exacto y contrato de navegación. No se marca completa la SDD original: conserva
sus criterios y pendientes históricos, separados de esta reparación.
La corrección focal está validada; la prueba de navegador real permanece
NO EJECUTADA. Lección del contrato de History registrada en el buzón privado,
sin trasladar contenido privado al repo público.
