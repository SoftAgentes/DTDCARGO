---
sdd: "0641"
title: "GEO y AEO: radar de respuestas de IA y auditoría por página, el video contra DTD Cargo"
status: proposed
author: "Claude Worker «GEO/AEO radar» (Sam)"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0604", "0605", "0606", "0610", "0611", "0613"]
confidencialidad: interno
---

# SDD-0641 — GEO y AEO: radar de respuestas de IA y auditoría por página

> Qué de un método de «posicionarse en respuestas de IA» ya hacemos, qué falta y en qué orden
> conviene construirlo con lo que ya tenemos. **Solo diseño y medición de lectura.** No cambia
> producto, no toca producción ni el VPS de la oficina, no lee datos de negocio.

## Pedido

Sam vio un video de TikTok (@future.with.ai98, «100-Point Grok Bot AI SEO Checklist», 17 min) y
pidió saber qué de eso ya hacemos y un plan para lo que falta con lo que ya tenemos. Encargo del
Director General, 2026-11-16.

**Sobre el video.** Es material de venta del curso de su autor. Aquí se usa solo como lista de
ideas, resumida con palabras propias. **Ninguna cifra, promesa de resultado o «puntaje» del
autor es verificable**, y esta spec no se apoya en ellas. No se pudo ver el video en esta tarea:
la descripción del método viene del encargo, no de una transcripción.

## 1. Cómo se midió

Fecha: 2026-11-16. Etiquetas, en cada afirmación:

- **[CÓDIGO]** leído en `origin/main` (`94f555f93`), con archivo:línea.
- **[SITIO]** leído en `https://dtdcargo.com` con `curl`/`fetch` anónimos (robots.txt, sitemap.xml,
  llms.txt, llms-full.txt y el HTML de 28 de las 48 URL del sitemap). Una pasada, sin cuentas.
- **[DOC]** leído en un documento del repositorio.
- **[INFERIDO]** deducido; no comprobado.
- **[SIN DATOS]** solo se sabe con Search Console, GA4 o con preguntarle a las IA; hoy nadie lo mide.

Límites: el escaneo del sitio mira el HTML que entrega el servidor, no mide velocidad ni renderiza
JavaScript. No se leyó ninguna base de datos. Los enlaces internos y las fechas visibles por
página **no** se midieron (marcados como inferidos).

## 2. El video contra DTD Cargo, por grupo de la lista

Estado: **Hecho / Parcial / Falta / No aplica**. «Hecho» no es «verificado con resultados»: solo
dice que la pieza existe.

