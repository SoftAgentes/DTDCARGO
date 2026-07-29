# TBL-01 v1.0 — Tablas, densidad y acciones de colección

| Control | Valor |
|---|---|
| Estado | aprobada — adopción pendiente |
| Aprobación | 2026-07-29 · Sam (founder) · REV-SGE-004 |
| Base actual | `DataTable`, `useColumnConfig` y `ColumnManager` |

## Contrato

- Tabla semántica para lectura; grid interactivo solo si implementa navegación completa.
- Encabezados describen datos, unidades y orden; sort comunica dirección.
- Filtros, búsqueda y cantidad de resultados permanecen visibles y restaurables.
- Columnas esenciales no se ocultan; opcionales usan configuración persistente por usuario/contexto.
- Estado vacío distingue “sin datos” de “sin coincidencias”.
- Selección activa acciones masivas y muestra cantidad; salir conserva o limpia de forma explícita.
- Acción por fila no cambia de posición según estado sin reservar espacio/contexto.
- Si una fila sale del filtro tras mutación, AVS-01 deja rastro y enlace.
- Móvil prioriza columnas o usa lista/detalle; no comprime texto hasta ilegibilidad.
- Paginación/sort/filter de datos grandes ocurre en servidor.

## Gate

Probar loading, vacío, error, sort, filtro, paginación, selección, bulk action,
columnas, teclado, sticky regions, móvil y 200 % zoom.
