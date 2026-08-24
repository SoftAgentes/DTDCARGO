---
sdd: "0281"
title: "Los documentos del carril comercial: el estimado y la factura salen del ERP en papel"
status: in-progress
author: "founder"
created: 2026-08-23
updated: 2026-08-23
supersedes: null
superseded_by: null
related: ["0011","0021","0061","0117"]
confidencialidad: interno
---

# DTD-0281 — El estimado y la factura salen del ERP en papel

> El cliente pide "mándame la factura" y hoy no hay qué mandarle: el botón PDF
> del módulo está deshabilitado desde que se construyó Facturación. Este spec
> cierra los tres botones muertos del carril comercial —PDF, Duplicar y
> Exportar— en Estimados y en Facturación, y le da al cliente su propia factura
> descargable desde el portal.

## Contexto

Medido el 2026-08-23 sobre `main` (`7528e0f1`):

| Módulo | Botón | Estado |
|---|---|---|
| Estimados (`cotizador`) | PDF | `disabled` · `title="Próximamente"` |
| Estimados | Duplicar | `disabled` |
| Estimados | Exportar | `disabled` |
| Facturación | PDF | `disabled` |
| Facturación | Duplicar | `disabled` |
| Facturación | Exportar | `disabled` |
| Cobranzas | Nota | `disabled` |

No están bloqueados por falta de motor. **El motor ya existe y está probado en
producción**: SDD-0117 montó `@react-pdf/renderer` con primitivas compartidas en
[`lib/studio/pdf/pdf-doc.tsx`](../../../lib/studio/pdf/pdf-doc.tsx) y dos
documentos vivos (recibo de nómina y finiquito), cada uno servido por un
route handler `GET .../pdf` que responde `application/pdf`.

Lo que faltaba era aplicar ese motor al carril que le habla al cliente.

### Por qué importa ahora

El portal ya deja al cliente **ver** su factura y **reportar** el pago
(SDD-0134), pero no **tenerla**. Para un importador venezolano la factura es el
documento que va a su contador y a su banco: sin PDF, el equipo la arma a mano
o se manda una captura de pantalla por WhatsApp.

### Antes que nada: el gate estaba rojo por código sano

Al medir la línea base (`node scripts/verify.mjs` sobre `7528e0f1`) el gate
cerró **rojo en dos pasos** —`typecheck` y `build`— con 5503 tests en verde. La
causa no era el código:

```
.next/types/validator.ts:737
  const handler = {} as typeof import("../../app/portal/(auth)/login/page.js")
```

Esa página la borró SDD-0276. Next **genera** los tipos de ruta en cada
`dev`/`build` pero **nunca los recolecta** cuando una ruta desaparece, y
`tsconfig.json` los mete en `include` — así que `tsc` y el build de producción
estaban midiendo el árbol de rutas del pasado.

SDD-0280 había visto la mitad: `check-build.mjs` construye en `.next-verify`
para que la **salida** del build no contamine al dev. Pero la **entrada** seguía
sucia: el build aislado leía igual los tipos viejos vía `tsconfig.json`.

Se cierra con [`scripts/prune-next-types.mjs`](../../../scripts/prune-next-types.mjs),
cableado en tres puntos (preflight del paso `typecheck`, `check-build.mjs` y el
script `typecheck` de `package.json`). Es **quirúrgico**: sólo poda un árbol si
encontró al menos una referencia a una ruta que ya no existe; si está sano no
toca nada, y `tsc` conserva la validación de params de ruta que ese `include`
compra. Validado con mutación: forzar la poda incondicional pone 3 de los 6
tests en rojo.

## Alcance

### Entra

1. **`FacturaDocument`** — la factura en PDF: membrete, datos del cliente y su
   Shipping Mark, el envío ligado, la tabla de líneas, el desglose
   base/IVA/total, lo abonado y el saldo, los datos de pago del tenant y las
   notas.
2. **`EstimadoDocument`** — el estimado en PDF: la ruta, el servicio, el
   volumen/peso/bultos, la tarifa aplicada, el total y la fecha de validez.
3. **Tres route handlers**:
   - `GET /studio/facturacion/[code]/pdf`
   - `GET /studio/cotizador/[code]/pdf`
   - `GET /portal/facturas/[code]/pdf` — el cliente descarga **la suya**.
4. **Duplicar** estimado y factura (server action; el duplicado nace en
   `draft`/`borrador` con código nuevo y sin pagos ni conversión heredados).
5. **Exportar CSV** del listado de estimados y del de facturas, respetando los
   filtros activos de la vista.
6. **Nota de gestión** en el drawer de Cobranzas.

6. **Nota de gestión** en el drawer de Cobranzas.
7. **Los dos KPI de operación que decían "Próximamente"** — On-time delivery y
   Tránsito promedio — con su regla de honestidad (abajo).

### Los KPI que no se publican solos

`onTime` y `avgTransit` estaban en `KPI_CATALOG` con `source: "wip"`, así que el
tablero les pintaba un guión. No faltaban datos: `shipments` guarda
`planned_delivery_at` y `delivered_at`, y `shipment_events` guarda cuándo ocurrió
de verdad cada hito.

Lo que sí faltaba era decidir **qué hacer cuando el dato no alcanza**, y ahí está
lo importante del diseño:

- El `planned_delivery_at` lo llena la operación a mano y hoy no está garantizado
  que lo llenen siempre. Un tablero que promedia sólo los envíos bien cargados
  mide la **disciplina de carga de datos** y la presenta como desempeño
  logístico.
- Por eso cada medición devuelve `medidos` y `universo`, la tarjeta imprime
  siempre la fracción (`45 de 47 envíos`), y **por debajo del 50% de cobertura el
  KPI no publica número**: muestra un guión y dice `sólo 2 de 47 con datos —
  muestra insuficiente`. Un "100% on-time" sobre 2 de 47 no es un buen resultado;
  es un número que nadie puede desmentir en una reunión.
