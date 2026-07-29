# BTN-01 v1.1 — Semántica, jerarquía y contrato de botones

| Control | Valor |
|---|---|
| Código | BTN-01 |
| Versión | 1.1 |
| Dueño | Sam (founder) |
| Estado | aprobada |
| Aprobación | 2026-07-29 · Sam (founder) · REV-SGE-014 |
| Creado | 2026-07-21 |
| Depende de | [SGE-00](sge-00.md), [MP-01](mp-01.md), AVS-01 y AUD-01 |
| Fuente técnica actual | [`app/studio/CLAUDE.md`](../../../app/studio/CLAUDE.md) · `ActionButton` · `SplitActionButton` |

## 1. Ley central

Un botón representa una decisión, no un color. Antes de elegir variante se
define el resultado de negocio, riesgo, permiso, permanencia, estado y rastro
posterior. El mismo verbo no puede cambiar de significado entre módulos.

## 2. Rol semántico y variante visual

| Rol | Uso | Implementación preferida |
|---|---|---|
| Primario | Única acción dominante del contexto | `primary` |
| Secundario | Alternativa importante y no destructiva | `dark` o `ghost`, según énfasis |
| Terciario | Navegación, cancelar o acción discreta | `ghost` o enlace |
| Destructivo | Eliminar, anular, revertir o rechazar con consecuencia | `danger`; `warning` solo si requiere atención y no destruye |
| Icono | Acción frecuente y inequívoca en espacio reducido | botón con icono, nombre accesible y tooltip |
| Menú | Acciones secundarias o poco frecuentes | menú de acciones; la principal queda visible |

Reglas:

- una sola acción primaria por pantalla, drawer, diálogo o bloque independiente;
- `success` no es una variante en reposo: solo feedback transitorio;
- el vino de marca no sustituye `danger`;
- una acción crítica no se oculta sin rastro dentro de un menú para “limpiar” la pantalla;
- una tabla puede repetir una acción por fila, pero normalmente usa enlace,
  terciario o icono para no crear decenas de primarios visuales; la página
  conserva una sola acción dominante.

### Botón, enlace y tipo HTML

- Un botón **ejecuta una acción o cambia el estado**; un enlace **navega a un
  recurso o ubicación**. La apariencia no cambia esa semántica.
- Se prefieren `<button>` y `<a href>` nativos; un `div` clickable no es una
  primitiva válida.
- Todo botón declara `type`. El default de componentes de acción es
  `type="button"`; `type="submit"` solo se usa cuando debe enviar ese formulario.
- Enter y Space activan el botón enfocado. La activación no ocurre por hover ni
  por recibir foco.
- Un formulario tiene un submit principal inequívoco; Enter no puede disparar
  a la vez guardar, cerrar y otra acción secundaria.

## 3. Vocabulario oficial

| Verbo | Resultado reservado | No usar para |
|---|---|---|
| Crear | Nace una entidad persistente nueva | Agregar una línea a una entidad existente |
| Agregar | Se incorpora un hijo, adjunto, ítem o relación | Crear una entidad principal independiente |
| Guardar | Persiste cambios sin transición formal | Emitir, aprobar o ejecutar side effects no declarados |
| Guardar borrador | Persiste sin formalizar ni emitir | Acción que ya produce efecto externo |
| Registrar | Asienta un hecho ocurrido: pago, recepción, gestión | Guardado genérico de cualquier formulario |
| Confirmar | Acepta una propuesta o dato pendiente; debe nombrar el objeto cuando haya ambigüedad | Sinónimo genérico de Guardar |
| Procesar | Ejecuta un proceso realmente genérico o por lote y muestra progreso | Ocultar un resultado que puede nombrarse con precisión |
| Aprobar | Decisión positiva dentro de un flujo controlado | Guardar ediciones |
| Rechazar | Decisión negativa conservando historial y motivo cuando aplique | Eliminar el registro |
| Emitir | Formaliza un documento y puede activar efectos contables/externos | Crear un borrador |
| Enviar | Entrega información a una persona o sistema externo identificado | Guardar localmente |
| Convertir | Crea o transforma hacia otra entidad/estado y declara el destino | Actualización menor |
| Archivar | Retira de la operación activa con restauración | Eliminar o anular |
| Eliminar | Aplica únicamente al resultado P0/P2 autorizado por MP-01 | Anular un hecho financiero o esconderlo |
| Anular | Conserva el original y neutraliza su efecto mediante estado o compensación | Borrar físicamente |
| Revertir | Devuelve un efecto mediante transición o movimiento compensatorio trazable | Restaurar silenciosamente una versión anterior |
| Cancelar | En UI abandona la interacción sin guardar; en negocio debe incluir objeto: “Cancelar embarque” | Mezclar salida del diálogo con anulación de negocio |
| Cerrar | Cierra una superficie o concluye un proceso que admite cierre | Cancelar o eliminar |
| Deshacer | Revierte la última acción realmente recuperable dentro de su ventana | Prometer recuperación que depende de soporte |
| Duplicar | Crea una copia nueva e identificable | Sobrescribir el original |

