# HTD-01 v1.0 — Confirmación por presión sostenida

| Control | Valor |
|---|---|
| Código | HTD-01 |
| Estado | aprobada — primer consumidor R3 verificado |
| Alcance | Acciones R3 críticas e irreversibles clasificadas por MP-01 |
| Depende de | [MP-01](mp-01.md), [BTN-01](btn-01.md), [AUD-01](aud-01.md) y [A11Y-01](a11y-01.md) |
| Creado | 2026-07-21 |

## 1. Decisión

La presión sostenida es una **ventana de compromiso**, no una animación de
espera. Solo puede añadirse cuando MP-01 clasifique la acción como R3 y el
usuario necesite demostrar intención continua antes de ejecutar una operación
irreversible o de impacto crítico.

No sustituye el permiso de servidor, la explicación de consecuencias, el
motivo obligatorio, la transacción ni el evento de auditoría.

## 2. Cuándo aplica

| Caso | Tratamiento |
|---|---|
| Acción reversible real | R1: ejecutar y ofrecer **Deshacer**. No usar HTD. |
| Acción importante recuperable | R2: `ConfirmDialog`. No usar HTD por defecto. |
| Anulación/reversión crítica | R3: diálogo, consecuencia, motivo y permiso. HTD es opcional según riesgo. |
| Purga irreversible excepcional | R3: HTD permitido después de todos los controles anteriores. |
| Acción frecuente o masiva | Diseñar revisión de alcance y resumen; no repetir HTD por cada fila. |

HTD nunca se usa para dar dramatismo, compensar una etiqueta ambigua ni ocultar
que el backend permite una operación que MP-01 prohíbe.

## 3. Secuencia normativa

1. El sistema muestra entidad, alcance y consecuencia concreta.
2. El usuario introduce motivo cuando la política lo exige.
3. El sistema verifica permiso y estado vigentes, sin ejecutar todavía.
4. Al comenzar la presión aparece progreso visible desde cero.
5. Soltar, perder el puntero, cambiar de ventana o cancelar antes de completar
   vuelve a cero y no dispara ninguna mutación.
6. Solo al completar el umbral se envía una solicitud única al servidor.
7. La fase de envío usa estado `pending` real, distinto del progreso de presión.
8. Éxito, error recuperable y correlación de auditoría siguen AVS-01/AUD-01.

## 4. Tiempo y representación

- **300 ms queda prohibido**: es demasiado corto para funcionar como decisión
  deliberada y puede confundirse con un click normal.
- El valor inicial de implementación es **1.500 ms**, expresado mediante un
  token y sujeto a prueba de usabilidad antes de declarar el patrón verificado.
- El progreso representa únicamente tiempo transcurrido; no simula trabajo del
  servidor ni inventa porcentajes.
- El anillo, barra o relleno debe avanzar de forma continua y mostrar texto
  inequívoco: **Mantén presionado para eliminar**.
- Al completar, el control cambia a `pending`; no reproduce el progreso.
- Con movimiento reducido se elimina la transformación decorativa, pero se
  conserva una señal estática/numérica comprensible del compromiso.

## 5. Accesibilidad y entradas

La presión sostenida no puede ser la única forma de confirmar. El mismo diálogo
ofrece una alternativa sin gesto cronometrado, por ejemplo una frase de
confirmación o un checkbox de consecuencia seguido del botón crítico.

- mouse, touch, teclado y tecnología asistiva alcanzan el mismo resultado;
- `pointercancel`, pérdida de captura, `blur` o pestaña oculta cancelan;
- la tecla no depende de repetición automática;
- el progreso se anuncia con moderación y no en cada frame;
- foco, nombre, descripción y estado son perceptibles;
- el target cumple A11Y-01 y no depende solo del color rojo.

Esta alternativa cumple el principio de que una interacción por arrastre o
presión tenga una vía de puntero simple y teclado.

## 6. Contrato de seguridad

- La solicitud incluye idempotency key/correlation id.
- El servidor vuelve a validar tenant, permiso, estado y clasificación.
- Doble ejecución y reintento concurrente se rechazan o deduplican.
- La mutación y el evento obligatorio de AUD-01 son atómicos.
- Una falla de auditoría impide la operación sensible.
- La UI no anuncia éxito hasta recibir confirmación del servidor.
- Una acción en curso no se cierra con Escape ni puede repetirse.

## 7. Criterios de aceptación

- R1/R2 no adoptan HTD sin una excepción documentada.
- Soltar antes del umbral produce cero solicitudes.
- Todos los eventos de cancelación reinician el progreso.
- Completar produce una sola solicitud aunque continúe la presión.
- La alternativa sin gesto cronometrado completa el mismo flujo.
- Permiso revocado o estado cambiado fallan de forma segura.
- El modo de movimiento reducido conserva intención y resultado.
- La prueba visual diferencia `holding`, `cancelled`, `pending`, `success` y
  `error`.
- La evidencia une acción, motivo y evento auditable mediante correlación.

## 8. Gate de implementación

HTD-01 no entra a código hasta que la entidad esté clasificada en MP-01 y exista
un SDD con amenaza, alternativa accesible, pruebas de interacción e integración
atómica con AUD-01. El valor de 1.500 ms es un punto de partida verificable, no
una licencia para aplicar el patrón en masa.

El primer consumidor se cerró mediante
[SDD-0215](../../specs/0215-htd-invoice-void/spec.md): anulación de factura R3,
motivo obligatorio, permiso server-side, guardas de estado y RPC auditada se
mantienen; `ConfirmDialog` añade presión sostenida cancelable y una alternativa
de checkbox + click. Esta evidencia no autoriza adopción masiva ni cambia el
tratamiento R1/R2.
