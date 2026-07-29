# Handoff opcional para Figma · comparación V0.1 / V0.2

## Estado

Montado el 2026-07-23 como archivo editable de Figma en el equipo de DTD Cargo:

- Archivo: [DTD Cargo · Dirección maestra del feed V0.2](https://www.figma.com/design/6CdGJ6tgiUGqSwZwaY5plq)
- File key: `6CdGJ6tgiUGqSwZwaY5plq`.
- Captura local de control: [`exports/11-figma-board.png`](exports/11-figma-board.png).
- Publicación en Instagram: no realizada.

## Lienzo

- Página: `DTD Cargo · Dirección maestra del feed`.
- Sección 1: `V0.1 · Editorial técnica`.
- Sección 2: `V0.2 · Editorial fotográfica · aprobada`.
- Sección 3: `Validación Instagram 3:4`.
- Separación horizontal mínima entre alternativas: 200 px.

## Assets

- V0.1: `../exports/00-vista-feed-3x3.png`.
- V0.2: `exports/00-vista-feed-fotografico.png`.
- Perfil: `exports/10-validacion-perfil-instagram.png`.
- Notas: [`../DECISION-DIRECCION-MAESTRA.md`](../DECISION-DIRECCION-MAESTRA.md),
  [`AUDITORIA-PERMISOS-FOTOGRAFIAS.md`](AUDITORIA-PERMISOS-FOTOGRAFIAS.md) y
  [`VALIDACION-INSTAGRAM.md`](VALIDACION-INSTAGRAM.md).

## Componentes sugeridos

1. Tarjeta de alternativa con nombre, estado y captura.
2. Etiquetas `Aprobada`, `Referencia estructural`, `Bloqueada por permisos` y
   `Condicional`.
3. Tabla de decisión con claridad, credibilidad, cercanía, reproducibilidad y
   riesgo de publicación.
4. Muestra de tokens sociales `--social-paper-warm` y
   `--social-paper-edge`, identificados como no globales.

## Variables locales creadas

Colección `Social Editorial · No global`, oculta para publicación como librería:

- `paper/warm` → `var(--social-paper-warm)` → `#FBF2E9`.
- `paper/edge` → `var(--social-paper-edge)` → `#F7ECE3`.
