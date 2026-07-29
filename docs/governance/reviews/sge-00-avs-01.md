# Revisión SGE-00 sobre AVS-01

| Control | Valor |
|---|---|
| Revisión | REV-SGE-001 |
| Política evaluada | [SGE-00 v1.0](../policies/sge-00.md) |
| Caso | [AVS-01 · SDD-0165](../../specs/0165-sistema-gobernanza-experiencia-erp-studio/spec.md) |
| Fecha | 2026-07-21 |
| Estado | completada — evidencia para aprobación de SGE-00 |
| Alcance | contrato de toast y `ConfirmDialog`; no consumidores de negocio |

## Resultado

SGE-00 pudo aplicarse sin contradicciones a una política ya implementada. No se
detectó ningún bloqueador constitucional dentro del alcance de AVS-01.

| Principio | Resultado | Evidencia o límite |
|---|---|---|
| SGE-00.01 | cumple | Tonos, duraciones, prioridad, deduplicación y confirmación tienen significado estable en la primitiva central. |
| SGE-00.02 | cumple | Pausa conserva tiempo restante; cola no expira; diálogo bloquea cierre durante `pending`; foco se restaura. AVS-01 no persiste borradores. |
| SGE-00.03 | cumple | Destructivo inicia en **Cancelar**; la presión sostenida quedó fuera porque depende de MP-01/HTD-01. |
| SGE-00.04 | cumple | El toast no escribe auditoría y `correlationId` solo referencia un evento durable. La creación del evento pertenece a AUD-01. |
| SGE-00.05 | no aplica | AVS-01 no decide permisos ni estados contables; solo representa el resultado autorizado por la lógica de negocio. |
| SGE-00.06 | cumple | Deduplicación, bloqueo de doble acción y confirmación canónica previenen errores antes del aviso. |
| SGE-00.07 | cumple | Estados `queued`, `visible`, `paused`, `acting`, `resolved`, `dismissed`, `expired` y `action_failed`; no se anuncia éxito antes de resolver. |
| SGE-00.08 | cumple | El adaptador mantiene la API heredada y no agrega pasos a consumidores existentes. |
| SGE-00.09 | cumple | `ToastProvider` y `ConfirmDialog` son primitivas centrales; se retiraron confirmaciones nativas reales. |
| SGE-00.10 | cumple | Roles live, foco, Escape, focus trap, IDs únicos, nombres accesibles, móvil y movimiento reducido tienen pruebas/evidencia. |
| SGE-00.11 | cumple | Color no sustituye rol/tono; acciones y cierres tienen nombre. El copy específico de cada consumidor queda fuera de la fase. |
| SGE-00.12 | no aplica | AVS-01 no ejecuta ni autoriza decisiones de IA. |

## Hallazgos de la prueba constitucional

1. `no aplica` debe evaluarse contra el alcance real, no usarse para evitar una
   obligación del módulo consumidor.
2. Una primitiva puede cumplir SGE-00 aunque la lógica de negocio consumidora
   todavía tenga deuda; ambas capas deben evaluarse por separado.
3. `correlationId` demuestra bien la frontera entre feedback y evidencia, pero
   AUD-02 debe permitir localizar el evento enlazado.
4. La migración de consumidores heredados continúa como deuda de AVS-01 y no
   invalida el contrato central ya verificado.

## Conclusión

El gate es aplicable y suficientemente discriminante. Esta revisión cierra el
criterio técnico de probar SGE-00 contra AVS-01; la aprobación de la
constitución continúa siendo una decisión explícita del founder.
