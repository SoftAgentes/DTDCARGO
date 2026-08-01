# Cápsula operativa de gobernanza para agentes

Este documento conecta Codex, Claude Code, Cloud Design y CI con una sola
fuente: [el registro maestro](README.md). No copia las reglas ni crea una
constitución paralela.

## Secuencia mínima

1. Identifica superficie, módulo, riesgo y acción.
2. Consulta `generated/governance-capsule.json` y abre las políticas aplicables.
3. Si cambia comportamiento, crea o actualiza un SDD con allowlist exacta.
4. Clasifica cada hallazgo: `cumplimiento`, `no aplica`, `excepción` o
   `no conformidad`.
5. Usa componentes `canonical`; no crees consumidores nuevos de un
   `deprecated`.
6. Ejecuta `pnpm governance:check`, `pnpm components:check`,
   `pnpm docs:check` y el gate proporcional. El cierre canónico es
   `pnpm verify`.

## Enrutamiento

| Cambio | Abre primero |
|---|---|
| Acción, borrado, permanencia, auditoría | SGE-00, MP-01, BTN-01, AUD-01, AUD-02 |
| Formulario, error, carga, progreso | FRM-01, ERR-01, LOD-01, PRG-01 |
| Tabs, menús, búsqueda, teclado | A11Y-01, BTN-01, BUS-01 |
| Jerarquía, tipografía, movimiento | VIS-01, VIS-02, MOT-01 y `BRAND.md` |
| Componente nuevo o reemplazo | CMP-01 y registro generado de componentes |
| IA | IA-01 más privacidad, permisos y evidencia del dominio |
| Cloud Design / Norte | `BRAND.md`, Norte y luego las políticas de comportamiento |

## Límites

- El repositorio es la fuente normativa; cápsula y plugin son derivados.
- Sólo reglas aprobadas pueden bloquear. Investigación y recomendaciones no.
- Un script valida consistencia, pero nunca aprueba políticas, excepciones o
  promociones CMP.
- No se hace barrido masivo: la adopción avanza por slices R2/R3 con SDD propio.
- Cloud, Auth, producción, Vercel, instalación y marketplace conservan sus
  gates explícitos.
