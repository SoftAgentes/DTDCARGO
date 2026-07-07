# Handoff — Rediseño del ERP (DTD Studio) · 2026-07-06

> **Para la nueva sesión.** Este doc es el punto de partida del **rediseño del ERP** con las técnicas de diseño que construimos el 2026-07-06. Orden acordado por el founder: **primero el ERP, después la página web.** Léelo completo antes de tocar nada.

---

## 0 · Cómo arrancar (nueva sesión)

1. Corre `/avivar` (contexto general del repo).
2. Lee **en orden**: este brief → `BRAND.md` (tiene capa nueva ♿) → `app/studio/CLAUDE.md` (patrones del ERP) → el Norte vigente en `docs/design/studio/_norte/` (versión al tope de `HANDOFF.md`, detéctala en vivo).
3. La herramienta principal del rediseño es **`/ui-pro <ruta-módulo>`** — audita, y con `--fix` aplica correcciones seguras. Úsala por módulo, ANTES y DESPUÉS de rediseñar.
4. Trabaja **módulo por módulo** (no big-bang). Verifica `node scripts/verify.mjs` + `pnpm build` (usa `node node_modules/next/dist/bin/next build` por el gotcha pnpm) antes de cualquier push. **NO push sin OK del founder.**

---

## 1 · Qué construimos hoy (el contexto que da origen a esto)

Sesión ultracode 2026-07-06. Todo LIVE en `main`. Ver memoria `project_brand_uipro_cloud_sync`.

- **`BRAND.md` endurecido** — capa nueva **♿ Contraste & legibilidad (WCAG 2.2 AA)** medida sobre los tokens reales, + **📖 legibilidad tipográfica**, **🎚️ densidad por superficie**, **✅ estados obligatorios**. La **5ª regla pasó a 6ª: "Todo texto se lee"**.
- **Skill `/ui-pro`** — auditoría de diseño PROFUNDA: 10 dimensiones, score 0–10, `--fix` (solo tokens válidos), `--live` (Playwright). Con 5 references en `.claude/skills/ui-pro/references/`. **Probado en vivo sobre `reclamos` → 8/10** (encontró bugs reales, ver §3).
- **Fixes de accesibilidad YA aplicados al ERP** (no rehacer): focus ring dark `--wine`→`--wine-soft` (`app/studio/tokens.css`); 569 usos de `--ink-mute` como texto → `--ink-soft`.
- **Cloud Design alineado** — el Norte va a traer la capa ♿ documentada; cuando baje la versión nueva se hace NORTE-SYNC.

---

## 2 · El arsenal de técnicas (lo que el rediseño debe aplicar)

Todo esto vive destilado en `.claude/skills/ui-pro/references/` (el skill lo carga solo). Resumen:

- **Contraste WCAG medido** (`contraste-tokens.md`): matriz light+dark de los tokens DTD. Umbrales: normal ≥4.5:1 · grande (≥24px o ≥18.66px bold) ≥3:1 · no-texto/foco ≥3:1. Paridad light/dark obligatoria. `--ink-mute`/`--wine-soft`/`--warning` NO son texto body.
- **Jerarquía visual**: squint + grayscale test; 1 solo CTA primario por vista; variar 1–2 palancas (size/weight/color).
- **Tipografía & lectura** (`tipografia.md`): measure 45–75ch, interlineado body 1.5–1.75; `tabular-nums` en KPIs/columnas.
- **Estados** (`ai-slop.md` + SKILL): 6 interactivos (default/hover/focus/active/disabled/loading) + datos (empty/sparse/dense/error/success). Loading anti-flicker (show-delay 150–300ms, mín visible 300–500ms); skeletons que espejan.
- **Heurísticas** (`heuristicas.md`): Nielsen 10, Krug 3, Trunk test, **Norman** (golfo de ejecución/evaluación, test de 10s, escalera de tiempos 0.1/1/10s).
- **Vercel Web Interface Guidelines** (oro para el ERP): forms (permitir enviar incompleto, error junto al campo + focus al 1º, nunca bloquear paste), focus/modales (trap + restaurar foco + Escape + `overscroll-behavior:contain`), **deep-linking de estado** (filtros/tabs/paginación en la URL), UI optimista, craft (radios concéntricos, tint hacia el hue sobre navy, `tabular-nums`).
- **Microinteracciones**: feedback ≤100ms, duración ≤200ms, solo `transform`/`opacity`, nunca `transition:all`, anima el elemento no un toast aparte.
- **Accesibilidad WCAG 2.2**: targets ≥24px, `:focus-visible` siempre, teclado completo (`<a>`/`<Link>`, sin `tabindex>0`), reflow 320px (tablas densas exentas con su `overflow-x:auto`), `prefers-reduced-motion`.

