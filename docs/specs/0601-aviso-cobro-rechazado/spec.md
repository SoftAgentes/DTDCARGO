---
sdd: "0601"
title: "Aviso del cobro no registrado: por qué y a quién acudir"
status: in-progress
author: "Claude"
created: 2026-11-03
updated: 2026-11-03
supersedes: null
superseded_by: null
related: ["0488", "0573", "0591", "0593"]
confidencialidad: interno
---

# SDD-0601 — Aviso del cobro no registrado: por qué y a quién acudir

> Quien cobra hoy ve «No se pudo registrar el cobro.» y nada más. Tiene que saber por qué no entró, qué pasó con la factura y a quién acudir.

## Contexto

Pedido de Sam, literal, transmitido por el Director General: «Mejorarlo antes de usar el ERP», sobre «No se pudo registrar el cobro.». Encargo del Director: que diga por qué y a quién acudir, con la frase exacta para pedirle el OK a Sam antes de publicarla.

`registerCollectionFor` (`lib/studio/collections-actions.ts`) traduce los rechazos `PAYMENT_*` de la RPC. Todo lo demás cae en el texto genérico. Desde la 0497, la base también frena un cobro si el asiento de venta de la factura no es válido, con un texto en español que no llega a la pantalla.

**Medido en prueba el 2026-11-03,** en `dtd-cargo-staging`, por el borde y con el JWT real de `accounting`, sobre `F-0573-5001` y `F-0573-5002`, emitidas y con su venta anulada:

| Pedido | Respuesta | Factura y recibos |
|---|---|---|
| Parámetros válidos | HTTP 400 · `23514` · «La venta original requiere revisión.» | Igual; recibos de 2 a 2 |
| `p_payer_kind` inválido | HTTP 400 · `23514` · texto de un CHECK, en inglés | Igual; recibos de 2 a 2 |

El segundo fue un error de mi guion, y prueba que existe otro camino al texto genérico.

**Sin respuesta.** `postgrest-js` 2.106.1 devuelve `status: 0` y `code: ""` si el pedido falla, leído en su `dist/index.cjs`; no lo provoqué. En ese caso el cobro pudo haber entrado: la respuesta se puede perder después del COMMIT. Decir «la factura sigue igual» sería falso, y reintentar podría duplicar un cobro parcial, porque la RPC no tiene clave de idempotencia y el saldo solo frena lo que lo supere.

## Alcance

### Los tres avisos

`F-2026-0031` es el código real de la factura.

**Aprobados por Sam.** Literal, «Apruebo las tres», en el chat de Director General, 2026-11-03 ~18:05Z, viendo estas tres frases exactas y la excepción a ERR-01 de la tabla de gobernanza. También vio el aviso de que hoy no existe pantalla para reparar esa factura. Lo transmitió el Director General y se registra a su nombre.

| Caso | Cuándo | Aviso |
|---|---|---|
| Asiento de venta | La base da uno de los 3 motivos de la 0497 | «No se registró el cobro y la factura F-2026-0031 sigue igual: su asiento de venta tiene un problema. Intentarlo otra vez no lo arregla. Avísale a un administrador con el número de factura.» |
| Otro rechazo | Respuesta HTTP ≥ 400 con código de Postgres o de PostgREST, sin traducción | «No se registró el cobro y la factura F-2026-0031 sigue igual: el sistema lo rechazó por un motivo que no reconoce. Avísale a un administrador con el número de factura.» |
| Sin confirmar | Sin respuesta, o respuesta sin recibo | «No se pudo confirmar si el cobro entró: se perdió la comunicación con el sistema. Recarga la página y revisa la factura F-2026-0031 antes de intentarlo otra vez. Si sigue fallando, avísale a un administrador.» |

**«Un administrador»** sigue el uso del Studio («pídele acceso a un administrador», `DeniedToast`), y va en las frases que Sam aprobó. Quien cobra tiene rol `accounting` o `admin`, así que «Contabilidad» no serviría de destino.

### Qué no cambia

- Los mensajes de `PAYMENT_*`, ni dónde se muestran: el bloque `role="alert"` de Cobranzas y el del detalle de factura.
- La base, las RPC y las migraciones.
- Las otras operaciones: identificar y anular un recibo conservan su texto.

### Registro en el servidor

Los tres casos dejan `console.error` con el código de la factura y el código del error. Nunca el texto de la base, que puede traer datos.

### Allowlist

- `lib/studio/collections-actions.ts`
- `lib/studio/__tests__/collections-identify.test.ts`
- `docs/specs/0601-aviso-cobro-rechazado/spec.md`
- `docs/specs/README.md`
- `.agents/handoffs/0601-aviso-cobro-rechazado.md`

### Gobernanza

| Regla | Clasificación |
|---|---|
| ERR-01: qué ocurrió, qué se conservó y qué puede hacer la persona | Cumplimiento en los tres avisos |
| ERR-01: el error aparece cerca de su causa, sin depender de un toast | Cumplimiento: no cambia el bloque que ya existe |
| ERR-01: el servidor traduce a copy seguro, sin SQL ni PII | Cumplimiento, con prueba |
| ERR-01: reintentar no duplica la mutación | **No conformidad heredada.** La RPC no tiene clave de idempotencia. El aviso lo mitiga: pide revisar antes de reintentar. Por decisión del Director General queda abajo, fuera de alcance |
| ERR-01: fallo de sistema con ID de soporte | **Excepción aceptada por el Director General,** y vista por Sam al aprobar. En lugar de un ID, el número de factura en el aviso y el rastro en el servidor. Alcance: solo los tres avisos de esta spec; no vale para otras operaciones ni pantallas |
| ERR-01: el primer error recibe foco | No aplica a este cambio: no se toca el bloque |

## Aceptación

1. Cada uno de los 3 motivos de la 0497 muestra el aviso de asiento de venta, y ese texto existe tal cual en la migración.
2. Un rechazo sin traducir, de Postgres o de PostgREST, afirma que la factura sigue igual y no muestra el texto de la base.
3. Sin respuesta, o con un 200 sin recibo, **no** afirma que la factura sigue igual.
4. Los rechazos `PAYMENT_*` conservan su mensaje y no pasan por el registro.
5. El registro lleva factura y código, nunca el texto de la base.
6. Ningún camino crea el asiento del cobro si no hay recibo.
7. Sam aprueba el texto antes de publicarlo. Cumplido: «Apruebo las tres», registrado arriba.
8. Antes de publicar, el aviso se ve en pantalla en prueba. **NO EJECUTADO.** Prueba tiene una sola ranura, reservada para la tanda A, que subirá `main` entero, y el Director General decidió no redesplegar por esto. Se mira en esa subida; si esta spec ya está en `main` para entonces, se comprueba ahí sin otro despliegue.

## Fuera de alcance

- **Clave de idempotencia en `register_collection_receipt`.** No conformidad heredada con ERR-01. Es migración aparte.
- **Reparar una venta inválida.** No encontré pantalla para eso: «Por contabilizar» es de solo lectura, y el asiento de venta solo se crea al emitir. Si es así, el administrador que reciba el aviso no puede arreglarla sin ayuda técnica. Sam lo vio al aprobar los avisos.
- **El panel sigue abierto con «Al día»** después del rechazo (visto en la SDD-0573).
- **Los mismos motivos de la 0497 en identificar y anular un recibo:** no los revisé.
- **`readErr` da «Factura no encontrada.»** también si falla la conexión.
- **El literal viejo en `cobranzas/actions.ts` y `facturacion/actions.ts`:** es una red para un resultado sin `error` ni `fieldErrors`, que `registerCollectionFor` no devuelve.
