---
sdd: "0287"
title: "El estado de cuenta sale en PDF, para el cliente y para el asesor"
status: in-progress
author: "founder"
created: 2026-08-24
updated: 2026-08-24
supersedes: null
superseded_by: null
related: ["0117","0177","0281"]
confidencialidad: interno
---

# DTD-0287 — El estado de cuenta en papel

> Es el documento que el cliente le pasa a su contador y el que el asesor manda
> cuando alguien pregunta "¿cuánto debo?".

## Contexto

El saldo ya se calcula y se muestra en dos lados —el portal (SDD-0177) y el
Studio (SDD-0281)— pero sólo en pantalla. Un estado de cuenta que no se puede
guardar ni reenviar no le sirve a la contabilidad de nadie.

## Alcance

- `EstadoDeCuentaDocument`, alimentado por el `StatementLedger` ya armado.
- `GET /studio/clientes/[markbox]/estado-de-cuenta/pdf` — el asesor.
- `GET /portal/facturas/estado-de-cuenta/pdf` — el cliente, el suyo.
- Botón en las dos pantallas.

## Diseño

### No calcula nada, y ése es el punto

Recibe un `StatementLedger` de `buildStatementLedger`, la misma función pura que
alimenta las dos pantallas. Si el papel tuviera su propia suma, el cliente podría
ver un saldo en su portal y otro en el archivo que se acaba de bajar — que es
exactamente la discusión que un estado de cuenta viene a evitar.

Este módulo no tiene ni una suma: formatea y pinta.

### La ruta del portal no lleva parámetro de cliente

**A propósito.** La cuenta es la del que está logueado y no hay forma de pedir la
de otro. Un `[markbox]` en la URL sería una superficie que habría que defender;
no tenerlo es no tener que hacerlo.

El gate real es `listMyInvoices`, que resuelve el markbox por la RPC
`get_portal_client_markbox` (acotada a `auth.uid()`). Sin sesión de portal no hay
markbox y devuelve lista vacía antes de consultar nada — fail-closed por
construcción, no por el layout (un route handler **no** ejecuta el layout `(app)`
donde vive el gate de sesión del portal).

### Dos avisos que viajan con el documento

No son letra chica: describen límites reales del dato, y un PDF se guarda y se
reenvía, así que sobrevive a la pantalla donde hoy se explican.

1. **La fecha del abono es la del vencimiento de su factura, no la del pago.** El
   modelo guarda cuánto se pagó, no cuándo (decisión del founder, 2026-07-29,
   tomada sabiendo el desvío). Un abono puede aparecer con fecha futura.
2. **Con facturas en más de una moneda**, el ledger se queda con la dominante y
   el resto queda fuera. Callarlo haría que el papel pareciera el total de la
   cuenta cuando es una parte.

### El abono se distingue por el signo, no por el color

En papel en blanco y negro un verde no se ve. (Y en pantalla tampoco llegaba al
contraste de body — es la misma razón por la que `StatementLedgerTable` ya lo
resolvió así.)

### El `<a>` de la descarga no es un `<Link>`

La ruta devuelve el PDF como `attachment`. `<Link>` haría prefetch y navegación
de cliente sobre un archivo binario. La regla de ESLint se desactiva en ese punto
con el motivo escrito.

## Adjuntos

Ninguno.