---

## 3 · Hallazgos reales del ERP (punto de partida — `/ui-pro` sobre `reclamos`)

Estos son **sistémicos** — muy probablemente se repiten en los 55 módulos. El rediseño los ataca de raíz en las **primitivas compartidas**:

1. 🔴 **Trampa de teclado**: filas de tabla como `<tr onClick>` sin `tabindex`/`role`/`onKeyDown` → el detalle no se alcanza sin mouse (WCAG 2.1.1, nivel A). **Patrón a arreglar en la primitiva de tabla, no módulo por módulo.**
2. 🟡 **Reflow**: tablas sin `overflow-x:auto` propio se recortan a 320px (WCAG 1.4.10).
3. 🟡 **Target size**: botones/íconos <24px (thumbnails, "×" de borrar).
4. 🟡 **Spacing en px crudos** (`padding:"22px 24px"`, `gap:14`) en vez de `var(--s-*)` → además bypassea `[data-density="compact|spacious"]`.
5. 🟡 **Motion hardcodeado** (`transition:"opacity 0.12s"`) en vez de `var(--dur-fast) var(--ease)`.
6. ✅ Contraste (focus ring dark + `--ink-mute` texto) — **ya arreglado hoy**, pero re-auditar con `/ui-pro` por si quedan casos.

Lo que YA está bien en el ERP (conservar): componentes del sistema (`KpiCard`, `Badge`, `DrawerShell`, `ActionButton`), trazabilidad visual (toast + row-flash), columnas configurables, `NumericInput`.

---

## 4 · Enfoque de rediseño recomendado (⭐ sistemático, no big-bang)

**Fase A — Primitivas compartidas primero** (`app/studio/_components/ui/`): acá se arregla una vez y se propaga a los 55 módulos.
- Primitiva de **tabla accionable** (teclado + reflow + target sizes + row-highlight ya existente).
- **Estados**: `EmptyState` ya existe; sumar patrones de loading (skeleton espejo), sparse/dense, error inline.
- Escala de spacing/motion: barrer px crudos → `var(--s-*)` y motion → `var(--ease)`/`--dur-*` (candidato a `/ui-pro --fix`).

**Fase B — Módulos por tráfico/valor** (cotizador, tracking, clientes, despacho, contabilidad…): `/ui-pro <módulo>` → aplicar → re-auditar. Un módulo por PR, verify+build, commit selectivo.

**Fase C — Consistencia final**: pasada de `/ui-pro` sobre el shell (sidebar, topbar) + dark mode completo + un barrido de `design-critic` como lente de "design director".

Respeta SIEMPRE los patrones de `app/studio/CLAUDE.md` (ActionButton, DrawerShell HTML5, trazabilidad visual, 8 reglas de botones, columnas configurables, NumericInput).

---

## 5 · Reglas duras (no se rompen)

- **Frontera público↔ERP**: el ERP usa `@/lib/db/server` + Supabase; jamás mezclar con el sitio público.
- **Solo tokens `var(--*)`** de `app/studio/tokens.css` (light+dark+density). Cero hex inventados. Sobre navy usar `--ink-inv-*`/`--ink-side-*`, nunca `rgba(255,255,255,x)`.
- **`docs/design/studio/_norte/**` es read-only** (viene de Cloud Design). Detectar la versión del Norte en vivo, no hardcodear.
- **Español venezolano tuteo, cero voseo.** CTAs con verbo directo, "Shipping Mark" (no MARKBOX en el ERP), sin "responsabilidad".
- **Todo cambio visual pasa por `/ui-pro`** (profundo) o `/ui-check` (liviano) antes del commit.
- **Verify + build antes de push. NO push sin OK del founder** (el OK = "cerrar"/"pushea").

---

## 6 · Punteros

- Reglas de marca: **`BRAND.md`** (capa ♿ + 6 reglas).
- Patrones ERP: **`app/studio/CLAUDE.md`**.
- Auditoría: **`/ui-pro <ruta>`** · references en `.claude/skills/ui-pro/references/`.
- Norte: **`docs/design/studio/_norte/`** (Brand Book vigente).
- Sync con Cloud Design: `docs/design/studio/norte-sync-2026-07-06-correcciones-cloud-design.md`.
- Commits de la sesión origen: `3e5cf35b` · `fa421b4e` · `0b903366` · `786dc602`.

---

*Generado 2026-07-06. Cuando llegue el Norte nuevo de Cloud Design (con la capa ♿), correr NORTE-SYNC antes de la Fase C para que tokens y book queden alineados.*
