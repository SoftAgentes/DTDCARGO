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
- **WebPage + `speakable`:** `components/WebPageJsonLd.tsx` (gemelo de `BreadcrumbJsonLd`). Liga la página a `#organization`/`#website` por `@id` y marca el bloque citable por voz/IA. Montado en **home, `/calculadora` y `/track`** (apunta al bloque "Respuesta rápida" `#respuesta-rapida`).
- **DefinedTermSet:** `/glosario` (`app/glosario/page.tsx`) emite `DefinedTermSet` + un `DefinedTerm` por término (name/alternateName/description/`@id`), derivado de `GLOSSARY_TERMS`. Fuente machine-readable de definiciones (DDP, FCL, LCL, BL, CBM, MARKBOX…), alineada con el `knowsAbout` de la entidad.

## Cronología

### 2026-08-01 · Barrido de copy en landings indexadas (SDD-0237)

**Qué cambió y por qué importa para SEO:** el modelo de precio de la entrega nacional pasó a **CBM × tramo** y murió el `max(0, km − 200) × $1`. Eso dejó desactualizado el copy de **18 geo-páginas indexadas** (`/importar-de-china/*`) más `/servicios/puerta-a-puerta`, que seguían prometiendo un cobro por distancia que ya no existe.

- **Término retirado de cara al cliente:** "casco central" → **"entrega incluida"** (decisión del founder). Barrido en `lib/geo-zonas.ts` (18 `notaEntrega` + `anguloLocal` + 3 `metaDescription`), `app/importar-de-china/page.tsx`, `app/servicios/puerta-a-puerta/page.tsx`.
- **Los kilómetros salieron del copy.** Ya no se escribe "a 410 km de nuestra bodega": el precio no depende de la distancia. El campo `km` **sigue en `lib/geo-zonas.ts`** porque ordena el índice de `/importar-de-china`, pero no se cita en prosa.
- **Corrección de fondo:** `barquisimeto` y `acarigua` estaban en `casco: false`, así que sus landings mandaban al cliente a preguntarle el precio al asesor por un tramo que **ahora va en $0**. Corregido a `true`. Acarigua sí, Araure no — el copy lo dice explícito.
- **Sin cambios de URL, sin redirects, sin tocar el sitemap.** Es reescritura de contenido dentro de las mismas 18 rutas: no hay riesgo de pérdida de ranking, pero sí conviene **revisar Search Console a las ~2 semanas** por si alguna long-tail dependía de "casco central".
- **Reglas que no se tocaron:** el 301 `doortudoor.com → dtdcargo.com` sigue vivo y GA se mantiene fuera de rutas privadas.

### 2026-06-06 · Contenido SEO + geo-páginas
(memoria: `project_session_2026_06_06_seo_contenido`)
- **18 geo-ciudades** "Importar de China a {ciudad}" con contenido genuino por zona (ciudad+estado, km desde Valencia, casco vs recargo) + hub `/importar-de-china` con silo de links internos. *(El copy de km/casco se reescribió el 2026-08-01 — ver arriba.)*
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

### 2026-06-14 · Auditoría de desconexión + GEO avance — slice 2 (rama `feat/geo-avanzado`)

Auditoría (3 frentes: integridad de schema · links internos/huérfanas/sitemap · oportunidades GEO) de qué se "desconectó" tras el overhaul del home + rediseño de `/servicios` + hero-ciclo + nav Recursos. Sin spec ni migración.

**Implementado (todo invisible: schema/JSON-LD/sitemap):**
- **`speakable` extendido** a `/calculadora` y `/track` (antes solo el home): `<WebPageJsonLd>` + `id="respuesta-rapida"` en el bloque existente.
- **`DefinedTermSet`** en `/glosario` (definiciones machine-readable).
- **`provider` por `@id`** en `/importar-de-china/[ciudad]` (14 páginas) — quitaba el `LocalBusiness` suelto que rompía la regla de entidad única.
- **`logo` como `ImageObject`** (741×764) en `#organization` (antes string).
- **`BreadcrumbList`** en `/track` y `/noticias` (faltaban).
- **Sitemap**: + `/registro` y `/servicios/inspeccion` (faltaban).

