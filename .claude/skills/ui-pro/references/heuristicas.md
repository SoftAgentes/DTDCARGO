# ui-pro reference: heurísticas de usabilidad

Carga esto SOLO al evaluar la dimensión 6, o para clasificar la severidad de cualquier hallazgo (la tabla de severidad de abajo aplica a TODAS las dimensiones).

## Vocabulario de diagnóstico (Norman)

- **Golfo de ejecución** — el usuario no sabe QUÉ hacer → faltan signifiers, mapping o constraints. **Test de 10 segundos:** usuario nuevo frente a la pantalla; si no descubre qué hacer en 10s, la descubribilidad está rota.
- **Golfo de evaluación** — no sabe QUÉ PASÓ → falta feedback o estado visible.
- **Escalera de tiempos de respuesta:** 0.1s = se siente instantáneo · 1s = notorio (cambia cursor/estado) · 10s = pierde la atención (muestra progreso) · >10s = abandono (muestra porcentaje).
- **No existe "error de usuario"** — busca la falla de diseño, no la del usuario.
- **Signifiers:** ante la duda, agrega uno — mejor sobre-comunicar que dejar adivinando. Si algo PARECE interactivo, debe serlo (y al revés).
- **Constraints:** imposibilita el error en vez de castigarlo — date picker vs texto libre; deshabilita lo no disponible (y explica por qué); secuencia forzada + undo.
- **Mapping natural:** el control cerca de lo que afecta; el layout espeja el contenido.

### Slips vs mistakes (clasifica antes de proponer fix)

| Tipo | Qué es | Fix |
|---|---|---|
| Slip de acción | quiso A, ejecutó B | separar acciones destructivas de las frecuentes |
| Error de modo | actuó en el modo equivocado | hacer el modo actual MUY visible (banner de edición); "misma acción, mismo resultado" |
| Mistake de regla | aplicó la regla equivocada | dar contexto y pedir confirmación |
| Mistake de conocimiento | modelo mental errado | mejorar el modelo conceptual (onboarding, copy, ejemplos) |

## Nielsen 10 — con red flags

| # | Heurística | Pasa si… | Red flags |
|---|---|---|---|
| 1 | Visibilidad de estado | feedback a toda acción; "Guardando… → Guardado"; skeletons | fallas silenciosas; spinner eterno sin mensaje |
| 2 | Sistema ↔ mundo real | lenguaje del cliente, orden natural | jerga interna en UI de cliente (p. ej. `markbox` crudo); códigos de error técnicos |
| 3 | Control y libertad | cancelar/deshacer/back siempre a mano | cancelación escondida; modal sin salida; flujo sin volver atrás |
| 4 | Consistencia | mismo término para el mismo concepto; componentes del sistema | dos nombres para lo mismo; botones que cambian de lugar entre vistas |
| 5 | Prevención de errores | inputs restringidos; defaults sensatos; aviso "cambios sin guardar" antes de navegar | texto libre donde va un picker; destructivo sin confirmación NI undo (usa `ConfirmDialog`, no `window.confirm`) |
| 6 | Reconocer > recordar | breadcrumbs, recientes, prefills; no re-pedir lo ya dado (WCAG 3.3.7) | pedir de memoria un código que el sistema ya conoce; memoria ≈7 ítems |
| 7 | Flexibilidad / eficiencia | ⌘K, atajos, bulk actions, disclosure progresivo | poder hacer solo de a 1 lo que en el ERP se hace de a 50 |
| 8 | Estética minimalista | cada elemento se gana su lugar; 1 CTA primario | 3 CTAs primarios; decoración sin función |
| 9 | Errores útiles | ver checklist de 5 puntos abajo | "ECONNREFUSED" / `error.message` crudo (usa el helper `apiError`); formulario que se vacía |
| 10 | Ayuda contextual | tooltips, hints "Cómo…" donde se necesita | solo referencia técnica; hint permanente que estorba (reducción progresiva: mostrar las primeras sesiones, luego quitar) |

### Checklist de mensaje de error (5 puntos — extiende Nielsen 9)

1. Dice qué pasó · 2. Dice cómo arreglarlo · 3. No culpa al usuario · 4. Preserva el trabajo/input · 5. Ofrece un camino alternativo.

## Krug (3 reglas)

1. **No me hagas pensar** — cada elemento auto-evidente o al menos auto-explicable.
2. **Clicks obvios > pocos clicks** — 3 clicks sin duda le ganan a 1 click ambiguo.
3. **Elimina la mitad de las palabras** — y luego la mitad de lo que quedó.

## Trunk test (6 preguntas — en la vista principal, sin scroll)

¿Qué sitio/app es? · ¿Qué página es? · ¿Cuáles son las secciones principales? · ¿Qué opciones tengo en este nivel? · ¿Dónde estoy dentro del todo? · ¿Dónde busco?

## Severidad de hallazgos (frecuencia × impacto × persistencia)

Puntúa cada factor 1–3 y multiplica (rango 1–27):

- **Frecuencia:** ¿cuántos usuarios / cuántas veces? — común=3 · ocasional=2 · raro=1
- **Impacto:** ¿bloquea la tarea, la retrasa o solo molesta? — bloquea=3 · retrasa=2 · molesta=1
- **Persistencia:** ¿golpea siempre o se aprende a esquivar? — siempre=3 · a veces=2 · una vez=1

| Nivel | Rango | Etiqueta |
|---|---|---|
| Catastrófico | ≥18, o cualquier bloqueo total de tarea / AA roto en un flujo core | `[catastrófico]` |
| Mayor | 10–17 | `[mayor]` |
| Menor | 5–9 | `[menor]` |
| Cosmético | 1–4 | `[cosmético]` |
