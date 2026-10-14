# Handoff · SDD-0519 · Servicios y marketing: sin promesa de aviso de bodega mientras el seguimiento está en construcción

| Campo | Valor |
|---|---|
| Fecha | 2026-10-14 (UTC 21:38 a 22:30 aprox.; Caracas 17:38 a 18:30) |
| Task ID / owner | `servicios-sin-promesa-bodega` / subagente Worker del Director |
| Claim del harness | `worker-0519-servicios-sin-promesa-bodega` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a8114678be5057162` |
| Rama | `codex/servicios-sin-promesa-bodega` (creada con `git switch -c` desde `origin/main`) |
| Base | `origin/main` `3086befb` (trae la #214) |
| SDD | [0519](../../docs/specs/0519-servicios-sin-promesa-bodega/spec.md), `in-progress` (la asignó el Director) |
| Estado de la tarea | lista para revisión (PR en draft) |
| Permisos | commits selectivos, push de la rama propia y PR en draft contra main. Sin merge, sin producción, sin base de datos, sin escribir en main ni en otra rama. No tocar `docs/marketing/README.md` (fuente del piloto semántico) ni `app/registro/RegisterForm.tsx` (PR #215): no se tocaron. |

## Objetivo

Que la página pública de servicios y el material de marketing no prometan un
aviso automático de llegada a bodega mientras la bodega de China registre en
Excel y el seguimiento esté en construcción. En la página, con el interruptor
`TRACKING_EN_CONSTRUCCION` de la 0514; en el material interno, con texto cierto
hoy y una nota de cómo volver. Origen: FUERA DE ALCANCE del handoff de la 0517.

## Qué se hizo

- `components/servicios/hub-fichas.tsx`: importa `TRACKING_EN_CONSTRUCCION`
  desde `@/lib/portal/tracking-en-construccion` y, en la ficha «Pre-alerta de
  compra» (`PreAlerta`), la parada de la ruta, el actor 3 y el paso 5 eligen el
  texto según el interruptor. El valor se lee al renderizar.
- `components/servicios/hub-fichas-sin-promesa-bodega.test.tsx`: nuevo, 6 casos.
- `docs/marketing/servicios-infografias/prealerta-compra.md`,
  `docs/marketing/servicios-infografias/videos/brief-prealerta.md` y
  `docs/marketing/assets/produccion-videos-dtd.html`: sin la promesa, con una
  nota de la SDD-0519 en cada uno.
- Spec 0519 e índice regenerado con `node scripts/build-docs-index.mjs`.

**Alcance ampliado dentro del encargo, a revisar.** El encargo nombraba una
frase de la ficha (`hub-fichas.tsx:876-877`, paso 5). Barrí `components/servicios/`
y `app/servicios/` (avis, escane, notific, al instante, llega a bodega): la misma
promesa sale **tres** veces en la ficha de pre-alerta, también en la ruta
(«escanea y te avisa») y en el actor 3 («te avisamos al instante»). Cambié las
tres, porque con una sola la ficha seguía prometiendo el aviso. En el video pasa
lo mismo: además de las líneas citadas (concepto, rótulo, guion), la escena 5 y
el corte 5 de edición mostraban la notificación en el teléfono del cliente.

### Textos finales exactos

Ficha «Pre-alerta de compra» de `/servicios#svc/pre-alerta`:

| Lugar | Interruptor apagado (vuelve palabra por palabra) | Interruptor encendido (hoy) |
|---|---|---|
| Ruta, tercera parada «Operario Yiwu» | escanea y te avisa | recibe tu carga |
| «¿Qué es?», actor 3 «Operario en Yiwu» | **Recibe escaneando** la etiqueta cuando llega tu mercancía y **te avisamos** al instante. | **Recibe tu mercancía** cuando llega y la **identifica** por la etiqueta. |
| «¿Cómo funciona?», paso 5 | Cuando tu mercancía llega a Yiwu, el operario **la recibe escaneando** la etiqueta y **te avisamos**. | Cuando tu mercancía llega a Yiwu, el operario **la recibe y la identifica** por la etiqueta. |

Material de marketing (sin interruptor; antes → después):

