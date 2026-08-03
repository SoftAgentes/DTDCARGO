---
sdd: "0242"
title: "Las piezas de producto se abren con un segundo código"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-08-03
updated: 2026-08-03
supersedes: null
superseded_by: null
related: ["0238"]
confidencialidad: interno
---

# SDD-0242 · Las piezas de producto se abren con un segundo código

## El problema

SDD-0238 dejó **22 piezas fuera de `/marca`**: el ERP por dentro, la app del
operario, los formularios de inspección, los documentos comerciales y las
maquetas del sitio. La decisión fue correcta —`/marca` es el link que se le pasa
a diseño externo y a la imprenta— pero se implementó como **ausencia**: esas
piezas ni siquiera se subían a Storage.

Consecuencia: **el founder tampoco puede abrirlas.** El Brand Book las enlaza, él
toca el enlace y le sale la página de aviso. La información existe en su disco y
en la entrega de Cloud Design, pero no en el único sitio donde la iría a buscar.

> Pedido del founder (2026-08-03): *"que haya un código o clave extra de
> seguridad para que el administrador —por ejemplo, si yo quisiera abrirlos— sí
> los pueda abrir."*

## La decisión

**Dos códigos, dos capas.** El de marca abre el book; el de producto abre el
resto. La sesión del ERP **no alcanza** para la segunda: la tienen los 57
módulos, y estas piezas son de producto, no de marca. Que sea "segunda capa" y
no "llave alternativa" significa que se exigen **las dos**: para ver el ERP por
dentro hay que haber entrado a `/marca` *y además* teclear el código interno.

| | Código de marca | Código de producto |
|---|---|---|
| Dígitos | 4 a 6 | **6 exactos** |
| Sesión | 30 días (configurable) | **12 horas** |
| También abre con sesión del ERP | Sí | **No** |
| Bloqueo por intentos | 3 → 5 min → 3 → 1 h | igual, **contado aparte** |

Los 6 dígitos y las 12 horas no son simetría rota por descuido: es la capa más
profunda. Bajar el mínimo o alargar la sesión justo acá invertiría el sentido del
pedido. Son 100× más combinaciones por el mismo esfuerzo de tecleo, y una jornada
de trabajo es el horizonte razonable para material operativo.

## Cómo está construido

### La separación de carpetas ES el control de acceso

La alternativa evidente era subir todo junto y que la ruta preguntara
`sePublica()` antes de servir. **Se descartó**: eso deja el permiso en un `if`, y
un `if` que se olvida en un refactor sirve el ERP por dentro a cualquiera con el
código de marca.

En su lugar, el script de subida reparte en dos prefijos de Storage y la ruta no
decide nada:

```
{tenant}/proyecto/…          ← marca. Se consulta siempre.
{tenant}/proyecto-interno/…  ← producto. Se consulta SÓLO con el segundo código.
```

Sin ese código la pieza no está prohibida — **está en una clave que la ruta no
mira nunca**. No hay condición que olvidar. Y el fallo posible queda del lado
seguro: una pieza de marca que cayera en la carpeta interna se vería gateada de
más (bug visible), no expuesta de menos.

Hay un test que lo fija: `SIN el código interno no consulta siquiera la carpeta
de producto`. Si alguien reintroduce el `if`, se cae.

### Lo compartido va al público

El script calcula **dos cierres transitivos**: el público desde el Brand Book
(frenando en cada pieza de producto) y el interno desde esas piezas. Un archivo
que aparece en los dos —el isólogo, las tipografías— **va al público**.

Sin esa regla, el mismo logo viviría en dos claves: una gateada sin razón y las
dos por mantener. Medido sobre el proyecto real, la regla mantiene el conjunto
público idéntico al de antes (183 archivos, 100,2 MB) y el interno queda en
**136 archivos y 3,5 MB** — sólo capturas y PDF que nada más usa producto.

### El desbloqueo vive en la misma ruta

El formulario del código se pinta en la página de aviso, que va **dentro del
`<iframe>` del visor**, y postea a **su propia URL** — no a `/api/marca/…`.

Es por la CSP: `next.config.ts` le da a `/marca/doc/*` la política permisiva
(`frame-ancestors 'self'`), mientras que cualquier cosa bajo `/api/` cae en la
estricta (`'none'`). Bastaría que el navegador evaluara la política sobre la
respuesta intermedia para dejar al visitante frente a la pantalla gris del
documento roto — el mismo fallo que se arregló el 2026-08-02. Posteando a su
propia URL no hay frontera que cruzar.

Responde **303 y no 302** para que recargar no reenvíe el código ni gaste otro
intento del contador.

### El aviso ya puede decir por qué

Antes la página no distinguía "es interna" de "no llegó en el handoff", así que
no afirmaba ningún motivo. Ahora consulta la existencia en la carpeta interna y
sí lo sabe: si la pieza está ahí, ofrece el campo; si no está en ninguna, sigue
sin inventar.

**El campo NO se ofrece siempre** a propósito: sería un oráculo — se probaría un
código cualquiera contra rutas inventadas para averiguar cuáles existen. Que
revele la existencia a quien ya tiene el código de marca no agrega nada: el Brand
Book enlaza estas piezas por nombre.

## Base de datos — migración 0339

- `brand_access.internal_code_hash` — bcrypt. **NULL = no las abre nadie**, que
  es el estado inicial (igual que el de marca: un default en producción sería
  peor que no tener nada).
- `brand_access_attempts.scope` — `public | internal`, default `public` para que
  las filas que ya existen queden donde estaban.
- `verify_brand_access_code(…, p_scope text default 'public')` — se dropea la de
  3 argumentos y se recrea con 4. Las llamadas existentes siguen resolviendo. Se
  generaliza en vez de duplicar: el bloqueo escalonado es lógica de seguridad y
  mantenerla dos veces es como se desincronizan.
- `set_brand_internal_code(p_code)` — RPC aparte, sólo admin del tenant, hashea
  en el servidor. No es un parámetro de `set_brand_access_code` porque esa
  también fija `session_days`, que no aplica acá.

## Fuera de alcance (y por qué)

- **Auditoría D1 del cambio del código interno.** Hereda la misma brecha
  declarada en SDD-0238: queda `updated_by` / `updated_at`, no pasa por
  `executeD1Operation`. Sumarlo al dominio gobernado es un cambio propio.
- **Duración de la sesión interna configurable desde el ERP.** Son 12 h en
  `lib/marca/access.ts`. Una columna sin control en la UI es una perilla que
  nadie encuentra; si hace falta cambiarla, es una línea.
- **Descarga en .zip de las piezas de producto.** El catálogo de `/marca` es de
  marca; esto es el visor.

## Verificación

1. `pnpm test app/marca` — 22 casos, incluidos los cinco de la capa nueva.
2. Aplicar 0339 a producción **con OK del founder nombrando la migración**
   (runbook `docs/runbooks/aplicar-migraciones-prod.md`).
3. Republicar con `pnpm tsx scripts/upload-brand-proyecto.ts "<proyecto>"` — el
   `--dry-run` muestra el reparto antes de subir.
4. Poner el código en Studio › Marketing › HUB de marca › Piezas de producto.
5. En el navegador: abrir una pieza de producto sin el código (debe ofrecer el
   campo), teclear uno errado (debe descontar intentos), teclear el bueno (debe
   abrir el documento dentro del visor).
