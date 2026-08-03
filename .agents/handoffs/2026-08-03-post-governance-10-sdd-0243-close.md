# Cierre — Post-Gobernanza 10 · SDD-0243

| Control | Resultado |
|---|---|
| Fecha | 2026-08-03 |
| Rol de cierre | integrador autónomo del carril propio |
| Rama | `codex/post-governance-10-slices` |
| Worktree | `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\post-governance-10-slices` |
| Base | `origin/main@b78a686336aedadc24cd7a508ae54d788f8c2243` |
| Integración funcional | `fd948577` publicada por fast-forward atómico a `origin/main` y a la rama propia |
| Estado | cerrado en Git; migración y smoke runtime pendientes |

## Alcance y rutas propias

El carril implementó únicamente el slice R3 `Anular gasto` de Gastos, con
autorización `accounting` + `admin`, motivo, replay, período contable,
atomicidad gasto/asiento/auditoría y preservación del recibo.

La lista exacta de 24 rutas funcionales, documentales y de cierre está
versionada en `docs/specs/0243-gastos-anulacion-gobernada/spec.md` §5. Este
handoff forma parte de esa allowlist únicamente como recibo de cierre.

## Revisión de commits

Se revisaron individualmente y sin hallazgos abiertos:

1. `038a105c` — reserva canónica SDD-0243;
2. `2ed98936` — auditoría y propuesta del slice;
3. `be61d4a2` — contrato SQL y pruebas;
4. `dd3c6ad1` — integración Studio/Móvil;
5. `f85474b0` — evidencia durable;
6. `fd948577` — ocultamiento permission-aware encontrado durante el cierre.

La revisión detectó un único defecto: Studio exponía la acción a
`operations`/`warehouse` aunque servidor y RPC la denegaban. `fd948577`
resuelve la capability en servidor, propaga un booleano y prueba el
ocultamiento. No quedaron observaciones funcionales pendientes en el lote.

## Verificación

- `pnpm verify`: todo verde;
- Vitest: 396 archivos y 4684 pruebas verdes;
- contratos SQL: 70/70;
- schema rebuild: 333 migraciones, 316 aplicadas y 17 sólo-ledger;
- Playwright: 72 verdes y 18 omitidas;
- build: verde, 155 páginas;
- PLG-01: read-only, 27 políticas, cuatro componentes, 7/7;
- `docs:check`, `governance:check`, `components:check` y
  `git diff --check`: verdes.

Las seis omisiones de SDD-0243 corresponden a la ausencia del fixture
autenticado ficticio; no se registran como evidencia runtime ni como defecto.
El gate `migrations-applied` no recibió service-role key y fue compensado por
el preflight Cloud metadata-only documentado en REV-SGE-058.

## Push, migración y deploy

- Push funcional: fast-forward atómico exitoso
  `b78a6863..fd948577` a `origin/main` y creación de la rama remota propia.
- El último commit funcional tocó código y es elegible para el build automático
  de Vercel; no se ejecutó deploy manual ni se afirmó estado runtime.
- `0340_expense_void_governance` permanece sólo como artefacto Git. No fue
  aplicada a Cloud/Producción y requiere autorización individual por basename.
- E5 permaneció cerrado: cero tenants y cero eventos elegibles.

## Concurrencia y limpieza

La inspección del árbol de agentes mostró únicamente esta tarea, pero las
herramientas globales de tareas de la aplicación no estuvieron disponibles.
Git mantiene numerosos worktrees históricos con ownership externo no
demostrado. No se tocó ningún checkout ajeno.

La limpieza física de este worktree queda bloqueada mientras esta tarea usa el
`cwd`; los worktrees históricos se conservan. No se ejecutaron `reset`,
`clean`, `stash`, `merge`, `rebase`, force-push ni borrado manual.

## Siguiente responsable

Una nueva ventana debe revalidar `origin/main`, autorizar nominalmente y aplicar
`0340_expense_void_governance` mediante el runbook productivo, confirmar el
deploy compatible y ejecutar smoke autenticado por rol antes de evaluar Gastos
como `VA`.