| Archivo · lugar | Antes | Después |
|---|---|---|
| `prealerta-compra.md` · paso 5 | 5. Cuando tu mercancía llega a Yiwu, el operario **la recibe escaneando** la etiqueta y **te avisamos**. | 5. Cuando tu mercancía llega a Yiwu, el operario **la recibe y la identifica** por la etiqueta. |
| brief y HTML · concepto | … tu mercancía llega a la bodega en China, se recibe escaneando, y te avisamos. … | … tu mercancía llega a la bodega en China y nuestro equipo la recibe y la identifica por su etiqueta. … |
| brief y HTML · escena 5 | b-roll real en Yiwu: el operario recibe la caja y **escanea la etiqueta** → corte al teléfono del cliente recibiendo el aviso "tu mercancía llegó a la bodega" (mock del portal, cuenta demo). | b-roll real en Yiwu: el operario recibe la caja y **escanea la etiqueta** (plano detalle: la etiqueta cierra el hilo conductor). |
| brief y HTML · rótulo escena 5 | "3 · La recibimos escaneando · te avisamos" | "3 · La recibimos y la identificamos" |
| brief y HTML · guion [Con seguridad] | Cuando tu mercancía llega a nuestra bodega en China, la recibimos **escaneando su etiqueta** y te avisamos al momento. Y en la misma pre-alerta eliges los servicios de la llegada: Validación, Inspección, Etiquetado y más. | Cuando tu mercancía llega a nuestra bodega en China, la recibimos y la identificamos **por su etiqueta**. Y en la misma pre-alerta eliges los servicios de la llegada: Validación, Inspección, Etiquetado y más. |
| brief y HTML · corte 5 de edición | Corte del escaneo en bodega a la notificación en el teléfono del cliente (causa → efecto). | Del escaneo en bodega, corte a la pantalla del portal con los servicios de la llegada (escena 6). |

Nota que queda en cada archivo (en el `.md` de la ficha, con enlace a la spec):

- `prealerta-compra.md`: «**Nota (SDD-0519, 2026-10-14):** mientras la bodega
  de China registre en Excel y el seguimiento del Portal esté en construcción,
  esta ficha no promete un aviso automático de llegada a bodega. Cuando el
  seguimiento esté activo, el paso 5 puede volver a su texto original; está en la
  SDD-0519.»
- `brief-prealerta.md` y el panel del video 1 del HTML: «**Nota (SDD-0519,
  2026-10-14):** mientras la bodega de China registre en Excel y el seguimiento
  del Portal esté en construcción, este video no promete un aviso automático de
  llegada a bodega: sin «te avisamos» en el guion ni en los rótulos, y sin la
  notificación en el teléfono del cliente. Cuando el seguimiento esté activo, se
  puede volver al texto original; está en la SDD-0519. Si el video ya se grabó
  con la frase vieja, regraba el bloque [Con seguridad] y el rótulo de la escena 5
  antes de publicarlo.» (En el HTML, «portal» va en minúscula y la ruta de la
  spec va como texto.)

### Decisiones tomadas dentro del encargo, a revisar

1. **No usé «nuestro equipo confirma la recepción»** (el ejemplo del encargo):
   «confirma» se puede leer como «te lo confirmamos», otra forma del mismo aviso.
   La 0516 descartó una frase parecida por lo mismo. Queda «la recibe y la
   identifica por la etiqueta», que ya dice la FAQ pública de `/pre-alertas`.
2. **También salió «escaneando» del texto.** El escaneo es la recepción en el
   sistema que hoy no se hace. En el video conservé las indicaciones visuales del
   escaneo (hilo conductor, props, «beep», match cuts y el plano de la escena 5):
   no le prometen nada al cliente. Si Sam prefiere no mostrar escaneo hasta que la
   bodega registre en el sistema, es otro ajuste.
3. **La parada de la ruta dice «recibe tu carga»** y no «recibe e identifica»: la
   ruta va en mono de 8,5 px sin cortes de línea y las paradas no encogen; 15
   caracteres contra los 18 de hoy garantizan que la fila no crezca.
