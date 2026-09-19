# Handoff 0493 · las pruebas que no tocan el DOM corren en el entorno node

- Fecha: 2026-09-19. Estado de la tarea: **medida y probada en local**; falta el `verify` completo,
  el push único y la PR, que va **en ready**: no depende de ninguna migración.
- Owner/sesión: `worker-entorno-node-0493-20260919` (Claude Opus 5, Worker, sesión «Automatizar la
  prueba de carrera del for update de 0459»). Director: la sesión «Director notificación a workers»,
  que asignó la tarea, reservó la máquina para medir y ratificó el mecanismo.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/entorno-node-pruebas-0493`,
  creado con `harness-worktree start` desde `main` `dd764c66`.
- Rama: `codex/entorno-node-pruebas-0493`, sin upstream hasta el push.
- SDD: [0493](../../docs/specs/0493-entorno-node-pruebas/spec.md). Reservada en local con
  `corepack pnpm sdd:next --reserve entorno-node-pruebas` (`5c03d882`, cherry-pick del stub).
  Sin migración.
- Aislamiento comprobado antes de editar: toplevel y rama correctos, `guard` → `Guard OK`, claim
  adquirido. Antes de cada commit se revalida con `guard --owner`.
- Permisos del encargo: commits en esta rama; el push único y la PR en ready, con el aviso del
  Director. **No merge. No producción.**

## OBJETIVO ORIGINAL

El último punto del «Fuera de alcance» de la SDD-0486: todo archivo de vitest monta jsdom, aunque
sea Node puro. Esa spec lo midió (montar el entorno costó 6.863 s, 3.880 s y 3.312 s sumados,
contra 1.205 s, 700 s y 839 s de pruebas) y lo dejó para una spec aparte. El encargo pedía: detectar
por análisis y no a ojo, empezar por `scripts/__tests__` y `lib/`, usar el mecanismo del propio
vitest, medir antes y después con la máquina quieta y el mismo comando, y no cambiar el
comportamiento de ninguna prueba.

## COMPLETADO

- **El mecanismo.** `environmentMatchGlobs` ya no existe: vitest lo deprecó en la 3 y lo retiró en
  la 4, y el repo corre 4.1.7. Queda la anotación por archivo, que el repo ya usaba en 43 archivos,
  y `test.projects`. El Director ratificó la anotación: una línea por archivo, sin tocar la config
  ni sus herencias, con jsdom como default seguro y sin globs que mantener.
- **La clasificación**, por análisis estático del archivo y de todo lo que importa del repo:
  extensiones `.tsx`/`.jsx`, paquetes de DOM, globals del navegador, matchers de jest-dom e imports
  de `.css`, descartando comentarios. De 621 archivos: 43 ya anotados, 334 candidatos y 244 con DOM.
- **Las dos oleadas**, cada una con su corrida de caza: 281 archivos de `scripts/` y `lib/`, y
  después 53 de `app/` y otros. **Ninguno tuvo que volver a jsdom.**
- **Las mediciones**, con la máquina reservada por el Director y el mismo comando.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| Medición «antes», suite completa (`node node_modules/vitest/vitest.mjs run`) | 620 ✓ y 1 omitido · 8.105 ✓ y 1 omitida · pared 196,7 s · **environment 2.186,8 s** · tests 708,0 s |
| Caza de la oleada 1 (`scripts/` y `lib/`, 281 anotados) | **PASÓ**: 428 archivos y 6.039 pruebas en verde; 0 vuelven a jsdom |
| Suite completa tras la oleada 2 (53 anotados más) | **PASÓ**: mismos conteos que el antes · pared 120,9 s · **environment 739,3 s** |
| Segunda medición «después» | **PASÓ**: mismos conteos · pared 129,2 s · **environment 806,3 s** |
| Sonda del mecanismo | **PASÓ**: un archivo con la misma primera línea ve `window` y `document` sin definir. Se borró; no va en la PR |
| Archivos por entorno al final | **377 node** (43 previos + 334 nuevos) y **244 jsdom**: lib 279/109, app 40/111, scripts 34/4, otros 24/4, components 0/16 |
| `verify` completo | **PENDIENTE**: en este mismo turno |
| CI alojado | **NO EJECUTADO**: GitHub Actions bloqueado por facturación desde las 21:18Z |

**Lo que se ganó:** montar el entorno baja de 2.186,8 s a 739-806 s sumados (63-66 % menos) y la
pared de 196,7 s a 121-129 s (34-39 % menos), con las mismas 8.105 pruebas en verde y sin tocar una
sola aserción.

## COMMITS

| Commit | Propósito |
| --- | --- |
| `5c03d882` | `chore(sdd)`: la reserva de SDD-0493 (cherry-pick del stub) |

## PR / BRANCH

- Rama `codex/entorno-node-pruebas-0493`, base `main`, worktree de arriba. No está publicada.
- **La PR va en ready**, no en draft: no depende de ninguna migración. Va a quedar sin CI hasta que
  se destrabe la facturación de GitHub Actions.

## PENDIENTES DE ESTA TAREA

1. El `verify` completo y el push único, con el número y el SHA por mensaje al Director.
2. Liberar el claim. El worktree y la rama se conservan.

## FUERA DE ALCANCE DETECTADO

1. **Quedan 244 archivos en jsdom**, la mayoría de `app/` y `components/`. Algunos pueden ser falsos
   positivos del análisis (mencionan `window` en un mock trivial, o arrastran un `.tsx` que no
   renderizan). Repasarlos uno por uno es otra tarea.
2. **`setupFiles` carga `@testing-library/jest-dom/vitest` también en node.** No rompe, pero es
   trabajo de más; separarlo pide `projects`.
3. **La medición de la CI no se puede hacer hoy**, con Actions bloqueado. El número de esta spec es
   de esta máquina; el del CI se verá cuando vuelva.

## IMPACTO DOCUMENTAL

- **Canónico:** la spec 0493 y el índice regenerado.
- **Documentación en código:** la primera línea de cada archivo anotado dice en qué entorno corre.
- **No aplica:** `BRAND.md`, `docs/design/**`, `docs/marketing/**` y `revisar-datos-ve`: es harness,
  sin UI ni datos.
- **Graphify, Archify y vista previa de Obsidian: NO EJECUTADOS.** Quedan para el Director.

## Reproducible (fuera del repo)

Los tres scripts viven en el scratchpad de la sesión, no en el repo.

- `analizar-dom-0493.cjs <worktree> --json <salida>`: clasifica los 621 archivos y deja el json.
- `anotar-node-0493.cjs <worktree> <analisis.json> <grupos> [--quitar] [--solo lista]`: pone o
  quita la primera línea, sin tocar nada más. Es idempotente.
- `medir-0493.cjs <log...>` y `contar-entornos-0493.cjs <worktree>`: sacan la tabla de la spec.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** el `verify` completo y el push, en este turno.
- **Cambios compartidos:** una línea en 334 archivos de prueba y la spec. Sin config, sin producto.
- **Dependencias:** ninguna. No toca migraciones ni despliegue.
- **Sesiones consumidoras:** ninguna. El claim se libera al abrir la PR.
