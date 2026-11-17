# Handoff · SDD-0655 — La Bandeja pasa a ser una pestaña de CRM

Fecha: 2026-11-17 · Owner: Worker `w-0655-bandeja-en-crm` · Rama `claude/0655-bandeja-en-crm-e777fb`
· Worktree `.claude/worktrees/0655-bandeja-en-crm-e777fb` · Base `955c23059` · SDD asignada por el DG.

Decisión de Sam (chat del DG, literal): «A: pestaña en CRM». Spec: `docs/specs/0655-bandeja-en-crm/spec.md`
(enmienda de 0585 y 0647). Sin migración.

## Hecho

- `/studio/bandeja` se queda como ruta (CSP con `frame-src` y micrófono intactos; `next.config.ts` sin
  tocar). CRM y la Bandeja pintan la misma cabecera y la misma barra (`CrmPestanas`).
- Permisos por pestaña en `lib/studio/crm-acceso.ts`: Embudos = `kommo`; Bandeja = `bandeja` + flag
  `chatwoot_inbox`, con desvíos por rol y accesos extra.
- Menú: sin ítem «Bandeja» (`dentroDe: "kommo"`; `hidden` la sacaba también del mapa de accesos); «CRM» se ve si se ve alguna pestaña, lleva a Embudos o, a quien solo
  ve la Bandeja (`support`), a la Bandeja; activo en las dos rutas (`aria-current`); lleva `BandejaBadge`.
- «Agentes vinculados» → Usuarios, pestaña «Bandeja» (`?tab=bandeja`), solo con flag y Bandeja conectada,
  con el texto pedido. Mismas acciones; ahora también revalidan `/studio/usuarios`. La Bandeja le deja al
  admin el enlace «Agentes vinculados». Descartados y portal se quedan en la Bandeja.
- Guía: U1 sale del recorrido de la Bandeja (`PASO_ACCESO_BANDEJA`), textos aprobados sin cambio.
- Enlaces existentes (`?c=N` de fichas, hilo y push; guía): sin cambio, todos caen en la pestaña Bandeja.
  Prueba por valor en `crm-acceso.test.ts`. Ninguna e2e navega a `/studio/bandeja` (grep de `e2e/`: 0).

## Evidencia

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` | PASÓ (630 specs) |
| `node scripts/check-numbering.mjs` | PASÓ (sin repetidos; choques históricos 0342/0394 conocidos) |
| `git diff --check` | PASÓ |
| `pnpm install`, `tsc --noEmit`, vitest de los archivos tocados | NO EJECUTADO: el worktree no tiene `node_modules` y pedí turno al DG sin respuesta; no se corrió nada pesado en la PC |
| `pnpm verify` | NO EJECUTADO (por encargo: el portón es el CI de GitHub) |
| e2e | NO APLICA: ninguna e2e navega a `/studio/bandeja` |
| `/ui-check` | OK con ajustes menores: el alto del iframe (`calc(100dvh - 300px)`) es estimado; medirlo en el smoke |

Riesgo a mirar en el CI: tipos (`tsc`) de los archivos nuevos, la prueba del menú (`StudioSidebar-crm.test.tsx`,
primera que monta el menú completo) y las pruebas de la guía que contaban U1.

## Revisión independiente (DG, c0c2b01fd): CHANGES REQUESTED, solo pruebas

- Bloqueante atendido: `claridad-t5d-contract.test.ts` cuenta la barra en `CrmPestanas.tsx` (tablist 1, tab 1;
  mutantes de `data-activa` y `studio-tabs` movidos); KommoClient queda en 0; `TOTAL_PESTANAS` = 3; 9 archivos.
- (a) Usuarios llama a la Platform API solo con `?tab=bandeja`; la pestaña se ve con flag + Bandeja conectada.
- (b) comentario de U1 en `lib/i18n/es-VE/guide.ts` al día. (c) spec D7: U1 queda sin recorrido.
- Sin turno de PC: no corrí nada; lo dice el CI.

## Impacto documental

- Spec nueva 0655 e índice `docs/specs/README.md` regenerado (`build-docs-index`: sincronizado;
  `check-numbering`: sin repetidos).
- Pendiente de actualización (no editado aquí, fuera de allowlist): la sección de la Bandeja en
  `docs/specs/0585-chatwoot-bandeja-studio-e2/spec.md` sigue diciendo que los vínculos van debajo del
  marco; la 0655 la enmienda.

## FUERA DE ALCANCE DETECTADO

- El iframe roto que ve Sam (host distinto de `dtdcargo.com`): no se tocó.
- `puedeBandeja` del alta de agentes se calcula con los desvíos de la sesión del admin, que
  `getStudioAccess` deja vacíos para admin: ignora los desvíos por rol del miembro. Igual que antes; no se
  cambió para conservar la lógica.
- Un recorrido de guía para Usuarios que abra la pestaña Bandeja (U1) y la 9.6 (U3).
- Las claves `bandeja.page.eyebrow` y `bandeja.page.title` quedan sin uso en código.