4. **La constante no se mueve a `lib/shared/`.** El encargo pide la misma
   constante; moverla tocaría los consumidores de la 0514 y la 0516 y el archivo
   que cambia la PR #215. Frontera medida con ESLint por stdin, como
   `components/servicios/Sonda.tsx`: import de
   `@/lib/portal/tracking-en-construccion` → exit 0; control con
   `@/lib/studio/foo` → exit 1, «'@/lib/studio/foo' import is restricted from
   being used by a pattern. Frontera: el sitio público no importa código del
   ERP…». Como es el primer import de `lib/portal` dentro de la frontera pública y
   ESLint sólo mira imports directos, la prueba nueva exige que el módulo de la
   constante no tenga imports ni reexportaciones.
5. **No toqué el comentario de `lib/portal/tracking-en-construccion.ts` ni el
   `significa` de `scripts/feature-constants.json`.** La PR #215 cambia esas
   mismas líneas y se cruzarían. Propuesta para cuando entre la #215 (no
   decisión): agregar al comentario «Fuera del Portal, también la ficha de
   pre-alerta de `/servicios` (`components/servicios/hub-fichas.tsx`, SDD-0519)
   deja de prometer el aviso de llegada.», y en el `significa`, «SDD-0519» en la
   lista y «y la ficha de pre-alerta de /servicios deja de prometer el aviso de
   llegada a bodega». El gate `feature-constants` sólo compara valores: sigue
   verde sin ese cambio.

## `/ui-check` (diff de SDD-0519)

```
UI-CHECK · diff SDD-0519 (components/servicios/hub-fichas.tsx, ficha Pre-alerta)
Hallazgos (3):
1 ⭐ [baja] hub-fichas.tsx:816 — la parada de la ruta va en mono 8,5 px sin
   cortes de línea y las paradas no encogen (.f2route .stop, flex 0 0 auto). Se
   eligió «recibe tu carga» (15 caracteres, contra 18 de hoy): el ancho no puede
   crecer. Sin cambio pendiente.
2  [baja] hub-fichas.tsx:860-870 — el actor 3 pasa de ~82 a ~65 caracteres. La
   grilla de actores usa align-items: stretch, así que las tres tarjetas siguen
   con la misma altura; en el teléfono van en una columna.
3  [baja] hub-fichas.tsx:896-906 — el paso 5 pasa de ~95 a ~87 caracteres. Sin
   ancho fijo que medir.
Lo que está bien: mismos elementos, clases y negritas; cero hex; sin colores,
tamaños ni elementos interactivos nuevos; sin CTA nuevo; tuteo («Recibe», «la
identifica»), sin voseo (scripts/buscar-voseo.mjs: OK); alineado a la izquierda.
Veredicto: OK para commit.
```

Contraste: no cambia ningún par texto/fondo. Capturas: no se tomaron; el cambio
es sólo de texto dentro de los mismos elementos.

## Guion de smoke para Sam

Después de que la PR esté desplegada. Sólo mirar; no hace falta iniciar sesión.
En la computadora y en el teléfono.

| # | Pantalla | Qué tienes que ver | Es falla si… |
|---|---|---|---|
| 1 | `dtdcargo.com/servicios`, en «Recepción en bodega» toca «Pre-alerta de compra» (o abre `dtdcargo.com/servicios#svc/pre-alerta`) | En la franja azul de la ruta, la tercera parada dice «OPERARIO YIWU» y debajo «RECIBE TU CARGA». | Dice «ESCANEA Y TE AVISA». |
| 2 | La misma ficha, sección «¿Qué es?», tercer recuadro «3 Operario en Yiwu» | «Recibe tu mercancía cuando llega y la identifica por la etiqueta.» | Aparece «te avisamos», «al instante» o «escaneando». |
| 3 | La misma ficha, «¿Cómo funciona?», paso 5 | «Cuando tu mercancía llega a Yiwu, el operario la recibe y la identifica por la etiqueta.» | Aparece «escaneando» o «te avisamos». |
| 4 | El resto de la ficha | Igual que siempre: «¿Por qué te conviene?», «Reglas y condiciones» y «Precio» con su botón «Pre-alerta tu compra en el portal». | Falta una sección o cambió su texto. |
| 5 | Otra ficha cualquiera del hub, por ejemplo «Validación» | Igual que siempre. | Cambió algo. |

