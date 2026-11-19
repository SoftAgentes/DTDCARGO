# Handoff — docs-agents-pruning-20261119

**Fecha:** 2026-11-19 · **Owner:** docs-agents-pruning-worker · **Sesión:** Worker (esta sesión, sesión escritora del worktree).
**Worktree:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\docs-agents-pruning` · **Rama:** `codex/docs-agents-pruning` · **Base:** `origin/main` @ `a6050cc8b`.
**SDD:** sin SDD nuevo (cambio de harness/documentación, sin comportamiento Studio), según encargo.
**Aceptación:** AGENTS.md ≤200 líneas con enlaces que resuelven; project-rules.md sin la sección larga de contratos y con §Comandos completo; carpeta `_norte/backend/` eliminada y cero menciones vivas al back Norte en activos; `pnpm docs:check` y `pnpm sdd:check` en verde; sin cambios de producto.
**Permisos:** edición/pruebas dentro del allowlist, commits locales selectivos, push de la rama propia y apertura de PR — autorizados por el encargo (Sam, 2026-11-19). NO autorizado: merge a main, deploy, migraciones, lectura de filas de negocio/PII, tocar el Norte de diseño.

**Salida del claim (conservada):**

```text
Guard OK: C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\docs-agents-pruning
Claim adquirido: docs-agents-pruning-worker
```

## OBJETIVO ORIGINAL

Podar y robustecer la normativa del repo y retirar el «back Norte» (guía de backend de la primera etapa) con sus menciones vivas, sin perder reglas y sin tocar el Norte de diseño. Tres partes: (1) AGENTS.md ≤200 líneas con seis refuerzos; (2) project-rules.md con extracción de contratos, compresión Vercel, §Comandos completo y retiro de la frase del back Norte; (3) borrado de `docs/design/studio/_norte/backend/` y barrido de menciones vivas.

## COMPLETADO

**Parte 1 — AGENTS.md (41 → 56 líneas):**
1. ✅ Eliminada «Antes de backend Studio: `_norte/backend/README.md`» (enlace muerto).
2. ✅ Línea de vigencia bajo el título: «Dueño: Director de ingeniería · Estado: vigente · Actualizado: 2026-11-19 · Metodología: SDD-0444».
3. ✅ Frontera nueva: producción web — cada push a `main` construye y publica automáticamente (vigilante propio, SDD-0541; Vercel en pausa); merge a `main` = publicación web con autorización propia.
4. ✅ Mini-tabla «Comandos de supervivencia» (`pnpm install`, `verify`, `sdd:check`, `docs:check`, `governance:check`) con puntero a la tabla canónica en project-rules.md §Comandos.
5. ✅ Cláusula de idioma: tuteo y español venezolano neutro también en copy, prompts, comentarios y docs.
6. ✅ `.env*` explícito en la regla de secretos: nunca en commit ni copiados entre worktrees.

**Parte 2 — project-rules.md (352 → 209 líneas):**
1. ✅ Sección «Contratos que miden el comportamiento, no el texto» (131 líneas) extraída byte-exacta a `docs/engineering/contratos-de-comportamiento.md` (nuevo, 135 líneas con encabezado); quedó un resumen de 7 líneas con el principio (aserción satisfacible sin ejecutar el código = mide texto; mátala con un mutante; mutantes del diff, no del archivo) + enlace al doc nuevo.
2. ✅ Bloque Vercel (27 líneas) comprimido a 3 líneas de prosa: estado vigente primero (servidor propio + vigilante SDD-0541), Vercel en pausa, detalle histórico → `docs/runbooks/publicacion-automatica-web.md`.
3. ✅ §Comandos ampliado con una línea por comando: `pnpm verify`, `governance:check`, `components:check`, `sdd:check`, `skills:check`, `harness:test` (los seis existen en package.json).
4. ✅ Eliminada «Backend del Studio → leer `backend/README.md` (modelo multi-tenant + auth + endpoints)» (línea ~334).

**Parte 3 — Retiro del back Norte:**
1. ✅ Carpeta `docs/design/studio/_norte/backend/` eliminada con `git rm -r` (historia en git). Inventario de lo borrado:
   - `backend/README.md` (21 líneas): handoff de backend del prototipo — seams mock (`window.DTDData`/`DTDFlags`/`LegalData` en `localStorage`), principio «mismas firmas, otra implementación», lo no negociable (multi-tenant real, sesión access+refresh revocable, evidencia legal inmutable IP+hash+timestamp, servidor como frontera de seguridad).
   - `backend/API-CONTRACT.md` (200 líneas): contrato REST por seam — auth/sesión (login/refresh/revoke/PIN/reset), clientes y Shipping Mark secuencial server-side, estimados con estados de embarque y re-aceptación (AUT-04a), aceptación legal con evidencia, bandeja del portal, facturación, operación CN + sync offline, config/flags, notificaciones, y orden de implementación.
2. ✅ Menciones vivas corregidas (las tres únicas dentro del allowlist):
   - `AGENTS.md:32` → frase eliminada.
   - `docs/engineering/project-rules.md:334` → frase eliminada.
   - `docs/organizacion/organigrama-paperclip.md:1356` → «`, `backend/README.md``» eliminado de la lista de documentos consultados.
3. ✅ «backend» en uso legítito intacto (p. ej. «Backend Studio: **Supabase**» en project-rules.md, comentarios históricos de `scripts/norte.mjs`, tabla de superficies).

**docs/README.md:** sin cambios — el índice *generado* (`docs:check`) solo cubre `docs/specs/README.md` (663 specs) y no exige entrada para el doc nuevo de ingeniería; la fila «Reglas técnicas de agentes → docs/engineering/project-rules.md» ya cubre el árbol engineering.

## VALIDACIÓN

| Comprobación | Resultado | Evidencia |
|---|---|---|
| `pnpm docs:check` | **PASÓ** | exit 0 · «✓ docs:check — índice sincronizado con 663 specs» |
| `pnpm sdd:check` | **PASÓ** | exit 0 · 663 specs · 550 migraciones · «[OK] numbering: sin números repetidos» (los ⏸ son choques históricos ya aplicados en prod, documentados como no renumerables) |
| grep post-borrado (activos, excluyendo specs/handoffs/archive/_norte) | **PASÓ** | 0 menciones vivas dentro del allowlist; 4 líneas residuales fuera de allowlist reportadas abajo |
| Enlaces/rutas de AGENTS.md resuelven (Test-Path) | **PASÓ** | 14/14 `True` (incluye `docs/runbooks/publicacion-automatica-web.md` y el doc nuevo) |
| Nada en `app/`, `lib/` ni `scripts/` referencia la carpeta borrada | **PASÓ** | `git grep _norte -- app/ lib/ scripts/` solo devuelve punteros de diseño (portal/erp); `scripts/norte.mjs` menciona «backend» solo en comentarios de historial de versiones |
| `git diff --check` | **PASÓ** | exit 0, sin warnings de espacios |
| AGENTS.md ≤ 200 líneas | **PASÓ** | 56 líneas |
| `pnpm verify` (producto) | **NO EJECUTADO** | docs-only, sin cambios de comportamiento de producto; el encargo define la validación con `docs:check` + `sdd:check` + greps. `pnpm verify` correría lint/tests/build sobre código que no cambió |

Nota: `pnpm` ejecutó instalación de dependencias en el worktree durante los checks (verificación de lockfile, 813 paquetes) — paso reversible cubierto por el encargo.

## COMMITS

- `36711d041` — `docs(agents): vigencia, produccion web, comandos de supervivencia, idioma y .env*` (AGENTS.md; 18+/3−)
- `38fdd7c3f` — `docs(engineering): extraer contratos de comportamiento y comprimir Vercel/Comandos` (project-rules.md + doc nuevo; 146+/154−)
- `280203fa4` — `docs(norte): retirar back Norte y su mencion en el organigrama` (borrado 2 archivos + organigrama; 1+/222−)
- Commit que contiene este documento — handoff de cierre.

Detalle de proceso: un primer intento de commits absorbió el borrado staged del back Norte dentro del commit de AGENTS.md; se reorganizó con `git reset --mixed` **propio, local y no publicado** (nada destructivo, trabajo conservado) para dejar una unidad lógica por commit. Árbol limpio al cierre.

## PR / BRANCH

- Rama: `codex/docs-agents-pruning` (worktree `DTD-worktrees/docs-agents-pruning`), base `origin/main` @ `a6050cc8b`.
- Push de la rama y PR: autorizados por el encargo; ese push NO publica (solo `main` publica). Estado al cierre de este handoff: ver sección HANDOFF AL DIRECTOR.

## PENDIENTES DE ESTA TAREA

- Ninguno para la aceptación del encargo. La publicación de la rama/PR se ejecuta al cierre de esta sesión según la autorización vigente; su URL queda registrada por la sesión al crearla.

## FUERA DE ALCANCE DETECTADO

Menciones residuales al back Norte en archivos **fuera del allowlist** — no tocadas, reportadas para decisión del Director:

1. `.gitignore:153` — entrada `docs/design/studio/_norte/backend/prisma/` ahora huérfana (esa carpeta prisma jamás estuvo en git; era del prototipo original). Limpiable en una pasada de harness.
2. `docs/architecture/schema-reconciliation.md:8,54` — cita `_norte/backend/API-CONTRACT.md` como **fuente del método** con que se derivó el blueprint de entidades (doc fechado 2026-06-21). **Ambigua:** es registro de cómo se hizo la reconciliación, no instrucción de lectura; borrarla alteraría el registro del método. Según la regla del encargo («ante ambigüedad: no borres, repórtala») se conserva.
3. `docs/design/studio/NORTE-CHANGELOG.md:439,443` — bitácora histórica de la consolidación `BACKEND-BRIEF.md` + `PROMPT-BACKEND.md` → `backend/README.md`. Registro histórico; fuera de allowlist además.

Menciones verificadas en zonas **excluidas por diseño** del encargo (documentadas, intactas): `docs/specs/**` (0040:308, 0021:347, 0582:25, 0573:970), `.agents/handoffs/**` (9 archivos, incluidos los que ya reportaban la ruta abreviada rota `_norte/backend/README.md`), y `docs/design/studio/_norte/**` fuera de `backend/` (HANDOFF.md, HANDOFF-MOBILE.md ×2, CHANGELOG.md, `_archivo/Reporte DTD-Cargo.html`). El barrido case-insensitive de «north» no arrojó menciones al back (solo North America/North Virginia/nombre de worktree ajeno).

## HANDOFF AL DIRECTOR

- Tarea completa según los criterios del encargo; árbol limpio, claim liberado con `release --owner docs-agents-pruning-worker` al cierre (salida conservada por la sesión).
- Siguiente acción: revisión del diff (4 commits) y, si procede, integración por PR — recuerda que merge a `main` publica web (SDD-0541) y exige autorización propia.
- Cambios compartidos a vigilar: ningún contrato de API/schema/UI afectado (docs-only). El doc nuevo `docs/engineering/contratos-de-comportamiento.md` es derivado de project-rules.md; si se edita la sección resumen, mantener el enlace bidireccional.
- Sesiones consumidoras: ninguna conocida sobre los archivos editados; los handoffs históricos que citan `_norte/backend/README.md` son evidencia fechada y no requieren corrección retroactiva.
- Impacto documental: AGENTS.md (normativa de agentes) y project-rules.md (guía madre) actualizados; docs/README.md sin cambio requerido; no aplica marketing/legal.
