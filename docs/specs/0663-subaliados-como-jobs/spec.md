---
sdd: "0663"
title: "Subaliados como jobs: estado de cuenta por trabajo, sección Aliados y asignar códigos nuevos"
status: proposed
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0177", "0255", "0258", "0269", "0281", "0287", "0336", "0543", "0640", "0645", "0662", "0666"]
confidencialidad: interno
---

# SDD-0663 — Subaliados como jobs

> DTD le cobra solo al aliado. Sus subaliados se ven como *trabajos* dentro de su estado de cuenta, como el reporte de *jobs* de QuickBooks. Clientes gana una sección «Aliados», y un código nuevo que llega en un contenedor se asigna a un aliado con un clic: el sistema crea solo el subaliado y el cliente.
> **Estado:** `proposed`. Solo spec: sin código ni migración. La implementación la asigna el Director General cuando Sam apruebe; los números de migración los da el DG.
> **Hermana:** el portal del aliado (registro de clientes, prealertas, marca blanca y `hailuway.com`) va en la [SDD-0666](../0666-portal-del-aliado/spec.md).
> Etiquetas: **C** código leído · **D** documento del repo · **I** inferencia · **NV** sin verificar.
> Los ejemplos usan nombres genéricos: «aliado A» (prefijo `AA`) y «subaliado M» (prefijo `MD`).

## 1. Pedido y decisiones de Sam (2026-11-18)

Un aliado está ofreciendo alianza a otros agentes de carga, cada uno con su propio código: un subaliado dentro de un aliado. Sam fijó cómo se maneja:

| Tema | Decisión |
|---|---|
| A quién cobra DTD | **Solo al aliado.** El subaliado es cliente del aliado; el aliado le cobra (se mantiene SDD-0255 §3.3) |
| Tarifa del subaliado | La misma del aliado principal; no hay otro precio (se mantiene SDD-0269) |
| Comisión entre ellos | No es asunto de DTD |
| Para qué los trabajos | Que el aliado vea su estado de cuenta dividido, se organice y sepa a quién cobrarle |
| Qué muestra cada trabajo | Solo lo facturado; pagos y saldo una sola vez, a nivel del aliado |
| Formato | Como el reporte de *jobs* de QuickBooks: total del aliado y total de cada trabajo |
| Códigos en el estado de cuenta y PDF | Forma completa (`AA-MD-0012`) |
| PDF de un solo trabajo | Solo cargos, con la marca del aliado; sin pagos, sin saldo, sin marca de DTD |
| Lista de subaliados | No hay lista previa. Sam los asigna a medida que carga contenedores |
| Código nuevo en un contenedor | La carga entra y el código queda «por asignar» |
| Al asignar a un aliado | Si el prefijo no es el del aliado, el sistema crea el subaliado solo |
| Fichas | Una ficha de cliente por código (`MD-0012`, `MD-0013`…) |
| Siguientes códigos de un subaliado ya conocido | **Entran solos**: la carga crea el cliente bajo ese subaliado |
| Fila con solo las letras, sin número | Va a la ficha del propio subaliado y sale en su trabajo |
| Sección en Clientes | Una pestaña «Aliados» |
| Prioridad | Primero asignar códigos y sección Aliados; luego el estado de cuenta; al final el portal (SDD-0666) |

Queda descartada la primera versión de esta spec, que proponía cobrarle aparte al subaliado.

## 2. Lo que hay

