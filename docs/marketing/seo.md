# SEO — DTD Cargo (bitácora)

Historial y estado del SEO del **sitio público `dtdcargo.com`**. Parte del tree [Marketing](README.md).

## Estado actual (2026-06-07)

| Aspecto | Estado |
|---|---|
| Dominio | `dtdcargo.com` (nuevo). El viejo `doortudoor.com` redirige 301 (ver "Migración de dominio") |
| Sitemap | `dtdcargo.com/sitemap.xml` — 35 URLs (fuente: `app/sitemap.ts` + `lib/geo-zonas.ts` + posts DB) |
| Search Console | 2 propiedades: `dtdcargo.com` (dominio) + `https://doortudoor.com/` (url-prefix, la del traslado) |
| Analítica | GA4 `G-25CD7BZH98` (gtag.js, excluye rutas privadas) |

## Arquitectura SEO (dónde vive cada cosa)

- **Sitemap:** `app/sitemap.ts` (rutas fijas + geo-zonas + posts de noticias DB-backed).
- **Geo-páginas:** template `app/importar-de-china/[ciudad]/page.tsx` + data única por zona en **`lib/geo-zonas.ts`** (contenido verificado, no doorway pages). Agregar zona = un objeto ahí → ruta + sitemap + cross-links se generan solos.
- **Calculadora terrestre:** `app/calculadora-terrestre/page.tsx` + `components/UltimoKmCalculator.tsx` + tarifas en `lib/data/tarifas-terrestres-vzla.ts` (~80 destinos por zona 1-11, validado por operaciones DTD).
- **OG/social:** `lib/seo-og.ts` (`socialMeta`).
- **Redirects:** `next.config.ts` → `redirects()`.
- **Identidad de entidad (GEO):** `@graph` JSON-LD en `app/layout.tsx` — `#organization` (`LocalBusiness` con `legalName`/`taxID`/`founder`, **`knowsAbout`** = temas de expertise con `sameAs` a Wikipedia, **`hasOfferCatalog`** = catálogo de servicios) + `#website`. Los publishers (VideoObject en `WorkBand.tsx`, NewsArticle) referencian `#organization` por `@id` → una sola entidad. Identidad pública/legal canónica = [`identidad.md`](identidad.md).
- **OfferCatalog (builder único):** `lib/seo-offer-catalog.ts` (`buildOfferCatalog` + `isOfferable`). Lo usan `app/layout.tsx` (`hasOfferCatalog` de la entidad) y `app/servicios/page.tsx` (catálogo de la página) con el mismo shape, proveedor ligado por `@id`. `isOfferable` excluye `suspendido`/`proximamente` (anti-invención). Fuente = `lib/servicios-detalle.ts`.
- **WebPage + `speakable`:** `components/WebPageJsonLd.tsx` (gemelo de `BreadcrumbJsonLd`). Liga la página a `#organization`/`#website` por `@id` y marca el bloque citable por voz/IA. En el home (`app/page.tsx`) apunta al bloque "Respuesta rápida" (`#respuesta-rapida`).

## Cronología

### 2026-06-06 · Contenido SEO + geo-páginas
(memoria: `project_session_2026_06_06_seo_contenido`)
- **18 geo-ciudades** "Importar de China a {ciudad}" con contenido genuino por zona (ciudad+estado, km desde Valencia, casco vs recargo) + hub `/importar-de-china` con silo de links internos.
- `og:image` + twitter cards en las 30 páginas · titles ≤60 + meta-descriptions ≤160.
- **Performance:** lazy-load de 3 videos + posters WebP → móvil 69→96 (LCP 6.6s→2.7s).
- **VideoObject** (`components/WorkBand.tsx`): `uploadDate` ISO-8601 válido con zona horaria (`2026-06-05T12:00:00-04:00`).

### 2026-06-07 · Rename + migración de dominio + recuperación (esta sesión)
(memoria: `project_session_2026_06_07`)

**Rename `/cotizar → /estimacion`** (SDD-0061): redirect 308/301 permanente en `next.config.ts`. `/cotizar` ya no está en el sitemap; Google procesa el 308 solo y transfiere el ranking. Verificado en prod.

**Search Console (propiedad `dtdcargo.com`):**
- Sitemap re-enviado (`/sitemap.xml`).
- Indexación solicitada (cola prioritaria, ~10/día): `/estimacion`, `/calculadora-terrestre` + 6 geos metro (caracas, maracaibo, valencia, barquisimeto, maracay, puerto-la-cruz). Las 12 geos restantes las descubre el sitemap.
- 2 avisos del VideoObject (`uploadDate` falta zona horaria / valor no válido) → **validación iniciada** (el fix ya estaba en prod, eran avisos stale).

**Migración de dominio `doortudoor.com → dtdcargo.com`:**
- Verificado en vivo (curl): apex + www → **301 permanente path-preserving** (`/X → dtdcargo.com/X`). Server Vercel. **El 301 es el mecanismo que preserva el SEO.**
- **"Cambio de dirección" de Search Console ACTIVADO** (propiedad `https://doortudoor.com/` → destino `dtdcargo.com`, **iniciado 2026-06-07, ~180 días, reversible**). Checks obligatorios (301 home + verificación de ambos sitios) pasaron.
- Dato: el dominio viejo tenía huella orgánica **mínima** (~5 clics / 520 impresiones en 3 meses); su tráfico era casi todo pago (ads).

