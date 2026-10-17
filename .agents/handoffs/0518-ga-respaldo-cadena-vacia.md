# Handoff · SDD-0518 · GA y Ads cargan aunque `NEXT_PUBLIC_GA_ID` llegue vacía

| Campo | Valor |
|---|---|
| Fecha | 2026-10-14 (UTC 20:46 a 21:10 aprox.; Caracas 16:46 a 17:10) |
| Task ID / owner | `ga-respaldo-cadena-vacia` / subagente Worker del Director |
| Claim del harness | `worker-0518-ga-respaldo-cadena-vacia` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-afa2678b74df5797a` |
| Rama | `codex/ga-respaldo-cadena-vacia` (el `switch -c` le había puesto upstream `origin/main`; se quitó antes de cualquier push) |
| Base | `origin/main` `3086befb` (merge de la #214). Se partió de `d28fa515` y, por indicación del Director, se trajo `origin/main` antes del push: fue avance rápido, sin rebase ni commit de merge, antes del primer commit propio. |
| SDD | [0518](../../docs/specs/0518-ga-respaldo-cadena-vacia/spec.md), `in-progress` (la asignó el Director), `related: ["0505"]` |
| Estado de la tarea | lista para revisión (PR en draft) |
| Permisos | commits selectivos, push de la rama propia y PR en draft contra main. Sin merge, sin producción, sin VPS, sin variables de GitHub o Vercel, sin datos, migraciones ni infraestructura. No se tocaron `app/registro/RegisterForm.tsx`, `lib/portal/tracking-en-construccion.ts` ni `lib/shared/` (SDD-0517 en paralelo). |

## Objetivo

Que Google Analytics y la etiqueta de Google Ads carguen aunque
`NEXT_PUBLIC_GA_ID` llegue como cadena vacía en el build (caso medido en la
imagen Docker de la 0505), e inventariar el mismo patrón
`process.env.NEXT_PUBLIC_* ?? "..."` en `app/`, `components/` y `lib/`.

## Qué se hizo

- `components/Analytics.tsx:36-38`: `process.env.NEXT_PUBLIC_GA_ID ??` pasa a
  `process.env.NEXT_PUBLIC_GA_ID?.trim() ||`. La cadena vacía o con sólo espacios
  cae al respaldo `G-25CD7BZH98` en producción; un valor real se usa recortado;
  en desarrollo sin valor sigue apagado. El comentario de cabecera explica el
  porqué. `ADS_ID` y `WHATSAPP_CONVERSION` son constantes: no aplica.
- `components/Analytics.respaldo-ga.test.tsx` (nuevo, 7 casos): renderiza el
  componente real con el entorno fijado y el módulo reimportado, y mira el loader
  de gtag.js y el init con los dos `config` (GA4 y `AW-561290482`).
- Spec 0518 con el inventario completo, índice regenerado con `pnpm docs:index`
  y una línea en la sección Analítica de `docs/marketing/README.md`.

### Inventario (detalle y razones en la spec)

Base `d28fa515`, `git grep -nE "process\.env\.NEXT_PUBLIC_[A-Z_]+[[:space:]]*\?\?" -- app components lib`:
**51 líneas en 49 archivos**.

| Variable | Líneas | Decisión |
|---|---|---|
| `NEXT_PUBLIC_GA_ID` | 1 | **corregida** |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | 3 | no se corrige: todos los consumidores la evalúan como verdadera o falsa, así que `""` equivale a `null` |
| `NEXT_PUBLIC_BUILD_SHA` | 1 | no se corrige: `""` y `null` dan lo mismo en `BugReportModal` |
| `NEXT_PUBLIC_SITE_URL` | 46 (39 caen a `https://dtdcargo.com`, 7 a `http://localhost:3000`) | no se corrige: con `""`, `new URL(SITE_URL)` en `app/layout.tsx:26` detiene el build, y ese fallo visible protege a las otras 45. Corregir sólo el layout volvería invisibles enlaces relativos (Portal, correos, JSON-LD). Corregir las 46 haría caer 7 a `localhost` en una imagen de producción. |

Esto se aparta de lo que esperaba el encargo, que nombraba el `new URL('')` del
layout como ejemplo de caso a corregir. La razón está arriba y en la spec. La
propuesta, no decidida, es un módulo único para la URL del sitio que falle con un
mensaje claro: decisión de Sam y el Director.

### Medición del bundle (Turbopack)

La prueba en Vitest lee `process.env` real y no demuestra el inlineado. Se armó
un proyecto Next mínimo dentro del worktree (`tmp-sdd0518-probe/`, borrado al
terminar y nunca agregado al índice), con Next 16.2.11, `next build` (Turbopack,
igual que `Dockerfile:88`) y la misma expresión en un componente `"use client"`:

