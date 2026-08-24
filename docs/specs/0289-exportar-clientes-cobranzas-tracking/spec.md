---
sdd: "0289"
title: "Clientes, Cobranzas y Tracking se exportan a CSV — sin truncar en silencio"
status: in-progress
author: "founder"
created: 2026-08-24
updated: 2026-08-24
supersedes: null
superseded_by: null
related: ["0265","0281"]
confidencialidad: interno
---

# DTD-0289 — Exportar Clientes, Cobranzas y Tracking

> Mecánico por fuera. Lo único interesante está en no repetir el error que las
> pantallas tienen permitido cometer.

## Alcance

`GET /api/studio/operativo/export?tipo=clientes|cobranzas|embarques`, con su
botón en cada una de las tres cabeceras. Mismas reglas que los CSV del carril
comercial (SDD-0281): etiquetas de pantalla en vez de enums, UTF-8 con BOM, CRLF,
y montos crudos con dos decimales para que **Excel los pueda sumar** (con
separador de miles los lee como texto).

## 🔴 Lo único que no era mecánico: los topes silenciosos

Las funciones que alimentan estas pantallas están acotadas **a propósito**:

- `listShipments` corta en **100 filas**;
- `listClients` corta en `CLIENTS_MAX` (tiene "Ver más", SDD-0265).

Para una pantalla está bien. **Para un archivo, no**: reusarlas tal cual daría un
CSV truncado sin decirlo, y quien lo abre no tiene forma de notarlo — un CSV
parece completo por definición. Es la misma trampa que el `.limit()` que no
sortea el tope de PostgREST.

Por eso el export tiene **lecturas propias** que paginan con `fetchAllPaged` y
**lanzan** si topan el máximo de páginas, en vez de devolver un archivo a medias.
Un error se ve; un CSV corto, no.

Cobranzas es la excepción y no hace falta tocarla: `receivablesQueue` ya pagina
entero y ya grita si topa.

## Este export NO filtra, y es deliberado

Los CSV del carril comercial viajan con la query string porque esas vistas
filtran por URL. Estas tres filtran **en el cliente** (tabs y búsqueda en
memoria), así que no hay un "lo que muestra la vista" reproducible en el
servidor. Antes que bajar un archivo que **parezca** filtrado y no lo esté, baja
el conjunto completo y quien lo abre filtra en su planilla. El botón lo dice.

## Detalles que el CSV distingue y la pantalla también

- **"Sin verificar" ≠ "No verificable".** `null` es que nunca se corrió la
  verificación de documento; `unavailable` es que se corrió y el registro oficial
  no respondió. Aplastarlas haría que el equipo dejara de perseguir las que nunca
  se miraron.
- **Saldo nativo y saldo en USD, en columnas separadas.** El nativo es
  multi-moneda: sumar esa columna da un total inventado. La de USD es la
  totalizable.
- **Sin días de vencimiento va vacío, no `0`.** `0` significa "vence hoy".

## Adjuntos

Ninguno.
