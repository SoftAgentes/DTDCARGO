# Ventas — DTD Cargo (línea cliente-ancla)

> **La línea comercial que sostiene el norte interno: 2 contenedores/mes.** Acá se define el
> perfil objetivo, la oferta y el plan mensual recurrente. El *por qué* y la identidad están en
> [`estrategia.md`](estrategia.md).
>
> **Estado (2026-07-17):** estructura creada; criterios de ancla confirmados; **la ejecución de la
> captación ya tiene sistema**: oferta empaquetada + canal primario + proceso de prospección diario
> en [`adquisicion.md`](adquisicion.md) (manual del asesor, nivel principiante).
>
> **El embudo operativo que ejecuta esta estrategia** (5 etapas, campos del Kanban, mapa de etapas
> MARKBOX para SDD-0084, SLA y loop de recompra) vive en [`embudo-ventas.md`](embudo-ventas.md).
> **El frente del embudo** (prospección, cadencia de toques, referidos) vive en [`adquisicion.md`](adquisicion.md).

## Objetivo

**2 contenedores/mes sostenido** (hoy ~1). Es el umbral de equilibrio operativo (ver
[`estrategia.md`](estrategia.md) §2). Se llena con **dos motores**.

## Motor 1 · Mayoristas recurrentes

Comercios/distribuidores que revenden y reabastecen inventario cada **30–45 días** vía puerta a
puerta, a cambio de un **precio mayorista especial condicionado a esa cadencia**.

- Cuentas activas estimadas para llenar el volumen: **~7–14** *(supuesto — depende del CBM
  promedio por cuenta y del tamaño de contenedor; cerrar cuando se mida)*.
- La condición del precio especial es **mantener la cadencia**; si se rompe, se revisa la tarifa.

## Motor 2 · Aliados / revendedores (white-label)

Socios que **revenden el servicio DTD** (referidos o alianza) y aportan el volumen de sus
clientes. Beneficio clave: acceso al **ERP en white-label** para dar seguimiento a sus clientes
sin que estos detecten que DTD está detrás.

- Base técnica ya existente: arquitectura **multi-tenant** + portal cliente (SDD-0042). El
  white-label para aliados es **extensión**, no de cero.

## Criterios de "cliente ancla" (confirmados 2026-06-08)

Se define por **comportamiento de carga**, no por formalidad:

| # | Criterio | Detalle |
|---|---|---|
| 1 | **Volumen recurrente** | ≥1 contenedor/mes o un mínimo de CBM constante. |
| 2 | **Proveedor fijo en China** | compra constante a proveedores establecidos (Yiwu/Cantón). |
| 3 | **Rubro de alta rotación** | ferretería, repuestos, hogar, electrónica, etc. |

*(Formalidad / RIF / historial de pago = deseable operacional, **no** criterio de calificación.)*

## Oferta

Precio **mayorista preferencial** por volumen recurrente, condicionado a la cadencia de
recompra. *(Tarifas concretas = internas, no en git.)*

## Plan mensual (plantilla recurrente)

Se revisa **cada mes**. Una fila por mes:

| Mes | Meta (cont.) | Prospectos ancla | Criterios que cumplen | Oferta enviada | Estado |
|---|---|---|---|---|---|
| 2026-06 | 2 | — | — | — | pendiente |
| 2026-07 | 2 | **lista armada: [`prospectos-ancla.md`](prospectos-ancla.md)** (~60 mayoristas, ⭐ top 10) + base Kommo en `/studio/kommo` › Recuperación | por calificar (5 preguntas de [`adquisicion.md`](adquisicion.md) §5) | tras calificar | **en curso** — sistema + herramientas listos 17-jul; arranca la rutina diaria |

> **Marketing apunta SOLO a estos dos perfiles** (mayoristas recurrentes + aliados), **no a
> compradores de una sola vez.**

## Pendiente
- [ ] Medir CBM promedio por cuenta → cerrar el rango "~7–14 cuentas".
- [ ] Definir la tarifa preferencial y la condición exacta de cadencia → decisión #2 de [`adquisicion.md`](adquisicion.md) §10.
- [ ] Cablear los recordatorios de recompra (día 30/45) en el ERP (Kommo Fase 1) → backlog #3 de [`adquisicion.md`](adquisicion.md) §8.
