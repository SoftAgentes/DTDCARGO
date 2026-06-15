---
sdd: "0088"
title: "Motor de contenido de marketing — cerebro de ruteo (Test de Noticia) + taxonomía de negocio (re-enfoque de noticias-web)"
status: proposed
author: "Claude Code (ventana motor-noticias) + founder"
created: 2026-06-14
updated: 2026-06-15
supersedes: null
superseded_by: null
related: ["0064"]
confidencialidad: interno
---

# SDD-0088 — Motor de contenido de marketing (cerebro + taxonomía de negocio)

> **No se construye de cero.** El motor `noticias-web` (wizard IA de 5 pasos → `news_posts` → `/noticias`)
> YA existe (Plan v4), pero está **apagado** y genérico. Esta spec lo **re-enfoca** con la estrategia
> del founder: le antepone un **cerebro de ruteo** (Test de Noticia) que decide si una idea es noticia
> o va directo a redes, y reemplaza la taxonomía técnica de 10 categorías por las **6 de negocio**
> orientadas al público objetivo. Reutilización máxima; cero rediseño del wizard.

## Contexto

Hay tres frentes de "contenido de marketing" dispersos y un documento de estrategia del founder:
- **① Motor real (código):** `app/studio/(app)/marketing/noticias-web/` (wizard IA 5 pasos, ~1024 líneas
  en `actions.ts`) + lógica en `lib/news/*` + tablas `news_posts`/`seo_drafts`/`news_writers`
  (migr 0053-0057). **Apagado**: flag `marketing_news=false`, falta `ANTHROPIC_API_KEY`, migraciones
  sin aplicar a prod. Taxonomía actual = **10 categorías técnicas** (operaciones, tarifas-fletes, …).
- **② El Norte ("Estudio de Redes"):** calendario de contenido atado a la operación (zarpes/ferias) +
  atomización a redes. Mock. → **Capa de planificación, fase futura.**
- **③ Documento del founder** (`dtd-handoff-code-noticias.md` + `sistema-comunicacion-v1.md` +
  `kit-contenido-flujo-de-caja-v2.md`): el **cerebro** — público objetivo, ángulo de flujo de caja,
  Test de Noticia, taxonomía de negocio, líneas rojas, y 3 artículos semilla listos.

**Dirección (3 capas):** el cerebro (③) **manda** en estrategia · la planificación (②) es futura ·
la producción (①, ya construida) se **re-enfoca**, no se tira.

> **Lo que NO se toca** (decisión founder): `/noticias` ya lee de DB (no migrar a MDX); el sistema de
> fechas (2008 China / 2010 empresa / 2015 corredor VE) está resuelto y es deliberado.

## Decisiones del founder (2026-06-14)

1. **Encender + re-enfocar** lo existente (no MDX).
2. **Cerebro dentro del motor**: el Test de Noticia es un **paso de ruteo previo** al wizard.
3. **Las 6 categorías** del cerebro reemplazan las 10 técnicas.
4. **Atomización a redes = futuro** (Capa 1). Ahora solo Flujo A (idea → noticia → `/noticias`).
5. **Semilla = 1 al blog** (variante B "autoridad" en *Importa sin perder plata*); variantes A y C
   reservadas para atomización futura (evita canibalización SEO de 3 piezas del mismo tema).

## Alcance

### IN (esta spec)
- **Cerebro / Test de Noticia** como Step 0 de ruteo dentro de `noticias-web`.
- **Taxonomía de negocio**: 6 categorías (reemplazan 10) — migración 0139 (CHECK) + `lib/news/categories.ts` + `lib/news/seo-keywords.ts`.
- **Alma en los prompts**: público objetivo + ángulo flujo de caja + líneas rojas en `lib/news/prompts.ts`.
- **1 artículo semilla** (variante B) en *importa-sin-perder-plata*.
- Lectura pública `/noticias` adaptada a las 6 categorías.

### OUT (futuro / otros)
- **Atomización a redes** (migajas LinkedIn/IG/WhatsApp) → Capa 1 (Norte/calendario).
- **Flujo B ejecutado**: el cerebro solo *informa* que una idea va a redes; no genera la pieza social.
- **Calendario de planificación** (zarpes/ferias) → Capa 1.
- **Activación en prod** (flag `marketing_news` + `ANTHROPIC_API_KEY` + aplicar migraciones) → founder/coordinación.
- `back_noticias` (migr 0030, muerto): su deprecación se trata aparte; `news_posts` = source of truth.

## Las 6 categorías de negocio (reemplazan las 10 técnicas)

| Slug nuevo | Nombre (calle) | Tipo editorial | Propósito |
|---|---|---|---|
| `importa-sin-perder-plata` ⭐ | Importa sin perder plata | informativo | Motor. Comprar/traer mejor sin secar la caja (la serie de flujo de caja). Autoridad + SEO/GEO. |
| `que-se-mueve-en-china` | Qué se mueve en China | curiosidad | Productos, Yiwu, ferias, tendencias. |
| `como-llega-tu-mercancia` | Cómo llega tu mercancía | informativo | Envío, aduana, tiempos, costos, puerta a puerta. Confianza. |
| `venezuela-y-tu-bolsillo` | Venezuela y tu bolsillo | polemica | Dólar, economía, reglas que afectan al importador. |
| `historias-reales` | Historias reales | curiosidad | Casos de clientes, detrás de cámara. |
| `novedades-dtd` | Novedades DTD | especial | Servicios nuevos, equipo, el ERP. |

