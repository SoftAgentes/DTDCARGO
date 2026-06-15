---
sdd: "0089"
title: "Clasificador de contenido + output multicanal (idea → noticia / mensajes de redes/WhatsApp) — amplía SDD-0088"
status: in-progress
author: "Claude Code (ventana motor-clasificador) + founder"
created: 2026-06-15
updated: 2026-06-15
supersedes: null
superseded_by: null
related: ["0088", "0043", "0083"]
confidencialidad: interno
---

# SDD-0089 — Clasificador de contenido + output multicanal

> **Amplía SDD-0088.** El motor de noticias (SDD-0088, ya en main: wizard IA + 6 categorías de
> negocio + `getCategoryInfo`) genera artículos para `/noticias`. Esta spec le antepone un **cerebro
> clasificador**: metes solo **nombre + título** de una idea y el motor corre el **Test de Noticia**,
> decide si es **noticia (blog)** o **mensajes (redes/WhatsApp)**, asigna categoría y canales, y produce
> el **output dual**: "Noticia completa" (reusa el wizard) y "Mensajes completos" (piezas por canal,
> NUEVO). Cierra con un **calendario de recompra** (día 30/45/60) y la **publicación desde el ERP**.

## Contexto

SDD-0088 dejó **explícitamente fuera** (su sección OUT): "atomización a redes → Capa 1" y "Flujo B
ejecutado: el cerebro solo informa que una idea va a redes; no genera la pieza social". Lo que el
founder pide ahora —clasificar y **generar** mensajes para redes/WhatsApp, y publicarlos— es ese
alcance. Por eso es spec nueva (amplía 0088), no "completar" 0088.

**Fuente de estrategia (el cerebro):** `Downloads/dtd-sistema-comunicacion-v1.md` (2 flujos A/B, Test
de Noticia, 8 tipos de contenido, tabla de canales, atomización, líneas rojas) + `dtd-handoff-code-noticias.md`.

**Análisis previo:** Codex (estrategia/filtros/output/gaps) + arquitecto (cómo encaja en el motor real).

> **Lo que NO se toca:** el pipeline de noticia de 0088 (outline→artículo→`news_posts`→`/noticias`) se
> reusa al 100%; las 6 categorías; el sistema de fechas; los 4 tipos editoriales + `writers.ts`.

## Decisiones del founder (2026-06-15)

1. **Vehículo:** spec nueva **SDD-0089** que amplía 0088. El calendario de recompra entra en v1.
2. **Alcance de las piezas de redes:** **generar + PUBLICAR/programar desde el ERP** (no solo
   copiar/pegar). ⚠️ Es la fase más pesada — ver §Publicación.
3. **Calendario de recompra:** en v1 (es el norte: empujar al cliente que compra cada ~3 meses hacia
   suministro mensual).

## Alcance

### IN
- **Clasificador `routeIdea()`** (paso "Banco de ideas"): nombre+título → tipo, Test de Noticia (score),
  flujo A/B/Mixto, categoría, canales, ángulo, 2-3 títulos.
- **Output dual:** "Noticia completa" (reusa wizard 0088) + "Mensajes completos" (piezas por canal: LinkedIn, Instagram, WhatsApp canal, WhatsApp clientes).
- **Schema** (migr 0141): tabla `content_pieces` + extender `seo_drafts` con el ruteo.
- **Banco de ideas + filtros** (categoría, tipo, flujo, destino/canal, estado, vida útil).
- **Calendario de recompra** (día 30/45/60): contenido sugerido por cadencia del cliente.
- **Publicación/programación desde el ERP** a LinkedIn / Instagram / WhatsApp (fase final).

### OUT
- Rediseño del wizard de noticia de 0088.
- Métricas/analítica de performance de las piezas (engagement) — fase posterior.
- El calendario editorial completo del Norte ("Estudio de Redes" atado a zarpes/ferias) — esta spec
  hace el calendario de **recompra** (por cliente), no el operativo (por evento logístico).

## El clasificador — `routeIdea()` (paso "Banco de ideas")

Hoy el wizard arranca en `Step0Brief` → `detectBriefIntent()` que **siempre asume Flujo A** (todo es
noticia). El clasificador **antecede** ese paso (no lo reemplaza: `detectBriefIntent` queda como el
clasificador editorial fino del Flujo A).

```
Banco de ideas (NUEVO):  nombre + título [+ ángulo/refs opcional]
        ↓ routeIdea()  → Claude con el prompt-cerebro (§9 del doc)
   { tipo(8), test_noticia{q1..q5, score 0-5}, flujo(A|B|mixto),
     categoria(6|null), tipo_editorial(4|null), canales[], angulo, titulos[2-3] }
        ↓
   A (score≥3)        Mixto            B (score≤2)
   Noticia completa   Noticia+Mensajes  Mensajes completos
```

