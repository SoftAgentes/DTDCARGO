# Handoff · SDD-0680 · Bandeja: abre sola y rediseño

- **Owner:** Worker (sesión iniciada por el DG `local_25e2dded-…`), claim `local-sdd0680-worker`.
- **Ruta:** `.claude/worktrees/reverent-elbakyan-65151b`
- **Rama PR 1:** `sdd-0680-bandeja-abre-sola` (base `main` a `f9ae0b678`).
- **Spec:** `docs/specs/0680-bandeja-rediseno/spec.md`. Sin migración.
- **Permisos:** publicar mis PR (autorizado). Sin merge, sin Supabase/VPS/Chatwoot de producción.

## PR 1 · el bug

### Causa raíz (detalle en la spec)

1. `pedirConReintentos` no atajaba el rechazo de la server action: con el POST abortado la fase quedaba en `pidiendo` («Abriendo la bandeja…») para siempre, sin vigilante y con «Abrir de nuevo» deshabilitado.
2. El freno ponía la marca antes de pedir: los intentos fallidos gastaban cupo y al tercero «Abrir de nuevo» solo mostraba el freno.
3. La reconciliación salía antes que el SSO en la cola única de actions de Next.

### Cambios

- `app/studio/(app)/bandeja/_components/BandejaClient.tsx`: `pedirConPlazo` (rechazo, resultado raro o 15 s sin respuesta = `service`); `hayCupo` antes de pedir y la marca al cargar el enlace; la reconciliación espera a que termine el pedido.
- `app/studio/(app)/bandeja/__tests__/BandejaClient.test.tsx`: bloque «abre sola (SDD-0680)», 5 pruebas. Las de 0585/0655/0677 no se tocaron.

### Validación

Ver la sección «Validación» de la PR (se completa al correr con turno del DG).

## PR 2 · rediseño

- Maqueta con tres variantes (A sin barra, B riel lateral, C fila del CRM): https://claude.ai/artifact/6AGqJKyWhQxHBFW9WJyQof (privada de Sam).
- Pendiente: la elección de Sam. No se implementa nada antes.

## Impacto documental

- Spec nueva 0680; enmienda puntual de SDD-0677 §6 (un intento con `service` deja de contar para el freno), registrada en la 0680.
- Índice de specs: lo regenera `scripts/build-docs-index.mjs` / el merge.

## FUERA DE ALCANCE DETECTADO

- El origen exacto del `ERR_ABORTED` en el navegador del DG no se pudo confirmar sin tocar producción (NV en la spec).
- SDD-0677 sigue en `proposed` aunque está fusionada (#690).
