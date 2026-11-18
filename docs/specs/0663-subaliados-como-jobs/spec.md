---
sdd: "0663"
title: "Subaliados como jobs: estado de cuenta dividido y sección Aliados"
status: proposed
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0177", "0255", "0258", "0269", "0281", "0287", "0336", "0543", "0640"]
confidencialidad: interno
---

# SDD-0663 — Subaliados como jobs: estado de cuenta dividido y sección Aliados

> El aliado sigue siendo el único al que DTD le cobra. Sus subaliados pasan a verse como *jobs* dentro de su estado de cuenta, para que el aliado sepa cuánto le toca cobrarle a cada uno. Además, Clientes gana una sección «Aliados».
> **Estado:** `proposed`. Solo spec: sin código y sin migración. La implementación la asigna el Director General cuando Sam apruebe.
> Etiquetas: **C** código leído · **D** documento del repo · **I** inferencia · **NV** sin verificar.
> Los ejemplos usan nombres genéricos: «aliado A» (prefijo `AA`) y «subaliado B» (prefijo `BB`).

## 1. Pedido y decisiones de Sam (2026-11-18)

Un aliado está ofreciendo alianza a otros agentes de carga, cada uno con su código: un subaliado dentro de un aliado. Sam fijó el mismo día cómo se maneja:

1. **El subaliado es cliente del aliado. DTD no le cobra.** Le cobra el aliado. Se mantiene la regla de la SDD-0255 §3.3.
2. **Lo que se pide es visual.** El aliado quiere ver su estado de cuenta dividido por subaliado, como los *jobs* de QuickBooks, para organizarse y saber a quién tiene que cobrarle.
3. **Una sección «Aliados» dentro de Clientes**, para entrar ahí.
4. **Quién es subaliado de quién no se resuelve ahora.** La oficina cuelga después las fichas que hagan falta. Esta spec no mueve ni fusiona datos.

Queda descartada la primera versión de esta spec, que proponía cobrarle aparte al subaliado.

## 2. Lo que hay

| Hecho | Fuente | Etiqueta |
|---|---|---|
| La insignia es jerárquica: el cliente de un subaliado se guarda `AA-BB-1232` y se imprime `BB-1232` | SDD-0255 §3.1 y §3.2; `lib/shared/markbox-chain.ts` | D, C |
| `aliados.parent_aliado_id` nulo es aliado raíz; no nulo es subaliado. `clients.aliado_id` apunta al aliado más profundo | `supabase/migrations/0362_aliados_base.sql`; `lib/studio/aliados/aliado-types.ts` | C |
| El subaliado se da de alta desde la ficha de un cliente, con un selector de aliado padre. La ficha del padre lista sus subinsignias | `app/studio/(app)/clientes/_components/AliadoCard.tsx` | C |
| La lista de Clientes ya marca con una insignia qué ficha es un aliado y de qué aliado es cada cliente. No hay una vista solo de aliados | `app/studio/(app)/clientes/_components/ClientsClient.tsx` | C |
| Clientes ya tiene subpantallas enlazadas desde su cabecera: duplicados, registros por link y códigos del legado | `ClientsClient.tsx`; `app/studio/(app)/clientes/` | C |
| La tarifa vive solo en el aliado raíz y el subaliado la hereda | SDD-0269; `supabase/migrations/0382_price_books.sql` | D, C |
| Los lotes de contenedor emiten una factura por cliente y contenedor; para los aliados, al aliado raíz. Cada línea de flete lleva el código del embarque (`shipmentCode`) | SDD-0543, tabla de `invoices` | D |
| El estado de cuenta es un libro de cargos y abonos armado por una sola función, que usan el portal, el Studio y el PDF | `lib/portal/statement-ledger.ts`; SDD-0177, SDD-0281, SDD-0287 | C, D |
| La factura guarda el total y lo pagado. No hay un registro de pago por línea | `lib/portal/statement-ledger.ts` (cabecera) | C |
| El portal del aliado ya lee los embarques de sus subclientes que nombran las líneas de sus facturas | `lib/portal/portal-legal-queries.ts` (`embarquesDeLasLineas`) | C |
| Si la línea «Exceso de peso» lleva código de embarque | — | NV |
| Cuántos subaliados hay en producción | — | NV |

## 3. Propuesta

### 3.1 Qué es un job

Un **job** es un subaliado visto desde la cuenta de su aliado. No es una entidad nueva: sale de la jerarquía que ya existe.

Cada línea de una factura del aliado pertenece a un job así:

1. la línea nombra un embarque (`shipmentCode`);
2. el embarque es de un cliente;
3. el cliente cuelga de un aliado (`clients.aliado_id`);
4. si ese aliado es un subaliado, ese es el job. Con más de un nivel, el job es el subaliado directo del aliado raíz.

