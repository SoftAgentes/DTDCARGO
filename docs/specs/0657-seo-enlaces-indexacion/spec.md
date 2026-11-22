---
sdd: "0657"
title: "Enlaces internos e indexación del sitio público"
status: in-progress
author: "Claude Worker (sesión de Sam)"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0064", "0604", "0613"]
confidencialidad: interno
---

# SDD-0657 — Enlaces internos e indexación del sitio público

> Que Google indexe las páginas públicas que Search Console deja en «Descubierta» o «Rastreada: actualmente sin indexar», atacando la causa medida: páginas sin enlaces internos y títulos que no dicen de qué tratan.

## Pedido

Sam, 2026-11-18, en la sesión que arregló doortudoor.com en Cloudflare: «Para que se indexe mejor, dame la lista para ver qué podemos hacer», y luego «Haz esta tarea aquí: “Enlaces internos e indexación de dtdcargo.com”».

## 1. Qué se midió

Medición del 2026-11-18 sobre el sitio publicado y Search Console (propiedad `sc-domain:dtdcargo.com`).

**Medido:**

- **Enlaces entrantes.** Se descargaron las 48 URL del sitemap y se contaron los enlaces internos entrantes únicos de cada una:

  | Enlaces entrantes | Páginas |
  |---|---|
  | 0 | `/puerta-a-puerta`, `/llenado`, `/brochure`, `/calculadora-terrestre` |
  | 1 | `/noticias/yiwu-ventaja-estrategica` |
  | 2–5 | `/servicios/fcl`, `/fcl`, `/servicios/inspeccion`, `/servicios/puerta-a-puerta`, `/servicios/lcl` y las demás noticias |
  | 18 | `/importar-de-china` y sus 18 ciudades |
  | 46–47 | el resto, que está en el menú o en el pie |

- **Ciudades aisladas.** A `/importar-de-china` solo la enlazan sus propias ciudades: el grupo es una isla que Google solo encuentra por el sitemap.
- **Ciudades parecidas.** Las páginas de ciudad comparten entre el 82 % y el 87 % del texto palabra por palabra (Maturín frente a Coro, 0,87; Maturín frente a Valencia, 0,82).
- **Search Console** (inspección de URL):
  - el hub está en «Rastreada: actualmente sin indexar», con último rastreo el 2026-07-27;
  - las ciudades, `/puerta-a-puerta`, `/llenado`, `/pre-alertas` y `/servicios/lcl` están en «Descubierta: actualmente sin indexar»;
  - Google ni siquiera conocía `/servicios/puerta-a-puerta`, `/servicios/fcl` y `/shipping-mark`.
- **Estadísticas de rastreo.** El servidor responde bien: 119 ms de media y ningún problema de host. Entre los 404 que ve Googlebot están `/favicon.ico` y `https://dtdcargo.com/registro:`, que sale del texto plano «dtdcargo.com/registro: en un minuto…» de una FAQ.
- **Títulos sin el tema.** Algunos títulos no nombran el trayecto: «Puerta a puerta», «Servicios», «Pre-alertas» y «Brochure».

**Inferido:**

- La causa principal es estructural. Una página sin enlaces internos le dice a Google que el propio sitio no la considera importante, y el sitemap solo no basta para que la indexe.
- `/puerta-a-puerta` reúsa los bloques de la portada (`PuertaAPuerta`) y de `/servicios` (`DdpHero`), así que compite con contenido que Google ya tiene.

## 2. Qué cambia

1. **Pie** (`components/Footer.tsx`):
   - **Explora** suma «Puerta a puerta» (`/puerta-a-puerta`) e «Importar por ciudad» (`/importar-de-china`).
   - **Ayuda** suma «Brochure».
   - **Enlaces rápidos** suma «Calculadora FCL», «Llenado de contenedor» y «Flete terrestre».
   - No se crea columna nueva: el pie conserva la estructura de la captura del founder del 2026-07-21.
2. **Enlaces dentro del contenido:**

   | Página | Enlaza a |
   |---|---|
   | `/puerta-a-puerta` | la ficha `/servicios/puerta-a-puerta` y `/importar-de-china` |
   | `/servicios/puerta-a-puerta` | `/puerta-a-puerta` y `/importar-de-china` |
   | `/fcl` | `/servicios/fcl` y `/llenado` |
   | `/servicios/fcl` | `/llenado` |
   | `/servicios/lcl` | `/tarifas` |
   | `/tarifas` | `/servicios/puerta-a-puerta` y `/servicios/lcl`, desde el texto del hero |

