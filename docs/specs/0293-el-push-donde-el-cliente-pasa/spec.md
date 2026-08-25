---
sdd: "0293"
title: "El botón de notificaciones vivía donde nadie entra"
status: in-progress
author: "founder"
created: 2026-08-24
updated: 2026-08-24
supersedes: null
superseded_by: null
related: ["0148","0156","0283"]
confidencialidad: interno
---

# DTD-0293 — El push, donde el cliente sí pasa

> Sale de descartar B6. La pregunta era "¿mandamos el aviso de Yiwu también por
> push?" y la respuesta medida fue **no sirve de nada** — pero midiendo apareció
> otra cosa que sí.

## Lo que mató a B6

El checklist decía: *"la regla manda sólo correo, y 136 de 484 clientes no tienen
correo; pasarla a `channel: both` los cubre"*. **Falso.** Medido en producción el
2026-08-24:

| | |
|---|---|
| Clientes vivos | **488** |
| Sin correo | **136** |
| Con cuenta de portal | 115 |
| Con push activo | **4** |
| **Sin correo Y con push** | **0** |
| **Sin correo Y con portal** | **0** |

Los 136 sin correo **no tienen ninguno** cuenta de portal, y la razón es
estructural: la invitación al portal se manda **por correo**
(`portalInviteUrl(email)`). Sin correo no hay invitación → sin portal → sin push.
Nunca.

Así que pasar la regla a `both` no alcanza a ninguno de los 136. Lo único que
haría es **notificar dos veces a 4 personas**, que además ya reciben el correo.
**La regla no se tocó.**

## Lo que sí apareció

**115 clientes tienen portal y sólo 4 tienen push: 3,5%.**

La causa está en el código, no en la gente: `PortalPushOptIn` estaba montado
**únicamente en `/portal/soporte`**. El cliente entra al portal a ver su carga,
no a Soporte.

## Alcance

El mismo componente, montado también en el inicio del portal, con copy propio.

### Por qué es seguro ponerlo ahí

**No es un prompt: es un botón.** `Notification.requestPermission()` se llama
dentro de `enable()`, en el `onClick` — nunca al cargar. Eso importa porque el
permiso del navegador es **de un solo tiro**: si el cliente lo niega, queda
negado y recuperarlo exige que entre a la configuración del sitio. Dispararlo
solo al montar habría quemado el permiso de mucha gente.

El componente ya decide por su cuenta cuándo no debe estar: se oculta si el
navegador no soporta push, y si el permiso ya fue negado muestra cómo
desbloquearlo en vez del botón.

### Sin botón de descartar, a propósito

La tarjeta desaparece sola cuando el cliente activa. **No lleva "descartar"**: un
descarte guardado en `localStorage` es justo la forma en que estas tarjetas se
apagan para siempre sin que nadie se entere — y volveríamos al 3,5% sin poder
medir por qué.

### El copy es parametrizable

En Soporte la promesa es *"te avisamos cuando te escribamos"*; en el inicio,
*"te avisamos cuando tu carga se mueva"*. Prometer sólo mensajes en el inicio
subvendería el aviso que al cliente de verdad le importa. Los valores por defecto
son los de Soporte, así que **ese uso no cambia una coma**.

## Lo que esto NO arregla

**Los 136 sin correo siguen fuera.** No pueden entrar al portal, así que ningún
cambio de notificación los alcanza. Las palancas para ellos son operativas, no de
software:

1. Capturar sus correos — la lista sale del CSV de Clientes (SDD-0289), filtrando
   la columna `email` vacía.
2. WhatsApp saliente (necesita Meta).

## Lo que no se verificó

No se probó en un navegador real: ni el permiso, ni la suscripción, ni cómo se ve
la tarjeta en el inicio. Verificado por typecheck, lint, tests y build.

## Adjuntos

Ninguno.
