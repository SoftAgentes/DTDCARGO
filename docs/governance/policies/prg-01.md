# PRG-01 v1.0 — Progreso de procesos

| Control | Valor |
|---|---|
| Estado | aprobada — adopción pendiente |
| Aprobación | 2026-07-29 · Sam (founder) · REV-SGE-003 |
| Depende de | LOD-01, MOT-01 y A11Y-01 |

## Contrato

- Determinado solo cuando total y avance son reales; incluye valor actual/máximo.
- Indeterminado cuando no puede calcularse; nunca inventa un porcentaje.
- Estado/timeline representa hitos de negocio y no asume que cada paso pesa igual.
- Muestra etapa actual, completado, pendiente, bloqueo y siguiente acción.
- Un proceso largo explica si puede cerrarse la pantalla y cómo volver.
- Fallo conserva lo completado y señala desde dónde reintentar.
- 100 % significa terminado durable, no “solicitud enviada”.
- Color no es la única señal; `role=progressbar` declara valores cuando aplica.

## Gate

Probar 0, parcial, 100, indeterminado, pausa, error, reintento, reconexión,
retorno posterior, lector de pantalla y reduced motion.
