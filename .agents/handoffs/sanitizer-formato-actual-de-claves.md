# Worker · sanitizer-formato-actual-de-claves

- Fecha: 2026-09-10.
- Owner/sesión: `worker-sanitizer-0452-20260910-root`; misma tarea reanudada por Sam.
- Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sanitizer-formato-actual-de-claves`.
- Rama: `codex/sanitizer-formato-actual-de-claves`.
- Base inicial: `b7ad23977b1905a25ba3154e52238f0e7baaaaa4`; base anterior: `ad4958224239393e87780c36b39bf52b3350a69b`.
- Base incorporada para el cierre: `e325cb4deb7d11375aa2dbca348496177d1e4350`.
- Reanudación: árbol limpio en `d54f232c`, guard aprobado y claim anterior liberado según handoff; se reclamó el mismo owner antes de escribir.
- Estado: lista-para-revision; SDD-0452 `done`. Cierre funcional completo con
  límites de entorno documentados; PR #61 permanece en borrador.

## OBJETIVO ORIGINAL

Cerrar los huecos del sanitizador del Bug Reporter: descubrimiento automático del harness, pruebas del módulo real en verify/CI y formatos actuales de claves. Esta reanudación cierra SDD-0452 registrando la sobre-redacción elegida por el Director, actualizando la base y conservando la detección existente.

## Contrato de esta reanudación

- Aceptación: conservar los tres vectores adversariales e invertir su expectativa a redacción completa; motivo en la prueba y trade-offs en la spec; mantener intactas las otras 92 pruebas; incorporar origin/main; validar y dejar SDD done, índice y handoff actualizados.
- Allowlist: `scripts/tests/bug-sanitizer.test.ts`, `docs/specs/0452-sanitizer-formato-actual-de-claves/**`, `docs/specs/README.md` generado, este handoff y descripción de PR #61.
- Excluidos: `lib/studio/bug-sanitizer.ts`, aflojar detección, `docs/archive/**`, workflows, `scripts/verify.mjs`, ruleset y otro producto. Sin claves reales en archivos, rotación, datos de producción ni número SDD nuevo.
- Permisos: commits selectivos, merge de origin/main en esta rama, push explícito de rama a sí misma y descripción de #61. No integrar a main, sacar de borrador, desplegar, reescribir historia ni eliminar ramas/worktrees.
- Dependencias: ninguna; la tarea paralela del bloque C no toca estos archivos.
- Subagente `audit_cierre`: revisión solo lectura; sin ownership propio ni archivos de escritura asignados.

## COMPLETADO

- Criterio 5 resuelto por decisión del Director comunicada por Sam el 2026-09-10. Se acepta la redacción de las tres colisiones sintéticas; se conserva cada vector y ahora se exige `[REDACTED]`.
- Medición atribuida al Director: cero identificadores reales de esas formas en app/lib/scripts/supabase. Perder un código de error requiere una consulta; filtrar service-role puede comprometer la DB. Exigir mayúsculas sería probabilístico y podría omitir claves válidas.
- Revisión futura: colisión real que afecte diagnóstico o evidencia primaria de un discriminador garantizado, con nueva decisión explícita sin perder detección. No es aceptación general de perder contexto.
- Los 92 casos anteriores permanecen idénticos (comparación normalizando CRLF); no se cambió ninguna aserción de detección. Patrón/sanitizador intacto respecto a `d54f232c`, confirmado por diff y SHA-256.
- Main `e325cb4d` incorporado mediante merge `e736c089`, preservando historia. No hubo conflicto de índice.
- Se conservan los resultados de la implementación original: discovery de seis archivos Node con E1, wrapper inline sobre módulo real y cobertura de formatos. Su rojo/verde y los recibos anteriores están identificados como históricos en `validacion.md`.
- SDD en `done`, índice regenerado con `corepack pnpm docs:index` y cierre
  documentado. Commits selectivos y publicación en la misma rama/PR autorizadas.

## VALIDACIÓN

Alcance: merge `e736c089b393ae89786e497726bbfecf76bb4088` más los cambios de cierre permitidos; comprobaciones documentales repetidas tras poner done.

- PASÓ: guard/claim, suite focal 95/95, `corepack pnpm harness:test` 26/26 en seis archivos (E1 5/5; discovery 3/3).
- PASÓ dentro de `corepack pnpm verify`: harness 18/18, lint (0 errores, 8 avisos previos), rsc-boundary (1597 módulos), typecheck, cuatro Edge Functions, test 6621/6621 en 522 archivos, docs:check (409 specs), numbering, feature-constants, components:check, governance:check y pending-migration-symbols.
- PASÓ: 156 contratos SQL con rollback; schema reconstruido con 396 migraciones y 18 solo-ledger; aislamiento sobre 219 tablas y fixtures de dos tenants, todo en Postgres desechable.
- NO DISPONIBLE: migrations-applied por URL/service-role ausentes, sin consulta a producción.
- NO DISPONIBLE: E2E por URL/ANON_KEY ausentes en `proxy.ts:67`. Primera pasada
  parcial, interrumpida tras 464 segundos sin salida; se detuvo solo su árbol
  verificado por PID, para permitir el retry. El reintento completo dio 152 pass /
  15 fail / 1 flaky / 18 skip, exit 1. Los 15 fallos son cinco casos de auth/search
  en tres proyectos; el flaky de acceso fue `net::ERR_ABORTED` recuperado.
- PASÓ: build + postbuild, 160 páginas estáticas y tsconfig restaurado. Avisos
  de datos Supabase ausentes durante prerender, sin fallo del build.
- PASÓ: índice regenerado, `corepack pnpm docs:check`, `corepack pnpm sdd:check`,
  `git diff --check`, revisión de allowlist e invariantes.
- Recibo actual fuera de Git: `%TEMP%/dtd-sanitizer-0452-cierre-20260910/verify.log`. Evidencia histórica en `validacion.md`.
- Sanitizador SHA-256: `DFF87AB66D6CB8482B4F292D624C524187022488613FF0920A05D9BC8AA2EAF9`.
- Suite de cierre SHA-256: `9D15ED5F55738415CAC79E3E9A7684AB52B7576C060986C3E9A09E763D0B557C`.

`corepack pnpm verify`: **FALLÓ, exit 1**, 16/17 pasos ejecutados; quince PASARON,
E2E NO DISPONIBLE por entorno y ledger NO DISPONIBLE. Sin banderas de skip.
Veredicto literal sin ANSI:

```text
   16 de 17 pasos corrieron de verdad
[AVISO] omitido: migrations-applied — no se midio (ver su [SKIP] arriba)
[FAIL] verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.
```

NO EJECUTADO: validación autenticada con credenciales reales, integración,
rotación y despliegue; excluidos de este encargo. Desglose por comprobación,
recibos históricos y detalle de interrupción en `validacion.md`.

## COMMITS

- `6681e2ac7551d0ab59258920facd9461f156ce11`: implementación y 92 casos iniciales.
- `946e9a4d82b02c25d5271830cbf48cc85f7f3408`: incorporar la base anterior.
- `d54f232c6345f99e66d4eb4ec8a74c043eff3268`: tres adversariales y bloqueo anterior, conservado en historia.
- `e736c089b393ae89786e497726bbfecf76bb4088`: incorporar origin/main e325cb4d en esta rama.
- Commit que contiene este documento: conducta elegida en las tres pruebas,
  trade-offs y SDD done, índice y evidencia de cierre. Hash final en PR/respuesta,
  sin recursión del propio handoff.

## PR / BRANCH

[PR #61](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/61), OPEN / DRAFT contra
`main`. Rama y worktree indicados arriba. El cierre se publica explícitamente
de esta rama a sí misma y la descripción se actualiza con su SHA final. El verde
de CI histórico no valida este cierre; consultar siempre la corrida del SHA
publicado. No se solicita ni ejecuta salida de borrador o merge.

## PENDIENTES DE ESTA TAREA

Ninguno de implementación o aceptación del cierre autorizado. La revisión de
integración/CI del SHA publicado y las coberturas no disponibles conservan su
frontera propia; no reabren la decisión de sobre-redacción ni autorizan producción.

## FUERA DE ALCANCE DETECTADO

- `scripts/verify.mjs` conserva lista manual de cuatro archivos Node: E1/discovery corren en harness:test y CI, pero no en el paso harness de verify. Recomendar unificación en otra tarea; no se cambia aquí.
- Defecto previo: `redactTokensInText` puede perder hostname en una URL normal con query; `redactUrl` la conserva. Repro sintético en spec; no se repara.
- Límites heurísticos previos de JWT/Bearer/Basic; no se ensanchan en este encargo.
- Entorno Supabase ausente, avisos de lint previos y navegación E2E transitoria; no se reparan con credenciales ni cambios de producto ajenos.
- Incidente de revisión: un comando `rg` del subagente devolvió rutas fuera de las previstas y salida truncada. Se detuvieron esas búsquedas; no hubo escrituras ni copia de claves. No se puede certificar que ese comando excluyera `docs/archive/**`, ni afirmar que lo leyó. No se demostró la causa exacta. Las conclusiones de revisión usan lecturas explícitas de pruebas, proxy y recibos sintéticos, no esa salida.

## HANDOFF AL DIRECTOR

Revisar el SHA final de la PR #61, su diff de cierre y los límites de validación;
mantener la PR en borrador. SDD `done` no significa integración ni certificación
de E2E autenticado. Integración y producción requieren autorización propia.

Al entregar se libera `worker-sanitizer-0452-20260910-root` tras verificar el push
y la descripción; confirmación final en la respuesta. Subagentes solo lectura
terminados; la corrida de verify terminó. Worktree y rama se conservan. No hubo
integración a main, despliegue manual, rotación, cambios de patrones en esta
reanudación ni operaciones sobre datos de producción. Consultar el incidente
de búsqueda antes de afirmar exclusión total de lectura del árbol archivado.
