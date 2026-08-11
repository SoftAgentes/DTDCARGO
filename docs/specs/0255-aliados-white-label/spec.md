---
sdd: "0255"
title: "Aliados white-label: entidad, insignia propia jerárquica y tarifa especial"
status: in-progress
author: "Sam (founder) + Claude"
created: 2026-08-11
updated: 2026-08-11
supersedes: null
superseded_by: null
related: ["0042", "0051", "0059", "0069", "0090", "0116", "0128", "0159", "0193", "0240", "0246"]
confidencialidad: interno
---

# SDD-0255 — Aliados white-label

## 1. El problema

DTD Cargo mueve carga puerta a puerta China↔Venezuela. Además de sus clientes
directos tiene **aliados**: otras empresas de puerta a puerta que revenden el
servicio bajo su marca y atienden ellas a sus propios clientes. DTD le trae la
carga al aliado, no al cliente final.

El negocio está definido desde julio de 2026
([`docs/marketing/adquisicion.md`](../../marketing/adquisicion.md) §2c ·
[`docs/marketing/oferta-borradores.md`](../../marketing/oferta-borradores.md) §4):
el aliado es un cliente con **tarifa fija especial**, revende al precio que
quiera, y DTD no toca a sus clientes. El programa público se llama **"Aliados
DTD"** y es norte interno junto con los mayoristas recurrentes.

**En código no existía nada.** `clients` tiene 39 columnas y ninguna de aliado;
`rates` no tiene dimensión de cliente; el portal es 1 usuario : 1 cliente. El
pendiente llevaba meses escrito como *"❌ SDD futuro, gate = definir el
billing"*, y dos specs se lo pasaban entre sí sin que ninguna lo tomara
(SDD-0059 §154 lo difiere a "un SDD comercial separado" que nunca se creó;
SDD-0069 §174 lo devuelve a SDD-0059).

## 2. Lo que se midió antes de diseñar

Contra producción, el 2026-08-11. 444 clientes, 1 solo tenant.

| Familia de Shipping Mark | Clientes | Con portal | Con envíos | Alta |
|---|---|---|---|---|
| `DTD-<letra>NNN` — códigos de **vendedor** | 361 | 14 | 0 | todos el 12-jun-2026 |
| `DTD-NNNN` — clientes directos | 73 | 68 | 7 | 24-may → hoy |
| Otros (`ITS-01..04`, `AD-001`, `AD002`, `bncvcc`, `DTD-LEG-SN01/02`, `DTD-A102-`) | 10 | 1 | 0 | 12-jun-2026 |

Cinco hallazgos cambian el planteamiento de julio:

1. **Los 361 `DTD-<letra>NNN` no son aliados.** Eran códigos de **vendedor**
   (A=Darilis, J=José, D=Darín, Y=Yeglenis, P=Pedro), internos o externos, de una
   época sin gobernanza de códigos. El concepto ya no existe. Quedan como
   clientes directos; nada se migra.
2. **HR (Herneka) y DC (Dynasty Cargo) no existen todavía.** Cero filas. Se
   arranca limpio, sin migración de datos.
3. **Renumerar un cliente existente es imposible.** 33 columnas guardan el
   markbox como texto y no hay una sola FK por markbox; la migr 0341 §11 ya
   documenta que un `update clients set markbox` deja todo apuntando a un texto
   inexistente, sin error y sin vuelta.
4. **El portal es 1:1 duro** — `unique(auth_user_id)` en `client_users` y 36
   políticas RLS con igualdad escalar, de las cuales 12 son de escritura.
5. **`rates` no tiene `client_id`** — no hay dónde guardar una tarifa de aliado.

Y una restricción que ningún documento recogía: hay un **caso legal vivo** donde
la nota de entrega de un cliente de aliado salió con membrete DoorTuDoor, y el
propio expediente concluye que eso debilita la defensa de "aliado independiente".
El white-label visual no es cosmética: es mitigación de riesgo.

## 3. El modelo

### 3.1 La insignia es jerárquica

Un aliado puede tener sub-aliados. Dynasty Cargo (DC) le revende a otro puerta a
puerta (FA) que ella captó, y el cliente de FA queda:

