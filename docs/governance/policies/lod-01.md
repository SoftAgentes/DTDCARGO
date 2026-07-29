# LOD-01 v1.0 — Carga, espera y feedback optimista

| Control | Valor |
|---|---|
| Código | LOD-01 |
| Estado | aprobada — adopción pendiente |
| Aprobación | 2026-07-29 · Sam (founder) · REV-SGE-003 |
| Creado | 2026-07-21 |
| Depende de | SGE-00, MOT-01 y AVS-01 |

## Selección del patrón

| Situación | Patrón |
|---|---|
| Mutación desde botón | Spinner/label inmediato dentro del botón; bloquea repetición. |
| Carga breve de contenido existente | Conservar contenido anterior; indicador discreto si supera `--dur`. |
| Primera carga con layout conocido | Skeleton que reproduce estructura, no datos inventados. |
| Proceso con avance medible | Barra/porcentaje real + etapa actual. |
| Proceso sin avance medible | Estado indeterminado con explicación; nunca porcentaje falso. |
| Cambio optimista reversible | Actualizar, marcar pendiente y ofrecer rollback si falla. |

## Reglas

- No usar skeleton para acciones, textos cortos o layout desconocido.
- Si un skeleton aparece, evita un destello más corto que la transición estándar.
- Un proceso de más de un paso comunica etapa, posibilidad de salir y qué se conserva.
- El usuario puede seguir leyendo contenido anterior durante una recarga segura.
- Success aparece solo después del resultado durable.
- Error sustituye la espera y ofrece reintento/recuperación; nunca spinner infinito.
- Pestaña oculta o reconexión no reinicia artificialmente el progreso.
- `aria-busy` se aplica al área relevante; anuncios no repiten cada cambio de porcentaje.

## Gate

Probar respuesta inmediata, demora, timeout, red lenta, offline/reconexión,
doble ejecución, cancelación, error, reintento, estado vacío y reduced motion.
