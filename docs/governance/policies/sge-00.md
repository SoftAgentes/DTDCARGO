# SGE-00 v1.0 — Constitución de experiencia del ERP

| Control | Valor |
|---|---|
| Código | SGE-00 |
| Versión | 1.0 |
| Dueño | Sam (founder) |
| Custodia | Producto + Diseño + Ingeniería |
| Estado | aprobada |
| Aprobación | 2026-07-21 · Sam (founder) · conjunta con BTN-01 v1.0 |
| Creado | 2026-07-21 |
| Última revisión | 2026-07-21 |
| Confidencialidad | interno |
| Índice | [Sistema de Gobernanza de Experiencia ERP_Studio](../README.md) |

## 1. Propósito

SGE-00 es la constitución del comportamiento del ERP. Define las obligaciones
que deben cumplir las políticas, componentes, módulos y funciones asistidas por
IA antes de decidir colores, animaciones o implementaciones particulares.

Su objetivo es que el ERP crezca sin cambiar de personalidad, significado o
nivel de seguridad entre módulos.

## 2. Alcance

Aplica a:

- Studio ERP y sus módulos;
- superficies móviles que operan sobre el ERP;
- portal, correos, facturas, estados de cuenta y PDF originados por el ERP;
- componentes compartidos, automatizaciones y funciones asistidas por IA.

No reemplaza `BRAND.md`, MP-01 ni las políticas específicas. SGE-00 fija el
límite constitucional; cada política inferior define cómo cumplirlo.

## 3. Lenguaje normativo

- **Debe / nunca:** obligación. Incumplir requiere corrección o una excepción
  formal cuando esta sea admisible.
- **Debería:** regla preferida. Una desviación necesita justificación en el SDD
  o revisión de diseño.
- **Puede:** opción permitida, no obligatoria.

## 4. Principios constitucionales

| ID | Ley | Evidencia mínima de cumplimiento |
|---|---|---|
| SGE-00.01 | **Toda acción debe ser predecible.** El mismo verbo debe conservar la misma familia de resultado de negocio en todos los módulos; el objeto completa el significado. | En el alcance revisado no existe un mismo verbo para resultados incompatibles. Toda excepción identifica el resultado antes de ejecutar. |
| SGE-00.02 | **El usuario nunca debe perder silenciosamente su trabajo.** | Guardado, cancelación, navegación, cierre, error y reconexión tienen pruebas de conservación, recuperación o advertencia explícita. La aceptación admite cero escenarios conocidos de pérdida silenciosa. |
| SGE-00.03 | **El riesgo determina la fricción.** Una acción frecuente y reversible debe ser rápida; una acción irreversible, financiera o crítica debe exigir una decisión proporcional. | Toda mutación crítica tiene clasificación MP-01, consecuencia visible, permiso, confirmación o recuperación según su nivel. No se agrega fricción sin riesgo documentado. |
| SGE-00.04 | **Toda acción financiera, crítica o de permanencia debe poder auditarse.** | El 100 % de los eventos aplicables genera evidencia durable con tenant, actor, entidad, acción, fecha, resultado y, cuando corresponda, motivo y `correlationId`. Un toast nunca cuenta como auditoría. |
| SGE-00.05 | **La interfaz debe respetar permisos, tenant, privacidad y estados de negocio.** Ocultar un control no reemplaza la autorización ni la minimización de datos en el servidor. | Hay prueba negativa para rol no autorizado, tenant ajeno, dato no necesario y estado bloqueado aplicable —por ejemplo, período cerrado—. La UI refleja la restricción sin ser la única defensa. |
| SGE-00.06 | **El sistema debe prevenir errores antes de informarlos.** | Validaciones, límites, disponibilidad de acciones y datos requeridos se evalúan antes de la mutación cuando sea posible. Todo error restante explica cómo recuperarse. |
| SGE-00.07 | **El estado del sistema siempre debe ser visible y verdadero.** | Toda operación asíncrona relevante expone espera, éxito, vacío, error y recuperación; bloquea doble ejecución y nunca anuncia éxito antes del resultado durable. |
| SGE-00.08 | **La frecuencia reduce pasos; la complejidad no se oculta.** | Un flujo frecuente registra su recorrido actual y objetivo. Un cambio no aumenta pasos, cambios de contexto o campos obligatorios sin justificación de riesgo o negocio. |
| SGE-00.09 | **La misma necesidad debe reutilizar el mismo patrón.** | Antes de crear una primitiva se registra la búsqueda de un componente canónico. Toda variante nueva declara por qué el patrón existente no sirve y cómo evitará divergencia. |
| SGE-00.10 | **La experiencia debe ser accesible y equivalente.** | El flujo aplicable pasa WCAG 2.2 AA, teclado, foco visible/restaurado/no oculto, nombre accesible, zoom de navegador al 200 % y movimiento reducido. Una interacción gestual ofrece alternativa operable. |
| SGE-00.11 | **El lenguaje debe decir qué ocurrió y qué sigue.** | Etiquetas usan verbos consistentes; errores identifican problema y recuperación; confirmaciones expresan consecuencia. Color, icono o animación nunca son el único portador del significado. |
| SGE-00.12 | **La IA propone; la persona conserva la autoridad.** | Toda acción externa, financiera, sensible o irreversible propuesta por IA requiere autorización humana explícita, respeta permisos y deja evidencia. Siempre existe un camino manual o una salida segura. |

