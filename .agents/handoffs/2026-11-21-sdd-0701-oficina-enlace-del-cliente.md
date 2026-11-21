# Handoff · SDD-0701 · Oficina_Virtual: un enlace del cliente escala

**Pedido:** hallazgo de la etapa 1 de SDD-0626 (conversación 6): el cliente mandó un enlace y salió una respuesta
normal. Los directores acordaron arreglarlo antes de la etapa 2, en su propio SDD y PR. Rama
`claude/oficina-enlace-cliente`, desde `origin/main` en `f67daa778`.

## Qué se hizo

- **`lib/studio/oficina/tema-enlace.ts`** (nuevo): `tieneEnlace` y `clienteMandoEnlace`. Solo mensajes del cliente,
  en memoria.
- **`lib/studio/oficina/despachador.ts`:** después del chequeo de dinero, un enlace del cliente escala con
  `cliente:enlace` y prioridad 2, **sin llamar al agente**.
- **Pruebas:** `lib/studio/oficina/__tests__/enlace-cliente.test.ts` (nuevo) y dos casos en
  `lib/studio/__tests__/oficina-paso3b.test.ts`.
- **Spec:** `docs/specs/0701-oficina-enlace-del-cliente/spec.md`.

## Decisiones tomadas en esta PR (revisables)

- **Prioridad 2**, la de un mensaje normal del cliente. Dinero + enlace → gana el dinero (3).
- **`dtdcargo.com` también cuenta** como enlace: es fácil de imitar y la Oficina_Virtual no juzga qué es nuestro.
- **Sin esquema, solo TLD de una lista cerrada.** Se dejan fuera los TLD que en español son palabras (`es`, `la`,
  `no`, `pa`, …) para que «ok.gracias» o «Lo necesito.Es urgente» no escalen. Costo: `algo.es` sin esquema no
  escala. Detalle en la spec.

## Pendiente / fuera de esta PR

- No se ven: IP sin esquema y enlaces disfrazados («bit punto ly», «hxxp://»). Revisar en la etapa 2.
- La spec de SDD-0626 no se tocó; si el DG quiere, una línea en §3.5 que apunte a este SDD.
- No se tocó producción. Entra con el despliegue normal del ERP, sin migración.

## Qué se ejecutó y qué no

Ver la descripción de la PR.
