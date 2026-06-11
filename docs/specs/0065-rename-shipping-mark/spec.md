---
sdd: "0065"
title: "Rename de marca MARKBOX → \"Shipping Mark\" (solo nombre visible, identificador interno intacto)"
status: in-progress
author: "equipo DTD + founder + Claude Code"
created: 2026-06-08
updated: 2026-06-10
supersedes: null
superseded_by: null
related: ["0010","0042","0064"]
confidencialidad: interno
---

# DTD-0065 — MARKBOX → "Shipping Mark" (display-only)

> Decisión de equipo (2026-06-08): el nombre de cara al cliente "MARKBOX" se renombra a **"Shipping Mark"** para alinear con el término que el proveedor chino entiende (唛头 / *shipping mark*) y evitar la confusión de "mark box" con el empaque/diseño de venta al detal. **Solo cambia el nombre visible; el identificador interno NO se toca.**

## Contexto

"MARKBOX" aparece en **2.061 ocurrencias / 300 archivos**, pero son dos cosas distintas:
- **Nombre de marca visible** (lo que ve el cliente): el subconjunto a renombrar.
- **Identificador de código** (`markbox` columna DB en `clients`, RPC `next_markbox`, campos TS, variables, llave de login del Portal, formato de código `DTD-NNNN`, valores sellados en capa legal/facturas, QR de cajas en tránsito, Excel de proveedores, Kommo): **NO se toca.**

El Excel oficial 入仓单 ya usa `客户唛头 SHIPPING MARK` → la web era la inconsistente; este rename la alinea.

## Decisiones (founder 2026-06-08)

1. **Término visible = "Shipping Mark".** Presentación propuesta (a confirmar): proper noun "Shipping Mark"; en contextos educativos/primer uso, glosa `tu Shipping Mark (la marca que va en tus cajas · 唛头)`. El **código sigue siendo `DTD-NNNN`** (ej. "tu Shipping Mark es DTD-1014").
2. **Profundidad = SOLO nombre visible.** El identificador interno `markbox`, `next_markbox`, la columna DB, el formato `DTD-NNNN` y los valores existentes quedan **idénticos**. Desacople vía un único `const` de etiqueta de marca; el resto del código sigue usando `markbox`.
3. **Alcance = todas las superficies de usuario:** sitio público · Studio (UI) · Portal (UI) · móvil `/m` (incl. i18n `es-VE` y `zh-CN`) · brand book vivo (`public/marca`) · FAQ (web `lib/faqs.ts` + Kommo `faq-knowledge-base.md`). NO se tocan: DB/migraciones, `lib/studio`/`lib/portal` salvo strings de display, tests que asertan el identificador, docs/specs históricos.

## Regla de ejecución (la que evita romper)

- Cambiar **solo strings visibles al usuario** (texto JSX, labels, placeholders, headings, valores de diccionarios i18n, copy de marca).
- **NUNCA** cambiar: acceso a campo (`client.markbox`, `markbox:`), nombres de variable/función/tipo, claves de objeto, llamadas a `next_markbox`, asserts de tests sobre el identificador, columnas/SQL.
- El mapeo (workflow de inventario) clasifica cada ocurrencia como **display** (se cambia) vs **code-identifier** (se salta). Solo se ejecutan los display.

## Ejecución por zonas (gate por zona: typecheck + eslint + `node scripts/verify.mjs`)

| Zona | Superficie | Notas |
|---|---|---|
| 1 | Público (`app/` raíz + `components/` + `lib/design-tokens`/`faqs`/`servicios-detalle`/`public` + `public/llms.txt` + `public/marca`) | Mi lane original |
| 2 | Studio UI (`app/studio` strings + headers de tabla/labels) | display-only |
| 3 | Portal UI (`app/portal` strings) | display-only; el login sigue por `markbox` interno |
| 4 | Móvil (`app/m` + `lib/i18n/es-VE` + `lib/i18n/zh-CN`) | i18n centralizado; zh-CN → 唛头/Shipping Mark |
| 5 | Brand vivo + FAQ (`public/marca/brand-book-*.html`, `lib/faqs.ts`, `docs/specs/0062/.../faq-knowledge-base.md`) | coherencia con la web |

## Branch

Cruza Studio/Portal → **branch dedicado** (`feat/rename-shipping-mark`), separado de `feat/servicios-detalle-publico` (que tiene el trabajo público de SDD-0064). Sin push sin OK del founder.

## Pendiente de confirmar
- Presentación exacta del término ("Shipping Mark" a secas vs con glosa español/唛头).
- Branch dedicado vs continuar en el actual.

## Registro de ejecución — 2026-06-10

Pasada display-only ejecutada en las 5 zonas (junto con el barrido voseo→tuteo de F1
del PLAN-MAESTRO), en `main` local, gate `node scripts/verify.mjs` TODO VERDE
(typecheck + lint + rsc-boundary + 1514 tests + docs:check):

- **Zona 1 público**: ya estaba migrada en su mayoría (SDD-0064); restos en comentarios
  y `lib/news` corregidos. `lib/faqs.ts` reescrito (F4) ya con "Shipping Mark".
- **Zona 2 Studio**: ~177 archivos, 386 reemplazos (la mayoría voseo; 10 strings MARKBOX
  visibles restantes, incl. header CSV de reportes sincronizado con su test).
- **Zona 3 Portal**: 0 strings MARKBOX visibles restantes (ya migrada); comentarios con
  la política vieja ("de cara al cliente es MARKBOX") corregidos a la doctrina 0065.
- **Zona 4 móvil/i18n**: 0 restantes (es-VE "Shipping Mark" / zh-CN "唛头 (Shipping Mark)").
- **Zona 5 brand vivo + seeds**: `public/marca/brand-book-v3.2.html`,
  `scripts/seed-mail-templates.ts` (para que un re-seed no reintroduzca voseo/MARKBOX
  — la BD de prod ya fue corregida a mano el 10-jun), `faq-knowledge-base.md` (Kommo).
- Identificadores intactos (verificado por los 5 agentes): `markbox`, `client_markbox`,
  `next_markbox`, `welcome_markbox`, `{{markbox}}`, ruta `[markbox]`, ids/htmlFor,
  clase CSS `.markbox-celebrate`, asserts de tests de identidad.
- Docs normativos alineados: `AGENTS.md`, `BRAND.md` y `app/studio/CLAUDE.md` (que
  además PRESCRIBÍA voseo — corregido a tuteo venezolano neutro).
- Fuera de alcance (sin tocar): prompts LLM internos con meta-voz voseo
  (`lib/news/prompts.ts`, noticias-web actions), specs históricos, DB/columnas.

Pendiente DB (no correos): mención "MarkBox" en `news_posts.body_markdown` del post
"Tiempos reales de tránsito" — SQL propuesto en el reporte de sesión, requiere
autorización para tocar prod.
