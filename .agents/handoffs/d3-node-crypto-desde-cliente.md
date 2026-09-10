# Handoff · d3-node-crypto-desde-cliente

- Fecha: 2026-09-10
- Owner / sesión: `d3-node-crypto-desde-cliente-codex`
- Estado de tarea: `completada` (la indisponibilidad autenticada del ambiente y el teardown de `verify` se clasifican abajo sin atribuirlos al cambio).
- Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/d1-d3-evidencia-arnes`
- Rama: `codex/d1-d3-evidencia-arnes`
- Base asignada: `8ee41f19fb25cfe8b9cd4f01e8110ca507745ed2` (`main`)
- Objetivo: impedir que un módulo con `'use client'` alcance `node:crypto` por importaciones transitivas y hacer que el gate del repositorio detecte esa clase de fuga sin depender del compilador.
- SDD reutilizada: `docs/specs/0299-el-error-dice-su-causa/spec.md` (`in-progress`). No se reserva un número nuevo: esa spec ya documenta expresamente que los consumidores cliente no deben importar `d1-access-config-adapters.ts` porque arrastran `node:crypto`; esta tarea cierra esa deuda de frontera sin introducir comportamiento nuevo.
- Dependencias: ninguna.
- Autorización: commits locales selectivos; push explícito de esta rama a sí misma; PR en borrador contra `main`. Sin merge, deploy, migraciones, reglas remotas ni cleanup de worktree/rama.

## Aceptación

1. Ningún módulo `'use client'` alcanza `node:crypto` por importación transitiva, con traza reproducible.
2. Reproducción previa obligatoria: webpack falla en el árbol base con `UnhandledSchemeError`; la misma compilación pasa después. El guion `build` permanece intacto.
3. `D1_REASON_MIN_LENGTH` vive en un módulo compartido sin imports de Node; todos los consumidores cliente del adapter se corrigen.
4. Se evalúa y, si es viable, se extiende `scripts/check-rsc-boundary.mjs` con prueba para la frontera transitiva client→`node:`. Si no es viable, se registra la medición y la razón.
5. Cero cambio visible de comportamiento.

## Alcance

- Permitido: `lib/studio/audit/d1-access-config-adapters.ts`; un módulo compartido nuevo; `app/studio/(app)/usuarios/_components/ficha/RolYAlcanceCard.tsx`; otros consumidores cliente del mismo adapter; `scripts/check-rsc-boundary.mjs` y sus pruebas; SDD-0299 e índice regenerado; este handoff.
- Excluido: `supabase/**`; D1/D2/D4 del arnés; guion de build; `next.config.ts`; `playwright.config.ts`; merge; deploy; producción.

## Evidencia inicial

- `node scripts/harness-worktree.mjs guard`: PASÓ en la rama y ruta asignadas.
- `node scripts/harness-worktree.mjs claim --owner d3-node-crypto-desde-cliente-codex`: claim adquirido.
- `git status --short --branch`: limpio al iniciar.
- HEAD inicial: `8ee41f19fb25`.

## Cierre obligatorio

### OBJETIVO ORIGINAL

Impedir que un módulo con `'use client'` alcance `node:crypto` por una cadena de
imports y hacer que el repositorio detecte esa clase de fuga sin depender de
Turbopack o webpack, sin cambiar comportamiento visible.

### COMPLETADO

- Se reprodujo **antes del arreglo** el `UnhandledSchemeError` de webpack. Para
  aislar la conectividad de Google Fonts se usó
  `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` con un archivo temporal fuera del repo; la
  misma configuración se conservó en el build posterior. Traza observada:

  ```text
  node:crypto
    <- lib/studio/audit/d1-access-config-adapters.ts
    <- app/studio/(app)/usuarios/_components/ficha/RolYAlcanceCard.tsx
    <- app/studio/(app)/usuarios/_components/UserDetailDrawer.tsx
    <- app/studio/(app)/usuarios/_components/UsersClient.tsx
  ```

- Se movió únicamente `D1_REASON_MIN_LENGTH = 8` a
  `lib/studio/audit/d1-access-config.shared.ts`, que no tiene imports. El adapter
  de servidor la usa y reexporta por compatibilidad; `RolYAlcanceCard` la importa
  directamente del módulo puro. `randomUUID` y toda la lógica D1 siguen en el
  adapter de servidor.
- La búsqueda de consumidores confirmó que `RolYAlcanceCard.tsx` era el único
  consumidor cliente del adapter; los otros consumidores son Server Actions o
  pruebas.
- Se amplió `scripts/check-rsc-boundary.mjs` para recorrer imports, imports
  dinámicos y reexports locales de runtime desde cada raíz `'use client'`; falla
  ante `node:*` con la traza completa. Ignora imports borrados por TypeScript y no
  atraviesa una frontera de archivo `'use server'`.
- Se añadió una prueba focal con cuatro casos: fuga transitiva y traza, frontera
  `'use server'`, import de tipo y preservación del chequeo server→client previo.
- Se reutilizó SDD-0299 porque ya contenía la norma concreta sobre el adapter D1
  y `node:crypto`. No se tomó un número nuevo. La spec conserva `in-progress`
  porque esta tarea sólo cierra esa deuda dentro de una spec de alcance mayor.
- No se modificaron el guion de build, `next.config.ts`, `playwright.config.ts`,
  `supabase/**`, migraciones ni los hallazgos D1, D2 o D4.

### VALIDACIÓN

- **PASÓ** `corepack pnpm install --frozen-lockfile`: pnpm 12.3.4; 813 paquetes
  enlazados desde el store, lockfile respetado.
- **PASÓ LA REPRODUCCIÓN ESPERADA** antes del cambio:
  `node node_modules/next/dist/bin/next build --webpack` salió 1 con
  `UnhandledSchemeError: Reading from "node:crypto" is not handled by plugins`
  y la traza completa mostrada arriba. Un intento previo sin el mock externo no
  llegó al bundle por `ETIMEDOUT` de Google Fonts y no se contó como reproducción.
- **PASÓ** después del cambio la misma compilación webpack, con el mismo mock
  externo de fuentes: exit 0 y 160/160 páginas generadas.
- **PASÓ** `corepack pnpm exec next build` sin mock ni flags: Turbopack, exit 0 y
  160/160 páginas. El guion real no cambió.
- **PASÓ** `node scripts/check-rsc-boundary.mjs`: 1.597 módulos; cero cruces
  server→client de valores y cero fugas client→`node:` transitivas.
- **PASÓ** `corepack pnpm vitest run scripts/__tests__/check-rsc-boundary.test.mjs
  lib/studio/audit/__tests__/d1-access-config-adapters.test.ts`: 2 archivos y 7
  pruebas. El archivo nuevo aportó 4/4 y demuestra el RED sintético con la traza
  `app/Client.tsx -> lib/shared.ts -> lib/server-helper.ts -> node:crypto`.
- **PASÓ** `corepack pnpm vitest run`: 514 archivos y 6.500 pruebas.
- **PASÓ** `corepack pnpm docs:check`: 395 specs y 54 gaps históricos reportados.
- **PASÓ** `corepack pnpm sdd:check`: 395 specs, 403 migraciones y cero números
  repetidos; las colisiones históricas reconocidas conservaron su clasificación.
- **PASÓ** `corepack pnpm docs:index`: índice regenerado; no produjo diff porque
  el título y estado indexables de SDD-0299 no cambiaron.
- **PASÓ** `git diff --check`.
- **MEDICIÓN VIABLE DEL GATE:** antes de extenderlo recorrió 1.596 módulos en
  1,92 s. Después recorrió 1.597 módulos en tres ejecuciones de 2,48 s, 2,42 s y
  1,29 s (mediana 2,42 s): aproximadamente 0,51 s adicionales sobre la medición
  base. El costo permite mantenerlo en `verify` y CI.
- **TIMEOUT** `corepack pnpm verify` como resultado global, después de ejecutar
  dos intentos E2E. Antes de ese bloque **PASARON**: harness 12/12, lint con 0
  errores, el gate RSC nuevo, typecheck, compilación de 4 Edge Functions, Vitest
  514/6.500, documentación, SDD, feature constants, componentes, governance, 145
  contratos SQL con rollback y reconstrucción desde cero de 403 migraciones (385
  aplicadas + 18 sólo-ledger), incluida la comprobación multitenant.
- **NO DISPONIBLE** dentro de `verify`: `migrations-applied` no pudo consultar
  producción por ausencia de `NEXT_PUBLIC_SUPABASE_URL` y
  `SUPABASE_SERVICE_ROLE_KEY`. No se usaron secretos ni se leyó/escribió negocio.
- **NO DISPONIBLE** E2E autenticado por ausencia de
  `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. El primer intento
  cerró con 151 pasadas, 18 omitidas, 15 fallidas y 2 flaky; las 15 fallas finales
  fueron los mismos cinco casos de login/buscador en chromium, mobile-chrome y
  mobile-safari, con el error explícito de credenciales en `proxy.ts:67`. El
  reintento automático recorrió hasta el último caso pero quedó colgado en
  teardown sin emitir resumen. Tras varios minutos sin salida se interrumpió
  sólo esta sesión y se comprobaron/cerraron sus dos procesos padre huérfanos.
  El build que `verify` no alcanzó se ejecutó y pasó por separado, como consta
  arriba. No se declara verde E2E ni verde canónico global.

### COMMITS

- `61413900` — `feat(studio): SDD-0299 — aislar configuración D1 del cliente`:
  extracción del contrato puro, consumidor cliente y actualización de SDD-0299.
- `commit que contiene este documento` — `chore(harness): detectar fugas
  client-to-node transitivas`: gate durable, prueba focal y handoff. El SHA final
  se registra en la PR para evitar recursión de commits.

### PR / BRANCH

- Rama publicada explícitamente a sí misma:
  `codex/d1-d3-evidencia-arnes`.
- PR en borrador contra `main`: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/48
- Base revisada antes de publicar: `origin/main = 8ee41f19fb25`, sin divergencia
  respecto de la base asignada.
- No se fusionó ni desplegó.

### PENDIENTES DE ESTA TAREA

Ninguno de implementación. La revisión, aprobación y eventual integración de la
PR corresponden al Director. Una corrida E2E autenticada requiere un ambiente con
credenciales/seed y no se sustituye por la evidencia local sin secretos.

### FUERA DE ALCANCE DETECTADO

- Lint conservó 8 warnings preexistentes fuera del allowlist: seis variables sin
  uso en pruebas de compras, una advertencia de pureza por `Date.now()` en
  `KommoBoardView.tsx` y un `setState` dentro de efecto en `KommoClient.tsx`.
- La primera compilación webpack fue bloqueada por un `ETIMEDOUT` de Google Fonts;
  la reproducción controlada y el build real posterior resolvieron la cobertura
  sin modificar configuración del repo.
- `verify` dejó de responder en teardown del segundo intento E2E, con un worker de
  Playwright ya sin casos activos. Se limitó la acción a los procesos propios de
  este worktree; no se tocó `playwright.config.ts` ni procesos de otras tareas.
- La falta de configuración Supabase impide los E2E autenticados y la consulta del
  ledger de producción. Era un límite conocido del encargo y no se trató como
  regresión ni como autorización para acceder a producción.

### HANDOFF AL DIRECTOR

Revisar la extracción mínima y la nueva DFS del gate en la PR #48. La evidencia
decisiva es webpack RED antes / GREEN después más el test que imprime la ruta
transitiva completa. SDD-0299 se reutilizó sin renumerar ni cerrar su estado
global. El commit final de la PR y la liberación del claim se registran en el
cuerpo de la PR después de publicar este documento. No hay autorización de merge,
deploy, producción ni cleanup de rama/worktree.
