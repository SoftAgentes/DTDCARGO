# Handoff — auditoría técnica de SEO, GEO y AEO del sitio público

Fecha: 2026-11-07. Task ID: `seo-auditoria-tecnica-20261107`.
Owner / sesión escritora: Worker Claude Code `local_suspicious-gates-seo-audit` (claim del harness), encargado por el Subdirector `local_61442abe-3b66-423e-9af4-8008d5457aa3` por orden del Director General. Sin subagentes.

- **Worktree:** `.claude/worktrees/suspicious-gates-9ec92d`. `guard` y `claim` pasaron sobre el árbol limpio.
- **Rama:** `claude/suspicious-gates-9ec92d`, nacida en main `7e75f7708`.
- **SDD:** no se asignó número. Es una auditoría con arreglos técnicos de metadatos, datos estructurados, accesibilidad y `llms.txt`; no cambia comportamiento del Studio. Si el Director General quiere SDD para esto, la asigna él.
- **Estado:** PR en borrador. No fusionada ni publicada. Merge y publicación son del Director General.

## OBJETIVO ORIGINAL

Auditoría técnica **medida** de SEO, GEO y AEO de las páginas públicas de `dtdcargo.com`, en el sitio publicado y en el código, y arreglar en código solo lo que no cambie textos aprobados ni necesite a Sam. Cada arreglo con una prueba que falle antes. Lo demás, como lista de propuestas.

Leído antes de tocar: `AGENTS.md`, skill Worker, `docs/marketing/README.md`, `docs/marketing/seo.md`, SDD-0604 (fase A) y SDD-0613 (fase B, `proposed`). No se tocó nada de lo que la 0613 propone (P1 a P6): `WebPage` en `/registro` (P5) y la corrección de `seo.md` (P4) quedan para ella.

## Cómo se midió

- **Sitio publicado**, 2026-11-07 ~19:20Z, con un script de solo lectura (`fetch` de Node, sin red privada ni credenciales), sobre las 43 URL de `sitemap.xml` más 9 rutas fuera de él (`/cotizador`, `/abrir`, `/entrar`, `/verificar`, `/terminos`, `/tarifas/embed`, `/fcl/embed`, `/email/baja` y una noticia inexistente). Por página: `<title>`, `description`, canónico, `robots`, `hreflang`, `og:*`, `h1`, imágenes y `alt`, cada bloque JSON-LD parseado y sus campos requeridos, nodos con el mismo `@id` en conflicto, y todos los enlaces internos (47 únicos) con su código HTTP.
- **Core Web Vitals:** la API pública de PageSpeed sin llave respondió `Quota exceeded … Queries per day` en las tres primeras llamadas (cuota anónima compartida, agotada). Se midió con la interfaz pública `pagespeed.web.dev` (Lighthouse 13.6.0, Moto G Power emulado con 4G lenta / escritorio emulado). Los datos de campo de CrUX dicen **«No hay datos»** en todas las páginas medidas: el sitio no tiene tráfico suficiente en Chrome para que Google publique INP y LCP reales.
- **Código:** lectura de `app/`, `components/` y `lib/` en `7e75f7708`.
- Los scripts de medición no se versionan; quedan en la nota compartida del Subdirector (ver al final).

## Resultado medido

### Lo que está sano (medido, sin acción)

| Comprobación | Resultado |
|---|---|
| Título por página | 43 de 43 indexables con un solo `<title>`, ninguno duplicado entre indexables. Las 3 repeticiones (portada, `/tarifas/embed`, `/fcl/embed`) son dos páginas `noindex` |
| Descripción | 43 de 43 con una; ninguna duplicada entre indexables |
| Canónico | 43 de 43 indexables, cada una a sí misma. Las `noindex` no lo llevan, correcto |
| `og:title`, `og:url`, `og:image`, `twitter:card` | 43 de 43, sin `og:title` repetidos |
| `sitemap.xml` contra rutas | 43 URL, todas 200. Ninguna página indexable falta. `/cotizador` fuera a propósito (404 con la bandera apagada, SDD-0473) |
| `robots.txt` | 200; 14 rastreadores con nombre y `*`, `Allow: /`, solo `/marca` e `/interno/` cerrados; declara el sitemap |
| `hreflang` | No aplica: el sitio está en un solo idioma (`<html lang="es">`, contenido es-VE). No hay versiones en otro idioma que enlazar |
| `h1` | 42 de 43 indexables con exactamente uno (falta en `/enlaces`, ver propuestas) |
| `alt` | 0 imágenes sin atributo `alt` en 52 páginas. Hay 18 con `alt=""` (portada 8, `/brochure` 8, `/enlaces` 2), y todas son decorativas o miniaturas de un botón que ya tiene `aria-label`: correcto, no se tocan |
| JSON-LD | 0 bloques que no parsean. `BreadcrumbList` sin huecos de posición y con URL absolutas; cada `Question` con su respuesta; `VideoObject` con sus 4 campos requeridos |
| `FAQPage` | En `/faq`, `/puerta-a-puerta`, `/shipping-mark` y las 19 geo-páginas |
| `/llms-full.txt` | 200, `text/plain; charset=utf-8` |
| SEO de Lighthouse | 100 en las 7 páginas medidas, móvil y escritorio (la octava, `/fcl`, no se pudo medir) |