- El tránsito usa **mediana, no media**: un envío trabado tres meses en aduana
  arrastra la media y muestra un tránsito que no le pasa a casi nadie.
- Y se mide contra el evento `shipped` real, no contra `planned_departure_at`:
  la fecha planificada daría el tránsito que queríamos tener.

Validado con mutación: bajar `COBERTURA_MINIMA` a 0 (publicar siempre) pone 3 de
los 17 tests en rojo.

8. **`/portal/compras/[code]` — el detalle de compra que no existía.**

### El hueco más grande del portal

Medido: `app/portal/(app)/compras/` tenía `page.tsx` (listado), `nueva/`
(asistente) y `[code]/etiquetas/`. **No había `[code]/page.tsx`.** El cliente
anunciaba la compra, imprimía sus etiquetas, y desde ahí quedaba a ciegas hasta
que la mercancía aparecía dentro de un envío. Cada "¿ya llegó a la bodega?" y
"¿cuántas cajas les llegaron?" salía del ERP por WhatsApp, escrito a mano.

Los datos ya estaban todos: `warehouse_receipts_cn.prealerta_id` existe desde la
migración 0127 (con índice), y `getPrealertaByCode` ya estaba escrita —con filtro
por markbox— para una página de detalle que nunca se construyó.

La pantalla responde, en el orden en que el cliente pregunta:

1. ¿Llegó a Yiwu? ¿Cuándo?
2. **¿Llegaron TODAS las cajas que anuncié?** ← lo primero y en grande
3. ¿Cuánto midió y pesó de verdad?
4. ¿Ya va en un envío?

**El desajuste se muestra, no se esconde.** Si anunció 10 cajas y llegaron 7, la
pantalla dice "Llegaron 7 de 10 cajas · faltan 3". Mostrar sólo "7 recibidas"
sería técnicamente cierto y prácticamente una omisión: el cliente quiere
enterarse ahí y no cuando le llegue la factura.

**Y un CBM sin medir no es 0.** `sumaOculta` devuelve `null` cuando ninguna
recepción trae la medida, y la pantalla imprime `— m³`. Un `0.000 m³` le diría
al cliente que su carga no ocupa nada.

#### Por qué usa el admin client, y por qué es seguro

`warehouse_receipts_cn` sólo tiene la policy `by tenant`
(`tenant_id = get_user_tenant_id()`). Un cliente del portal **no está en
`user_tenants`**, así que con su sesión esa consulta vuelve vacía siempre — no
"casi vacía": vacía, y en silencio.

Se aplica el mismo patrón que el detalle de envío ya usa para consolidaciones:
**primero se prueba la propiedad con las credenciales del propio cliente
(`getPrealertaByCode` con RLS + filtro por `client_markbox`; si es null → 404), y
sólo con el id ya verificado se lee con el admin client.** La función que usa el
admin vive aislada en su propio módulo, con esa condición escrita en su
encabezado, para que no se pierda de vista al leer la página.

### No entra

- **Razón social y RIF en el cuerpo del documento.** Se respeta el precedente
  explícito del finiquito
  ([`finiquito-pdf.tsx`](../../../lib/studio/pdf/finiquito-pdf.tsx), regla del
  founder 2026-07-20): la identidad legal completa es una **excepción a pedir**,
  no el default. Queda como decisión del founder — ver §Decisiones abiertas.
- Firma electrónica del documento (eso es SDD-0193, y hoy no hay PSC acreditado
  por SUSCERTE contratado).
- Envío automático de la factura por correo al emitirla.

## Diseño

### Una entrada, dos llamadores

El Studio y el portal leen la factura por caminos distintos —`getInvoiceByCode`
(rol del ERP) y `getMyInvoice` (RLS del cliente, forma `PortalInvoiceDetail`)—
y sus tipos no coinciden. Para no duplicar el documento, el módulo PDF define su
**propia entrada estrecha** (`FacturaPdfInput`) y cada route mapea lo suyo. El
documento no sabe quién lo pidió.

Esto además deja la construcción del papel **pura y testeable**: los helpers que
arman las filas y los totales se prueban en Vitest sin renderizar el PDF ni
tocar la DB, igual que `buildPayslipLines` de SDD-0117.

### Seguridad

- Las rutas del Studio viven bajo `/studio` (el proxy ya exige sesión) **y**
  usan el cliente autenticado → la RLS acota por tenant. Un `code` ajeno → 404.
- La ruta del portal usa `getMyInvoice`, que filtra por el markbox del cliente
  logueado. Una factura ajena, en borrador o inexistente → 404, sin distinguir
  entre los tres casos (no confirma la existencia de un código ajeno).
- Las tres responden `Cache-Control: private, no-store`: llevan plata y PII.
- **Una factura en `borrador` no tiene PDF en ningún lado.** El papel es un acto
  comercial: mientras el documento no esté emitido, no existe fuera del ERP.

### Formato del CSV

UTF-8 con BOM (para que Excel en Windows no rompa los acentos), separador coma,
campos citados. Una fila por documento, con los mismos campos que muestra la
tabla y en el mismo orden — el export es la vista, no un dump del schema.

## Decisiones abiertas (founder)

1. **¿La factura lleva razón social y RIF?** Hoy no los lleva, por el precedente
   del finiquito. Si la factura tiene que servirle al contador del cliente,
   probablemente sí — pero es tu llamada, no la mía.
2. **¿El PDF se manda solo al emitir?** Hoy no. El motor de correo del Studio ya
   existe; es cablearlo.

## Adjuntos

Ninguno.
