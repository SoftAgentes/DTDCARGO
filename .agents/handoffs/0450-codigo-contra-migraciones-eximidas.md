# Handoff — 0450-codigo-contra-migraciones-eximidas

- Fecha: 2026-09-10
- Owner: sesión Worker `codex-worker-0450-20260910`
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0450-codigo-contra-migraciones-eximidas`
- Rama: `codex/0450-codigo-contra-migraciones-eximidas`
- Base asignada: `c47ee514c6d3382a21094d1eb954de50bfcab37d`
- SDD: `docs/specs/0450-codigo-contra-migraciones-eximidas/spec.md` (`done`)
- Estado de tarea: lista-para-revisión
- Dependencias: ninguna; independiente de los bloques B, C y D
- Último resultado: implementación y validación focal completas; cierre canónico medido con limitaciones externas registradas.
- Siguiente paso: publicar la rama, abrir el PR borrador y entregar al Director para revisión del diff y del gate hospedado.

## OBJETIVO ORIGINAL

Agregar un check sin credenciales ni red que falle cuando código alcanzable desde `app/**` dependa de un símbolo de base de datos que solo nace en una migración declarada como pendiente, con ascenso amarillo únicamente mediante declaración explícita; integrarlo en `pnpm verify` y como gate propio de CI.

## COMPLETADO

- Se agregó `scripts/check-pending-migration-symbols.mjs`, con funciones puras exportadas para extraer DDL, calcular ausencias, construir el grafo estático, ubicar referencias y clasificar declaraciones.
- El parser cubre `CREATE [OR REPLACE] FUNCTION`, `CREATE TABLE [IF NOT EXISTS]`, `CREATE [OR REPLACE] VIEW` y `ALTER TABLE ... ADD COLUMN [IF NOT EXISTS]`; comentarios, literales y cuerpos dollar-quoted no cuentan como DDL.
- Un símbolo también creado por una migración no pendiente se trata como redefinición, no como ausencia.
- La alcanzabilidad parte de entradas Next bajo `app/**` y sigue imports/reexports relativos o `@/`, `import()` y `require()` literales. El ascenso ROJO → AMARILLO requiere declaración exacta de símbolos, sitios de llamada y evidencia; no se infiere con `try/catch`.
- Se agregó `supabase/pending-migration-symbol-declarations.json`, separado del baseline generado para no agravar la serialización E1. Declara el único AMARILLO actual: `shipping_label_versions`, junto con `save_shipping_label_presentation` y su degradado verificable.
- La regresión usa fixtures propios y reproduce tres ROJO del árbol `94a94f2d`: `receive_prealerta_boxes_as_operario` en la línea 186, `save_shipping_label_presentation` y `shipping_label_versions`.
- El árbol actual da cero ROJO, un AMARILLO primario `shipping_label_versions` y silencio para las seis tablas `no_olvidar_*`.
- El gate quedó cableado junto a `migrations-applied` en `scripts/verify.mjs` y como paso propio, incondicional y bloqueante en `.github/workflows/quality.yml`; el contrato CI prueba que no se pueda degradar con condiciones, `continue-on-error`, `|| true` ni un `echo` sustituto.
- Se completó SDD-0450 y se regeneró `docs/specs/README.md` con `pnpm docs:index`.
- No se modificaron migraciones, baseline, cutoff, `findMissing`, producto, ruleset ni producción.

## VALIDACIÓN

- **FALLÓ** `pnpm install --frozen-lockfile`: `pnpm` no estaba disponible directamente en `PATH`.
- **PASÓ** `corepack pnpm install --frozen-lockfile`: pnpm 12.3.4, lockfile congelado, 813 paquetes y 932 entradas de política; sin cambio de lockfile.
- **PASÓ** `node scripts/check-pending-migration-symbols.mjs`: `0 ROJO · 1 AMARILLO`; primario `shipping_label_versions` de 0449.
- **PASÓ** auditoría estructural focal del árbol actual: las seis tablas `no_olvidar_*` quedaron en silencio.
- **PASÓ** Vitest focal del check y contrato CI: 29/29 pruebas en 2 archivos; 7/7 pertenecen al nuevo check.
- **PASÓ** `corepack pnpm harness:test`: 12/12, 0 omitidas.
- **PASÓ** ESLint focal para el script, su prueba y el contrato CI: 0 errores.
- **PASÓ** `corepack pnpm docs:index`: 396 specs y 54 huecos; índice regenerado, no editado a mano.
- **PASÓ** `corepack pnpm docs:check`.
- **PASÓ** `corepack pnpm sdd:check`: 396 specs y 403 migraciones; solo avisos históricos conocidos.
- **PASÓ** `git diff --check` y `git diff --cached --check`.
- **FALLÓ** `corepack pnpm verify` como resultado global: 16/17 pasos corrieron realmente.
  - **PASÓ** el gate nuevo dentro de `verify`, con el único AMARILLO esperado.
  - **PASARON** harness 12/12, lint (0 errores; 8 avisos preexistentes), frontera RSC (1596 módulos), typecheck, Edge Functions (4), Vitest (514 archivos; 6509/6509), docs, numbering, feature constants, componentes, governance, SQL (145/145), reconstrucción de schema (385 migraciones aplicadas; 18 solo-ledger) y build de producción.
  - **NO EJECUTADO** `migrations-applied`: faltaron `NEXT_PUBLIC_SUPABASE_URL` y la service-role key; fue el único SKIP del gate.
  - **FALLÓ** E2E tras el reintento completo: 153 pasaron, 15 fallaron y 18 se omitieron. Las 15 fallas son las mismas cinco rutas dependientes de Supabase en Chromium, Mobile Chrome y Mobile Safari al faltar `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Playwright además forzó el cierre de `worker-45` tras 300000 ms; no se presenta como verde.
- **NO DISPONIBLE** E2E autenticado ni validación funcional contra Supabase sin credenciales. No aplica como prueba focal de este cambio de harness y no se copiaron secretos al worktree.
- **NO EJECUTADO todavía** el gate hospedado de GitHub Actions; se registrará después del push/PR.

## COMMITS

- `9d4561b5` — `chore(harness): SDD-0450 detecta simbolos DB pendientes`
- Cierre documental/handoff: commit que contiene este documento.

## PR / BRANCH

- Rama: `codex/0450-codigo-contra-migraciones-eximidas`
- Base PR: `main`
- PR: pendiente de publicación; autorizado como borrador.
- No autorizado: merge, deploy, migraciones de producción, ruleset, force push o limpieza.

## PENDIENTES DE ESTA TAREA

- Publicar la rama y abrir el PR borrador; luego registrar URL y resultado del gate hospedado.

## FUERA DE ALCANCE DETECTADO

- `app/p/[token]/page.tsx:46` y `app/portal/(app)/compras/[code]/etiquetas/page.tsx:67` descartan la bandera `available`. Es un hallazgo real de producto y no se corrigió.
- Las ocho advertencias de lint preexistentes no pertenecen a los archivos de esta tarea.
- La ausencia de credenciales que rompe las cinco rutas E2E, repetidas en tres navegadores, no se corrige desde este cambio de harness.

## HANDOFF AL DIRECTOR

Revisar el parser/alcance estático, la declaración amarilla de 0449 y la obligatoriedad del paso CI. El gate es E4: solo ve migraciones que E3 ya declaró pendientes; no detecta una ausencia no registrada como 0447 ni objetos fuera de las cuatro formas DDL (por ejemplo, 0428 solo altera una policy). No certifica el ledger ni producción. Ownership sigue activo por `codex-worker-0450-20260910` hasta completar publicación y PR.
