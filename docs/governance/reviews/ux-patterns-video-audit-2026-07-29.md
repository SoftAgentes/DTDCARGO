# Revisión de patrones UX observados en videos

| Control | Valor |
|---|---|
| Revisión | REV-SGE-014 |
| Fecha | 2026-07-29 |
| Alcance | formularios, dropdowns/comboboxes y tabs |
| Resultado | contratos aprobados; adopción por tres SDD acotados |
| Aprobación | 2026-07-29 · Sam (founder) |

## 1. Evidencia y método

Se revisaron dos veces los cuatro archivos aportados: una pasada sobre la
transcripción local del audio y otra sobre el texto y las demostraciones
visuales. `Download (2).mp4` y `Download (4).mp4` son duplicados binarios:

| Archivo | Tema | SHA-256 |
|---|---|---|
| `Download (2).mp4` | validación de formularios | `60B5EF52F1F0011B494661A95B8C5580B38509529DCAA10B4612BAB1C68C0580` |
| `Download (3).mp4` | dropdowns, selects y comboboxes | `B77C4C771F46F7F7A2A454C314466007C952F6FB86AFBD8891AA240791B8E4F3` |
| `Download (4).mp4` | duplicado de `Download (2).mp4` | `60B5EF52F1F0011B494661A95B8C5580B38509529DCAA10B4612BAB1C68C0580` |
| `Download (5).mp4` | tabs y navegación segmentada | `5F6DC055C77FC0F1FF5B5F1703DCED99086E67E5C6DFBD403DEC3F121F7CC9F9` |

Los archivos permanecen fuera del repositorio. Esta revisión conserva hashes y
conclusiones, no video, audio, transcripción ni PII.

## 2. Decisión general

La gobernanza del ERP permanece como marco normativo. Los videos son evidencia
de diseño útil, pero no sustituyen contexto, riesgo, accesibilidad, tokens,
excepciones ni pruebas. Se aceptan los contratos que mejoran previsibilidad y
operación; se rechazan umbrales universales no respaldados por el contexto.

La adopción usa cuatro resultados: `cumplimiento`, `no aplica`, `excepción` y
`no conformidad`. Un conteo estático orienta el muestreo, pero no aprueba ni
reprocha por sí solo.

## 3. Formularios

| Regla observada | Estado previo | Decisión |
|---|---|---|
| No mostrar error mientras el campo intacto se escribe por primera vez | FRM-01 ya prohibía regañar por un valor incompleto | cumplimiento normativo |
| Validar inicialmente al salir del campo | FRM-01 permitía blur o submit sin ordenar el ciclo | formalizar como preferencia para formato |
| Revalidar en vivo después del primer error | ERR-01 exigía desaparición predecible, pero el cambio de modo era implícito | incorporar |
| Confirmar también el valor correcto | no era obligación transversal | aplicar sólo cuando aporta información |
| Validar sólo al final siempre es incorrecto | regla absoluta | rechazar: submit conserva validación completa y reglas server-side |

Contrato aprobado:

```text
pristine → blur/submit → invalid → live correction → resolved
```

El submit siempre valida el formulario completo. Si hay varios errores, el
resumen y el foco del primer bloqueo permanecen obligatorios. La confirmación
positiva no convierte cada campo en una colección de checks verdes.

## 4. Dropdowns, menus, listboxes y comboboxes

| Regla observada | Gobernanza/producto | Decisión |
|---|---|---|
| Trigger reconocible, foco y estado | cubierto por BTN-01/VIS-01/A11Y-01 | conservar |
| Target 44 px universal | A11Y-01 usa 24 mínimo, 32 escritorio y 44 touch | conservar nuestra regla |
| Abrir arriba si no cabe abajo | `SplitActionButton` ya lo calcula; `ClientCombobox` no | incorporar prevención de clipping |
| Flechas, Enter y Escape | contrato existente con adopción desigual | precisar patrón y probar |
| Más de 10 requiere búsqueda | el tipo y contenido importan más que un número | rechazar como ley |
| Más de 100 requiere virtualización | no hay evidencia de rendimiento por selector | optimización medida, no norma |
| Animación menor de 150 ms | MOT-01 usa 120/180/260 ms | conservar tokens aprobados |

Un menu button debe restaurar foco al trigger al cerrar con Escape. Un
combobox/listbox conserva flechas, Enter, Escape, anuncio y selección sin
mutación oculta. Los popups evitan clipping usando el espacio disponible.

## 5. Tabs

| Regla observada | Gobernanza/producto | Decisión |
|---|---|---|
| Flechas cambian de tab y Tab sale del grupo | 29 archivos con `tablist`; sólo uno tenía flechas explícitas | no conformidad prioritaria de adopción |
| Home/End primero/último | no estaba explícito | recomendación implementable |
| Foco y selección son estados distintos | derivable de A11Y-01/VIS-01 | hacer explícito |
| Indicador siempre se desliza | MOT-01 sólo exige movimiento con propósito | rechazar como obligación |
| Muchos tabs nunca envuelven dos líneas | faltaba contrato de overflow | incorporar por ancho real |
| Menos de cinco usa segmented; más de cinco usa bottom sheet | confunde jerarquía, selección y navegación | rechazar como ley |
| Fade, pausa 80 ms y altura estable | estabilidad aporta; coreografía rígida no | adoptar estabilidad, no tiempos inventados |

Las flechas forman parte del patrón de tabs; Home/End son una mejora
recomendada. Cada tab se asocia a su `tabpanel`; sólo el tab activo pertenece
al orden de Tab y el foco visible no se confunde con selección.

## 6. Fuentes primarias

- [WCAG 2.2 · Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [ARIA APG · Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- [ARIA APG · Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [ARIA APG · Menu Button](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)
- [ARIA APG · Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)

## 7. Adopción aprobada

La aprobación abre únicamente:

1. SDD-0180: tabs accesibles en el flujo Fiscal R2/R3;
2. SDD-0181: un menu button y un combobox canónicos con colisión segura;
3. SDD-0182: ciclo de validación progresiva en identidad de Club.

Cada SDD tiene allowlist y pruebas propias. Quedan prohibidos el reemplazo
masivo de los 29 tablists, 246 selects o todos los formularios, y cualquier
cambio a CMP-01, PLG-01, D1, D2–D5, Cloud o Vercel.

## 8. Aprobación técnica

REV-SGE-014 aprueba FRM-01, A11Y-01, BTN-01 y BUS-01 v1.1 con los contratos
anteriores. MOT-01 permanece v1.0: sus tokens 120/180/260 ms y
`prefers-reduced-motion` no cambian.