| Hecho | Fuente | Etiqueta |
|---|---|---|
| La insignia es jerárquica: el cliente de un subaliado se guarda `AA-MD-1232` y se imprime `MD-1232` | SDD-0255 §3.1–3.2; `lib/shared/markbox-chain.ts` (`parseMarkbox`, `buildMarkbox`, `printMarkbox`) | D, C |
| `aliados.parent_aliado_id` nulo = raíz; no nulo = subaliado. `clients.aliado_id` apunta al aliado más profundo | `supabase/migrations/0362_aliados_base.sql` | C |
| Un aliado exige una ficha ancla (`aliados.client_id` NOT NULL y único) cuyo código es la insignia pelada (`MD`) | 0362, 0371 | C |
| El cliente de un subaliado se inserta con la cadena completa; `MD-0012` suelto se rechaza | Guarda `clients_guard_markbox_aliado` (0371); `markbox_choca_con_insignia` | C |
| Una insignia no se puede crear si otra ficha ya lleva `MD` o `MD-…` | `aliados_guard_prefijo_libre` (0372) | C |
| El prefijo es único en todo el tenant | `aliados_prefix_uq` | C |
| `resolve_markbox` compara el código exacto: la forma impresa `MD-0012` no resuelve a `AA-MD-0012` | 0367 | C |
| Alta de subaliado manual: ficha + «Convertir en aliado» con «Cuelga de» | `AliadoCard.tsx`; `convertirEnAliadoAction` en `app/studio/(app)/clientes/actions.ts`; SDD-0258 §6 | C, D |
| Alta de cliente bajo aliado con código explícito o con `next_markbox_aliado` | `createClientAction` (SDD-0646) | C |
| La lista de Clientes marca qué ficha es aliado y de quién es cada cliente; no hay vista solo de aliados | `ClientsClient.tsx` | C |
| Clientes tiene subpantallas enlazadas desde su cabecera: duplicados, registros por link, códigos del legado | `ClientsClient.tsx` | C |
| La tarifa vive solo en el raíz y el subaliado la hereda | SDD-0269; migr 0382 (`resolve_price_book`) | D, C |
| El generador de lotes factura por cliente y contenedor; para aliados, al raíz. Cada línea lleva `shipmentCode` | SDD-0543 | D |
| En producción el generador **aborta** si una marca no resuelve; no crea clientes ni aliados | `scripts/consolidados/lote-sql.ts` (corte de la previa) | C |
| «Pasar a otro cliente» mueve embarque, recepciones, borradores de factura e items del contenedor, con bloqueos y vista previa | SDD-0645; RPC `reassign_shipment_client` (migr 0551, **aplicada en producción**, dato del DG); `lib/studio/reasignar-embarque.ts` | D, C |
| La ficha del embarque muestra arriba la franja «Cliente»; con el comodín `DTD-0000` ofrece «Asignar cliente» | SDD-0662; `ClienteDelEmbarque.tsx`, `ReassignClientPanel.tsx` | D, C |
| El estado de cuenta es un libro de cargos y abonos, una sola función para portal, Studio y PDF | `lib/portal/statement-ledger.ts` (`buildStatementLedger`); SDD-0177, 0281, 0287 | C, D |
| La pantalla del Studio descarta las líneas de factura al mapear (`filasParaLedger`) | `app/studio/(app)/clientes/[markbox]/estado-de-cuenta/page.tsx` | C |
| La factura guarda total y pagado, no pago por línea | cabecera de `statement-ledger.ts` | C |
| La pantalla «Revisar contenedor» no existe todavía | SDD-0640 en `proposed` | D |
| Si la línea «Exceso de peso» lleva `shipmentCode` | — | NV |
| Cuántos subaliados hay en producción | — | NV |

## 3. Propuesta

### 3.1 Qué es un trabajo

Un **trabajo** es un subaliado visto desde la cuenta de su aliado raíz. No es una entidad nueva: sale de la jerarquía que ya existe.

Cada línea de una factura del aliado pertenece a un trabajo así: la línea nombra un embarque (`shipmentCode`) → el embarque es de un cliente → el cliente cuelga de un aliado → si ese aliado es un subaliado, ese es el trabajo. Con más de un nivel, el trabajo es el subaliado directo del raíz. Los clientes directos del aliado y las líneas sin embarque van en «General».

### 3.2 Sección «Aliados» en Clientes (F1)

Subpantalla `/studio/clientes/aliados`, enlazada desde la cabecera de Clientes junto a las otras tres.

| Elemento | Qué hace |
|---|---|
| Lista de aliados raíz | Nombre, prefijo, estado, cuántos subaliados y cuántos clientes |
| Subaliados anidados | Debajo de cada aliado, con su prefijo y su conteo de clientes |
| Accesos por fila | Ficha, estado de cuenta por trabajo, sus clientes |
| «Agregar subaliado» | El alta que hoy está en la ficha, con el aliado padre ya elegido |
| «Códigos por asignar» | Los embarques que siguen en la ficha comodín, con su código del Excel, contenedor, m³ y cajas. Cada fila enlaza a la ficha del embarque (SDD-0662), donde se asigna |

Hereda `requireModuleView("clients")` del layout. Reutiliza `listAliadoOptions`, `prefixChain`, `parentOptions` y el alta de `AliadoCard.tsx`. Sin migración.

### 3.3 Asignar un código nuevo a un aliado (F2)

**Dónde:** en la franja «Cliente» de la ficha del embarque (SDD-0662). El modal de «Asignar cliente» gana una segunda opción: **«Asignar a un aliado»**. No se duplica el modal ni se amplía la SDD-0662.

