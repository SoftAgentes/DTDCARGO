---
sdd: 0254
title: Guardar el Shipping Mark en el WhatsApp del cliente al registrarse
status: in-progress
author: Claude (ventana 2026-08-09)
created: 2026-08-09
updated: 2026-08-09
supersedes: null
superseded_by: null
related: [0032, 0059, 0122, 0225, 0248]
confidencialidad: interna
---

# SDD-0254 · Guardar el Shipping Mark en el WhatsApp del cliente

## Problema

Un cliente se registra solo, el sistema le emite su Shipping Mark y le manda el
correo de bienvenida. **Si ese correo rebota, el cliente se queda sin su código
y sin puerta**, y nadie se entera hasta que alguien lee un aviso interno.

Pasó dos veces medido:

- **DTD-9048 · Jessilen Centeno** (2026-08-06): la bienvenida rebotó **14 horas
  después** de salir. Nunca supo su Shipping Mark.
- **DTD-1010 · ABDAL AKIL** (2026-06-07): rebote instantáneo, dos meses sin que
  nadie lo notara.

Y no hay red debajo: la clave de la cuenta que crea el registro es **aleatoria**
([`app/registro/actions.ts`](../../../app/registro/actions.ts) paso 7), así que
la única forma de entrar es un enlace **al correo**. Correo muerto = cliente
encerrado afuera.

## Lo que NO es el problema (y por qué importa)

Dos cosas que parecían el hueco y no lo son — verificadas antes de construir:

1. **La pantalla ya muestra el Shipping Mark**, y bien: tarjeta wine a 52px en
   mono, con la guía de nomenclatura y el instructivo del portal (`StepDone` en
   [`RegisterForm.tsx`](../../../app/registro/RegisterForm.tsx)). El cliente
   **sí lo ve**.
2. **No existe forma de enviarle un WhatsApp.** No hay Meta Cloud API, ni
   Twilio, ni 360dialog en el repo — sólo `NEXT_PUBLIC_WHATSAPP_NUMBER`, que
   sirve para armar links `wa.me` que **abre una persona**. "Mandarle el código
   por WhatsApp automáticamente" no se puede construir hoy.

El hueco real es más chico y más preciso: **lo ve una sola vez y no le queda en
ningún lado suyo.** Cierra la pestaña y, si el correo no llegó, no tiene el
código en ningún sitio que sea de él.

## Decisión

Un botón en la pantalla de éxito: **"Guárdalo en mi WhatsApp"**. Abre el chat
del cliente con DTD Cargo con el mensaje ya escrito; el cliente solo tiene que
enviarlo.

```
Hola, soy Jessilen. Acabo de registrarme en DTD Cargo y mi
Shipping Mark es DTD-9048.
```

Qué resuelve, en orden de importancia:

1. **El código le queda en SU historial de WhatsApp**, que es el lugar donde un
   cliente venezolano busca cosas. No depende del correo.
2. **Abre conversación con el equipo** justo cuando acaba de registrarse — el
   momento de mayor intención. Antes de esto, un registro self-service no
   generaba ningún contacto.
3. **Nos deja el número verificado**: si el mensaje llega, ese WhatsApp existe y
   es de él. Hoy el teléfono es un campo de texto que nadie confirma.

El envío lo hace el cliente desde su teléfono, así que **no necesita API**.

### Por qué secundario y no primario

El primario de esa pantalla sigue siendo **"Ir al portal"**: es el camino feliz.
El de WhatsApp es la red debajo, y va como `btn-ghost` (regla 1 de botones: un
solo primario por contexto).

## Alcance (allowlist exacta)

```
lib/public/markbox-whatsapp.ts                    (nuevo · armado del mensaje, puro)
lib/public/__tests__/markbox-whatsapp.test.ts     (nuevo)
app/registro/RegisterForm.tsx                     (StepDone: el botón)
```

Sin migración: no toca la base.

## Privacidad

El mensaje viaja por `wa.me` con el **nombre de pila y el Shipping Mark** en el
query string. Consideraciones, explícitas:

- Es **dato del propio cliente**, en su propio dispositivo, hacia un chat que él
  decide enviar. No se manda nada sin que apriete "enviar" en su WhatsApp.
- **No agrega un tercero nuevo**: WhatsApp ya es el canal principal de DTD y
  está en [`docs/legal/privacidad/inventario-terceros.md`](../../legal/privacidad/inventario-terceros.md).
- **Se manda lo mínimo**: nombre de pila y código. **Nunca** correo, teléfono,
  cédula/RIF ni dirección.
- El patrón `wa.me?text=` ya es el estándar del sitio público
  (`buildWhatsAppLink` en `lib/design-tokens.ts`).

## Verificación

- Vitest sobre el armado del mensaje: con nombre y sin nombre, tuteo sin voseo,
  y que **no** se cuele ningún dato de más.
- Verificación visual del paso 5 con el servidor local.
- Gate canónico `pnpm verify`.

## Lo que queda afuera (candidato al siguiente slice)

Convertir el aviso interno de "correos que no llegaron" en algo accionable: hoy
llega a la bandeja del founder y muere ahí. La fila del Studio debería traer un
botón **"Escribir por WhatsApp"** con el Shipping Mark ya redactado — que es
exactamente lo que hubo que hacer a mano con DTD-9048 el 2026-08-09.
