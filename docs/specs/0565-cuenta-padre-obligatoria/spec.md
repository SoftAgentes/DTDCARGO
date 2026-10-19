---
sdd: "0565"
title: "Ninguna cuenta del plan queda huérfana"
status: in-progress
author: "founder"
created: 2026-10-19
updated: 2026-10-19
supersedes: null
superseded_by: null
related: ["0040", "0563"]
confidencialidad: interno
---

# SDD-0565 — Ninguna cuenta del plan queda huérfana

> No se crea una subcuenta sin su cuenta padre, y no se borra una cuenta que tenga subcuentas.

## Contexto

La SDD-0563 dejó fijada, en su prueba de paridad, una divergencia que no es solo teórica. Una subcuenta sin su cuenta intermedia (`1.1.2.9.1` sin `1.1.2.9`) no sube su saldo a 1.1.2, porque `computeBalances` (`lib/studio/account-queries.ts`) sube cada cuenta solo a su padre directo. La radiografía sí la suma (`like '1.1.2.%'`). Por la misma regla, una huérfana tampoco entra en el total de su grupo en Reportes.

Hoy es posible crearla: `validateAccountInput` (`lib/studio/account-types.ts`) no exige que exista la cuenta padre, y `buildAccountTree` sube las huérfanas a la raíz del árbol. Borrar también puede dejarlas:
- `deleteAccount` (`app/studio/(app)/contabilidad/actions.ts`) solo se niega si la cuenta tiene movimientos;
- `parent_id` tiene `on delete cascade` (`0078_contabilidad.sql`), así que borrar una cuenta se llevaría en silencio las subcuentas sin movimientos que la apuntan por `parent_id`.

**Decisión del Director, 2026-10-19 (revisable por Sam):** «Hay que exigir la cuenta padre en `validateAccountInput`: no se puede crear `1.1.2.9.1` si no existe `1.1.2.9`. Es la regla de cualquier plan de cuentas, y evita el problema de raíz. No hace falta el rollup al ancestro más cercano.» Midió producción en solo lectura, solo el catálogo: 91 cuentas y **0 huérfanas**, así que no hay datos que rescatar. Después agregó: «Incluye el bloqueo del borrado de una cuenta intermedia con subcuentas en la misma SDD. Es la misma invariante: ninguna cuenta queda huérfana. Hazlo como propiedad y no como consejo. Resuelve primero en `lib/`.»

## Decisión

- **`lib/studio/account-types.ts`:**
  - `cuentaPadreFaltante(code, plan)`: el código sin su último segmento, si no está en el plan. Compara el código entero: `1.1.20` no es el padre de `1.1.2.9`.
  - `subcuentasDe(cuenta, plan)`: las cuentas con su código como prefijo (código y punto) **y** las que la apuntan por `parent_id` aunque su código no lo diga. Esto último es por el `on delete cascade`.
  - `validateAccountInput(input, plan)`: el plan es **obligatorio**. Al crear, recibe el plan del tenant y rechaza el código si falta la cuenta padre: «Primero crea la cuenta 1.1.2.9: es la cuenta padre de 1.1.2.9.1.». Al editar, recibe `"edicion"`, porque `updateAccount` no escribe el código. Quien cree cuentas por otro camino tiene que decidir, porque el tipo no lo deja omitir.
- **`lib/studio/account-queries.ts`:** `planDeCuentas(supabase)` lee `id, code, parent_id` del tenant, **paginado**. Si no llega completo, lanza: un plan cortado dejaría pasar una huérfana, y `listAccounts` se corta en 1000 sin avisar.
- **`app/studio/(app)/contabilidad/actions.ts`:** conecta lo anterior, sin lógica propia.
  - `createAccount` valida contra el plan.
  - `updateAccount` valida con `"edicion"`.
  - `deleteAccount` se niega con las subcuentas a la vista: «No se puede eliminar la cuenta 1.1.2.9: tiene subcuentas (1.1.2.9.1). Elimina primero las subcuentas.». Con más de tres, nombra tres y cuenta el resto. Esto va antes del control de movimientos.
  - Si no se puede leer el plan, no crea ni borra, y el mensaje no trae el texto de la base (ERR-01).
