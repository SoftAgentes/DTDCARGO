---
id: 0482
slug: portal-cliente-edita-numero-identidad
status: reserved
related: ["0151", "0439", "0481"]
---

# SDD-0482 — El cliente edita su número de cédula o RIF en el Portal, sin aprobación

**RESERVA DE NÚMERO.** El contenido real lo escribe la sesión asignada en su
propia rama de trabajo. Este stub sólo existe para que el número quede tomado.

Reservado por coordinación el 2026-09-18, sobre `1d80c18a`. Migración
reservada: **`0462`**.

## La decisión

Hoy el cliente cambia su número de cédula o RIF con una solicitud que aprueba el
asesor (SDD-0151 y SDD-0439). Sam decidió que lo edite directo: «Editar directo,
sin aprobación». Descartó seguir con solicitud y aprobación, y también editar
directo con aviso al asesor. La respuesta la registró la sesión `dtdcargo-63`
el 2026-09-18.

## Orden

Se trabaja después de integrar la #145 (SDD-0481), porque toca los mismos
archivos del perfil. La migración `0462` se aplica antes de integrar el código,
con OK nominal de Sam aparte.
