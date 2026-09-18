---
id: 0483
slug: studio-historial-cambios-cliente
status: reserved
related: ["0481", "0482"]
---

# SDD-0483 — El Studio muestra el historial de cambios que hizo el cliente

**RESERVA DE NÚMERO.** El contenido real lo escribe la sesión asignada en su
propia rama de trabajo. Este stub sólo existe para que el número quede tomado.

Reservado por coordinación el 2026-09-18, sobre `1d80c18a`. Migración
reservada: **`0463`**.

## El pedido

Sam pidió que el Studio muestre los cambios que el cliente hizo en su perfil
desde el Portal: si antes tenía otra cédula o RIF, u otro teléfono, se ve el
historial, y el último cambio es el vigente. Para las fotos de identidad
reemplazadas eligió «Evento y ver la foto vieja»: además del evento, un enlace
temporal para abrir la foto anterior. La respuesta la registró la sesión
`dtdcargo-63` el 2026-09-18.

## Por qué va aparte de la SDD-0482

La SDD-0482 escribe: el cliente edita directo y cada cambio queda registrado.
Esta SDD lee: el panel del Studio, la RPC de lectura con rol y tenant, y las
URL firmadas de las fotos anteriores. Separarlas deja revisar aparte lo que más
expone documentos de identidad, y permite que el Portal salga primero.