**Recuperación de páginas huérfanas** (6 redirects 301 en `next.config.ts`, en prod): páginas del sitio VIEJO sin slug equivalente en el nuevo que caían en 404 tras el 301:

| Slug viejo (doortudoor.com) | Impr. 3m | → Destino nuevo |
|---|---|---|
| `/como-calcular-metro-cubico-cbm-de-la-mercancia` | 397 | `/calculadora` |
| `/nosotros` | 21 | `/` |
| `/significado-del-incoterm-cif` | 18 | `/glosario` |
| `/mi-cuenta` | 15 | `/portal` |
| `/que-es-un-envio-puerta-a-puerta` | 12 | `/glosario` |
| `/icoterm-exw` | 10 | `/glosario` |

Cola larga (~30 páginas más, <10 impr c/u) = SEO despreciable, no se redirige individualmente.

**Geo↔calc:** se suavizó el texto `notaEntrega` de los 15 geos non-casco (sacó "recargo por km" + "al instante en la calculadora": impreciso + Cumaná/San Fernando no están en la calc) → "puedes estimar ese tramo terrestre en nuestra calculadora; el costo exacto te lo confirma tu asesor por WhatsApp".

### 2026-06-14 · Profundización GEO — slice ⭐1 (extiende SDD-0064 Fase 6)

Enriquecimiento del schema para que los motores de IA (AI Agent de Kommo, ChatGPT/Perplexity, AI Overviews) extraigan datos certeros y completos. Sin spec ni migración nuevas; rama `feat/geo-profundizacion`.

- **`knowsAbout`** en `#organization` (`app/layout.tsx`): 12 temas de expertise (logística China-VE, Incoterms, contenedores FCL/LCL, freight forwarding, aduana, sourcing, control de calidad, Yiwu, puerta a puerta DDP, consolidación, MARKBOX). Los estándar con `sameAs` a Wikipedia (9 URLs **verificadas vivas**, sin 404); los propios de DTD como `DefinedTerm` sin `sameAs`.
- **`hasOfferCatalog`** en `#organization`: catálogo de servicios ligado por `@id`, vía builder único `lib/seo-offer-catalog.ts`. Excluye `suspendido`/`proximamente` (`isOfferable` → fuera `transporte-terrestre`). `app/servicios/page.tsx` migró al mismo builder (un solo catálogo coherente, antes duplicaba el shape inline y listaba lo no ofrecible).
- **`<RespuestaRapida>` en el home** (`app/page.tsx`, entre Hero y TrustBar): Q&A directa y citable ("¿Qué es DTD Cargo y qué hace?"). Copy grounded (empresa 2010, puerta a puerta DDP, pagas al llegar "sujeto a aprobación"). **Requiere OK final del founder** (copy visible).
- **`speakable`** (`components/WebPageJsonLd.tsx`): nodo `WebPage` del home con `speakable.cssSelector` → `#respuesta-rapida`.
- Pendiente próximos slices: `sameAs` a Wikidata/GBP/LinkedIn (URLs del founder) · `llms-full.txt` · páginas `/puerta-a-puerta` `/markbox` `/empresa` · `aggregateRating` (reseñas reales).

## 🛡️ Reglas SEO que NO se rompen

1. **Nunca quitar el 301** `doortudoor.com → dtdcargo.com`.
2. **No dejar expirar `doortudoor.com`** (registrado + redirigiendo ≥1 año).
3. **`doortudoor.com` NO debe volver a servir contenido propio.**
4. Al renombrar/eliminar una ruta pública con SEO → **siempre 301** del slug viejo (como `/cotizar`).
5. Anuncios pagos no afectan el SEO orgánico.

## 🤖 Checklist SEO/GEO para agentes

Antes de tocar SEO o identidad, revisar:
- [ ] **Una sola entidad:** todo nodo `Organization`/publisher referencia `#organization` por `@id` (no redeclarar "DTD Cargo" suelto). Fuente = `@graph` en `app/layout.tsx`.
- [ ] **Nombre público = "DTD Cargo"**; razón social y RIF **solo** en `legalName`/`taxID`, nunca en texto visible.
- [ ] **Año = 2010** (`foundingDate`) + narrativa "+15 años". No cambiar.
- [ ] **301 `doortudoor.com`** intacto · dominio viejo sin expirar · sin contenido propio ahí.
- [ ] **GA fuera de rutas privadas** (`/studio /portal /m /back /invitar`).
- [ ] Rename de ruta con SEO → **301** del slug viejo en `next.config.ts`.
- [ ] Validar el schema en Rich Results Test antes de cerrar.
- [ ] `SearchAction` solo si existe un buscador real (hoy no hay).

## Pendiente / monitoreo

- Monitorear el traspaso del "Cambio de dirección" en Search Console (~180 días): las URLs de `dtdcargo.com` deben ir reemplazando a las de `doortudoor.com` en los resultados.
- Si aparecen más páginas viejas con impresiones que caen en 404 → agregar su redirect en `next.config.ts`.