```
DC-FA-1232
│  │   └── correlativo del cliente
│  └────── FA = sub-aliado de Dynasty Cargo
└───────── DC = Dynasty Cargo, el aliado raíz — el que factura con DTD
```

### 3.2 El mismo código tiene dos formas

| Forma | Quién la ve | Ejemplo |
|---|---|---|
| **Guardada / en pantalla** | El equipo de DTD, en el Studio | `DC-FA-1232` |
| **Impresa / en documentos** | El cliente final | `FA-1232` |

Se imprime **el prefijo del aliado más profundo + el correlativo**. Para un
cliente directo de un aliado raíz las dos formas coinciden (`HR-0001`).

**Consecuencia de diseño:** como la forma impresa omite la raíz, el prefijo tiene
que ser **único global por tenant**. Si `FA` existiera bajo DC y bajo HR,
`FA-1232` sería ambiguo en el papel. De ahí el índice
`aliados_prefix_uq (tenant_id, upper(prefix))`.

### 3.3 La tarifa se pacta con el aliado raíz

Dynasty Cargo tiene su tarifa con DTD. FA no factura con nosotros — a FA le
factura Alexandra. Los sub-aliados heredan y no tienen relación comercial propia
con DTD. Un aliado puede tener varias tarifas: precio por CBM propio, descuento
sobre la tarifa vigente, por servicio, y con vigencia desde–hasta.

### 3.4 El founder marca a mano

No hay detección automática. El admin entra a la ficha de un cliente y lo
convierte en aliado; ahí se capturan la descripción del acuerdo y la tarifa.

## 4. Decisiones

| Decisión | Elección | Por qué |
|---|---|---|
| Dónde vive "aliado" | Tabla `public.aliados` + columna `clients.aliado_id` | ~14 atributos que sólo le sirven al aliado serían 14 NULL en 444 filas. Precedente medido: `clients.advisor_id` lleva meses con UI completa y 100% NULL |
| Jerarquía | `aliados.parent_aliado_id` nullable. NULL = raíz | Es el caso Dynasty Cargo → FA |
| Unicidad del prefijo | Global por tenant | La forma impresa omite la raíz |
| Pertenencia | `clients.aliado_id` apunta al aliado **más profundo** | Un cliente tiene un dueño o ninguno. Una N:M permitiría dos dueños y rompería a la vez RLS y facturación |
| Cómo se emite `HR-0001` | Función **nueva** `next_markbox_aliado`. `next_markbox`, `next_markbox_service` y `ensure_client_markbox` quedan byte-idénticas | `'HR-0001' ~ '^DTD-\d+$'` es false: los namespaces ya son disjuntos. En esas funciones `DTD` aparece **dos veces y hace cosas distintas** (en el regex decide qué filas cuentan, en el `return` qué se emite), así que parametrizarlas es justo el cambio que rompe el correlativo |
| Candado de fusión | **Trigger** sobre `clients`, no guard dentro de `merge_clients` | La función se reescribe seguido y ya se perdió un candado así (la migr 0345 se escribió con el cuerpo viejo y habría borrado en silencio el candado de rol de la 0358). Un trigger es un invariante de datos: sobrevive a la próxima reescritura |
| Nombre | `aliados` en SQL, "Aliados" en UI. Nunca `partner` | `partner_*` está tomado por el Socio Logístico China (SDD-0059, 15 archivos); su categoría de gasto `pago_aliado` significa "pago al socio chino". Y ya conviven **tres** "white-label" distintos en el repo |

## 5. Alcance de esta primera entrega (migr 0362)

Entra:

- Tabla `aliados` con jerarquía, marca white-label y modelo de cobro.
- `clients.aliado_id` con índice parcial.
- `aliado_prefix_chain()` — compone la cadena desde la raíz.
- `next_markbox_aliado()` — correlativo por cadena exacta, sin acceso para `anon`
  ni `service_role`.
- Guardas: anti-ciclo, prefijos reservados (`DTD`, `ITS`, `AD`, `LEG`),
  coherencia markbox↔aliado, y el candado de fusión.