La etiqueta usa sentence case, verbo directo, castellano venezolano neutro y
cero emoji decorativo. “Aceptar”, “Continuar” o “Sí” solo se permiten cuando la
consecuencia completa permanece visible y no existe ambigüedad.

## 4. Orden por contexto

| Contexto | Orden y colocación |
|---|---|
| Header de página | Navegación/terciarias primero; secundarias después; primaria al extremo derecho. Acciones raras pasan al menú. |
| Formulario de página | Cancelar o volver a la izquierda; guardar/continuar a la derecha. Si hay autosave, no se simula un botón Guardar. |
| Drawer o modal no destructivo | Cancelar/secundaria a la izquierda; primaria a la derecha. El orden DOM coincide con el visual. |
| Diálogo destructivo | Cancelar recibe foco inicial; destructiva queda a la derecha y separada visualmente. |
| Barra de herramientas | Búsqueda/filtros a la izquierda; acciones de colección a la derecha; acciones masivas solo aparecen con selección. |
| Fila de tabla | La navegación principal suele ser enlace en la identidad de la fila. Máximo dos acciones frecuentes de bajo énfasis visibles; el resto va al menú. La destructiva conserva etiqueta inequívoca y confirmación proporcional. |
| Móvil | Primaria de ancho disponible cerca del pulgar y sobre safe area; secundaria debajo o antes en DOM; destructiva aislada. No se cambia el significado al compactar. |

Una acción destructiva nunca comparte borde con una positiva ni ocupa el lugar
esperado de **Cancelar**. Una entrada destructiva secundaria puede vivir en el
menú de una fila; la decisión final R2/R3 aparece en un contexto explícito con
objeto y consecuencia. Una acción crítica principal del flujo no puede quedar
descubrible únicamente al abrir un menú genérico.

## 5. Estados obligatorios

| Estado | Contrato |
|---|---|
| Normal | Verbo y resultado reconocibles. |
| Hover | Cambio sutil con token; no revela información indispensable. |
| Focus | Indicador visible con contraste mínimo 3:1. |
| Pressed | Respuesta inmediata sin fingir que la operación terminó. |
| Loading | Bloquea repetición, conserva ancho, muestra verbo en progreso y `aria-busy`. |
| Disabled | No ejecuta, mantiene legibilidad y explica el motivo cuando la acción es esperable. La explicación no depende de enfocar el botón nativamente deshabilitado. |
| Success | Solo después del resultado durable; feedback transitorio más AVS-01/rastro cuando corresponde. |
| Error | No anuncia éxito; devuelve control operativo y presenta causa/recuperación en el canal adecuado. |

Los labels de loading usan una forma activa clara: “Guardando…”, “Emitiendo…”
o “Procesando…”. El éxito usa resultado: “Guardado”, “Factura emitida”.

## 6. Ocultar versus deshabilitar

- **Ocultar:** la acción no pertenece al rol, al producto contratado o al ciclo
  de vida visible. El servidor igualmente rechaza intentos no autorizados.
- **Deshabilitar:** la acción sí pertenece al flujo, pero falta un requisito
  temporal o corregible. Debe existir una explicación visible o asociada a un
  contenedor operable; un tooltip sobre el botón nativamente deshabilitado no
  es el único canal permitido.
- **No mostrar como disabled:** una acción que jamás estará disponible para ese
  usuario y cuya presencia revela datos o capacidades sensibles.
- **No ocultar:** una acción esperada cuyo bloqueo ayuda a comprender qué falta,
  salvo que seguridad/privacidad indique lo contrario.

## 7. Iconos y menús

- Icono + texto es el default para acciones nuevas o ambiguas.
- Icon-only se reserva para acciones frecuentes y reconocibles como cerrar,
  buscar o abrir menú; exige `aria-label` y tooltip.
- Objetivo mínimo: 32 × 32 px en escritorio y 44 × 44 px en touch.
- El icono conserva la misma metáfora en todos los módulos.
- Un menú con `role="menu"` implementa roving focus: ArrowDown/ArrowUp recorren
  opciones, Home/End saltan a extremos, Enter/Space activan y Escape cierra.