**Desconexiones detectadas, PENDIENTES (decisión del founder / otra ventana):**
- ~~⚠️ `/estimacion` huérfana~~ ✅ CERRADO 2026-07-05: muerto podado (`HeroCotizador.tsx` + `TrackingPreview.tsx`) y ruta **reconectada** — CTA en `/calculadora` ("¿Prefieres que un asesor te lo estime?") + link "Estimación" en el Footer.
- ~~⚠️ `/nosotros` huérfana~~ ✅ CERRADO 2026-07-05: link "Nosotros" en el Footer.
- ~~`/brochure` con `VideoObject` DUPLICADO~~ ✅ CERRADO 2026-07-05: prop `noVideoSchema` en `WorkBand` (el secundario) + `<WorkBand noVideoSchema />` en la página; el home intacto (queda el nodo de `OperationGallery`, el mismo del home).
- **Ancla muerta** en Footer: `#registro-marca-coord` no existe en `/servicios` (el slug real es `registro-marca-cn`); el Footer deriva anclas de `SERVICES_VE` (design-tokens) y la página usa `servicios-detalle.ts` → dos namespaces de slugs.
- **`/servicios/inspeccion`**: `provider` `LocalBusiness` suelto (igual patrón) + falta nodo `Service` rico + `HowTo`. NO tocado (territorio de la ventana `servicios-ux`).
- ~~**`llms.txt` dice "Fundada en 2008"**~~ ✅ CERRADO 2026-07-18: alineado al canon del founder
  (fundada **2015** · experiencia con China desde 2008 · 2010 solo hito). Queda 1 superficie por
  barrer: el copy de `<RespuestaRapida>` del home dice "empresa 2010" → corregir a la narrativa
  2015 (copy visible, con OK del founder — tarea en el Motor de Crecimiento).

**GATED (input del founder):** `sameAs` a Google Business Profile / LinkedIn / Wikidata · `aggregateRating` (reseñas reales) · `Person` del founder · `GeoCoordinates` de las sedes.

### 2026-07-04 · Fix CSP — beacon de conversión de Google Ads desbloqueado
(commit `973aec90`, detectado por `/radar` + smoke test de prod)

El `connect-src`/`img-src` del CSP (`next.config.ts`) permitía `googleads.g.doubleclick.net` pero **no** `ad.doubleclick.net`. El gtag de Ads (`AW-561290482`) emite un beacon a `ad.doubleclick.net/ccm/s/collect` que quedaba **bloqueado por CSP** en prod (2 errores de consola en cada carga). Agregado `https://ad.doubleclick.net` a ambas directivas; verificado en prod: 0 errores de consola.

- **Impacto real (no exagerar):** el ping de conversión **primario** va a `googleadservices.com` / `google.com`, que **sí** estaban permitidos → las conversiones base (las ~4.231 del historial, ver [`ads-reestructura-search.md`](ads-reestructura-search.md)) **se venían registrando**. Lo que estaba degradado era el beacon `ccm/collect` de doubleclick = **enhanced conversions + señal de remarketing/audiencias**. O sea: mejora la **calidad de la señal** para Smart Bidding y las audiencias de remarketing, no "recupera conversiones perdidas" en el conteo base.
- **Monitoreo:** en Google Ads, revisar que "Enhanced conversions" deje de reportar diagnóstico de beacon bloqueado y que las audiencias de remarketing de doubleclick vuelvan a poblarse tras el deploy.
- **Regla:** cualquier tag/pixel externo nuevo (Meta, TikTok, Hotjar, etc.) exige sumar su dominio de `connect-src`/`img-src` en el CSP de `next.config.ts`, o el beacon se bloquea silenciosamente (solo se ve en la consola del navegador).

### 2026-07-05 · Auditoría de medición — fuga PII tapada + conversión WhatsApp completa + eventos GA4
(disparador: correos de Google Analytics sobre audiencias + objetivos "Requiere atención"; investigación de 6 agentes sobre el repo)

**1. Fuga PII a Google TAPADA** (`components/Analytics.tsx` — endurecido tras review adversarial de 21 agentes):
- `PRIVATE_PREFIXES` ampliado: + `/verificar` (el `?c=<Shipping Mark|folio>` viajaba en el page_view), + `/p` (packing list con token capability, SDD-0096), + `/interno`, + `/marca`, + `/calculadora/embed` (iframe del portal — filtraba el referrer del portal y contaminaba métricas públicas).
- **`/track/[code]` EXCLUIDA por completo** (el buscador `/track` sí se mide): la primera versión solo redactaba el `page_view` manual, pero gtag adjunta la URL cruda (`dl`) y el `document.title` ("Tracking S-2026-XXXX") a CADA hit — incluido el ping del tag de Ads al cargar la página — así que redactar no basta; la única vía estanca es no cargar el tag ahí. Bonus de calidad: quien rastrea ya es cliente → sus clicks a WhatsApp dejan de contar como conversión de captación.
- **Whitelist de query params** (`sanitizeSearch`): a GA solo viajan `utm_*`, `origen` y click IDs (`gclid`/`gbraid`/`wbraid`); `?est=EST-XXXX`, `?ref=…`, `?c=…`, tokens → se botan. `sanitizePath()` queda como defensa en profundidad.
- **Kill-switch en navegación SPA público→privado**: `window['ga-disable-<ID>']` (GA4 + Ads) se activa al entrar a ruta privada — sin esto, la "medición mejorada" de GA4 (history changes) podría emitir hits con URLs privadas desde el script ya cargado.