| # | Grupo | Estado | Evidencia | Qué falta |
|---|---|---|---|---|
| 1 | Intención (forma de la página = forma de la búsqueda; sin canibalización) | **Parcial** | Páginas por intención: `/puerta-a-puerta`, `/fcl`, `/tarifas`, `/glosario`, `/faq`, 18 geo-páginas `/importar-de-china/{zona}` [SITIO]. Pero hay `/puerta-a-puerta` (0,9 de prioridad) y `/servicios/puerta-a-puerta` (0,7) sobre el mismo tema: `app/sitemap.ts:17` y `:26`; el comentario `app/sitemap.ts:22-25` reconoce el riesgo de competirse. Canibalización real: [SIN DATOS] | Un script que detecte páginas con el mismo título o H1 casi igual; datos de consultas por página (Search Console) |
| 2 | Respuesta primero | **Parcial** | Bloque `#respuesta-rapida` con `speakableSelectors` en `/`, `/tarifas`, `/fcl`: `app/page.tsx:54`, `app/tarifas/page.tsx:79`, `app/fcl/page.tsx:55`. `/puerta-a-puerta` y `/shipping-mark` también usan `WebPageJsonLd` (`app/puerta-a-puerta/page.tsx:119`, `app/shipping-mark/page.tsx:121`). El resto de páginas y las noticias: [INFERIDO] sin bloque | Medir por página si las dos primeras frases responden la pregunta del título; ampliar a `/servicios/*` y a las noticias |
| 3 | Entidad y marca (nombre idéntico en todas partes; página Nosotros) | **Parcial, casi hecho en el sitio** | `/nosotros` existe y emite `AboutPage` [SITIO]. Una sola organización en el `@graph` de `app/layout.tsx` con `sameAs` a Instagram, YouTube y TikTok (`app/layout.tsx:139`). `docs/marketing/identidad.md` fija el nombre. **Fuera del sitio:** Wikidata, Google Business Profile y LinkedIn están **pendientes por URLs de Sam** (`docs/marketing/seo.md:159`, `:184`; SDD-0604 «Fuera de alcance»). El dominio anterior `doortudoor.com` ya redirige (`docs/marketing/README.md:193`): nombre viejo en terceros [INFERIDO] | Perfil de Google Business y alta en directorios con el nombre exacto (ver fase D) |
| 4 | Schema (Article, FAQ, autor, fecha, título <60) | **Hecho en lo técnico, con 2 matices** | Noticias emiten `BlogPosting` con `author`, `datePublished` y `dateModified` [SITIO] (`app/noticias/[slug]/_components/NewsArticleJsonLd.tsx:93-94`). `FAQPage` en `/faq`, `/puerta-a-puerta`, `/shipping-mark` y geo-páginas [SITIO]. `BreadcrumbList` en casi todas. Matices: (a) **dos títulos pasan de 60 caracteres**: `/fcl` 76 y `/servicios/puerta-a-puerta` 63; `/servicios/lcl` está justo en 60 y `/servicios/fcl` en 57 [SITIO, longitud del `<title>` ya con sufijo]; (b) el criterio vigente de la casa es que el marcado de preguntas **no es palanca** porque Google dejó de mostrar FAQ enriquecidos (`docs/organizacion/oficina-conocimiento/05-seo-geo-aeo.md`, «Criterio vigente»; SDD-0604) | Revisar los 2 títulos largos (decisión de redacción, no urgente) |
| 5 | Prueba y confianza (fuentes, autor real, casos) | **Parcial** | Autor con persona real o «DTD Cargo» como organización con revisor humano (`NewsArticleJsonLd.tsx:63`; `docs/marketing/agente-seo-noticias.md` «Decisiones de Sam»). `aggregateRating` **bloqueado** hasta tener reseñas reales (`docs/marketing/seo.md:184`). Casos de clientes: existen en la web [INFERIDO]; no medido | Reseñas reales publicables, y fuentes citadas dentro de los artículos (la política de noticias ya lo exige con marcas `[VERIFICAR]`, `docs/specs/0611-noticias-publicacion-automatica/spec.md`) |
| 6 | Frescura (fecha de actualización, sitemap con `lastmod`) | **Parcial, a propósito** | Solo las noticias llevan `lastmod`: 5 de 48 URL [SITIO]; el resto lo omite por decisión «lastmod honesto» (`app/sitemap.ts:11-15`). Las noticias usan `updated_at` (`app/sitemap.ts:70-71`). Fecha visible en cada página: [INFERIDO] solo en noticias | Nada urgente: un `lastmod` falso es peor que ninguno. Si se quiere, `lastmod` real desde Git por página (decisión aparte) |
| 7 | Acceso de IA y velocidad | **Hecho** | `robots.txt` en vivo permite 14 agentes con nombre (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended, Google-CloudVertexBot, Applebot-Extended, Meta-ExternalAgent, CCBot, Bingbot) y solo cierra `/marca` e `/interno/` [SITIO] = `app/robots.ts:20-36`. `llms.txt` y `llms-full.txt` responden 200 [SITIO]. Texto en el HTML inicial: las 28 páginas leídas traen entre 112 y 6.449 palabras en el HTML crudo [SITIO] | Velocidad real (Core Web Vitals): [SIN DATOS]; no se midió en esta tarea |
| 8 | Enlaces internos | **No medido** | Existen geo-páginas, glosario y FAQ enlazados entre sí [INFERIDO] | Un script que cuente enlaces entrantes por página y huérfanas, con el sitemap como lista (parte de la fase A) |
| 9 | Menciones fuera del sitio | **Falta (en gran parte)** | Instagram/YouTube/TikTok propios (`app/layout.tsx:139`). Google Business Profile, Wikidata, LinkedIn y directorios: pendientes (`docs/marketing/google-configuracion.md`, plan por fases; `docs/marketing/seo.md:159`). Cuántas veces nombran a DTD Cargo las IA o terceros: [SIN DATOS] | Fase B (radar) y fase D (lista de directorios) |
| 10 | Medición (Search Console, puntaje por pregunta y herramienta) | **Falta** | La fase B de SEO la diseñó pero **no está construida**: no existe ningún cliente de Search Console ni tabla (`docs/specs/0613-seo-fase-b/spec.md` §1.5, §3.2; estado `proposed`). El «Cambio de dirección» de Search Console sí está activo (`docs/marketing/README.md:50`). Segmento de tráfico desde IA en GA4: fuera del repo, [SIN DATOS] | Fases B y E de esta spec |

