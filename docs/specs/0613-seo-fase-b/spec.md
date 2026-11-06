---
sdd: "0613"
title: "SEO, GEO y AEO: fase B, revisión en servidor, Search Console en el Studio y prioridades medidas"
status: proposed
author: "Claude Worker «SEO fase B» (Sam)"
created: 2026-11-06
updated: 2026-11-06
supersedes: null
superseded_by: null
related: ["0053", "0088", "0167", "0604", "0610", "0611"]
confidencialidad: interno
---

# SDD-0613 — SEO, GEO y AEO: fase B

> Siguiente paso de SEO después de la fase A (SDD-0604): qué se hace, en qué orden y por qué,
> con las prioridades sacadas de lo que se puede medir hoy en el repositorio.
>
> **Solo diseño.** No trae código. Propone una migración **sin número**, que asigna el Director
> General. Nada de esto está construido.

## Pedido

Encargo de la sesión que coordina SEO y la oficina, del 2026-11-06, como prioridad 6 del
Director General: diseñar la fase B de SEO como seguimiento de la SDD-0604, con prioridades
medidas y no supuestas, encajada con la SDD-0611 (noticias automáticas, aprobada por Sam) y con
la SDD-0610 (puerta de salida de datos agregados).

Decisiones de Sam que esta SDD aplica, ya registradas en otros documentos:

- 2026-11-05: plan del agente SEO de noticias (`docs/marketing/agente-seo-noticias.md`). Datos
  solo de Search Console, sin API de pago; firma DTD Cargo con revisor humano; dos artículos por
  semana.
- 2026-11-05: las noticias se publican solas, con filtros. La excepción a IA-01 y sus filtros son
  la SDD-0611.
- Esquema mixto: la oficina de agentes piensa; el Studio guarda datos, llaves, aprobación y
  publicación.

## 1. Qué se midió

Lectura de `main` en `3d17292a4`, sin red y sin base de datos. **Medido** quiere decir leído en el
código o en los documentos del repositorio; **inferido**, deducido de eso; **sin datos**, que solo
se puede saber con Search Console, que todavía no entra al Studio.

### 1.1 Páginas públicas

Se recorrieron las 31 páginas públicas de `app/` (todo `page.tsx` fuera de Studio, portal, móvil,
`/back`, `/interno`, `/marca`, accesos con token y `/api`).

| Medida | Resultado | Estado |
|---|---|---|
| Páginas indexables | 27. Las otras 4 son `noindex` a propósito: `/terminos`, `/tarifas/embed`, `/fcl/embed` y la noticia que no existe | Medido |
| Con `metadata` o `generateMetadata` propio | 27 de 27 | Medido |
| Con `title` y `description` propios | 26 de 27. La portada usa los de `app/layout.tsx`, que son los de la marca: es correcto | Medido |
| Con `canonical` | 27 de 27 | Medido |
| Indexables que faltan en el sitemap | Ninguna | Medido |
| URL del sitemap sin página | Ninguna. Las geo-páginas y las noticias se arman por datos | Medido |
| Sin datos estructurados propios | 5: `/brochure`, `/cookies`, `/enlaces`, `/privacidad` y `/registro`. Todas heredan la organización del `@graph` de `app/layout.tsx` | Medido |
| Cada noticia | `title`, `description` (de `meta_description` o del extracto), `canonical`, Open Graph de artículo y su JSON-LD | Medido |

**Conclusión medida:** la base on-page está sana. La fase A dejó el sitemap completo y cada página
tiene sus metadatos. **No hay un hueco de títulos o descripciones que justifique una tanda de
trabajo.** Las 5 páginas sin JSON-LD propio son de poco valor de búsqueda; solo `/registro` podría
ganar un `WebPage`.

### 1.2 Lo que el sitio dice a motores de IA

| Medida | Resultado | Estado |
|---|---|---|
| `public/llms.txt` | 59 líneas, saneado en la fase A | Medido |
| `/llms-full.txt` | Ruta estática que arma los servicios ofrecibles, las 42 FAQ y el glosario; sin precios | Medido |
| `robots.ts` | Permite con nombre 14 rastreadores de IA y buscadores | Medido |
| Si los motores de IA citan el sitio | Sin datos. Search Console no lo dice; haría falta el segmento de tráfico desde IA en GA4, que se configura fuera del repositorio | Sin datos |

