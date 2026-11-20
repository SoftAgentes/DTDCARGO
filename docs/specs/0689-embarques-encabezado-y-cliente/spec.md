---
sdd: "0689"
title: "Embarques: peso y «Total sin facturar» en el encabezado, y clic en el cliente"
status: proposed
author: "Claude (Worker) + Sam"
created: 2026-11-20
updated: 2026-11-20
supersedes: null
superseded_by: null
related: ["0643", "0661", "0665", "0674", "0682", "0690"]
confidencialidad: interno
---

# SDD-0689 — Embarques: peso y «Total sin facturar» en el encabezado, y clic en el cliente

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
  - Adentro, al abrir el contenedor, la franja y el detalle por cliente muestran los montos completos,
    como hoy (SDD-0661).
  - Si no hay borradores, dice «Sin precios cargados», nunca $0.00 inventado, y no hay ojo. Así queda el 64 hasta que la
    SDD-0690 cargue sus borradores.
  - El sistema trabaja en dólares; el bolívar es solo una vista. Las facturas en otra moneda no suman.
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

- Todo lo de la SDD-0690: cargar los borradores del 64 desde el Excel, «Facturar» que emite el borrador,
  «Facturar todo», el estado «Facturado» y el cambio de la RPC de la 0564.
- El historial de contenedores entregados al 100 % y la tarifa por cliente con la alerta de exceso: son
  pedidos nuevos de Sam y el DG les asigna su número.

## 5. Aceptación

1. El encabezado cerrado del contenedor muestra el peso total a todos los roles que ven Embarques.
2. Con montos, muestra «Sin facturar ••••••» y un ojo. El ojo muestra la suma en USD de los borradores
   durante 4 segundos y la vuelve a ocultar, sin abrir el contenedor. Sin borradores, muestra «Sin precios
   cargados».
3. Sin montos (`operations`, `commercial`, `warehouse`, `support`), el encabezado no muestra ningún dinero.
4. En el detalle, clic en un cliente con un embarque abre su ficha; con varios, abre su bloque.
5. Las pruebas de la SDD-0661 siguen pasando, salvo la que congelaba «sin dinero en la cabecera», que se
   ajusta a esta decisión.

## 6. Archivos (allowlist)

- `docs/specs/0689-embarques-encabezado-y-cliente/spec.md` y el índice `docs/specs/README.md`.
- `.agents/handoffs/sdd-0689-embarques-encabezado-y-cliente.md`.
- `lib/studio/embarques-contenedores.ts`: `MontoAcumulado` suma `borradores` y `sinFacturarUsd`.
- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx`.
- Pruebas:
  - `lib/studio/__tests__/embarques-cajas-y-monto.test.ts`;
  - `app/studio/(app)/embarques/__tests__/page-monto-por-rol.test.ts`;
  - `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.cajas-monto.test.tsx`;
  - `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.encabezado-cliente.test.tsx` (nueva).

## 7. Clasificación de gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 (acciones predecibles) | cumplimiento | El botón del cliente dice a dónde lleva (`title`) y solo navega. |
| BTN-01 | cumplimiento | `type="button"`, foco visible y sin mutación. |
| MP-01 | no aplica | No hay mutación. |
| AUD-01 / AUD-02 | no aplica | No se escribe ni se lee la auditoría. |
| Regla de montos (0661, RLS 0414, frontera SDD-0357) | cumplimiento | El dinero sigue llegando solo con `montos`, que la página decide en el servidor. No hay lecturas nuevas de `invoices`. |
