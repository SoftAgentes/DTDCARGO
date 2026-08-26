---
sdd: "0303"
title: "El escape de JSON-LD aterrizó a medias: 18 bloques con helper, 4 sin él"
status: in-progress
author: "founder"
created: 2026-08-26
updated: 2026-08-26
supersedes: null
superseded_by: null
related: ["0301", "0302"]
confidencialidad: interno
---

# DTD-0303 — El escape a medias

> Tercer y último hallazgo de la auditoría de la rama archivada (SDD-0301). Los
> otros dos —los 14 archivos muertos y el refresco de sesión— faltaban enteros.
> Éste había aterrizado **a medias**, que es peor: parece hecho.

## El riesgo

Un `<script type="application/ld+json">` se inyecta con
`dangerouslySetInnerHTML`. Si el JSON lleva un `<` sin escapar y algún valor
contiene `</script>`, el navegador **cierra la etiqueta ahí**: lo que sigue deja
de ser datos y pasa a ser marcado.

`lib/public/json-ld.ts` existe desde el 2026-08-02 justo para eso:

```ts
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
```

## Lo medido: 18 sí, 4 no

| Archivo | Cómo serializaba |
|---|---|
| `components/BreadcrumbJsonLd.tsx` | 🔴 `JSON.stringify(jsonLd)` crudo |
| `components/OperationGallery.tsx` | 🔴 `JSON.stringify(videoJsonLd)` crudo |
| `components/WorkBand.tsx` | 🔴 `JSON.stringify(videoJsonLd)` crudo |
| `components/WebPageJsonLd.tsx` | 🟡 el escape **copiado a mano** |

Los otros 18 bloques ya usaban el helper. La corrección original quedó en la
rama archivada que nunca se mergeó; lo que llegó a `main` vino por otro camino y
cubrió una parte.

**El cuarto merece nota aparte.** `WebPageJsonLd` hacía
`JSON.stringify(jsonLd).replace(/</g, "<")` — hoy es exactamente lo mismo
que el helper, así que **no era un agujero**. Pero es una copia: el día que el
helper escape algo más, esa línea se queda atrás sin que nadie lo note. El
escape vive en **un** lugar.

## ⚠️ Hoy NO había exploit vivo

Se revisaron los llamadores: todos pasan **literales estáticos** («Inicio»,
«Academia», «Calculadora terrestre»). Ninguno inyecta datos de la base ni de la
URL.

Lo que se cierra es la **próxima** vez: un breadcrumb con el título de un
artículo de `/noticias/[slug]`, o un nombre de servicio venido de la base, lo
habría arrastrado sin que nada fallara al desplegar.

## El contrato

`app/__tests__/json-ld-escape-contract.test.ts` escanea `app/` y `components/`,
encuentra cada `dangerouslySetInnerHTML` que sigue a un `ld+json`, y exige que
use `serializeJsonLd`. Tres reglas:

1. El escaneo **encuentra bloques de verdad** (>10). Un escaneo vacío pasa
   siempre — es el mismo seguro que en SDD-0302.
2. Ninguno usa `JSON.stringify` directo.
3. **Ninguno copia el escape a mano** — la regla que habría atrapado el cuarto
   caso, que los otros dos tests dejaban pasar.

## Verificación

1. **3 tests** en verde.
2. **Mutación**: devolviendo `WorkBand` a `JSON.stringify` crudo → el test
   correcto se pone en rojo, los otros dos siguen verdes.
3. Gate completo `node scripts/verify.mjs`.

## Lo que esta spec NO puede afirmar

**Que no haya JSON-LD fuera del patrón buscado.** El escaneo mira
`dangerouslySetInnerHTML` cerca de un `ld+json`. Un bloque armado de otra forma
—por ejemplo desde una función que devuelva el `<script>` completo— quedaría
fuera. Es el límite del método, no una afirmación de que no exista.

Tampoco se abrió ninguna página en un navegador.