### Defectos encontrados y arreglados en esta PR

| # | Defecto, medido | Antes | Después | Prueba que falló antes |
|---|---|---|---|---|
| 1 | El nodo `WebPage` de `/`, `/tarifas`, `/fcl`, `/puerta-a-puerta` y `/shipping-mark` no tenía `name` ni `description` | `WebPage` sin nombre en 5 páginas | `name` y `description` salen de los mismos `metadata.title` y `metadata.description` de cada página; la portada usa el título y la descripción del layout, movidos a `lib/public/site-meta.ts` para que haya una sola fuente | `__tests__/seo-auditoria-json-ld.test.tsx`: 2 rojos («emite name y description», «todas las páginas que lo usan le pasan name y description») |
| 2 | El `publisher.logo` del `NewsArticle` de `/noticias/[slug]` declaraba 512×512; el archivo mide 741×764 y el `#organization` del layout ya dice 741×764. La misma entidad quedaba con dos medidas para el mismo logo | 512×512 | 741×764, leído de la cabecera del PNG en la prueba | mismo archivo: «width y height del publisher.logo son los del archivo» |
| 3 | `llms.txt` sin enlaces en formato Markdown. Lighthouse 13.6, «Navegación con agentes»: «llms.txt no sigue las recomendaciones… el archivo no contiene ningún vínculo» | 10 URL sueltas | 10 enlaces `- [etiqueta](url)` con la **misma etiqueta**; ningún texto cambió | `__tests__/seo-auditoria-llms-txt.test.ts`: «los enlaces van en formato Markdown» (0 de 10) |
| 4 | El menú móvil cerrado tiene `aria-hidden="true"` y queda fuera de pantalla, pero sus enlaces y su botón seguían en el orden de tabulación. Lighthouse lo marca en Accesibilidad y en «Navegación con agentes» (árbol de accesibilidad mal formado) | foco entra en enlaces invisibles | `inert` mientras está cerrado; abierto, igual que antes | `components/Nav.drawer-inert.test.tsx`: «cerrado: … fuera del orden de tabulación» |

Pruebas de guarda que nacen verdes a propósito y quedan como red: «cada enlace de llms.txt lleva a una ruta que existe», «el logo del layout coincide con el PNG» y «abierto: vuelve a ser interactivo».

Prueba existente actualizada, sin aflojarla: `app/__tests__/sin-promesa-rastreo-restantes.test.tsx` fijaba la línea literal `- Portal del cliente: https://dtdcargo.com/portal`. Ahora fija `- [Portal del cliente](https://dtdcargo.com/portal)`. Lo que protege, que la etiqueta no prometa rastreo, no cambia.

### Core Web Vitals (laboratorio, Lighthouse 13.6, 2026-11-07)

Rendimiento / Accesibilidad / Recomendaciones / SEO, y métricas de laboratorio. Móvil: Moto G Power emulado, 4G lenta. Escritorio: escritorio emulado.

