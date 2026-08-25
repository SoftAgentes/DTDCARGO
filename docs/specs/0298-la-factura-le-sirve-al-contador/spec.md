---
sdd: "0298"
title: "La factura le sirve al contador: el documento del cliente se congela, y la copia del portal deja de salir vacía"
status: in-progress
author: "founder"
created: 2026-08-25
updated: 2026-08-25
supersedes: null
superseded_by: null
related: ["0297", "0120"]
confidencialidad: interno
---

# DTD-0298 — La factura le sirve al contador

> Continúa SDD-0297, que puso la identidad fiscal **del emisor**. Acá van las
> dos piezas que faltaban: el documento **del cliente**, y que la copia que se
> baja el cliente lleve algo.

## 🔴 Lo primero: la 0297 no funcionaba en la copia del cliente

Un defecto en lo que se acababa de publicar, encontrado al medir en producción.

`getCompanyData()` resuelve el tenant leyendo `user_tenants`. **Un cliente del
portal no está ahí.** Medido el 2026-08-25:

| | |
|---|---|
| Cuentas de portal (`client_users`) | **133** |
| De ésas, presentes en `user_tenants` | **2** |

O sea: **131 de 133 clientes** bajaban su factura sin razón social, sin RIF y
sin datos de pago — mientras la copia del Studio los llevaba. Y la del cliente
es justamente la que va al contador.

**Cura.** `getCompanyDataForTenant(supabase, tenantId)` separa la lectura de la
resolución por membresía. La ruta del portal prueba primero la propiedad de la
factura con el cliente del usuario (`getMyInvoice` filtra por el markbox del
logueado) y **recién después** lee los datos de la empresa con el cliente admin,
acotado a ese tenant. Es el patrón de siempre para las lecturas del portal.

No hay riesgo de exposición: la identidad fiscal del emisor es pública por
diseño (sale en el JSON-LD del sitio) y las cuentas bancarias son justamente lo
que el cliente necesita para pagar.

## El documento del cliente: por qué se CONGELA (opción B)

`invoices` ya denormaliza `client_name` y `client_markbox` al crear, y no por
descuido: una factura emitida es un **comprobante**, y un comprobante que se
reescribe solo deja de serlo.

Las dos opciones que se pusieron sobre la mesa:

| Camino | Qué gana | Qué cuesta |
|---|---|---|
| **A · leer en vivo de `clients`** | cubre las facturas viejas; sin migración | una factura emitida **cambia** si el cliente corrige su RIF después |
| **B · congelar al emitir** ⭐ | el papel queda inmutable, como el resto | migración; sólo cubre las nuevas |

**Se eligió B, y el costo resultó ser teórico:** hay **5 facturas en total** en
el sistema (las 5 emitidas). "Sólo cubre las nuevas" deja fuera 5 documentos.

### El momento del sellado es la EMISIÓN, no la creación

Un borrador todavía se edita; congelarle algo no tendría sentido. Se sella
donde la factura deja de ser borrador:

- `emitInvoice()` — el caso normal.
- `createInvoice()` **sólo cuando `emitNow`** — el crear-y-emitir. Si nace
  borrador, se guarda sin documento y lo toma al emitirse.

### Dos columnas, no una

`clients.doc_kind` distingue `empresa` (RIF) de `persona` (cédula). Sin él el
papel no sabe qué etiqueta poner delante del número, y **poner "RIF" sobre una
cédula identifica mal al contribuyente** — es un error fiscal, no de estilo.

El `check` vive en la base y no sólo en TypeScript: la columna la puede escribir
cualquier cliente de Postgres, y una etiqueta inventada saldría impresa en un
documento fiscal sin que nadie la revise.

### Nulables a propósito

**146 de 490 clientes vivos no tienen documento cargado.** Un `not null`
bloquearía facturarle a un tercio de la cartera. Sin documento, el PDF no
imprime la línea — nunca inventa.

## Dónde queda en el papel

En el bloque «Cliente», **arriba** del Shipping Mark: el Mark es un código
interno nuestro; el que identifica al cliente ante el fisco es el documento.

```
Cliente
Importadora Ejemplo, C.A.
RIF: J-12345678-9
Shipping Mark: DTD-1234
```

## Verificación — lo que se midió

1. `pnpm typecheck` limpio. El tipo `Invoice` ganó dos campos obligatorios, así
   que el compilador obligó a completar los tres fixtures que lo construyen.
2. **36 tests** en la cadena (documento del cliente, factura, comprobante del
   portal).
3. **Contrato SQL** `0392_*.test.sql` con 5 casos, incluido que el `check`
   cubra el **UPDATE** — que es la operación real, porque se sella al emitir.
4. **Los dos se validaron por mutación:**
   - Quitando el `check` de la migración → el contrato 3 se pone rojo con
     *«se aceptó un doc_kind inventado»*.
   - Haciendo que `lineasDeEmisor` caiga al nombre comercial (SDD-0297) → 2
     tests rojos.
5. Gate completo `node scripts/verify.mjs`.

## Lo que esta spec NO puede afirmar

- **Que las 5 facturas históricas muestren el documento.** No lo van a mostrar:
  se emitieron antes de que existiera la columna. Un backfill es posible (son 5
  filas) pero **stampearía el RIF de hoy sobre un papel de ayer**, que es
  exactamente lo que la opción B vino a evitar. Queda como decisión aparte.
- **Que se vea bien.** Ningún PDF se abrió. El renglón se probó como texto.
- **Que la copia del portal ya salga completa.** El arreglo es correcto por
  construcción y por tipos, pero no se ejerció con una sesión de portal real.