3. **Títulos** (con el sufijo « · DTD Cargo» todos quedan en 60 caracteres o menos):

   | Página | Antes | Ahora |
   |---|---|---|
   | `/puerta-a-puerta` | «Puerta a puerta» | «Puerta a puerta (DDP) de China a Venezuela» |
   | `/servicios` | «Servicios» | «Servicios de logística China–Venezuela» |
   | `/pre-alertas` | «Pre-alertas» | «Pre-alerta tu carga desde China» |
   | `/brochure` | «Brochure» | «Brochure: logística China–Venezuela» |
   | `/fcl` | 75 caracteres | «Calculadora de flete FCL China a Venezuela» |

4. **Descripciones de más de 160 caracteres**, recortadas sin cambiar lo que prometen: `/tarifas`, `/fcl`, `/servicios/fcl`, `/servicios/puerta-a-puerta`, `/servicios/lcl` y `/puerta-a-puerta`.
5. **404 del rastreo:**
   - `/favicon.ico` hace 301 a `/brand/favicon.ico` (`next.config.ts`).
   - Cuatro respuestas de FAQ (`lib/faqs.ts`) ya no ponen dos puntos pegados a `dtdcargo.com/registro` ni a `dtdcargo.com/portal`. Google los leía como parte de la URL.
6. **Documentación:**
   - El comentario del 301 de doortudoor en `next.config.ts` dice dónde vive ahora (Cloudflare).
   - Entrada nueva en `docs/marketing/seo.md`.

## 3. Qué no cambia y por qué

- **Fusionar páginas duplicadas.** No se fusiona `/puerta-a-puerta` con `/servicios/puerta-a-puerta` (ni `/fcl` con `/servicios/fcl`, ni `/tarifas` con `/servicios/lcl`). Cada par ahora tiene intención distinta (guía o calculadora frente a ficha de servicio) y se enlaza en los dos sentidos. Una consolidación con 301 o canónico es una decisión de contenido de Sam. Conviene tomarla con datos de Search Console de 3 o 4 semanas después de este cambio.
- **Contenido de las ciudades.** Diferenciarlas de verdad exige datos locales que solo tiene operaciones: tiempos de entrega reales por ciudad, transportista local, casos de clientes y costo de última milla. No se inventan; queda como propuesta en el handoff.
- **Descripciones que no se tocan:**
  - `/pre-alertas`: la fija palabra por palabra la prueba de la SDD-0521, porque depende del interruptor del seguimiento.
  - La portada (`SITE_DESCRIPTION`, 169 caracteres) y `/academia` (175) quedan igual porque son copy de marca. Lo deja anotado el handoff.
- **Menú principal.** No cambia: el pie basta para que ninguna página quede huérfana, y el menú es una decisión de diseño.
- **`public/llms.txt`.** Sigue enlazando `/portal`, aunque responde 307 sin sesión. La prueba de la SDD-0528 fija esa línea a propósito, porque la etiqueta «Portal del cliente» es la que se protegió con el interruptor del seguimiento. Cambiarla es decisión de esa SDD, no de esta.
- **Lista exacta de «Enlaces rápidos».** `components/sin-promesa-rastreo.test.tsx` (SDD-0521) la fija, así que se le suman las tres calculadoras nuevas. Lo que esa prueba protege no cambia: la etiqueta del seguimiento y que ningún texto del pie prometa rastreo.

## 4. Aceptación

1. Ninguna ruta fija del sitemap queda sin enlace en el pie, salvo las cuatro fichas de servicio que la portada enlaza con `svcHref`. Prueba: `components/Footer.enlaces.test.tsx`, que lee el sitemap real.
2. Las seis páginas de §2.2 enlazan desde su contenido a las páginas indicadas. Prueba: `app/__tests__/enlaces-internos.test.tsx`.
3. Las 8 pruebas nuevas fallan sin los cambios de código y pasan con ellos.
4. Las FAQ siguen siendo coherentes entre la pantalla y el JSON-LD, con el interruptor del seguimiento en los dos estados (`app/__tests__/faq-seguimiento-coherente.test.tsx`, con el texto «anterior» actualizado).
5. `pnpm verify` termina en PASÓ.
6. Observación después del despliegue, que no bloquea la PR: en Search Console, el número de páginas «Descubierta/Rastreada: actualmente sin indexar» baja en las semanas siguientes.

## 5. Fuera de este cambio, ya hecho el 2026-11-18 en servicios externos

- **Cloudflare:**
  - 301 de doortudoor.com a dtdcargo.com conservando ruta y query, más 10 reglas para URL viejas;
  - regla WAF 403 para el spam del WordPress hackeado;
  - Bot Fight Mode apagado, porque bloqueaba a PerplexityBot, ClaudeBot y DuckAssistBot;
  - ofuscación de correos apagada (era la P-a de `seo.md`).
- **Buscadores:**
  - IndexNow recibió las 48 URL (respuesta 200);
  - Google aceptó 11 solicitudes de indexación;
  - Bing Webmaster Tools quedó registrado por importación desde Search Console, con el sitemap enviado.
