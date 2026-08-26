---
sdd: "0306"
title: "Recordatorio de cobranza — y las seis razones para NO mandarlo"
status: in-progress
author: "founder"
created: 2026-08-26
updated: 2026-08-26
supersedes: null
superseded_by: null
related: ["0305", "0041"]
confidencialidad: interno
---

# DTD-0306 — El recordatorio que no molesta

> Cierra **B3**. El botón «Recordatorio masivo» existía en Cobranzas,
> deshabilitado, con `title="Próximamente"`. Ahora funciona.

## Lo que hace difícil esta función

No es mandar correos. Es **no mandarlos cuando no corresponde**. Un
recordatorio de cobranza incomoda a un cliente que paga, y el daño no se ve en
pantalla — se ve en la relación.

Por eso el trabajo está casi todo en el criterio, no en el envío.

## Las seis razones para no escribir

| Regla | Por qué |
|---|---|
| **Sólo vencidas** | Recordarle algo que no vence es apurar a quien no debe nada |
| **Sólo con saldo** | Una pagada no se recuerda |
| 🔴 **Nunca con promesa vigente** | El equipo **aceptó** una fecha nueva; escribir antes rompe el acuerdo que nosotros mismos concedimos |
| **No repetir en 7 días** | Dos correos en tres días no cobran más rápido: queman el remitente y al cliente |
| 🔴 **Nunca a quien marcó spam** | Es una decisión del destinatario. Insistir es, además de grosero, la vía rápida a que el dominio deje de entregar |
| **Sin correo no hay envío** | 136 de 488 clientes no lo tienen cargado — eso es trabajo de datos, no un fallo del recordatorio |

Dos detalles que no son obvios:

- **La queja de spam se mira sobre TODOS los correos del cliente**, no sólo los
  de cobranza. Quien marcó spam en un aviso de embarque tampoco quiere uno de
  cobranza: la queja es sobre el remitente, no sobre el tema.
- **La ventana de repetición la decide la FACTURA, no el cliente.** Dos facturas
  vencidas del mismo cliente son dos deudas distintas; si la ventana fuera por
  cliente, recordarle una silenciaría la otra.

## Los omitidos se muestran, con su motivo

La selección devuelve **dos listas**: a quién sí y a quién no **con el porqué**.

Un filtro silencioso es lo que hace que nadie confíe en la herramienta: el
operador ve 2 destinatarios donde esperaba 5 y no sabe si el sistema descartó
bien o se los comió. El drawer muestra los dos bloques antes de que se pueda
apretar Enviar.

## 🔴 Dos acciones, y la separación ES la seguridad

- `previewRecordatorios()` **no manda nada**. Calcula y muestra.
- `enviarRecordatorios(codes)` manda, y **exige la lista explícita**.

**Nunca hay un botón que mande «a los vencidos»** sin que una persona haya visto
antes quién recibe.

### La lista del navegador sólo puede ACOTAR

`enviarRecordatorios` **vuelve a calcular la selección en el servidor y la
intersecta** con lo que pidió el cliente. Un código que hoy no corresponde
—porque ya pagó, porque prometió pagar, porque marcó spam— se descarta aunque
el navegador lo mande.

Confiar en la lista del navegador convertiría el botón en un vector para
escribirle a cualquiera: basta con editar la petición.

## ⚠️ Y esto todavía no manda ningún correo

Igual que SDD-0305: el envío pasa por `fireMailEvent`, que busca las reglas
activas del tenant. **No hay ninguna para `invoice_overdue`**, así que hoy el
botón calcula, muestra y no saca nada. La regla se configura en Studio ›
Mailing.

Alcance real hoy, medido en producción: **4 facturas vencidas con saldo**.
«Masivo» son cuatro correos.

## Un error propio, corregido

La primera versión de la consulta traía «los últimos 1000 correos» y filtraba en
memoria. Eso falla **en la dirección peligrosa**: una queja de spam más vieja
que esos 1000 registros se cae del conjunto, el cliente no aparece como quejoso
y **se le vuelve a escribir** — justo lo que la regla existe para impedir.

Ahora cada conjunto sale de su propia consulta filtrada en el servidor y
paginada entera: las quejas se quieren **todas**, sin importar cuándo ocurrieron.

## Verificación

1. **19 tests** de la capa pura.
2. **Mutación, cuatro veces** — quitando cada protección, caen los tests que la
   vigilan:
   - sin la regla de promesa vigente → 2 rojos
   - sin la de spam → 2 rojos
   - sin la ventana de repetición → 2 rojos
   - ignorando la intersección del pedido → **4 rojos**
3. Gate completo `node scripts/verify.mjs`.

## Lo que esta spec NO puede afirmar

- **Que llegue un correo.** Sin regla configurada no sale nada; el camino
  regla → plantilla → Resend → bandeja no se ejerció.
- **Que el drawer se vea bien.** No se abrió en un navegador. La UI sigue los
  primitivos del Studio (`DrawerShell`, `ActionButton`, `Badge`) y el patrón del
  drawer vecino, pero eso es construcción, no verificación.
- **Que las consultas de contexto devuelvan lo esperado en prod.** Se probó el
  criterio, no las consultas.
