---
sdd: "0480"
title: "El recargo de baterías del respaldo vuelve a espejar el ERP (×1,3 → ×1,5)"
status: done
author: "Director (hallazgo) + Claude Opus 5 (Worker) + founder"
created: 2026-09-18
updated: 2026-09-18
supersedes: null
superseded_by: null
related: ["0475", "0476"]
confidencialidad: interno
---

# DTD-0480 — El recargo de baterías del respaldo vuelve a espejar el ERP

> Si Supabase se cae, el calculador del sitio cotiza con las constantes de
> `lib/calculadora.ts`. La de baterías valía ×1,3 mientras el ERP cobra ×1,5:
> ante una caída, las cargas con baterías salían 13,3% más baratas, en silencio.

## Contexto

`CONFIG.recargoBateriaMult` es el respaldo de
`calculator_settings.recargo_bateria_mult`, que el sitio lee por la RPC anon
`public_calculator_config`. Cuando la RPC no responde, el calculador usa la
constante. Es el mismo modo de falla que la SDD-0475 cerró para
`tarifaBaseCBM`: si el ERP cambia y el código no, el precio se mueve sin error.

| Fuente | Valor (2026-09-18) |
| --- | --- |
| RPC `public_calculator_config`, leída como `anon` | `recargo_bateria_mult = 1.500` |
| Props públicas de `/tarifas` (leídas por coordinación) | `"recargoBateriaMult":1.5` |
| `CONFIG.recargoBateriaMult` en `main` | `1.3` |

Coordinación comparó los diez campos numéricos de `CONFIG` con producción: nueve
alineados y éste el único desalineado. El Worker lo contrastó contra las dos RPC
públicas, leídas como `anon`. `public_calculator_config` da 1.000 kg/m³, $2/kg,
9.000 kg, $0 de descuento Valencia, $50 de embalaje especial, ×1,5, 200 km, $1/km,
68 m³ y 27.000 kg, todos iguales a `CONFIG` salvo el de baterías. `public_cbm_rate`
da $850 y mínimo $50, también iguales. Con esta SDD no queda ningún espejo
desalineado conocido.

### La historia, porque ya se revirtió una vez

1. Hasta el **2026-08-05** el código decía ×1,5 mientras el ERP cobraba ×1,3. Ese
   día el commit `535aa0ec` («el respaldo del codigo cobraba distinto que
   produccion») lo bajó a ×1,3 para espejar el ERP.
2. **Después** el founder subió el ERP a ×1,5. Ninguna migración tocó el valor:
   0103, 0274, 0283, 0287 y 0448 tienen `default 1.5`, pero son
   `create table if not exists` con `insert … on conflict do nothing` y no pisan
   una fila existente. El cambio se hizo editando el ERP.
3. El 2026-09-18, antes de alinear, se le preguntó al founder si el ×1,5 era
   intencional, porque contradecía la decisión escrita del 2026-08-05. Su
   respuesta, textual: **«Sí, ×1,5 es correcto — Lo subí a propósito. Alineen el
   código y el marketing a ×1,5. El sitio está cobrando bien.»**

Si este número vuelve a quedar distinto del ERP, la regla es la de la SDD-0475:
**mirar el ERP y alinear el código con eso**. No hay que revertir por reflejo.

## Alcance

**Entra:**

- `lib/calculadora.ts`: `recargoBateriaMult` de 1.3 a **1.5**, con la historia
  de arriba en su comentario.
- `__tests__/calculadora-respaldo-alineado.test.ts`: **quinto valor anclado**, con
  número literal, igual que los otros cuatro (850, 1.000, 50 y 580).
- `__tests__/calculadora.test.ts`: los literales que dependían de ×1,3,
  recalculados uno por uno (tabla abajo).
- `docs/marketing/calculadora-explicada.html`: la tabla de recargos, el ejemplo
  con baterías y el pie, sin la leyenda «en revisión».
- `docs/marketing/README.md`: el pendiente «baterías en revisión» pasa a resuelto,
  citando la decisión del founder.

**Revisado y sin cambios:**

- `e2e/`: **ninguna** prueba menciona baterías ni el multiplicador, tampoco entre
  las omitidas. Buscado por «bater», «battery», `recargoBateria`, ×1,3/×1,5 y los
  totales derivados (1105, 2210, 7540).
- `lib/faqs.ts`: la respuesta pública ya dice «recargo del 50%» y su comentario,
  `×1.5 = +50%`.
- `lib/studio/calculator-settings-types.ts`: la ayuda del Admin ya dice
  «1.5 = +50%».
- `lib/studio/document-import/estimate.test.ts`: usa ×1,5 en sus propios
  parámetros.
- `public/guias/comprar-en-alibaba.html` y `public/interno/guia-peso.html`: nombran
  las baterías, pero no el multiplicador.
- `components/CalculadoraForm.tsx`: la insignia muestra `×${params.recargoBateriaMult}`
  y sale del ERP o del respaldo, sin literal propio.

**No entra:** ningún dato de producción (el ERP ya está en ×1,5) ni migraciones.

## Literales recalculados

| Test | Antes (×1,3) | Después (×1,5) |
| --- | --- | --- |
| `calculadora.test.ts` · 1 m³, 400 kg, Caracas, con baterías (usa `CONFIG`) | recargo 255 · total 1105 | recargo **425** (850 × 0,5) · total **1275** (850 × 1,5) |
| `calculadora.test.ts` · 10 m³, 3.000 kg, params explícitos «igual que prod» | recargo 1740 · total 7540 | recargo **2900** (5800 × 0,5) · total **8700** (5800 × 1,5) |
| `calculadora-respaldo-alineado.test.ts` | — | `expect(CONFIG.recargoBateriaMult).toBe(1.5)` |

El test «DEFAULT_PARAMS reproduce exactamente el comportamiento de CONFIG» compara
los dos caminos entre sí, sin literal, y sigue valiendo tal cual. El de
`withParams({ recargoBateriaMult: 2 })` fija su propio valor.

## Marketing

El ejemplo con baterías (2 m³, 800 kg, Caracas) se **corrió en el motor** con los
defaults nuevos, sin hacer la cuenta a mano: total **$2.550**, recargo **$850**. La
base de $1.700 se comprobó con el mismo motor: el ejemplo sin baterías da $1.700 y
el de 2.600 kg da $2.900, iguales a los de la guía.

## Aceptación

1. `CONFIG.recargoBateriaMult === 1.5`, igual a `recargo_bateria_mult` de
   producción.
2. El test de anclaje falla si alguien mueve ese valor.
3. Ningún test ni e2e queda con un literal derivado de ×1,3.
4. La guía de atención al cliente dice ×1,5 y su ejemplo sale del motor.
5. El README de marketing ya no tiene el pendiente abierto.

## Adjuntos

Ninguno.
