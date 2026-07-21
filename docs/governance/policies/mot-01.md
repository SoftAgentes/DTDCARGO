# MOT-01 v0.1 — Movimiento, tiempos e interrupción

| Control | Valor |
|---|---|
| Código | MOT-01 |
| Estado | redactada — pendiente de aprobación |
| Creado | 2026-07-21 |
| Depende de | VIS-01 y A11Y-01 |

## Leyes

- El movimiento explica relación, cambio de estado o desplazamiento real.
- Salir debe sentirse más rápido que entrar; confirmar estado no espera una animación.
- Una interacción frecuente usa menos movimiento que una transición espacial.
- Interrumpir, cancelar o cambiar viewport conserva el estado real.
- `prefers-reduced-motion` elimina desplazamiento/escala no esencial.

## Tokens

| Token | Duración | Uso |
|---|---:|---|
| `--dur-fast` | 120 ms | Hover, pressed, salida corta y microestado. |
| `--dur` | 180 ms | Entrada/cambio estándar de componente. |
| `--dur-slow` | 260 ms | Drawer, reordenamiento o transición espacial que necesita seguimiento. |

No se crean valores directos si uno de los tres tokens comunica el cambio. Una
excepción declara motivo, distancia, posibilidad de interrupción y reduced motion.

## Reglas

- Animaciones de lista no retrasan la operabilidad; stagger queda limitado a
  pocos elementos y no se aplica por defecto en tablas densas.
- Progress ring representa tiempo/progreso real, no una espera artificial.
- Hover nunca es el único estado; focus/pressed reciben equivalencia.
- Loading largo usa LOD-01, no una transición de 260 ms repetida indefinidamente.
- Drag and drop usa MOT-01 para pickup, placeholder, destino y asentamiento,
  pero DND-01 decide semántica y accesibilidad.

## Gate

Verificar entrada, salida, interrupción, cambio de viewport, 60 Hz sin jank,
estado final correcto y reduced motion. Duración distinta a 120/180/260 ms
requiere una excepción documentada.
