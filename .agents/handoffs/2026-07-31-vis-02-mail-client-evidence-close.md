# Handoff de cierre — VIS-02 evidencia externa

| Control | Valor |
|---|---|
| Fecha | 2026-07-31 |
| Rol | worker documental en worktree aislado |
| Rama | `codex/vis-02-mail-client-evidence` |
| Worktree | `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\vis-02-mail-client-evidence` |
| Estado | listo para integración autorizada |

## Alcance cerrado

- REV-VIS-010 registra entrega controlada y estructura MIME/HTML en Gmail y
  Outlook.
- Outlook conserva el original `zh-CN` legible en modo oscuro.
- Gmail queda cerrado mediante la confirmación explícita del founder, como
  excepción de evidencia y sin equipararla a la captura original de Outlook.
- Apple Mail se clasifica `no aplica` por decisión explícita del founder; no se
  declara verificado.
- SDD-0175 queda `done`, con V0–V4 cerrados.
- La UI china conserva Noto Sans SC y BD-036 limita Noto Serif SC a documentos
  formales `lang="zh-CN"`.

## Rutas propias

- `docs/governance/README.md`
- `docs/governance/generated/governance-capsule.json`
- `docs/governance/policies/vis-02.md`
- `docs/governance/reviews/assets/vis-02/gmail-zh-cn-redacted.png`
- `docs/governance/reviews/assets/vis-02/outlook-zh-cn-redacted.png`
- `docs/governance/reviews/vis-02-external-mail-client-evidence.md`
- `docs/specs/0175-vis-02-tipografia-voz-idioma/spec.md`
- `docs/specs/README.md`

## Commits propios

- `b4aa4a9b` — registrar evidencia externa parcial.
- `2bf7c767` — registrar recepción humana.
- `5f056848` — adjuntar evidencia visual redactada.
- `0012ae39` — cerrar Gmail por confirmación del founder.
- `e6617fea` — cerrar VIS-02 sin gate Apple Mail.

Los commits de merge `3a4fa1d3`, `e831144a` y `0d4485c9` reconciliaron
actualizaciones previas de `origin/main` sin reescribir historia.

## Verificación

- `pnpm docs:check`: verde.
- `pnpm governance:check`: verde.
- `pnpm components:check`: verde; CMP-01 conserva cuatro fuentes.
- Vitest dirigido VIS-02: 3 archivos y 15 pruebas verdes.
- Suite Vitest completa previa a este cierre: 328 archivos y 4243 pruebas
  verdes.
- SQL efímero previo a este cierre: 38 contratos verdes.
- E2E aplicable previo a este cierre: 19 pruebas verdes y 3 omitidas.
- Build previo a este cierre: verde, 153 páginas.
- `git diff --check`: verde.

## Gates externos

- No se aplicaron migraciones ni cambios en Supabase.
- No se modificó Vercel ni se ejecutó un deploy manual.
- La publicación a `origin/main` fue autorizada por el founder mediante
  `cerrar`.

## Siguiente responsable

Un carril integrador separado debe reconciliar el commit nuevo
`34df6bc8` de `origin/main`, ejecutar el gate proporcional y publicar VIS-02
sin modificar el checkout local de `main`.

## Limpieza

No se elimina este worktree. La limpieza continúa como gate separado y
fail-closed.
