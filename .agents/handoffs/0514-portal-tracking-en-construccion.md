# Handoff · SDD-0514 · Portal: aviso de seguimiento en construcción

| Campo | Valor |
|---|---|
| Fecha | 2026-10-14 (UTC 17:30 a 18:20 aprox.; Caracas 13:30 a 14:20) |
| Task ID / owner | `portal-tracking-en-construccion` / subagente Worker del Director (sesión «Revisión de tareas en progreso») |
| Claim del harness | `portal-tracking-en-construccion-worker` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a00f97b838bf0b595` |
| Rama | `codex/portal-tracking-en-construccion` |
| Base | `origin/main` `9a935562` (la rama nació en `1ce2ba99` y se adelantó por fast-forward antes del primer commit, cuando entró SDD-0512) |
| SDD | [0514](../../docs/specs/0514-portal-tracking-en-construccion/spec.md), `in-progress` (la asignó el Director) |
| Estado de la tarea | lista para revisión (PR en draft) |
| Permisos | commits locales selectivos, push de la rama propia y PR en draft contra main. Sin merge, sin producción, sin VPS, sin base de datos. |

## Objetivo

Que el Portal le diga al cliente que el seguimiento de su mercancía y el tracking
están en construcción y pronto estarán disponibles. Hoy la bodega de China
registra en Excel: lo que sigue a la pre-alerta sale vacío y el cliente cree que
el Portal «no funciona».

## Qué se hizo

- `lib/portal/tracking-en-construccion.ts`: el interruptor
  `TRACKING_EN_CONSTRUCCION`, hoy `true`. Es una constante y no una variable de
  entorno porque la web se muda de Vercel al VPS el 2026-10-15.
- `app/portal/_components/PortalTrackingEnConstruccion.tsx`: el aviso. Sólo él lee
  el interruptor; con `false` devuelve `null`.
- El aviso en cinco vistas de cuatro pantallas:
  - portada (`PortalDashboardNorte`), después del saludo y antes del próximo arribo;
  - Envíos, lista (`PortalAlertasHub`), debajo del encabezado;
  - Envíos, «Seguimiento total» (`PortalAlertasHub`), debajo de la introducción;
  - detalle de un envío (`PortalShipmentDetailNorte`), arriba del stepper;
  - detalle de una compra (`compras/[code]/page.tsx`), arriba del estado de llegada.
- `scripts/feature-constants.json`: la bandera declarada, como pide el gate
  `feature-constants` para toda constante que cambia lo que ve el cliente.
- Pruebas nuevas: `app/portal/_components/__tests__/PortalTrackingEnConstruccion.test.tsx`
  (10 casos) y `app/portal/(app)/compras/[code]/page.test.tsx` (3 casos).
- Spec, índice regenerado y tres capturas en
  `docs/specs/0514-portal-tracking-en-construccion/assets/`.

Copy final: título «Seguimiento en construcción»; texto «Estamos activando el
registro de tu mercancía en nuestra bodega de China. Muy pronto vas a ver aquí
cada paso de tu carga. Tus pre-alertas quedan guardadas y nuestro equipo las
recibe.»; enlace «¿Dudas? Escríbenos en Soporte» a `/portal/soporte`. Los ajustes
sobre el copy de partida y sus razones están en la spec.

### Cómo se apaga

1. En `lib/portal/tracking-en-construccion.ts`, cambia `true` por `false`.
2. En el mismo commit, cambia `"value": true` por `false` en la entrada
   `TRACKING_EN_CONSTRUCCION` de `scripts/feature-constants.json`.

El paso 2 no cambia el comportamiento. Si se olvida, `pnpm verify` sale rojo en
`feature-constants` y nombra el archivo (comprobado: ver Validación).

### Cómo se ve

Card blanca (navy en oscuro) con borde izquierdo de 3 px en tinta neutra, ícono de
radar a la izquierda, título en negrita de 15 px, texto de 13,5 px en gris
secundario y el enlace subrayado debajo. Ocupa todo el ancho del contenido; el
texto se corta a 65 caracteres por línea. Capturas con datos ficticios:

- [detalle de envío, claro, 360 px](../../docs/specs/0514-portal-tracking-en-construccion/assets/aviso-detalle-envio-claro-movil.png)
- [detalle de envío, oscuro, 360 px](../../docs/specs/0514-portal-tracking-en-construccion/assets/aviso-detalle-envio-oscuro-movil.png)
- [portada, claro, 1280 px](../../docs/specs/0514-portal-tracking-en-construccion/assets/aviso-portada-claro-escritorio.png)

Las capturas salen de un arnés estático: pantallas reales renderizadas a HTML
con `react-dom/server` y el CSS de `app/globals.css` compilado con
`@tailwindcss/postcss`, fotografiadas con Playwright. Las fuentes del Portal
(Nunito Sans, Sora) no se cargan ahí y salen las del sistema; el resto es el CSS
real. Medido a 360 px: aviso 320×222, enlace 209×44, sin desborde horizontal.
Sin sidebar: el ancho de escritorio no es el del Portal real.

## `/ui-check` (diff de SDD-0514)

```
UI-CHECK · diff SDD-0514
Hallazgos (4):
1 ⭐ [media] app/portal/_components/PortalTrackingEnConstruccion.tsx:54,61 — mt-1.5,
   gap-1.5 y mt-0.5 estaban fuera de la escala de 4 px. CORREGIDO antes del commit
   (mt-2, gap-2, sin ajuste óptico del ícono).
