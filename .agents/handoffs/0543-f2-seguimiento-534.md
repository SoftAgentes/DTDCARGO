# Handoff 0543 · F2 · Seguimiento de la #534 (observaciones bajas de la re-revisión)

- Fecha: 2026-11-13 (Caracas = UTC − 4)
- Worker: la misma sesión que hizo la #534, abierta por el Subdirector Portal
- Worktree: `.claude/worktrees/0543-f2-seguimiento`, creado con `git worktree add`
- Rama: `claude/0543-f2-seguimiento`, desde `origin/main` en `7b1e05050` (merge de la #534)
- SDD: [0543](../../docs/specs/0543-consolidados-en-camino/spec.md), sigue `in-progress`; nota en «Seguimiento de la #534»
- Antecedente: [0543-f2-produccion-61-63](0543-f2-produccion-61-63.md)
- Permisos:
  - Push de la rama y PR lista (no borrador), autorizados por el Subdirector.
  - Sin merge.
  - Nada contra producción.
  - Sin `pnpm verify` local: el portón es el CI de GitHub más la revisión independiente.

## OBJETIVO ORIGINAL

1. Rechazar enlaces simbólicos en `--autorizacion` y en el `AUTORIZACION.txt` del lote, con prueba bash.
2. `trap 'exit 129' HUP INT TERM`, como `migraciones/aplicar.sh:149`, y el pid del dueño dentro del candado. Nunca soltar un candado ajeno. Con pruebas.
3. Con `--entorno produccion`, el generador no emite `deshacer.sql` ni `purgar.sql`, con su vitest. Además, el runbook §2b ya no manda borrarlos a mano.
4. Nota en la spec y handoff.

## COMPLETADO

- **`aplicar-lote.sh`.**
  - La autorización tiene que ser un archivo regular, no un enlace (`[[ -L ]]` y `[[ -f ]]`), tanto en `--autorizacion` como en el `AUTORIZACION.txt` del lote.
  - El candado escribe `pid` adentro. Al salir, `soltar_candado` lo suelta solo si el pid sigue siendo el suyo.
  - Traps de señal como en migraciones: `exit 129` HUP, `exit 130` INT, `exit 143` TERM. Usé los tres códigos de `migraciones/aplicar.sh:149`, en vez de 129 para los tres como decía el encargo.
  - El rechazo por candado tomado nombra el pid del dueño.
- **Generador.**
  - `archivosDelLote(entorno, …)` deja fuera `deshacer.sql` y `purgar.sql` cuando el entorno es `produccion`.
  - `generar()` se niega si la carpeta de salida ya trae alguno de los dos.
  - `resumen.md` de producción dice que el paquete no los trae y no menciona `--crear-clientes-faltantes`.
- **Pruebas.**
  - Bash: 60 casos en Linux (piso de `pruebas-linux.sh` de 53 a 60). En Git Bash para Windows `ln -s` copia, así que los 2 casos de enlace salen OMITIDOS y no cuentan: 58.
  - Vitest: un caso nuevo en `consolidados-sql.test.ts`, el paquete con y sin `deshacer`/`purgar`.
- **Runbook §2b**: enlaces rechazados, candado con dueño y señales, el paquete de producción sin `deshacer`/`purgar`. El paquete se sigue borrando del servidor después de `verificar`, por los nombres.
- **Spec 0543**: sección «Seguimiento de la #534».

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `bash infra/ops/tests/prueba-aplicar-lote.sh` (Git Bash, Windows) | PASÓ: 58 PASÓ, 0 FALLÓ, 2 OMITIDAS (enlaces) |
| Los 2 casos de enlace simbólico | NO DISPONIBLE en esta PC: sin permiso para enlaces nativos (`winsymlinks:nativestrict` da «Operation not permitted») y Docker apagado. Los corre el CI Linux; el piso 60 los exige |
| `vitest run --maxWorkers=1` consolidados-sql/previa-corte/modelo/excel | PASÓ: 4 archivos, 55 pruebas |
| `eslint` sobre `generar-lote.ts` y `consolidados-sql.test.ts` | PASÓ |
| `pnpm docs:check` (608 specs), `pnpm sdd:check`, `git diff --check` | PASÓ |
| `tsc --noEmit` completo | NO EJECUTADO en local (tarda más de 400 s con la PC cargada); lo cubre el CI |
| `pnpm verify` | NO EJECUTADO, por regla del DG |

Primer intento de las pruebas de señales: 3 FALLÓ, los tres por cómo estaba montada la prueba, no por el guion.
- `$!` daba el pid de la subshell de la función. Se corrigió con `exec`.
- SIGINT viene ignorado en los procesos lanzados con `&` sin control de trabajos. Se corrigió con `set -m` solo en esa sección.

## PENDIENTES DE ESTA TAREA

- Ver en el CI Linux los 2 casos de enlace simbólico.

## FUERA DE ALCANCE DETECTADO

- Ninguno nuevo. Los pendientes del 61, 62 y 63 siguen en el handoff de la #534.