Los documentos de marketing no se ven en el sitio. Si quieres revisarlos:
Studio › Marketing › Documentos, «prealerta-compra» y «brief-prealerta»; el HTML
de producción se abre con doble clic desde `docs/marketing/assets/`.

## Validación

Sobre el árbol de trabajo encima de `origin/main` `3086befb`.

| Comprobación | Resultado |
|---|---|
| `corepack pnpm sdd:next` (inventario, instaló dependencias con el lockfile) | PASÓ: «252 refs + worktrees; spec siguiente: 0519». Coincide con la asignación. |
| Prueba nueva `hub-fichas-sin-promesa-bodega.test.tsx` | PASÓ, 6/6 |
| Control rojo: prueba nueva con `hub-fichas.tsx` de `origin/main` `3086befb` (script en el scratchpad, archivo restaurado: true) | PASÓ como control: «Tests 2 failed \| 4 passed (6)». Caen los 2 «prendido» («expected 'escanea y te avisa' to be 'recibe tu carga'» y «expected 'DTDCargoTu orden · no es un servicioA…' not to match /te avis/i»); pasan «apagado», «el resto de la ficha no cambia», «las demás fichas no cambian» y «el módulo no tiene imports». |
| Mutantes (10, reemplazo exacto con una sola aparición, archivo restaurado y comprobado byte a byte) | PASÓ: 10/10 muertos; control «Tests 6 passed (6)» antes y después. M1 la parada ignora el interruptor → 2 failed. M2 el actor 3 ignora el interruptor → 2 failed. M3 paso 5 invertido → 3 failed. M4 interruptor leído invertido → 3 failed. M5 valor fijo `true` → 1 failed (apagado). M6 el paso 5 neutro vuelve a decir «te avisamos» → 2 failed. M7 otro texto de la ficha cambia con el interruptor → 1 failed («el resto de la ficha no cambia»). M8 la ficha de Validación cambia con el interruptor → 1 failed («las demás fichas no cambian»). M9 el módulo de la constante importa `@/lib/db/server` → 1 failed. M10 el módulo reexporta otro → 1 failed. M9 y M10 mutan `lib/portal/tracking-en-construccion.ts`, fuera del diff: prueban la premisa de la que depende el import nuevo. |
| `vitest related --run --reporter=verbose components/servicios/hub-fichas.tsx lib/portal/tracking-en-construccion.ts` | PASÓ: «Test Files 6 passed (6)», «Tests 34 passed (34)». Por archivo: `compras/[code]/page.test.tsx` 6, `PortalAlertasHub.test.tsx` 3, `(app)/page.test.tsx` 2, `PortalTrackingEnConstruccion.test.tsx` 10, `hub-fichas-sin-promesa-bodega.test.tsx` 6, `hub-fichas.test.tsx` 7. Incluye las de la 0514 y la 0516. |
| `node_modules/.bin/tsc --noEmit` (sin tubería, salida a archivo) | PASÓ (exit 0, sin salida) |
| eslint de `hub-fichas.tsx`, la prueba nueva y `tracking-en-construccion.ts` | PASÓ (exit 0, sin salida) |
| Frontera ESLint con sondas por stdin | PASÓ: detalle en «Decisiones», punto 4 |
| `node scripts/check-feature-constants.mjs` | PASÓ: «feature-constants: 6 bandera(s) coinciden con lo declarado» (no se tocó) |
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ: «índice sincronizado con 502 specs» |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ: «numbering: sin números repetidos» (con los choques históricos de migraciones ya aplicadas, que no se renumeran) |
| `node scripts/buscar-voseo.mjs` | PASÓ: «sin voseo en copy · 92 formas buscadas en app, components, lib». Los `.md` y el HTML de marketing no los cubre; se revisaron a mano. |
| Guion del brief contra el del HTML (script en el scratchpad) | PASÓ: 6 bloques, los 6 iguales. Control: con el bloque [Con seguridad] viejo en una copia del HTML, sale «hay diferencias» y exit 1. |
| JavaScript del HTML de producción (`vm.Script` sobre el `<script>` inline) | PASÓ: «script 0: compila» |
| `git diff --check` (y `--cached` antes de cada commit) | PASÓ |
| `/ui-check` | PASÓ: OK para commit (bloque de arriba) |
| `pnpm verify` completo | NO EJECUTADO: el encargo pide validación liviana; el Director reserva el turno de corridas pesadas |
| vitest completo, e2e, Docker, build | NO EJECUTADO: mismo motivo. No hay e2e que busque estos textos (`git grep` en `e2e` sin resultados). |
| `pnpm governance:check`, `pnpm components:check` | NO EJECUTADO: no hay componentes ni patrones nuevos; los incluye `pnpm verify` |
| Smoke en `/servicios` desplegado | NO EJECUTADO: requiere el despliegue; queda el guion para Sam |
| `corepack pnpm knowledge:status` | Ejecutado (exit 0, `ok: false`): structural `INVALID`, semantic `INVALID`, cobertura semántica global `INVALID`, Archify `PENDING`, Obsidian `PENDING`. Este worktree no tiene `graphify-out`; es el mismo estado que registraron la 0516 y la 0517 y no lo causa este cambio. |
| `graphify update`, `knowledge:visual`, `knowledge:publish --preview` | NO EJECUTADO: el worktree no tiene derivados de Graphify ni el runtime de Archify; la publicación la hace el Director desde main integrado |

