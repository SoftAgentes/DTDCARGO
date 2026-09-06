# Handoff local — extracción mínima de CI SDD-0349

Fecha: 2026-09-05 · Estado: lista-para-revision-local.
Owner: Worker 01a073a6-f21d-7483-9b74-4d9f3464c295.
Task ID: 2026-09-05-ci-harness-remediation, unidad A.
Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/ci-quality-extract-20260905.
Rama: codex/ci-quality-extract-20260905.
Base: origin/main@b8294664a1b4f9e25c423dd814f4813fa5b1be8f.
Destino posterior: revisión local por Director; pushes reservados al Director.

## EXTENSIÓN ACTUAL — SDD-0360

Task ID: 2026-09-05-destino-focus-extract. Estado: lista para revisión del Director.
La extracción CI c6ffc009 ya fue publicada por el Director como PR #34.
Su CI reportó el fallo de foco previo a Escape en DestinoCombobox; se incorpora
el arreglo real, sin alterar workflow, orden de gates o pruebas existentes.

Producto: ef99fca5fff6cf9b4562255370876313ffd7ced3; documentación de extracción:
3f9cd305caf9651ee2a4876c2ed1fb1f7ca8574d. Solo se fusiona esta rama selectiva,
no #21. El conflicto del índice se resuelve con su generador.
Allowlist adicional: los cinco paths de SDD-0360 y este handoff/spec0349 solo
para dependencia/alcance/evidencia. El workflow conserva el blob e9f3ad39.
Regresión: dos rojos deterministas y 13/13 focales después; navegador local
ficticio pasó foco, edición, Escape, flechas/Enter, selección y cursor con mouse.
Verify completo pasó en B/1206833d: 12 de 16 pasos medidos, sin fallos;
6191 unitarios, 12 del harness y build de 158 páginas. SKIPs separados:
ledger sin credenciales, SQL/schema sin Docker y E2E general omitido explícitamente.
A pasó 19/19 focales (13 del componente + 6 del contrato CI); docs/alcance
comprobados al cierre. Producto/configs/dependencias relevantes equivalentes
entre extracción/A/B; cambios posteriores solo documentales. Fuente durable:
[handoff SDD-0360](2026-09-05-destino-focus-extract.md).

Esta sesión no publica. Entrega SHA final al Director; main/producción quedan
fuera de alcance. El resto de este documento conserva la extracción CI inicial.

## OBJETIVO ORIGINAL

Extraer CI mínimo sin secretos de #21 sobre main, reutilizando SDD-0349 y
sin incorporar el saneamiento completo ni arreglos de producto.

## COMPLETADO

Workflow y contrato extraídos de #21 en
ea9952a47f4adf14c48c91e6d0147597beb94aa7.
Blobs de origen:

- quality.yml: e9f3ad39de30f5cafa85e0a52be24659b4002797.
- ci-workflow-contract.test.mjs: be255a24f694708669ae78533262d8aa7fa73792.
- spec.md SDD-0349: 8348e7674c602b498e510a3e694f7eb2a4b72597.

Workflow/test se conservan exactos; spec adaptada a esta extracción y al estado
de main; índice regenerado y handoff propio. Solo cinco paths de allowlist.
Los trece comandos referenciados existen; los wrappers/scripts de los gates
coinciden entre main y el SHA de origen. No se importaron package/lockfile,
devEngines, dependencias ni archivos de producto de #21.

Las tres referencias de actions fueron comprobadas vía GitHub API. El action
pnpm/setup fijado admite version/runtime/cache/install y corre en node24.
Se conservan SHAs completos, contents:read, persist-credentials:false,
instalación frozen-lockfile y ausencia de secretos, eventos privilegiados,
continue-on-error o bypass.

## VALIDACIÓN

- PASÓ: pnpm install --frozen-lockfile con Node 24.19.0 / pnpm 11.19.0.
  813 paquetes, sin resolver/cambiar lockfile. No se copió .env; solo .env.example.
- PASÓ: inventario de los trece comandos y referencias de actions.
- PASÓ: ESLint (0 errores, 8 warnings heredados), frontera RSC y TypeScript
  con heap 4096; prune-next-types no encontró residuos.
- PASÓ: Vitest completo, 502 archivos / 6187 pruebas, incluidos los seis
  contratos de CI de esta extracción; 216,70 segundos.
- PASÓ: docs:check, sdd:check, constantes, componentes y governance:check.
- PASÓ: cuatro Edge Functions con Deno 2.9.6. Primera corrida fue SKIP por
  ausencia local de Deno/npx; luego se usó VERIFY_DENO_BIN temporal, sin modificar
  el repo. SHA-256 del ZIP oficial verificado contra el digest de GitHub:
  15e5300b0ba3c3695a7621d90160a746ec9e710228cee639afa9d580f6e3cd11.
- BUILD: primer intento falló al descargar una fuente Noto Serif SC de
  fonts.gstatic.com; Turbopack mostró cuatro module-not-found derivados.
  app/layout.tsx, next.config.ts, package/lockfile y wrapper no difieren de main.
  PASÓ el reintento sin cambios: build con 158 páginas en 88 segundos y
  tsconfig.json restaurado. No se mockearon fuentes ni se omitieron checks.
- NO EJECUTADO: workflow en runner alojado (no push ni PR autorizados).
- NO EJECUTADO: SQL/E2E/ledger/producción, excluidos de este workflow y encargo.

Runner local usa los entrypoints Node que expanden los scripts pnpm, con CI=true
y NEXT_TELEMETRY_DISABLED=1. TypeScript/build reciben old-space=4096; se eliminan
variables de credenciales y flags VERIFY_SKIP del ambiente hijo. Ejecuta todos
los gates para observar fallos separados, aunque el job alojado se detiene en
el primer fallo. Esa diferencia no convierte fallos locales en verde de CI.

## COMMITS

Commit selectivo de los cinco paths. SHA final en el reporte del Worker,
sin crear otro commit para insertar el hash del propio documento.

## PR / BRANCH

Rama codex/ci-quality-extract-20260905. La entrega inicial no tenía PR;
el Director publicó después PR #34. La corrección actual queda local para revisión.
La PR #21 es fuente, no destino ni aprobación de esta unidad.

## PENDIENTES DE ESTA TAREA

Ninguno de implementación local. La ejecución alojada y la revisión/integración
requieren autorización posterior de publicación; no hay evidencia alojada de A.

## FUERA DE ALCANCE DETECTADO

main conserva manifiesto con pnpm.onlyBuiltDependencies que pnpm 11 advierte
como ignorado; pnpm-workspace.yaml ya tiene allowBuilds y frozen install pasó.
No se cambia el manifest por esta advertencia. Los ocho warnings ESLint y la
dependencia de red del build se registran sin importar correcciones de producto.

## HANDOFF AL DIRECTOR

B puede incorporar el commit A mediante merge local y añadir harness:test al
workflow, porque ese script no existe en main/A. El CI histórico de #21 no
prueba esta extracción ni la combinación posterior.
No publicar, actualizar PRs, integrar main, desplegar, modificar protecciones,
credenciales ni eliminar worktrees/ramas. Claim se libera al terminar escritura.
