---
sdd: "0689"
title: "Embarques: peso y «Total sin facturar» en el encabezado, y clic en el cliente"
status: in-progress
author: "Claude (Worker) + Sam"
created: 2026-11-20
updated: 2026-11-20
supersedes: null
superseded_by: null
related: ["0643", "0661", "0665", "0674", "0682", "0690"]
confidencialidad: interno
---

# SDD-0689 — Embarques: peso y «Total sin facturar» en el encabezado, y clic en el cliente

> **Aprobada por Sam el 2026-11-20:** «Apruebo la 0689» (en el chat del DG, ante la pregunta «¿Apruebas
> la spec 0689 del encabezado de Embarques?»).

## 1. Pedido

Sam lo pidió el 2026-11-20, mirando el contenedor 64 en Embarques:

- La primera vista del contenedor, la que se ve al entrar, tiene que dar los datos importantes. Junto a
  clientes, envíos, cajas y m³ van el **peso total** y, a la derecha y en el mismo color, el **«Total sin
  facturar»**.
- Privacidad del monto, porque la pantalla queda abierta en la PC de la oficina: «en el valor total del
  dinero aparezca un ojo con un signo, para que lo opriman y les muestre el valor unos 4 segundos y se
  regrese al ojo otra vez. Ya cuando quieran verlo completo tienen que oprimir para entrar a la ficha
  adentro», como lo hace QuickBooks. Sam vio la maqueta del encabezado en el chat el mismo día.
- En el detalle por cliente, «si yo oprimo sobre un cliente, me tiene que abrir su ficha de embarques de
  inmediato», para poder editar el embarque o los embarques.

El DG separó el pedido en dos specs:

- **SDD-0689 (esta):** presentación y navegación. No lleva migración.
- **SDD-0690:** «Facturar» emite el borrador, «Facturar todo», los precios del Excel en «Por cobrar» y el
  estado «Facturado». Ahí está la migración 0569.

## 2. Medición (código de `main` 2ea18799a)

- El encabezado (`ListaDeContenedores` en `EmbarquesClient.tsx`) muestra los clientes, los envíos, las
  cajas y los m³. El peso existe en el grupo desde la SDD-0665 (`GrupoContenedor.pesoKg`), pero solo se ve
  al abrir el contenedor, en la franja.
- El dinero sale de `leerMontosDeContenedores` (SDD-0661). La página lo lee solo para `accounting` y
  `admin` con la puerta de Facturación. Cuenta todas las facturas que no estén anuladas, borradores
  incluidos, y hoy no separa los borradores.
- El contenedor 64 se cargó con `--sin-facturas`, así que no tiene ningún borrador. Cargarlos es parte de
  la SDD-0690.
- En el detalle por cliente, el nombre es texto plano. Los embarques de cada cliente están más abajo, en un
  acordeón por cliente, y cada embarque abre su ficha (`ShipmentDetailDrawer`, con el enlace a Tracking
  para editar).

## 3. Decisión

### 3.1 Encabezado del contenedor

- **Peso total** como una insignia más, igual que las cajas: es la suma de `shipments.weight_kg`. Si
  ningún envío tiene peso, dice «Sin peso» (SDD-0665). Lo ven todos los roles que ven Embarques.
- **«Total sin facturar»** a la derecha del m³, con el mismo estilo. Es la suma en USD de los
  **borradores** del contenedor, lo que todavía no se emitió.
  - Solo lo ven quienes ya ven montos (`accounting` y `admin`, con la puerta de Facturación), igual que en
    la SDD-0661. Operaciones no ve valores (Sam, 2026-11-18: «El rol operaciones no factura y tampoco ve
    los valores.»).
  - **Oculto por defecto:** se ve «Sin facturar ••••••» con un botón de ojo. El ojo muestra el monto
    durante 4 segundos y lo vuelve a ocultar solo; oprimirlo otra vez lo oculta antes. El ojo va al lado
    del botón de la cabecera, no adentro: mirar el monto no abre ni cierra el contenedor.
  - **Accesibilidad:** el ojo es un botón que alterna (`aria-pressed`), con un `aria-label` fijo que dice
    qué hace y por cuántos segundos: «Mostrar u ocultar el total sin facturar de DDP 64 (se oculta solo a
    los 4 segundos)». El estado lo dice solo `aria-pressed`, para que no se anuncie dos veces. Funciona
    con Enter y Espacio. Al ocultarse solo, el foco se queda en el ojo, así que quien navega con teclado
    o lector de pantalla lo vuelve a mostrar con una tecla. El monto se anuncia con `aria-live="polite"`
    al mostrarse; los «••••••» van con `aria-hidden` y no se anuncian.
  - **Qué protege:** es privacidad frente a quien mira la pantalla, no protección de datos. El monto llega
    al navegador de quien ya tiene permiso para verlo (la página lo decide en el servidor) y se puede ver
    con el inspector. Para los demás roles el monto no viaja (§5, punto 4, con prueba del servidor).
  - Adentro, al abrir el contenedor, la franja y el detalle por cliente muestran los montos completos,
    como hoy (SDD-0661).
  - El ojo aparece solo si la suma en USD de los borradores es mayor que cero. Si no, no hay ojo y el
    encabezado dice, nunca «$0.00»:
    - **«Sin precios cargados»** si el contenedor no tiene facturas. Así queda el 64 hasta que la
      SDD-0690 cargue sus borradores;
    - **«Facturado»** si tiene facturas y ningún borrador: todo se emitió (decisión de Sam del
      2026-11-20 para la SDD-0690);
    - **«Sin monto en USD»** si sus borradores están en otra moneda, que no suma.
  - El sistema trabaja en dólares; el bolívar es solo una vista. Las facturas en otra moneda no suman.
