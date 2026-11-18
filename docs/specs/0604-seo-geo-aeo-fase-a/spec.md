---
sdd: "0604"
title: "SEO, GEO y AEO: fase A, mejoras estáticas del sitio público"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-11-05
updated: 2026-11-05
supersedes: null
superseded_by: null
related: ["0064", "0088", "0167", "0528", "0579"]
confidencialidad: interno
---

# SDD-0604 · SEO, GEO y AEO: fase A, mejoras estáticas del sitio público

> Corrige lo que el sitio les dice a buscadores y motores de IA, sin base de datos, sin IA y sin credenciales.

## Pedido

**Sam, 2026-11-05:** «Vamos a hacer algo que es de SEO. Esto se va a llamar SEO, GEO y AEO». Aprobó el plan del agente SEO de noticias y eligió empezar por las mejoras estáticas. El diseño completo del agente y sus fases siguientes están en [`agente-seo-noticias.md`](../../marketing/agente-seo-noticias.md).

## Alcance

1. **`public/llms.txt`.** Quita razón social, RIF y representante legal: `docs/marketing/identidad.md` los limita al schema. Corrige «desde 2008» como inicio de operaciones (la fundación es 2015). Usa «puerta a puerta (DDP)» como pide `BRAND.md`. Cambia «seguimiento de cada envío» por identificación de la carga, porque el seguimiento sigue en construcción.
2. **`/llms-full.txt`.** Ruta estática armada con `SERVICIOS_DETALLE`, `FAQS` y `GLOSSARY_TERMS`. No trae precios.
3. **`robots.ts`.** Suma Claude-SearchBot, Claude-User, Perplexity-User, Google-CloudVertexBot, Applebot-Extended, Meta-ExternalAgent, CCBot y Bingbot.
4. **`sitemap.ts`.** Agrega `/privacidad` y `/cookies`, indexables y fuera del sitemap. Los posts usan `updated_at` como `lastModified`.
5. **Contrato de cobertura del sitemap.** Ignora los comentarios. Ese fue el motivo del hueco anterior: la palabra `noindex` en un comentario sacaba esas dos páginas de la auditoría.
6. **IndexNow.** Publica la clave en `public/` y agrega `scripts/indexnow-enviar.mjs`, que por defecto no envía nada.
7. **`lib/news/prompts.ts`.** Quita la promesa de FAQPage automático, retirado en SDD-0167.

## Fuera de alcance, y por qué

- **FAQPage en landings de servicio.** Según `docs/marketing/seo.md`, Google dejó de mostrar resultados enriquecidos FAQ el 7 de mayo de 2026, y las preguntas del CRM siguen sin autorización para publicarse. Agregarlo no aporta ahora.
- **`sameAs`.** La entidad ya enlaza Instagram, YouTube y TikTok. Wikidata, Google Business Profile y LinkedIn necesitan las URL de Sam.
- **Consolas.** Bing Webmaster Tools y el segmento de tráfico desde IA en GA4 se configuran fuera del repo.
- **Envío real a IndexNow.** Solo tiene sentido con la clave publicada, y la publicación de la web está congelada.

## Política IA-01

No aplica: esta fase no ejecuta IA. El agente de las fases siguientes sí queda sujeto a ella.

## Criterio de aceptación

- El contrato de cobertura se pone rojo si `/privacidad` sale del sitemap.
- `/llms-full.txt` responde texto plano, incluye todas las FAQ y todos los términos, y excluye los servicios no ofrecibles.
- `llms.txt` y `/llms-full.txt` no traen RIF ni razón social, y no prometen rastreo.
- Sin migraciones ni variables de entorno nuevas.

## Allowlist

- `public/llms.txt`, `public/6ef16632b634eaa88dbcdf9f00cfea05.txt`
- `app/llms-full.txt/route.ts`, `lib/public/llms-full.ts`, `lib/public/__tests__/llms-full.test.ts`
- `app/robots.ts`, `app/sitemap.ts`
- `app/__tests__/sitemap-cobertura-contract.test.ts`, `__tests__/seo-remates.test.ts`
- `scripts/indexnow-enviar.mjs`, `scripts/__tests__/indexnow-enviar.test.mjs`
- `lib/news/prompts.ts`
- `docs/marketing/seo.md`, `docs/marketing/agente-seo-noticias.md`, `docs/marketing/README.md`
- `docs/specs/0604-seo-geo-aeo-fase-a/spec.md`, `docs/specs/README.md`
- `.agents/handoffs/0604-seo-geo-aeo-fase-a.md`
