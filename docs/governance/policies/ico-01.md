# ICO-01 v1.0 — Iconografía semántica

| Control | Valor |
|---|---|
| Estado | aprobada — adopción pendiente |
| Aprobación | 2026-07-29 · Sam (founder) · REV-SGE-005 |
| Base actual | `app/studio/_components/icons.tsx` y sets heredados |

## Contrato

- Una metáfora conserva significado: papelera no significa archivar; cancelar
  UI no usa el mismo icono que anular contablemente sin etiqueta.
- Se reutiliza el catálogo central antes de dibujar/importar otro icono.
- Tamaño, stroke y alineación siguen el componente; no se corrigen con valores arbitrarios.
- Icono decorativo se oculta a tecnología asistiva.
- Icon-only exige nombre accesible, tooltip y target BTN-01.
- Acción ambigua, nueva o crítica usa icono + texto.
- Estado no depende del color del icono.
- Emojis no sustituyen iconos del producto.

## Gate

Revisar significado cross-módulo, nombre accesible, tooltip, target, contraste,
light/dark, RTL/CJK cuando aplique y ausencia de duplicados visuales.