2  [media] app/portal/(app)/compras/[code]/page.tsx:455 — «Todavía no llegó a
   nuestra bodega … Te avisamos apenas el proveedor entregue en Yiwu» puede ser
   falso mientras la bodega registra en Excel. El aviso de arriba (:146) lo
   pone en contexto, pero el copy de la pantalla no se tocó: está fuera del
   alcance. Decisión de Sam (ver Handoff al Director).
3  [baja] app/portal/_components/PortalTrackingEnConstruccion.tsx:40 —
   rounded-[16px] y border-l-[3px] no son tokens --r-*. Es el mismo armazón de
   PortalMaintenanceNotice y ProfilePendingBanner, con el color semántico de
   información (no un color al azar). Se deja por consistencia con el Portal.
4  [baja] app/portal/(app)/_components/PortalDashboardNorte.tsx:107 — con un
   próximo arribo real, en móvil el aviso baja el héroe unos 222 px. Aceptable
   mientras dure; desaparece con el interruptor.
Lo que está bien: sólo clases y tokens del sistema, cero hex; tono información
(BRAND, estados 2026-09-05), sin dorado ni rojo; contraste AA medido en los dos
temas; role="status"; enlace de 44 px de alto con hover y foco visible; tuteo;
sin fecha prometida ni CTA de venta; alineado a la izquierda; 65ch.
Veredicto: OK para commit.
```

Contraste medido con los valores de `app/globals.css` (fórmula WCAG):

| Par | Claro | Oscuro | Umbral |
|---|---|---|---|
| Título (ink) sobre la card | 16.49:1 | 13.08:1 | 4.5 |
| Texto (grey-700) sobre la card | 12.63:1 | 7.33:1 | 4.5 |
| Enlace (ink) sobre la card | 16.49:1 | 13.08:1 | 4.5 |
| Enlace en hover (wine-text) sobre la card | 10.58:1 | 6.44:1 | 4.5 |
| Ícono y borde (`--portal-info` = ink) sobre la card | 16.49:1 | 13.08:1 | 3 |

## Guion de smoke para Sam

Con un cliente real que tenga al menos una pre-alerta (y, si existe, uno con un
envío), en el teléfono y en la computadora, después de que la PR esté
desplegada. No hace falta escribir nada: sólo mirar.

| # | Pantalla | Qué tienes que ver | Es falla si… |
|---|---|---|---|
| 1 | `/portal` (Inicio) | Debajo de «Hola …» y la línea de envíos y facturas, la card «Seguimiento en construcción» con el texto y el enlace «¿Dudas? Escríbenos en Soporte». Debajo, los KPIs y «Tus envíos» como siempre. | El aviso no sale, sale dos veces, o falta algo que antes estaba (próximo arribo, KPIs, «Tus envíos»). |
| 2 | `/portal/envios` | El aviso debajo del título «Mis envíos» y sus botones. Debajo, el banner del próximo consolidado (si hay salida), el pipeline, las pestañas y las filas de siempre. | Falta una fila o el conteo de una pestaña cambió respecto de lo que ves en el Studio. |
| 3 | `/portal/envios` → botón «Seguimiento total» | El aviso debajo de la introducción «El estado de cada carga…». Si el cliente tiene envíos en camino, sus tarjetas con la barra de avance siguen debajo. | El aviso no aparece en esta vista. |
| 4 | Detalle de un envío (`/portal/envios/<código>`) | El aviso arriba de la card «Seguimiento». El stepper con sus fechas reales, la card de naviera (si la tiene) y el detalle de la carga siguen debajo. | El stepper o una fecha que antes salía ya no sale. |
| 5 | Detalle de una compra: abre `/portal/compras` y toca una compra (o ve directo a `/portal/compras/<código>`) | El aviso entre el código de la compra y el bloque «Todavía no llegó a nuestra bodega» (o «Llegaron …» si hay recepción). | Una recepción que sí estaba registrada ya no se ve. |
| 6 | El enlace «¿Dudas? Escríbenos en Soporte» de cualquiera de las anteriores | Abre `/portal/soporte`. | Abre otra pantalla o da error. |
| 7 | Tema oscuro (botón de tema del Portal) en una de las anteriores | El aviso se lee igual de bien: card navy, texto claro. | Texto gris tenue difícil de leer. |
| 8 | Una pantalla que NO lleva el aviso: `/portal/facturas` o `/portal/perfil` | Sin aviso. | El aviso aparece ahí. |

## Validación

Sobre el árbol de trabajo encima de `origin/main` `9a935562` (contenido idéntico al
de los commits de esta rama).

| Comprobación | Resultado |
|---|---|
| `corepack pnpm install --frozen-lockfile --prefer-offline` | PASÓ (exit 0, 28,4 s) |
| Pruebas nuevas (2 archivos, 13 casos) | PASÓ, 13/13 |
| `vitest related --run` de los 6 archivos de código tocados | PASÓ: 3 archivos, 16 pruebas (incluida la prueba existente `PortalAlertasHub.test.tsx`, ahora con el aviso prendido) |
| Control rojo: las cuatro pantallas como en `origin/main` `9a935562`, con el componente nuevo | PASÓ como control: 6 failed / 7 passed. Caen los 6 casos «prendido» de pantalla, los 6 por `expected null not to be null`. Pasan los casos «apagado» y los del componente suelto, como se espera. Repetido antes en `1ce2ba99` con el mismo resultado. |
| Mutantes (7) | PASÓ: 7/7 muertos, control verde antes y después (13/13). M1 el componente ignora el interruptor → 6 casos «apagado». M2 interruptor invertido → 13. M3 el aviso tapa el stepper → el caso del detalle de envío. M4 el aviso esconde las recepciones → el caso de la recepción real. M5 sin aviso en «Seguimiento total» → su caso. M6 aviso debajo del héroe en la portada → su caso. M7 el enlace va a otra pantalla → el caso del componente. |
| `corepack pnpm exec tsc --noEmit` | PASÓ (exit 0, sin salida) |
| eslint de los 8 archivos `.ts`/`.tsx` tocados | PASÓ (exit 0) |
| `node scripts/build-docs-index.mjs --check` | PASÓ: índice sincronizado con 499 specs |
| `node scripts/check-numbering.mjs` | PASÓ: sin números repetidos |
| `git diff --check` (y `--cached` antes de cada commit) | PASÓ |
| `pnpm governance:check` | PASÓ: 28 políticas, cápsula vigente |
| `pnpm components:check` | PASÓ: CMP-01 válido |
| `node scripts/check-feature-constants.mjs` | PASÓ: 6 banderas. Con la constante en `false` y el JSON sin tocar: FALLÓ como debe (exit 1, nombra la bandera y el archivo). Restaurado y verde. |
| `node scripts/check-rsc-boundary.mjs` (el aviso se importa desde el hub, que es cliente) | PASÓ: 1657 módulos, sin cruces |
| Contraste AA, claro y oscuro | PASÓ (tabla arriba) |
| Capturas a 360 y 1280 px, claro y oscuro | PASÓ: sin desborde horizontal; enlace 209×44 |
| `pnpm verify` completo | NO EJECUTADO: el Director reserva el turno de corridas pesadas |
| vitest completo, e2e, Docker, build | NO EJECUTADO: mismo motivo. No hay e2e sobre pantallas autenticadas del Portal (revisé `e2e/`); los `getByRole("status")` de `calculadora-semantic-colors.spec.ts` filtran por texto y no chocan. |
| Smoke en el Portal con un cliente | NO EJECUTADO: requiere sesión real de cliente; queda el guion para Sam |
| `pnpm knowledge:status` | Ejecutado (exit 0, `ok: false`): estructura `INVALID` porque este worktree no tiene `graphify-out` (3338 faltantes), semántica `INVALID`, Archify `PENDING` (runtime ausente) y Obsidian `PENDING`. Es el estado de cualquier worktree sin derivados; no lo causa este cambio. |
| `graphify update`, `knowledge:visual`, `knowledge:publish --preview` | NO EJECUTADO: el worktree no tiene derivados de Graphify ni el runtime de Archify, y la publicación la hace el Director desde main integrado |

## Impacto documental

- Documento canónico nuevo: la spec 0514. No cambian `BRAND.md`, el Norte ni los
  runbooks.
- `scripts/feature-constants.json` gana una entrada: ahí queda dicho en qué estado
  está el aviso para el cliente.
- Graphify: entran 2 módulos nuevos (`lib/portal/tracking-en-construccion.ts`,
  `app/portal/_components/PortalTrackingEnConstruccion.tsx`), 2 pruebas y 4 aristas
  de import nuevas. Sin extracción semántica pendiente propia: la spec no es fuente
  del piloto semántico. Pendiente global: actualización estructural desde main
  integrado, a cargo del Director.
- Obsidian: nada que revisar fuera de la publicación habitual desde main.

## Cierre

- **OBJETIVO ORIGINAL:** que el Portal del cliente avise con claridad que el
  seguimiento y el tracking están en construcción y pronto estarán disponibles,
  en Envíos (lista y detalle), en el detalle de una compra y en la portada, con un
  único interruptor en `lib/portal/`, sin tocar datos y sin tapar eventos reales.
- **COMPLETADO:** aviso, interruptor, las cinco vistas, declaración de la bandera,
  13 pruebas nuevas, control rojo, 7 mutantes muertos, contraste medido, capturas,
  spec con allowlist e índice. Criterios 1 a 5 de la spec cumplidos con evidencia
  local. La spec queda `in-progress`: falta el smoke de Sam en el Portal.
- **VALIDACIÓN:** tabla de arriba.
- **COMMITS:** en `codex/portal-tracking-en-construccion`:
  1. `e10a6ab0` `docs: SDD-0514 — spec, capturas e índice del aviso de seguimiento en construcción`.
  2. `feat(portal): SDD-0514 — aviso «Seguimiento en construcción» en portada, Envíos y detalles`: el commit que contiene este documento. Va último a propósito: el `ignoreCommand` de Vercel mira sólo el último commit y cancela el build si es sólo documentación.
- **PR / BRANCH:** PR en draft contra `main` desde `codex/portal-tracking-en-construccion` (URL en la PR y en el reporte al Director). Worktree arriba.
- **PENDIENTES DE ESTA TAREA:**
  - Smoke de Sam con el guion de arriba, después del despliegue.
  - `pnpm verify` completo cuando el Director dé el turno.
  - Pasar la spec a `done` cuando el smoke pase.
- **FUERA DE ALCANCE DETECTADO:**
  - `app/portal/(app)/compras/[code]/page.tsx:455-456`: «Todavía no llegó a
    nuestra bodega … Te avisamos apenas el proveedor entregue en Yiwu». Mientras
    la bodega registre en Excel, puede ser falso para mercancía que ya llegó.
    Inferencia por lectura de código, no comprobada: el aviso «recibido en bodega
    China» se programa al registrar la recepción en el sistema
    (`scheduleReceiptInWarehouse`, citado en SDD-0511), así que con Excel no sale.
  - `app/portal/(app)/page.tsx:153` (tarjeta de notificaciones push de la
    portada): «tu navegador te avisa cuando tu mercancía llega a bodega». Con la
    bodega en Excel, ese aviso no sale (misma inferencia).
  - El comentario de `PortalShipmentDetailNorte.tsx` (cabecera) y de
    `PortalDashboardNorte.tsx` dicen que el rediseño Norte está «GATEADO al demo»;
    con `NORTE_PORTAL_LIVE = true` ya lo ven todos. Es un comentario viejo, no
    cambia comportamiento.
  - `scripts/feature-constants.json` (`$doc`) y el mensaje de
    `scripts/check-feature-constants.mjs` usan voseo («cambiá», «agregues»,
    «actualizá», «decí»).
- **HANDOFF AL DIRECTOR:**
  - Siguiente acción: revisar la PR draft; si está bien, pasarla a lista,
    pedir el turno de `pnpm verify` y fusionar con la autorización de Sam. El
    merge despliega a producción (Vercel hoy; el VPS desde el 2026-10-15). Como la
    constante viaja en el código, el aviso sale igual en los dos.
  - Decisión para Sam: si el copy de partida le sirve con los tres ajustes (bodega,
    carga, «nuestro equipo las recibe»), y si quiere que el texto propio de la
    compra (punto 1 de FUERA DE ALCANCE) también diga que la recepción todavía se
    registra fuera del sistema. Eso sería otra tarea.
  - Decisión para Sam: quién avisa cuando la bodega empiece a registrar en el
    sistema, para apagar el interruptor ese mismo día (Riesgos de la spec).
  - Archivos compartidos: ninguno con la PR #114. `scripts/feature-constants.json`
    lo pueden tocar otras PRs que agreguen banderas; el conflicto sería de una
    entrada en un arreglo.
  - Índice de specs: lista 0513 como hueco porque la PR #210 no está en main, y
    #210 también toca `docs/specs/README.md`. La que entre segunda tiene que
    traer main y regenerar con `node scripts/build-docs-index.mjs`.
  - Ownership: claim liberado al terminar la escritura (`release --owner
    portal-tracking-en-construccion-worker`). No hay sesiones consumidoras de este
    worktree. No borrar worktree ni rama hasta que la PR se integre.
