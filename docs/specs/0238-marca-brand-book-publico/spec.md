---
sdd: "0238"
title: "El brand book se comparte con un link y un código"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-08-01
updated: 2026-08-01
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

### 3. Descargas por sección

- `/api/marca/download/[assetId]` — URL firmada de 60 s, `Content-Disposition:
  attachment` siempre (un `.svg` inline sería XSS almacenado en nuestro origen).
  `?preview=1` sólo para rasters, para la miniatura.
- `/api/marca/bundle/[section]` — zip al vuelo de una sección o de `todo`.
  Si algún archivo no se pudo leer, el zip trae un `_FALTANTES.txt` que los
  nombra: el zip viejo (`/interno/marca/d/[bundle]`) **se los comía en silencio**.

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

## Bitácora

- **2026-08-01** — spec + migración 0334 + gate + `/marca` + administración en el
  ERP + consolidación. Un bug de diseño apareció al correr el contrato: con la
  condición ingenua `fallos >= 3`, del tercer fallo en adelante **cada** intento
  volvía a bloquear 5 minutos y el visitante quedaba con un intento por ventana.
  El bloqueo se dispara sólo cuando el fallo cierra un tramo de 3.
