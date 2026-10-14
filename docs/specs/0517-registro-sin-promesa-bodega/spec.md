---
sdd: "0517"
title: "Registro público: sin promesa de aviso de bodega mientras el seguimiento está en construcción"
status: in-progress
author: "Claude"
created: 2026-10-14
updated: 2026-10-14
supersedes: null
superseded_by: null
related: ["0514","0516"]
confidencialidad: interno
---

# SDD-0517 — Registro público: sin promesa de aviso de bodega mientras el seguimiento está en construcción

> Mientras el aviso «Seguimiento en construcción» de la 0514 esté encendido, el
> formulario público de registro deja de prometer un aviso por WhatsApp «cuando
> llega a bodega en China».

## Contexto

La bodega de China todavía registra la mercancía en Excel, y el seguimiento del
Portal está en construcción (SDD-0514). La 0516 aplicó el criterio de Sam al
Portal: mientras el interruptor esté encendido, ningún texto promete un aviso de
llegada a bodega que hoy no va a salir.

El registro público (`/registro`) tiene la misma promesa. En el paso 2
(«Contacto»), debajo del título «¿Cómo te ubicamos?», dice:

> El WhatsApp es por donde te avisamos de tu carga: cuando llega a bodega en
> China, cuando zarpa y cuando está lista para entrega.

Lo detectó el handoff de la 0516 (FUERA DE ALCANCE, `app/registro/RegisterForm.tsx:787`).
El Director asignó esta tarea con el mismo criterio que Sam aprobó para la 0514 y
la 0516.

Se revisó todo el registro (`app/registro/page.tsx`, `RegisterForm.tsx` y
`actions.ts`): esa frase es la única que promete un aviso de llegada a bodega. Las
otras menciones de la bodega no prometen avisos: «Este es el código de tus cajas —
lo usamos en bodega y con tu proveedor» y la descripción de la página («el código
que identifica tus cajas en nuestra bodega de Yiwu») describen para qué sirve el
Shipping Mark.

## Objetivo

Con `TRACKING_EN_CONSTRUCCION = true`, el paso Contacto dice algo neutro que no
promete notificaciones. Con `false`, vuelve el texto de hoy, palabra por palabra.
Se usa el mismo interruptor de la 0514 (`lib/portal/tracking-en-construccion.ts`);
no se crea otro.

## Decisión

### Texto

| Interruptor | Texto debajo de «¿Cómo te ubicamos?» |
|---|---|
| Encendido | El WhatsApp es por donde hablamos contigo sobre tu carga. |
| Apagado (el de hoy) | El WhatsApp es por donde te avisamos de tu carga: cuando llega a bodega en China, cuando zarpa y cuando está lista para entrega. |

Para una empresa, el texto sigue empezando por «Registras a <razón social>.», con
cualquiera de los dos valores.

Razones:

- **No se conservan zarpe y entrega, a diferencia de la portada del Portal.** En la
  0516 se conservaron porque esos avisos los disparan operaciones del Studio y
  salen por el navegador. Aquí el canal prometido es WhatsApp, y los avisos
  automáticos al cliente sólo salen por correo o push
  (`NOTIFICATION_CHANNELS = ["email", "push", "both", "none"]` en
  `lib/studio/notifications/client-notification-types.ts`). El propio formulario
  lo dice en la pantalla final: «No es un envío automático —no hay API de
  WhatsApp—» (comentario de la SDD-0254). Una frase que conservara «te avisamos
  cuando zarpa» seguiría prometiendo un aviso por WhatsApp, y el encargo pide un
  texto que no prometa notificaciones. Lectura de código, no medición.
- **«Hablamos contigo» y no «te escribimos».** Describe el canal, en las dos
  direcciones, sin prometer que un evento dispare un mensaje. Es cierto hoy: el
  equipo atiende a los clientes por WhatsApp.
- **Se reemplaza en vez de ocultar.** Sin el texto, una persona natural vería el
  título sin explicación de por qué se pide el WhatsApp, que es el único teléfono
  obligatorio del paso.
- **Sin CTA ni copy de venta.** Es una frase informativa en el mismo `<p>`.
- **Sin cambios visuales.** Mismo bloque, mismas clases y colores. Tuteo
  («hablamos contigo»), sin voseo.

### Dónde vive el interruptor: no se mueve a `lib/shared/`

El formulario importa la constante desde `@/lib/portal/tracking-en-construccion`.
No hace falta moverla, por tres motivos medidos:

1. **`app/registro/` está fuera de la frontera pública a propósito.**
   `eslint.config.mjs` lo nombra entre las rutas públicas respaldadas por la base
   («usan el admin client con el visitante anónimo»), y `app/registro/page.tsx` ya
   importa `@/lib/db/server` y `@/lib/portal/portal-queries`.
2. **El formulario ya importa de `lib/portal`.** `RegisterForm.tsx` usa
   `@/lib/portal/register-types` y `@/lib/portal/register-cities`.
3. **`lib/portal` no está en ningún grupo restringido**, y el módulo del
   interruptor no importa nada, así que tampoco arrastra nada al bundle del
   cliente. Medido con ESLint por stdin: la sonda con ese import sale exit 0 como
   `app/registro/Sonda.tsx` y también como `components/Sonda.tsx` (dentro de la
   frontera); el control con `@/lib/studio/foo` como `components/Sonda.tsx` sale
   exit 1 con «Frontera: el sitio público no importa código del ERP…».

Moverla habría cambiado los imports y los `vi.mock` de la 0514 y la 0516 sin
ningún efecto en el comportamiento. Si más adelante una página dentro de la
frontera (por ejemplo `components/` o `app/servicios/`) necesita el interruptor,
el lint tampoco la frena, pero por espíritu de la frontera conviene llevarlo
entonces a `lib/shared/`.

**Datos personales:** no aplica. Es texto fijo: no captura, no mueve ni borra
datos personales, y no agrega consultas. El campo WhatsApp y su validación no
cambian.

## Alcance

Allowlist exacta:

| Archivo | Cambio |
|---|---|
| `app/registro/RegisterForm.tsx` | Importa `TRACKING_EN_CONSTRUCCION`; el texto del paso Contacto según el interruptor. |
| `app/registro/__tests__/register-sin-promesa-bodega.test.tsx` | Nuevo. Paso Contacto con el interruptor encendido y apagado, persona y empresa. |
| `lib/portal/tracking-en-construccion.ts` | Sólo el comentario: nombra el registro público entre los textos que cambian. El valor no cambia. |
| `scripts/feature-constants.json` | Sólo el `significa` de `TRACKING_EN_CONSTRUCCION`: nombra la 0517 y el registro. El `$doc` del archivo no se toca. |
| `docs/specs/0517-registro-sin-promesa-bodega/spec.md` | Esta spec. |
| `docs/specs/README.md` | Índice regenerado con `node scripts/build-docs-index.mjs`. |
| `.agents/handoffs/0517-registro-sin-promesa-bodega.md` | Handoff de la tarea. |

Fuera de alcance: datos, consultas, RLS, migraciones, el resto del copy del
registro y del sitio público, `components/Analytics.tsx` (lo toca la SDD-0518) y
los textos del Portal de la 0514 y la 0516. `docs/marketing/README.md` no se
toca: su línea sobre `/registro` sigue siendo cierta y el texto temporal queda
dicho aquí y en `scripts/feature-constants.json`.

## Aceptación

1. Con `TRACKING_EN_CONSTRUCCION = true`, el paso Contacto del registro no
   contiene «bodega», «te avisamos», «te notificamos» ni «te avisaremos», y
   muestra el texto neutro de la tabla.
2. Con `TRACKING_EN_CONSTRUCCION = false`, vuelve el texto de hoy, palabra por
   palabra, y no aparece el texto neutro.
3. Para una empresa, el texto sigue empezando por «Registras a <razón social>.»
   con el interruptor encendido.
4. Las pruebas de la 0514 y la 0516 siguen verdes, y el gate de
   `feature-constants` sigue en verde.

## Evidencia

Detalle en el handoff `.agents/handoffs/0517-registro-sin-promesa-bodega.md`.

## Riesgos y límites

- Igual que en la 0514 y la 0516: si la bodega empieza a registrar en el sistema y
  nadie apaga el interruptor, el registro sigue con el texto neutro. Al apagarlo
  vuelve solo, en el mismo commit que el Portal.
- Al apagarlo vuelve también la promesa de avisos por WhatsApp de zarpe y entrega,
  que ya estaba antes de esta tarea. Que esos avisos salgan por WhatsApp depende
  del equipo, no del sistema; no se verificó.
- Hay promesas parecidas fuera del registro, en el sitio público y en material de
  marketing. Quedan anotadas en el handoff como fuera de alcance.
