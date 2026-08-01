# CMP-01 v1.1 y primer caso deprecated

| Control | Valor |
|---|---|
| Revisión | REV-SGE-017 |
| Fecha | 2026-07-29 |
| Alcance | schema v1.1, A11Y-01 y ciclo canonical → deprecated |
| Resultado | aprobado |
| Aprobación | 2026-07-29 · Sam (founder) |

## Decisión

CMP-01 pasa a schema v1.1 para representar `A11Y-01` sin falsificar el código
de la política. La expresión acepta códigos alfanuméricos antes del guion y la
rama `retired` declara explícitamente que `consumers` es un array.

`ConfirmDialog` incorpora la referencia normativa `A11Y-01 v1.1`.
`SegmentedControl` entra como `canonical`: tiene semántica `radiogroup`,
un tab stop, flechas, Home/End, opciones deshabilitadas, tres consumidores
reales y prueba ejecutable.

`LLMModeToggle` entra como `deprecated`. No está roto ni se elimina: es un
wrapper de un solo consumidor que ya delega en `SegmentedControl`. Nuevos usos
quedan prohibidos y el reemplazo es el componente canónico.

## Plan de migración

1. El único consumidor inventariado es `NoticiasWebClient.tsx`.
2. Un SDD del módulo puede mover el estado `useLLMMode` al consumidor e
   instanciar `SegmentedControl` directamente.
3. El retiro exige cero imports de `LLMModeToggle`, conservar el hook si todavía
   tiene consumidores y ejecutar registro, tests y build.
4. No se migra ningún otro selector ni se hace barrido transversal.

## Evidencia

- schema positivo y fixture negativo;
- reemplazo existente y `canonical`;
- consumidor deprecated existente e importador;
- test de teclado/ARIA del canónico;
- agregado reproducible y sin rutas rotas.

## Límite

La revisión no modifica comportamiento visual, no retira el wrapper y no
autoriza una migración masiva. Habilita P1 de PLG-01 exclusivamente porque el
registro ya demuestra `proposed → canonical` y `canonical → deprecated`.
