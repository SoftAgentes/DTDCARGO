# Handoff: SDD-0656, oleada A2 (minors y patches)

- **Owner:** Claude Worker (`sdd-0656-a2`).
- **Autorización:** Sam la dio directo en esta sesión el 2026-11-17: «Vamos a arrancar la segunda oleada aquí. Dile, director.» El DG la registró y puso condiciones.
- **Rama:** `claude/0656-a2-minors`, con base en `origin/main` `c20cc7460` (incluye la A1, #636).
- **Alcance:** las versiones de la tabla de la PR. No hay majors y no hay paquetes fuera de la lista.

## Transitivas fuera de la lista (avisadas al DG antes de publicar)

- `@emnapi/core` y `@emnapi/runtime` 2.0.0-beta.2, que llegan por rolldown 1.2.19 desde `vite` 8.3.8.
- `pdfkit` 0.20.1 reemplaza a `@react-pdf/pdfkit` 5.1.1, por `@react-pdf/renderer` 4.9.
- `scheduler` 0.28.0, por React 19.3.1.

## Validación (Windows, Node 24.22.1 local, pnpm 11.19.0)

| Comprobación | Resultado |
|---|---|
| `install --frozen-lockfile` | PASÓ |
| `typecheck` | PASÓ |
| `lint` | PASÓ: 0 errores, 32 advertencias, las mismas que en la A1 |
| `test` | 2 fallas en la corrida completa (18.802 pasaron) |
| `build` | PASÓ |
| e2e chromium completo | 12 fallas y 16 inestables, casi todas por `page.goto` agotado en `next dev` |
| e2e mobile-chrome y mobile-safari | NO EJECUTADO, porque WebKit en Windows deja procesos colgados |

Detalle de las dos fallas de `test`:
- `SharedSupplierDocument.test.tsx` pasó 4 de 4 veces corrido solo.
- `migraciones.test.mjs` se agotó a los 600 s bajo carga, y solo pasó 30/30 en 4 min 34 s.

Comparación del e2e chromium sobre los mismos 6 archivos:
- Base, con las dependencias de main (A1): 1 falla y 2 inestables.
- A2: 2 fallas y 4 inestables.
- Las fallas de A2 (`/servicios`, CTA de Shipping Mark) y `/tarifas`, repetidas 2 veces: 12/12 PASÓ. La base falla en la misma familia de CTA.

Lectura: no se ve una regresión atribuible a la A2. Es inestabilidad de `next dev` bajo carga en Windows.

## Pendientes

- CI de GitHub.
- Revisión y merge, a cargo del DG.
- Prueba manual después de publicar, según la spec 0656 §4 A2: un PDF de cada tipo comparado con uno anterior, por el cambio de pdfkit, y la vista de Tailwind.

## Fuera de alcance detectado

- `next dev` 16.4 (ya en main desde la A1) escribe un bloque `nextjs-agent-rules` en `AGENTS.md` cuando detecta un agente (`node_modules/next/dist/server/lib/start-server.js:406`). Se desactiva con `agentRules: false` en `next.config.ts`. Se le propuso al DG una PR aparte.

## Ronda del DG (2026-11-17)

### `@emnapi` en beta

- `pnpm why @emnapi/core --prod` sale vacío.
- Llega solo por `@rolldown/binding-wasm32-wasi`, que viene de `vite` 8.3.8, `@vitejs/plugin-react` y devDependencies.
- No entra en la imagen de producción. El DG la aceptó con esa condición.

### Render de PDF

- **Pruebas existentes:** `lib/studio/pdf/**` y `document-import/pdf.test.tsx` pasan: 5 archivos, 60 pruebas.
- **Hallazgo:** bajo jsdom, `@react-pdf` 4.9 genera PDF que poppler no puede leer (`Missing 'endstream'`, `Bad FCHECK in flate stream`). Con 4.5.1 en jsdom salían bien. Las pruebas pasaban igual porque solo miran que el buffer no esté vacío y que empiece con `%PDF-`.
- **Servidor:** Next carga `@react-pdf/renderer` como paquete externo con `import()` (Turbopack `e.y(...)` en `.next/server`). Reproduje ese camino empaquetando `ReciboDocument` con esbuild en ESM y `packages: external`, y lo importé en Node. Resultado:

  | Versión | Páginas | Bytes | Errores de poppler |
  |---|---|---|---|
  | 4.5.1 | 1 | 3036 | 0 |
  | 4.9.0 | 1 | 3035 | 0 |

  El texto extraído es idéntico.
- **En Vitest con `--environment node`:** los 3 PDF (recibo y dos finiquitos) dan 0 errores de poppler.
- **Datos:** sintéticos («Persona Sintetica», EMP-0001), sin datos reales.
- **Cambio de pruebas:** `recibo-pdf.test.ts` y `finiquito-pdf.test.ts` pasan a `// @vitest-environment node`, como ya hace `document-import/pdf.test.tsx`, para probar lo que corre en el servidor. No se debilitó ninguna aserción.
- **Riesgo residual:** un componente de cliente que generara el PDF en el navegador saldría corrupto. Hoy no hay ninguno: ningún archivo con `"use client"` importa `@react-pdf`, y `ReciboTab` solo lo menciona en un comentario.
- **Otro hallazgo:** bajo CJS (`tsx`), la 4.9 no carga, porque `@react-pdf/hyphenate` 0.1.0 solo exporta `import`. Hoy no afecta: no hay scripts que usen react-pdf con `require`.
