# Revisión del diseño correctivo del Corte D

| Control | Valor |
|---|---|
| Revisión | REV-AUD-014 |
| SDD | [SDD-0166](../../specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md) |
| Inventario | [Corte D · D0](../../specs/0166-auditoria-gobernada-aud-01-aud-02/inventario-corte-d-2026-07-29.md) |
| Diseño | [Atomicidad por dominio v1.0](../../specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-d.md) |
| Fecha | 2026-07-29 |
| Resultado | aprobado técnicamente |
| Decisión | revisión técnica Codex con autorización general de Sam (founder) |

## Veredicto

El diseño transforma el inventario en cinco fases coherentes y evita el
anti-patrón de reemplazar un INSERT best-effort por otra petición al writer
común. La secuencia D1–D5 es consistente con AUD-01 y con el criterio
`commit único o rollback completo`.

## Hallazgos aceptados

- ocho helpers TypeScript realizan 30 escrituras best-effort;
- dos eventos de cuenta usan un código donde `entity_id` exige UUID;
- la cobertura obligatoria es mayor que esos ocho helpers;
- cinco RPCs operativas son atómicas pero conservan contrato legacy;
- las dos RPCs de comentarios ya están cerradas por SDD-0168;
- Cloud solo tiene B1; `0268` y `0270` siguen sin aplicar.

## Condiciones

1. crear un SDD hijo antes de cambiar código;
2. inventariar D1 a nivel de cada mutación;
3. una migración y prueba por fase, nunca bundle;
4. probar rollback forzado del evento;
5. retirar cada helper solo junto con su RPC;
6. no revocar `INSERT service_role` hasta D5;
7. no absorber comentarios, retención o exportación en Corte D.

## Resultado del gate

D0 y el diseño quedan aprobados. Corte D no está implementado ni cerrado. No
se creó una migración, no se modificó Cloud y no se abrió D1.