- Los **8 tipos del cerebro** (Guía, Postura, Historia, Dato, Actualidad, Promo, Pregunta, Detrás de
  cámara) se **mapean a los 4 editoriales** (`informativo|curiosidad|polemica|especial`) para no tocar
  `writers.ts`. Mapeo en nuevo `lib/news/cerebro.ts`.
- La regla **A/B se calcula en el servidor** (score = suma de los 5 booleanos; ≥3 = A), no se confía en
  el campo `flujo` del LLM (defensa anti-alucinación, igual que 0088 recalcula `confidence`).
- Modo **Auto/Manual + failover** de 0088 se conserva: si Auto falla (falta `ANTHROPIC_API_KEY`), abre
  el modal con el prompt para claude.ai. Builders de prompt puros (patrón de `lib/news/prompts.ts`).

## Output dual

**Noticia completa (Flujo A/Mixto)** — reusa el wizard de 0088 al 100%: deep-link precargando
`topic/angle/categoria/tipo_editorial` → Step1→Step3 → `publishPost` → `news_posts` → `/noticias`.
Único cambio: `NoticiasWebClient` acepta props iniciales (arranca en step 1).

**Mensajes completos (NUEVO, Flujo B/Mixto)** — 1 pieza por canal. Estructura:

```ts
interface SocialPiece {
  canal: "linkedin" | "instagram" | "whatsapp";
  formato: string;        // "post 1ra persona" | "carrusel+reel" | "mensaje asesor" | "story"
  hook: string;           // gancho que frena el scroll
  copy: string;           // cuerpo, tono del canal
  cta: string;            // por canal (LinkedIn: conecta · IG: link en bio · WA: responde/agenda)
  hashtags: string[];     // [] para WhatsApp
  link_noticia?: string;  // solo Flujo A (la migaja enlaza al hub)
}
```
Flujo A = noticia + atomización (la pieza se genera **tras** publicar, necesita `link_noticia`).
Flujo B = solo piezas (no toca `/noticias`).

## Mapa categoría/tipo → destino (la regla)

| Tipo de contenido | Blog (/noticias) | Redes (LinkedIn/IG) | WhatsApp |
|---|---|---|---|
| Guía · Caso · Dato (con contexto) | ✅ | ✅ atomizado | ✅ resumen |
| Postura / Opinión | si hay tesis/búsqueda | ✅ LinkedIn | — |
| Actualidad (dólar, aduana, navieras) | **solo si perdura y afecta decisiones** | ✅ rápido | ✅ rápido |
| Promo · Pregunta · Detrás de cámara | ❌ **nunca** | ✅ | ✅ |

Regla memorizable: **si sirve dentro de 6 meses y se busca → blog; si caduca o es conversación → directo a redes/WhatsApp.**

**Historia y actualidad = "contexto aplicado", no medio genérico.** No *"subió el dólar"* → sí *"cómo el
dólar te mueve la reposición, el flete y el precio"*. Historia (empresa/sector) cae en `historias-reales`
o `que-se-mueve-en-china`; actualidad en `venezuela-y-tu-bolsillo`. La actualidad va a blog **solo** si
el ángulo perdura (si no, envejece mal el SEO → va a redes).

## Filtros (banco de ideas)

categoría (6) · tipo · flujo (A/B/mixto) · destino/canal · estado · **vida útil (evergreen / actualidad)**.
Índices reales para alta cardinalidad (categoría, canal, estado); enums chicos (flujo, tipo, vida_util)
se filtran en memoria sobre el set ya acotado por tenant.

## Schema (migración 0141 — archivo, NO a prod)

Extender `seo_drafts` (el "draft" puede ser solo una idea ruteada) + tabla nueva `content_pieces`
(piezas de redes; **interna del ERP, sin grant a anon** — frontera público↔ERP). RLS admin-por-tenant
(patrón de 0053/0055), trigger `updated_at`, índices por (tenant,status), canal, categoría. Una pieza
cuelga de un `draft_id` (Flujo B) **o** de un `news_post_id` (Flujo A), nunca ambos (CHECK).
`status`: `draft→approved→copied→programado→publicado→archived` (los 2 últimos los activa la fase de
publicación). DDL de referencia en el reporte del arquitecto; se escribe en F-B **invocando los 2 skills
Supabase + `get_advisors`** antes (regla del repo). Número 0141 verificado libre vs main + todas las
ramas (re-verificar `git fetch` al crear).

## Calendario de recompra (F-D — el norte)

El cliente que compra cada ~3 meses recibe contenido de cadencia en **día 30/45/60** post-compra que lo
empuja a suministro constante (conecta con el objetivo interno de 2 contenedores/mes). Lee fechas de
compra del ERP (sin exponer valor ni datos sensibles) y sugiere/encola piezas WhatsApp+email por cliente.
Reusa el patrón de cadencia ya existente en el dominio fidelización/recompra del Studio (verificar en
implementación). **No** publica solo; sugiere al asesor (humano-en-el-loop), salvo que el founder active
el envío automático.

