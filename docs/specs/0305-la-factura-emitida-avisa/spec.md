---
sdd: "0305"
title: "La factura emitida avisa por correo — el evento existía y nadie lo disparaba"
status: in-progress
author: "founder"
created: 2026-08-26
updated: 2026-08-26
supersedes: null
superseded_by: null
related: ["0297", "0298"]
confidencialidad: interno
---

# DTD-0305 — La factura emitida avisa

> Cierra **B2**: «¿la factura se manda sola por correo al emitirla?». La
> respuesta corta es que **casi todo ya estaba construido** — faltaba una
> llamada.

## Lo que ya existía

| Pieza | Estado |
|---|---|
| Motor de reglas `fireMailEvent` | ✅ vivo, lo usan `cn`, `cotizador` y `tracking/nuevo` |
| Evento `invoice_emitted` en el enum | ✅ con etiqueta «Factura emitida» y tono de badge |
| Vocabulario de variables de facturación | ✅ `invoice_code`, `markbox`, `total_usd`, `bcv_rate`… |
| Pantalla para configurar reglas | ✅ Studio › Mailing |
| **Alguien que dispare el evento** | 🔴 **nadie** |

`emitInvoice()` cambiaba el estado, calculaba el vencimiento, posteaba el
asiento contable… y no avisaba a nadie. El evento estaba declarado en dos
enums y **cero dispatchers**.

## Lo que cambia

Una llamada a `fireMailEvent` en `emitInvoice`, al lado del asiento y con el
mismo criterio *best-effort*: si el correo falla, la factura ya se emitió.

## 🔴 Esto NO manda un correo por sí solo

`fireMailEvent` busca las **reglas activas del tenant** para ese evento. Si no
hay ninguna, se va en silencio. Medido en producción el 2026-08-26:

```
mail_rules → 3 reglas, todas recipient_kind='internal'
             (shipment_created, quote_sent, shipment_consolidated_cn)
             NINGUNA para invoice_emitted
```

O sea que **hoy este cambio no envía nada**. Lo que hace es dejar la tubería
lista: quién recibe —cliente, equipo o un correo fijo— y con qué plantilla se
decide en **Studio › Mailing**, no en el código.

Es deliberado. Un cambio que empezara a escribirle a clientes reales sin que
nadie lo configurara no es una mejora, es una sorpresa.

## La capa pura, y por qué se separó

`varsDeFacturaEmitida()` vive en `lib/studio/invoice-mail-vars.ts`, fuera de la
action. Lo que puede mentirle a un cliente son los **valores**, y eso se prueba
sin base de datos ni render — mismo reparto que `calcularTotales` en el PDF.

### 🔴 La regla que más daño haría

`total_ves` y `bcv_rate` **sólo salen si la factura es en bolívares**. Si
salieran siempre, una plantilla que los use imprimiría **la cifra en dólares
rotulada como bolívares**: el cliente pagaría lo que no es.

### Y la que se rompe sin que nadie lo note

Donde falta un dato va un guion, **nunca un valor inventado**. Un
`Hola, undefined` en un correo automático no lo revisa nadie antes de salir.

## Verificación

1. **6 tests** de la capa pura, en verde.
2. **Mutación, dos veces:**
   - Emitir `total_ves` siempre → 2 tests rojos.
   - Dejar pasar el dato ausente crudo → 2 rojos.
3. Un test fija **las claves exactas**: si una se renombra acá y no en la
   plantilla, el correo sale con el `{{placeholder}}` a la vista del cliente.
4. Gate completo `node scripts/verify.mjs`.

## Lo que esta spec NO puede afirmar

- **Que llegue un correo.** No hay regla configurada, así que hoy no sale nada.
  El camino completo —regla → plantilla → Resend → bandeja— no se ejerció.
- **Que la plantilla se vea bien.** No se abrió ningún correo.
- **Que el cliente tenga email.** Medido antes: **136 de 488 clientes vivos no
  tienen correo cargado**. Para ésos, una regla con `recipient_kind='client'` no
  resuelve destinatario y el motor lo registra y sigue.

## Decisión que queda abierta

**A quién se le manda.** Las tres reglas de hoy son `internal` — el equipo. Que
la factura le llegue **al cliente** es una decisión de negocio: se configura en
Studio › Mailing eligiendo `recipient_kind = client` y una plantilla. No se
tomó acá.
