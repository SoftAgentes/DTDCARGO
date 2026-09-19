---
sdd: "0493"
title: "Las pruebas que no tocan el DOM corren en el entorno node"
status: in-progress
author: "Sam + Claude Opus 5 (Worker)"
created: 2026-09-19
updated: 2026-09-19
supersedes: null
superseded_by: null
related: ["0486"]
confidencialidad: interno
---

# SDD-0493 — Las pruebas que no tocan el DOM corren en el entorno node

## Contexto

Es el último punto del «Fuera de alcance» de la SDD-0486, que lo midió y lo dejó
anotado para una spec aparte: **todo archivo de vitest monta jsdom, aunque sea
Node puro**. En sus tres corridas, montar el entorno costó 6.863 s, 3.880 s y
3.312 s sumados, contra 1.205 s, 700 s y 839 s de las pruebas mismas. El paso
«Unitarios» es hoy la parte más larga del CI de cada PR.

El Director asignó la tarea el 2026-09-19, sin migración y sin decisiones de
Sam, para que pueda salir apenas se destrabe el CI.

## Decisiones

### El mecanismo: la anotación por archivo

`environmentMatchGlobs`, la primera opción del encargo, **ya no existe**: se
deprecó en vitest 3 y se retiró en la 4. El repo corre vitest 4.1.7 y la opción
no aparece en el paquete. Quedaban la anotación por archivo
(`// @vitest-environment node`, que el repo ya usaba en 43 archivos) y
`test.projects`.

Se eligió la anotación, y el Director la ratificó:

- el diff es de una línea por archivo, todas iguales, y cada archivo dice en su
  primera línea en qué entorno corre;
- no toca `vitest.config.ts`, así que no hay que replicar ni heredar sus
  opciones (timeouts de 20 s, `setupFiles`, alias `@/` y `server-only`,
  `globals`), que es donde `projects` se complica;
- el default sigue siendo jsdom: una prueba nueva con DOM no se rompe por
  olvido, y el olvido sólo cuesta tiempo, no un rojo;
- sobrevive a mover un archivo de carpeta, cosa que un glob no.

### Qué cuenta como DOM

La clasificación es por análisis estático del archivo **y de todo lo que importa
del repo**, no a ojo. Marca jsdom si aparece:

- una extensión `.tsx` o `.jsx` en la cadena de imports;
- un paquete de DOM: `@testing-library/*`, `jsdom`, `happy-dom`, `react-dom`,
  `next/image`, `next/font`, `@radix-ui/*`, `recharts`, `framer-motion`…;
- un global del navegador: `document`, `window`, `navigator`, `localStorage`,
  `sessionStorage`, `HTMLElement`, `getComputedStyle`, `matchMedia`,
  `FileReader`, `IntersectionObserver`, `ResizeObserver`, `MutationObserver`,
  `requestAnimationFrame`, `DOMParser`, `XMLHttpRequest`, `customElements`…;
- un matcher de jest-dom (`toBeInTheDocument`, `toHaveClass`…);
- un import de `.css`.

Los comentarios se descartan antes de buscar. Un archivo con su propia
anotación se respeta y no se toca.

## Alcance

### Qué cambia

- La primera línea `// @vitest-environment node` en los archivos de prueba que
  no tocan el DOM. Nada más: ni una aserción, ni un caso, ni la configuración.

### Qué no cambia

- `vitest.config.ts`, `vitest.setup.ts` y el entorno por defecto (jsdom).
- El comportamiento de ninguna prueba.

### Allowlist exacta

- 334 archivos `*.test.*`, con una línea nueva cada uno y nada más. El reparto
  por carpeta está en «Evidencia».
- `docs/specs/0493-entorno-node-pruebas/spec.md` y `docs/specs/README.md`
  (regenerado)
- `.agents/handoffs/0493-entorno-node-pruebas.md`

## Aceptación

1. Las pruebas anotadas pasan en `node` sin cambiar ninguna aserción.
2. La que falle en `node` vuelve a jsdom, con su motivo anotado.
3. Medición antes y después, con la máquina quieta y el mismo comando
   (`node node_modules/vitest/vitest.mjs run`), con el desglose de `environment`.
4. `pnpm verify` completo.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.06 (prevenir antes de informar) | **no aplica** | No cambia comportamiento de producto. |
| Calidad del gate (`pnpm verify`) | **cumplimiento** | No se debilita ninguna prueba: mismas aserciones, mismo conteo. |
| SGE-00.07 / BTN-01 (UI) | **no aplica** | No hay UI. |