**Lectura corta del cuadro.** Lo técnico (grupos 4 y 7) está bien. Lo que el video llama «lo que
decide» y a nosotros nos falta es **medir** (grupo 10) y **estar fuera del sitio** (grupos 3 y 9).
Eso coincide con lo que ya concluía la SDD-0613 §1.1: la base on-page está sana.

## 3. El video contra DTD Cargo, por bot

Los «bots» son tareas semanales. Aquí se comparan con lo que existe en la oficina y en el Studio.

| Bot del video | Estado | Lo que ya tenemos | Lo que falta |
|---|---|---|---|
| 1. Radar de menciones (preguntar a ChatGPT, Gemini, Perplexity, Grok y Google lo que preguntan compradores y anotar a quién nombran) | **Falta** | Las 20 preguntas reales de clientes (`docs/marketing/seo-aeo-preguntas-crm.md`, 401 conversaciones, SDD-0062); 13 palabras clave con prioridad (`lib/news/seo-keywords.ts`, medidas en SDD-0613 §1.4) | Un listado fijo de preguntas, una tarea semanal que las consulta y un registro de «quién aparece». Hoy nadie sabe si las IA citan a DTD Cargo [SIN DATOS] |
| 2. Minero de preguntas (foros, «la gente también pregunta», ordenadas por cercanía a la venta) | **Parcial** | El «Experto en SEO» de la oficina ya entrega temas con su porqué cada semana (`docs/organizacion/oficina-conocimiento/05-seo-geo-aeo.md`); el banco de temas con Search Console está diseñado (`0613` §3.2, punto 5) pero no construido | Fuentes externas de preguntas (foros, resultados de «preguntas relacionadas») y el orden por cercanía a la compra |
| 3. Redactor de respuestas (respuesta en las dos primeras frases, tabla al medio, preguntas al final; queda en borrador) | **Parcial, casi hecho** | Pipeline de noticias: Redactor, Revisor, borrador en `seo_drafts`, prompts en `lib/news/prompts.ts`, filtros F1 a F10 y publicación automática apagada hasta que Sam encienda el interruptor (SDD-0611, PR #417; `docs/marketing/agente-seo-noticias.md`) | Añadir al prompt la forma «respuesta primero + tabla + preguntas» y un filtro que lo compruebe (extensión de la 0611, no una canalización nueva) |
| 4. Cazador de pruebas (reseñas, listas y directorios donde falta la marca, con mensaje para pedir alta) | **Falta** | Plan de Google Business Profile (`docs/marketing/google-configuracion.md`); Gabinete y Comunidad en la oficina (`docs/organizacion/oficina-agentes/`) | Lista de directorios y menciones faltantes, con mensaje de solicitud de alta (fase D). **Enviar mensajes a terceros es acción externa:** requiere OK por envío |
| 5. Atalaya (resumen de una página cada lunes: puntaje contra la semana anterior, tres preguntas, tres huecos) | **Falta** | Rutinas con cron de Paperclip como reloj de la oficina y Discord como canal (`docs/organizacion/hermes-oficina.md`, tabla de piezas; rutina del viernes y latido diario del CEO) | La rutina de los lunes y la fuente de números (fases B y E) |

## 4. Qué se construiría y qué no

Principios que condicionan todo el plan, tomados de decisiones ya aprobadas:

1. **La oficina piensa; el Studio guarda llaves, datos y publica** (esquema mixto, SDD-0613
   «Pedido»). La oficina **no tiene llaves de Google** (`05-seo-geo-aeo.md`, «El Experto no entra a
   ninguna cuenta de Google»).
2. **Los datos agregados a la oficina salen por la puerta de la SDD-0610**, sin pedir otro corte.
3. **Los servicios informan, no venden:** ninguna pieza nueva lleva CTA de WhatsApp.
4. **Nada de datos de clientes a terceros.** Las preguntas de los bots salen de las 20 del CRM, ya
   anonimizadas, y se pasan por `revisar-datos-ve` antes de enviarlas a una IA externa. Una
   consulta a ChatGPT/Gemini/Perplexity/Grok es una salida de datos a un tercero: solo va texto
   público de pregunta, nunca nombres, teléfonos ni cifras de clientes.
5. **Publicar sigue las reglas de la 0611.** Esta spec no cambia IA-01.
6. **Regla D-2: datos de clientes nunca a un proveedor chino.** Si el agente que procesa el
   radar corre con GLM o DeepSeek, solo recibe **preguntas públicas** y las respuestas públicas de
   las IA; jamás texto de conversaciones, nombres, teléfonos ni cifras de clientes. Aplica a las
   fases B y C. Se verifica en la revisión de cada fase con `revisar-datos-ve`.

## 5. Plan por fases

Costos aproximados, **estimación sin cotización**; ningún precio de API se verificó en esta
tarea. Riesgo: **B**ajo / **M**edio / **A**lto.

### Fase A · Script de auditoría por página (pasa / falla / manual)

- **Qué:** `scripts/auditoria-geo-aeo.mjs` (solo lectura) que toma el sitemap y, por página, marca
  pasa/falla/manual sobre lo **medible por máquina**: título ≤60, `description`, `canonical`, un
  H1, JSON-LD presente y tipos esperados, `dateModified` donde aplica, presencia de
  `#respuesta-rapida`, palabras en el HTML crudo, `noindex` correcto, enlaces internos entrantes y
  huérfanas, mismo título entre páginas. Lo que no se puede medir sin criterio humano (calidad de
  la respuesta, fuentes) sale como **manual**. Las rutas son las de `app/sitemap.ts`; las
  excepciones (`/enlaces`, `/privacidad`, `/cookies`) van en una lista explícita.
- **Equivale a** los grupos 1, 2, 4, 6, 7 y 8 de la lista. No inventa «100 puntos»: cuenta solo
  comprobaciones reales.
- **Necesita de Sam:** nada. Es un script y una prueba; pasa por PR con SDD propia.
- **Costo:** unas horas de un Worker; sin costo de API.
- **Riesgo:** B. Lo único a cuidar es que no se vuelva un puntaje que se persiga por sí mismo.
- **Primer hallazgo ya conocido:** 2 títulos de más de 60 caracteres: `/fcl` y `/servicios/puerta-a-puerta` (§2, grupo 4).

### Fase B · Radar de menciones semanal y resumen de los lunes

- **Qué:** dos rutinas de Paperclip (el reloj de la oficina) con agente de Hermes, que avisan en
  Discord:
  1. **Radar:** cada semana consulta un listado fijo de ~15 a 20 preguntas (partiendo de las 20 del
     CRM) a las herramientas que se decidan (ChatGPT, Gemini, Perplexity, Grok y la búsqueda de
     Google) y anota, por pregunta y herramienta, **si nombran a DTD Cargo, a quién nombran en su
     lugar y qué fuente citan**. Registro en una hoja o tabla simple con fecha.
  2. **Resumen de los lunes (el «atalaya»):** una página por semana: cuántas preguntas nombran a
     DTD Cargo contra la semana anterior, las tres preguntas más cercanas a la venta donde no
     aparece y los tres huecos de página o de menciones.
- **Dónde:** en la oficina de Hermes/Paperclip del VPS (`docs/organizacion/hermes-oficina.md`),
  con salida a Discord. **No se instala nada desde esta spec.** Cualquier cambio en el VPS lo hace
  la ingeniería de la oficina con su runbook y el OK de Sam.
- **Necesita de Sam:** (1) decidir qué herramientas se consultan; (2) cuentas o llaves de API de
  cada una, **creadas por Sam y guardadas en el gestor de secretos del VPS, nunca en el repo ni
  en el chat**; (3) OK del tope de gasto mensual; (4) el canal de Discord donde cae el aviso.
- **Regla D-2 (ver §4, punto 6):** el agente del radar, sea del modelo que sea, recibe solo la
  lista fija de preguntas públicas; si corre con GLM o DeepSeek, nada de datos de clientes llega a
  su contexto.
- **Tope de gasto (DECIDIDO por Sam, 2026-11-16):** **15 USD al mes** solo para consultas de API del
  radar, repartido entre las herramientas elegidas, aparte del tope de 100 USD de la oficina. El
  radar **se corta solo** al llegar al 100 %: lleva un contador por corrida, avisa en Discord al
  80 % y al llegar al tope no lanza más consultas ese mes. Sam aprobó la cifra el 2026-11-16, según
  lo relayó el Director General: «Sí, sí, apruebo los $15 al mes». Los precios de cada proveedor
  siguen sin verificar; si el tope no alcanza para las herramientas elegidas, se vuelve a pedir.
- **Costo:** ~20 preguntas por herramienta y semana son pocas llamadas; el gasto de API es
  probablemente **de pocos dólares al mes**, más el consumo del agente de la oficina que ya está
  dentro del tope de la oficina (100 USD según `hermes-oficina.md`). **[INFERIDO]**: depende de los
  precios vigentes de cada proveedor, que no se verificaron. Una primera corrida **manual** (las
  preguntas a mano en las herramientas, anotadas en una tabla) cuesta cero y sirve de línea base.
- **Riesgos:** **M.** (a) Las respuestas de las IA cambian de una consulta a otra: una semana no
  es una medida, hay que mirar tendencia de varias semanas y repetir cada pregunta más de una
  vez [INFERIDO]. (b) Algunas herramientas no ofrecen API de búsqueda equivalente a lo que ve una
  persona; los resultados de la API pueden diferir de la interfaz [INFERIDO]. (c) Términos de uso
  de cada proveedor para consultas automatizadas: revisar antes de contratar [SIN DATOS].
  (d) Privacidad: solo texto público de pregunta (§4, punto 4).
- **Condición para publicar el número:** toda cifra que se muestre sale de una corrida con su
  fecha; nunca de un modelo que «estima» posiciones (regla ya fijada en la SDD-0613, criterio 7).

### Fase C · Minero de preguntas que alimenta las noticias y las FAQ

- **Qué:** el Experto en SEO (que ya existe) suma al «banco de temas» de la SDD-0613 §3.2 dos
  fuentes: las preguntas donde el radar de la fase B vio que no nombran a DTD Cargo, y preguntas
  relacionadas de la búsqueda. Cada tema se ordena por **cercanía a la compra** (cómo importar,
  costo, tiempos, riesgos de estafa) frente a lo meramente informativo. Entra al generador de
  noticias por la puerta de la SDD-0611, con su consulta de origen; las respuestas cortas van a
  `/faq` (donde la casa ya decidió que se enriquecen las respuestas).
- **Necesita de Sam:** nombrar a la persona que revisa las respuestas nuevas de `/faq`; hoy es el
  revisor humano de la 0611 (Sam y la persona de contabilidad con CRM).
- **Costo:** **sin gasto nuevo** si se apoya en el Experto y el generador que ya existen.
- **Riesgo:** **M**: el contenido nuevo debe cumplir las líneas rojas de `lib/news/prompts.ts`
  y no prometer rastreo mientras el seguimiento esté en construcción (lo recoge la 0613 §3.3).
- **Dependencia:** la fase C **completa** necesita la SDD-0613 (revisión en servidor, Search
  Console). Una versión mínima (preguntas del radar → temas) puede empezar sin ella.

### Fase D · Directorios y menciones que faltan

- **Qué:** una lista priorizada, con evidencia, de dónde debería estar DTD Cargo y no está:
  Google Business Profile (Valencia), Wikidata, LinkedIn, directorios de agentes de carga,
  cámaras o asociaciones, y listas «mejores agentes de carga China-Venezuela». Por cada uno: URL,
  qué pide, si ya existe un perfil y el **nombre exacto** a usar (el del `@graph`, ver
  `docs/marketing/identidad.md`). Para cada alta, un borrador de mensaje que **una persona envía**.
- **Necesita de Sam:** las URL de sus perfiles; decidir cuáles directorios valen la pena; **OK por
  cada alta o mensaje** (es publicar o enviar a un tercero; AGENTS.md y política de acciones
  externas). Reseñas: solo de clientes reales y con su consentimiento; ninguna reseña inventada.
- **Costo:** tiempo humano; algunos directorios cobran, **[SIN DATOS]** cuáles.
- **Riesgo:** **M**. (a) Un perfil con datos distintos del sitio **rompe la entidad** (grupo 3):
  se copian datos del sitio, no se improvisan. (b) Directorios «de pago por aparecer» o con enlaces
  de baja calidad pueden dañar más que ayudar: no se contratan sin evaluarlos. (c) Datos de
  contacto públicos: ya son los del sitio; nada de clientes.

### Fase E · Medición con Search Console

- **Qué:** es la **fase C de `agente-seo-noticias.md` / P2 de la SDD-0613**, sin cambios: cuenta
  de servicio de solo lectura, cliente en el Studio, tabla de métricas agregadas, cron diario,
  salida a la oficina por la puerta de la 0610. Esta spec solo añade que el **resumen de los
  lunes** (fase B) incluya, junto al radar, clics e impresiones de las páginas que se auditen.
  Fuera del repo: GA4 con segmento de tráfico desde IA y Bing Webmaster Tools (SDD-0604,
  «Consolas»).
- **Necesita de Sam:** crear la cuenta de servicio (la llave va al gestor de secretos del servidor);
  OK nominal de la migración que la 0613 propone; el umbral de impresiones (propuesta: 5).
  Descongelar la publicación de la web para que el código llegue a producción.
- **Costo:** sin costo de API (Search Console es gratuito) [DOC: decisión «solo Search Console, sin
  API de pago»]. Trabajo: una migración, un cliente y un cron.
- **Riesgo:** **M-A.** Es la más pesada: toca producción con una migración y una llave. Las
  consultas de búsqueda pueden traer nombres de personas: pasar por `revisar-datos-ve` antes de
  guardar (0613 §3.2, punto 7).

## 6. Orden recomendado

Orden por «más por menos»:

| # | Qué | Por qué en ese lugar |
|---|---|---|
| 1 | **Línea base manual del radar** (fase B, versión a mano) | Cero costo y cero código. Es la única forma de saber hoy si las IA nombran a DTD Cargo; hasta entonces todo el plan se apoya en suposiciones |
| 2 | **Script de auditoría (fase A)** | Barato, sin dependencias de Sam, y deja un marcador que no se pudre. Cierra de una vez los dos títulos largos y las páginas sin respuesta-primero |
| 3 | **Fase D (lista de directorios y menciones)** | Es donde el cuadro del §2 dice «Falta»; depende de decisiones de Sam, no de código. Un perfil de Google Business ya estaba pendiente antes del video |
| 4 | **Radar y lunes automatizados (fase B completa)** | Solo vale la pena tras una línea base; si el radar manual muestra que ya nos nombran, el automático pierde urgencia |
| 5 | **Fase C (minero a noticias y FAQ)** | Depende de que la 0611 esté encendida y de la 0613 para su versión completa |
| 6 | **Fase E (Search Console)** | La más valiosa a largo plazo pero la más pesada; **ya está en el plan de la 0613**. Esta spec no la adelanta ni la duplica |

### Qué NO conviene copiar del video

1. **La lista de «100 puntos» como meta.** Es una lista de venta, con puntos que el propio criterio
   de la casa descarta como palanca (p. ej. FAQ marcado, `05-seo-geo-aeo.md`). Un puntaje alto no
   es un resultado. Se copian solo las comprobaciones que una máquina puede medir.
2. **Un puntaje inventado por un modelo.** Nunca se muestra una posición o «puntaje de visibilidad»
   que salga de un modelo; solo de una corrida con su fecha y su método (regla de la 0613).
3. **Grok como pieza central.** Las respuestas son de la herramienta que se consulte; el método es
   independiente de Grok. Se decide por precio, términos y utilidad, no por el nombre del video.
4. **Publicar solo lo que la IA redactó.** El video deja el borrador para que una persona lo
   apruebe; en nuestro caso lo regula la 0611, con filtros y revisor humano. No se acorta.
5. **`lastmod` falso para parecer fresco.** Ya se decidió lo contrario (`app/sitemap.ts:11-15`).
6. **Pedir o fabricar reseñas y menciones en masa.** Dañan la entidad; solo clientes reales.
7. **Páginas nuevas por cada pregunta.** Duplicaría el problema de canibalización del grupo 1; las
   respuestas cortas van a `/faq`.
8. **Convertir las respuestas en venta.** Política vigente: los servicios informan, no venden; sin
   CTA de WhatsApp.
9. **Prometer posiciones o resultados** en cualquier pieza. No se garantiza que una IA nos cite.

## 7. Dependencias y decisiones de Sam

| Qué | Quién | Fase | Estado |
|---|---|---|---|
| Qué herramientas de IA se consultan | Sam | B | Pendiente |
| Tope mensual del radar: 15 USD | Sam | B | **Decidido** 2026-11-16 |
| Llaves de API (si se automatiza), en el gestor de secretos del VPS | Sam | B | Pendiente |
| URL de Google Business Profile, LinkedIn y Wikidata | Sam | D | Pendiente (ya lo estaba) |
| OK por cada alta de directorio o mensaje a un tercero | Sam | D | Pendiente |
| Cuenta de servicio de Search Console y OK de la migración | Sam | E | Pendiente (ya lo estaba, SDD-0613) |
| Persona que revisa FAQ y noticias nuevas | Sam | C | Ya definida en la 0611 |
| Descongelar la publicación de la web | Sam | A, C, E | Pendiente |
| Revisión de privacidad de lo que sale a terceros (`revisar-datos-ve`) | Worker de cada fase | B, E | Obligatoria |

## 7b. Criterios de aceptación por fase

Criterios que cada SDD de fase deberá cumplir. Medibles, con su evidencia.

| Fase | Criterio | Evidencia |
|---|---|---|
| Línea base manual | **N preguntas × M herramientas** corridas en una sola fecha: propuesta N = 20 (las del CRM), M = las que Sam elija (mínimo 3); cada celda anota si nombran a DTD Cargo, a quién nombran y qué fuente citan | Tabla con fecha y herramienta por fila; sin celdas vacías |
| A · Auditoría | Cubre **todas las URL de `sitemap.xml`**; cada comprobación sale pasa, falla o manual; **sale con código distinto de 0** si alguna falla; las excepciones están en una lista explícita | Prueba del script con una URL que falla a propósito; salida del script |
| B · Radar y lunes | El radar corre cada semana y deja registro con fecha; el resumen de los lunes llega a Discord; el gasto **se corta solo** al tope aprobado, con una prueba; el agente solo recibe las preguntas públicas (D-2) | Registro de corridas; prueba del corte; revisión `revisar-datos-ve` |
| C · Minero | Cada tema que entra a la 0611 lleva su pregunta de origen y su fuente con fecha; ninguna pieza sale sin pasar los filtros F1 a F10 | Filas del banco de temas; la 0611 rechaza un tema sin origen |
| D · Directorios | Lista con URL, requisito y nombre exacto por entrada; **ningún alta ni mensaje enviado sin OK de Sam** | Lista en `docs/marketing/`; registro de OK por envío |
| E · Search Console | Los de la SDD-0613 §7 (llave fuera del repo, umbral de impresiones, posiciones solo de Search Console con fecha) | Pruebas de la 0613 |

## 8. Fuera de alcance

- Escribir cualquiera de las fases, instalar rutinas o tocar el VPS de la oficina.
- Contratar herramientas de pago o cuentas de IA.
- Cambiar títulos, textos o contenido del sitio (los 2 títulos largos se reportan, no se corrigen).
- Medir velocidad real, enlaces internos y fechas visibles por página (se reservan para la fase A).
- Verificar las cifras del video: no son verificables y no se usan.

## 9. Evidencia y cómo repetirla

Todo lo leído en el sitio se repite con `curl` anónimo sobre las URL de `sitemap.xml` y mirando
`<title>`, `<meta name="description">`, `rel="canonical"`, `<h1>` y los `"@type"` del JSON-LD.
Lo de código se repite con `git show origin/main:<archivo>`. La medición del sitio fue una pasada
de lectura el 2026-11-16 y puede cambiar con cada despliegue.

## 10. Validación de esta SDD

Solo documento: `pnpm docs:check` y `pnpm sdd:check`; resultado en el handoff. `pnpm verify` no
aplica (no hay producto).

## 11. Allowlist

**Solo esta spec.** Cada fase (A a E) trae **su propia SDD** con su allowlist exacta, su
migración si la hay y su aprobación; esta spec no autoriza escribir código de ninguna.

| Archivo | Cambio |
|---|---|
| `docs/specs/0641-geo-aeo-radar-respuestas-ia/spec.md` | Nuevo (esta spec) |
| `docs/specs/README.md` | Índice regenerado con `pnpm docs:index`, si el check lo pide |
| `.agents/handoffs/sdd-0641-geo-aeo-radar-respuestas-ia.md` | Nuevo |

### Enmienda: Fase A (SDD-0642)

La Fase A (script de auditoría por página) tiene su propia SDD, [0642](../0642-auditoria-geo-aeo-script/spec.md).
Su allowlist exacta, solo lectura y sin dependencias nuevas:

| Archivo | Cambio |
|---|---|
| `scripts/auditoria-geo-aeo.mjs` | Nuevo (script) |
| `scripts/__tests__/auditoria-geo-aeo.test.mjs` | Nuevo (prueba focal, sin red) |
| `docs/specs/0642-auditoria-geo-aeo-script/spec.md` | Nuevo |
| `.agents/handoffs/sdd-0642-auditoria-geo-aeo-script.md` | Nuevo |
| `.gitignore` | Solo la línea `auditoria-geo-aeo-*.json` |
| `docs/specs/README.md` | Índice regenerado con `pnpm docs:index` |
