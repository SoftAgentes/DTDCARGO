---
sdd: "0165"
title: "Sistema de Gobernanza de Experiencia ERP_Studio — AVS-01"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-21
updated: 2026-07-21
supersedes: null
superseded_by: null
related: ["0036", "0156", "0161", "0162"]
confidencialidad: interno
---

# DTD-0165 — Sistema de Gobernanza de Experiencia ERP_Studio

> **AVS-01 v1.0 aprobada.** Esta spec establece el contrato normativo de
> avisos transitorios y diálogos de confirmación del Studio. La Fase 1 cambia
> las primitivas centrales sin exigir una migración masiva de los consumidores
> existentes.

## 1. Propósito

Un aviso no es decoración: comunica el resultado, riesgo o siguiente paso de
una operación. Su comportamiento debe ser predecible entre módulos, preservar
el trabajo de la persona y no fingir que una acción fue auditada.

AVS-01 convierte esa intención en reglas ejecutables para:

- avisos transitorios (`toast`);
- acciones contextuales como **Deshacer**;
- cola, prioridad y deduplicación;
- adaptación entre escritorio y móvil;
- confirmaciones accesibles y seguras.

## 2. Principios normativos

1. El mismo evento produce el mismo tono y comportamiento en todos los módulos.
2. El sistema previene errores antes de limitarse a informarlos.
3. Un aviso explica el resultado y, cuando corresponde, ofrece recuperación.
4. El tiempo disponible se mide desde que el aviso es visible, no desde que fue
   solicitado.
5. Pausar no reinicia el reloj ni extiende artificialmente la duración.
6. Prioridad organiza lo pendiente; nunca desplaza una tarea que la persona ya
   está leyendo o ejecutando.
7. Una acción en curso no admite doble ejecución, reemplazo ni expulsión.
8. El color acompaña la semántica, pero no la sustituye.
9. Todo control tiene nombre accesible, foco predecible y alternativa con
   movimiento reducido.
10. El toast no escribe auditoría. Solo puede enlazar, mediante
    `correlationId`, un evento durable creado por la lógica de negocio.

## 3. Matriz ERP actual versus gobernanza

| Área | Antes de AVS-01 | Regla objetivo | Decisión de Fase 1 |
|---|---|---|---|
| API | `success/info/warning/error` en ~121 consumidores | contrato rico y obligatorio para avisos nuevos | conservar API heredada y añadir `show()` |
| Tono neutral | no disponible | permitir información sin carga semántica | añadir `neutral` solo en `show()` |
| Duración | 5 s; 8 s cuando había enlace | 5 s normal, 8 s con acción, 10 s deshacer, persistente explícito | implementar alias nominales y número |
| Inicio del reloj | al crear el aviso | al entrar en estado visible | corregir en la primitiva |
| Pausa | hover reiniciaba duración completa | conservar tiempo restante por cada motivo | hover, foco y pestaña oculta independientes |
| Cola | tres visibles, FIFO simple | 3 escritorio, 1 móvil; prioridad solo pendiente | implementar sin expulsión |
| Cambio de viewport | sin adaptación | devolver excedentes a cola con orden y tiempo | reaccionar con `matchMedia`, sin remontar |
| Duplicados | tarjetas repetidas | actualizar por `dedupeKey` | actualizar sin extender el reloj visible |
| Acción | enlace de navegación | enlace o callback síncrono/asíncrono | `acting`, bloqueo doble, recuperación al fallar |
| Auditoría | sin contrato | no confundir aviso con evidencia | `correlationId` referencial, cero escritura |
| Foco de toast | sin restauración | devolver al elemento anterior válido | restaurar en cierre desde teclado/acción |
| Confirmación | coexistían diálogo canónico y cinco `confirm()` nativos | un patrón accesible | retirar los cinco usos reales |
| Foco destructivo | podía comenzar en confirmar | comenzar en la salida segura | foco inicial en **Cancelar** |
| Movimiento | 200 ms directo | token aprobado de 180 ms | usar `var(--dur)` y reducir movimiento |
| Móvil | posición fija de escritorio | respetar navegación inferior y safe area | viewport de ancho disponible sobre la barra |

## 4. Alcance de la Fase 1

### Incluye

- contrato AVS-01 compatible en `ToastProvider`;
- estados internos, temporizadores, cola, prioridad y deduplicación;
- comportamiento responsive de la región de avisos;
- acciones asíncronas y recuperación de error;
- accesibilidad de toast y `ConfirmDialog`;
- migración de las cinco confirmaciones nativas halladas en Rutas y Mailing;
- pruebas unitarias y revisión visual de escritorio/móvil;
- documentación de la API heredada como tal, sin warnings en producción.

### No incluye

- migración de los consumidores existentes a `toast.show()`;
- cambios de Supabase, `entity_audit_log` o notificaciones persistentes;
- AUD-02 (consulta, conservación, exportación y acceso de logs);
- HTD-01 (hold to delete) ni niveles de eliminación;
- plugin de gobernanza;
- telemetría de avisos.

## 5. Contrato público

Las llamadas existentes conservan firma y resultado:

```ts
toast.success(message, options);
toast.info(message, options);
toast.warning(message, options);
toast.error(message, options);
toast.dismiss(id);
```

Todo aviso nuevo gobernado usa:

```ts
toast.show({
  eventKey,
  tone,
  message,
  priority,
  scope,
  dedupeKey,
  action,
  duration,
  correlationId,
});
```

Tipos normativos:

- `ToastTone`: `neutral | info | success | warning | error`.
- `ToastPriority`: `low | normal | high`.
- `ToastScope`: `page | module | system`.
- `ToastDuration`: `default | action | undo | persistent | number`.
- `ToastAction`: enlace o callback síncrono/asíncrono.
- `GovernedToastInput`: contrato obligatorio para nuevas llamadas.

`default` equivale a 5 segundos, `action` a 8, `undo` a 10 y
`persistent` no cierra automáticamente. El `link` heredado es un alias
compatible de una acción de navegación. Un número negativo se normaliza a cero.

## 6. Máquina de estados

El ciclo conceptual es:

```text
queued → visible ↔ paused → acting → resolved
                    │          └→ action_failed → visible/acting
                    └→ dismissed | expired
```

Reglas:

- `queued` no consume tiempo;
- el reloj comienza al entrar en `visible`;
- cada pausa agrega un motivo independiente;
- reanudar elimina solo ese motivo y conserva el tiempo restante;
- durante `acting` se bloquean acción, cierre y sustitución por deduplicación;
- si falla la acción, el aviso permanece y presenta recuperación;
- `persistent` solo sale por cierre manual o resolución explícita.

## 7. Cola, prioridad y deduplicación

- Escritorio admite hasta tres avisos visibles; móvil, uno.
- Cambiar a un viewport menor devuelve los excedentes a la cola, conservando
  identidad, orden y tiempo restante.
- `high`, `normal` y `low` ordenan solo la cola. Dentro de cada nivel rige FIFO.
- La prioridad no expulsa avisos visibles.
- Repetir `dedupeKey` actualiza el registro existente.
- Una actualización visible no reinicia ni amplía el reloj.
- Una acción en curso no se sustituye ni se desplaza.

## 8. Comportamiento responsive

En escritorio la región se mantiene abajo a la derecha. En móvil ocupa el
ancho disponible con márgenes laterales y se coloca sobre la navegación
inferior, incluyendo `env(safe-area-inset-bottom)`. El cambio de viewport no
remonta tarjetas ni descarta cola o tiempo.

La comprobación contra teclado, botones flotantes y controles fijos forma parte
de la revisión visual de cada superficie que integre un aviso nuevo.

## 9. Accesibilidad y foco

### Toast

- estados rutinarios: `role="status"` y `aria-live="polite"`;
- solo un bloqueo urgente explícito puede usar `role="alert"` y anuncio
  `assertive`;
- acción y cierre tienen nombres accesibles;
- `Escape` cierra cuando no existe una acción en curso;
- al retirar un toast enfocado, el foco vuelve al elemento previo conectado;
- `prefers-reduced-motion` conserva el cambio de estado sin transformación.

### ConfirmDialog

- reutiliza `useDialogA11y` para focus trap, Escape y restauración;
- destructivo enfoca **Cancelar**;
- no destructivo puede enfocar confirmación o motivo mediante `initialFocus`;
- título, descripción y motivo usan IDs únicos;
- `pending` impide cierre y doble confirmación;
- un motivo requerido vacío impide continuar y recibe foco.

## 10. Movimiento y lenguaje visual

La entrada del toast usa `var(--dur)` (180 ms), no un valor directo. Se
mantienen los tokens, fuentes, colores, radios y sombras vigentes; esta fase no
crea un lenguaje visual paralelo ni introduce glassmorphism, gradientes o
adornos.

## 11. Compatibilidad y migración

La estrategia es **adaptador primero, consumidores después**:

1. La Fase 1 instala el contrato y conserva las cuatro funciones heredadas.
2. Cada futura intervención en un módulo migra sus avisos nuevos o tocados a
   `toast.show()` con `eventKey`, `scope` y `dedupeKey` estables.
3. Un barrido posterior retira la API heredada solo cuando no existan
   consumidores y haya evidencia de regresión completa.

No se emiten advertencias en runtime ni se introduce feature flag. La
compatibilidad queda cubierta por tipos y pruebas.

## 12. Confirmaciones nativas retiradas

La Fase 1 sustituye exactamente estos cinco casos por `ConfirmDialog`:

1. desactivar ciudad en `admin/rutas`;
2. eliminar ruta en `admin/rutas`;
3. eliminar ruta desde la lista de rutas;
4. eliminar regla de mailing;
5. remover una dirección de la blacklist de mailing.

La función de negocio `confirm()` de `Bitácora/ActaReview` no es una API nativa
del navegador y queda intacta.

## 13. Criterios de aceptación

### ToastProvider