### 1.3 Preguntas reales de clientes

Fuente: las 20 preguntas de `docs/marketing/seo-aeo-preguntas-crm.md`, sacadas del análisis sin
datos personales de 401 conversaciones (SDD-0062). Se compararon con las 42 FAQ de `lib/faqs.ts`,
que alimentan `/faq`, `/puerta-a-puerta`, `/shipping-mark` y `/llms-full.txt`.

| Resultado | Preguntas | Estado |
|---|---|---|
| Respondidas por una FAQ | 18 de 20 | Medido por lectura, no por un script |
| Respondidas en parte | 2: «¿Cómo empiezo a importar de China con DTD Cargo?» (la FAQ explica el registro, no el camino completo) y «¿Puede ayudarme a comprar y consolidar varios proveedores?» (la FAQ habla de comprar, no de juntar varios proveedores en un envío) | Medido por lectura |
| Sin responder | Ninguna | Medido por lectura |
| Las 3 ideas aprobadas del mismo documento | Ninguna tiene página: guía de rastreo marítimo, precio semanal de un contenedor y protección de marca en China | Medido |

**Conclusión medida:** las preguntas del CRM ya están casi todas respondidas. Lo que falta son las
tres ideas aprobadas y dos respuestas más completas.

### 1.4 Palabras clave del negocio

`lib/news/seo-keywords.ts` trae 13 palabras clave con prioridad. Se contó cuántas veces aparece cada
frase exacta en el contenido público: páginas, servicios, FAQ, geo-páginas y glosario.

| Prioridad | Frase | Apariciones exactas |
|---|---|---|
| 5 | «puerta a puerta» | 118 |
| 5 | «importar de china a venezuela» | 12 |
| 5 | «cómo invertir en china» | **0** |
| 4 | «agente de compras china», «carga DDP china venezuela», «verificación proveedor china», «yiwu importadores» | **0** cada una |
| 3 | «incoterms 2020» | 1 |
| 3 | Las otras cuatro | 0 cada una |

**Cuidado al leerlo.** Es la frase exacta: «FCL LCL china» no aparece así, pero el sitio explica FCL
y LCL de sobra. Lo que sí dice con certeza es que **una frase de prioridad 5, «cómo invertir en
china», no tiene ninguna página**, y que el sitio no usa «agente de compras» ni «Yiwu» como las
escribe quien busca. **Si alguien las busca, y cuánto, es sin datos:** Search Console solo da
volumen donde el sitio ya aparece.

### 1.5 Noticias y publicación

| Medida | Resultado | Estado |
|---|---|---|
| Estados de un borrador | `draft`, `published` y `archived` (migración `0053`, `seo_drafts`). No hay estado de revisión | Medido |
| Bloqueo por marcas `[VERIFICAR]` y por menos de 400 palabras | Solo en el navegador: `isPublishReady` se usa en `Step3Article.tsx`. La acción del servidor `publishPost` no lo comprueba | **Medido. Es un hueco real:** una llamada directa a la acción publica con marcas sin resolver |
| Aviso a IndexNow | Existe `scripts/indexnow-enviar.mjs`, que por defecto no envía. Nadie lo llama al publicar | Medido |
| Search Console en el código | No existe ningún cliente ni tabla | Medido |
| Cuántas noticias hay publicadas y cómo rinden | Sin datos: vive en la base de producción, que esta SDD no lee | Sin datos |

### 1.6 Documentos que quedaron viejos

- `docs/marketing/seo.md` dice que `WebPageJsonLd` está en `/calculadora` y `/track`. Esas dos rutas
  ya no existen: `next.config.ts` las redirige a `/tarifas` y `/entrar`. Hoy está en `/`,
  `/tarifas`, `/fcl`, `/shipping-mark` y `/puerta-a-puerta`. Medido.
- `docs/marketing/agente-seo-noticias.md` todavía dice «Publicar lo aprueba una persona». La SDD-0611
  lo cambia para `/noticias`. Medido; se corrige al integrar la 0611, no aquí.

## 2. Prioridades

Ordenadas por lo medido. Las tres primeras son la fase B.