**2. Conversión "Click WhatsApp" — subconteo estructural arreglado:**
- Los 3 flujos de MAYOR intención abrían WhatsApp con `window.open()` desde un `<button>` y el listener global (solo `<a>`) nunca los veía → **cero conversiones en el CTA principal**: calculadora (`CalculadoraForm`), `/estimacion` (`EstimacionForm`) y "Arma tu envío" (`ServiciosExplorer`). Ahora los 3 disparan `trackWhatsAppConversion()` — **MISMO `send_to`** (`AW-561290482/qbu2CILjn7ocEPK50osC`), no se fragmenta el historial de Smart Bidding. Esperar un salto REAL de conversiones al desplegar: antes se subcontaba.
- Ruido eliminado: `wa.me/?text` sin número (COMPARTIR estado en `/track`) ya no cuenta como conversión; los clicks dentro de iframes tampoco (`/calculadora/embed` vive embebida en el portal de clientes ya captados).

**3. Eventos GA4 nuevos** (antes: CERO eventos propios — la conversión de Ads no llega a la propiedad GA4):
- `whatsapp_click` (param `cta_origin`) — espejo GA4 de cada click a WhatsApp.
- `generate_lead` (param `lead_method`: `contacto` | `estimado` | `registro`) — form de contacto ACEPTADO por el servidor (res.ok — un throttle/rechazo no infla el evento), estimado confirmado en el modal y registro con MARKBOX. Con guard de iframe (el embed del portal no cuenta). Nota asumida: la cadena estimado→registro del mismo humano genera 2 `generate_lead` (son 2 acciones distintas; las audiencias cuentan usuarios, no eventos).

**4. SEO on-site:** sitemap + `/cotizador-flete` + `/enlaces` (faltaban) · `robots.ts` ya NO bloquea `/track/` (bloquearlo impedía que Google leyera el meta `noindex` de `/track/[code]` — quedaban "URL-only") · `BreadcrumbJsonLd` en `/noticias/[slug]` (migas en SERP para el long-tail) · **red de seguridad del 301 de dominio** en `next.config.ts`: redirects host-based `doortudoor.com`/`www.doortudoor.com` → `dtdcargo.com/:path*` — inertes mientras el 301 externo (DNS/Hostinger) funcione, salvavidas si vuelve a caerse como con el clientHold · podado código muerto con CTAs WhatsApp fantasma (`HeroCotizador.tsx`, `TrackingPreview.tsx`, 0 importadores).

**4b. Remates (modo Yunque · implementer + reviewer APPROVED):** `/estimacion` y `/nosotros` reconectadas (CTA en `/calculadora` + links en Footer) · **OG image dinámica por artículo** (`app/noticias/[slug]/opengraph-image.tsx`, 1200×630 flat navy/wine con hex canónicos de `globals.css` documentados — Satori no lee CSS vars —, fallback genérico si el post no existe; el JSON-LD `image` apunta ahí; tipografía default de ImageResponse hasta versionar un `Archivo-*.ttf` local) · **VideoObject único** en `/brochure` (prop `noVideoSchema` en `WorkBand`; home intacto) · **`lastModified` honesto** en sitemap (omitido en estáticas/geo, real solo en posts) · +10 tests en `__tests__/seo-remates.test.ts`.

**5. Consola (founder / Cloud Chrome) — pendiente de ejecutar:**
- ⚠️ **Verificar la propiedad GA4**: la sesión de Cloud Chrome miraba `a208873909…` (cuenta vieja "DoorTuDoor"); la oficial es "dtdcargo.com" (cuenta 396905128, tag `G-25CD7BZH98`). Las audiencias van en la propiedad que RECIBE los datos.
- En GA4: marcar `generate_lead` y `whatsapp_click` como **key events** cuando fluyan post-deploy; crear audiencia **"Todos los visitantes — 30 días"** YA (supera los 100 miembros de una y desbloquea remarketing/adquisición en Ads) y luego **"Intención de cotizar"** (`whatsapp_click` O `generate_lead`, retención 90 días). Si se crean audiencias por `page_path` de `/calculadora`, excluir `/calculadora/embed`.
- En Google Ads: conversión "Click WhatsApp" → confirmar estado "Activa" y que enhanced conversions ya no reporte beacon bloqueado (fix CSP 2026-07-04) · **eliminar "Contactar"** (viene de UA, descontinuado) · **quitar "Vista de página" como conversión principal** (9k page views contaminan Smart Bidding) · las acciones de llamada sin conversiones recientes son normales con las campañas pausadas.

