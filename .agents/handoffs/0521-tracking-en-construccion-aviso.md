# Handoff · SDD-0521 · Tracking en construcción: «Te avisaremos apenas esté activo» y textos públicos sin promesa de rastreo

| Campo | Valor |
|---|---|
| Fecha | 2026-10-14, Caracas 23:26 a 00:10 aprox. (UTC 2026-10-15 03:26 a 04:10) |
| Task ID / owner | `tracking-en-construccion-aviso` / subagente Worker del Director |
| Claim del harness | `worker-sdd-0521-tracking-aviso` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a325bd44bd89eca80` |
| Rama | `codex/tracking-en-construccion-aviso` (creada con `git switch --no-track -c` desde `origin/main`) |
| Base | `origin/main` `530a3158` (merge de la #219) |
| SDD | [0521](../../docs/specs/0521-tracking-en-construccion-aviso/spec.md), `in-progress`. Reserva local `codex/sdd-reserve-0521-tracking-en-construccion-aviso` (`6ba40093`), sin push; el número coincide con el que dio el Director. |
| Estado de la tarea | lista para revisión |
| Permisos | commits selectivos, push de la rama propia y PR contra `main`. Sin merge, sin rebase, sin force push, sin producción ni base de datos. `pnpm verify` completo no autorizado (otra sesión usa las pruebas). |

## Objetivo

Pedido de Sam sobre el seguimiento del Portal: «me gustaría que al cliente le
diga: "Esto está en construcción, pronto le avisaremos", para que sepa que
todavía está en construcción.» Y después de la propuesta del Director: «sí,
agrega «Te avisaremos apenas esté activo» y corrige los textos públicos».

1. Agregar «Te avisaremos apenas esté activo.» al aviso del Portal.
2. Con `TRACKING_EN_CONSTRUCCION` encendido, que la web pública no prometa
   rastreo, conservando destinos; apagado, los textos de siempre.
3. Corregir siempre el texto vencido de la 404.

## Qué se hizo

- **Portal.** `PortalTrackingEnConstruccion.tsx` lleva la frase después de «Muy
  pronto vas a ver aquí cada paso de tu carga.». Sus pruebas fijan el párrafo
  entero y que cada pantalla la trae.
- **Web pública, nueve superficies.** Tres las nombró el Director (pie,
  `/enlaces`, 404). Las otras seis salieron del barrido: Actualidad,
  `/verificar`, `/brochure`, `/shipping-mark` y tres lugares de `/pre-alertas`.
  Todas leen el mismo interruptor.
- **Interruptor.** Comentario de `lib/portal/tracking-en-construccion.ts` y
  `significa` de `scripts/feature-constants.json` con los lugares nuevos.
  Incluyen también la ficha de pre-alerta de la 0519, que esa tarea dejó como
  propuesta para no cruzarse con la #215. `value` sigue en `true`.
- **Docs.** Spec 0521, índice regenerado y una viñeta fechada en
  `docs/marketing/README.md`, en «Contenido / Captación de leads», debajo de la
  línea del Portal.

**Alcance ampliado dentro del encargo, a revisar.** El encargo pedía corregir lo
que el barrido encontrara si prometía rastreo activo. Seis lugares cumplían eso.
Se corrigieron con el mismo interruptor y con textos que dicen lo que pasa hoy
(«nuestro equipo sigue tu carga»). Si alguno no le convence a Sam, se cambia sin
tocar el resto.

### Textos (viejo → nuevo)

| Archivo | Lugar | Apagado (de siempre) | Encendido |
|---|---|---|---|
| `app/portal/_components/PortalTrackingEnConstruccion.tsx` | Aviso del Portal | … Muy pronto vas a ver aquí cada paso de tu carga. Tus pre-alertas quedan guardadas y nuestro equipo las recibe. | … Muy pronto vas a ver aquí cada paso de tu carga. **Te avisaremos apenas esté activo.** Tus pre-alertas quedan guardadas y nuestro equipo las recibe. (el aviso sólo existe encendido) |
| `components/Footer.tsx` | «Enlaces rápidos» → `/entrar` | Rastrea tu envío | Seguimiento en construcción |
| `app/enlaces/page.tsx` | Tarjeta → `/entrar` | Rastrear mi embarque · Sigue tu carga en tiempo real | Seguimiento en construcción · Te avisaremos apenas esté activo |
| `app/enlaces/page.tsx` | `description` | … cotiza por WhatsApp, calcula tu envío, rastrea tu carga y entra a tu portal. China → Venezuela, con Confianza. | … cotiza por WhatsApp, calcula tu envío y entra a tu portal. China → Venezuela, con Confianza. |
| `app/enlaces/page.tsx` | Open Graph y Twitter | Cotiza por WhatsApp, calcula tu envío, rastrea tu carga y entra a tu portal. | Cotiza por WhatsApp, calcula tu envío y entra a tu portal. |
| `app/not-found.tsx` | Texto (**siempre**) | No encontramos la página que buscas. Vuelve al inicio o usa el buscador de tracking en la home. | No encontramos la página que buscas. Vuelve al inicio o entra a tu portal. |
| `app/not-found.tsx` | Botón → `/entrar` | Rastrear envío | Entrar a mi portal |
| `app/noticias/_components/ActualidadHub.tsx` | «También puedes:» → `/entrar` | Rastrear un envío | Entrar a mi portal |
| `app/verificar/page.tsx` | Botón → `/entrar` | Rastrear un envío | Entrar a mi portal |
| `lib/design-tokens.ts` + `components/Philosophy.tsx` | `/brochure`, tarjeta TRAZABILIDAD | Tracking etapa por etapa · Sigue tu carga desde la recepción en China hasta la entrega final en Venezuela. | Acompañamiento etapa por etapa · Nuestro equipo sigue tu carga desde la recepción en China hasta la entrega final en Venezuela. |
| `components/ShippingMark.tsx` | `/shipping-mark`, paso 06 | Consolidamos y rastreas · Se consolida con el resto de tu carga y empieza a verse en tu tracking, etapa por etapa. | La consolidamos · Se consolida con el resto de tu carga y nuestro equipo la sigue etapa por etapa. |
| `app/pre-alertas/page.tsx` | Descripción (metadatos, OG, Twitter, JSON-LD `Service`) | … define la modalidad de envío y sigue cada paso con tu Shipping Mark, desde la bodega en Yiwu hasta tu puerta en Venezuela. | … define la modalidad de envío y tu Shipping Mark la identifica desde la bodega en Yiwu hasta tu puerta en Venezuela. |
| `app/pre-alertas/page.tsx` | Entrada del hero | … la revisa y la consolida — tú sigues cada paso desde el portal. | … la revisa y la consolida. Te acompañamos hasta tu puerta. |
| `app/pre-alertas/page.tsx` | Bloque «Tu carga, siempre identificada», beneficio 2 | Seguimiento de punta a punta desde el portal | Nuestro equipo la sigue de punta a punta |

Decisiones de forma (detalle en la spec):

- **Sin nombres repetidos.** El pie ya tiene «Mi portal» → `/entrar` en
  Explora y `/enlaces` ya tiene «Portal del Cliente» → `/portal`. Por eso el
  enlace del pie y la tarjeta no se renombran así.
- **La tarjeta de `/brochure`** guarda las dos versiones en
  `lib/design-tokens.ts` (campo `enConstruccion`), que sigue sin imports. La
  elige `Philosophy.tsx`.
- **El interruptor se importa desde `lib/portal`**, como en la 0517 y la 0519.
  El lint de los archivos tocados sale limpio. La prueba de la 0519 vigila que
  el módulo no tenga imports.

### La 0516 y la frase nueva

El criterio 1 de la 0516 prohibía «Te avisaremos» en todo el detalle de una
compra sin recepciones, y ese detalle muestra el aviso. La prueba de la 0516
ahora admite la frase aprobada una sola vez y sólo dentro del aviso; cualquier
otra promesa la sigue tumbando (mutante M3). No edité la spec 0516, que está en
`done`: la precisión queda en la spec 0521 («Relación con la 0516»). El
Director decide si quiere anotarla también allá.

## VALIDACIÓN

Todo sobre el árbol de la rama, base `530a3158`.

| Comprobación | Estado y evidencia |
|---|---|
| Pruebas nuevas y del aviso (`components/sin-promesa-rastreo.test.tsx`, `app/__tests__/sin-promesa-rastreo.test.tsx`, `PortalTrackingEnConstruccion.test.tsx`, `compras/[code]/page.test.tsx`) | PASÓ: «Tests 38 passed (38)» en 4 archivos. |
| Control rojo: esas 4 pruebas contra los 10 fuentes de `origin/main` (escritos con `git show`, sin tocar el índice; restaurados y comparados por sha256) | PASÓ como control: «Tests 18 failed \| 20 passed (38)». Caen todos los casos «prendido», la 404 apagada (su texto se corrige siempre), la variante de `design-tokens` y la presencia de la frase en el Portal. Pasan los «apagado» y los que miden lo que no cambia (destinos, nombres únicos, las otras tarjetas y pasos). |
| Mutantes (19, reemplazo exacto con una sola aparición, archivo restaurado y comprobado byte a byte) | PASÓ: 19/19 muertos, cada uno en el caso que le toca. Control verde «Tests 38 passed (38)» antes y después. M1 cambia la frase → 7 failed. M2 la frase al final del párrafo → 1 failed (párrafo exacto). M3 la frase repetida en el aviso → 1 failed (excepción de la 0516). M4 pie ignora el interruptor → 1. M5 pie renombrado «Mi portal» → 2 (nombres únicos). M6 subtítulo de `/enlaces` fijo → 1. M7 tarjeta «Portal del Cliente» repetida → 2. M8 OG/Twitter con «rastrea» → 1. M9 descripción invertida → 2. M10 404 con el buscador → 2 (los dos casos). M11 botón 404 fijo → 1. M12 Actualidad fijo → 1. M13 `/verificar` fijo → 1. M14 variante de `/brochure` sin interruptor → 1. M15 variante con «Sigue tu carga» → 2. M16 paso 06 invertido → 2. M17 descripción de `/pre-alertas` fija → 1. M18 entrada fija → 1. M19 beneficio fijo → 1. |
| Focalizadas y vecinas: las 4 de arriba más `(app)/page.test.tsx` (0516), `PortalAlertasHub.test.tsx`, `hub-fichas-sin-promesa-bodega.test.tsx` y `hub-fichas.test.tsx` (0519), `register-sin-promesa-bodega.test.tsx` (0517), `Footer.cotizador.test.tsx`, `importar-de-china/[ciudad]/page.test.tsx`, `seo-remates.test.ts`, `design-tokens.test.ts`, `glosario-enlaces.test.ts`, `json-ld-escape-contract.test.ts`, `sitemap-cobertura-contract.test.ts` | PASÓ: «Test Files 16 passed (16)», «Tests 121 passed (121)». |
| `corepack pnpm typecheck` | PASÓ (exit 0; «[tipos-de-ruta] sanos — nada que podar»). |
| ESLint de los 15 archivos tocados (código y pruebas) | PASÓ (exit 0, sin salida). Incluye los de la frontera pública (`components/`, `app/enlaces`, `app/noticias`, `app/pre-alertas`). |
| `node scripts/check-feature-constants.mjs` | PASÓ: «feature-constants: 6 bandera(s) coinciden con lo declarado». |
| Prueba del verificador (`scripts/check-feature-constants.test.mjs`) | PASÓ: «Tests 9 passed (9)». |
| `node scripts/build-docs-index.mjs --check` | PASÓ: «índice sincronizado con 507 specs». |
| `node scripts/check-numbering.mjs` | PASÓ: «numbering: sin números repetidos» (con los choques históricos ya conocidos en ⏸). |
| `git diff --check` | PASÓ. |
| `pnpm verify` completo | NO EJECUTADO: el Director no asignó turno de corrida pesada porque otra sesión trabaja con las pruebas. El CI de la PR es la evidencia de la suite completa. |
| `/ui-check` | NO EJECUTADO: sólo cambia texto, sin elementos, clases, colores ni tamaños nuevos. Los textos nuevos tienen largo parecido a los viejos. No se midieron en pantalla. |
| `pnpm knowledge:status` | Corrido: `ok: false` en el worktree. Graphify `INVALID` (el worktree no tiene `graphify-out`), Archify `PENDING` (`ARCHIFY_RUNTIME_MISSING`), Obsidian `PENDING`. Es lo esperado fuera de main. |

## COMMITS

- `cde8f599` feat(portal): SDD-0521 — aviso de seguimiento: «Te avisaremos apenas esté activo».
- `02378e2c` feat(web): SDD-0521 — textos públicos sin promesa de rastreo mientras el seguimiento está en construcción.
- El commit que contiene este documento: spec, índice, viñeta de marketing y handoff.

## PR / BRANCH

Rama `codex/tracking-en-construccion-aviso` contra `main`; el número y la URL
de la PR van en la propia PR y en el reporte al Director.

## Impacto documental

- Documento canónico nuevo: la spec 0521.
- `docs/marketing/README.md`: una viñeta. Es fuente del piloto semántico: el
  recibo semántico lo renueva el Director después del merge. Aquí no se tocó.
- No cambian `BRAND.md`, el Norte ni los runbooks.
- Graphify: entran 2 pruebas nuevas y 8 aristas de import nuevas hacia
  `lib/portal/tracking-en-construccion.ts` (Footer, enlaces, not-found,
  ActualidadHub, verificar, Philosophy, ShippingMark, pre-alertas). Pendiente:
  actualización estructural desde main integrado, a cargo del Director.
- Obsidian: nada que revisar fuera de la publicación habitual desde main.

## PENDIENTES DE ESTA TAREA

- CI de la PR en verde (suite completa).
- Smoke de Sam en producción después del merge (guion en la PR): Portal
  (portada, Envíos y «Seguimiento total»), `/enlaces`, el pie de cualquier
  página y una URL inexistente para la 404.
- Pasar la spec a `done` cuando el smoke pase.

## FUERA DE ALCANCE DETECTADO

Todos siguen prometiendo seguimiento en el Portal o describen un rastreo que hoy
no existe. No se tocaron por ser dudosos, por depender de otra regla o por
estar fuera del encargo.

- **FAQ de rastreo** (`lib/faqs.ts:249` «portal de seguimiento», `:332` «ves tus
  envíos y pre-alertas paso a paso», `:338` «ves en qué etapa va cada uno de tus
  envíos», `:351` «ves los eventos de cada envío en vivo», `:358` «Para seguir
  tu envío con DTD entra a tu portal»). Alimentan `/faq` y su JSON-LD. La regla
  de coherencia de la SDD-0063/0064 exige que coincidan con la base de
  conocimiento de Kommo
  (`docs/specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md`).
  Cambiarlas exige cambiar las dos y volver a subir el DOCX a Kommo.
- **Glosario** (`lib/design-tokens.ts:783`, DTDU: «donde sigues el estado en
  tiempo real»; `:750`, POD: «En el portal de tracking, el POD aparece como el
  último evento»). Es un texto que explica conceptos (`/glosario`).
- **«Tracking del envío»** en la tabla «Incluye» de
  `components/PuertaAPuerta.tsx:17`: es la tabla de transparencia de la SDD-0064,
  que también lee la IA de Kommo.
- **`/entrar`** (`app/entrar/EntrarForm.tsx:21` «Seguimiento por compra y
  contenedor» y `:30` «Seguimiento hasta tu puerta»): el login quedó fuera del
  encargo. Propuesta, no decisión: con el interruptor encendido, «Tus compras y
  pre-alertas en un solo lugar» y «Acompañamiento hasta tu puerta».
- **`public/llms.txt:52`** «Rastrear envío (dentro del portal del cliente)»: es
  estático y no puede seguir al interruptor. Propuesta: «Portal del cliente».
- **`public/portal/manifest.json:5`** «sigue tus envíos»: es la PWA del Portal,
  no la web pública.
- **Política de privacidad** (`app/privacidad/page.tsx:60` «El código de rastreo
  que introduces para consultar el estado de tu carga»): describe la consulta
  pública por código, que ya no existe. Es texto legal: decide Sam.
- **Panel de ejemplo del hero de `/pre-alertas`** (`app/pre-alertas/page.tsx:181-182`,
  «En bodega Yiwu · Recibida e inspeccionada con fotos»): es una ilustración con
  `aria-label` de ejemplo. La 0519 ya lo anotó.
- **«Ves el estado de tu compra en todo momento.»**
  (`components/servicios/hub-fichas.tsx:923`): ya anotado por la 0519 con su
  propuesta («Tu compra queda registrada en tu portal desde el primer día.»).
  Cambiarlo exige ampliar la prueba de la 0519, que fija que el resto de la
  ficha no cambia con el interruptor.
- **«Rastrear mi carga»** como motivo del formulario de contacto
  (`components/ContactoForm.tsx:27`): no se cambió porque es un motivo para
  escribirle al equipo, que hoy es el canal correcto. Se anota por si Sam lo
  quiere distinto.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR, en especial el alcance ampliado (seis
  lugares del barrido) y los textos nuevos. Esperar el CI y, si Sam lo
  autoriza, fusionar.
- **Cambios compartidos:** `lib/design-tokens.ts` (sólo la tarjeta TRAZABILIDAD
  de `PHILOSOPHY`), `components/Footer.tsx` (todas las páginas públicas) y el
  comentario del interruptor. El `significa` de `feature-constants.json` lo
  vuelve a tocar cualquier tarea futura sobre el interruptor.
- **Después del merge:** renovar el recibo semántico de
  `docs/marketing/README.md` y actualizar Graphify desde main.
- **Sesiones consumidoras:** ninguna.
- **Ownership:** se libera el claim al terminar la escritura y la publicación.
  No se borran ni el worktree ni la rama.
