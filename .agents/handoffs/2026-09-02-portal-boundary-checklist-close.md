# Cierre local · SDD-0335 · frontera Portal y checklist Codex

Fecha: 2026-09-02
Rama: `codex/saneamiento-integral`
Base remota medida: `origin/main` en `2a2e81bf554dbe7bd4f05170847e8f02e988d320`

## Resultado

Un contrato fail-closed congela las 11 rutas/23 construcciones `service_role`
de los RSC del Portal para impedir expansión silenciosa. El checklist de
arranque Codex concentra el orden de publicación, gates alojados, limpieza y
backlog técnico.

## Límite

El test no declara seguros los usos existentes. Reducirlos exige slices con
interfaces autocontenidas y, cuando aplique, migraciones autorizadas.

## Verificación local

- Guard focal: 1 archivo / 2 pruebas, ambas verdes.
- ESLint focal: verde.
- `docs:check`: verde; índice regenerado en 327 specs.
- Gobernanza: 28 políticas; componentes: 5 fuentes; ambos verdes.
- `git diff --check`: verde.

## Gates externos

- No se tocó RLS, Storage, Cloud, Producción, deploy ni push.
