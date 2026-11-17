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
