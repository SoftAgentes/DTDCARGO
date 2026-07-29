# Tránsito de aduana y desaduanaje

> Capa 1 · Servicio adicional del transporte (se suma al Consolidado LCL y al FCL hasta puerto; en el Puerta a Puerta y el FCL todo pagado ya va incluido) · **Activo**

## Gancho
**Tu carga llegó a puerto — nosotros la nacionalizamos por ti.** Gestionamos el trámite aduanal y el
desaduanaje de tu carga LCL o FCL hasta puerto en Venezuela, representándote como tu agente ante la
aduana.

## ¿Qué es?
Es el servicio para clientes del **[Consolidado LCL](consolidado-lcl.md)** y del **[FCL hasta
puerto](fcl.md)** que legalizan la mercancía a su nombre: gestionamos el paso de tu carga por la
**aduana venezolana** y su **nacionalización**, con la **documentación de importación incluida**.
Tú pagas tus planillas directamente a la aduana; nosotros te representamos como tu **agente**, con
tu carta poder. **En el Puerta a Puerta y en el FCL todo pagado no necesitas contratarlo: ya va
incluido.**

## ¿Cómo funciona?
1. **Súmalo a tu carga LCL o FCL hasta puerto** con tu asesor, a tu nombre o al de tu empresa.
2. Firmas la **carta poder** para que te representemos como tu agente ante la aduana.
3. Preparamos y tramitamos los **documentos de importación**: facturas de embarque, declaraciones,
   certificados y requerimientos normativos.
4. Gestionamos el paso por la aduana; **las planillas y los impuestos los pagas tú directamente a la
   aduana** — no pasan por nosotros.
5. Tu mercancía queda **nacionalizada a tu nombre**, lista para retirar. Si quieres, sumamos el
   **transporte hasta tu destino** como extra adicional.

## ¿Por qué te conviene?
- Importas formalmente **a tu nombre** sin pelear con el trámite: nuestro equipo lo hace todos los días.
- **Transparencia:** las planillas de la aduana las pagas tú directo — nosotros no cobramos la aduana,
  cobramos la gestión.
- Cierra el circuito del Consolidado LCL: del puerto a tu mercancía legalizada, con un solo
  interlocutor.

## Reglas / condiciones importantes
- Aplica como servicio adicional para cargas **LCL y FCL hasta puerto**; en el **Puerta a Puerta y
  el FCL todo pagado ya va incluido** (decisión founder 19-jul v2).
- Necesitamos tu **carta poder** y tus datos (tu nombre o el de tu empresa) para representarte.
- **Las planillas y los impuestos** los pagas tú directamente a la aduana; no pasan por nosotros.
- Los **servicios portuarios, el almacén fiscal y el transporte interno** se facturan aparte.
- Nacionalización: **5 a 6 días hábiles**.

## Precio
Se cotiza según el **valor de tu carga** (por valorización de la factura). Como intervienen muchos
factores, consulta el aproximado y la tarifa vigente con tu asesor por WhatsApp.

## Contacto
WhatsApp +58 412 166 8021 · dtdcargo.com · @doortudoor_

---
**Notas para Cloud Design:** esta pieza **absorbe los Documentos de importación** (fusión founder
19-jul): no existe pieza ni nodo aparte de "Documentos" — esta ficha debe mostrar "documentación de
importación incluida" (facturas de embarque, declaraciones, certificados, normativa) como parte del
servicio. Continuar la línea de tiempo de la ficha del Consolidado LCL: puerto →
almacén fiscal → aduana → mercancía nacionalizada, marcando dónde entra DTD como **agente** del cliente.
Contrastar visualmente "lo que pagas tú directo (planillas, impuestos)" vs "lo que gestionamos
nosotros". Badge "Incluido en el Puerta a Puerta" para que el cliente del servicio principal no lo
contrate por error.

**Nota interna (no maquetar):** nacionalización 5–6 días hábiles **RATIFICADO por el founder
2026-07-18**. Valorización, planillas directas y carta poder vienen del dictado 2026-06-09
(`entrevista-servicios.md` + `lib/servicios-detalle.ts`). ✅ Puede pasar a arte final.
**Decisión founder 19-jul v2 (supera la v1 y el dictado 06-09):** este add-on aplica al **LCL y al
FCL hasta puerto**; en el Puerta a Puerta y en el **FCL todo pagado** el tránsito de aduana +
documentación (+ impuestos y entrega, en el caso FCL todo pagado) van INCLUIDOS.
