---
sdd: "0276"
title: "Una sola puerta pública: /entrar unifica acceder y crear cuenta"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-08-20
updated: 2026-08-20
supersedes: null
superseded_by: null
related: ["0061", "0094", "0225", "0253", "0259"]
confidencialidad: interno
---

# SDD-0276 · Una sola puerta pública: `/entrar`

## Decisión

El sitio público pasa de **dos puertas de cuenta** a **una**. El nav lleva un
único botón, **"Entrar o crear cuenta" → `/entrar`**, y esa pantalla ofrece
**dos filas de peso comparable**: *Ingresar a mi portal* y *Crear mi cuenta y
Shipping Mark*. `/portal/login` queda como 301 hacia `/entrar`.

Además se cierra el agujero que motivó el trabajo: **el estado "Revisa tu
correo" gana una salida hacia el registro**, y la calculadora pública de
`/tarifas` gana el CTA de cuenta que nunca tuvo.

## Por qué

### 1. El callejón sin salida (lo que de verdad importa)

Medido el 2026-08-20 leyendo el código, no inferido:

- `requestMagicLink` comprueba si el correo existe en `client_users`
  (`actions.ts:82-89`) pero **responde exactamente igual exista o no** —
  anti-enumeración deliberada, documentada en `actions.ts:37-45` y fijada por 6
  tests. Y `signInWithOtp` va con `shouldCreateUser: false`: el login **nunca**
  crea usuarios.
- La pantalla de éxito `MagicSent` **reemplazaba toda la tarjeta** y sólo
  ofrecía "Reenviar enlace", que tampoco enviaría nada.
- El único puente hacia `/registro` era un **enlace de texto de 12,5 px**, y
  desaparecía justo en esa pantalla.

Efecto: quien no tiene cuenta lee *"Te enviamos un enlace a tu@correo"*, espera,
no le llega nada, y se va. Con el **92,8% de los clientes nunca invitados al
portal**, ésa es exactamente la población que caía ahí.

### 2. Dos disparadores que obligaban a elegir antes de entender

"Acceder" (texto) y "Regístrate" (color) convivían en el nav; en la barra móvil
"Acceder" ni aparecía. El visitante tenía que decidir cuál de los dos era él.

## Qué se consideró y no se hizo

**Router por correo** (un campo: si el correo existe → enlace, si no → registro).
Es el patrón de Google y el *sign-in-or-up* de Clerk, y es el más limpio de usar.
Se descarta: **rompe la anti-enumeración** de `actions.ts:37-45` y sus 6 tests.
La variante "ciega" —mandar correo siempre, al conocido el enlace y al
desconocido un "crea tu cuenta"— la conserva, pero convierte la pantalla en un
disparador de correos hacia direcciones arbitrarias: riesgo directo a la
reputación del dominio.

**Pestañas** en vez de dos filas. La confusión clásica de estos formularios es
rellenar el equivocado, y las pestañas la agravan porque esconden la mitad.

## Evidencia externa que respalda la etiqueta

El A/B de **Mozilla Persona** (~1,25 M de impresiones) midió que la palabra
"crear" es lo decisivo: un botón único de sólo-login produjo **12,4× menos
altas** que dos botones; el botón ancho de doble etiqueta rindió **58%**. Por eso
la etiqueta del nav conserva las dos intenciones y no se acorta a "Entrar".

⚠️ El experimento **no traslada 1:1**: medía un widget donde el botón era el
único punto de entrada. En DTD "Regístrate" sigue vivo en hero, home, /shipping-mark,
/pre-alertas, footer y ahora también en la calculadora.

## Alcance

### Se MUEVE

`app/portal/(auth)/login/` → `app/entrar/` (`page.tsx`, `EntrarForm.tsx` —antes
`LoginForm.tsx`—, `actions.ts` y sus tests). `app/entrar/page.tsx` (estática) y
`app/entrar/[code]/page.tsx` (dinámica, SDD-0253) conviven sin chocar.

🔴 **Dos consecuencias del movimiento, ambas deliberadas:**

1. **`robots: noindex` va explícito.** Bajo `app/portal/` lo heredaba de
   `app/portal/layout.tsx:71`. Fuera de ese árbol no lo hereda de nadie.
2. **La tipografía pasa de Sora/Nunito a Archivo.** `app/portal/layout.tsx`
   remapea `--font-archivo*` con el wrapper `.portal-sys`. Ahora manda el layout
   raíz. Es lo coherente: `/registro` y `/entrar/[code]` —las otras dos mitades
   de la misma puerta— ya estaban en Archivo.

### Se CAMBIA

- **`EntrarForm`**: dos filas con título e ícono; el enlace de 12,5 px se
  sustituye por `CrearCuentaBoton`, un `.btn` de 48 px a ancho completo.
  `MagicSent` recibe el mismo botón — se muestra **siempre**, así que no revela
  si el correo existe.
- **`Nav`**: "Acceder" sale de escritorio y drawer; el botón único queda en las
  tres superficies. Docblock actualizado (supersede la jerarquía del 2026-07-31).
- **`next.config.ts`**: nuevo 301 `/portal/login → /entrar`; `/track` y
  `/track/:path*` se reapuntan **directo** a `/entrar` para no encadenar 301→301.
- **25 archivos** con referencias a `/portal/login` reapuntados, incluidos los
  correos de bienvenida e invitación.