## Impacto documental

- Documento canónico nuevo: la spec 0519. Cambian tres documentos del árbol de
  marketing (la ficha de pre-alerta, su brief de video y el HTML de producción);
  no cambian `BRAND.md`, el Norte ni los runbooks.
- `docs/marketing/README.md`: no se toca (fuente del piloto semántico). Propuesta
  para el Director, no decisión: una línea bajo «Cómo usar este tree» desde main,
  con su recibo, por ejemplo: «**Pre-alerta sin promesa de aviso (SDD-0519,
  2026-10-14):** mientras la bodega de China registre en Excel, la ficha
  `prealerta-compra.md`, su brief de video y el HTML de producción no prometen el
  aviso de llegada a bodega; la [SDD-0519](../specs/0519-servicios-sin-promesa-bodega/spec.md)
  tiene el texto original para volver cuando el seguimiento esté activo.»
- Ninguno de los archivos tocados es fuente del piloto semántico
  (`scripts/knowledge-policy.json`, 16 fuentes): sin recibo semántico propio.
- Graphify: entra 1 prueba nueva y 1 arista de import nueva
  (`components/servicios/hub-fichas.tsx` → `lib/portal/tracking-en-construccion.ts`).
  Pendiente global: actualización estructural desde main integrado, a cargo del
  Director.
- Obsidian: nada que revisar fuera de la publicación habitual desde main.
- Vercel: `ignoreCommand` mira sólo el último commit; el último de esta rama toca
  código, así que no cancela el build de Preview. Los cambios de `docs/marketing`
  también disparan build por sí solos.

## Cierre

- **OBJETIVO ORIGINAL:** que la página pública de servicios y el material de
  marketing no prometan un aviso automático de llegada a bodega mientras la bodega
  de China registre en Excel y el seguimiento esté en construcción; en la página,
  con el interruptor de la 0514 (con `false`, el texto de hoy); en marketing,
  texto cierto hoy y una nota de cómo volver citando la SDD-0519.
- **COMPLETADO:** la ficha de pre-alerta de `/servicios` muestra los tres textos
  neutros con el interruptor encendido y los de hoy con el interruptor apagado;
  las demás fichas no cambian; el import de la constante pasa la frontera ESLint
  y la prueba exige que su módulo no tenga imports. Los tres documentos de
  marketing quedan sin la promesa (texto, rótulo, guion y la notificación del
  video) y con su nota. 6 pruebas nuevas, control rojo contra main, 10 mutantes
  muertos, pruebas de la 0514 y la 0516 en verde. Criterios 1 a 5 de la spec
  cumplidos con evidencia local. La spec queda `in-progress`: falta el smoke de
  Sam.
