# VIS-01 v1.0 — Jerarquía y presupuesto de énfasis visual

| Control | Valor |
|---|---|
| Código | VIS-01 |
| Versión | 1.0 |
| Dueño | Sam (founder) |
| Estado | aprobada |
| Creado | 2026-07-21 |
| Fuente visual | [`BRAND.md`](../../../BRAND.md) y Norte vigente |
| Relacionada | [VIS-02](vis-02.md), BTN-01 y A11Y-01 |

## 1. Ley central

La interfaz debe mostrar qué es estructura, qué es contenido, qué exige acción
y qué representa riesgo antes de que el usuario lea cada palabra. El énfasis
se asigna por importancia y frecuencia, no por decoración.

## 2. Regla 60-30-10

60-30-10 es una guía de composición, no una cuota de píxeles:

| Capa orientativa | Función |
|---|---|
| 60 · base | Fondos, superficies de lectura y espacio neutral. |
| 30 · estructura | Navegación, agrupación, encabezados, bordes y jerarquía secundaria. |
| 10 · acento | Identidad, selección, acción dominante y semántica necesaria. |

Una tabla densa puede usar más neutral; una alerta crítica puede usar más
semántica. Romper la proporción es válido cuando mejora comprensión,
accesibilidad o seguridad y se mantiene la jerarquía.

## 3. Roles de color

- **Base/surface:** soporta lectura prolongada y densidad operativa.
- **Ink:** contenido y jerarquía tipográfica.
- **Wine:** identidad, selección y acción primaria; no significa peligro.
- **Navy/dark:** estructura y acción secundaria importante.
- **Success/warning/danger/info/neutral:** estado estable y transversal.
- **Categórico:** diferencia entidades comparables; nunca sustituye semántica.

El mismo color no puede significar “seleccionado” en un módulo y “error” en
otro. `danger` no se sustituye por wine. La IA no recibe púrpuras, neones o
gradientes “mágicos” como identidad paralela.

## 4. Escala de énfasis

| Nivel | Uso |
|---|---|
| E0 | Fondo y estructura silenciosa. |
| E1 | Metadata, ayuda y contenido secundario legible. |
| E2 | Contenido operativo normal. |
| E3 | Título de sección, selección o estado relevante. |
| E4 | Acción principal o dato decisivo. Solo uno dominante por contexto. |
| E5 | Riesgo crítico o bloqueo. Se usa por consecuencia, no para llamar atención comercial. |

Más color, tamaño, peso, elevación y movimiento no se acumulan sin límite. Para
subir un elemento de nivel se reduce el énfasis de sus competidores.

## 5. Reglas medibles

- una pantalla/contexto tiene máximo una acción E4;
- texto normal alcanza 4.5:1; texto grande, controles y foco alcanzan 3:1;
- estados no dependen únicamente de color;
- todo color, spacing, radio, sombra y duración usa tokens aprobados;
- `--ink-mute` queda limitado a disabled/decorativo, no cuerpo o placeholder activo;
- semántica se conserva en light/dark y en móvil;
- un estado crítico puede elevarse a E5, pero no convierte toda la pantalla en alerta;
- hover no contiene información indispensable;
- la reducción de movimiento conserva el cambio de estado.

## 6. Composición por superficie

| Superficie | Dominante | Restricción |
|---|---|---|
| Dashboard | Información priorizada y una acción contextual | Evitar mosaicos de tarjetas con igual peso. |
| Listado | Datos, filtros y selección | Acciones de fila no compiten con el header. |
| Formulario | Secuencia de campos y decisión final | Labels y errores prevalecen sobre decoración. |
| Drawer/modal | Título, consecuencia y footer | Una sola acción dominante; destructiva separada. |
| Documento/PDF | Identidad + lectura de datos | No depender de interacción, hover, dark mode o animación. |
| Móvil | Tarea actual y controles alcanzables | Menos elementos simultáneos sin perder significado. |

## 7. Excepciones

Una desviación visual usa `BRAND-CHECK` y registra objetivo, superficie,
tokens, contraste, duración y fecha de revisión. Tendencia, video o preferencia
personal no bastan como excepción.

## 8. Estado del ERP

Fortalezas:

- tokens duales y semánticos existentes;
- contraste documentado;
- `danger` separado de wine;
- una acción primaria definida en el estándar actual;
- movimiento reducido presente en primitivas recientes.

Pendiente de adopción:

- auditoría por módulo/light/dark/móvil;
- eliminar usos arbitrarios de color/tamaño que dupliquen roles;
- comprobar una acción dominante en headers, drawers y diálogos;
- revisar placeholders, metadata y warnings contra contraste real.

## 9. Gate VIS-01

Una revisión registra `cumple/no aplica/excepción/no cumple` para: presupuesto
de énfasis, acción dominante, semántica de color, contraste, tokens, estados sin
color, light/dark, móvil y movimiento reducido. Cualquier fallo de lectura o
significado es bloqueante; una diferencia estética menor se registra como deuda.