- Parche a `client_duplicate_candidates` para que **no vea** a los clientes de
  aliado.
- [`lib/shared/markbox-chain.ts`](../../../lib/shared/markbox-chain.ts) — las dos
  formas del código, en el único lugar que la frontera público↔ERP permite
  compartir.

No entra todavía: UI del Studio, portal del aliado, tarifas, white-label
documental y liquidación. Van en entregas propias.

## 6. Por qué el parche al detector viaja en la misma migración

`client_duplicate_candidates` (migr 0341, ampliada por la 0349) marca
`es_legado` a todo lo que no matchea `^DTD-\d+$`. `HR-0001` cae ahí, y **desde la
0349 el detector compara legado↔legado**: cada cliente de aliado saldría
propuesto para fusión contra los 361. `merge_clients` es irreversible.

El parche referencia `c.aliado_id`, así que si viajara en otro archivo y se
aplicara primero dejaría el detector roto para el legado, que es el caso que hoy
sí se usa. Va junto, y **antes del primer `HR-`**.

Verificado contra prod el 2026-08-11: el cuerpo vivo es el de la 0349
(orientación idéntica) y no hay ninguna migración de número mayor que lo
redefina.

## 7. Verificación

Contrato SQL: [`supabase/tests/0362_aliados_base.test.sql`](../../../supabase/tests/0362_aliados_base.test.sql),
11 escenarios, `rollback` total. Unit: 21 casos sobre `markbox-chain.ts`.

**Validado con mutación** el 2026-08-11 — se rompió cada protección a propósito y
se confirmó que el contrato se pone **rojo**. Las nueve:

| Mutación | Resultado |
|---|---|
| detector sin `and c.aliado_id is null` | rojo ✓ |
| `execute` de `next_markbox_aliado` devuelto a `service_role` | rojo ✓ |
| sin el trigger anti-fusión | rojo ✓ |
| sin el trigger anti-ciclo | rojo ✓ |
| sin el guard de coherencia markbox↔aliado | rojo ✓ |
| índice de prefijo vuelto no-único | rojo ✓ |
| sin la lista de prefijos reservados | rojo ✓ |
| regex laxo en `next_markbox_aliado` | rojo ✓ |
| regex laxo en `next_markbox` | rojo ✓ |

⚠️ **Dos lecciones de esa ronda, anotadas porque volverían a morder:**

1. La primera tanda de mutaciones **renombraba** los triggers. Un trigger
   renombrado sigue ejecutando su función: no era una mutación, y los tres
   contratos "sobrevivieron" sin medir nada. Las mutaciones se aplican como SQL
   que **desactiva** la protección, no como edición de texto.
2. La prueba de "el correlativo DTD no se mueve" **no discriminaba**: con
   `HR-0001` y `DTD-9058`, hasta un `next_markbox` que contara cualquier cadena
   daría igual `DTD-9059`. Se agregó `HR-9900` al fixture — un número de aliado
   **mayor** que el mayor DTD — y recién ahí la mutación pone el test en rojo.

## 8. Lo que falta decidir

1. **El modelo de cobro** (bloquea la liquidación, no lo demás). El default en el
   schema es `tarifa_fija`, que es lo que el founder decidió en julio; con eso la
   factura al aliado **es** la liquidación y no hay comisión que calcular.
2. **El $/CBM de HR y DC**, por servicio y destino.
3. **Cuántos logins puede tener un aliado.** Hoy `unique(auth_user_id)` y
   `unique(tenant_id, client_id)` en `client_users` significan **un solo acceso
   por aliado**; una empresa con 3 empleados no entra en ese modelo.
4. **Si el aliado puede escribir en el portal.** El diseño lo deja en solo
   lectura a propósito: las 12 políticas de escritura del portal le darían
   permiso de reportar pagos y cambiar direcciones de entrega de sus clientes.
5. **La cláusula de tratamiento de datos para aliados.** No existe
   (`docs/legal/privacidad/AUDITORIA-2026-07.md:459-460`) y el acuerdo de
   servicios v3 no menciona aliados. Es requisito antes de darle al aliado
   visibilidad sobre datos personales de terceros.