- **VALIDACIÓN:** tabla de arriba.
- **COMMITS:** en `codex/servicios-sin-promesa-bodega`:
  1. `docs(sdd): SDD-0519 — spec e índice de servicios y marketing sin promesa de bodega`.
  2. `docs(marketing): SDD-0519 — la pre-alerta no promete el aviso de bodega en su ficha ni en su video`.
  3. `feat(DTD-0519): la ficha de pre-alerta de /servicios no promete el aviso de bodega mientras el seguimiento está en construcción`: código, prueba y este documento (commit que contiene este documento). Es el último y toca código.

  Los hashes finales van en la PR y en el reporte al Director.
- **PR / BRANCH:** en draft contra `main` desde `codex/servicios-sin-promesa-bodega`
  (URL en el reporte al Director y en la propia PR). Worktree arriba.
- **PENDIENTES DE ESTA TAREA:**
  - Smoke de Sam con el guion de arriba, después del despliegue.
  - `pnpm verify` completo cuando el Director dé el turno.
  - Pasar la spec a `done` cuando el smoke pase.
- **FUERA DE ALCANCE DETECTADO:**
  - `components/servicios/hub-fichas.tsx:923` (misma ficha, «¿Por qué te
    conviene?») y `docs/marketing/servicios-infografias/prealerta-compra.md:32`
    (líneas con este cambio aplicado):
    «Ves el estado de tu compra en todo momento.» No promete un aviso, pero con el
    seguimiento en construcción el Portal dice «Muy pronto vas a ver aquí cada paso
    de tu carga». Propuesta, no decisión: con el interruptor encendido, «Tu compra
    queda registrada en tu portal desde el primer día.»
  - `app/pre-alertas/page.tsx:114` (página pública `/pre-alertas`): «tú sigues cada
    paso desde el portal», y su panel de ejemplo con el estado «En bodega Yiwu ·
    Recibida e inspeccionada con fotos». Mismo «estado automático».
  - Arte final de la infografía de pre-alerta en Cloud Design («Tanda 1 · Arte
    Final»), fuera del repo: si trae «te avisamos», hay que corregirlo allá.
  - Video de pre-alerta: no hay evidencia en el repo de que ya esté grabado (sin
    `dtd-video-prealerta.mp4`; la pre-alerta no tiene campo de video en el Portal;
    no se consultó la base). Si se grabó, hay que regrabar el bloque [Con
    seguridad] y el rótulo de la escena 5.
  - `brief-prealerta.md:40` y `produccion-videos-dtd.html:381`: la escena 1 trae como opción «un
    teléfono con una notificación de compra confirmada». No es un aviso de bodega;
    no verifiqué que el Portal mande esa notificación.
  - Inferencia, no medida: en el teléfono la ruta de la ficha podría no caber.
    Cuenta hecha a mano, suponiendo 0,6 em por carácter más el espaciado de
    0,06 em (5,6 px por carácter a 8,5 px) y paradas que no encogen: las tres
    etiquetas de hoy suman ~320 px (~303 px con «recibe tu carga»), más ~24 px de
    márgenes de los segmentos. A 360 px de pantalla, si el contenedor deja 20 px
    por lado, `.f2route` tiene ~280 px. Esta tarea no la ensancha; convendría
    medirla en un navegador.
- **HANDOFF AL DIRECTOR:**
  - Siguiente acción: revisar la PR draft; si está bien, pasarla a lista, pedir el
    turno de `pnpm verify` y fusionar con la autorización de Sam. El merge
    despliega a producción.
  - Decisiones a revisar con Sam: puntos 1 a 3 de «Decisiones» y el alcance
    ampliado a las tres frases de la ficha y a la escena y el corte del video.
  - Archivos compartidos: `docs/specs/README.md` (índice; la #215 también agrega
    su fila: al traer main, regenerarlo con el script, que GitHub no tiene el
    driver). Con la #215 no se comparte nada más: `lib/portal/tracking-en-construccion.ts`
    y `scripts/feature-constants.json` quedaron sin tocar a propósito (punto 5).
  - Ownership: claim liberado al terminar la escritura (`release --owner
    worker-0519-servicios-sin-promesa-bodega`). No hay sesiones consumidoras de
    este worktree. No borrar worktree ni rama hasta que la PR se integre.
