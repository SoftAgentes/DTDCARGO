# Auditoría de adopción — SGE-00, BTN-01, VIS-01 y AVS-01

| Control | Valor |
|---|---|
| Revisión | REV-SGE-008 |
| Fecha | 2026-07-29 |
| Alcance | análisis estático del Studio y evidencia SDD |
| Cambios de producto | ninguno |

## Resultado ejecutivo

| Política | Norma | Adopción comprobada | Veredicto |
|---|---|---|---|
| SGE-00 | aprobada | aplicada a gobernanza nueva y validada en AVS-01; sin matriz de las cuatro superficies | parcial |
| BTN-01 | aprobada | `ActionButton` aparece en 64 archivos; botones nativos siguen ampliamente distribuidos | parcial |
| VIS-01 | aprobada | tokens y variantes light/dark existen; quedan literales sin clasificar fuera de `tokens.css` | parcial |
| AVS-01 | verificada | primitivas y pruebas cerradas; 26 llamadas `toast.show()` frente a 261 llamadas heredadas | primitiva conforme, consumidores parciales |

## Evidencia

### SGE-00

- existe gate, plantilla, jerarquía de políticas y primer caso verificado;
- AVS-01 fue contrastada retrospectivamente;
- no existe una matriz vigente que demuestre cumplimiento de las cuatro
  superficies ni de cada principio constitucional.

### BTN-01

- `ActionButton` centraliza pending, doble ejecución y feedback;
- 64 archivos del Studio lo referencian;
- 265 archivos contienen `<button>` y 888 ocurrencias. Un botón HTML nativo no
  es por sí solo incumplimiento, pero el volumen impide afirmar adopción sin
  clasificar rol, variante, orden, pending y semántica;
- la documentación de `DocsPanel` registra al menos una excepción deliberada.

### VIS-01

- `app/studio/tokens.css` contiene roles wine/ink/surface y variantes dark;
- el Studio consume `var(--*)` extensamente;
- el barrido encuentra 448 literales hex fuera de `tokens.css` y 65 usos
  `rgba()` en TS/TSX. Incluyen casos históricos/posiblemente legítimos, pero no
  existe registro de excepciones que permita declararlos conformes;
- la regla 60-30-10 no puede validarse solo por texto: requiere muestreo visual.

### AVS-01

- SDD-0165 está `done`; `ToastProvider` y `ConfirmDialog` tienen pruebas;
- no quedan confirmaciones nativas reales: las coincidencias son documentación
  y una función de negocio llamada `confirm`;
- existen 26 llamadas gobernadas `toast.show()`;
- permanecen 261 llamadas legacy `success/error/warning/info`, compatibles pero
  deprecadas para trabajo nuevo.

## Próximos gates

1. SGE-00: matriz por superficie/flujo crítico.
2. BTN-01: clasificar botones por riesgo y migrar solo mediante SDD acotado.
3. VIS-01: inventario de literales y muestreo visual autenticado.
4. AVS-01: migración de consumidores por módulo, priorizando R2/R3.

No se recomienda un barrido masivo ni convertir conteos estáticos en fallas
automáticas.