### 2026-07-22 · SEO/AEO basado en preguntas reales del CRM

- Fuente localizada: SDD-0062 analizó **401 conversaciones** del Inbox de Kommo sin PII. El corte
  encontró 42% de cortesía/ruido, 10% de consultas de cotización y 6% de servicio específico.
- La base de conocimiento conserva un bloque de **seis temas comerciales de alta frecuencia**:
  inicio/registro, cotización/CBM, tiempos, envío a bodega, FOB/EXW y métodos de pago.
- Se construyó un **top 20 operativo** con respuestas directas, intención y ruta canónica. Para los
  puestos 7–20 no se inventaron porcentajes ni un ranking estadístico: quedan ordenados por valor
  comercial y utilidad hasta instrumentar conteo de intenciones en Kommo.
- Fuente canónica de trabajo: [`seo-aeo-preguntas-crm.md`](seo-aeo-preguntas-crm.md).
- Revisión canónica 2026-07-22: **aprobado editorialmente con condiciones**; no aplicar al sitio
  público hasta cerrar las validaciones de Operaciones, Comercial/Legal y la autorización del founder.
- Decisión de arquitectura: enriquecer `/faq` y rutas existentes; **no** crear 20 páginas delgadas.
- Actualización de criterio técnico: Google trata AEO/GEO como parte de SEO, no requiere schema
  especial ni `llms.txt`, y desde el 7 de mayo de 2026 dejó de mostrar resultados enriquecidos FAQ.
  El `FAQPage` existente no se considera una palanca de ranking ni una garantía de cita.

### 2026-07-22 · `/noticias` pasa a “Actualidad”

- La ruta canónica sigue siendo `/noticias`; no se crea `/blog` ni se dividen intenciones.
- Nombre corto en el menú principal: **Actualidad**. Título visible aprobado:
  **“Actualidad, guía y noticias”**.
- La portada organiza el CMS existente por las seis categorías de negocio de
  SDD-0088, oculta categorías vacías, muestra búsqueda desde ocho publicaciones
  y pagina el archivo cada doce.
- Cada artículo emite `BlogPosting`, `NewsArticle` o `Article` según su naturaleza.
  Se retiró el `FAQPage` automático: las preguntas siguen dentro del contenido,
  sin convertir cualquier encabezado interrogativo en datos estructurados.
- La web pública consulta `news_posts` mediante `lib/public/news-queries.ts`.
  El newsletter se muestra inactivo hasta aprobar la migración y verificar alta,
  envío manual y baja firmada de punta a punta.
- Spec y gates: [`../specs/0167-actualidad-centro-editorial/spec.md`](../specs/0167-actualidad-centro-editorial/spec.md).

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
- [ ] **Año de fundación = 2015** (`foundingDate`; decisión founder 2026-07-18 — resuelve la
  contradicción 2010/2015) · experiencia "+15 años con China" se cuenta desde 2008 · 2010 = solo
  hito histórico (formalización en China), nunca "empresa desde".
- [ ] **301 `doortudoor.com`** intacto · dominio viejo sin expirar · sin contenido propio ahí.
- [ ] **GA fuera de rutas privadas** (`/studio /portal /m /back /invitar /verificar /p /interno /marca /calculadora/embed` y `/track/<código>`) · query params: solo whitelist de atribución (`sanitizeSearch`). El código del cliente NUNCA llega a Google — ojo: gtag manda `dl` y título crudos en cada hit, redactar el page_view no basta, hay que EXCLUIR la ruta. Tests en `__tests__/analytics.test.ts`.
- [ ] Rename de ruta con SEO → **301** del slug viejo en `next.config.ts`.
- [ ] Validar el schema en Rich Results Test antes de cerrar.
- [ ] `SearchAction` solo si existe un buscador real (hoy no hay).

## Pendiente / monitoreo

- Monitorear el traspaso del "Cambio de dirección" en Search Console (~180 días): las URLs de `dtdcargo.com` deben ir reemplazando a las de `doortudoor.com` en los resultados.
- Si aparecen más páginas viejas con impresiones que caen en 404 → agregar su redirect en `next.config.ts`.
