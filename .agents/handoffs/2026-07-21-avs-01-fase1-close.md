# Cierre AVS-01 · Fase 1

## Estado

- Rol: worker aislado.
- Rama: `feat/avs-01-fase1`.
- Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\avs-01-fase1`.
- Resultado: AVS-01 v1.0 aprobada; SDD-0165 marcado `done`.
- Commit: el commit de cierre que contiene este handoff; el hash queda visible en
  el remoto de la rama y en el recibo final de la tarea.
- Push: `origin/feat/avs-01-fase1`, ejecutado como último paso del cierre.

## Alcance implementado

- Contrato gobernado y adaptador compatible de `ToastProvider`.
- Temporizadores con tiempo restante, pausa por múltiples motivos, cola,
  prioridad, deduplicación y acciones asíncronas.
- Máximo 3 avisos en escritorio y 1 en móvil con safe area y teclado visual.
- Foco, Escape, capas anidadas e IDs accesibles en `ConfirmDialog`.
- Retiro de cinco confirmaciones nativas en Rutas y Mailing.
- Traducciones de estados de acción en español y chino.
- SDD-0165, índice documental y capturas autenticadas de cierre.

## Rutas propias

- `app/studio/(app)/admin/rutas/_components/CityDrawer.tsx`
- `app/studio/(app)/admin/rutas/_components/RouteDrawer.tsx`
- `app/studio/(app)/admin/rutas/_components/RoutesClient.tsx`
- `app/studio/(app)/mailing/_components/BlacklistView.tsx`
- `app/studio/(app)/mailing/_components/RuleEditorDrawer.tsx`
- `app/studio/_components/ui/ConfirmDialog.tsx`
- `app/studio/_components/ui/ConfirmDialog.test.tsx`
- `app/studio/_components/ui/ToastProvider.tsx`
- `app/studio/_components/ui/ToastProvider.test.tsx`
- `app/studio/_components/ui/drawer/useDialogA11y.ts`
- `app/studio/studio.css`
- `lib/i18n/es-VE/chrome.ts`
- `lib/i18n/zh-CN/chrome.ts`
- `docs/specs/README.md`
- `docs/specs/0165-sistema-gobernanza-experiencia-erp-studio/spec.md`
- `docs/specs/0165-sistema-gobernanza-experiencia-erp-studio/assets/*.png`
- `.agents/handoffs/2026-07-21-avs-01-fase1-close.md`

## Verificación

- `pnpm docs:index` y `pnpm docs:check`: verde, 159 specs.
- Tests puntuales: 2 archivos, 23/23 pruebas verdes.
- `pnpm typecheck`: verde.
- `pnpm lint`: 0 errores; 174 advertencias preexistentes.
- `pnpm test`: 279 archivos, 3880/3880 pruebas verdes.
- `pnpm build`: verde, 149 páginas; conserva el warning previo de trazado NFT
  de `app/marca/asset/[name]/route.ts` y fallbacks públicos por variables no
  cargadas en ese proceso.
- Búsqueda nativa: cero `window.confirm()` reales; solo comentario canónico y la
  función de negocio `confirm()` de Bitácora.
- Revisión visual autenticada: escritorio `1440 × 1000`, móvil `390 × 844`,
  acción Deshacer y confirmación destructiva anidada, sin confirmar mutaciones.

## Observaciones no bloqueantes

- `rrweb@2.0.0-alpha.4` emite `node.matches is not a function` ante mutaciones
  generales del DOM, incluso al abrir un drawer sin toast. No fue modificado por
  esta fase.
- El shell general del Studio tiene overflow horizontal a `390 px`; el toast de
  AVS-01 permanece dentro del viewport y respeta la reserva inferior.

## Migraciones y despliegue

- Migraciones: ninguna.
- Supabase alojado: no tocado.
- Deploy: no realizado.

## Siguiente responsable

El integrador exclusivo debe revisar este handoff e integrar la rama a `main`.
No eliminar este worktree hasta demostrar rama publicada, integración en `main`,
checkout limpio y ausencia de tareas activas en este `cwd`.