- la API heredada sigue funcionando;
- `neutral` funciona mediante `show()`;
- duraciones 5/8/10 y persistente verificadas;
- la cola no expira antes de mostrarse;
- hover, foco y pestaña oculta conservan el tiempo restante;
- reanudar no reinicia el reloj;
- se respetan máximos 3/1 y el cambio de viewport;
- prioridad solo reorganiza pendientes;
- deduplicación no duplica ni extiende el visible;
- acción asíncrona impide doble ejecución;
- fallo de acción mantiene un camino de recuperación;
- Escape/cierre restauran foco;
- movimiento reducido elimina transformación.

### ConfirmDialog

- destructivo enfoca **Cancelar**;
- no destructivo respeta el foco configurado;
- Tab permanece dentro del diálogo;
- Escape cierra salvo durante `pending`;
- `pending` bloquea cierre y doble confirmación;
- el foco vuelve al control que abrió;
- motivo requerido impide confirmar vacío;
- IDs accesibles no colisionan.

### Regresión y gates

- cero usos reales de confirmación nativa en Studio y móvil;
- `pnpm docs:check`;
- pruebas unitarias puntuales de ambas primitivas;
- `pnpm typecheck`, `pnpm lint`, `pnpm test` y `pnpm build`;
- `/ui-check` o su revisión equivalente documentada, en escritorio y móvil.

## 14. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| romper consumidores actuales | firmas heredadas intactas + test de regresión |
| que una cola larga oculte un error | prioridad solo en pendiente y máximo explícito |
| extender avisos indefinidamente por eventos repetidos | deduplicación visible conserva tiempo restante |
| doble mutación desde una acción | estado `acting` deshabilita repetición |
| pérdida de foco | captura del control previo y restauración si sigue conectado |
| confundir feedback con auditoría | prohibición explícita de escritura y `correlationId` referencial |

## 15. Evidencia esperada de cierre

- diff de esta spec y del índice generado;
- pruebas puntuales verdes;
- búsqueda que demuestre la ausencia de confirmaciones nativas reales;
- typecheck, lint, suite y build con resultado registrado;
- revisión visual de la región de toast y el diálogo en ambos breakpoints;
- rama/worktree reportados sin push hasta autorización del founder.

### Revisión correctiva del 2026-07-21

La segunda revisión técnica cerró cuatro bloqueantes detectados sobre la primera
implementación:

1. al reducir el viewport, los avisos devueltos a la cola se reordenan por
   prioridad y conservan FIFO dentro del nivel;
2. una actualización por `dedupeKey` retira la pausa `action-failed` y reanuda
   el tiempo restante sin ampliarlo;
3. en overlays anidados, solo el diálogo superior maneja foco, Tab y Escape;
4. `toast.dismiss(id)` restaura el foco cuando el aviso retirado lo contenía.

Estas correcciones tienen regresiones unitarias específicas.

### Verificación visual autenticada y cierre del 2026-07-21

La revisión se ejecutó dentro del Studio autenticado, sobre un banco temporal
que solo disparó estados locales y no confirmó acciones ni escribió datos de
negocio. El gate visual quedó aprobado con esta evidencia:

- escritorio `1440 × 1000`: máximo de tres avisos visibles, jerarquía estable y
  ubicación inferior derecha sin cubrir controles;
- transición escritorio → móvil → escritorio: un aviso visible en móvil y cola
  pendiente reordenada por prioridad; al volver, el error urgente usa
  `role="alert"` y `aria-live="assertive"`;
- acción **Deshacer**: estado `acting`, texto **Procesando…**, acción y cierre
  deshabilitados hasta resolver;
- capas anidadas: dos diálogos montados, foco inicial en **Cancelar**, Escape
  cierra primero la confirmación y luego el drawer, restaurando el foco;
- móvil `390 × 844`: una sola tarjeta, `x = 16`, ancho `348` y borde inferior en
  `736`, por encima de la reserva inferior de `108 px`.

Capturas aprobadas:

- [cola de avisos en escritorio](assets/avs-01-desktop-toast-queue.png);
- [acción Deshacer en curso](assets/avs-01-desktop-undo-acting.png);
- [confirmación destructiva sobre drawer](assets/avs-01-desktop-nested-confirm.png);
- [aviso adaptado a móvil](assets/avs-01-mobile-toast.png).

El error de consola `node.matches is not a function` fue aislado en la versión
alpha existente de `rrweb`: también aparece al abrir un drawer sin disparar un
toast y ningún archivo del grabador técnico forma parte del diff de AVS-01. Se
registra como deuda externa no bloqueante de esta fase. Del mismo modo, el
overflow horizontal del shell general del Studio a `390 px` antecede a esta
primitiva; la tarjeta AVS-01 permanece íntegramente dentro del viewport.

Con los gates automatizados y visuales verdes, AVS-01 v1.0 queda aprobada y la
implementación de la Fase 1 se considera cerrada.

## 16. Fases posteriores

1. Migrar consumidores por módulo, empezando por eventos críticos y repetidos.
2. Implementar HTD-01 dentro de la matriz de permanencia, no como reemplazo
   universal del diálogo.
3. Completar AUD-02 y enlazar `correlationId` con consulta autorizada de logs.
4. Cargar y validar Noto Serif SC para correos/PDF según VIS-02.
5. Convertir la gobernanza aprobada en plugin persistente con reglas,
   validadores y recetas de corrección.
