# BUS-01 v1.1 — Búsqueda predictiva y contexto de resultados

| Control | Valor |
|---|---|
| Estado | aprobada — adopción pendiente |
| Aprobación | 2026-07-29 · Sam (founder) · REV-SGE-014 |
| Base actual | `GlobalSearchModal`, `ClientCombobox` y búsquedas por módulo |

## Contrato

- Cada buscador declara su alcance: cliente, Shipping Mark, SKU, documento,
  factura, proveedor u otra entidad; el placeholder no es la única declaración.
- El ranking prioriza coincidencia exacta de código/ID, prefijo, nombre y luego
  coincidencia tolerante. La lógica específica se documenta por entidad.
- Dos resultados con el mismo nombre se distinguen con identificador y contexto
  útil —por ejemplo Shipping Mark, documento, ciudad o empresa—. Nunca se repite
  el mismo texto en título y subtítulo sin aportar información.
- Resultados respetan tenant, rol y estado; el cliente no filtra datos que nunca
  debió recibir.
- Remoto usa debounce/cancelación y descarta respuestas obsoletas.
- Expone loading, vacío, error, recientes cuando aportan valor y limpieza clara.
- Teclado: foco, flechas, Enter, Escape y anuncio de cantidad/selección.
- Seleccionar cierra o conserva el popup según el patrón, restaura foco y no
  ejecuta una mutación oculta.
- El popup evita clipping y puede abrir arriba o abajo según el viewport; zoom
  200 % y reflow no esconden opciones ni el control que lo abrió.
- La necesidad de búsqueda, paginación o virtualización depende de contenido,
  frecuencia, latencia y medición. Umbrales aislados de 10 o 100 opciones no
  son reglas universales.
- “Crear nuevo” solo aparece mediante CRT-01 y permiso válido.

## Gate

Probar exact match, duplicados, acentos/mayúsculas, código parcial, respuesta
fuera de orden, cero resultados, error, teclado, móvil, permisos y selección.

Alias histórico: SEA-01. BUS-01 es el código canónico porque cubre búsqueda
global, combobox y búsqueda contextual.
