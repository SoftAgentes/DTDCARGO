# A5-1 · dirección de bodega China visible · 2026-09-10

- Owner / sesión: `codex-worker-a5-1-20260910`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/a5-1-direccion-bodega-cn-visible`.
- Rama: `codex/a5-1-direccion-bodega-cn-visible`.
- Base asignada: `main` `8ee41f19fb25cfe8b9cd4f01e8110ca507745ed2`.
- HEAD inicial: `8ee41f19fb25cfe8b9cd4f01e8110ca507745ed2`.
- SDD: `docs/specs/0442-portal-claridad-botones-mensajes/spec.md`, `in-progress`, reutilizada.
- Estado de tarea: implementación completa; cierre canónico incompleto por
  `TIMEOUT` de Playwright, entregada en PR draft para revisión del Director.
- Dependencias: ninguna; asignada en paralelo con SDD-0450 sin archivos compartidos.
- Permisos: commits locales selectivos, push de esta rama y PR draft contra `main`; sin merge, deploy, producción, migraciones, ruleset ni cleanup.

## OBJETIVO ORIGINAL

Restaurar la decisión del founder del 2026-07-28 que PR #30 revirtió sin
declararlo: la guía de dirección de Alibaba y el clip del proveedor deben estar
visibles al cargar el portal de proveedores. Corregir el test de regresión y
regenerar las cinco capturas de SDD-0442 contra el código final de esta rama.

## ACEPTACIÓN Y ALCANCE

- El par `AlibabaAddressGuide` + `ChinaSupplierClip` queda visible por defecto.
- La corrección es mínima; la ubicación del resto del `details` se justifica en SDD-0442.
- El test existente se corrige y conserva las garantías válidas del caso.
- Se regeneran las cinco capturas y `evidence.md` identifica el SHA fuente.
- Solo se modifican las rutas expresamente permitidas por el encargo.

## COMPLETADO

- Guard de worktree y claim de sesión escritora verificados.
- Raíz, rama, base, estado limpio y ausencia inicial de `node_modules` verificados.
- Restaurada explícitamente la decisión founder del 2026-07-28: el par
  `AlibabaAddressGuide` + `ChinaSupplierClip`, junto con su comentario de
  intención, salió del `<details>` y queda visible al cargar.
- Conservada dentro del `<details>` cerrado la ayuda secundaria: resumen,
  «Por qué registrar a tu proveedor importa», mensaje asociado y
  `GuiaAlibabaCard`. Esta decisión preserva el reordenamiento autorizado por
  SDD-0442 sin ocultar el par operativo.
- Corregida, no eliminada, la prueba de regresión: afirma el par visible y
  fuera del plegable; conserva el orden de proveedor/alta, la ayuda secundaria
  plegada y la URL de recompra con proveedor.
- SDD-0442 actualizada con fecha, restauración y justificación de producto.
- Regeneradas e inspeccionadas las cinco capturas contra el código de producto
  `f42e6a4605c0850053832331cf15d71e53e28ca8`; dimensiones, hashes y límites
  quedaron registrados en `evidence.md`.
- Rama publicada y PR #42 abierto en borrador contra `main`.

## VALIDACIÓN

- **PASÓ** — `pnpm install --frozen-lockfile` mediante Corepack: 932 entradas
  de política, 813 paquetes, lockfile intacto.
- **PASÓ** — prueba focal de `SuppliersClient`: 1/1.
- **PASÓ** — `pnpm docs:check` y `pnpm sdd:check`; índice sin diff y 11
  advertencias históricas de migraciones, sin colisiones nuevas.
- **PASÓ** — harness visual: 12 vistas desktop/móvil × claro/oscuro, sin
  overflow ni errores JavaScript; las cinco capturas fueron revisadas.
- **FALLÓ (TIMEOUT)** — `pnpm verify`. Pasaron sus pasos previos: harness 12/12,
  lint con 0 errores y 8 warnings preexistentes, RSC 1.596 módulos, typecheck,
  4 Edge Functions, 6.496/6.496 unitarias (513 archivos), docs, numbering,
  feature constants, componentes, governance, 145 contratos SQL y schema
  rebuild de 385 migraciones + 18 ledger-only (219 tablas, 2 tenants).
- **NO EJECUTADO** — ledger `migrations-applied`, sin URL/service role de
  Supabase. No se usaron secretos ni producción.
- **FALLÓ (TIMEOUT)** — E2E inició 186 pruebas con 8 workers, mostró fallos de
  flujos protegidos por URL/key de Supabase ausentes y SKIPs Tier 3. Después del
  evento 167 quedó más de 5 minutos sin salida; se interrumpió a los 14,5
  minutos. No generó resumen JSON final y no dejó procesos del worktree.
- **NO EJECUTADO dentro de `pnpm verify` / PASÓ por separado** — build de
  producción con `node scripts/check-build.mjs`: exit 0, TypeScript, 160 páginas
  estáticas, postbuild y restauración de `tsconfig.json`.
- **NO EJECUTADO** — E2E autenticado útil, Supabase/UAT/producción, lector de
  pantalla y zoom nativo 200 %. La fixture/capturas no prueban esos límites.

## COMMITS

- `f42e6a4605c0850053832331cf15d71e53e28ca8` — restaura la decisión founder,
  corrige la regresión y documenta la decisión en SDD-0442.
- `188f26c010e3575ef4edae717e1f93c0fd369402` — regenera las cinco capturas y
  registra su SHA/hashes en evidencia.
- El commit que contiene este handoff incorpora el cierre de validación y la
  referencia durable al PR.

## PR / BRANCH

- Rama publicada: `codex/a5-1-direccion-bodega-cn-visible`.
- PR draft: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/42
- Base remota comprobada antes de abrirlo:
  `origin/main` = `8ee41f19fb25cfe8b9cd4f01e8110ca507745ed2`, sin drift
  respecto de la base asignada.

## PENDIENTES DE ESTA TAREA

- No queda implementación ni evidencia visual pendiente en el alcance.
- Validación pendiente real: obtener una corrida de `pnpm verify` con cierre
  normal de Playwright y resumen E2E íntegro. Si la política de integración lo
  exige, repetir en un runner sin la contención observada y con el entorno de
  prueba autorizado; la corrida actual no fue verde.

## FUERA DE ALCANCE DETECTADO

- `app/portal/_components/NewPurchaseButton.tsx:20`: badge `+` con círculo vino sobre fondo vino; se pierde visualmente.
- Control compartido migrado en 2 de 3 pantallas: el tercer consumidor conserva 40 px, por debajo de los 44 px exigidos por SDD-0442; el JSDoc que declaraba el invariante fue eliminado en vez de superado.
- Ambos hallazgos quedan solo registrados para decisión del Director; no se tocarán en esta rama.

## HANDOFF AL DIRECTOR

- Revisar PR #42 y confirmar que el diff contra la base solo contiene las dos
  piezas de código/prueba, SDD/evidencia, cinco PNG y este handoff.
- Ejecutar `/ui-check` antes de integrar, como exige el encargo. Las capturas
  entregadas son evidencia local, no sustituyen esa revisión.
- Decidir/repetir el gate E2E por el `TIMEOUT`; no interpretar los pasos previos
  ni el build separado como `pnpm verify` verde.
- Mantener separados los dos hallazgos de PR #30 listados arriba.
- No hay autorización de merge, deploy, migraciones, producción, ruleset ni
  limpieza de rama/worktree.
