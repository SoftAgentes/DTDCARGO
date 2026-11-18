---
sdd: "0663"
title: "Subaliados como jobs: estado de cuenta por trabajo, sección Aliados y asignar códigos nuevos"
status: proposed
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0177", "0255", "0258", "0269", "0281", "0287", "0336", "0531", "0543", "0640", "0645", "0662", "0664", "0666", "0674"]
confidencialidad: interno
---

# SDD-0663 — Subaliados como jobs

> DTD le cobra solo al aliado. Sus subaliados se ven como *trabajos* dentro de su estado de cuenta, como el reporte de *jobs* de QuickBooks. Clientes gana una sección «Aliados», y un código nuevo que llega en un contenedor se asigna a un aliado desde la ficha del embarque: el sistema crea el subaliado y el cliente.
> **Estado:** `proposed`. Solo spec: sin código ni migración. La implementación la asigna el Director General cuando Sam apruebe; los números de migración los da el DG.
> **Hermana:** el portal del aliado y la marca blanca van en la [SDD-0666](../0666-portal-del-aliado/spec.md).
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
| Marca de un subaliado | La de su aliado principal (ver §3.5) |
| Lista de subaliados | No hay lista previa. Sam los asigna a medida que carga contenedores |
| Código nuevo en un contenedor | Queda «por asignar» hasta que alguien lo asigne |
| Al asignar a un aliado | Si el prefijo no es el del aliado, el sistema crea el subaliado |
| Fichas | Una ficha de cliente por código (`MD-0012`, `MD-0013`…) |
| Siguientes códigos de un subaliado ya conocido | **Entran solos**: la carga crea el cliente bajo ese subaliado (excepción formal en §3.4) |
| Fila con solo las letras de un subaliado | Va a la ficha del propio subaliado y sale en su trabajo |
| Sección en Clientes | Una pestaña «Aliados» |
| Prioridad | Primero asignar códigos y sección Aliados; luego el estado de cuenta; al final el portal (SDD-0666) |

Queda descartada la primera versión de esta spec, que proponía cobrarle aparte al subaliado.

## 2. Lo que hay