| Página | Disp. | Rend. | Acces. | Recom. | SEO | LCP | TBT | CLS | FCP | SI |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | móvil | 94 | 92 | 92 | 100 | 2,1 s | 40 ms | 0 | 2,1 s | 4,7 s |
| `/` | escritorio | 100 | 96 | 92 | 100 | 0,5 s | 70 ms | 0 | 0,5 s | 0,6 s |
| `/tarifas` | móvil | 96 | 93 | 92 | 100 | 1,7 s | 70 ms | 0 | 1,7 s | 4,3 s |
| `/tarifas` | escritorio | 100 | 97 | 92 | 100 | 0,5 s | 70 ms | 0 | 0,5 s | 0,6 s |
| `/puerta-a-puerta` | móvil | 96 | 93 | 92 | 100 | 1,7 s | 130 ms | 0 | 1,7 s | 3,9 s |
| `/puerta-a-puerta` | escritorio | 100 | 96 | 92 | 100 | 0,5 s | 20 ms | 0 | 0,5 s | 0,5 s |
| `/servicios` | móvil | 93 | 92 | 92 | 100 | 2,3 s | 70 ms | 0 | 2,3 s | 4,6 s |
| `/servicios` | escritorio | 98 | 96 | 92 | 100 | 0,3 s | 130 ms | 0 | 0,3 s | 0,4 s |
| `/faq` ¹ | móvil | 100 | 92 | 92 | 100 | 1,2 s | 0 ms | 0 | 1,2 s | 1,2 s |
| `/faq` ¹ | escritorio | 100 | 96 | 92 | 100 | 0,5 s | 0 ms | 0 | 0,5 s | 0,5 s |
| `/importar-de-china/caracas` | móvil | 98 | 93 | 92 | 100 | 1,7 s | 100 ms | 0 | 1,7 s | 2,7 s |
| `/importar-de-china/caracas` | escritorio | 100 | 96 | 92 | 100 | 0,5 s | 70 ms | 0 | 0,5 s | 0,5 s |
| `/noticias` | móvil | 99 | 92 | 92 | 100 | 1,7 s | 40 ms | 0 | 1,7 s | 1,7 s |
| `/noticias` | escritorio | 94 | 96 | 92 | 100 | 0,5 s | 200 ms | 0 | 0,5 s | 0,5 s |
| `/fcl` | ambos | NO DISPONIBLE | | | | | | | | |

¹ Medida como `/faq?a=1`: PageSpeed no volvía a analizar la URL sin parámetro. Es la misma página; el canónico la devuelve a `/faq`.
`/fcl`: PageSpeed abortó el análisis las tres veces que se pidió (`batchexecute` con `ERR_ABORTED`). Sin medición; no se infiere nada.

Lectura: todo en verde de laboratorio (LCP ≤ 2,3 s en móvil con 4G lenta, CLS 0, TBT ≤ 200 ms). Lo que baja Accesibilidad a 92–93 en móvil es el menú (arreglado aquí) y el contraste del pie (propuesta P-c). «Recomendaciones» 92 en todas por errores de consola, CSP, COOP y Trusted Types: fuera de este encargo.

Datos de campo (CrUX): «No hay datos» en todas. No se puede afirmar nada de INP ni de LCP reales de usuarios.

## Propuestas (no se tocaron)

Cada una dice por qué no entró aquí.