## 5. Gate constitucional medible

Toda política nueva y todo cambio sustancial del ERP debe incluir una matriz
SGE-00 con una fila por principio:

| Resultado permitido | Requisito |
|---|---|
| `cumple` | Incluye enlace a código, prueba, decisión o evidencia visual. |
| `no aplica` | Explica por qué el principio queda fuera del alcance. |
| `excepción` | Incluye decisión formal, responsable, vencimiento y mitigación. |
| `no cumple` | Registra una deuda; puede bloquear la aprobación según severidad. |

No se acepta una declaración general de “cumple SGE-00” sin evidencia por
principio aplicable.

La aprobación de SGE-00 no declara conforme todo el legado. Los incumplimientos
existentes se registran como deuda con alcance y riesgo; toda funcionalidad
nueva o modificada sí debe pasar el gate completo.

### Bloqueadores constitucionales

Un cambio no puede aprobarse mientras tenga `no cumple` en:

- pérdida silenciosa de trabajo (`SGE-00.02`);
- clasificación de riesgo y permanencia (`SGE-00.03`);
- auditoría obligatoria (`SGE-00.04`);
- permisos, tenant o estado contable (`SGE-00.05`);
- estado falso o doble ejecución (`SGE-00.07`);
- accesibilidad que impida completar la tarea (`SGE-00.10`);
- autoridad humana sobre acciones críticas de IA (`SGE-00.12`).

Los demás incumplimientos requieren corrección o excepción antes del cierre.
Una excepción nunca puede contradecir ley, seguridad, privacidad, contabilidad
o aislamiento entre tenants.

## 6. Medición sin métricas inventadas

Cuando no exista una línea base cuantitativa, el equipo debe medir primero y
fijar el objetivo en el SDD. Como mínimo, según el flujo:

- pasos y cambios de contexto para completar la tarea;
- tiempo de finalización y tasa de abandono;
- errores prevenidos, errores recuperados y reintentos;
- búsquedas sin resultado y selecciones corregidas;
- acciones deshechas, anuladas o escaladas a soporte;
- fallos de autorización y cobertura de auditoría;
- cumplimiento en escritorio, móvil, teclado y movimiento reducido.

SGE-00 no impone un número universal de clics o milisegundos. El objetivo debe
compararse con la tarea real, su frecuencia y su riesgo.

## 7. Excepciones y precedencia

Una excepción de comportamiento debe registrar:

1. principio y política afectados;
2. motivo y riesgo aceptado;
3. alcance exacto;
4. mitigación;
5. responsable y aprobador;
6. fecha de revisión o vencimiento.

Las excepciones visuales siguen además el proceso `BRAND-CHECK`. En caso de
conflicto se aplica la precedencia del índice maestro: ley, contabilidad,
seguridad, privacidad y permisos están por encima de cualquier preferencia de
interfaz.

## 8. Responsabilidad

- **Founder:** aprueba la constitución y sus cambios de versión.
- **Producto:** define significado, frecuencia, riesgo y resultado esperado.
- **Diseño:** demuestra claridad, consistencia, accesibilidad y adaptación.
- **Ingeniería:** garantiza permisos, integridad, auditoría y estados reales.
- **QA:** verifica evidencia y escenarios de fallo; no valida solo el camino feliz.

Una misma persona puede cubrir varios roles, pero las cinco responsabilidades
deben quedar atendidas.

## 9. Criterios de aprobación aplicados

- los doce principios se revisan expresamente;
- se acepta o corrige la lista de bloqueadores constitucionales;
- se confirma el alcance sobre Studio, móvil y salidas dirigidas al cliente;
- se valida el gate contra AVS-01 como caso ya implementado;
- no quedan contradicciones abiertas con `BRAND.md`, permisos, auditoría o la
  jerarquía del índice maestro;
- la aprobación del founder queda registrada con fecha y versión.

Los criterios fueron cerrados mediante REV-SGE-002 y la aprobación explícita
del founder el 2026-07-21. Desde esta fecha SGE-00 v1.0 gobierna cambios nuevos
y modificados. El legado no queda conforme automáticamente: sus brechas se
registran y priorizan por riesgo.

Validación preparada: [SGE-00 aplicado retrospectivamente a AVS-01](../reviews/sge-00-avs-01.md).
Revisión de aprobación preparada: [SGE-00 + BTN-01](../reviews/sge-00-btn-01.md).