| Hecho | Fuente | Etiqueta |
|---|---|---|
| La insignia es jerárquica: el cliente de un subaliado se guarda `AA-MD-1232` y se imprime `MD-1232` | SDD-0255 §3.1–3.2; `lib/shared/markbox-chain.ts` (`parseMarkbox`, `buildMarkbox`, `printMarkbox`) | D, C |
| `aliados.parent_aliado_id` nulo = raíz; no nulo = subaliado. `clients.aliado_id` apunta al aliado más profundo | `supabase/migrations/0362_aliados_base.sql` | C |
| Un aliado exige una ficha ancla (`aliados.client_id` NOT NULL y único) cuyo código es la insignia pelada (`MD`) | 0362, 0371 | C |
| El cliente de un subaliado se inserta con la cadena completa; `MD-0012` suelto se rechaza | `clients_guard_markbox_aliado` (0371); `markbox_choca_con_insignia` | C |
| Una insignia no se puede crear si otra ficha ya lleva `MD` o `MD-…` | `aliados_guard_prefijo_libre` (0372) | C |
| El prefijo es único en todo el tenant | `aliados_prefix_uq` | C |
| `resolve_markbox` compara el código exacto: `MD-0012` no resuelve a `AA-MD-0012` | 0367 | C |
| Alta manual de subaliado: ficha + «Convertir en aliado» con «Cuelga de». Exige permiso de edición en Clientes | `convertirEnAliadoAction` y `moduleEditDenial(supabase, "clients")` en `app/studio/(app)/clientes/actions.ts`; SDD-0258 §6 | C, D |
| La tarifa vive solo en el raíz y el subaliado la hereda | SDD-0269; migr 0382 (`resolve_price_book`) | D, C |
| **En producción, un lote no crea clientes.** El generador no acepta `--crear-clientes-faltantes`; `previa.sql` termina con un corte `do $corte$` que aborta si una marca no resuelve a un cliente vivo, y `aplicar.sql` también aborta. Lo prueba `scripts/__tests__/consolidados-previa-corte.test.ts` («sin cliente corta», «cliente borrado corta», «cliente vivo pasa») | SDD-0543 §«Un lote de producción no crea clientes ni aliados»; `scripts/consolidados/lote-sql.ts` | D, C |
| Una marca desconocida solo entra si Sam la mapea a mano en `marcas-mapa.json` (por ejemplo, a una ficha comodín); si no, la previa se corta | SDD-0543; `scripts/consolidados/modelo.ts` (`normalizarMapa`) | D, C |
| En producción `lote_clientes.nombre_excel` va vacío: el lote no lleva nombres al servidor | SDD-0543 §«Seguimiento… Regla del DG, del 64 en adelante» | D |
| Antes de cargar, las marcas y remitentes con texto de un nombre se normalizan o se mapean, para que no lleguen a `shipments.code` ni al log append-only | SDD-0543 §«Datos personales», «Condición previa a producción» | D |
| Cada paso de producción exige `AUTORIZACION.txt` con el OK literal de Sam y el id completo del lote | SDD-0543 | D |
| Antecedente MG: `MG-019`/`MG-020` parecían un aliado y eran **proveedores** de un cliente | SDD-0543 (consulta del 2026-11-13) | D |
| El código del embarque es el «Remitente» del Excel (`shipments.code`) | SDD-0543, tabla de `invoices` | D |
| Que el embarque que quedó en la ficha comodín conserve el código original del Excel con el prefijo del subaliado | — | **NV** |
| «Pasar a otro cliente» mueve embarque, recepciones, borradores de factura e items del contenedor, con bloqueos y vista previa | SDD-0645; RPC `reassign_shipment_client` (migr 0551, aplicada en producción según el DG); `lib/studio/reasignar-embarque.ts` | D, C |
| La franja «Cliente» de la ficha del embarque ofrece «Asignar cliente» con el comodín `DTD-0000` | SDD-0662; `ClienteDelEmbarque.tsx`, `ReassignClientPanel.tsx` | D, C |
| Las facturas de lote y las de «Facturar» se emiten al aliado raíz, con una línea por embarque y `shipmentCode` | SDD-0543; SDD-0674 §8.3 (PR abierta) | D |
| El estado de cuenta es un libro de cargos y abonos, una sola función para portal, Studio y PDF | `lib/portal/statement-ledger.ts` (`buildStatementLedger`); SDD-0177, 0281, 0287 | C, D |
| La pantalla del Studio descarta las líneas de factura al mapear (`filasParaLedger`) | `app/studio/(app)/clientes/[markbox]/estado-de-cuenta/page.tsx` | C |
| La marca white-label toma el aliado **directo** del cliente | SDD-0336; `get_portal_brand()` (migr 0401, filtro en 0451); `lib/studio/aliados/brand-resolve.ts` (`resolveBrandForClient`) | D, C |
| La línea «Exceso de peso» no lleva `shipmentCode` | SDD-0543 (la línea se agrega aparte) | **NV** |
| Cuántos subaliados hay en producción | — | NV |

## 3. Propuesta

### 3.1 Qué es un trabajo

Un **trabajo** es un subaliado visto desde la cuenta de su aliado raíz. No es una entidad nueva: sale de la jerarquía que ya existe.

Cada línea de una factura del aliado pertenece a un trabajo así: la línea nombra un embarque (`shipmentCode`) → el embarque es de un cliente → el cliente cuelga de un aliado → si ese aliado es un subaliado, ese es el trabajo. Con más de un nivel, el trabajo es el subaliado directo del raíz.

Van en «General»:

- los embarques de clientes directos del aliado;
- las líneas sin `shipmentCode` (por ejemplo «Exceso de peso»), como «Sin embarque»;
- una línea cuyo embarque ya pertenece a un cliente de **otra** cuenta (porque se movió después de facturar), como «Embarque movido a otra cuenta», sin nombre ni código del otro cliente.

### 3.2 Sección «Aliados» en Clientes (F1)