| # | Propuesta | Evidencia | Por qué no la hice |
|---|---|---|---|
| P-a | **Apagar la ofuscación de correos de Cloudflare** (Scrape Shield → Email Address Obfuscation) | Las 45 páginas que muestran el correo enlazan a `/cdn-cgi/l/email-protection`, que responde **404** a quien no ejecuta JavaScript: buscadores y motores de IA no ven el correo y cuentan un enlace roto por página | Es configuración de Cloudflare, fuera del repo. La decide Sam o el Director General |
| P-b | `/enlaces` sin `h1` | Medido: 0 `h1` | El encabezado es un texto visible nuevo, aunque fuera solo para lectores de pantalla, y la página es del handoff Norte de diseño. Pasa por `/ui-check` y por Sam |
| P-c | Contraste del pie de página | Lighthouse: textos `text-white/40` y `text-white/45` sobre `bg-ink` (VENEZUELA, CHINA, ©, Privacidad) y el «DTD» `#7F0F1A` | Es marca y diseño: [BRAND.md](../../BRAND.md) y Norte |
| P-d | Títulos largos | `/fcl` 76 caracteres y `/servicios/puerta-a-puerta` 63 se cortan en el resultado de Google | El título es el texto que se ve en el buscador: cambiarlo es copy, lo aprueba Sam |
| P-e | Descripciones largas | 13 de 43 pasan de 160 caracteres (la mayor, `/tarifas`, 224) | Igual que P-d |
| P-f | `BreadcrumbList` en `/cookies`, `/registro`, `/brochure` | Las únicas indexables sin migas, junto con `/privacidad` y `/enlaces` | Valor bajo; `/registro` se cruza con la P5 de la SDD-0613 y `/privacidad` está fuera de este encargo |
| P-g | `publisher` del `VideoObject` (portada y `/brochure`) redeclara `#organization` como `Organization` | El layout lo declara `LocalBusiness`; con el mismo `@id` la entidad queda con los dos tipos | Cosmético: `LocalBusiness` es subtipo de `Organization` y ningún validador lo marca. Se puede alinear junto con P-f |
| P-h | Enlace de `/enlaces` y de `llms.txt` a `/portal` | `/portal` responde 307 a `/entrar` sin sesión | El destino depende de la sesión a propósito; cambiarlo es decisión de producto |
| P-i | JavaScript sin usar | Lighthouse móvil en la portada: ~265 KiB de JS sin usar, 500 ms de bloqueo por CSS de render | El rendimiento ya está en 94–100; una tanda de rendimiento es otra tarea, con su medición |
| P-j | `/noticias` sin artículos publicados | El sitemap y `/noticias` no tienen ninguna noticia hoy, así que `NewsArticle` y sus migas no se pudieron medir en vivo; se midieron en código | Depende de la SDD-0611 (PR #417) |
| P-k | `inLanguage` del `NewsArticle` es `es`; el del `WebPage` es `es-VE` | Lectura del código | Cosmético; se alinea cuando se toque el `NewsArticle` por la 0611 |

## VALIDACIÓN

En la PC, solo lo tocado, como pidió el encargo. Nada de `verify` ni `build`.

| Comprobación | Resultado |
|---|---|
| Pruebas nuevas contra el código de main (arreglo apartado) | **FALLÓ como se esperaba:** 6 rojos de 18 en 4 archivos |
| Las mismas, con el arreglo | PASÓ |
| Vecinas: `Nav.entrada-unica`, `Nav.cotizador`, `llms-full`, `seo-remates`, `json-ld-escape-contract`, `sitemap-cobertura-contract`, `sin-promesa-rastreo-restantes` | PASÓ (`--maxWorkers=1`) |
| `tsc --noEmit` | PASÓ, exit 0 |
| `eslint` sobre los 14 archivos tocados | PASÓ, exit 0 |
| Mutante del contrato de `WebPage` | Quitar `name` y `description` de `/tarifas` lo pone rojo; archivo restaurado y verificado con `git diff --stat` |
| `pnpm verify`, `next build` | NO EJECUTADO, por orden del encargo: el gate es la CI de GitHub |
| Validador de Google (Rich Results Test) | NO EJECUTADO: requiere la versión publicada con los cambios |

## COMMITS

- `6c81910d0` fix(seo): WebPage con nombre y logo del NewsArticle con sus medidas reales
- `24116ae25` fix(seo): enlaces de llms.txt en formato Markdown
- `56ed32bc2` fix(a11y): menú móvil cerrado fuera del orden de foco
- El commit de este handoff, encima.

## PR / BRANCH

[PR #422](https://github.com/SoftAgentes/DTDCARGO/pull/422), en borrador contra `main`. Rama `claude/suspicious-gates-9ec92d`, publicada con la autorización del encargo. Sin merge con el `main` nuevo (`eef75ebef`): `git merge-tree` lo da limpio, así que no hizo falta.

## PENDIENTES DE ESTA TAREA

- CI de GitHub en verde y revisión independiente.
- Después de publicar (lo decide el Director General): pasar `/`, `/tarifas` y una noticia por el Rich Results Test, y volver a correr PageSpeed para confirmar que «Navegación con agentes» ya no marca `llms.txt` ni el menú.

## FUERA DE ALCANCE DETECTADO

- La cuota anónima diaria de la API de PageSpeed estaba agotada a las ~19:30Z. Para medir con script en el futuro hace falta una llave de API de Google (la crea Sam).
- Impacto documental: `docs/marketing/seo.md` no se actualizó en esta PR para no cruzarse con la P4 de la SDD-0613, que corrige ese mismo documento. Al integrar, conviene sumar a su cronología una línea con esta auditoría.

## HANDOFF AL DIRECTOR

- Revisar la PR en borrador; no hay migraciones, variables de entorno ni datos.
- Los cuatro arreglos cambian solo HTML que no se ve (JSON-LD, atributo `inert`) y el formato de `llms.txt`. Ningún texto visible, precio, plazo ni promesa cambió. `/privacidad` no se tocó.
- Las propuestas P-a (Cloudflare) y P-b a P-e (texto o diseño) necesitan a Sam.
- Knowledge: no se corrió Graphify ni Archify; la PR no toca documentos canónicos más allá de este handoff.
