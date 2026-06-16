---
description: Radar del proyecto — auditoría del workspace de Claude Code (config · tokens · harness) + progreso del Norte, detectando su versión vigente en cada corrida. Arg opcional: `config` | `norte`.
---

# /radar — auditoría de workspace + progreso del Norte

Sos el **radar** técnico del workspace de DTD Cargo: producís una auditoría **clara, cuantificada y accionable**, basada SOLO en archivos reales del repo — **nunca inventes métricas, versiones ni fases**. Tono técnico, conciso, español. Porcentajes como `N%`. La recomendación #1 se marca con ⭐.

**Argumento (opcional):** `config` (solo Parte A · workspace) · `norte` (solo Parte B · Norte) · vacío = **ambas**.

## Regla 0 · Versión del Norte (SIEMPRE, antes de la Parte B)

Nunca asumas la versión; detectala en vivo cada corrida:

1. **Canónica:** leé el encabezado `## 🟢 Estado actual · vX.Y (fecha)` al tope de `docs/design/studio/_norte/HANDOFF.md` → **versión vigente del Norte**.
2. **Confirmá** con la entrada más reciente de `docs/design/studio/_norte/CHANGELOG.md`.
3. **Drift-check vs AGENTS.md:** buscá la versión que declara el "Protocolo UI handoff-first … hoy vX". Si difiere de la vigente → `⚠️ AGENTS.md desactualizado: dice vX, el Norte vigente es vY → actualizar el puntero`.
4. **Detección de cambio / notificación:** leé `.claude/.radar.state.json` si existe (`{ norteVersion, fecha, ultimaCorrida }`):
   - igual → "Norte sin cambios desde la última corrida (vX · fecha)".
   - avanzó → "🔔 El Norte avanzó **vX → vY** (fecha) desde la última corrida → Parte B recalculada sobre **vY**".
   - no existe → primera corrida registrada.

   Al cerrar, **escribí/actualizá** `.claude/.radar.state.json` con la versión y fecha vigentes + la fecha de esta corrida. (Ese archivo ya queda fuera de git por la regla `.claude/*`.)
5. La versión detectada va en el **encabezado del informe** y en el **Resumen ejecutivo**.

## Regla 0.5 · Gate de marca (brand drift · SIEMPRE)

**El Brand Book vigente es UNO solo** — el de mayor versión en `_norte/` (regla de gobernanza 2026-06-10; book vigente **v4.2**, 2026-06-14). Corré este chequeo y reportá **cualquier hit como hallazgo de severidad alta** (esperado: **0** en archivos vivos):

```
rg -nS "brand-book-v[12]|brand-book-v3\.[0-7]|brand-book-v4\.[01]|Brand Book(?: DTD)? v(1\.|2\.|3\.[0-7]|4\.[01])|v1\.7-claude-design|_archivo-v1|handoffs-archive|_handoff_preview|BANDBOOK" app components lib public scripts e2e supabase docs AGENTS.md BRAND.md README.md --glob "!docs/specs/**" --glob "!**/NORTE-CHANGELOG.md" --glob "!docs/design/studio/_norte/**" --glob "!public/marca/brand-book-v*.html" --glob "!supabase/migrations/**" --glob "!docs/archive/**" --glob "!docs/design/studio/bug-reporter-v1.4.1/**"
```

- **Exclusiones legítimas (historia, NO cuentan como drift):** `docs/specs/**` (registros SDD), `NORTE-CHANGELOG.md`, `_norte/**` **solo para el grep de _contenido_** (sus bitácoras citan versiones viejas a propósito — su **presencia física** se valida aparte en la Regla 0.5b de abajo), `supabase/migrations/**` (migraciones aplicadas = inmutables; editar una rompe el hash del historial), `docs/archive/**` (sesiones congeladas) y `docs/design/studio/bug-reporter-v1.4.1/**` (handoff enlazado por SDD-0036).
- **Casing del tagline:** `rg -n "Con confianza" app components lib e2e` (minúscula) → drift; el oficial es **"Con Confianza"** (C mayúscula, 2026-06-05).
- **Terminología:** "MARKBOX" como **texto visible** (labels JSX, emails, placeholders) en **studio / portal / móvil** → drift; oficial ahí = **Shipping Mark** (identificadores internos `markbox`/`MARKBOX_REGEX` siempre OK — SDD-0065). **EXCEPCIÓN — el SITIO PÚBLICO usa MARKBOX a propósito** (decisión founder 2026-06-13, confirmada 2026-06-14 → split intencional: público=MARKBOX, ERP/portal/móvil=Shipping Mark): NO es drift en las rutas públicas (`app/{page,faq,glosario,servicios,cotizar,track,calculadora,noticias,estimacion,contacto,registro}` + `components/` raíz).
- **Book publicado:** el book gateado vive en `private/marca/` (se sirve por ruta authed, NO en `public/` — decisión founder, ver memoria `brand_book_gate`). Debe haber **exactamente un** `private/marca/brand-book-vX.Y.html` y su versión debe coincidir con `_norte/Brand Book DTD vX.Y.html`. Si difieren → "propagar el book a la web" (regla brand-to-web). *(Si aparece un `brand-book-*.html` suelto en `public/marca/` = regresión del gate → sacarlo de `public/`.)*

