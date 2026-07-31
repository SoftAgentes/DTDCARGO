# Cierre SDD-0194 — ReceiptRowActions accesible

## Estado

- Fecha: 2026-07-31
- Rol: worker aislado
- Rama: `codex/lint-warning-audit`
- Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\lint-warning-audit`
- Resultado: listo para publicar e integrar por autorización literal `cerrar`

## Alcance integrado

SDD-0194 corrige el menú de acciones de recepción del Almacén CN sin modificar
acciones de servidor, permisos, auditoría, datos ni migraciones. Completa
flechas, Home/End, foco inicial y restaurado, Escape, Tab, posicionamiento según
viewport y objetivos mínimos de 32 px; además elimina el estado ARIA
incompatible del `menuitem` de verificación.

## Rutas propias

1. `app/studio/(app)/cn/_components/ReceiptRowActions.tsx`
2. `app/studio/(app)/cn/_components/ReceiptRowActions.test.tsx`
3. `docs/specs/0194-receipt-row-actions-accesibilidad/spec.md`
4. `docs/architecture/module-sdd-map.md`
5. `docs/specs/README.md`
6. `.agents/handoffs/2026-07-31-sdd-0194-receipt-row-actions-close.md`

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 v1.0 | cumplimiento | No cambian resultados de negocio; mejora SGE-00.10 |
| A11Y-01 v1.1 | cumplimiento | Teclado, foco restaurado y popup sin clipping |
| BTN-01 v1.1 | cumplimiento | Menú ARIA completo y target interno de 32 px |
| CMP-01 v1.1 | no aplica | No crea, promueve ni depreca componentes |

El validador del plugin reporta que su `policy-registry.json` derivado está
desactualizado. Los validadores normativos del repositorio confirman 27
políticas aprobadas, cápsula vigente y cuatro fuentes CMP-01.

## Verificación ejecutada

- ESLint focalizado: cero errores y cero advertencias.
- Vitest focalizado: 1 archivo, 3/3 pruebas verdes.
- `pnpm typecheck`: verde.
- `pnpm docs:check`: verde.
- `pnpm governance:check`: verde.
- `pnpm components:check`: verde.
- `git diff origin/main...HEAD --check`: verde.
- `pnpm lint`: cero errores y 172 advertencias legacy.

## Commits

- `4c72d2fe06a20d7a414e005a8095b577ae72ac2e` — implementación y SDD.
- Este handoff se registra en un commit documental selectivo.

## Gates externos preservados

- No se aplicaron migraciones ni cambios en Cloud o Producción.
- No se modificó Vercel ni se verificó un autodeploy.
- Las migraciones `0294_audit_d2_human_reasons`,
  `0295_audit_d3_human_reasons` y
  `0296_audit_d4_empty_search_path` permanecen como los únicos tres gates
  técnicos para cerrar SDD-0174; cada aplicación en Producción requiere
  autorización nominal individual.
- Las 172 advertencias restantes conservan carril independiente por slices con
  SDD y allowlist propios.

## Siguiente responsable

Integrador exclusivo en un worktree nuevo basado en el `origin/main` vigente:
consumir estos dos commits, repetir el gate proporcional y publicar `main`.
