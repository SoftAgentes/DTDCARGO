# Cuentas del portal creadas por link antes de la migración 0559

SDD-0646, decisión D-1 (opción C). Corrida **única**, del Director General, con OK nominal de Sam.

## Qué hace

Al aplicar la 0559, las cuentas del portal que ya habían nacido de un link de registro quedan
«sin comprobar». Este script completa el paso que la migración no puede hacer: pasa cada cuenta a
su dirección interna (la que la 0559 ya le asignó) y lo anota en la base.

No manda ningún correo. El enlace de comprobación lo envía el equipo desde
**Clientes › Registros por link › «Reenviar comprobación»**, que además hace este mismo paso para
esa cuenta si todavía falta.

## Cuándo: en la misma ventana que la publicación

1. Aplicar la 0559 (runbook de producción, OK nominal de Sam).
2. Publicar la app que la usa.
3. **Inmediatamente después, sin esperar:** correr este script. Primero el ensayo, después
   `--aplicar`.

Los tres pasos son una sola ventana de trabajo. No se deja el paso 3 para otro día.

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
- Recorre todas las filas por lotes y es idempotente: volver a correrlo sólo procesa las que falten.

## Cuándo está completa

Solo con **código de salida 0** después de `--aplicar`, que significa: ninguna falló y, al volver a
contar, no queda ninguna pendiente; o con **4**, si lo único que queda son filas cuya cuenta de
Auth ya no existe.

| Código | Qué significa | Qué hacer |
|---|---|---|
| 0 | Completa | Nada |
| 1 | Alguna cuenta quedó «con problema» (no se tocó) | Leer el mensaje de esa fila y volver a correr |
| 3 | Después de aplicar siguen quedando pendientes | Volver a correr; si se repite, avisar antes de cerrar la ventana |
| 4 | Terminó; solo quedan filas cuya cuenta de Auth ya no existe | Pasarle al equipo los ids de esas filas (salen en el mensaje). No se reintentan |
| 2 | Faltan las variables de entorno | Definirlas y volver a correr |

### Una fila cuya cuenta de Auth ya no existe

Pasa si la cuenta se borró de Auth después del registro por link. No hay nada que pasar a la
dirección interna. El script **no la toca ni la borra**, la cuenta aparte («su cuenta de Auth ya no
existe») y no la cuenta como pendiente. El ensayo también la detecta, porque solo lee. El equipo
decide qué hacer con ese cliente: revocar su acceso o volver a invitarlo.

## Después

El cliente sigue entrando con su sesión y con el acceso por WhatsApp. Su correo vuelve a servir
para pedir el enlace en `/entrar` cuando lo confirma con el enlace de comprobación, con su portal
abierto.

Pruebas: `lib/studio/__tests__/registro-link-correo-estado.test.ts`.