## Publicación desde el ERP (F-E — la fase pesada)

⚠️ **La parte más grande y con más dependencias externas.** Publicar/programar a LinkedIn / Instagram
(Meta Graph API) / WhatsApp (Business/Cloud API) exige, por cada red: app + OAuth + tokens + refresh +
rate limits + webhooks de estado. **Patrón de seguridad obligatorio (igual que Kommo, SDD-0043/0083):**
los tokens viven en **Supabase Vault**, los lee **solo una edge function**; el runtime Next **encola en
una outbox**, la edge function drena y publica. El token nunca entra al runtime ni al cliente.
**Depende de credenciales/cuentas del founder** (Meta Business, LinkedIn app, WhatsApp Business API).
Nace en **dry-run** (registra el POST que haría) hasta que el founder active. Migración propia (futura,
no 0141).

## Fases (incrementales, cada una entrega valor)

- **F-A · Clasificador `routeIdea`** ✅ — el cerebro: nombre+título → flujo+categoría+canales+títulos. Paso "Banco de ideas". *Valor:* clasificación automática funcionando (aunque sea modo Manual).
  - **Implementado** (ventana motor-clasificador): `lib/news/cerebro.ts` (8 tipos del cerebro, mapeo 8→4 `CEREBRO_A_EDITORIAL` con `null`=solo-Flujo-B para promo/pregunta/detrás-cámara, Test de Noticia, `flujoFromScore`, `scoreFromTest`, canales/ángulos) + tests `lib/news/__tests__/cerebro.test.ts`. `buildRouteIdeaPrompt` (prompt-cerebro §9 + líneas rojas §8 + JSON shape exacto) en `lib/news/prompts.ts`. Server action `routeIdea` con validación server-side (score = suma de los 5 booleanos, flujo del score, categoría coherente con el tipo editorial; el tipo del cerebro manda sobre el test) en `actions.ts`. UI `RouteIdeaPanel.tsx` como **paso inicial** (stage `"banco"` que antecede al wizard 0088 en `NoticiasWebClient`); Flujo A deep-linkea al wizard precargando topic/angle/categoría/tipo (arranca en step 1 de headlines); Flujo B muestra **placeholder** (las piezas de redes son F-B). Modo Auto/Manual + failover conservados (mismo `clientRouteFromParsed` valida el JSON pegado en Manual). **Sin DB** (el schema `content_pieces` es F-B). Nota: el gate destapó un test hermano roto por el renombre de migración del repo (`0139→0140`, commit `8bd18cc` incompleto) — se corrigió el path en `categories.test.ts` (restaura el assert, no lo debilita).
- **F-B · Output dual + schema** — "Mensajes completos" por canal + migr 0141 (`content_pieces` + `seo_drafts`). *Valor:* genera la pieza lista por canal (copiar/pegar).
- **F-C · Banco de ideas + filtros** — vista listado con los 6 filtros. *Valor:* marketing gestiona el pipeline.
- **F-D · Calendario de recompra** — contenido día 30/45/60 por cliente. *Valor:* el norte (recompra/mensualización).
- **F-E · Publicación desde el ERP** — outbox + edge function + OAuth por red (dry-run primero). *Valor:* publica/programa sin copiar a mano. **Depende de credenciales del founder.**

Orden recomendado: A → B → C dan el motor clasificador+generador usable; D el norte comercial; E al final (depende de credenciales externas).

## Riesgos / dependencias / preguntas abiertas

- **`ANTHROPIC_API_KEY` + flag `marketing_news`:** el motor está apagado en prod; `routeIdea`/generación arrancan en **modo Manual** hasta que el founder active la key. No bloquea construir.
- **Rol de acceso:** el motor exige `admin` del tenant. ❓ ¿"marketing" usa admin o rol nuevo? (no bloquea F-A/F-B).
- **Frontera público↔ERP:** `content_pieces` NO se expone a anon (interna). `news_posts` sigue siendo lo público.
- **F-E credenciales:** Meta Business + LinkedIn app + WhatsApp Business API son del founder; sin ellas, F-E queda en dry-run/diseño.
- **Calendario de recompra:** confirmar de qué tabla del ERP se leen las fechas de compra sin tocar la frontera de privacidad.

## Verificación

- Por fase: `node scripts/verify.mjs` VERDE + `pnpm build` (turbopack). UI nueva (Banco de ideas, vista de piezas) → agente `ui-ux-designer` antes del commit. Schema (F-B/F-E) → 2 skills Supabase + `get_advisors` antes de la migración; nunca aplicar a prod desde esta ventana.
- Índice de specs regenerado con `node scripts/build-docs-index.mjs` (no editar `docs/specs/README.md` a mano).
