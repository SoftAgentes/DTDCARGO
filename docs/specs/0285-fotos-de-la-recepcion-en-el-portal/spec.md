---
sdd: "0285"
title: "El cliente ve las fotos de su mercancía en la bodega de Yiwu"
status: in-progress
author: "founder"
created: 2026-08-24
updated: 2026-08-24
supersedes: null
superseded_by: null
related: ["0028","0281","0284"]
confidencialidad: interno
---

# DTD-0285 — Las fotos de la recepción, en el portal

> Convierte "llegaron 7 cajas" en "llegaron, y aquí están".

## Contexto

SDD-0028 montó las fotos de recepción: bucket privado `receipt-photos`, tabla
`warehouse_receipt_photos`, y el operario las sube desde `/m/cn`. Existen y se
usan — medido el 2026-08-24 en producción: **3 fotos sobre 1 de las 6
recepciones**.

Pero sólo las veía el equipo. El cliente, que es el dueño de esa mercancía, no.

Con SDD-0281 (la pantalla de la compra) y SDD-0284 (el vínculo recepción→compra
que hacía que esa pantalla estuviera siempre vacía) ya resueltos, mostrarlas es
el paso que faltaba.

## Alcance

Las fotos de cada recepción, en `/portal/compras/[code]`, abriéndose a tamaño
completo en pestaña nueva — el cliente quiere mirar la etiqueta y el estado del
embalaje, no una miniatura.

## Diseño

### Seguridad — la misma salida de siempre

`warehouse_receipt_photos` tiene RLS por tenant y el bucket también
(`storage.foldername(name)[1] = get_user_tenant_id()`). Un cliente del portal
**no está en `user_tenants`**: con su sesión no ve ni la fila ni el objeto.

Se aplica el patrón del módulo: la propiedad se prueba primero con las
credenciales del cliente (`getPrealertaByCode` → 404 si no es suya) y sólo
después se lee y se firma con el admin client, acotado a esa compra.

### URLs firmadas, 1 hora

La misma TTL que Inspecciones y el expediente legal — no se inventa una constante
nueva para el mismo bucket. El portal renderiza en el servidor en cada visita, así
que la URL nace fresca con la página y queda muerta para quien la reenvíe después.

Por eso el `<img>` es nativo y no `next/image`: el optimizador serviría la imagen
desde una ruta cacheada que sobreviviría a la firma, y el enlace quedaría roto.

### 🔴 Se indexa por path, no por posición

`createSignedUrls` responde en el orden en que se pidió, pero **puede omitir una
entrada** (objeto borrado del bucket). Confiar en el índice haría que, al faltar
una, todas las siguientes quedaran corridas: el cliente vería **la foto de otra
caja bajo la etiqueta equivocada**. Peor que no mostrar nada.

Está aislado en `agruparFotosPorRecepcion`, puro y probado.

> ⚠️ Nota de método: el primer test de este caso **no discriminaba**. Lo monté
> con `signedUrl: null` en su posición, y así el indexado por índice coincide de
> casualidad — mutar el código a "por posición" lo dejaba en verde. Se rehízo con
> la entrada **ausente**, que es la forma real del fallo. Con eso, la mutación
> pone 3 tests en rojo.

### Las fotos nunca tumban la pantalla

Best-effort de punta a punta: la recepción, sus cajas y sus medidas son el dato
que el cliente vino a buscar. Si Storage no responde, la pantalla sale igual sin
fotos — nunca al revés.

## Adjuntos

Ninguno.
