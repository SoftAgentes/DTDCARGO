---
sdd: "0238"
title: "El brand book se comparte con un link y un código"
status: done
author: "Sam (founder) + Claude Code"
created: 2026-08-01
updated: 2026-08-02
supersedes: null
superseded_by: null
related: ["0119", "0121", "0158"]
confidencialidad: interno
---

# SDD-0238 · El brand book se comparte con un link y un código

## Decisión

`/marca` pasa a ser **la** puerta del centro de marca: una sola URL que el founder
le manda a un diseñador externo, protegida con un código de 4 a 6 dígitos que él
mismo pone desde el ERP. Adentro, el brand book navegable y **cada sección con su
propia descarga**. El contenido descargable sale de una tabla + Supabase Storage,
no de constantes en el código.

## Problema

Antes de esto la marca vivía en **tres sitios desconectados y ninguno compartible**:

| Superficie | Qué era |
|---|---|
| `/marca/brand-book` | Visor del standalone (14,2 MB). Exigía sesión del ERP. Una sola descarga: el HTML entero. |
| `/interno/marca` | El hub rico (logos, paleta, tipografía, zips). También sesión del ERP. |
| `/studio/marketing/hub` | 4 PNG hardcodeados en el `.tsx` + tres tarjetas "Próximamente" sin contenido. |

El catálogo descargable completo eran **6 archivos**, todos en git. Un diseñador
externo no podía entrar a ninguna de las tres, y agregar una plantilla exigía un
commit y un deploy — por eso las tarjetas "Próximamente" llevaban meses vacías.

## Alcance

### 1. Un catálogo, no constantes

Migración **0334**: `brand_sections` · `brand_assets` · `brand_access` ·
`brand_access_attempts`, más el bucket privado `brand-assets` (200 MB por
archivo, MIME amplio: PNG/SVG/PDF/AI/fuentes/zip — el objetivo es que el
diseñador **no tenga que pedir nada**, sea cual sea su herramienta).

Las secciones son **datos**: agregar "Iconografía" no es un deploy.

### 2. El código de acceso

- 4 a 6 dígitos, guardado **sólo como bcrypt**. No se puede ver, sólo reemplazar.
- **Bloqueo escalonado** (regla del founder, 01-ago-2026): 3 fallos → 5 minutos ·
  3 fallos más → 1 hora, y de ahí en adelante 1 hora.
- La cuenta y la escala viven en la RPC `verify_brand_access_code`, no en
  TypeScript: si estuvieran en el cliente, otro camino a la RPC las saltaría.
- **No se guarda la IP.** Lo que va a la DB es un SHA-256 de la IP salada con el
  secreto del servidor — cuenta intentos sin volver el brand book un registro de
  direcciones (mismo patrón que `operario_pin_attempts`, SDD-0235).
- **Fail-closed**: si falta el secreto o la RPC falla, no abre. Es lo contrario
  del throttle de `/verificar` (fail-open a propósito) porque acá el mecanismo
  **es** el control de acceso.
- **Dos llaves, una puerta**: la sesión del ERP también entra, sin código.

### 3. Descargas — tres caminos

- `/api/marca/download/[assetId]` — URL firmada de 60 s, `Content-Disposition:
  attachment` siempre (un `.svg` inline sería XSS almacenado en nuestro origen).
  `?preview=1` sólo para rasters, para la miniatura.
- `/api/marca/bundle/[section]` — zip de una sección o de `todo`.
- `/api/marca/seleccion?ids=…` — **zip de lo que el visitante marcó**. Es el
  "escoge qué quiere bajar" del encargo.

Los tres comparten el armado (`lib/marca/zip.ts`). Si algún archivo no se pudo
leer, el zip trae un `_FALTANTES.txt` que los nombra: el zip viejo
(`/interno/marca/d/[bundle]`) **se los comía en silencio**.

### 4. Administración en el ERP

`/studio/marketing/hub` deja de ser 4 PNG y pasa a administrar el catálogo:
subir/quitar archivos por sección, poner el código y copiar el link listo para
mandar.

### 5. Consolidación

- `/interno/marca` → **redirect 308** a `/marca` (hay links guardados del equipo).
  Sus herramientas (`whatsapp`, `enlaces`) suben al índice de `/interno`, que era
  su única puerta de entrada.
- `app/marca/**` sale de la allowlist de la frontera público↔ERP, **documentado**.
  Ya la violaba de forma transitiva (`lib/auth/session` → `lib/db/server`) y el
  lint sólo mira imports directos.
