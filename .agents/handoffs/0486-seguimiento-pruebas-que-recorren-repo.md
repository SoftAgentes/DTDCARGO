# Handoff · seguimiento de la SDD-0486: las cuatro que recorren el repo, y el registro

- Fecha: 2026-09-19. Estado de la tarea: **medida y aplicada en local**; falta el `verify` completo,
  el push único y la PR, que va **en ready**: no hay migración ni decisión de Sam.
- Owner/sesión: `worker-pruebas-repo-0486-20260919` (Claude Opus 5, Worker, sesión «Automatizar la
  prueba de carrera del for update de 0459»). Director: la sesión «Director notificación a workers»,
  que asignó el seguimiento y reservó la máquina para medir.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pruebas-que-recorren-repo-0486`,
  creado con `harness-worktree start` desde `main` `dd764c66`.
- Rama: `codex/pruebas-que-recorren-repo-0486`, sin upstream hasta el push.
- SDD: **sin número nuevo**. Va como sección fechada en la
  [0486](../../docs/specs/0486-estabilizar-pruebas-intermitentes/spec.md), porque los hallazgos son
  de su «Fuera de alcance».
- Aislamiento comprobado antes de editar: toplevel y rama correctos, `guard` → `Guard OK`, claim
  adquirido. Antes de cada commit se revalida con `guard --owner`.
- Permisos del encargo: commits en esta rama; el push único y la PR en ready, con el aviso del
  Director. **No merge. No producción.**

## OBJETIVO ORIGINAL

Los dos últimos puntos del «Fuera de alcance» de la SDD-0486:

1. las cuatro pruebas que recorren el repo (`env-example-contract`, `copy-sin-casco-central`,
   `vis-02-font-tokens`, `json-ld-escape-contract`), con el patrón que ya funcionó en
   `invoice-read-boundary`: lectura en paralelo con tope y prefiltro barato antes de parsear;
2. `register-error-summary`, con la hipótesis sin concluir `userEvent.setup({ delay: null })`:
   medirla y aplicarla sólo si mejora de verdad.

Sin cambiar el inventario ni las aserciones.

## COMPLETADO

- **Una corrección de premisa, medida antes de tocar nada.** Aisladas y con la máquina quieta, esas
  cuatro pruebas tardan 1,2-2,1 s, no los 30-90 s del encargo. Esos números son de la suite completa
  bajo contención, que es la única disposición donde existe el problema. Así que el antes/después se
  midió **dentro de la suite completa**, con la máquina reservada, no archivo por archivo.
- **Los cuatro archivos**, con el patrón de `invoice-read-boundary`: lectura en paralelo con tope de
  32; `withFileTypes` en vez de un `statSync` por entrada en `copy-sin-casco-central`; una sola
  lectura compartida por las tres pruebas de `json-ld-escape-contract`; y prefiltro por «casco»
  antes de quitar comentarios, con su propia prueba de que no se le escapa un caso. En
  `env-example-contract` no hay parseo, así que el prefiltro no aplica y se dijo en la spec.
- **`register-error-summary` con `delay: null`**, medido tres veces de cada lado y con la prueba de
  mutación que el propio archivo documenta.
- **La sección fechada en la spec 0486**, con las dos tablas y las dos honestidades (el ruido de
  planificación y que la pared de la suite no se mueve).

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| Antes, aisladas y con la máquina quieta | 1,2-2,1 s cada una (y 31,7 s la primera corrida de `env-example`, en frío). **No es la disposición del problema**: por eso se midió en la suite |
| Antes, dentro de la suite completa (`--reporter=json`) | json-ld 27,61 s · env-example 16,85 s · register 9,58 s · vis-02 8,19 s · copy-sin-casco 4,83 s |
| Después, misma corrida | **json-ld 0,87 s · env-example 3,09 s · register 4,52 s · vis-02 0,73 s · copy-sin-casco 0,51 s** |
| Totales de la suite | 700,0 → 657,0 s de suma de duraciones (mismo reporter, misma disposición). **Pared sin cambio**: 196,69 s antes, 197,05 s después y 172,46 s en el `verify` |
| Los agregados de la suite **no sirven** para medir esto | El `tests` sumado dio 708,0 s antes, y 528,0 s y 692,9 s en dos corridas con el MISMO código después. Varía demasiado entre corridas: la primera versión de este handoff le sacó un −25 % y se corrigió antes de la PR. Lo comparable es la tabla por archivo |
| `register-error-summary` aislada, 3 corridas de cada lado | pruebas 5,04-5,12 s → **1,34-1,39 s**; pared 6,33-6,40 s → **2,58-2,64 s** |
| Mutación documentada (borrar `fieldErrors.length > 0` de `StepConfirmar`) con `delay: null` | **Las 3 pruebas en rojo**, y el fuente restituido con md5 idéntico: la prueba sigue afirmando lo mismo |
| Conteos de la suite | 8.106 → **8.107** pruebas, sin fallos. La de más es la del prefiltro |
| `verify` completo sobre `e52d5f8d`, 23:02-23:16 UTC | **16 de 17 PASARON y ninguno FALLÓ.** test (8.106 ✓ y 1 omitida), sql-tests, schema-rebuild, e2e (166 ✓, 2 flaky ajenos), build, typecheck y lint (0 errores, 15 avisos ajenos). `migrations-applied`: NO DISPONIBLE, sin credenciales; no hay migración |
| CI alojado | **NO EJECUTADO**: GitHub Actions bloqueado por facturación desde las 21:18Z |

**Ruido honesto:** `invoice-read-boundary`, que nadie tocó, pasó de 2,85 s a 5,19 s en esa misma
corrida. Ese número incluye lo que el archivo espera mientras 21 workers se pelean la máquina;
cuando los demás terminan antes, el reparto cambia. No es una regresión suya.

## COMMITS

| Commit | Propósito |
| --- | --- |
| este | `test(harness)`: las cinco pruebas, con el patrón de `invoice-read-boundary` |
| el siguiente | `docs(SDD-0486)`: la sección fechada del seguimiento y este handoff |

## PR / BRANCH

- Rama `codex/pruebas-que-recorren-repo-0486`, base `main`. **La PR va en ready**: no depende de
  ninguna migración. Va a quedar sin CI hasta que se destrabe la facturación de GitHub Actions.

## PENDIENTES DE ESTA TAREA

1. El `verify` completo, el push único y la PR en ready, con el número y el SHA al Director.
2. Liberar el claim y devolverle la máquina.

## FUERA DE ALCANCE DETECTADO

1. **La pared de la suite la manda el montaje de jsdom** (2.186-2.205 s sumados), no estas cinco.
   Lo arregla la SDD-0493 (PR #173), que es complementaria: una baja el entorno y otra el trabajo.
2. **`norte-bake.test.mjs`** sigue como en la 0486: su subproceso tarda 1,4-2,4 s solo.
3. **Las otras pruebas que recorren el árbol** (las que la 0486 no listó) no se revisaron una por
   una; el patrón ya está escrito y es mecánico de aplicar.

## IMPACTO DOCUMENTAL

- **Canónico:** la sección fechada de la spec 0486. Sin spec nueva, por decisión del Director.
- **Documentación en código:** cada archivo explica en su comentario por qué lee en paralelo, por
  qué usa `withFileTypes` y qué garantiza el prefiltro.
- **No aplica:** `BRAND.md`, `docs/design/**`, `docs/marketing/**` y `revisar-datos-ve`.
- **Graphify, Archify y vista previa de Obsidian: NO EJECUTADOS.**

## Reproducible (fuera del repo)

- `medir-pruebas-0486.cjs <worktree> <rondas> <etiqueta> <archivo...>`: corre archivos aislados y
  saca sus tiempos.
- `extraer-suite-0486.cjs <reporte.json...>`: saca de los JSON de vitest la duración por archivo
  dentro de la suite, que es la comparación que vale.
- `mutante-registro-0486.cjs <worktree>`: aplica la mutación documentada de `RegisterForm`, corre la
  prueba y restituye el fuente con md5.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** el `verify` completo y el push, en este turno.
- **Cambios compartidos:** cinco archivos de prueba y la spec 0486. Sin producto, sin config.
- **Dependencias:** ninguna. Complementa a la #173, no choca con ella: tocan archivos distintos.
- **Sesiones consumidoras:** ninguna. El claim se libera al abrir la PR.
