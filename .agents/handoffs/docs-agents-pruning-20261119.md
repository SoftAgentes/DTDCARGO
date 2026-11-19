# Handoff — docs-agents-pruning-20261119

**Fecha:** 2026-11-19 · **Owner:** docs-agents-pruning-worker · **Sesión:** Worker (esta sesión, sesión escritora del worktree).
**Worktree:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\docs-agents-pruning` · **Rama:** `codex/docs-agents-pruning` · **Base:** `origin/main` @ `a6050cc8b`.
**SDD:** sin SDD nuevo (cambio de harness/documentación, sin comportamiento Studio), según encargo.
**Aceptación:** AGENTS.md ≤200 líneas con enlaces que resuelven; project-rules.md sin la sección larga de contratos y con §Comandos completo; carpeta `_norte/backend/` eliminada y menciones vivas al back Norte corregidas dentro del allowlist — quedan menciones vivas dentro de `docs/design/studio/_norte/**`, no tocadas por estar fuera del alcance del encargo (lista con archivo:línea en FUERA DE ALCANCE); `pnpm docs:check` y `pnpm sdd:check` en verde; sin cambios de producto.
**Permisos:** edición/pruebas dentro del allowlist, commits locales selectivos, push de la rama propia y apertura de PR — autorizados por el encargo (Sam, 2026-11-19). NO autorizado: merge a main, deploy, migraciones, lectura de filas de negocio/PII, tocar el Norte de diseño.

**Salida del claim (conservada; re-adquirido por el seguimiento de la PR #706 sobre la cabeza `48207f65d`, misma salida):**

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

## SEGUIMIENTO PR #706 (2026-11-19, revisión CHANGES_REQUESTED)

**Objetivo del seguimiento:** atender las 3 correcciones del revisor partiendo de la cabeza `48207f65d` (verificada con `git log`), misma rama `codex/docs-agents-pruning`, mismo worktree, claim re-adquirido (`guard` + `claim --owner docs-agents-pruning-worker`). Allowlist del seguimiento: este handoff y `docs/engineering/project-rules.md`. `docs/design/studio/_norte/**` permaneció read-only (solo lectura para verificar y listar).

**Corrección 1 — handoff honesto:** eliminado «cero menciones vivas al back Norte en activos» de ACEPTACIÓN y «0 menciones vivas» de la fila del grep en VALIDACIÓN; ambos puntos ahora declaran que quedan menciones vivas al back Norte dentro de `docs/design/studio/_norte/**`, no tocadas por estar fuera del alcance del encargo. En FUERA DE ALCANCE quedó la lista verificada con archivo:línea: las 16 candidatas del revisor coincidieron todas con `git grep -n "backend/" 48207f65d -- docs/design/studio/_norte` (ninguna hubo que corregir), más las menciones adicionales que el mismo grep detectó y la propuesta al DG de seguimiento para marcarlas históricas (tarea NO ejecutada aquí).

**Corrección 2 — puntero de producción web (project-rules.md, bloque ~55):** el destino «Detalle e historia» del `ignoreCommand` ahora apunta a `docs/runbooks/codex-engineering.md` (nota del 2026-10-19, líneas 305-317, donde de verdad está el detalle: Vercel en pausa desde el 2026-10-16 y su `ignoreCommand` ya no decide nada — contenido verificado allí antes de cambiar la referencia); `publicacion-automatica-web.md` queda como puntero del detalle del vigilante. Línea agregada: «`vercel.json` conserva `ignoreCommand` mientras Vercel esté en pausa; si se reactiva, revisar esa sección antes».

**Corrección 3 — §Patrones del Studio (project-rules.md, ~151):** línea nueva de multi-tenant (el tenant sale de la sesión/token y el cliente nunca lo elige; RLS y el servidor son la frontera; ocultar en la UI no es control). `docs/governance/policies/aud-01.md` y `aud-02.md` verificadas con Test-Path antes de escribirlas: ambas existen (`True`/`True`; AUD-01 auditoría de mutaciones, AUD-02 consulta/conservación/logs), se enlazan las dos. Ninguna ausente que reportar.

**Validación del seguimiento:**

| Comprobación | Resultado | Evidencia |
|---|---|---|
| `pnpm docs:check` | **PASÓ** | exit 0 · «✓ docs:check — índice sincronizado con 663 specs» |
| `pnpm sdd:check` | **PASÓ** | exit 0 · 663 specs · 550 migraciones · «[OK] numbering: sin números repetidos» (⏸ = choques históricos ya aplicados en prod, no renumerables) |
| `git diff --check` | **PASÓ** | exit 0, sin warnings de espacios |
| Diff del commit nuevo: solo los 2 archivos del allowlist | **PASÓ** | `git status --short` previo al commit: solo `.agents/handoffs/docs-agents-pruning-20261119.md` y `docs/engineering/project-rules.md` |

## VALIDACIÓN (cierre original, 2026-11-19)

| Comprobación | Resultado | Evidencia |
|---|---|---|
| `pnpm docs:check` | **PASÓ** | exit 0 · «✓ docs:check — índice sincronizado con 663 specs» |
| `pnpm sdd:check` | **PASÓ** | exit 0 · 663 specs · 550 migraciones · «[OK] numbering: sin números repetidos» (los ⏸ son choques históricos ya aplicados en prod, documentados como no renumerables) |
| grep post-borrado (activos, excluyendo specs/handoffs/archive) | **PASÓ** | 0 menciones vivas dentro del allowlist; quedan menciones vivas al back Norte en `docs/design/studio/_norte/**` — fuera del alcance del encargo, listadas con archivo:línea en FUERA DE ALCANCE — y 3 archivos residuales fuera de allowlist reportados abajo |
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
- `c59f6b297` — `chore(handoff): cierre de docs-agents-pruning-20261119` (este handoff).
- `48207f65d` — `chore(handoff): registrar PR #706 en el handoff`. Cabeza de partida del seguimiento.
- `ee154c39a` — `docs(agents): atender revision de PR #706 (handoff honesto, punteros y multi-tenant)` (handoff + project-rules.md; solo los 2 archivos del allowlist del seguimiento). **Cabeza nueva del seguimiento.**

Detalle de proceso: un primer intento de commits absorbió el borrado staged del back Norte dentro del commit de AGENTS.md; se reorganizó con `git reset --mixed` **propio, local y no publicado** (nada destructivo, trabajo conservado) para dejar una unidad lógica por commit. Árbol limpio al cierre.

## PR / BRANCH

- Rama: `codex/docs-agents-pruning` (worktree `DTD-worktrees/docs-agents-pruning`), base `origin/main` @ `a6050cc8b`.
- PR: **https://github.com/SoftAgentes/DTDCARGO/pull/706** — recibió revisión CHANGES_REQUESTED; el seguimiento de esta sesión atiende sus 3 correcciones y se empuja con push normal a `origin/codex/docs-agents-pruning` (sin force; la PR se actualiza sola). El CI corre sobre la cabeza por SDD-0621. Push de la rama propio, sin destino `main`: NO publica web. La PR NO se fusiona desde aquí.

## PENDIENTES DE ESTA TAREA

- Ninguno para la aceptación del encargo ni del seguimiento de la PR #706. Para el Director queda la **propuesta de seguimiento del Norte** (ver FUERA DE ALCANCE: marcar las líneas listadas como históricas con nota «el backend real es Supabase») y la decisión sobre integrar la PR (merge a `main` publica web, SDD-0541).

## FUERA DE ALCANCE DETECTADO

Menciones residuales al back Norte en archivos **fuera del allowlist** — no tocadas, reportadas para decisión del Director:

1. `.gitignore:153` — entrada `docs/design/studio/_norte/backend/prisma/` ahora huérfana (esa carpeta prisma jamás estuvo en git; era del prototipo original). Limpiable en una pasada de harness.
2. `docs/architecture/schema-reconciliation.md:8,54` — cita `_norte/backend/API-CONTRACT.md` como **fuente del método** con que se derivó el blueprint de entidades (doc fechado 2026-06-21). **Ambigua:** es registro de cómo se hizo la reconciliación, no instrucción de lectura; borrarla alteraría el registro del método. Según la regla del encargo («ante ambigüedad: no borres, repórtala») se conserva.
3. `docs/design/studio/NORTE-CHANGELOG.md:439,443` — bitácora histórica de la consolidación `BACKEND-BRIEF.md` + `PROMPT-BACKEND.md` → `backend/README.md`. Registro histórico; fuera de allowlist además.

Menciones vivas al back Norte dentro de `docs/design/studio/_norte/**` — fuera del alcance del encargo (el Norte es read-only aquí); intactas y listadas con archivo:línea. Verificadas con `git grep -n "backend/" 48207f65d -- docs/design/studio/_norte`: **las 16 líneas candidatas del revisor de la PR #706 coincidieron todas con el grep**, ninguna hubo que corregir:

- `docs/design/studio/_norte/HANDOFF.md:11, :105, :123, :210`
- `docs/design/studio/_norte/CLAUDE.md:386, :423`
- `docs/design/studio/_norte/HANDOFF-NOMINA.md:5, :47`
- `docs/design/studio/_norte/HANDOFF-CBM-MEDIDAS.md:7`
- `docs/design/studio/_norte/HANDOFF-SESION-2026-06-20.md:58`
- `docs/design/studio/_norte/SYNC-NORTE-2026-06-14.md:97`
- `docs/design/studio/_norte/BRAND-DECISIONS-BD037-BD069.md:517`
- `docs/design/studio/_norte/design_handoff_mobile_app/CLAUDE.md:301, :338`
- `docs/design/studio/_norte/Portal del Cliente · Rediseño · DTD-Cargo.html:251`

El mismo grep encuentra menciones adicionales que el revisor no listó (también vivas, también intactas): bitácora histórica `docs/design/studio/_norte/CHANGELOG.md:275, :559, :565, :571, :1170, :1172, :1177, :1591, :1597` (registro de la creación de `backend/`; `:1875` es falso positivo: «backend/próximo» no es una ruta), `HANDOFF-MOBILE.md:9, :197`, `design_handoff_mobile_app/HANDOFF-MOBILE.md:9, :197`, `_archivo/Reporte DTD-Cargo.html:229` y comentarios de código en `erp/api/client.jsx:9` y `erp/modules/estudio-redes.jsx:14`.

**Propuesta al DG (tarea de seguimiento, NO ejecutada en este encargo):** marcar esas líneas del Norte como históricas con una nota tipo «el backend real es Supabase; ver `docs/engineering/project-rules.md` §Patrones del Studio», en una tarea con allowlist propio sobre `docs/design/studio/_norte/**` (para este encargo el Norte es read-only).

Menciones verificadas en otras zonas **excluidas por diseño** del encargo (documentadas, intactas): `docs/specs/**` (0040:308, 0021:347, 0582:25, 0573:970) y `.agents/handoffs/**` (9 archivos, incluidos los que ya reportaban la ruta abreviada rota `_norte/backend/README.md`). El barrido case-insensitive de «north» no arrojó menciones al back (solo North America/North Virginia/nombre de worktree ajeno).

## HANDOFF AL DIRECTOR

- Cierre original completo (4 commits de trabajo + 2 de handoff) y **seguimiento de la PR #706 completo**: las 3 correcciones del revisor atendidas sobre `48207f65d`, validación en verde, push normal a la rama propia. Árbol limpio, claim liberado con `release --owner docs-agents-pruning-worker` al cierre (salida conservada por la sesión).
- Siguiente acción: re-revisión de la PR #706 (el diff nuevo toca solo el handoff y project-rules.md) y, si procede, integración — recuerda que merge a `main` publica web (SDD-0541) y exige autorización propia. Decidir también la propuesta de seguimiento del Norte (FUERA DE ALCANCE).
- Cambios compartidos a vigilar: ningún contrato de API/schema/UI afectado (docs-only). El doc nuevo `docs/engineering/contratos-de-comportamiento.md` es derivado de project-rules.md; si se edita la sección resumen, mantener el enlace bidireccional. El bloque de producción web de project-rules.md ahora enlaza el detalle del `ignoreCommand` a `docs/runbooks/codex-engineering.md` (nota del 2026-10-19): si Vercel se reactiva, revisar esa sección antes de tocar `vercel.json`.
- Sesiones consumidoras: ninguna conocida sobre los archivos editados; los handoffs históricos que citan `_norte/backend/README.md` son evidencia fechada y no requieren corrección retroactiva.
- Impacto documental: AGENTS.md (normativa de agentes) y project-rules.md (guía madre) actualizados; docs/README.md sin cambio requerido; no aplica marketing/legal.

## SINCRONIZACION CON MAIN (instruccion DG, 2026-11-19)

La rama estaba BEHIND de main (main traia #705 y #703). Merge normal de origin/main (62659728f), sin force, estrategia ort, SIN conflictos (el indice de specs no entro al merge; no hizo falta el driver dtd-generated-records). Solo docs:check y sdd:check, nada de install ni vitest:

| Comprobacion | Resultado |
|---|---|
| git merge origin/main | PASO - exit 0, 16 archivos de main integrados |
| pnpm docs:check | PASO - exit 0, indice sincronizado con 663 specs |
| pnpm sdd:check | PASO - exit 0, [OK] numbering sin numeros repetidos |

Cabeza nueva tras el merge: 1bf1ff1c9 (merge de 62659728f sobre 6c6b4d082). Sin cambios propios adicionales en la rama. Integracion a main: la hace el DG por el tren.
