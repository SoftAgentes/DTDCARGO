# BUS-01 v0.1 — Búsqueda predictiva y contexto de resultados

| Control | Valor |
|---|---|
| Estado | redactada — pendiente de aprobación |
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
- “Crear nuevo” solo aparece mediante CRT-01 y permiso válido.

## Gate

Probar exact match, duplicados, acentos/mayúsculas, código parcial, respuesta
fuera de orden, cero resultados, error, teclado, móvil, permisos y selección.

Alias histórico: SEA-01. BUS-01 es el código canónico porque cubre búsqueda
global, combobox y búsqueda contextual.