### Regla 0.5b · Presencia física en disco (NUEVO · tapa el hueco del v3.0, 2026-06-12)

> **Por qué existe:** las re-extracciones de ZIPs de marca quedan `untracked` o `ignored` → sobreviven a `git rm` y **un grep de _contenido_ no las caza** (sobre todo dentro de `_norte/`, que el grep de arriba excluye). El 2026-06-12 esto dejó un `Brand Book v3.0 Package/` con su propio `CLAUDE.md` (¡permitía voseo!) sentado dentro del Norte. Estos 3 chequeos miran **archivos sueltos en el filesystem**, no texto. **Cualquier hit = severidad alta.**

```
# 1 · Books huérfanos en disco — esperado: 0 (el v4.2 del Norte + el gateado en private/marca están excluidos)
find . \( -path ./.git -o -path ./.claude/worktrees -o -path ./node_modules -o -path ./.next \) -prune \
  -o -type f -iname '*brand*book*.html' -print \
  | rg -iv 'docs/design/studio/_norte/Brand Book DTD v4\.2\.html|private/marca/brand-book-v4\.2\.html|public/marca/brand-book-v4\.2\.html'

# 2 · CLAUDE.md contradictorio anidado dentro del Norte — esperado: 0 hits
#     (válidos, ya excluidos: el canónico _norte/CLAUDE.md + la copia del paquete móvil design_handoff_mobile_app/)
find 'docs/design/studio/_norte' -name 'CLAUDE.md' | rg -v 'studio/_norte/CLAUDE\.md$|studio/_norte/design_handoff_mobile_app/CLAUDE\.md$'

# 3 · Carpetas branding viejas presentes en el árbol — esperado: 0
find . \( -path ./.git -o -path ./.claude/worktrees -o -path ./node_modules -o -path ./.next \) -prune \
  -o -type d \( -iname 'BANDBOOK*' -o -iname '_handoff_preview' -o -iname 'handoffs-archive' \
    -o -iname '_archivo-v1*' -o -iname 'v1.7-claude-design' -o -iname '*Brand Book v[0-9]*Package*' \
    -o -iname 'Brand_Book_*' \) -print
```

- **Excepción única:** `.claude/worktrees/**` (worktrees de **otras ventanas** — su limpieza es de esa lane, no de acá). El check #1/#3 ya los podan; no los reportes como drift de esta ventana, solo nótalos al final si querés avisarle a esa lane.
- **`find` ignora `.gitignore` a propósito** → también caza branding viejo que esté *gitignored* (ej. una carpeta `CoWork/`).
- **Duplicado legítimo conocido:** `_norte/design_handoff_mobile_app/CLAUDE.md` es una **copia** de los guardrails (el paquete móvil es auto-contenido). Hoy está **en sync con v3.7** (no-voseo, Nunito+Sora, book v3.7). Como es un segundo source-of-truth: **si editás el canónico `_norte/CLAUDE.md`, replicá el cambio ahí** o diverge. Si el check #2 lista **cualquier OTRO** `CLAUDE.md`, triá si contradice el canónico (voseo, fuentes, versión de book) antes de aceptarlo o whitelistearlo.
- **Si hay hit:** es una re-extracción suelta. Borrala del working-tree (`rm -rf '<ruta>'`) — **no-destructivo para git** (la historia del book viejo vive en commits). **Causa raíz:** descomprimir un ZIP de marca *dentro* del repo. **Regla:** extraé **fuera** del repo (ej. `Downloads/`) y copiá solo el archivo canónico al `_norte/`.

## Parte A · Auditoría de workspace / config

Reportá, con acción concreta por hallazgo:

- **Contexto always-loaded:** tamaño de `AGENTS.md` (raíz, fuente real vía `@AGENTS.md`) + CLAUDE.md anidados; flag si `AGENTS.md` >5k tokens o si referencia carpetas de diseño archivadas (`v1.x-…`). Verificá el puente `CLAUDE.md → @AGENTS.md`.
- **Permisos** (`.claude/settings.json` + `.claude/settings.local.json` + `~/.claude/settings.json`): contá y listá los **obsoletos** (ej. refs al path viejo `IA ANTROPIC\dtd-cargo`) y los **wildcards demasiado amplios** (`npm run *`, `npx tsc *`) → recomendá podar/acotar.
- **Hooks:** Stop = `scripts/harness-verify-hook.mjs` → `scripts/verify.mjs`. Notá el runtime del gate; flag si es lento o flaky (el "failed to find the runner" de vitest es un worker caído transitorio, NO regresión → re-correr).
- **Modelo:** notá `effortLevel`/modelo configurado; sugerí dónde Sonnet/Haiku baja costo en tareas mecánicas.
- **Higiene de contexto:** recomendá `/clear` entre tareas no relacionadas; marcá prompts/commands fragmentados que se podrían unificar.
- **Inventario** de skills/commands (proyecto + user) → flag de duplicación/consolidación.
- **Estimación de ahorro de tokens** (aprox).

## Parte B · Auditoría de progreso del Norte (sobre la vX.Y detectada en la Regla 0)

Leé y cruzá:
- `docs/architecture/schema-reconciliation.md` → markers `✅` / `🟡` / `❌` por entidad + roadmap de **Bloques 1-5**.
- `docs/architecture/module-sdd-map.md` → módulos ↔ SDD.
- `docs/design/studio/_norte/HANDOFF.md` → estado del prototipo.

Calculá **solo desde markers reales** (si un dato no está, decí "no documentado"):
- **% completitud del modelo de datos** = `✅` / total · **% faltante** = (`🟡` + `❌`) / total.
- **% faltante por Bloque** (fase), desde su estado documentado.

Priorizá las fases (criterio: **criticidad de negocio + estado de bloqueo + leverage**) con justificación breve y recomendaciones por fase. Identificá el **bottleneck único más caro**.

## Formato de salida

```
# 📡 Radar DTD · Norte vX.Y (fecha) — corrida [fecha de hoy]

## Resumen ejecutivo
[versión del Norte + estado de cambio + 2-3 líneas]

## Parte A · Workspace
| # | Hallazgo | Severidad | Acción |
| 1 ⭐ | … | alta | … |
Ahorro estimado de tokens: ~N%

## Parte B · Norte vX.Y
% faltante por fase: [Bloque → falta N%]
Priorización: Bloque X ⭐ > … (justificación)
Recomendaciones por fase · Bottleneck

## Versión del Norte
[vX.Y detectada · drift vs AGENTS.md · cambio desde la última corrida]
```

## Artefacto para la torre de control · `public/api/radar-report.json` (SIEMPRE, al cerrar)

Además del informe en chat, **escribí/actualizá** `public/api/radar-report.json` con el
mismo informe en forma estructurada. Ese artefacto (versionado en git) es lo que la
pestaña **Radar** de `/studio/debug` (SDD-0050) muestra en la web — el Radar no corre
en la web, solo se ve su último informe local. La forma (validada por
`lib/studio/radar-types.ts` → `isRadarReport`):

```json
{
  "generatedAt": "YYYY-MM-DD",          // fecha ISO de esta corrida
  "norteVersion": "vX.Y",               // la detectada en la Regla 0
  "partA": {
    "findings": [
      {
        "id": "kebab-id",               // estable, descriptivo
        "title": "…",
        "severity": "alta|media|baja",
        "action": "acción concreta",
        "top": true                      // opcional · solo en el hallazgo #1 (⭐)
      }
    ],
    "estimatedTokenSavings": "~N%"       // ahorro estimado de tokens
  },
  "partB": {
    "counts": { "built": N, "partial": N, "missing": N, "total": N },
    "blocks": [                          // opcional · roadmap por Bloque
      { "name": "Bloque X · …", "remaining": "N%", "note": "…" }
    ]
  }
}
```

Reglas para el artefacto: solo datos reales (mismas reglas anti-invención del chat);
`generatedAt` = fecha de hoy; `norteVersion` = la versión vigente detectada en la
Regla 0; `partB.counts` = conteo de markers `✅`/`🟡`/`❌` de
`docs/architecture/schema-reconciliation.md` (`built`/`partial`/`missing`, `total` = suma).
Sobreescribí el archivo completo (no append). Esto NO es `git push` — solo dejás el
artefacto en el árbol; el founder decide cuándo commitearlo.

## Cómo respondés

- **Cero métricas inventadas:** si un dato no está en un archivo, escribí "no documentado".
- Si el Norte avanzó de versión, **avisalo arriba** y recalculá la Parte B sobre la vigente.
- Terse, español, porcentajes como `N%`, #1 con ⭐, sin jerga "F5/F1".
- No commitees ni hagas `git push` — el radar solo reporta (y deja el artefacto JSON en el árbol).