- **`CalculadoraForm` + `TarifasTabs` + `/tarifas`**: bloque "crear mi cuenta"
  bajo el resultado, tras la bandera `showRegisterCta`.

### NO se toca

`requestMagicLink`, el callback, el TTL, la anti-enumeración, el throttle, ni el
wizard de `/registro`.

## La bandera del embed

`showRegisterCta` **nace en `false`**. `TarifasTabs` lo montan dos páginas:
`app/tarifas/page.tsx` y `app/tarifas/embed/page.tsx`. El embed se incrusta en
sitios de terceros —incluidos aliados white-label— donde un "crear mi cuenta con
DTD Cargo" rompería el acuerdo. Se enciende sólo desde `/tarifas`.

🔴 **El precio se muestra siempre y el CTA va DESPUÉS.** Nada de "regístrate para
ver la tarifa": `docs/marketing/adquisicion.md` lo desaconseja explícitamente.

## Aceptación

| # | Criterio | Cómo se verifica |
|---|---|---|
| 1 | Un solo punto de cuenta por superficie del nav, a `/entrar` | `components/Nav.entrada-unica.test.tsx` |
| 2 | La etiqueta conserva la palabra "crear" | idem |
| 3 | Las dos filas existen con sus títulos | `app/entrar/__tests__/entrar-dos-filas.test.tsx` |
| 4 | Crear cuenta es `.btn` de ancho completo, no un enlace | idem |
| 5 | **La salida sigue estando en "Revisa tu correo"** | idem — validado por mutación |
| 6 | Una sola acción primaria en pantalla (BTN-01 §2) | idem |
| 7 | El CTA de la calculadora NO sale en el embed | `components/CalculadoraForm.cta-registro.test.tsx` |
| 8 | El CTA va después del estimado | idem |
| 9 | `/portal/login` → 301 `/entrar` conservando el query | `e2e/smoke.spec.ts` |
| 10 | `/track` llega en UN salto | idem |
| 11 | `/entrar` sin password, con las dos puertas visibles | `e2e/auth.spec.ts` |
| 12 | La anti-enumeración sigue intacta | los 6 tests de `app/entrar/__tests__/actions.test.ts`, sin tocar |

## Medición del nav (obligatoria)

La etiqueta pasó de 10 a 21 caracteres. El precedente está documentado: sumar un
enlace de texto empujó la fila a **1039 px de contenido en 1024 de viewport**.
Se mide `document.documentElement.scrollWidth` contra `innerWidth`; mirar a 1366
no lo muestra.

**Medido en el navegador el 2026-08-20**, sobre `/` en este worktree:

| Viewport | scrollWidth | ¿Desborda? | Logo ↔ hamburguesa | Holgura derecha |
|---|---|---|---|---|
| 1280 | 1265 | no | — | — |
| 1024 | **1009** | no | — | 56 px |
| 500 | 500 | no | 95 px | — |
| 375 | 375 | no | **107 px** | 20 px |

### El ajuste que hizo falta, y por qué

**Antes del ajuste, a 385 px la barra móvil estaba en el límite exacto:** el
wordmark tocaba la hamburguesa (**separación 0**) y el botón tocaba el borde
derecho (**holgura 0**). Medido en el mismo navegador:

| Etiqueta | Ancho del botón móvil |
|---|---|
| `Regístrate` (anterior) | 85 px |
| `Entrar` | 60 px |
| **`Entrar o crear cuenta`** | **146 px** |

La etiqueta cuesta **+61 px**. Con el lockup completo (167 px) el cluster pedía
`20+167+44+8+146+20 = 405 px`, así que a 360 no entraba. Apretar padding,
tipografía y tamaño recuperaba ~44 px: insuficiente.

**Decisión del founder:** en la barra más angosta (`<440px`) se muestra **sólo el
isólogo**, sin el "DTD Cargo" escrito. Libera 137 px. El lockup completo sigue en
el menú desplegable, en escritorio y en el resto del sitio, y la accesibilidad no
cambia — `BrandMark` conserva el `alt` y el `aria-label` con `isologoOnly`.

## Contraste medido

| Elemento | Fondo | Texto | Ratio | AA |
|---|---|---|---|---|
| "Crear mi cuenta" | `--color-white` | `--color-ink` | **16,49:1** | ✅ |

🔴 **Y estuvo mal primero.** El botón salió transparente porque
`globals.css` define `.btn-ghost { background: transparent }` **sin `@layer`**, y
eso le gana a la utilidad `bg-white` de Tailwind. Sobre la parte baja del panel
glass el texto ink medía **4,22:1** — por debajo de AA, y ni el lint ni el
typecheck lo ven. El fondo va inline con el token.

## Fuera de alcance

Anotados, no hechos: llevar el correo a `/registro?email=`; redirects amables
`/login` · `/acceder` · `/iniciar-sesion`; vocabulario parejo en el footer; e2e
del wizard de registro; podar `components/EstimacionForm.tsx` (tiene CTA "Crear
cuenta" y **ningún importador**).

## Hueco declarado

`reportCalcEvent` tiene un payload tipado para el CTA de WhatsApp. Distinguir el
CTA de cuenta pediría columna nueva y migración, así que **por ahora no sabremos
cuánta gente lo usa**. Queda dicho, no resuelto en silencio.