**Mapeo de los 5 seeds existentes (migr 0139, UPDATE antes del nuevo CHECK):**
- `tutoriales-guias` (guia-incoterms-2020) → `como-llega-tu-mercancia`
- `china` (yiwu-ventaja-estrategica) → `que-se-mueve-en-china`
- `operaciones` (tiempos-yiwu-puerto-cabello) → `como-llega-tu-mercancia`
- `industria-global` (navieras-…, buques-…) → `como-llega-tu-mercancia`

## El cerebro — Test de Noticia (Step 0 de ruteo)

Fuente: `sistema-comunicacion-v1.md` §5 y §9. Antes de generar nada, el operador mete una **idea**; el
motor (server action que llama a Claude con el prompt-cerebro) devuelve:
- **Tipo** de contenido (Guía/Consejo, Postura, Historia, Dato, Actualidad, Promo, Pregunta, Detrás de cámara).
- **Test de Noticia** (5 sí/no): ¿se busca en Google? ¿una IA lo respondería? ¿sirve en 6 meses? ¿enseña/resuelve? ¿hace ver como el que sabe?
- **Flujo**: **A** (3+ SÍ → es noticia, sigue al wizard de generación) o **B** (≤2 → "esto NO va a noticias, va a [canal]"; el wizard no arranca).
- Si Flujo A: **categoría** (de las 6), **ángulo** sugerido y 2-3 **títulos**.

Mapeo de tipos: los 8 tipos del cerebro son para el **ruteo**; el que pasa a noticia se asienta en uno
de los 4 **tipos editoriales** existentes (`informativo|curiosidad|polemica|especial`) para el writer
assignment (`lib/news/writers.ts`, sin cambios de schema).

## Líneas rojas (inyectar en prompts — no negociables)

- **Lenguaje de calle, cero técnico** (plata, caja, mercancía, depósito; nunca "flujo de caja"/"CCC" en lo visible).
- **Nunca pedir comprar menos volumen** — el mensaje es "no congeles todo de golpe".
- **Sensibilizar, no acusar** (el lector es exitoso; el costo es invisible, no un fracaso).
- **El operador de consolidación NUNCA se nombra** (solo "el Operador de Consolidación"); DTD es la cara.
- **Público objetivo**: pyme/emprendedor que ya importa recurrente cada ~3 meses → jalarlo a compra mensual. NO empresas grandes, NO comprador de una vez.

## Fases (incrementales, cada una verificable)

- **F1 · Taxonomía de negocio** ✅ (rama `feat/motor-noticias`, sin push; migr **0139 NO aplicada a prod**) — migr **0139** (`drop constraint if exists news_posts_categoria_check` + UPDATE re-mapeo de las 10 técnicas viejas a las 6 de negocio + CHECK 6 nuevas, UPDATE **antes** del CHECK) + reescritura de `lib/news/categories.ts` (6 cats, gradients solo paleta de marca) + `lib/news/seo-keywords.ts` (`PAIN_POINTS_BY_CATEGORIA` reasignado por afinidad a las 6) + tests `lib/news/__tests__/categories.test.ts` (16, incl. paridad código↔migración). Los consumidores (`/noticias`, `/noticias/[slug]`, `NewsArticleJsonLd`, wizard `noticias-web`) resultaron **agnósticos a los slugs** (derivan todo de `NEWS_CATEGORIES_V4`/helpers) → cero cambios. `node scripts/verify.mjs` VERDE. *Verificable:* `/noticias` lista por las 6 categorías; seeds remapeados sin romper.
- **F2 · Alma en los prompts** — inyectar público + ángulo flujo de caja + líneas rojas en `lib/news/prompts.ts`. *Verificable:* un artículo generado usa lenguaje de calle y no nombra al operador.
- **F3 · Cerebro / Test de Noticia (Step 0)** — server action `routeIdea()` (prompt-cerebro §9) + UI del paso de ruteo en el wizard (Flujo A → sigue; B → corta con recomendación). *Verificable:* idea "sale contenedor el viernes" → Flujo B; idea "por qué comprar mensual" → Flujo A + categoría motor.
- **F4 · Contenido semilla** — cargar la variante B en `importa-sin-perder-plata` (vía el motor o seed). *Verificable:* el artículo aparece en `/noticias` con su JSON-LD.

## Migración 0139 (esta rama, NO a prod)

```
-- 1. soltar el CHECK viejo de categoria
-- 2. UPDATE news_posts SET categoria = <mapeo> (los 5 seeds) — usar ::text si aplica
-- 3. add CHECK nuevo: categoria in (6 slugs de negocio)
```
Antes de escribir el SQL: invocar los 2 skills Supabase (seguridad + postgres-best-practices). Sin funciones nuevas en esta migración (solo constraint + UPDATE), no aplica `revoke execute`.

## Riesgos / preguntas abiertas

- **Acceso (rol):** el motor exige rol `admin` del tenant (`actions.ts`/RLS). Si "marketing" es un rol distinto, hay que decidir relajar o crear rol. (Pregunta founder; no bloquea F1-F2.)
- **`ANTHROPIC_API_KEY` en prod:** el modo Auto la necesita; el modo Manual (failover) ya existe. La activación es gate del founder.
- **Canibalización semilla:** resuelta con la decisión #5 (1 al blog).
- **Atomización/calendario:** explícitamente fuera; quedan listos para Capa 1.

## Verificación

- Por fase: `node scripts/verify.mjs` VERDE + `pnpm build` (turbopack). Skills Supabase antes de la migración. UI nueva (Step 0 ruteo) → agente `ui-ux-designer` antes del commit.
- Índice de specs regenerado con `node scripts/build-docs-index.mjs` (no editar `docs/specs/README.md` a mano).