- ArrowDown en el trigger abre y enfoca la primera opción; ArrowUp abre y
  enfoca la última. Tab cierra sin secuestrar el recorrido natural.
- Escape restaura foco al trigger. Click externo cierra sin ejecutar opciones.
- El popup evita clipping eligiendo arriba/abajo según el espacio disponible.
- El menú no ejecuta al seleccionar con hover y no recuerda una opción
  destructiva como default sin aprobación específica.

## 8. Contrato reutilizable de acción

Toda acción nueva o modificada declara:

```ts
type GovernedAction = {
  actionKey: string;
  verb: string;
  outcome: string;
  role: "primary" | "secondary" | "tertiary" | "destructive" | "icon" | "menu";
  risk: "routine" | "important" | "critical";
  permanence: "P0" | "P1" | "P2" | "P3" | "P4" | "not-applicable";
  friction: "R1" | "R2" | "R3" | "not-applicable";
  permission: string | "authenticated" | "not-applicable";
  preconditions: string[];
  buttonType: "button" | "submit";
  idleLabel: string;
  loadingLabel?: string;
  successLabel?: string;
  errorRecovery: string;
  audit: { required: boolean; eventKey?: string };
  correlationId?: string;
  afterSuccess: "stay" | "refresh-context" | "navigate" | "close" | "remove-from-view";
  undo?: { available: boolean; windowMs?: number };
};
```

El contrato no tiene que existir todavía como tipo TypeScript único; sí debe
estar contestado en la política/SDD para que el futuro plugin pueda validarlo.
`not-applicable` y `required: false` deben justificarse: los campos no se omiten
silenciosamente.

## 9. Ejecución segura

- La UI bloquea doble click, pero el servidor debe aportar idempotencia o una
  garantía transaccional cuando duplicar la mutación cause daño.
- Antes de enviar, **Cancelar** permanece disponible. Después de iniciar una
  mutación que no puede interrumpirse con seguridad, el diálogo permanece
  abierto, bloquea repetición y explica el estado `pending`.
- `ActionButton` es el default para mutaciones únicas.
- `SplitActionButton` se usa solo para 2–4 resultados de la misma familia; no
  mezcla Guardar, Eliminar y Enviar como si fueran variantes equivalentes.
- MP-01 decide eliminación/anulación; AUD-01 decide evidencia; AVS-01 decide
  feedback. Ninguna de esas obligaciones se resuelve solo pintando el botón.
- Si el registro sale del filtro después del éxito, el aviso/enlace explica
  dónde quedó; no se navega automáticamente sin motivo.

## 10. Estado actual y brechas

- `app/studio/CLAUDE.md` ya contiene ocho reglas compatibles con este contrato.
- `ActionButton` implementa loading, anti-repetición, success y anuncios; el
  error depende del consumidor y debe auditarse.
- `SplitActionButton` conserva la última opción; falta verificar por uso que
  ninguna opción destructiva quede memorizada y que el teclado sea completo.
- La búsqueda estática encontró referencias a `ActionButton` en 78 archivos,
  `SplitActionButton` en 6 y `<button>` crudo en 341 archivos. Son indicadores
  de alcance, no fallos automáticos.
- El backend no tiene un contrato transversal de idempotencia para todas las
  mutaciones críticas.

## 11. Bloqueantes de redacción resueltos

1. Vocabulario oficial: resuelto en §3.
2. Orden por formularios, overlays, toolbars, filas y móvil: resuelto en §4.
3. Estados comunes: resuelto en §5.
4. Contrato reutilizable, iconos, doble ejecución y ocultar/deshabilitar:
   resuelto en §§6–9.
5. Semántica botón/enlace, tipo HTML y envío por teclado: resuelto en §2.
6. Primarios repetidos y destructivos en menú: resuelto en §§2 y 4.

## 12. Criterios de aprobación aplicados

- revisar expresamente el vocabulario y los verbos de negocio;
- confirmar el orden móvil y de diálogos destructivos;
- aceptar el contrato `GovernedAction` como información obligatoria;
- confirmar que una opción destructiva no puede memorizarse como default;
- registrar la aprobación del founder y actualizar el índice;
- después de aprobar, crear un SDD separado para auditoría/migración; esta
  política no autoriza por sí sola cambiar 341 archivos.

Gate conjunto preparado: [revisión SGE-00 + BTN-01](../reviews/sge-00-btn-01.md).

Los criterios fueron cerrados mediante REV-SGE-002 y la aprobación explícita
del founder el 2026-07-21. BTN-01 v1.0 es obligatorio para acciones nuevas o
modificadas; la adopción del legado se ejecuta por SDD y evidencia, no mediante
reemplazo masivo automático.