- **Qué es del contenedor y qué es de la vista.**
  - **Del contenedor entero:** el peso y el «Total sin facturar». Suman todos sus envíos, no solo los que
    dejaron pasar la pestaña, el filtro de servicio o la búsqueda. Así no cambian al pasar de «Todos» a
    «Activos» o a «Entregados».
  - **De la vista:** clientes, envíos, cajas y m³, como hoy (SDD-0643 y SDD-0661). Cuentan lo que se ve
    abajo, al abrir el contenedor.
  - Para no confundirlos, el peso y el monto van con su propio rótulo: el peso como insignia de kg y el
    monto como «Sin facturar».
- **En qué vista se ve el encabezado de un contenedor zarpado, como el 64.** Hoy se ve en «Todos», la
  pestaña con la que abre Embarques, y en toda pestaña donde quede al menos uno de sus envíos. Con sus
  envíos `in_transit`, eso incluye «Activos». Cuando la SDD-0682 (PR #702) agregue la pestaña «En camino»
  y abra en «Activos», un contenedor zarpado con envíos `in_transit` se verá en **«En camino»**. En
  cualquier pestaña, el peso y el «Sin facturar» son los mismos.
- Se reemplaza la regla de la SDD-0661 «la cabecera cerrada no muestra dinero»: el «Total sin facturar»
  es el único dinero del encabezado.

### 3.2 Clic en el cliente

- En el detalle por cliente, el nombre del cliente es un botón.
  - **Si tiene un solo embarque**, abre directo su ficha: el mismo panel que abre la fila del embarque,
    con el enlace para editarlo.
  - **Si tiene varios**, abre su bloque de embarques, lo trae a la vista y le pasa el foco. Ahí cada
    embarque abre su ficha.
- No cambia ningún permiso: la ficha y la edición siguen con su RBAC.

## 4. Fuera de alcance

- **Pendiente de la SDD-0690:** «Sin facturar» tiene dos sentidos. En el encabezado son los borradores. En
  la franja y en el detalle por cliente (`textoMonto`) es lo que falta por cobrar. Esta spec no lo toca: la
  SDD-0690 redefine «Por cobrar» y lo resuelve ahí.
- Todo lo de la SDD-0690: cargar los borradores del 64 desde el Excel, «Facturar» que emite el borrador,
  «Facturar todo», el estado «Facturado» y el cambio de la RPC de la 0564.
- El historial de contenedores entregados al 100 % y la tarifa por cliente con la alerta de exceso: son
  pedidos nuevos de Sam y el DG les asigna su número.

## 5. Aceptación

1. El encabezado cerrado del contenedor muestra el peso total a todos los roles que ven Embarques.
2. Con montos, muestra «Sin facturar ••••••» y un ojo. El ojo muestra la suma en USD de los borradores
   durante 4 segundos y la vuelve a ocultar, sin abrir el contenedor. Sin facturas, muestra «Sin precios
   cargados».
3. El peso y el «Sin facturar» del encabezado son los mismos en todas las pestañas y con cualquier
   filtro de servicio o búsqueda: suman el contenedor entero. La prueba usa un envío en tránsito, otro
   entregado y uno de otro servicio. Con facturas y sin borradores dice «Facturado». Con borradores en
   otra moneda dice «Sin monto en USD».
4. Sin montos (`operations`, `commercial`, `warehouse`, `support`), el encabezado no muestra ningún dinero, y
   la página no le manda ningún monto al navegador (prueba del servidor en `page-monto-por-rol.test.ts`).
5. En el detalle, clic en un cliente con un embarque abre su ficha; con varios, abre su bloque.
6. Las pruebas de la SDD-0661 siguen pasando, salvo la que congelaba «sin dinero en la cabecera», que se
   ajusta a esta decisión.

## 6. Archivos (allowlist)

- `docs/specs/0689-embarques-encabezado-y-cliente/spec.md` y el índice `docs/specs/README.md`.
- `.agents/handoffs/sdd-0689-embarques-encabezado-y-cliente.md`.
- `lib/studio/embarques-contenedores.ts`: `MontoAcumulado` suma `borradores` y `sinFacturarUsd`, y
  `GrupoContenedor.completo` trae los envíos y el peso del contenedor entero.
- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx`.
- Pruebas:
  - `lib/studio/__tests__/embarques-cajas-y-monto.test.ts`;
  - `app/studio/(app)/embarques/__tests__/page-monto-por-rol.test.ts`;
  - `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.cajas-monto.test.tsx`;
  - `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.contenedores.test.tsx` (busca el botón
    del acordeón, porque el nombre del cliente en el detalle ahora también es un botón);
  - `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.encabezado-cliente.test.tsx` (nueva).

## 7. Clasificación de gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 (acciones predecibles) | cumplimiento | El botón del cliente dice a dónde lleva (`title`) y solo navega. |
| BTN-01 | cumplimiento | `type="button"`, foco visible y sin mutación. |
| MP-01 | no aplica | No hay mutación. |
| AUD-01 / AUD-02 | no aplica | No se escribe ni se lee la auditoría. |
| Regla de montos (0661, RLS 0414, frontera SDD-0357) | cumplimiento | El dinero sigue llegando solo con `montos`, que la página decide en el servidor. No hay lecturas nuevas de `invoices`. |
