# Cuentas del portal creadas por link antes de la migración 0559

SDD-0646, decisión D-1 (opción C). Corrida **única**, del Director General, con OK nominal de Sam.

## Qué hace

Al aplicar la 0559, las cuentas del portal que ya habían nacido de un link de registro quedan
«sin comprobar», pero su cuenta de Auth todavía lleva el correo que escribió el cliente. Este
script pasa cada una a su dirección interna (la que la 0559 ya le asignó) y lo anota en la base.

No manda ningún correo. El enlace de comprobación lo envía el equipo desde
**Clientes › Registros por link › «Reenviar comprobación»**, que además hace este mismo paso para
esa cuenta si todavía falta.

## Cuándo

1. Aplicar la 0559 (runbook de producción, OK nominal de Sam).
2. Publicar la app que la usa.
3. Correr este script: primero el ensayo, después `--aplicar`.

Hasta el paso 3, las cuentas por link ya creadas siguen como antes de la enmienda.

## Cómo

```bash
node infra/ops/portal-correo-comprobacion/pasar-cuentas-a-direccion-interna.mjs
```

```bash
node infra/ops/portal-correo-comprobacion/pasar-cuentas-a-direccion-interna.mjs --aplicar
```

- Sin `--aplicar` es un **ensayo**: cuenta y no escribe nada.
- Lee `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del entorno. No los imprime y no los toma de
  ningún archivo del repo.
- La salida son conteos e ids internos de la fila de comprobación. Ni correos, ni nombres, ni
  Shipping Marks.
- Es idempotente: volver a correrlo sólo procesa las que falten.
- Sale con código 1 si alguna cuenta quedó «con problema» (no se tocó).

## Después

El cliente sigue entrando con su sesión y con el acceso por WhatsApp. Para que su correo vuelva a
servir para pedir el enlace en `/entrar`, tiene que confirmarlo con el enlace de comprobación.

Pruebas: `lib/studio/__tests__/registro-link-correo-estado.test.ts`.
