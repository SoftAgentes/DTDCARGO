# Revisión conjunta SGE-00 + BTN-01

| Control | Valor |
|---|---|
| Revisión | REV-SGE-002 |
| Constitución | [SGE-00 v1.0](../policies/sge-00.md) |
| Política derivada | [BTN-01 v1.0](../policies/btn-01.md) |
| Fecha | 2026-07-21 |
| Resultado técnico | aprobado |
| Estado normativo | SGE-00 v1.0 y BTN-01 v1.0 aprobadas |
| Decisión | 2026-07-21 · Sam (founder) |

## 1. Veredicto

BTN-01 deriva correctamente de SGE-00 y no introduce una ley superior. La
revisión conjunta no encontró contradicciones abiertas después de los ajustes
registrados en este gate. La aprobación establece el contrato constitucional y
de acciones, pero **no** declara conforme el legado ni autoriza una migración
masiva.

## 2. Derivación constitucional

| Principio SGE | Traducción en BTN | Resultado |
|---|---|---|
| 00.01 Predecible | vocabulario reservado y objeto explícito | cumple |
| 00.02 No perder trabajo | cancelar, pending y recuperación declarados | cumple |
| 00.03 Riesgo determina fricción | MP-01 P0–P4 y R1–R3 obligatorios | cumple |
| 00.04 Auditable | auditoría se declara incluso cuando no aplica | cumple |
| 00.05 Permiso/tenant/privacidad/estado | permiso y precondiciones explícitos; servidor manda | cumple |
| 00.06 Prevenir errores | disabled explicado, validación y confirmación proporcional | cumple |
| 00.07 Estado verdadero | loading, success y error con resultado durable | cumple |
| 00.08 Frecuencia reduce pasos | acciones frecuentes visibles; raras al menú | cumple |
| 00.09 Reutilizar patrón | `ActionButton` y `SplitActionButton` antes de crear variantes | cumple |
| 00.10 Accesible | semántica nativa, teclado, targets, foco y nombres | cumple |
| 00.11 Lenguaje accionable | verbo + objeto + consecuencia + recuperación | cumple |
| 00.12 Autoridad humana sobre IA | BTN no permite que la IA active el control; IA-01 gobierna la propuesta | cumple por dependencia |

## 3. Ajustes incorporados antes de decidir

1. **Acción versus navegación:** botón ejecuta; enlace navega.
2. **HTML seguro:** `type="button"` por defecto y submit solamente intencional.
3. **Jerarquía de tablas:** acciones repetidas por fila no se convierten en
   decenas de primarios visuales.
4. **Destructivo en menú:** se permite como entrada secundaria, pero R2/R3
   termina en contexto explícito; una acción crítica central no queda escondida.
5. **Disabled explicable:** la ayuda no depende de un control que no recibe foco.
6. **Contrato sin omisiones silenciosas:** permanencia, fricción y auditoría
   declaran también `not-applicable`/`false` con justificación.
7. **Privacidad constitucional:** SGE-00.05 incorpora minimización y exposición
   de datos junto con permiso, tenant y estado.
8. **Accesibilidad:** SGE-00.10 nombra WCAG 2.2 AA y foco no oculto.

La distinción botón/enlace y el comportamiento de Enter/Space siguen el
[patrón Button de WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
y el uso de enlace nativo sigue el
[patrón Link](https://www.w3.org/WAI/ARIA/apg/patterns/link/). El tipo explícito
evita depender del comportamiento automático de submit definido por el
[HTML Living Standard](https://html.spec.whatwg.org/multipage/form-elements.html#the-button-element).

## 4. Lo que se aprobaría

### SGE-00

- los doce principios y su precedencia;
- los siete bloqueadores constitucionales;
- el gate por evidencia (`cumple/no aplica/excepción/no cumple`);
- alcance sobre Studio, móvil y salidas dirigidas al cliente;
- deuda heredada permitida solo si queda registrada; cambios nuevos pasan gate.

### BTN-01

- seis roles semánticos y una sola primaria dominante por contexto;
- vocabulario oficial de 20 verbos;
- orden de acciones por pantalla, formulario, overlay, tabla y móvil;
- ocho estados obligatorios;
- reglas ocultar/deshabilitar, iconos, menús y HTML semántico;
- `GovernedAction` como información obligatoria de diseño/SDD;
- MP-01 decide permanencia, AUD-01 evidencia y AVS-01 feedback.

## 5. Lo que no se aprobaría

- que todos los botones actuales ya cumplen;
- modificar automáticamente los 341 archivos con `<button>`;
- crear un componente nuevo o el tipo TypeScript todavía;
- aplicar HTD-01 a todas las eliminaciones;
- cambiar permisos, base de datos, auditoría o producción;
- aceptar excepciones sin responsable y vencimiento.

## 6. Decisión registrada

El founder aprobó conjuntamente **SGE-00 v1.0 y BTN-01 v1.0** el 2026-07-21.
No se registraron excepciones. La aprobación entra en vigor para todo cambio
nuevo o modificado y preserva la deuda del legado como alcance separado.