- `NEXT_PUBLIC_GA_ID="  G-SONDA-REAL "` → chunk `let i="  G-SONDA-REAL ".trim()||"RESPALDO-SONDA-0518"`, HTML `[G-SONDA-REAL]`.
- `NEXT_PUBLIC_GA_ID=""` → chunk `let i="".trim()||"RESPALDO-SONDA-0518"`, HTML `[RESPALDO-SONDA-0518]`.
- Control con la forma de main (`??`) y `""` → el respaldo no aparece en ningún chunk, HTML `[]`. Reproduce la medición de la 0505.
- En los dos builds de la forma nueva ningún chunk conserva `NEXT_PUBLIC_GA_ID`.

## Impacto documental y conocimiento

- Documentos actualizados: spec 0518 (nueva), `docs/specs/README.md`
  (regenerado) y `docs/marketing/README.md` (Analítica). El runbook del servidor
  (`docs/runbooks/servidor-contabo.md:600` y `:731`) y el handoff de la 0505 son
  registros fechados: no se editan.
- `pnpm knowledge:status` (exit 0, `ok: false`, revisión `3086befb`): structural
  INVALID con 4545 pendientes y 0 drifted, semantic INVALID, archify PENDING,
  obsidian PENDING. El worktree no tiene `graphify-out/`, así que todo el repo
  figura pendiente: no es efecto de este cambio.
- Graphify `update`, `knowledge:visual`, `knowledge:visual:check` y
  `knowledge:publish --preview`: NO EJECUTADOS. La validación del encargo es
  liviana y el grafo lo publica el Director desde main integrado (corrida
  pesada). Pendiente global: la estructura de Graphify debe incorporar
  `components/Analytics.respaldo-ga.test.tsx` y la spec 0518 tras integrar.

## Cierre

**OBJETIVO ORIGINAL:** que GA4 y la etiqueta de Google Ads carguen aunque
`NEXT_PUBLIC_GA_ID` llegue como cadena vacía en el build, e inventariar y, donde
rompa algo real, corregir el patrón `process.env.NEXT_PUBLIC_* ?? "..."` en
`app/`, `components/` y `lib/`.

**COMPLETADO:**
- Arreglo en `components/Analytics.tsx` con prueba de render real, control rojo
  y 5 mutantes muertos.
- Medición del bundle con Turbopack: inlineado de la expresión nueva, respaldo
  con cadena vacía y reproducción del defecto con `??`.
- Inventario completo: 51 líneas en 49 archivos, con decisión y razón por
  variable. Sólo se corrige GA_ID; SITE_URL queda sin corregir de forma
  deliberada, con la propuesta separada.
- Criterios de aceptación de la spec cumplidos (los seis marcados).

**VALIDACIÓN** (árbol de trabajo idéntico al de `d6ac0ae8`; las comprobaciones de
documentación, sobre `4c4d54d1`):

| Comprobación | Resultado |
|---|---|
| Control rojo: prueba nueva contra `components/Analytics.tsx` de `d28fa515` | FALLÓ, como se esperaba: 3 de 7 (vacía: 0 scripts; con espacios: loader `id= \t `) |
| Prueba nueva con el arreglo | PASÓ 7/7 |
| Prueba nueva + `components/Analytics.test.tsx` | PASÓ 81/81 |
| Mutantes (5, sobre la línea del diff; control 7/7 antes y después; archivo restaurado) | PASÓ: 5 muertos (`??`: 3 fallan; `\|\|` sin trim: 2; trim sin usar el valor recortado: 1; ignorar la variable: 3; respaldo también en desarrollo: 1) |
| Sonda de bundle con Turbopack (3 builds) | PASÓ |
| `vitest related components/Analytics.tsx --run` (reporter verbose) | PASÓ: 14 archivos, 278 pruebas (`__tests__/analytics.test.ts` 141, `components/Analytics.test.tsx` 74, la nueva 7, `app/tarifas/embed/page.test.tsx` 12, seis de `app/registro/__tests__/` 29, cuatro de `components/CalculadoraForm.*` 15) |
| `tsc --noEmit` (sin tubería, salida a archivo) | PASÓ: exit 0, sin salida |
| eslint de `components/Analytics.tsx` y la prueba nueva | PASÓ: exit 0 |
| `pnpm docs:check` | PASÓ: índice sincronizado con 502 specs |
| `pnpm sdd:check` | PASÓ: «numbering: sin números repetidos»; los ⏸ son choques históricos ya aplicados |
| `git diff --check` | PASÓ |
| `pnpm verify` completo | NO EJECUTADO: el encargo pide validación liviana; el turno de corridas pesadas es del Director |
| e2e y Docker | NO EJECUTADO: excluidos por el encargo. Las e2e corren con `next dev` (`playwright.config.ts:150`), donde GA sigue apagado |
| `/ui-check` | NO EJECUTADO, no aplica: no hay cambio visual |
| `revisar-datos-ve` | NO EJECUTADO, no aplica: no se agrega captura ni flujo de datos. La imagen vuelve a cargar GA como ya lo hace Vercel, y la exclusión de rutas privadas no cambia |