Subpantalla `/studio/clientes/aliados`, enlazada desde la cabecera de Clientes junto a las otras tres.

| Elemento | Qué hace |
|---|---|
| Lista de aliados raíz | Nombre, prefijo, estado, cuántos subaliados y cuántos clientes |
| Subaliados anidados | Debajo de cada aliado, con su prefijo y su conteo de clientes |
| Accesos por fila | Ficha, estado de cuenta por trabajo, sus clientes |
| «Agregar subaliado» | El alta que hoy está en la ficha, con el aliado padre ya elegido |
| «Códigos por asignar» | Los embarques que están en la ficha comodín, con su código, contenedor, m³ y cajas. Cada fila enlaza a la ficha del embarque (SDD-0662), donde se asigna |

Hereda `requireModuleView("clients")` del layout. Reutiliza `listAliadoOptions`, `prefixChain`, `parentOptions` y el alta de `AliadoCard.tsx`. Sin `puedeVerNombres` (SDD-0531) muestra solo códigos. Sin migración.

### 3.3 Asignar un código nuevo a un aliado (F2)

**Dónde:** en la franja «Cliente» de la ficha del embarque (SDD-0662). El modal de «Asignar cliente» gana una segunda opción: **«Asignar a un aliado»**. No se duplica el modal ni se amplía la SDD-0662.

**Qué hace**, en una sola transacción (RPC nueva):

1. Parte el código del embarque (`MD-0012`, `AA-0007`, `MD`).
2. Si el prefijo es el del aliado elegido → usa o crea el cliente `AA-NNNN`.
3. Si no → usa o crea el **subaliado** con ese prefijo bajo el aliado: ficha ancla con la insignia pelada, **sin correo** (SDD-0258 §6.1), y fila en `aliados` con `parent_aliado_id`. Su nombre es el prefijo hasta que alguien lo edite.
4. Usa o crea el cliente `AA-MD-NNNN` con `aliado_id` = el subaliado. El número se compara por valor: `MD-012` y `MD-0012` son el mismo cliente. Si la fila trae solo las letras, el embarque va a la ficha ancla del subaliado.
5. Mueve el embarque con la misma lógica y los mismos bloqueos de `reassign_shipment_client`.

**Reglas:**

- **Permiso:** la acción especial `reassign_shipment_owner` **y** permiso de edición en Clientes (`moduleEditDenial(supabase, "clients")`), igual que `convertirEnAliadoAction`. La RPC repite las dos comprobaciones en la base. Sin `puedeVerNombres` no se monta.
- Motivo obligatorio y log de auditoría, como SDD-0645.
- Si el prefijo ya pertenece a **otro** aliado, o choca con otra ficha (0372), no asigna. El Studio dice a qué aliado pertenece (es personal de DTD; el portal del aliado usa un mensaje neutro, SDD-0666).
- **Vista previa** antes de confirmar: «Se crea el subaliado MD dentro de AA y el cliente AA-MD-0012».
- Como el código de la ficha comodín puede no conservar el prefijo (§2, NV), si el código del embarque no se puede partir, el modal pide escribir el código a mano.
- Lleva migración (la RPC). Depende de la 0551, ya aplicada.

### 3.4 Los siguientes códigos de un subaliado entran solos (excepción a la SDD-0543)

**Alcance exacto (el de Sam):** solo los códigos de un **subaliado ya conocido**, es decir, un prefijo que ya existe como subaliado vivo (con `parent_aliado_id`) porque alguien lo asignó antes por la vía del §3.3. No aplica a aliados raíz ni a prefijos que no estén registrados como subaliados.

**Qué cambia en el generador de lotes**, en este orden:

1. **Primero se busca el cliente que ya existe.** El cliente de un subaliado se guarda con la cadena completa (`AA-MD-0012`) y `resolve_markbox` compara el código exacto (migr 0367), así que los candidatos de hoy (`MD-0012` y sus rellenos, `scripts/consolidados/modelo.ts`, `interpretarMarca`) nunca lo encuentran. Si el prefijo es de un subaliado conocido, el generador busca además `<cadena del subaliado>-<número>`, comparando el número **por valor** (`MD-012`, `MD-0012` y `MD-12` son el mismo cliente), igual que el §3.3 paso 4. Si existe, la marca **resuelve a ese cliente y no es alta**. Cada candidato por valor pasa por `resolve_markbox` y por el mismo corte de cliente vivo de hoy:
   - un cliente **fusionado** se sigue hasta el vivo, como ya hace `resolve_markbox`;
   - un cliente **borrado** (`deleted_at`) no resuelve y **tampoco califica como alta**: su código sigue ocupando `unique (tenant_id, markbox)`, así que la previa se corta, igual que el caso actual «cliente borrado corta»;
   - si hay **dos** clientes con el mismo número y distinto relleno (`AA-MD-012` y `AA-MD-0012`), la previa se corta: no se elige uno por suposición.
2. **Solo si no existe**, y la forma es exactamente `<prefijo de subaliado>-<dígitos>`, la marca es «alta de cliente de subaliado»: la previa y `aplicar.sql` no abortan por ella y `aplicar.sql` crea el cliente con la cadena completa.
3. La insignia pelada del subaliado (`MD`) resuelve a su ficha ancla, que ya existe; nunca es alta.
4. Cualquier otra marca desconocida sigue cortando la previa, como hoy.

Así, la segunda carga del mismo código resuelve al cliente creado en la primera: no choca con `unique (tenant_id, markbox)` (migr 0006), no duplica y no descuadra el número de altas de `AUTORIZACION.txt`.

**Salvaguardas:**

1. **Nombre del cliente creado.** En producción el lote no lleva nombres (`nombre_excel` vacío), así que el cliente nace con un nombre de marcador: «Cliente AA-MD-0013». No hay teléfono ni otros datos. La oficina o el aliado (SDD-0666) lo completan después.
2. **Normalización.** Solo califica una marca que cumple la forma estricta del código. Una marca o remitente con texto de nombre no califica: va al mapa de marcas de Sam, como exige la SDD-0543, y no llega a `shipments.code` ni al log.
3. **Autorización.** La previa lista las altas que va a hacer (cuántas y qué códigos, sin nombres). `AUTORIZACION.txt` tiene que citar, además del id del lote, el número de altas de subaliado; si no coincide con la previa, `aplicar` se niega.
4. **Antecedente MG.** Un código con forma `XX-NNN` puede ser el proveedor de un cliente y no un subaliado. Por eso solo califican prefijos que alguien ya asignó a mano como subaliado; un prefijo nuevo nunca se crea en un lote.
5. **Pruebas.** `consolidados-previa-corte.test.ts` gana tres casos: «código nuevo de subaliado conocido pasa como alta», «código de cliente de subaliado que ya existe resuelve, sin alta» (también con otro relleno del número) y «código de un prefijo que no es subaliado corta». Los tres casos actuales se conservan.

**Registro formal (índice de gobernanza §5 y §7, protocolo L3):**

| Campo | Valor |
|---|---|
| Regla afectada | SDD-0543 §«Un lote de producción no crea clientes ni aliados»: el corte `do $corte$` de `previa.sql`, el aborto de `aplicar.sql` y el caso «sin cliente corta» de `consolidados-previa-corte.test.ts` |
| Qué se aparta | Un lote de producción crea clientes de un subaliado ya conocido |
| Motivo | Sam carga contenedores con códigos de subaliados a diario; asignar a mano cada cliente nuevo de un subaliado ya conocido frena la carga sin agregar control |
| Alcance | Solo prefijos de subaliados vivos ya asignados, solo con la forma estricta del código, solo crea clientes (nunca aliados ni subaliados) |
| Responsable y aprobador | Sam (decisión del 2026-11-18, en la sesión de planeación: «Entran solos») |
| Revisión | 2027-02-18, o antes si una alta automática termina en un cliente equivocado |
| Cómo se retira | Quitar la rama del generador; la previa vuelve a cortar |

