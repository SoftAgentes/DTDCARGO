---
sdd: "0303"
title: "El contrato de JSON-LD miraba sólo app/ — 4 bloques de components/ llevaban años fuera"
status: in-progress
author: "founder"
created: 2026-08-26
updated: 2026-08-26
supersedes: null
superseded_by: null
related: ["0304", "0302", "0235"]
confidencialidad: interno
---

# DTD-0303 — El contrato que no miraba donde estaba el problema

> Tercer hallazgo de la auditoría de la rama archivada (SDD-0304). Los otros dos
> faltaban enteros. Éste **ya tenía contrato, y el contrato estaba verde.**

## El riesgo

Un `<script type="application/ld+json">` se inyecta con
`dangerouslySetInnerHTML`. Si el JSON serializado contiene `</script>`, el
navegador **cierra la etiqueta ahí** y lo que sigue se ejecuta como HTML: XSS
almacenado. `serializeJsonLd` convierte `<` en `<`, que los parsers de JSON
leen como `<` y el de HTML no ve como etiqueta.

**No es teórico en este repo:** `/noticias/[slug]` serializa título, resumen y
cuerpo que vienen del CMS — texto que escribe una persona.

## 🔴 El hallazgo: el contrato escaneaba una sola raíz

`app/__tests__/json-ld-escape-contract.test.ts` existía desde SDD-0235 y hacía
bien su trabajo… sobre `app/`:

```ts
const RAIZ = "app";
```

**`components/` nunca se miró.** Y ahí vivían cuatro bloques:

| Archivo | Cómo serializaba |
|---|---|
| `components/BreadcrumbJsonLd.tsx` | 🔴 `JSON.stringify(jsonLd)` crudo |
| `components/OperationGallery.tsx` | 🔴 `JSON.stringify(videoJsonLd)` crudo |
| `components/WorkBand.tsx` | 🔴 `JSON.stringify(videoJsonLd)` crudo |
| `components/WebPageJsonLd.tsx` | 🟡 el escape **copiado a mano** |

**Un contrato verde que no mira donde está el problema es peor que no tenerlo:**
da por cubierto lo que nunca escaneó. Los 18 bloques de `app/` estaban
protegidos y el equipo tenía razón en creer que el tema estaba cerrado.

### El cuarto caso, aparte

`WebPageJsonLd` hacía `JSON.stringify(jsonLd).replace(/</g, "<")` — hoy
es **exactamente** lo que hace el helper, así que no era un agujero. Pero es una
copia: el día que el helper escape algo más, esa línea se queda atrás sin que
nadie lo note. Y los dos tests existentes la dejaban pasar, porque
técnicamente escapa.

## Alcance del riesgo, medido

Los llamadores de los tres bloques crudos pasan **literales estáticos**
(«Inicio», «Academia», nombres de video). **No había un exploit vivo por esta
vía**: lo que se cierra es el próximo llamador —un breadcrumb con el título de
un artículo, un nombre de servicio venido de la base— que lo habría arrastrado
sin que nada fallara al desplegar.

El caso realmente sensible, `/noticias/[slug]`, **ya estaba cubierto**: vive en
`app/`, que es lo que el contrato sí miraba.

## Lo que cambia

1. **Los cuatro bloques** pasan por `serializeJsonLd`.
2. **El contrato mira dos raíces**: `app/` y `components/`.
3. **Regla nueva — no vale copiar el escape a mano.** Es la que habría atrapado
   el cuarto caso; las otras dos lo dejaban pasar.

Se conservó todo lo que el contrato original ya sabía, incluido su
`testTimeout` de 120 s y el porqué (nueve contratos que recorren el árbol de
archivos en paralelo se pisan el disco y expiran contra el timeout global de
20 s — la firma de la contención, no de una regresión).

## Verificación

1. **4 tests** en verde.
2. **Mutación, dos veces:**
   - `JSON.stringify` crudo en `components/WorkBand` → 2 tests rojos (prueba
     que la raíz nueva se escanea de verdad).
   - El escape copiado a mano en `WebPageJsonLd` → 2 rojos, incluida la regla
     nueva.
3. Gate completo `node scripts/verify.mjs`.

## ⚠️ Cómo se descubrió, y un error propio

Al escribir este contrato **se sobrescribió el que ya existía** sin leerlo
primero: la herramienta dijo «updated», no «created», y no se miró. La versión
nueva escaneaba las dos raíces pero perdía el `testTimeout` razonado, la prueba
de payload que demuestra que el escape neutraliza `</script>` de verdad, y la
nota de que `/noticias/[slug]` sirve texto del CMS.

Se recuperó el original desde git y se **fusionó**. La versión final tiene las
tres pruebas viejas más la regla nueva.

## Lo que esta spec NO puede afirmar

**Que no haya JSON-LD fuera del patrón buscado.** El escaneo mira
`dangerouslySetInnerHTML` en o junto a una línea con `ld+json`. Un bloque armado
de otra forma quedaría fuera — es el límite del método, y es exactamente el tipo
de hueco que este hallazgo demuestra que existe.

Tampoco se abrió ninguna página en un navegador.
