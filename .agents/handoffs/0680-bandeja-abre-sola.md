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

- Segundo bug (pedido del DG): `next.config.ts` › `fichaChatHeaders` con `frame-ancestors 'self' <chat>` por el doble marco Studio › chat › ficha; prueba en `lib/runtime/__tests__/next-config.test.ts`; runbook `docs/runbooks/chatwoot-ficha-dtd.md` (app registrada el 2026-11-19 con OK de Sam).

### Validación (turno de PC del DG, 2026-11-19)

- `pnpm install --frozen-lockfile`: PASÓ.
- **Antes del arreglo** (`BandejaClient.tsx` y `next.config.ts` de `f9ae0b678`, pruebas nuevas): vitest de `BandejaClient.test.tsx` + `next-config.test.ts`: FALLÓ como se esperaba, 7 fallidas (las 5 de 0680 y las 2 de la cabecera), 63 pasaron.
- **Después:** vitest de `app/studio/(app)/bandeja/__tests__`, `next-config.test.ts` y `proxy-ficha-chat.test.ts`: PASÓ, 9 archivos, 181 pruebas.
- `tsc --noEmit`: PASÓ. `eslint` de los 4 archivos de código: PASÓ.
- `pnpm verify` y e2e: NO EJECUTADOS (el turno era solo install + vitest; el portón es el CI).

## PR 2 · rediseño

- Maqueta con tres variantes (A sin barra, B riel lateral, C fila del CRM).
- Pendiente: la elección de Sam. No se implementa nada antes.

## Impacto documental

- Spec nueva 0680; enmienda puntual de SDD-0677 §6 (un intento con `service` deja de contar para el freno), registrada en la 0680.
- Índice de specs: lo regenera `scripts/build-docs-index.mjs` / el merge.

## FUERA DE ALCANCE DETECTADO

- El origen exacto del `ERR_ABORTED` en el navegador del DG no se pudo confirmar sin tocar producción (NV en la spec).
- SDD-0677 sigue en `proposed` aunque está fusionada (#690).
