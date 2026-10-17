# Handoff · SDD-0517 · Registro público: sin promesa de aviso de bodega mientras el seguimiento está en construcción

| Campo | Valor |
|---|---|
| Fecha | 2026-10-14 (UTC 20:45 a 21:10 aprox.; Caracas 16:45 a 17:10) |
| Task ID / owner | `registro-sin-promesa-bodega` / subagente Worker del Director |
| Claim del harness | `worker-0517-registro-sin-promesa-bodega` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-aa77c94d26232f26c` |
| Rama | `codex/registro-sin-promesa-bodega` |
| Base | `origin/main` `3086befb` (trae la #214). La rama salió de `d28fa515` y se adelantó por fast-forward con `git merge origin/main` antes de cualquier cambio, a pedido del Director; la #214 no tocó ningún archivo de esta tarea. |
| SDD | [0517](../../docs/specs/0517-registro-sin-promesa-bodega/spec.md), `in-progress` (la asignó el Director) |
| Estado de la tarea | lista para revisión (PR en draft) |
| Permisos | commits selectivos, push de la rama propia y PR en draft contra main. Sin merge, sin producción, sin base de datos, sin escribir en main ni en otra rama. No tocar `components/Analytics.tsx` (SDD-0518 en paralelo): no se tocó; la prueba nueva sólo lo simula con `vi.mock`, igual que las demás pruebas del registro. |

## Objetivo

Mientras `TRACKING_EN_CONSTRUCCION` esté en `true`, el formulario público de
registro (`/registro`) no promete un aviso «cuando llega a bodega», porque la
bodega de China todavía registra en Excel y el seguimiento está en construcción.
Con `false` vuelve el texto de hoy. Mismo criterio que Sam aprobó para el Portal
en las SDD-0514 y 0516. Origen: FUERA DE ALCANCE del handoff de la 0516.

## Qué se hizo

- `app/registro/RegisterForm.tsx`: importa `TRACKING_EN_CONSTRUCCION` desde
  `@/lib/portal/tracking-en-construccion` y, en el paso 2 (Contacto), elige el
  texto según el interruptor. «Registras a <razón social>.» de las empresas no
  cambia.
- `app/registro/__tests__/register-sin-promesa-bodega.test.tsx`: nuevo, 4 casos
  (prendido y apagado, persona y empresa).
- `lib/portal/tracking-en-construccion.ts`: sólo comentario. Nombra el registro
  entre los textos que cambian y explica por qué el módulo no importa nada (lo
  lee un componente de cliente de una página pública). El valor no cambia.
- `scripts/feature-constants.json`: sólo el `significa` de
  `TRACKING_EN_CONSTRUCCION` (nombra la 0517 y el registro). El `$doc` con voseo
  no se tocó (ya anotado por la 0514 y la 0516).
- Spec 0517 e índice regenerado con `node scripts/build-docs-index.mjs`.

Se revisó todo el registro (`page.tsx`, `RegisterForm.tsx`, `actions.ts`): esa
frase es la única que promete un aviso de llegada a bodega.

### Texto final exacto

Debajo del título «¿Cómo te ubicamos?» (o «Hola <nombre>, ¿cómo te ubicamos?»):

- **Interruptor encendido (hoy):** «El WhatsApp es por donde hablamos contigo sobre tu carga.»
- **Interruptor apagado (vuelve, palabra por palabra):** «El WhatsApp es por donde te avisamos de tu carga: cuando llega a bodega en China, cuando zarpa y cuando está lista para entrega.»
- Para una empresa, delante va «Registras a <razón social>.» con cualquiera de los dos.

### Decisiones tomadas dentro del encargo, a revisar

1. **No se conservan zarpe y entrega** (en la portada del Portal, la 0516 sí los
   conservó). Allá el canal es el navegador y esos avisos los dispara el Studio;
   aquí el canal prometido es WhatsApp, y los avisos automáticos al cliente sólo
   salen por correo o push (`NOTIFICATION_CHANNELS = ["email", "push", "both",
   "none"]` en `lib/studio/notifications/client-notification-types.ts`; el propio
   formulario dice «no hay API de WhatsApp» en el comentario de la SDD-0254).
   Lectura de código, no medición. Si Sam prefiere conservarlos, es una línea:
   «El WhatsApp es por donde te avisamos de tu carga: cuando zarpa y cuando está
   lista para entrega.», y el cambio de su prueba.
2. **La constante no se mueve a `lib/shared/`.** `app/registro/` está fuera de la
   frontera pública por diseño (`eslint.config.mjs`), el formulario ya importa
   `@/lib/portal/register-types` y `register-cities`, y `lib/portal` no está en
   ningún grupo restringido. Medido con ESLint por stdin (sondas en el
   scratchpad, sin archivos en el repo):
   - import de `@/lib/portal/tracking-en-construccion` como
     `app/registro/Sonda.tsx` → exit 0;
   - el mismo import como `components/Sonda.tsx` (dentro de la frontera) → exit 0;
   - control: import de `@/lib/studio/foo` como `components/Sonda.tsx` → exit 1,
     «'@/lib/studio/foo' import is restricted from being used by a pattern.
     Frontera: el sitio público no importa código del ERP…».

   Por eso los consumidores de la 0514 y la 0516 no cambian.

## `/ui-check` (diff de SDD-0517)

```
UI-CHECK · diff SDD-0517 (app/registro/RegisterForm.tsx, paso 2 Contacto)
Hallazgos (3):
1 ⭐ [baja] app/registro/RegisterForm.tsx:794 y :806 — el texto neutro («hablamos
   contigo sobre tu carga») y la ayuda del campo («Es el número por el que te
   contactamos · siempre por WhatsApp.») dicen casi lo mismo. Ya pasaba con el
   texto de hoy. Se deja: el párrafo explica el paso y la ayuda el campo.