| # | Qué | Por qué, con evidencia | Tamaño |
|---|---|---|---|
| **P1** | **Revisión en el servidor** | El único bloqueo de `[VERIFICAR]` vive en el navegador (§1.5). La SDD-0611 no puede publicar nada sola sin un estado de revisión y filtros en el servidor: es su dependencia directa | Una migración, una función de publicar y sus pruebas |
| **P2** | **Search Console entra al Studio** | Sin esos datos no se puede medir nada de lo que importa: posiciones, consultas, páginas que caen, qué no está indexado (§1.2, §1.4, §1.5). La 0611 exige que cada noticia cite la consulta que la justificó | Una cuenta de servicio, un cliente, una tabla y un cron |
| **P3** | **Contenido que falta, medido** | Las 3 ideas aprobadas sin página y las 2 respuestas parciales (§1.3); la frase de prioridad 5 sin página (§1.4) | Textos; los produce la oficina por la 0611 o una persona |
| P4 | Corregir `docs/marketing/seo.md` | Cita dos rutas que ya no existen (§1.6) | Un párrafo |
| P5 | `WebPage` en `/registro` | Es la única de las 5 sin JSON-LD que importa para búsqueda (§1.1) | Una línea |
| P6 | Aviso a IndexNow al publicar | Ya existe el script (§1.5); se engancha en P1 | Va dentro de P1 |

**Lo que no es prioridad, medido:** títulos, descripciones, canónicos y sitemap (§1.1), y las
preguntas del CRM sin responder (§1.3). No se gasta la fase B en eso.

## 3. Diseño

### 3.1 P1 · Revisión en el servidor

Es la fase B de `agente-seo-noticias.md`, con los estados de la SDD-0611 §4.1.

1. **Estado de revisión.** Migración **sin número** sobre `seo_drafts`: el `check` de `status` suma
   el estado de revisión que fija la 0611 (`en_revision`) y los que ella necesite para retener. Los
   nombres exactos los manda la 0611; esta SDD no los inventa.
2. **Publicar en un solo lugar.** `publishPost` sale de
   `app/studio/(app)/marketing/noticias-web/actions.ts` a una función del servidor (propuesta:
   `lib/studio/news/publicar.ts`) que usan la pantalla de Noticias Web y la publicación automática
   de la 0611. Ninguna otra ruta escribe `published: true` en `news_posts`.
3. **El servidor rechaza** si quedan marcas `[VERIFICAR]` o si el texto tiene menos de 400 palabras,
   con el mismo `computeArticleScore` de `lib/news/score.ts`. El navegador sigue mostrando el aviso,
   pero ya no es la única barrera.
4. **Aviso a IndexNow** después de publicar, solo la URL nueva, detrás de un interruptor apagado por
   defecto. Un fallo de IndexNow no deshace la publicación; se anota.
5. **Pruebas que nacen en rojo:** publicar por la acción directa con una marca `[VERIFICAR]`, con
   399 palabras y desde un estado que no es de revisión; las tres se rechazan.

### 3.2 P2 · Search Console en el Studio

Es la fase C de `agente-seo-noticias.md`, adelantada porque P3 y la 0611 la necesitan.

1. **Cuenta de servicio de Google** con lectura de Search Console, solo para la propiedad del sitio.
   **La crea Sam.** La llave va al gestor de secretos del servidor de producción, nunca al
   repositorio ni a la oficina de agentes.
2. **Cliente** en el Studio (propuesta: `lib/studio/search-console/`), solo lectura, con dos
   consultas: rendimiento por fecha, consulta y página; e inspección de URL de las noticias
   recientes.
3. **Tabla de métricas**, en la misma migración sin número o en otra: una fila por día, consulta y
   página, con clics, impresiones, CTR y posición media. Solo agregados de Google, sin datos de
   clientes.
4. **Cron diario**, con el patrón de `app/api/cron/ceo-brief/route.ts`: trae los últimos días y
   reescribe los que Google todavía ajusta.
5. **Banco de temas semanal:** consultas con impresiones, en posición 8 a 30 y sin página que las
   responda, cruzadas con `lib/news/seo-keywords.ts` y con las preguntas del CRM. Es lo que la 0611
   llama «la consulta que justificó el tema».
6. **Salida a la oficina** por la puerta de la SDD-0610, con su mismo transporte. La oficina recibe
   temas y números agregados; no recibe la llave ni puede pedir otro corte.
7. **Privacidad.** Una consulta de búsqueda puede traer el nombre de alguien. Antes de guardar se
   pasa por `revisar-datos-ve`; que Google oculte las consultas muy raras no se da por suficiente.
   Propuesta: no guardar consultas de menos de 5 impresiones en el período, en línea con el umbral
   de la 0610.