**Qué hace**, en una sola transacción (RPC nueva):

1. Parte el código del embarque (`MD-0012`, `AA-0007`, `MD`).
2. Si el prefijo es el del aliado elegido → usa o crea el cliente `AA-NNNN`.
3. Si no → usa o crea el **subaliado** con ese prefijo bajo el aliado: ficha ancla con la insignia pelada, **sin correo** (SDD-0258 §6.1), y fila en `aliados` con `parent_aliado_id`. Su nombre es el prefijo hasta que alguien lo edite.
4. Usa o crea el cliente `AA-MD-NNNN` con `aliado_id` = el subaliado. Si la fila trae solo las letras, el embarque va a la ficha ancla del subaliado.
5. Mueve el embarque con la misma lógica y los mismos bloqueos de `reassign_shipment_client`.

**Reglas:**

- Si el prefijo ya pertenece a **otro** aliado, o choca con otra ficha (0372), no asigna y lo dice con el nombre del dueño actual.
- **Vista previa** antes de confirmar: «Se crea el subaliado MD dentro de AA y el cliente AA-MD-0012».
- Permiso especial `reassign_shipment_owner`, motivo obligatorio y log de auditoría, igual que SDD-0645. Sin `puedeVerNombres` (SDD-0531) no se monta.
- Lleva migración (la RPC). Depende de la 0551, ya aplicada.

**Los siguientes códigos entran solos.** El generador de lotes gana una rama: si una marca no resuelve pero su prefijo pertenece a un aliado o subaliado vivo, crea el cliente con la cadena completa (o usa la ficha ancla si solo trae las letras) en vez de abortar. Es una excepción a «un lote de producción no crea clientes» (SDD-0543), limitada a prefijos de aliado ya asignados. Cualquier otra marca desconocida sigue yendo a la ficha comodín, «por asignar». La previa del lote lista lo que va a crear antes del simulacro.

### 3.4 Estado de cuenta por trabajo (F3)

Formato tipo QuickBooks:

| Bloque | Qué muestra |
|---|---|
| Resumen del aliado | Facturado, pagado y saldo con DTD, como hoy |
| General | Embarques de sus clientes directos y líneas sin embarque, con «Total de General» |
| Un bloque por trabajo | Nombre y prefijo del subaliado; sus embarques con código completo, contenedor, m³ y monto; «Total del trabajo» |
| Total del aliado | La suma de todos los bloques |
| Abonos y saldo | Los pagos y el saldo, una sola vez, a nivel del aliado |

Reglas:

- Una función pura nueva, junto a `buildStatementLedger`, agrupa las líneas por trabajo. `buildStatementLedger` no cambia.
- Invariante con prueba: la suma de «General» y de todos los trabajos es igual al total de cargos del libro.
- `filasParaLedger` deja de descartar las líneas.
- Se puede sacar el PDF completo o el de **un solo trabajo**. El de un trabajo lleva solo los cargos de ese trabajo, con la marca del aliado, sin pagos, sin saldo y sin marca de DTD: es el papel que el aliado le pasa a su subaliado.
- Un aliado sin subaliados y un cliente directo ven su estado de cuenta igual que hoy.
- Sin migración.

El mismo estado de cuenta en el portal del aliado va en la SDD-0666.

## 4. Fases

| Fase | Qué entrega | Migración |
|---|---|---|
| F1 | Sección «Aliados» con «Códigos por asignar» | No |
| F2 | «Asignar a un aliado» y los siguientes códigos que entran solos | Sí (RPC) |
| F3 | Estado de cuenta por trabajo en el Studio, en pantalla y en PDF | No |

F1 y F2 van juntas y primero (prioridad de Sam). Las pantallas pasan por `/ui-check`.

## 5. Avisos heredados por verificar antes de programar

De la SDD-0258 §7; pueden seguir vivos:

- `/verificar` no reconocía la forma impresa (`MD-1232`) tecleada a mano.
- El código de referido se arma mal para códigos de aliado.

## 6. Fuera de alcance

- Cobrarle al subaliado o darle tarifa propia.
- El portal del aliado y todo lo de marca blanca (SDD-0666).
- Mover facturas ya emitidas.
- Integración con QuickBooks.
- Consultas o cambios en producción: esta spec se escribió leyendo el repo.

## 7. Aceptación de esta spec

- [ ] Sam aprueba la spec.
- [ ] El Director General asigna las fases y el número de migración de F2.