2  [baja] app/registro/RegisterForm.tsx:785 — con una razón social que termina en
   punto («Importadora Pérez C.A.», que es el placeholder) sale «C.A..». Es de
   antes de esta tarea; va a FUERA DE ALCANCE.
3  [baja] app/registro/RegisterForm.tsx:794 — el párrafo pasa de ~128 a 58
   caracteres: una o dos líneas menos a 360 px dentro de max-w-[52ch]. Sin ancho
   fijo que medir.
Lo que está bien: mismo <p>, mismas clases (text-[13px] text-grey-700), sin
colores, tamaños ni estructura nuevos; cero hex; ningún elemento interactivo
nuevo; sin CTA de venta; tuteo («hablamos contigo»), sin voseo; alineado a la
izquierda.
Veredicto: OK para commit.
```

Contraste: no cambia ningún par texto/fondo (el mismo `text-grey-700` sobre la
misma card blanca que en main). Capturas: no se tomaron; el cambio es sólo de
texto dentro del mismo párrafo.

## Guion de smoke para Sam

Después de que la PR esté desplegada. Sólo mirar: **no** hace falta crear una
cuenta (no toques «Crear cuenta» en el paso 4). En el teléfono y en la
computadora, en una ventana privada (con sesión de Portal abierta, `/registro`
te manda al Portal).

| # | Pantalla | Qué tienes que ver | Es falla si… |
|---|---|---|---|
| 1 | `dtdcargo.com/registro`, paso 1 como «Persona natural»: escribe un nombre, una cédula y un correo de prueba, y toca «Continuar» | Paso 2 «Contacto», título «Hola <nombre>, ¿cómo te ubicamos?» y debajo «El WhatsApp es por donde hablamos contigo sobre tu carga.» | Aparece «te avisamos», «cuando llega a bodega en China» o «cuando zarpa». |
| 2 | El mismo paso 2, resto de la pantalla | Campo «Teléfono WhatsApp» con su ayuda «Es el número por el que te contactamos · siempre por WhatsApp.», el teléfono de oficina opcional y la ciudad, como siempre. | Falta algún campo o la ayuda cambió. |
| 3 | Toca «‹ Volver», elige «Empresa», completa razón social y RIF, y toca «Continuar» | «Registras a <razón social>. El WhatsApp es por donde hablamos contigo sobre tu carga.» | Falta «Registras a…» o vuelve la promesa. |

Si en el paso 3 la razón social termina en punto («… C.A.»), vas a ver «C.A..»:
eso es de antes y no lo causa este cambio (anotado abajo como fuera de alcance).

## Validación

Sobre el árbol de trabajo encima de `origin/main` `3086befb`.

| Comprobación | Resultado |
|---|---|
| `corepack pnpm install --frozen-lockfile --prefer-offline` | PASÓ (exit 0, «Done in 46.2s using pnpm v12.3.4») |
| Prueba nueva `register-sin-promesa-bodega.test.tsx` | PASÓ, 4/4 |
| Control rojo: prueba nueva con `RegisterForm.tsx` de `origin/main` `3086befb` | PASÓ como control: «Tests 2 failed \| 2 passed (4)». Caen los 2 «prendido» («expected 'El WhatsApp es por donde te avisamos …' to be 'El WhatsApp es por donde hablamos con…'» y el de empresa); pasan los 2 «apagado». Un primer intento con la razón social «Importadora Pérez C.A.» hizo caer también el «apagado, empresa» por el «C.A..» preexistente; la prueba usa «Importadora Pérez» para medir sólo lo de esta tarea. |
| Mutantes (5, script en el scratchpad, reemplazo exacto con una sola aparición y archivo restaurado) | PASÓ: 5/5 muertos; control «Tests 4 passed (4)» antes y después; «archivo restaurado: true». M1 el texto ignora el interruptor → 2 failed. M2 interruptor invertido → 4 failed. M3 siempre el texto neutro → 2 failed. M4 la frase neutra vuelve a decir «te avisamos» → 2 failed. M5 el texto de siempre pierde «en China» → 2 failed. |
| `vitest related --run --reporter=verbose app/registro/RegisterForm.tsx lib/portal/tracking-en-construccion.ts` | PASÓ: «Test Files 11 passed (11)», «Tests 54 passed (54)». Por archivo: `compras/[code]/page.test.tsx` 6, `PortalAlertasHub.test.tsx` 3, `(app)/page.test.tsx` 2, `PortalTrackingEnConstruccion.test.tsx` 10, `register-ciudad-entrega` 4, `register-email-format` 6, `register-error-summary` 3, `register-markbox-whatsapp` 6, `register-prellenado-guia` 7, `register-sin-promesa-bodega` 4, `register-ya-eres-cliente` 3. Incluye las pruebas de la 0514 y la 0516. |
| `node_modules/.bin/tsc --noEmit` (sin tubería) | PASÓ (exit 0, sin salida) |
| eslint de `RegisterForm.tsx`, la prueba nueva y `tracking-en-construccion.ts` | PASÓ (exit 0, sin salida) |
| Frontera ESLint con sondas por stdin | PASÓ: detalle en «Decisiones», punto 2 |
| `node scripts/check-feature-constants.mjs` | PASÓ: «feature-constants: 6 bandera(s) coinciden con lo declarado» |
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ: «índice sincronizado con 502 specs» |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ: «numbering: sin números repetidos» (con los choques históricos de migraciones ya aplicadas, que no se renumeran) |
| `git diff --check` (y `--cached` antes de cada commit) | PASÓ |
| `/ui-check` | PASÓ: OK para commit (bloque de arriba) |
| `pnpm verify` completo | NO EJECUTADO: el encargo pide validación liviana; el Director reserva el turno de corridas pesadas |
| vitest completo, e2e, Docker, build | NO EJECUTADO: mismo motivo. El e2e del registro no se revisó para este texto. |
| `pnpm governance:check`, `pnpm components:check` | NO EJECUTADO: no hay componentes ni patrones nuevos; los incluye `pnpm verify` |
| Smoke en `/registro` desplegado | NO EJECUTADO: requiere el despliegue; queda el guion para Sam |
| `corepack pnpm knowledge:status` | Ejecutado (exit 0, `ok: false`): structural `INVALID`, semantic `INVALID`, cobertura semántica global `INVALID` y del piloto `PENDING`, Archify `PENDING`, Obsidian `PENDING`. Este worktree no tiene `graphify-out`; es el mismo estado que registró la 0516 y no lo causa este cambio. |
| `graphify update`, `knowledge:visual`, `knowledge:publish --preview` | NO EJECUTADO: el worktree no tiene derivados de Graphify ni el runtime de Archify; la publicación la hace el Director desde main integrado |

## Impacto documental

- Documento canónico nuevo: la spec 0517. No cambian `BRAND.md`, el Norte ni los
  runbooks.
- `scripts/feature-constants.json`: el `significa` de la bandera dice ahora que
  también cambia el registro público.
- `docs/marketing/README.md`: no se toca. Su línea sobre `/registro` («registro
  REAL: crea el cliente con Shipping Mark…») sigue siendo cierta, y el texto
  temporal queda dicho en la spec y en la declaración de la bandera. Además es
  fuente del piloto semántico (`scripts/knowledge-policy.json`), y un recibo
  semántico no se emite desde un worktree. Propuesta para el Director, no
  decisión: si quiere dejarlo en el árbol de marketing, una línea bajo «Cómo usar
  este tree» desde main, con su recibo.
- Graphify: entra 1 prueba nueva y 1 arista de import nueva
  (`app/registro/RegisterForm.tsx` → `lib/portal/tracking-en-construccion.ts`).
  Sin extracción semántica propia pendiente: la spec y el handoff no son fuentes
  del piloto. Pendiente global: actualización estructural desde main integrado, a
  cargo del Director.
- Obsidian: nada que revisar fuera de la publicación habitual desde main.

## Cierre

- **OBJETIVO ORIGINAL:** que el formulario público de registro no prometa un aviso
  automático «cuando llega a bodega» mientras la bodega de China registre en Excel
  y el seguimiento esté en construcción, con el interruptor de la 0514; con
  `false`, el texto de hoy. Revisar si el registro puede importar `lib/portal` o
  si hay que mover la constante a `lib/shared/`.
- **COMPLETADO:** texto neutro en el paso Contacto con el interruptor encendido y
  el de hoy con el interruptor apagado; decisión de no mover la constante, medida
  con ESLint y explicada en la spec; comentario y declaración de la bandera al día;
  4 pruebas nuevas, control rojo contra main, 5 mutantes muertos; pruebas de la
  0514 y la 0516 en verde; spec con allowlist e índice. Criterios 1 a 4 de la spec
  cumplidos con evidencia local. La spec queda `in-progress`: falta el smoke de
  Sam.
- **VALIDACIÓN:** tabla de arriba.
- **COMMITS:** en `codex/registro-sin-promesa-bodega`:
  1. `docs(sdd): SDD-0517 — spec e índice del registro sin promesa de bodega`.
  2. `feat(DTD-0517): el registro público no promete el aviso de bodega mientras el seguimiento está en construcción`: código, prueba, comentario, declaración y este documento (commit que contiene este documento). Toca código, así que el `ignoreCommand` de Vercel, que mira sólo el último commit, no cancela el build de Preview.

  Los hashes finales van en la PR y en el reporte al Director.
- **PR / BRANCH:** en draft contra `main` desde `codex/registro-sin-promesa-bodega`
  (URL en el reporte al Director y en la propia PR). Worktree arriba.
- **PENDIENTES DE ESTA TAREA:**
  - Smoke de Sam con el guion de arriba, después del despliegue.
  - `pnpm verify` completo cuando el Director dé el turno.
  - Pasar la spec a `done` cuando el smoke pase.
- **FUERA DE ALCANCE DETECTADO:**
  - `components/servicios/hub-fichas.tsx:876-877` (página pública de servicios,
    ficha de pre-alerta): «Cuando tu mercancía llega a Yiwu, el operario la recibe
    escaneando la etiqueta y te avisamos.» Misma promesa con la bodega en Excel.
    Está dentro de la frontera pública: si se condiciona al interruptor, el lint no
    lo frena, pero conviene llevar la constante a `lib/shared/` en esa tarea.
  - Material de marketing con la misma promesa:
    `docs/marketing/servicios-infografias/prealerta-compra.md:21`,
    `docs/marketing/servicios-infografias/videos/brief-prealerta.md:22,62,86` y
    `docs/marketing/assets/produccion-videos-dtd.html:376,397,861`.
  - `app/registro/RegisterForm.tsx:785`: con una razón social que termina en punto
    (el placeholder es «Importadora Pérez C.A.») el paso Contacto muestra «C.A..».
  - `app/registro/RegisterForm.tsx:1296-1297` (guía del Shipping Mark en la
    pantalla final): «Todo queda separado y trazable desde tu portal». No promete
    un aviso, pero es el mismo «estado automático» que la 0516 anotó para la lista
    de compras.
  - Con el interruptor apagado vuelve también «te avisamos … cuando zarpa y cuando
    está lista para entrega» por WhatsApp, que el sistema no envía (los avisos
    automáticos son por correo o push). Ya estaba antes de esta tarea.
- **HANDOFF AL DIRECTOR:**
  - Siguiente acción: revisar la PR draft; si está bien, pasarla a lista, pedir el
    turno de `pnpm verify` y fusionar con la autorización de Sam. El merge
    despliega a producción.
  - Decisiones a revisar con Sam: punto 1 de «Decisiones» (zarpe y entrega fuera
    del texto neutro).
  - Archivos compartidos con la 0514 y la 0516 (ya integradas):
    `lib/portal/tracking-en-construccion.ts` (comentario) y
    `scripts/feature-constants.json` (`significa`). Con la SDD-0518, ninguno: no se
    tocó `components/Analytics.tsx`.
  - Ownership: claim liberado al terminar la escritura (`release --owner
    worker-0517-registro-sin-promesa-bodega`). No hay sesiones consumidoras de este
    worktree. No borrar worktree ni rama hasta que la PR se integre.

## CIERRE DE INTEGRACIÓN (Director, 2026-10-15)

- **Merge:** PR #215, merge `a5e40141` a las 22:38:44Z del 2026-10-14, con `--match-head-commit 7b6618a2` y el OK de Sam («ok, fusiona la #215, #216 y #217»).
- Deploy de las tres PR (#215, #216 y #217): «Deployment has completed», el último a las 23:07Z del 2026-10-14.
- **Smoke en producción de `/registro`: PASÓ.** Sam, literal: «ya probé /registro y /servicios, funcionan».
- Desde la SDD-0521, el mismo interruptor (`TRACKING_EN_CONSTRUCCION`) gobierna también los textos públicos de rastreo. Estado de la tarea: **integrada**.