Lo que es del propio aliado (sus clientes directos) y las líneas que no nombran un embarque van en un grupo «General».

### 3.2 Estado de cuenta dividido

El estado de cuenta de un aliado con subaliados se ve así:

| Bloque | Qué muestra |
|---|---|
| Resumen del aliado | Saldo total, vencido y último pago, como hoy |
| General | Cargos de sus clientes directos y líneas sin embarque, con subtotal |
| Un bloque por job | Nombre y prefijo del subaliado, sus embarques con contenedor, medida y monto, y el subtotal facturado |
| Abonos y saldo | Los pagos del aliado y el saldo, a nivel de toda la cuenta |

Reglas:

- El saldo sigue siendo uno solo: el del aliado con DTD. La suma de los subtotales de «General» y de los jobs es igual al total de cargos del libro actual.
- El libro actual no cambia. La división es una lectura adicional sobre las mismas facturas, igual que el libro es una lectura de las facturas.
- Un aliado sin subaliados y un cliente directo ven su estado de cuenta igual que hoy.
- Se puede sacar el estado de cuenta completo o el de un solo job, en pantalla y en PDF. El de un solo job es el que el aliado usa para cobrarle a su subaliado; lleva los cargos de ese job y no muestra los abonos ni el saldo del aliado con DTD.
- El documento que ve el subaliado sale con la marca del aliado, no con la de DTD (SDD-0336).

Los abonos por job dependen de la decisión 1 del §5.

### 3.3 Sección «Aliados» en Clientes

Una subpantalla nueva, `/studio/clientes/aliados`, enlazada desde la cabecera de Clientes junto a las otras tres.

| Elemento | Qué hace |
|---|---|
| Lista de aliados raíz | Nombre comercial, prefijo, estado, cuántos subaliados y cuántos clientes tiene |
| Subaliados anidados | Debajo de cada aliado, sus subaliados con su prefijo y su conteo de clientes |
| Accesos por fila | Abrir la ficha, abrir el estado de cuenta dividido, ver sus clientes |
| «Agregar subaliado» | Abre el alta que hoy está en la ficha, con el aliado padre ya elegido |

Reglas:

- Hereda el permiso del módulo Clientes (`requireModuleView("clients")` en el layout). El saldo y el estado de cuenta respetan los permisos que ya tienen.
- No crea ni mueve fichas por su cuenta. Colgar un cliente existente de un subaliado se sigue haciendo desde la ficha.
- El alta de aliado y de subaliado no cambia de reglas: prefijo único, de 2 a 4 letras, sin reservados.

### 3.4 Portal del aliado

El aliado ve en su portal el mismo estado de cuenta dividido y puede descargar el PDF completo o el de un job. El subaliado no recibe acceso al portal en esta spec: eso depende de los pendientes §8.3 y §8.5 de la SDD-0255.

## 4. Fases propuestas

| Fase | Qué entrega | Migración |
|---|---|---|
| F1 | Sección «Aliados» en Clientes | No |
| F2 | Estado de cuenta dividido por job en el Studio, en pantalla y en PDF | No, con la recomendación de la decisión 1 |
| F3 | El mismo estado de cuenta en el portal del aliado | No |

Las pantallas nuevas pasan por `/ui-check`. F2 y F3 reutilizan `buildStatementLedger` sin cambiar su resultado; la división va en una función pura aparte, con pruebas que comprueben que los subtotales suman el total de cargos.

## 5. Decisiones abiertas de Sam

| # | Pregunta | Recomendación | Por qué |
|---|---|---|---|
| 1 | Por cada job, ¿se muestra solo lo facturado, o también cuánto ha pagado y cuánto debe ese job? | Solo lo facturado; los abonos y el saldo van a nivel del aliado | El pago se guarda por factura, no por línea. Mostrar el saldo por job obliga a emitir una factura por subaliado y contenedor, y a una migración |
| 2 | ¿El aliado ve esto en su portal, o solo lo saca la oficina desde el Studio? | Las dos cosas; el portal en F3 | El aliado es quien lo necesita para cobrar, sin pedírselo a la oficina |
| 3 | ¿El PDF de un solo job sale sin los abonos ni el saldo del aliado con DTD? | Sí | Es el papel que el aliado le pasa a su subaliado; no debe mostrar la cuenta del aliado con DTD |

## 6. Fuera de alcance

- Cobrarle al subaliado o darle tarifa propia.
- Decidir qué códigos son subaliados de quién, y mover o fusionar fichas existentes.
- Acceso del subaliado al portal.
- Integración con QuickBooks.
- Consultas o cambios en producción: esta spec se escribió leyendo el repo.

## 7. Aceptación de esta spec

- [ ] Sam responde las tres decisiones del §5.
- [ ] El Director General asigna las fases.
