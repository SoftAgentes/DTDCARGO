---
sdd: "0519"
title: "Servicios y marketing: sin promesa de aviso de bodega mientras el seguimiento está en construcción"
status: in-progress
author: "Claude"
created: 2026-10-14
updated: 2026-10-14
supersedes: null
superseded_by: null
related: ["0514","0516","0517"]
confidencialidad: interno
---

# SDD-0519 — Servicios y marketing: sin promesa de aviso de bodega mientras el seguimiento está en construcción

> Mientras el aviso «Seguimiento en construcción» de la 0514 esté encendido, la
> ficha de pre-alerta de la página pública de servicios deja de prometer que «te
> avisamos» cuando la mercancía llega a Yiwu. El material interno de marketing
> sobre la pre-alerta dice lo mismo, con una nota de cómo volver.

## Contexto

La bodega de China todavía registra la mercancía en Excel y el seguimiento del
Portal está en construcción (SDD-0514). El aviso «recibido en bodega» sólo se
programa cuando la recepción se registra en el sistema, así que hoy no sale
(SDD-0516). Sam aprobó para el Portal (0514 y 0516) que, mientras el interruptor
esté encendido, ningún texto prometa ese aviso; la 0517 aplica el mismo criterio
al registro público (PR #215, abierta).

El handoff de la 0517 (FUERA DE ALCANCE) encontró la misma promesa en la página
pública de servicios y en el material de marketing de la pre-alerta. El Director
asignó esta tarea con el mismo criterio.

Barrido de la superficie de servicios (`components/servicios/` y
`app/servicios/`) buscando «avis», «escane», «notific», «al instante» y
«llega a bodega»: la promesa aparece **tres veces, todas en la ficha «Pre-alerta
de compra»** (`/servicios#svc/pre-alerta`, función `PreAlerta` de
`components/servicios/hub-fichas.tsx`). El encargo nombraba una (el paso 5); las
otras dos son la misma promesa en la ruta y en el bloque de los tres actores de
la misma ficha, y sin cambiarlas la ficha seguiría prometiendo el aviso. Las demás
menciones de la bodega en el hub («cuando tu mercancía llega a nuestra bodega,
la abrimos y contamos…») describen trabajo del equipo y no prometen un aviso.

## Objetivo

Con `TRACKING_EN_CONSTRUCCION = true`, la ficha de pre-alerta no promete un aviso
de llegada a bodega. Con `false`, vuelve el texto de hoy, palabra por palabra. Se
usa el mismo interruptor de la 0514 (`lib/portal/tracking-en-construccion.ts`);
no se crea otro. El material de marketing es interno y no tiene interruptor: se
ajusta a un texto cierto hoy y deja una nota de que puede volver al original.

## Decisión

### Página de servicios: ficha «Pre-alerta de compra»

| Lugar | Apagado (el de hoy) | Encendido |
|---|---|---|
| Ruta, tercera parada «Operario Yiwu» | escanea y te avisa | recibe tu carga |
| «¿Qué es?», actor 3 «Operario en Yiwu» | **Recibe escaneando** la etiqueta cuando llega tu mercancía y **te avisamos** al instante. | **Recibe tu mercancía** cuando llega y la **identifica** por la etiqueta. |
| «¿Cómo funciona?», paso 5 | Cuando tu mercancía llega a Yiwu, el operario **la recibe escaneando** la etiqueta y **te avisamos**. | Cuando tu mercancía llega a Yiwu, el operario **la recibe y la identifica** por la etiqueta. |

Razones:

- **No se usa «nuestro equipo confirma la recepción».** Era el ejemplo del
  encargo, pero «confirma» se puede leer como «te lo confirmamos», que es otra
  forma del mismo aviso. Hoy, para saber si la mercancía llegó, el cliente
  pregunta (la 0516 le indica Soporte). La 0516 descartó una frase parecida por
  el mismo motivo.
- **Sale también «escaneando».** Las etiquetas las genera el sistema y el escaneo
  es la recepción en el sistema que hoy no se hace: la bodega registra en Excel.
  «La identifica por la etiqueta» es cierto con cualquiera de los dos registros, y
  repite lo que ya dice la FAQ pública de `/pre-alertas`: «Con tu Shipping Mark,
  nuestro equipo en Yiwu identifica tu carga al recibirla».
- **La parada de la ruta dice sólo «recibe tu carga».** Va en mayúsculas
  monoespaciadas de 8,5 px, sin cortes de línea, y las paradas no encogen
  (`.f2route .stop` en `app/globals.css`, `flex: 0 0 auto`). Con 15 caracteres
  contra los 18 de «escanea y te avisa», la fila no puede quedar más ancha que
  hoy: en una fuente monoespaciada el ancho sale del número de caracteres. La
  identificación por la etiqueta la cuentan el actor 3 y el paso 5.
- **No se agrega «escríbenos» ni un CTA.** En la página de servicios no van CTA
  nuevos («los servicios informan, no venden»); el Precio de la ficha conserva el
  suyo de siempre.
- **La constante se importa desde `components/` sin moverla a `lib/shared/`.**
  El encargo pide la misma constante. `components/**` está dentro de la frontera
  pública de `eslint.config.mjs`, pero el grupo restringido es `@/lib/studio/**`,
  `@/lib/db/**`, `@/app/studio/**` y `@supabase/*`; `@/lib/portal/**` no lo está.
  Medido con ESLint por stdin, como `components/servicios/Sonda.tsx`: el import de
  `@/lib/portal/tracking-en-construccion` sale con exit 0, y el control con
  `@/lib/studio/foo` sale con exit 1 y el mensaje de la frontera. Moverla tocaría
  los consumidores de la 0514 y la 0516 y el archivo que edita la PR #215.
- **El módulo de la constante no puede importar nada.** Es la primera vez que un
  archivo dentro de la frontera pública importa `lib/portal`, y ESLint sólo mira
  imports directos: si `tracking-en-construccion.ts` importara la base, la página
  pública la arrastraría sin que el lint lo vea. La prueba nueva lo convierte en
  propiedad: falla si el módulo tiene cualquier import o reexportación.
- **Sin cambios visuales.** Mismos bloques, clases y negritas; sólo cambia el
  texto. Sin colores, tamaños ni elementos nuevos.
- **«Ves el estado de tu compra en todo momento.»** (beneficios de la misma ficha)
  no se toca: no promete un aviso de bodega y el encargo es sobre el aviso. Queda
  anotado como fuera de alcance en el handoff.

### Material de marketing

Son documentos internos, sin interruptor. Se cambia la promesa por el texto
neutro de la ficha web y se deja en cada archivo una nota corta que cita esta
SDD. El texto de antes queda en esta tabla y en el historial de Git.

| Archivo | Lugar | Antes | Después |
|---|---|---|---|
| `docs/marketing/servicios-infografias/prealerta-compra.md` | «¿Cómo funciona?», paso 5 | 5. Cuando tu mercancía llega a Yiwu, el operario **la recibe escaneando** la etiqueta y **te avisamos**. | 5. Cuando tu mercancía llega a Yiwu, el operario **la recibe y la identifica** por la etiqueta. |
| `docs/marketing/servicios-infografias/videos/brief-prealerta.md` y `docs/marketing/assets/produccion-videos-dtd.html` | Concepto | … tu mercancía llega a la bodega en China, se recibe escaneando, y te avisamos. … | … tu mercancía llega a la bodega en China y nuestro equipo la recibe y la identifica por su etiqueta. … |
| (los dos) | Escena 5 «Paso 3 — nuestra bodega» | b-roll real en Yiwu: el operario recibe la caja y **escanea la etiqueta** → corte al teléfono del cliente recibiendo el aviso "tu mercancía llegó a la bodega" (mock del portal, cuenta demo). | b-roll real en Yiwu: el operario recibe la caja y **escanea la etiqueta** (plano detalle: la etiqueta cierra el hilo conductor). |
| (los dos) | Rótulo de la escena 5 | "3 · La recibimos escaneando · te avisamos" | "3 · La recibimos y la identificamos" |
| (los dos) | Guion, cuarto bloque [Con seguridad] | Cuando tu mercancía llega a nuestra bodega en China, la recibimos **escaneando su etiqueta** y te avisamos al momento. Y en la misma pre-alerta eliges los servicios de la llegada: Validación, Inspección, Etiquetado y más. | Cuando tu mercancía llega a nuestra bodega en China, la recibimos y la identificamos **por su etiqueta**. Y en la misma pre-alerta eliges los servicios de la llegada: Validación, Inspección, Etiquetado y más. |
| (los dos) | Edición, corte 5 | Corte del escaneo en bodega a la notificación en el teléfono del cliente (causa → efecto). | Del escaneo en bodega, corte a la pantalla del portal con los servicios de la llegada (escena 6). |

Razones:

- **Las indicaciones visuales del escaneo se conservan** (hilo conductor, props,
  SFX del «beep», match cuts y el escaneo de la escena 5). Muestran cómo el
  operario lee la etiqueta y no le prometen nada al cliente. Lo que se quita es
  lo que promete el aviso: la frase hablada, el rótulo, el concepto y el corte al
  teléfono del cliente con la notificación.
- **El guion del HTML y el del brief quedan iguales palabra por palabra**, como
  pide el propio HTML («Guiones — fuente: sección (b) de cada brief»).
- **No hay evidencia de que el video ya esté grabado.** En el repo no existe
  `dtd-video-prealerta.mp4`, la pre-alerta no tiene campo de video en el Portal
  (los `videoUrl` son de los servicios extra, y los siete valores por defecto de
  `lib/studio/prealertas/addons.ts` son `null`) y el progreso del HTML se guarda
  en el navegador de cada productor. No se consultó la base. Si el video ya se
  grabó con la frase vieja, este cambio no lo corrige: hay que regrabar el bloque
  [Con seguridad] y el rótulo de la escena 5, o no publicarlo hasta que el
  seguimiento esté activo.
- **Arte final de la infografía:** la ficha `prealerta-compra.md` alimenta el arte
  de Cloud Design («Tanda 1 · Arte Final»), que no está en el repo. Si ese arte ya
  trae «te avisamos», hay que corregirlo allá; no se pudo comprobar desde aquí.

**Datos personales:** no aplica. Es texto fijo: no captura, no mueve ni borra
datos personales, y no agrega consultas.

## Alcance

Allowlist exacta:

| Archivo | Cambio |
|---|---|
| `components/servicios/hub-fichas.tsx` | Importa `TRACKING_EN_CONSTRUCCION`; en `PreAlerta`, la parada de la ruta, el actor 3 y el paso 5 eligen el texto según el interruptor. |
| `components/servicios/hub-fichas-sin-promesa-bodega.test.tsx` | Nuevo. Ficha de pre-alerta prendida y apagada, y el módulo de la constante sin imports. |
| `docs/marketing/servicios-infografias/prealerta-compra.md` | Paso 5 neutro y nota de la SDD-0519. |
| `docs/marketing/servicios-infografias/videos/brief-prealerta.md` | Concepto, escena 5, rótulo, guion y corte 5 sin el aviso; nota de la SDD-0519. |
| `docs/marketing/assets/produccion-videos-dtd.html` | Los mismos cinco cambios en el panel del video 1 y en el guion del teleprompter; nota de la SDD-0519. |
| `docs/specs/0519-servicios-sin-promesa-bodega/spec.md` | Esta spec. |
| `docs/specs/README.md` | Índice regenerado con `node scripts/build-docs-index.mjs`. |
| `.agents/handoffs/0519-servicios-sin-promesa-bodega.md` | Handoff de la tarea. |

Fuera de alcance: datos, consultas, RLS, migraciones, el resto del copy de la
página de servicios y de marketing, `docs/marketing/README.md` (fuente del
piloto semántico; si necesita una línea, va como propuesta en el handoff) y
`app/registro/RegisterForm.tsx` (PR #215). Tampoco se tocan el comentario de
`lib/portal/tracking-en-construccion.ts` ni el `significa` de
`scripts/feature-constants.json`: la PR #215 cambia esas mismas líneas y se
cruzarían; la línea que falta va como propuesta en el handoff.

## Aceptación

1. Con `TRACKING_EN_CONSTRUCCION = true`, la ficha de pre-alerta no contiene «te
   avisamos», «te avisa», «escane» ni «al instante», y muestra los tres textos
   neutros de la tabla.
2. Con `TRACKING_EN_CONSTRUCCION = false`, vuelven los tres textos de hoy, palabra
   por palabra, y no aparece ningún texto neutro.
3. Las demás fichas del hub no cambian con el interruptor.
4. `lib/portal/tracking-en-construccion.ts` no tiene imports ni reexportaciones, y
   el import desde `components/servicios/` pasa la frontera ESLint.
5. En los tres documentos de marketing no queda la promesa del aviso de llegada
   («te avisamos» con la recepción en bodega, ni el corte a la notificación), y
   cada uno tiene la nota de la SDD-0519.

## Evidencia

Detalle en el handoff `.agents/handoffs/0519-servicios-sin-promesa-bodega.md`.

- **Pruebas:** 6 casos en `components/servicios/hub-fichas-sin-promesa-bodega.test.tsx`,
  en verde (criterios 1 a 4); `vitest related` de los archivos tocados, 34/34 en
  6 archivos, con las pruebas de la 0514 y la 0516.
- **Control rojo:** con `hub-fichas.tsx` de `origin/main` `3086befb` y la prueba
  nueva, caen los 2 casos «prendido» y pasan los 4 restantes.
- **Mutantes:** 10 aplicados, 10 muertos, cada uno en el caso que le corresponde,
  con control verde antes y después. Dos mutan el módulo de la constante (un
  import y una reexportación) y caen en el caso del criterio 4.
- **Frontera:** sondas de ESLint por stdin como `components/servicios/Sonda.tsx`:
  `@/lib/portal/tracking-en-construccion` → exit 0; `@/lib/studio/foo` → exit 1.
- **Marketing (criterio 5):** sin «te avisamos» ni la notificación de bodega en
  los tres archivos; el guion del HTML sigue igual al del brief, bloque por
  bloque (6 de 6), y el JavaScript del HTML compila.

## Riesgos y límites

- Igual que en la 0514 y la 0516: si la bodega empieza a registrar en el sistema y
  nadie apaga el interruptor, la ficha sigue neutra. Al apagarlo vuelve sola.
- El material de marketing **no** vuelve solo: no tiene interruptor. Cuando el
  seguimiento esté activo, hay que restaurarlo a mano con la tabla de arriba (las
  notas de cada archivo lo recuerdan).
- Si el video de pre-alerta o el arte final de la infografía ya existen con la
  frase vieja, este cambio no los corrige (ver arriba).