**COMMITS:**
- `4c4d54d1` — docs(sdd): spec 0518, índice regenerado y línea de marketing.
- `d6ac0ae8` — fix(DTD-0518): arreglo en `components/Analytics.tsx` y prueba nueva.
- Commit que contiene este documento — handoff.

**PR / BRANCH:** PR en draft contra `main` desde `codex/ga-respaldo-cadena-vacia`.
La URL va en el reporte al Director y se obtiene con
`gh pr list --head codex/ga-respaldo-cadena-vacia`; no se empuja otro commit sólo
para anotarla. Worktree:
`C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-afa2678b74df5797a`.

**PENDIENTES DE ESTA TAREA:**
- Revisión del Director y CI de la PR.
- Si el Director pide corregir también `NEXT_PUBLIC_SITE_URL`, hace falta decidir
  antes qué debe pasar con la variable vacía: caer al respaldo o fallar con un
  mensaje claro. La spec explica por qué no se hizo en esta tarea.
- Estado SDD `done` y comprobación en la imagen después de integrar: que
  `infra/ops/web/smoke-web.sh` siga encontrando `G-25CD7BZH98` en los chunks
  (hoy la variable de repositorio está definida, así que esa comprobación no
  distingue el arreglo. Ver Riesgos de la spec).

**FUERA DE ALCANCE DETECTADO:**
- `Dockerfile:19` dice «el resto de NEXT_PUBLIC_* es opcional», pero
  `NEXT_PUBLIC_SITE_URL` es obligatoria: vacía, el build falla en
  `app/layout.tsx:26`. Es infraestructura y no se tocó.
- `NEXT_PUBLIC_SITE_URL` está copiada en 46 lecturas con dos respaldos distintos
  (39 `https://dtdcargo.com`, 7 `http://localhost:3000`). Candidata a un módulo
  único; requiere decisión.
- `package.json` no declara `packageManager`: `corepack pnpm` resuelve pnpm
  12.3.4, mientras CI y el `Dockerfile` usan 11.19.0. Aquí se instaló con
  `corepack pnpm@11.19.0 install --frozen-lockfile`. Además pnpm 11.19.0 avisa
  que ignora `pnpm.onlyBuiltDependencies` de `package.json`.
- Inferencia NO VERIFICADA: en la sonda, Next eligió como raíz de Turbopack el
  checkout principal (`DTDCARGO\pnpm-workspace.yaml`) por haber otro lockfile más
  arriba, y `next.config.ts` no fija `turbopack.root`. No se comprobó si pasa lo
  mismo en un build completo dentro de un worktree.

**HANDOFF AL DIRECTOR:**
- Siguiente acción: revisar la PR en draft. Es un cambio de código chico más
  documentación. No toca contratos compartidos ni `lib/shared/`, y no se solapa
  con los archivos de la SDD-0517.
- La variable de repositorio `NEXT_PUBLIC_GA_ID` deja de ser necesaria para que
  la imagen traiga GA. Mantenerla no hace daño; quitarla no es parte de esta
  tarea, y este Worker no tocó variables.
- Al integrar: el índice (`docs/specs/README.md`) tiene el driver de merge; si la
  0517 entra antes, regenerarlo con el script.
- Sesiones consumidoras: ninguna aparte de esta. Ownership: el claim
  `worker-0518-ga-respaldo-cadena-vacia` se libera al terminar el push y la PR, y
  el reporte al Director lo confirma. No se eliminan el worktree ni la rama.

## CIERRE DE INTEGRACIÓN (Director, 2026-10-15)

- **Merge:** PR #216, merge `103cfdaf` a las 22:51:38Z del 2026-10-14, con `--match-head-commit a1a60510` y el OK de Sam («ok, fusiona la #215, #216 y #217»).
- Deploy de las tres PR (#215, #216 y #217): «Deployment has completed», el último a las 23:07Z del 2026-10-14. La imagen Docker de main se construye en cada merge (workflow «Imagen Docker»; la última, de `1b19ba5c`, salió en success).
- **Comprobado por el Director en el servidor propio** (2026-10-15, alrededor de las 03:55Z, HTML y JS públicos):
  - `G-25CD7BZH98` está en un chunk JS de `nuevo.dtdcargo.com` (`1812jytps5u6r.js`), igual que en `dtdcargo.com` (`0bmkfo8qcfl67.js`); en ninguno de los dos está en el HTML inicial, porque `NEXT_PUBLIC_*` se inlinea en el cliente;
  - GA ya no queda apagado en la imagen Docker.
  - *No verificado:* si en ese build el ID salió del respaldo o de la variable de repositorio `NEXT_PUBLIC_GA_ID`, que creó la sesión de Contabo. Desde afuera no se distingue.
- Los criterios ya estaban marcados con evidencia de pruebas. Estado de la tarea: **integrada**.