**Riesgo aceptado.** Una marca mal escrita en China con el prefijo de un subaliado (por ejemplo, un dígito equivocado) crea un cliente que no existe, en vez de cortar la carga. El embarque queda bajo el subaliado correcto pero con un cliente de más. Sam lo acepta porque el embarque sigue en la cuenta del aliado que corresponde, la previa lista cada alta antes de aplicar y la oficina lo corrige con «Pasar a otro cliente» (SDD-0645). El cliente de más queda con nombre de marcador y sin datos personales.

**Revisión de impacto (L2 dentro de L3):**

| Área | Impacto | Mitigación |
|---|---|---|
| Legal y privacidad | El cliente nace sin datos personales: solo código y nombre de marcador. La normalización de la SDD-0543 sigue impidiendo que un nombre llegue a `shipments.code` o al log append-only | Forma estricta del código (salvaguarda 2) |
| Contable | El cliente nuevo no factura: las facturas de lote van al aliado raíz (SDD-0543, SDD-0674). Un cliente de más no cambia el monto ni el saldo del aliado; solo puede cambiar en qué trabajo cae una línea | El embarque queda en el subaliado correcto; reasignación con SDD-0645 |
| Permisos | El lote corre con el permiso del cargador y con `AUTORIZACION.txt` de Sam. No crea aliados ni subaliados, que siguen exigiendo `reassign_shipment_owner` y edición en Clientes (§3.3) | Número de altas en `AUTORIZACION.txt` |
| Auditoría | Cada alta queda en el log de auditoría del lote con el id del lote, igual que el resto de la carga | La previa y la evidencia del lote listan las altas |
| Móvil | La PWA de recepción (`/m/cn`, `/m/ve`) ve el cliente nuevo como cualquier otro; no muestra nombres al equipo de China (SDD-0531) | Sin cambio |
| Accesibilidad | Sin interfaz nueva: es un cambio del generador de lotes | No aplica |

**Cómo queda escrita en la SDD-0543** (se agrega en la PR de F2, sin reescribir el texto original): debajo del párrafo «Un lote de producción no crea clientes ni aliados», una nota:

> **Excepción EXC-0663 (Sam, 2026-11-18; revisión 2027-02-18).** Un lote de producción sí crea el cliente de un **subaliado ya conocido** cuando la marca tiene la forma estricta `<prefijo>-<dígitos>` o es la insignia del subaliado. La previa lista esas altas y `AUTORIZACION.txt` cita su número. Cualquier otra marca desconocida sigue cortando la previa. Detalle en la SDD-0663 §3.4 y en `docs/governance/reviews/excepcion-0663-lote-crea-cliente-subaliado-2026-11-18.md`.

En la PR de F2 se crean el documento de la excepción, `docs/governance/reviews/excepcion-0663-lote-crea-cliente-subaliado-2026-11-18.md`, y su entrada en la línea base. La regla exceptuada es de la SDD-0543, que no tiene fila en el registro maestro (§4), así que, según el §9 del índice de gobernanza, F2 crea una **línea base nueva**, `docs/governance/BASELINE-<fecha de la PR de F2>.md`, que supersede a la vigente, registra EXC-0663 con dueño, fecha de revisión y alcance, y enlaza el documento de reviews. No se toca `docs/governance/README.md` §4 (el §10 prohíbe editar el índice a mano).

### 3.5 La marca de un subaliado es la de su aliado raíz (cambio a la SDD-0336)

**Política que cambia:** SDD-0336 y `get_portal_brand()` (migr 0401, con el filtro de 0451), además de `resolveBrandForClient` en `lib/studio/aliados/brand-resolve.ts`. Hoy la marca sale del aliado **directo** del cliente; pasa a salir del **aliado raíz** de la cadena.

| Campo | Valor |
|---|---|
| Responsable y aprobador | Sam (2026-11-18: «Usa las del aliado principal») |
| Fecha de la decisión | 2026-11-18 |
| Fases | 0663 F3: el PDF por trabajo usa la marca del raíz (`resolveBrandForClient` sube por la cadena). 0666 P5: `get_portal_brand()` sube al raíz en el portal |
| Riesgo | Un subaliado que hoy tenga marca propia configurada la pierde. Antes de F3 se cuenta cuántos subaliados tienen marca propia (conteo agregado, con OK de Sam) |