- La **CSP permisiva se acota** a `/marca/asset/*` (el standalone, que no
  controlamos). El catálogo y el visor pasan a la CSP estricta del sitio — antes
  todo `/marca/*` heredaba `unsafe-eval` sin necesitarlo.
- `robots.ts`: `/marca` sin barra final (el match es por prefijo; `/marca/`
  dejaba fuera justamente la página que se comparte).
- El sellado AES-GCM del token de baja se extrajo a `lib/shared/signed-token.ts`
  para que el gate lo reuse sin cruzar la frontera. **Formato intacto**: los links
  de unsubscribe ya enviados siguen abriendo (verificado por sus tests).

## Fuera de alcance (y por qué)

- **Auditoría D1 del cambio de código.** Cambiar el código NO pasa por
  `executeD1Operation`: sumar una operación al dominio gobernado D1 exige migración
  del dispatcher + sus contratos + registro de gobernanza, y es un cambio propio.
  Mientras tanto queda registrado **quién y cuándo** en `brand_access.updated_by /
  updated_at`, visible en el panel. **Es una brecha conocida, no un olvido.**
- **CRUD de secciones.** Las 8 sembradas cubren el material actual.
- **Reordenar assets desde la UI.** `sort_order` existe en la tabla; el control
  visual no.

## Bloqueo de contenido

⚠️ **El Brand Book v5 no está en el repo.** El vigente es **v4.6** (2026-07-10 +
patch del 19-jul, que dice explícito que el book físico no se regeneró). El v5
sigue en Cloud Design. Todo lo de arriba es **agnóstico de versión**: cuando
llegue, se reemplaza el HTML en `private/marca/` y las dos constantes de
`lib/marca/brand-book.ts`, y nada más.

⚠️ **El catálogo nace vacío y el acceso nace CERRADO** (`code_hash` NULL). Que un
código por default llegara a producción sería peor que no tener ninguno. El
founder pone el suyo desde Studio › Marketing › HUB de marca.

## Verificación

- `supabase/tests/0334_brand_catalog_public_gate.test.sql` — 13 bloques: el
  escalado 3→5min→3→1h (incluida la assert de que tras la espera vuelven **tres**
  intentos, no uno), que el acierto limpia el historial, que el bloqueo es por
  huella y no global, que "sin código puesto" no se distingue de "código errado",
  aislamiento multi-tenant del FK compuesto, y que `anon` no ejecuta la RPC ni lee
  los intentos.
- `app/marca/asset/[name]/__tests__/route.test.ts` — los dos niveles de acceso:
  el brand book se abre con el código; las herramientas de WhatsApp **no** (son
  operativas del equipo, no material de marca).
- `lib/shared/__tests__/signed-token.test.ts` — round-trip, token opaco, y que un
  token sellado para un propósito no abre con otro AAD.

## Rediseño de la experiencia (2026-08-01, misma jornada)

Revisado el resultado con el founder, la primera versión **no cumplía la parte
central del encargo**: "el usuario lo puede leer, **escoge qué quiere bajar** y
lo descarga". Había descarga de a uno y de sección completa, y nada en el medio.
Ocho cambios, todos aprobados:

| # | Cambio | Cómo estaba | Por qué |
|---|---|---|---|
| 1 | **Selección múltiple** + barra flotante con conteo y peso | sólo de a uno o sección entera | quien quería 3 cosas de 3 secciones bajaba 3 paquetes |
| 2 | El zip de sección sube al **encabezado** | al final de la grilla | con 30 archivos hay que recorrer todo para descubrir que existe |
| 3 | El vacío se lee como **promesa** | "Todavía no hay archivos cargados" | 3 de 8 secciones están vacías; el founder pidió **mostrarlas** (mapa completo), no esconderlas |
| 4 | **Buscador** en vivo, insensible a acentos | no había | a 60 archivos, sin filtro vuelven a pedir por WhatsApp |
| 5 | Ficha con **dimensiones** y fondo real (migr **0335**) | `PNG · 38 KB` | ver abajo — arregla un bug |
| 6 | Brand Book como **tarjeta**, no iframe | `<iframe>` de 13,5 MB en la primera sección | en el teléfono el scroll se peleaba entre iframe y página |
| 7 | **"Preparando…"** en los zip | click y silencio | el zip se arma al vuelo; sin señal la gente clickea dos veces |
| 8 | Encabezado **compacto** con el dato útil | titular a pantalla casi completa | quien abre el link ya sabe qué es: se lo dijeron con el código |

