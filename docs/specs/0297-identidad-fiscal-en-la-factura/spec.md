---
sdd: "0297"
title: "La factura lleva razón social y RIF del emisor — excepción concedida a la regla de marca"
status: in-progress
author: "founder"
created: 2026-08-25
updated: 2026-08-25
supersedes: null
superseded_by: null
related: ["0281", "0120", "0117"]
confidencialidad: interno
---

# DTD-0297 — La identidad fiscal del emisor en la factura

> Cierra **B1**, la decisión que estaba bloqueando el carril comercial: si el
> PDF de factura que ya existe le sirve o no al contador del cliente.

## La regla que se excepciona, y por qué se pudo

La regla de marca manda la razón social (`INVERSIONES DTD SERVICES, C.A`) y el
RIF (`J-50648869-8`) **sólo al schema** (`legalName` / `taxID` del JSON-LD),
nunca a texto visible. El finiquito la respeta y lo deja escrito en el código:

> «Sin razón social ni RIF en texto visible (regla de marca, founder 2026-07-20
> · "por ahora"): si el finiquito necesita la identidad legal completa para
> trámites LOTTT, **es una excepción a pedir explícitamente, no la regla por
> defecto**.»

El founder concedió esa excepción para la **factura** el 2026-08-25. Es un
documento fiscal: sin la identidad del emisor no le sirve a un contador.

**El finiquito NO se toca.** Es otro documento, con otro propósito (LOTTT), y su
excepción no se pidió.

## No era construir: era dejar de tirar el dato

Los datos ya existían y ya se leían. `tenants` guarda `legal_name`, `trade_name`
y `rif` desde SDD-0120 — y la razón social es **obligatoria** en el validador
(`company-types.ts:126`). `getCompanyData()` los trae en cada consulta.

Lo que fallaba: **las dos rutas de PDF los leían y los descartaban** al armar el
objeto del emisor. Se quedaban con `tradeName`, `commercialEmail`, `phone` y
`website`, y la razón social y el RIF se caían ahí, en silencio.

| | Antes | Ahora |
|---|---|---|
| `getCompanyData()` | trae `legal_name` y `rif` | igual |
| Ruta Studio y ruta portal | los **descartan** | los pasan |
| `FacturaPdfEmisor` | sin campos | `legalName` + `rif` |
| El papel | nada | renglón bajo el membrete |

## Dónde queda en el papel

Bajo la marca, antes del título del documento — que es donde se lee en una
factura venezolana:

```
DTD CARGO
INVERSIONES DTD SERVICES, C.A · RIF J-50648869-8
Factura F-2026-0001
Emitida: 25/08/2026
```

`Membrete` es una primitiva **compartida** por cuatro documentos, así que el
parámetro nuevo (`emisorLines`) es **opcional**: el estimado, el estado de
cuenta y el finiquito no lo pasan y salen exactamente igual que antes.

## La regla que no se rompe: nunca inventar un dato fiscal

`lineasDeEmisor()` es pura y probada. Si el tenant no cargó los datos devuelve
`[]` y el membrete sale como antes. **No hay respaldo al nombre comercial.**

Una factura que dice `DTD Cargo` donde debería decir la razón social registrada
es peor que una que no dice nada: la primera se presenta y rebota, la segunda se
sabe incompleta desde que se mira.

Los tests se validaron **por mutación**: se hizo que la función cayera al
nombre comercial cuando falta el dato fiscal, y se pusieron en rojo exactamente
los dos que vigilan esa regla («sin datos NO imprime nada» y «el nombre
comercial no reemplaza a la razón social»).

## 🔴 Lo que esta spec NO resuelve: el RIF del CLIENTE

Una factura fiscal identifica a **dos** partes. Ésta ahora identifica al emisor;
al receptor lo sigue nombrando sólo por nombre y Shipping Mark.

El dato existe (`clients.rif`, `clients.doc_kind`), pero **no se puede resolver
sin una decisión**, porque `invoices` congela `client_name` y `client_markbox`
al emitir y no guarda el documento:

| Camino | Qué gana | Qué cuesta |
|---|---|---|
| **A · Leerlo en vivo de `clients`** | sirve para las facturas viejas también; sin migración | una factura emitida **cambia** si el cliente corrige su RIF después. Un comprobante que se reescribe solo deja de ser comprobante |
| **B · Congelarlo en `invoices` al emitir** | el papel queda inmutable, como el resto de la factura | pide migración y **sólo cubre las nuevas** |

**Recomendación: B.** El principio de la tabla ya es congelar lo que el
documento dijo; leer una parte en vivo lo rompería. Pero es tu decisión — y
mientras tanto la factura sigue sin identificar fiscalmente al receptor.

⚠️ Y hay un ángulo de datos personales: cuando el cliente es `persona`, el
documento es una **cédula**. Ponerla en el PDF la mueve a un artefacto nuevo.
El receptor es el propio titular, así que el riesgo es bajo, pero si se avanza
con esto conviene pasarlo por `/revisar-datos-ve`.

## Verificación

1. `pnpm test lib/studio/pdf/__tests__/factura-pdf.test.ts` → **22 en verde**.
2. **Mutación**: `lineasDeEmisor` devolviendo el nombre comercial cuando falta
   el dato fiscal → **2 tests en rojo**, los correctos.
3. El tipo `FacturaPdfEmisor` ganó dos campos obligatorios, así que el
   `typecheck` obliga a que **las dos** rutas los pasen; no se puede olvidar una.
4. Gate completo `node scripts/verify.mjs`.

## 🔴 Lo que esta spec NO puede afirmar

**Que en producción se vea algo.** El código pasa los datos, pero si la fila del
tenant tiene `legal_name` o `rif` vacíos, el renglón no sale — por diseño (no
inventa). **No se pudo leer la base**: el MCP de Supabase pide autorización y
esta sesión no la tiene.

**Cómo comprobarlo en un minuto:** Studio › Administración › Datos de la empresa
→ que razón social y RIF estén cargados. Después, bajar cualquier factura en
PDF y mirar bajo el membrete.

Tampoco se abrió el PDF: el renglón se probó como texto, no como papel
renderizado.
