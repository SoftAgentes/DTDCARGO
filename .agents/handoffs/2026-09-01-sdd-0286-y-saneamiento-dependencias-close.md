# Cierre local · SDD-0286 y saneamiento de dependencias — 2026-09-01

> Este recibo documenta un cierre **local**. No hubo escritura en Supabase
> Cloud, migraciones, deploy ni publicación remota desde esta ventana.

- **Rama:** `codex/sdd0286-api-view-guard`
- **Worktree:** `DTD-worktrees/codex-sdd0286-api-view-guard`
- **Base revalidada:** `origin/main@670028498c72`
- **Commit SDD-0286:** `f4f0f38269fa`

## Qué quedó corregido

- Los 15 exports `GET` de `app/api/studio/**` tienen inventario contractual:
  7 rutas usan alcance RBAC por módulo y 8 quedan en allowlist por tener otra
  autorización específica.
- Las siete rutas protegidas cortan con HTTP `403` después de autenticar y antes
  de la primera consulta del dominio.
- El contrato AST comprueba el export real, el módulo exacto, el orden y el
  status HTTP; no acepta comentarios, callbacks, `403` decorativos ni condiciones
  invertidas como falsos verdes.
- La spec 0286 quedó en `done` y el índice registra 306 specs.

La revisión post-parche independiente terminó en `APPROVE` después de tres
iteraciones que endurecieron el test contractual.

## Dependencias

La auditoría completa inicial reportó 42 advisories: 22 altos, 16 moderados y
4 bajos. Se actualizaron 12 paquetes transitivos, segmentando por major cuando
era necesario.

Resultado final medido:

| Árbol | Antes | Después |
|---|---:|---:|
| Producción | 4 altos · 1 moderado · 1 bajo | 1 bajo (`@babel/core`) |
| Completo | 22 altos · 16 moderados · 4 bajos | 1 moderado (`uuid`) · 1 bajo (`@babel/core`) |

Los dos residuales se conservaron deliberadamente:

- `@babel/core`: el advisory pide `7.29.1`, versión que no está publicada; el
  salto disponible es Babel 8 y rompe el rango `^7.24.4` de React Hooks.
- `uuid`: ExcelJS declara `^8.3.0`. Forzar `11.1.1` hizo fallar la carga real de
  ExcelJS bajo pnpm, por lo que se retiró la override incompatible.

Prueba funcional posterior: ExcelJS creó en memoria un `.xlsx` válido de 6.388
bytes.

## Evidencia de verificación

- Focalizadas SDD-0286: 2 archivos, 25 pruebas verdes.
- Suite Vitest: 498 archivos, 5.873 pruebas verdes.
- `lint`: 0 errores y 8 warnings preexistentes.
- `typecheck`, `rsc-boundary`, 4 Edge Functions, `docs:check`, numbering,
  feature constants, componentes y gobernanza: verdes.
- Build de producción Next.js: verde.
- `pnpm verify` con `VERIFY_SKIP_E2E=1`: 11 de 15 pasos medidos, sin fallos.

No se declara un cierre verde completo. Quedaron sin medir:

- `migrations-applied`: el worktree no contiene credenciales Cloud;
- `sql-tests` y `schema-rebuild`: Docker no estaba disponible;
- E2E: el intento real falló en rutas autenticadas por ausencia de URL/clave
  anónima Supabase y un worker de Playwright no terminó en 300 segundos. El
  proceso se interrumpió después de conservar la evidencia; no se copiaron
  credenciales al worktree.

## Saneamiento físico ejecutado

- Se eliminaron de forma segura dos worktrees cuyo `HEAD` ya estaba contenido
  en `origin/main`, estaban limpios y tenían evidencia durable:
  `silly-germain-223bef` y `sdd0313-integracion`.
- Se eliminó la rama local ya integrada `codex/sdd0313-integracion` sin forzar.
- Se retiró `.pnpm-store` del checkout principal: era residuo regenerable de la
  auditoría y no estaba configurado como store activo.
- Se archivaron las tareas Codex cerradas «Revalida worktree seed E2E» y
  «Audita recepción del proyecto».

## Worktrees preservados deliberadamente

| Worktree | Estado que impide borrarlo |
|---|---|
| checkout principal | conserva cambios ajenos en `pnpm-lock.yaml` y `pnpm-workspace.yaml`; además está 18 commits detrás |
| `confident-napier-4d85ea` | contiene una migración y un contrato `0398` sin seguimiento; el número ya colisiona con `main` |
| `elastic-antonelli-b969d3` | su contenido SDD-0314 ya fue integrado y corregido en `main`, pero el `HEAD` histórico exacto no es ancestro de `origin/main` |
| `api-alcance` | implementación anterior y más débil de SDD-0286; queda supersedida por `f4f0f382`, pero su commit aún no está contenido en `origin/main` |
| `codex-recepcion-validacion` | cuatro commits documentales únicos no publicados; `README.md` merece rescate selectivo, `AGENTS.md` requiere revalidación y `CODEX_HANDOFF.md` está desactualizado |
| `project-knowledge-handoff` | cuatro reportes completos y sin secretos/PII, pero cuatro commits atrás; los Markdown requieren refresco y reubicación en `docs/audits/`, y los HTML son derivados que no conviene commitear |
| este worktree | conserva los commits locales hasta que exista una publicación autorizada y verificable |

Un worktree viejo o limpio no equivale a descartable. La eliminación queda
fail-closed hasta que la rama esté publicada, el `HEAD` exacto esté contenido
en `origin/main`, no exista tarea activa y haya evidencia durable.

## Gates externos pendientes

- Publicar esta rama en `origin/main` requiere aprobar el destino y los commits
  exactos después de ver este recibo.
- `codex/recepcion-validacion` requiere su propia autorización de push; no se
  mezclará con el código.
- Cloud, migraciones y deploy siguen siendo gates separados.