**El bug que arregla el 5.** El fondo de la miniatura lo decidía una **expresión
regular sobre el nombre del archivo** (`/revers|mono-light|inverso/`). Un archivo
llamado "Marca en negativo.png" no matchea → el logo blanco se pinta sobre papel
blanco y el diseñador ve un recuadro vacío. Adivinar por el nombre no es un
mecanismo. La migración 0335 agrega `tile` (`auto | light | dark | checker`),
elegible al subir, y `width`/`height`. `tile = 'auto'` conserva la heurística
para las filas viejas, así que nada cambia de golpe.

## Bitácora

- **2026-08-01** — spec + migración 0334 + gate + `/marca` + administración en el
  ERP + consolidación. Un bug de diseño apareció al correr el contrato: con la
  condición ingenua `fallos >= 3`, del tercer fallo en adelante **cada** intento
  volvía a bloquear 5 minutos y el visitante quedaba con un intento por ventana.
  El bloqueo se dispara sólo cuando el fallo cierra un tramo de 3.
- **2026-08-01** — 0334 aplicada a prod (OK del founder nombrándola), verificada
  contra el objeto; catálogo sembrado con 9 archivos; publicado en `main`.
- **2026-08-01** — rediseño de los 8 puntos de arriba + migración **0335**.
  El sembrador pasó a **actualizar** las filas que ya existen y no sólo saltarlas:
  si no, las 9 sembradas antes de 0335 se quedaban para siempre en `tile='auto'`
  y sin dimensiones — habría saltado en silencio y el logo claro habría seguido
  invisible sobre papel blanco.
- **2026-08-02** — el Brand Book **sale de git a Storage** (founder). El v4.6
  pesaba 13,5 MB versionados y el v5 son tres documentos que suman 51 MB: en git
  eso se acumula versión tras versión y encima `outputFileTracingIncludes` lo
  arrastraba a dos bundles de función. El visor pasa a leer del bucket y
  **transmite** el cuerpo en vez de redirigir a la URL firmada — un redirect
  mandaría el `<iframe>` a `*.supabase.co` y la CSP del visor no declara
  `frame-src`, así que caería a `default-src 'self'` y abriría en blanco.
- **2026-08-02** — el **Manual de Producción** llegó sin build autocontenido (60
  referencias a archivos vecinos) y Cloud Design no podía generarlo: chocaban
  contra un tope de 30 MB. Se armó acá. Los 45,67 MB de PNG eran fotografías
  guardadas en formato de gráficos planos; recodificadas a **WebP a la misma
  resolución** quedaron en 2,3 MB, sin reescalar un píxel. Su plan alternativo
  (JPEG q88) habría **destruido el canal alfa de 29 de las 32 imágenes**. PSNR
  peor caso 34,0 dB compuesto sobre los dos fondos reales del documento.
- **2026-08-02** — el secundario "Descargar" de la tarjeta del book era **navy
  sobre navy: contraste 1.00**, medido en navegador. La causa no estaba en el
  JSX: `app/globals.css` va SIN `@layer`, y una regla sin capa le gana a
  cualquier utilidad de Tailwind, así que el `bg-white` **nunca se aplicó**. Se
  agregaron `.btn-ghost-inv` (16,49:1) y `.btn-ghost-solid` al sistema. Ningún
  gate lo veía: typecheck, lint, tests y build pasan con el botón invisible.
- **2026-08-02** — "Salir" no hacía nada **para el equipo**. `hasBrandAccess()`
  abre con dos llaves (cookie del código **o** sesión del ERP) y el botón sólo
  borra la cookie: quien entra con su sesión del Studio volvía a pasar el gate al
  instante. Ahora la cabecera consulta `brandAccessSource()` y ofrece "Salir"
  sólo a quien entró con el código; al resto, el atajo al HUB. El código **no se
  puede mostrar en ningún lado** — se guarda hasheado y nunca en claro.
- **2026-08-02** — catálogo cargado con el material del v5: **de 11 a 99
  archivos · 127 MB** (tope del paquete "todo": 180 MB). Quedan vacías **Color**
  (correcto: la paleta se dibuja en vivo desde los tokens) y **Fondos** (depende
  de las portadas por red). **SDD cerrada.**
