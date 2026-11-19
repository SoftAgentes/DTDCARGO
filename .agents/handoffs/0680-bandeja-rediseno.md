# Handoff · SDD-0680 · PR 2 · rediseño de la Bandeja y de Usuarios › Bandeja

- **Owner:** Worker (sesión iniciada por el DG `local_25e2dded-…`), claim `local-sdd0680-worker`.
- **Ruta:** `.claude/worktrees/reverent-elbakyan-65151b`
- **Rama:** `sdd-0680-bandeja-rediseno`, que sale de la cabeza de la #700 (`bbf85440a`) porque toca el mismo `BandejaClient.tsx`. Base de la PR: `main`. Mientras la #700 no entre, la PR 2 muestra también sus commits.
- **Spec:** `docs/specs/0680-bandeja-rediseno/spec.md`, parte 2. Sin migración.
- **Elección de Sam (2026-11-19):** «c y agente a» → Bandeja C, panel de agentes 1. Maqueta en un Artifact privado de Sam.

## Hecho

- Bandeja C: una fila con «CRM», pestañas, estado y acciones; el panel sin marco, con todo el ancho y hasta el borde de abajo de la ventana. Se retira la pantalla completa de SDD-0677 (Reducir/Esc/inert/preferencia) y las marcas `data-capa-fondo` del layout.
- «Abrir de nuevo» con ancho estable (BTN-01 §5).
- Revisión de la #700: M1 resuelto (un pedido que vence el plazo no se reintenta por la action y «Abrir de nuevo» recarga); B1 anotado como límite; B2, dos pruebas nuevas.
- Usuarios › Bandeja 1: tabla de vínculos con acción alineada; vincular y crear en dos tarjetas; el agente se elige por nombre y correo (`agentesDeCuenta`, solo lectura por la Platform API, dobles en las pruebas); el número a mano solo si Chatwoot no respondió.
- Textos es-VE y zh-CN.

## Validación (turno de PC del DG, 2026-11-19)

| Comprobación | Resultado |
|---|---|
| vitest `app/studio/(app)/bandeja/__tests__`, `usuarios/__tests__/AgentesBandeja.test.tsx`, `lib/studio/chatwoot/__tests__` | PASÓ: 51 archivos, 934 pruebas; 5 archivos `.poc` saltados (piden base, ya se saltaban) |
| vitest de los contratos (`*contract*.test.*`) | PASÓ: 32 archivos, 474 pruebas |
| `tsc --noEmit` | PASÓ |
| eslint de los archivos tocados | PASÓ |
| `check-rsc-boundary`, `governance:check`, `components:check`, `docs:check`, `sdd:check` | PASÓ |
| `/ui-check` | OK con ajustes menores (no bloqueante) |
| `pnpm verify`, e2e, prueba en navegador | NO EJECUTADOS |

## Pendientes de esta tarea

- Verlo en un navegador con datos de prueba: alto del panel, fila en móvil y selector de agentes (NV).
- M1 en un navegador real (NV, en la spec).

## Impacto documental

- Spec 0680, parte 2, con la allowlist y la gobernanza. Deja sin efecto la pantalla completa de la SDD-0677 (registrado en la 0680; la 0677 no se edita).

## FUERA DE ALCANCE DETECTADO

- Vincular o crear un agente no deja rastro en la tabla (resaltado de la fila) ni avisa con toast; ya era así (ui-check, baja).
- B1 de fondo: el aviso `dtd:sin-sesion` del panel (SDD-0677, opción c), que es config del VPS.
