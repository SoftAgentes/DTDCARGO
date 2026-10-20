---
sdd: "0568"
title: "La ficha de un cliente eliminado dice que está eliminado y no pide el saldo"
status: in-progress
author: "founder"
created: 2026-10-20
updated: 2026-10-20
supersedes: null
superseded_by: null
related: ["0558"]
confidencialidad: interno
---

# SDD-0568 — La ficha de un cliente eliminado dice que está eliminado y no pide el saldo

> Abierta por URL, la ficha de un cliente con `deleted_at` dice «Cliente eliminado» y no pide el saldo, en vez de mostrar «No se pudo calcular el saldo» con una referencia de soporte.

## Contexto

El Director lo encontró el 2026-10-20 en el smoke de la SDD-0558, en producción, con la sesión de Sam y solo mirando:
- la ficha de un cliente eliminado (`/studio/clientes/DTD-XXXX`) mostraba «No se pudo calcular el saldo» con una referencia;
- el log decía `[saldo-cliente] ... la ficha no devolvió fila`;
- el estado de cuenta del mismo cliente sí funcionaba, y mostraba bien la factura anulada con su abono.

**La causa:** `client_outstanding` (0492) filtra `c.deleted_at is null` en `asked` y no devuelve fila para un cliente eliminado. `getClientAccountState` (`lib/studio/client-queries.ts`) lo trataba como un error del cálculo.

Quedó anotado en FUERA DE ALCANCE del handoff de la SDD-0566, con destino «SDD chica de la ficha», después de la 2.11. El Director asignó el número el 2026-10-20.

## Decisión

- `EstadoCuentaCliente` (`lib/studio/client-account.ts`) suma el estado `eliminado`, con el día de Caracas en que se eliminó (`eliminadoEl`, AAAA-MM-DD), los códigos conocidos y los embarques en curso.
- `getClientAccountState` mira primero `deleted_at`. Si el cliente está eliminado, **no pide el saldo** y devuelve `eliminado`. Eso vale también sin permiso para el saldo, porque no hay saldo que calcular.
- `diaDeCaracas` saca el día de Caracas (UTC−4) de un timestamptz sin depender de la zona del servidor.
- La cabecera de la ficha (`ClientAccountHeader`) pinta «Cliente eliminado», con el texto «Se eliminó el 19 oct 2026, así que la ficha no calcula su saldo.». Si el rol abre el estado de cuenta, agrega «Sus documentos siguen en el estado de cuenta.». Los embarques en curso se siguen viendo.
- No hay migración: la 0492 no cambia.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `lib/studio/client-account.ts` | el estado `eliminado` y `diaDeCaracas` |
| `lib/studio/client-queries.ts` | `getClientAccountState` no pide el saldo de un cliente eliminado |
| `app/studio/(app)/clientes/_components/ClientAccountHeader.tsx` | el aviso «Cliente eliminado» |
| `lib/studio/__tests__/client-account.test.ts` | el estado, con y sin permiso, y el día de Caracas |
| `app/studio/(app)/clientes/_components/ClientAccountHeader.test.tsx` | el aviso, con y sin estado de cuenta |
| `docs/specs/0568-ficha-cliente-eliminado/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0568-ficha-cliente-eliminado.md` | handoff |

## Criterios de aceptación

1. Con un cliente eliminado, la ficha no llama a `client_outstanding` y no muestra «No se pudo calcular el saldo».
2. La cabecera dice «Cliente eliminado» y el día de Caracas en que se eliminó, y menciona el estado de cuenta solo si el rol lo abre.
3. Un cliente vivo se ve igual que antes.
4. Control rojo: cada regla tiene un mutante que muere.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | esta spec, con allowlist exacta |
| ERR-01 | cumplimiento | un cliente eliminado ya no da un error de sistema: dice qué pasa y no deja una referencia de soporte que no corresponde |
| VIS-01, A11Y-01 | cumplimiento | tokens del sistema (`--bg-elevated`, `--border`); el aviso con `role="status"` |
| Datos personales | no aplica | no se leen ni se muestran datos nuevos |

## Validación

Ver el handoff `.agents/handoffs/0568-ficha-cliente-eliminado.md`.