- No hay migración ni cambios de esquema o de pantalla. El error del código ya se pinta debajo del campo en el cajón de la cuenta.

## Límite: la garantía cubre la acción, no la API directa

`accounts` tiene `grant select, insert, update, delete on public.accounts to authenticated` (`0078_contabilidad.sql:137`), con RLS por tenant, y ninguna migración posterior lo revoca. `parent_id` es `references public.accounts(id) on delete cascade` (`0078_contabilidad.sql:28`). Una sesión autenticada puede insertar, cambiar el código o borrar por la API sin pasar por estas acciones. Además, **hoy ninguna pantalla llama a `deleteAccount`** (`git grep` encuentra solo su definición): en la práctica, una cuenta solo se borra con un `delete` directo.

**Decisión del Director, 2026-10-19:** el candado en la base no va en esta SDD y la 0493 no se toma ahora. El problema de fondo es ese grant, y eso es la **2.4 del plan (candado del mayor)**: policies por rol y nada de UPDATE ni DELETE para `authenticated`. La guarda de huérfanas en la base, y el `on delete cascade`, van con ella. También se cruza con la SDD del cierre contable con superclave, que toca los disparadores del mayor.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `lib/studio/account-types.ts` | `CuentaDelPlan`, `cuentaPadreFaltante`, `subcuentasDe`, `PlanParaValidar`; `validateAccountInput` exige el padre al crear |
| `lib/studio/account-queries.ts` | `planDeCuentas`, paginado y sin plan cortado |
| `app/studio/(app)/contabilidad/actions.ts` | `createAccount`, `updateAccount` y `deleteAccount` usan lo anterior; `errorDelPlan` |
| `lib/studio/__tests__/account-types.test.ts` | pruebas puras; las llamadas viejas pasan el plan |
| `lib/studio/__tests__/contabilidad-qbo.test.ts` | las dos llamadas pasan el plan |
| `app/studio/(app)/contabilidad/__tests__/plan-de-cuentas-sin-huerfanas.test.ts` | nueva: la propiedad, por las acciones |
| `docs/specs/0565-cuenta-padre-obligatoria/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0565-cuenta-padre-obligatoria.md` | handoff |

## Criterios de aceptación

1. `createAccount` no crea `1.1.2.9.1` sin `1.1.2.9` y dice cuál falta; crea el padre y después la hija.
2. `deleteAccount` no borra una cuenta con subcuentas por código ni por `parent_id`: **borrar el padre no se lleva a las hijas.** El doble de la prueba emula el `on delete cascade` de la base, así que, sin la regla, las hijas desaparecerían y la prueba lo vería. Borra la hija y después el padre.
3. Una cuenta sin subcuentas ni movimientos se borra; una que no existe da «Cuenta no encontrada.».
4. Un plan que no llega completo no se usa: `planDeCuentas` lanza.
5. Si no se puede leer el plan, ni crea ni borra, y no muestra el texto de la base.
6. Control rojo: cada regla tiene un mutante que muere.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | esta spec con allowlist exacta |
| ERR-01 | cumplimiento | el error del código va al campo y dice qué falta; el del borrado dice qué ocurrió, que no se borró nada y qué hacer; el texto de la base no se muestra (prueba y mutante M8) |
| AUD-01 | no aplica | ni el rechazo de una validación ni un borrado bloqueado escriben auditoría; no cambia lo que se audita |
| VIS-01, A11Y-01, BTN-01 | no aplica | no cambian pantallas, controles ni botones |

## Validación

Ver el handoff `.agents/handoffs/0565-cuenta-padre-obligatoria.md`.