## Release

- Sin migración y sin bandera. Se integra y se despliega como cualquier cambio
  de harness; no toca producto.

## Evidencia

Las tres corridas son del **mismo comando**,
`node node_modules/vitest/vitest.mjs run` (el que usa `verify`), en el mismo
worktree y con la máquina quieta: el Director reservó el turno y nadie más
corrió nada.

| Corrida | Pared | `environment` | `tests` | `setup` | `import` | `transform` |
|---|---:|---:|---:|---:|---:|---:|
| antes | 196,7 s | **2.186,8 s** | 708,0 s | 321,7 s | 306,2 s | 67,7 s |
| después 1 | 120,9 s | **739,3 s** | 730,0 s | 294,7 s | 225,7 s | 63,8 s |
| después 2 | 129,2 s | **806,3 s** | 737,2 s | 333,3 s | 244,2 s | 79,0 s |
| el paso `test` del `verify` | 121,2 s | **749,3 s** | 741,5 s | 271,7 s | 233,2 s | 73,7 s |

Las columnas son las que imprime vitest al cerrar: sumadas sobre todos los
archivos, no de pared. `environment` es lo que cuesta montar jsdom o node.

- **Montar el entorno baja de 2.186,8 s a 739-806 s: entre 63 % y 66 % menos.**
- **La pared baja de 196,7 s a 121-129 s: entre 34 % y 39 % menos.**
- El tiempo de las pruebas no se mueve (708 → 730-737 s, dentro del ruido de
  dos corridas): no se tocó ninguna aserción.
- **Los conteos son idénticos** antes y después: 620 archivos en verde y 1
  omitido; 8.105 pruebas en verde y 1 omitida.

Archivos por entorno al terminar: **377 en `node`** (43 que ya lo estaban más
334 nuevos) y **244 en `jsdom`**.

| Carpeta | node | jsdom |
|---|---:|---:|
| `lib/` | 279 | 109 |
| `app/` | 40 | 111 |
| `scripts/` | 34 | 4 |
| otros | 24 | 4 |
| `components/` | 0 | 16 |

- **Ninguno volvió a jsdom.** Las dos oleadas pasaron a la primera: la corrida
  de caza de la primera (281 archivos de `scripts/` y `lib/`) dio 428 archivos
  y 6.039 pruebas en verde, y la suite completa después de la segunda (53 de
  `app/` y otros) dio los mismos conteos que el antes.
- **La anotación hace lo que dice.** Una sonda desechable con esa misma primera
  línea comprobó que `window` y `document` no existen; se borró enseguida y no
  va en la PR.
- **`pnpm verify` completo** sobre `abbbbb84`, en el mismo turno, el 2026-09-19
  de 22:24 a 22:41 UTC: **16 de 17 pasos PASARON y ninguno falló.**
  - test: las mismas 8.105 ✓ y 1 omitida, con la tercera medición de la tabla;
  - sql-tests (218 contratos), schema-rebuild, build, typecheck;
  - lint: 0 errores y 15 avisos, todos en archivos ajenos;
  - e2e: 166 ✓ y 2 flaky ajenos (el selector combinado de la calculadora
    pública). El paso quedó **OK con aviso**: el proceso salió ≠0 por el worker
    de WebKit que no cierra en Windows, que el propio `verify` distingue de una
    regresión;
  - `migrations-applied`: **NO DISPONIBLE**, sin credenciales en el worktree.
    Esta spec no trae migración.

## Fuera de alcance detectado

1. **Quedan 244 archivos en jsdom**, la mayoría de `app/` y `components/`, que
   sí renderizan. Algunos pueden ser falsos positivos del análisis (mencionan
   `window` en un mock trivial, o arrastran un `.tsx` que no rendericen). Ese
   repaso, uno por uno, es otra tarea.
2. **`setupFiles` carga `@testing-library/jest-dom/vitest` también en `node`.**
   No rompe —los 377 archivos pasan— pero es trabajo que no hace falta ahí.
   Separarlo pide `projects`, que es justo lo que esta spec evitó.
3. **`environmentMatchGlobs` no vuelve:** vitest lo retiró en la 4. Si alguien
   lo busca en la documentación vieja, que lea esta spec primero.