### 3.3 P3 · Contenido que falta

No se escribe aquí: es trabajo de la oficina (Experto SEO, Redactor y Revisor) por la puerta de
entrada de la 0611, o de una persona. Esta SDD fija qué y con qué condiciones:

| Tema | Destino | Condición |
|---|---|---|
| Cómo empezar a importar de China con DTD Cargo, de punta a punta | Ampliar la FAQ y una guía en `/noticias` | Respeta las líneas rojas de `lib/news/prompts.ts` |
| Comprar y juntar varios proveedores en un envío | Ampliar la FAQ | Validación de Operaciones, como pide el documento del CRM |
| «Cómo invertir en China» | Guía en `/noticias`, categoría «Importa sin perder plata» | **Esperar a P2:** sin datos no se sabe si alguien lo busca así |
| Precio semanal de un contenedor | Ampliar `/fcl`, no una noticia por semana | Necesita guardar el histórico que hoy se sobrescribe; es otra SDD |
| Guía de rastreo marítimo | `/noticias` | **Bloqueada** mientras el seguimiento del portal esté en construcción: no se promete rastreo |
| Protección de marca en China | `/noticias` | Revisión legal, como pide el documento del CRM |

## 4. Qué no entra

- Escribir los artículos o las respuestas de §3.3.
- Los filtros, el interruptor, el aviso a Sam y el retiro de la publicación automática: son de la
  SDD-0611.
- El transporte de la puerta de salida: es de la SDD-0610.
- Verificación de indexación por noticia y alertas de caída de tráfico: fase E de
  `agente-seo-noticias.md`, cuando P2 tenga unas semanas de datos.
- APIs de palabras clave de pago (decisión de Sam: solo Search Console).
- `sameAs` a Wikidata, Google Business Profile y LinkedIn: necesitan las URL de Sam.

## 5. Dependencias y decisiones de Sam

| Qué | Quién | Estado |
|---|---|---|
| Número y OK nominal de la migración de P1 y P2 | Director General y Sam | Pendiente |
| Crear la cuenta de servicio de Search Console | Sam | Pendiente |
| SDD-0611 integrada, para que P1 use sus estados | Director General | En la PR #389 |
| SDD-0610 integrada, para que P2 use su puerta | Director General | En la PR #388 |
| Descongelar la publicación de la web | Sam | El código llega a producción solo entonces |
| Umbral mínimo de impresiones para guardar una consulta (§3.2, punto 7) | Sam | Propuesta: 5 |

## 6. Allowlist exacta de esta SDD

| Archivo | Cambio |
|---|---|
| `docs/specs/0613-seo-fase-b/spec.md` | Nuevo (esta spec) |
| `docs/specs/README.md` | Índice regenerado con `pnpm docs:index` |
| `.agents/handoffs/sdd-0613-seo-fase-b.md` | Nuevo |

La implementación, cuando se apruebe, tocará como mínimo: la migración sin número,
`app/studio/(app)/marketing/noticias-web/actions.ts`, `lib/studio/news/publicar.ts`,
`lib/news/score.ts` (si hace falta exportar algo), `lib/studio/search-console/`, una ruta
`app/api/cron/seo-*`, sus pruebas y `docs/marketing/seo.md`. Cada pieza con su allowlist en su PR.

## 7. Criterios de aceptación de la implementación

1. Publicar con una marca `[VERIFICAR]`, con menos de 400 palabras o desde un estado que no es de
   revisión se rechaza **en el servidor**, con una prueba por caso.
2. Una sola función escribe `published: true` en `news_posts`.
3. El aviso a IndexNow está apagado por defecto y su fallo no deshace la publicación.
4. La llave de Search Console no aparece en el repositorio, en la oficina ni en ningún log.
5. La tabla de métricas no guarda consultas por debajo del umbral, con una prueba.
6. Cada tema que sale a la oficina lleva su consulta, sus números y la fecha de Search Console.
7. Ninguna posición que se muestre sale de un modelo: siempre de Search Console, con su fecha.

## 8. Validación de esta SDD

`pnpm docs:check` y `pnpm sdd:check`; el resultado está en el handoff. `pnpm verify` no aplica: es
solo documento. Las mediciones de §1 se hicieron con un script de solo lectura que no se versiona;
el handoff dice cómo repetirlas.