### 3.6 Estado de cuenta por trabajo (F3)

Formato tipo QuickBooks:

| Bloque | Qué muestra |
|---|---|
| Resumen del aliado | Facturado, pagado y saldo con DTD, como hoy |
| General | Embarques de sus clientes directos y las líneas del §3.1, con «Total de General» |
| Un bloque por trabajo | Nombre y prefijo del subaliado; sus embarques con código completo, contenedor, m³ y monto; «Total del trabajo» |
| Total del aliado | La suma de todos los bloques |
| Abonos y saldo | Los pagos y el saldo, una sola vez, a nivel del aliado |

Reglas:

- Una función pura nueva, junto a `buildStatementLedger`, agrupa las líneas por trabajo. `buildStatementLedger` no cambia.
- `filasParaLedger` deja de descartar las líneas.
- PDF completo o de **un solo trabajo**. El de un trabajo lleva solo los cargos de ese trabajo, con la marca del aliado raíz (§3.5), sin pagos, sin saldo y sin marca de DTD.
- Un aliado sin subaliados y un cliente directo ven su estado de cuenta igual que hoy.
- Sin migración.

## 4. Fases, aceptación y allowlist

F1 y F2 van juntas y primero (prioridad de Sam). Las pantallas pasan por `/ui-check`. Cada fase tiene su allowlist exacta; si la implementación necesita otro archivo, se amplía la spec antes de tocarlo.

### F1 · Sección «Aliados»

Aceptación:

- [ ] `/studio/clientes/aliados` lista los aliados raíz con sus subaliados anidados y los conteos.
- [ ] Un rol sin vista del módulo Clientes recibe el mismo bloqueo que el resto de Clientes.
- [ ] Sin `puedeVerNombres` la pantalla solo muestra códigos.
- [ ] «Códigos por asignar» lista los embarques de la ficha comodín y cada fila abre su ficha.
- [ ] Prueba de componente para la lista anidada y para el estado vacío.

Allowlist:

- `app/studio/(app)/clientes/aliados/page.tsx` (nuevo)
- `app/studio/(app)/clientes/_components/AliadosClient.tsx` (nuevo) y su prueba
- `app/studio/(app)/clientes/_components/ClientsClient.tsx` (solo el enlace de la cabecera)
- `lib/studio/aliados/aliado-queries.ts` (lectura de conteos y de códigos por asignar) y su prueba
- `.agents/handoffs/0663-subaliados-como-jobs.md`

### F2 · Asignar a un aliado y entrada automática

Aceptación:

- [ ] Asignar `MD-0012` a AA crea el subaliado MD, el cliente `AA-MD-0012` y mueve el embarque, en una transacción.
- [ ] Asignar `AA-0007` a AA crea o usa `AA-0007` sin crear subaliado.
- [ ] Asignar solo `MD` lleva el embarque a la ficha ancla del subaliado.
- [ ] Un prefijo de otro aliado, o que choca con otra ficha, no asigna y no deja nada escrito.
- [ ] Sin `reassign_shipment_owner` o sin edición en Clientes, la RPC rechaza (pruebas negativas por rol).
- [ ] La ficha ancla nace sin correo.
- [ ] En el generador, un código nuevo de subaliado conocido pasa como alta y un prefijo que no es subaliado sigue cortando.
- [ ] Un código de cliente de subaliado que ya existe resuelve, sin alta, también con otro relleno del número; cargar dos veces el mismo código no choca ni duplica.
- [ ] `AUTORIZACION.txt` sin el número de altas hace negar `aplicar`.
- [ ] Contrato SQL de la RPC con mutantes en rojo.
- [ ] Nota EXC-0663 en la SDD-0543 y documento de la excepción en `docs/governance/reviews/`.

Allowlist:

- `supabase/migrations/NNNN_asignar_a_aliado.sql` (número del DG) y `supabase/tests/NNNN_asignar_a_aliado.test.sql`
- `app/studio/(app)/tracking/[id]/_components/ReassignClientPanel.tsx` y su prueba
- `app/studio/(app)/tracking/[id]/_components/ClienteDelEmbarque.tsx` (solo el texto del botón si cambia)
- `app/studio/(app)/tracking/[id]/actions.ts` (acciones de vista previa y asignar a aliado)
- `lib/studio/reasignar-embarque.ts` y su prueba
- `scripts/consolidados/lote-sql.ts`, `scripts/consolidados/modelo.ts`, `scripts/consolidados/generar-lote.ts` y `scripts/__tests__/consolidados-previa-corte.test.ts`
- `infra/ops/consolidados/aplicar-lote.sh` (comprobación del número de altas en `AUTORIZACION.txt`) e `infra/ops/tests/prueba-aplicar-lote.sh`
- `docs/specs/0543-consolidados-en-camino/spec.md` (solo la nota EXC-0663)
- `docs/governance/reviews/excepcion-0663-lote-crea-cliente-subaliado-2026-11-18.md` (nuevo)
- `docs/governance/BASELINE-<fecha de la PR de F2>.md` (nuevo; registra EXC-0663)
- `supabase/migrations-baseline.json` (solo la espera de la migración)
- `.agents/handoffs/0663-subaliados-como-jobs.md`

### F3 · Estado de cuenta por trabajo

Aceptación:

- [ ] Invariante: la suma de «General» y de todos los trabajos es igual al total de cargos del libro. Probado con facturas de lote (SDD-0543) y con facturas de «Facturar» (SDD-0674).
- [ ] «Exceso de peso» sin `shipmentCode` cae en «General» como «Sin embarque».
- [ ] Una línea cuyo embarque es de otra cuenta cae en «General» sin nombre ni código ajeno.
- [ ] El PDF de un trabajo no trae pagos, saldo ni marca de DTD, y lleva la marca del aliado raíz.
- [ ] Un cliente directo y un aliado sin subaliados ven lo mismo que hoy (prueba de no regresión).

Allowlist:

- `lib/portal/statement-jobs.ts` (nuevo, función pura) y su prueba
- `app/studio/(app)/clientes/[markbox]/estado-de-cuenta/page.tsx` y `pdf/route.ts`
- `lib/studio/pdf/estado-de-cuenta-pdf.tsx`
- `lib/studio/aliados/brand-resolve.ts` (marca del raíz) y su prueba
- `docs/specs/0336-marca-portal-por-principal/spec.md` (solo la nota de cambio: la marca del Studio sube al aliado raíz, SDD-0663 §3.5)
- `.agents/handoffs/0663-subaliados-como-jobs.md`

## 5. Datos personales

Esta spec no agrega datos personales nuevos. El cliente que crea F2 o la entrada automática nace solo con el código y un nombre de marcador. El registro de clientes del aliado con nombre y teléfono está en la SDD-0666 §6, y depende de la **cláusula de tratamiento de datos para aliados** (SDD-0255 §8.5), que hoy no existe.

## 6. Avisos heredados por verificar antes de programar

De la SDD-0258 §7; pueden seguir vivos:

- `/verificar` no reconocía la forma impresa (`MD-1232`) tecleada a mano. La SDD-0664 trabaja la búsqueda por código viejo; conviene comprobar si cubre este caso.
- El código de referido se arma mal para códigos de aliado.

## 7. Fuera de alcance

- Cobrarle al subaliado o darle tarifa propia.
- El portal del aliado y la marca blanca (SDD-0666).
- Mover facturas ya emitidas.
- Integración con QuickBooks.
- Consultas o cambios en producción: esta spec se escribió leyendo el repo.

## 8. Aceptación de esta spec

- [ ] Sam aprueba la spec, incluidas la excepción EXC-0663 (§3.4) y el cambio de marca (§3.5).
- [ ] El Director General asigna las fases y el número de migración de F2.
